// ─── Dashboard stats computation utilities ───────────────────────────────────
// All functions accept a PrismaClient instance so they remain testable and
// composable without importing the singleton directly.
// All monetary values are in MAD (amountMAD column), returned as plain numbers.

import type { PrismaClient, Prisma } from "@prisma/client";
import type { PeriodRange } from "./period";

// ─── Public types ─────────────────────────────────────────────────────────────

export type KpiSummary = {
  incomeMAD: number;
  expenseMAD: number;
  netMAD: number;
  txCount: number;
};

export type KpiWithTrend = KpiSummary & {
  /** null when no previous range exists or previous value was 0 */
  incomeDeltaPct: number | null;
  expenseDeltaPct: number | null;
  netDeltaPct: number | null;
};

export type CategoryBreakdownRow = {
  categoryId: string | null;
  name: string;
  icon: string | null;
  color: string | null;
  totalMAD: number;
  txCount: number;
  percentOfTotal: number;
};

export type TimeBucket = {
  label: string;
  incomeMAD: number;
  expenseMAD: number;
};

export type HeatmapCell = {
  /** 0 = Monday … 6 = Sunday (ISO 8601) */
  weekday: number;
  totalMAD: number;
  txCount: number;
};

// ─── Internal helpers ─────────────────────────────────────────────────────────

function baseWhere(
  userId: string,
  range: PeriodRange
): Prisma.TransactionWhereInput {
  return {
    userId,
    deletedAt: null,
    occurredAt: { gte: range.start, lt: range.end },
  };
}

/** Safe percentage delta. Returns null when base is 0 or null range. */
function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Convert Prisma Decimal / null to plain number */
function toNum(v: unknown): number {
  if (v === null || v === undefined) return 0;
  return Number(v);
}

/** Localize a category name using the same logic as TransactionRow */
function localizeCategoryName(
  cat: { name: string; nameEn: string | null; nameAr: string | null },
  locale: string
): string {
  if (locale === "ar") return cat.nameAr ?? cat.name;
  if (locale === "en") return cat.nameEn ?? cat.name;
  return cat.name;
}

function othersLabel(locale: string): string {
  if (locale === "ar") return "أخرى";
  if (locale === "en") return "Other";
  return "Autres";
}

// ─── computeKpis ─────────────────────────────────────────────────────────────

export async function computeKpis(
  prisma: PrismaClient,
  userId: string,
  range: PeriodRange
): Promise<KpiSummary> {
  const [byType, txCount] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["type"],
      where: { ...baseWhere(userId, range), type: { in: ["INCOME", "EXPENSE"] } },
      _sum: { amountMAD: true },
    }),
    prisma.transaction.count({
      where: baseWhere(userId, range),
    }),
  ]);

  const incomeMAD = toNum(
    byType.find((r) => r.type === "INCOME")?._sum.amountMAD
  );
  const expenseMAD = toNum(
    byType.find((r) => r.type === "EXPENSE")?._sum.amountMAD
  );

  return {
    incomeMAD,
    expenseMAD,
    netMAD: incomeMAD - expenseMAD,
    txCount,
  };
}

// ─── computeKpisWithTrend ─────────────────────────────────────────────────────

export async function computeKpisWithTrend(
  prisma: PrismaClient,
  userId: string,
  currentRange: PeriodRange,
  previousRange: PeriodRange | null
): Promise<KpiWithTrend> {
  const current = await computeKpis(prisma, userId, currentRange);

  if (!previousRange) {
    return {
      ...current,
      incomeDeltaPct: null,
      expenseDeltaPct: null,
      netDeltaPct: null,
    };
  }

  const previous = await computeKpis(prisma, userId, previousRange);

  return {
    ...current,
    incomeDeltaPct: deltaPct(current.incomeMAD, previous.incomeMAD),
    expenseDeltaPct: deltaPct(current.expenseMAD, previous.expenseMAD),
    netDeltaPct: deltaPct(current.netMAD, previous.netMAD),
  };
}

