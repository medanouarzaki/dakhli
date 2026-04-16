import type { PrismaClient } from "@prisma/client";

export type BudgetUsageRow = {
  budgetId: string;
  categoryId: string;
  categoryName: string;        // localized
  categoryNameEn: string | null;
  categoryNameAr: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  amountMAD: number;           // budget limit
  consumedMAD: number;         // sum of EXPENSE this month
  percent: number;             // 0-100+
  status: "ok" | "warning" | "exceeded";
};

/**
 * Computes budget usage for the current month.
 * Returns one row per active (non-deleted) budget for the user,
 * sorted by percent descending (most consumed first).
 */
export async function computeBudgetUsage(
  prisma: PrismaClient,
  userId: string,
  locale: string
): Promise<BudgetUsageRow[]> {
  // 1. Fetch all active budgets for this user with their category
  const budgets = await prisma.budget.findMany({
    where: { userId, deletedAt: null, period: "monthly" },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          nameEn: true,
          nameAr: true,
          icon: true,
          color: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (budgets.length === 0) return [];

  // 2. Compute current month range (UTC)
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  // 3. Fetch sum of EXPENSE amountMAD per categoryId for the current month
  const categoryIds = budgets.map((b) => b.categoryId);

  const consumed = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      userId,
      deletedAt: null,
      type: "EXPENSE",
      categoryId: { in: categoryIds },
      occurredAt: { gte: monthStart, lt: monthEnd },
    },
    _sum: { amountMAD: true },
  });

  const consumedMap = new Map(
    consumed.map((c) => [c.categoryId, Number(c._sum.amountMAD ?? 0)])
  );

  // 4. Build rows
  const rows: BudgetUsageRow[] = budgets.map((b) => {
    const limit = Number(b.amountMAD);
    const spent = consumedMap.get(b.categoryId) ?? 0;
    const pct = limit > 0 ? Math.round((spent / limit) * 1000) / 10 : 0;

    const catName =
      locale === "ar"
        ? (b.category.nameAr ?? b.category.name)
        : locale === "en"
          ? (b.category.nameEn ?? b.category.name)
          : b.category.name;

    return {
      budgetId: b.id,
      categoryId: b.categoryId,
      categoryName: catName,
      categoryNameEn: b.category.nameEn,
      categoryNameAr: b.category.nameAr,
      categoryIcon: b.category.icon,
      categoryColor: b.category.color,
      amountMAD: limit,
      consumedMAD: spent,
      percent: pct,
      status: pct >= 100 ? "exceeded" : pct >= 70 ? "warning" : "ok",
    };
  });

  // Sort by percent descending (most consumed first)
  rows.sort((a, b) => b.percent - a.percent);

  return rows;
}
