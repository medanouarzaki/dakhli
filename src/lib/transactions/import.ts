import { Prisma, PrismaClient, TransactionSource, ImportStatus } from "@prisma/client";
import pLimit from "p-limit";
import { categorizeTransaction } from "@/lib/ai/categorize";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ImportCandidate = {
  date: string;        // ISO YYYY-MM-DD
  description: string;
  amount: number;      // positive
  currency: "MAD" | "EUR" | "USD";
  type: "EXPENSE" | "INCOME";
};

export type ImportedTransactionResult = {
  ok: true;
  importBatchId: string;
  createdCount: number;
  skippedDuplicates: number;
  categorizedCount: number;
};

export type DuplicateDetected = {
  candidate: ImportCandidate;
  existingTransactionId: string;
  existingOccurredAt: Date;
};

// ─── Deduplication ───────────────────────────────────────────────────────────

/**
 * Match key = (YYYY-MM-DD, trimmed lower description, amountMAD rounded to cents).
 * Scans only a bounded window (±1 day around candidate range) to avoid full-history scans.
 */
export async function findDuplicates(
  prisma: PrismaClient,
  userId: string,
  accountId: string,
  candidates: ImportCandidate[]
): Promise<{ duplicates: DuplicateDetected[]; uniques: ImportCandidate[] }> {
  if (candidates.length === 0) return { duplicates: [], uniques: [] };

  const dates = candidates.map((c) => new Date(c.date));
  const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
  const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));
  minDate.setDate(minDate.getDate() - 1);
  maxDate.setDate(maxDate.getDate() + 1);

  const existing = await prisma.transaction.findMany({
    where: {
      userId,
      accountId,
      deletedAt: null,
      occurredAt: { gte: minDate, lte: maxDate },
    },
    select: { id: true, description: true, amountMAD: true, occurredAt: true },
  });

  const duplicates: DuplicateDetected[] = [];
  const uniques: ImportCandidate[] = [];

  for (const candidate of candidates) {
    const candDesc = candidate.description.trim().toLowerCase();
    const candAmt = roundTo2(candidate.amount);

    const hit = existing.find((e) => {
      const eDate = e.occurredAt.toISOString().slice(0, 10);
      const eDesc = e.description.trim().toLowerCase();
      const eAmt = roundTo2(Number(e.amountMAD));
      return (
        eDate === candidate.date &&
        eDesc === candDesc &&
        Math.abs(eAmt - candAmt) < 0.01
      );
    });

    if (hit) {
      duplicates.push({
        candidate,
        existingTransactionId: hit.id,
        existingOccurredAt: hit.occurredAt,
      });
    } else {
      uniques.push(candidate);
    }
  }

  return { duplicates, uniques };
}

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ─── Batch categorization ────────────────────────────────────────────────────

type CategorizedCandidate = ImportCandidate & {
  categoryId: string | null;
  aiConfidence: number | null;
};

/**
 * Calls Haiku for each candidate in parallel (capped at 5 concurrent calls).
 * Resolves categoryCode → categoryId via a single pre-fetched map.
 * Per-transaction failures are swallowed: categoryId becomes null, import continues.
 */
export async function categorizeBatch(
  prisma: PrismaClient,
  candidates: ImportCandidate[],
  userId: string
): Promise<CategorizedCandidate[]> {
  // Single query to build code → id map for system + user categories
  const allCategories = await prisma.category.findMany({
    where: { OR: [{ userId }, { isSystem: true }] },
    select: { id: true, code: true },
  });
  const codeToId = new Map<string, string>(
    allCategories
      .filter((c): c is typeof c & { code: string } => c.code !== null)
      .map((c) => [c.code, c.id])
  );

  const limit = pLimit(5);

  const tasks = candidates.map((candidate) =>
    limit(async () => {
      try {
        const result = await categorizeTransaction(candidate.description, candidate.type);
        if (!result) {
          return { ...candidate, categoryId: null, aiConfidence: null };
        }
        return {
          ...candidate,
          categoryId: codeToId.get(result.categoryCode) ?? null,
          aiConfidence: result.confidence,
        };
      } catch {
        return { ...candidate, categoryId: null, aiConfidence: null };
      }
    })
  );

  return Promise.all(tasks);
}

// ─── Atomic persistence ──────────────────────────────────────────────────────

/**
 * Creates one ImportBatch + N Transaction rows in a single SQL transaction.
 * Multi-currency conversion is deferred: amount == amountMAD, exchangeRate = 1.
 */
export async function persistImport(
  prisma: PrismaClient,
  userId: string,
  accountId: string,
  filename: string,
  categorized: CategorizedCandidate[]
): Promise<ImportedTransactionResult> {
  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.importBatch.create({
      data: {
        userId,
        source: TransactionSource.PDF_IMPORT,
        fileName: filename,
        status: ImportStatus.COMPLETED,
        rowsTotal: categorized.length,
        rowsImported: categorized.length,
      },
    });

    let createdCount = 0;
    let categorizedCount = 0;

    for (const c of categorized) {
      const amountDec = new Prisma.Decimal(c.amount.toFixed(2));

      await tx.transaction.create({
        data: {
          userId,
          accountId,
          categoryId: c.categoryId,
          type: c.type,
          description: c.description,
          amount: amountDec,
          currency: c.currency,
          amountMAD: amountDec,
          exchangeRate: new Prisma.Decimal(1),
          occurredAt: new Date(c.date),
          source: TransactionSource.PDF_IMPORT,
          importBatchId: batch.id,
          aiCategorized: c.categoryId !== null,
          aiConfidence: c.aiConfidence,
        },
      });

      createdCount++;
      if (c.categoryId !== null) categorizedCount++;
    }

    return { batchId: batch.id, createdCount, categorizedCount };
  });

  return {
    ok: true,
    importBatchId: result.batchId,
    createdCount: result.createdCount,
    skippedDuplicates: 0,
    categorizedCount: result.categorizedCount,
  };
}