// ─── computeExpenseBreakdownByCategory ───────────────────────────────────────

export async function computeExpenseBreakdownByCategory(
  prisma: PrismaClient,
  userId: string,
  range: PeriodRange,
  locale: string,
  topN = 5
): Promise<CategoryBreakdownRow[]> {
  // Total EXPENSE in period (denominator for percentages)
  const totalAgg = await prisma.transaction.aggregate({
    where: { ...baseWhere(userId, range), type: "EXPENSE" },
    _sum: { amountMAD: true },
  });
  const totalExpenseMAD = toNum(totalAgg._sum.amountMAD);

  if (totalExpenseMAD === 0) return [];

  // Group by categoryId
  const groups = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: { ...baseWhere(userId, range), type: "EXPENSE" },
    _sum: { amountMAD: true },
    _count: true,
    orderBy: { _sum: { amountMAD: "desc" } },
  });

  // Fetch category details for all grouped IDs
  const catIds = groups
    .map((g) => g.categoryId)
    .filter((id): id is string => id !== null);

  const categories = await prisma.category.findMany({
    where: { id: { in: catIds } },
    select: {
      id: true,
      name: true,
      nameEn: true,
      nameAr: true,
      icon: true,
      color: true,
    },
  });

  const catMap = new Map(categories.map((c) => [c.id, c]));

  const rows: CategoryBreakdownRow[] = groups.map((g) => {
    const cat = g.categoryId ? catMap.get(g.categoryId) : undefined;
    const totalMAD = toNum(g._sum.amountMAD);
    return {
      categoryId: g.categoryId,
      name: cat
        ? localizeCategoryName(cat, locale)
        : othersLabel(locale),
      icon: cat?.icon ?? null,
      color: cat?.color ?? null,
      totalMAD,
      txCount: g._count,
      percentOfTotal:
        totalExpenseMAD > 0
          ? Math.round((totalMAD / totalExpenseMAD) * 1000) / 10
          : 0,
    };
  });

  if (rows.length <= topN) return rows;

  // Slice top N, bucket the rest as "Autres"
  const top = rows.slice(0, topN);
  const rest = rows.slice(topN);

  const othersTotal = rest.reduce((s, r) => s + r.totalMAD, 0);
  const othersCount = rest.reduce((s, r) => s + r.txCount, 0);

  top.push({
    categoryId: null,
    name: othersLabel(locale),
    icon: null,
    color: null,
    totalMAD: othersTotal,
    txCount: othersCount,
    percentOfTotal:
      totalExpenseMAD > 0
        ? Math.round((othersTotal / totalExpenseMAD) * 1000) / 10
        : 0,
  });

  return top;
}

// ─── computeIncomeExpenseSeries ───────────────────────────────────────────────

