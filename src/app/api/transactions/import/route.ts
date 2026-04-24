import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  findDuplicates,
  categorizeBatch,
  persistImport,
  type ImportCandidate,
} from "@/lib/transactions/import";

// ─── Route config ─────────────────────────────────────────────────────────────

export const runtime = "nodejs";
// Haiku batch + Prisma $transaction with ~25 rows
export const maxDuration = 120;

// ─── Request schema ──────────────────────────────────────────────────────────

const ImportRequestSchema = z.object({
  accountId: z.string().min(1),
  filename: z.string().min(1).max(255),
  confirmDuplicates: z.boolean().optional().default(false),
  transactions: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        description: z.string().min(1).max(500),
        amount: z.number().positive().finite(),
        currency: z.enum(["MAD", "EUR", "USD"]),
        type: z.enum(["EXPENSE", "INCOME"]),
      })
    )
    .min(1)
    .max(500),
});

// ─── Error helpers ────────────────────────────────────────────────────────────

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_BODY"
  | "ACCOUNT_NOT_FOUND"
  | "DUPLICATES_DETECTED"
  | "INTERNAL_ERROR";

function errorResponse(
  code: ApiErrorCode,
  status: number,
  extra?: Record<string, unknown>
) {
  return NextResponse.json({ error: code, ...(extra ?? {}) }, { status });
}

// ─── POST handler ─────────────────────────────────────────────────────────────

/**
 * POST /api/transactions/import
 *
 * Workflow:
 *  1. auth + body validation
 *  2. verify accountId belongs to user
 *  3. duplicate detection by (date, description, amountMAD)
 *  4. duplicates found + confirmDuplicates=false → 409 with duplicates payload
 *  5. Haiku categorization on candidates to import (capped at 5 concurrent)
 *  6. atomic persist (ImportBatch + N Transactions)
 *  7. return { ok, importBatchId, createdCount, skippedDuplicates, categorizedCount }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return errorResponse("UNAUTHORIZED", 401);
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("INVALID_BODY", 400, { reason: "malformed JSON" });
  }

  const parsed = ImportRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("INVALID_BODY", 400, {
      issues: parsed.error.issues.slice(0, 10),
    });
  }
  const { accountId, filename, confirmDuplicates, transactions } = parsed.data;

  const account = await prisma.financialAccount.findFirst({
    where: { id: accountId, userId, deletedAt: null },
    select: { id: true, currency: true },
  });
  if (!account) {
    return errorResponse("ACCOUNT_NOT_FOUND", 404);
  }

  const candidates: ImportCandidate[] = transactions;
  const { duplicates, uniques } = await findDuplicates(prisma, userId, accountId, candidates);

  if (duplicates.length > 0 && !confirmDuplicates) {
    return errorResponse("DUPLICATES_DETECTED", 409, {
      duplicates: duplicates.map((d) => ({
        candidate: d.candidate,
        existingTransactionId: d.existingTransactionId,
        existingOccurredAt: d.existingOccurredAt.toISOString(),
      })),
      uniqueCount: uniques.length,
      duplicateCount: duplicates.length,
    });
  }

  // If confirmed, import all (including duplicates). Otherwise, only uniques.
  const toImport = confirmDuplicates ? candidates : uniques;

  if (toImport.length === 0) {
    return NextResponse.json({
      ok: true,
      importBatchId: null,
      createdCount: 0,
      skippedDuplicates: duplicates.length,
      categorizedCount: 0,
    });
  }

  const categorized = await categorizeBatch(prisma, toImport, userId);

  try {
    const result = await persistImport(prisma, userId, accountId, filename, categorized);
    return NextResponse.json({
      ...result,
      skippedDuplicates: confirmDuplicates ? 0 : duplicates.length,
    });
  } catch (error) {
    console.error("[import] persistence failed:", error);
    return errorResponse("INTERNAL_ERROR", 500);
  }
}