export async function computeIncomeExpenseSeries(
  prisma: PrismaClient,
  userId: string,
  range: PeriodRange
): Promise<TimeBucket[]> {
  // Resolve effective start: if range.start predates the user's earliest
  // transaction, clamp to that transaction's date so we don't generate
  // thousands of empty buckets (most relevant for the "all" period key).
  const earliest = await prisma.transaction.findFirst({
    where: { userId, type: { in: ["INCOME", "EXPENSE"] } },
    select: { occurredAt: true },
    orderBy: { occurredAt: "asc" },
  });

  const effectiveStart =
    earliest && earliest.occurredAt > range.start
      ? earliest.occurredAt
      : range.start;

  const spanDays =
    (range.end.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24);

  // Three granularities based on effective span
  const granularity: "daily" | "monthly" | "yearly" =
    spanDays <= 35 ? "daily" : spanDays <= 730 ? "monthly" : "yearly";

  // Fetch all relevant transactions (still using original range for data)
  const txs = await prisma.transaction.findMany({
    where: {
      ...baseWhere(userId, range),
      type: { in: ["INCOME", "EXPENSE"] },
    },
    select: { occurredAt: true, type: true, amountMAD: true },
    orderBy: { occurredAt: "asc" },
  });

  // Build accumulator map keyed by label format for the chosen granularity
  const acc = new Map<string, { incomeMAD: number; expenseMAD: number }>();

  for (const tx of txs) {
    const label =
      granularity === "daily"
        ? tx.occurredAt.toISOString().slice(0, 10)  // YYYY-MM-DD
        : granularity === "monthly"
        ? tx.occurredAt.toISOString().slice(0, 7)   // YYYY-MM
        : String(tx.occurredAt.getUTCFullYear());    // YYYY

    const existing = acc.get(label) ?? { incomeMAD: 0, expenseMAD: 0 };
    if (tx.type === "INCOME") {
      existing.incomeMAD += toNum(tx.amountMAD);
    } else {
      existing.expenseMAD += toNum(tx.amountMAD);
    }
    acc.set(label, existing);
  }

  // Generate all bucket labels between effectiveStart and range.end (gaps → 0)
  const buckets: TimeBucket[] = [];

  if (granularity === "daily") {
    const cur = new Date(effectiveStart);
    while (cur < range.end) {
      const label = cur.toISOString().slice(0, 10);
      const data = acc.get(label) ?? { incomeMAD: 0, expenseMAD: 0 };
      buckets.push({ label, ...data });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  } else if (granularity === "monthly") {
    const cur = new Date(
      Date.UTC(effectiveStart.getUTCFullYear(), effectiveStart.getUTCMonth(), 1)
    );
    const endMonth = new Date(
      Date.UTC(range.end.getUTCFullYear(), range.end.getUTCMonth(), 1)
    );
    while (cur <= endMonth) {
      const label = cur.toISOString().slice(0, 7);
      const data = acc.get(label) ?? { incomeMAD: 0, expenseMAD: 0 };
      buckets.push({ label, ...data });
      cur.setUTCMonth(cur.getUTCMonth() + 1);
    }
  } else {
    // Yearly: iterate year by year from effectiveStart's year to range.end's year
    const startYear = effectiveStart.getUTCFullYear();
    const endYear = range.end.getUTCFullYear();
    for (let y = startYear; y <= endYear; y++) {
      const label = String(y);
      const data = acc.get(label) ?? { incomeMAD: 0, expenseMAD: 0 };
      buckets.push({ label, ...data });
    }
  }

  return buckets;
}

// ─── computeWeekdayExpenseHeatmap ─────────────────────────────────────────────

export async function computeWeekdayExpenseHeatmap(
  prisma: PrismaClient,
  userId: string,
  range: PeriodRange
): Promise<HeatmapCell[]> {
  const txs = await prisma.transaction.findMany({
    where: { ...baseWhere(userId, range), type: "EXPENSE" },
    select: { occurredAt: true, amountMAD: true },
  });

  // Initialize 7 cells (Mon=0 … Sun=6)
  const cells: HeatmapCell[] = Array.from({ length: 7 }, (_, i) => ({
    weekday: i,
    totalMAD: 0,
    txCount: 0,
  }));

  for (const tx of txs) {
    // JS getUTCDay(): 0=Sun, 1=Mon, …, 6=Sat
    // ISO weekday (Mon=0): (getUTCDay() + 6) % 7
    const iso = (tx.occurredAt.getUTCDay() + 6) % 7;
    cells[iso].totalMAD += toNum(tx.amountMAD);
    cells[iso].txCount += 1;
  }

  // Round totals to 2dp
  for (const c of cells) c.totalMAD = Math.round(c.totalMAD * 100) / 100;

  return cells;
}

// ─── computeRecentTransactions ────────────────────────────────────────────────

export async function computeRecentTransactions(
  prisma: PrismaClient,
  userId: string,
  range: PeriodRange,
  limit = 10
): Promise<
  Prisma.TransactionGetPayload<{ include: { category: true; account: true } }>[]
> {
  return prisma.transaction.findMany({
    where: baseWhere(userId, range),
    include: { category: true, account: true },
    orderBy: { occurredAt: "desc" },
    take: limit,
  });
}
