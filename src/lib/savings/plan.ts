// Deterministic savings-capacity baseline — zero AI.
// Used by /api/savings/analyze to build the context passed to Claude.

import type { PrismaClient } from "@prisma/client";
import { computeProjection } from "@/lib/planning/projection";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FeasibilityStatus = "feasible" | "tight" | "unrealistic";

export type SavingsBaseline =
  | { reached: true; goalId: string; title: string; targetMAD: number; currentMAD: number }
  | {
      reached: false;
      goalId: string;
      title: string;
      targetMAD: number;
      currentMAD: number;
      remaining: number;
      targetDate: string | null;
      monthsUntilDeadline: number | null;
      requiredMonthly: number | null;
      avgMonthlySavingCapacity: number;
      avgMonthlyIncome: number;
      avgMonthlyExpense: number;
      feasibilityStatus: FeasibilityStatus;
      baseMonthlyRemaining: number | null; // from Prévisionnel module if available
      recentTopCategories: Array<{ name: string; monthlyMAD: number }>;
    };

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HISTORY_MONTHS = 6;
const HISTORY_MS = HISTORY_MONTHS * 30.44 * 24 * 3600 * 1000;

function diffMonths(from: Date, to: Date): number {
  return Math.max(
    1,
    Math.ceil((to.getTime() - from.getTime()) / (30.44 * 24 * 3600 * 1000))
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function computeSavingsBaseline(
  prisma: PrismaClient,
  userId: string,
  goalId: string
): Promise<SavingsBaseline> {
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId, deletedAt: null },
    select: { id: true, title: true, targetMAD: true, currentMAD: true, targetDate: true },
  });

  if (!goal) throw new Error(`Goal ${goalId} not found for user ${userId}`);

  const targetMAD = Number(goal.targetMAD);
  const currentMAD = Number(goal.currentMAD);

  if (currentMAD >= targetMAD) {
    return { reached: true, goalId: goal.id, title: goal.title, targetMAD, currentMAD };
  }

  const remaining = targetMAD - currentMAD;
  const now = new Date();
  const historyStart = new Date(now.getTime() - HISTORY_MS);

  // ── Fetch 6-month transaction history ────────────────────────────────────────

  const [incomeTxs, expenseTxs] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId, deletedAt: null, type: "INCOME", occurredAt: { gte: historyStart } },
      select: { amountMAD: true },
    }),
    prisma.transaction.findMany({
      where: { userId, deletedAt: null, type: "EXPENSE", occurredAt: { gte: historyStart } },
      select: { amountMAD: true, category: { select: { name: true } } },
    }),
  ]);

  const periodMonths = HISTORY_MONTHS;
  const totalIncome = incomeTxs.reduce((s, t) => s + Number(t.amountMAD), 0);
  const totalExpense = expenseTxs.reduce((s, t) => s + Number(t.amountMAD), 0);
  const avgMonthlyIncome = totalIncome / periodMonths;
  const avgMonthlyExpense = totalExpense / periodMonths;
  const avgMonthlySavingCapacity = avgMonthlyIncome - avgMonthlyExpense;

  // ── Top spending categories (for Claude context) ──────────────────────────────

  const byCategory = new Map<string, number>();
  for (const t of expenseTxs) {
    const name = t.category?.name ?? "Autres";
    byCategory.set(name, (byCategory.get(name) ?? 0) + Number(t.amountMAD));
  }
  const recentTopCategories = Array.from(byCategory.entries())
    .map(([name, total]) => ({ name, monthlyMAD: Math.round((total / periodMonths) * 100) / 100 }))
    .sort((a, b) => b.monthlyMAD - a.monthlyMAD)
    .slice(0, 6);

  // ── Deadline & required monthly ──────────────────────────────────────────────

  let monthsUntilDeadline: number | null = null;
  let requiredMonthly: number | null = null;

  if (goal.targetDate) {
    monthsUntilDeadline = diffMonths(now, goal.targetDate);
    requiredMonthly = remaining / monthsUntilDeadline;
  }

  // ── Feasibility signal ────────────────────────────────────────────────────────

  let feasibilityStatus: FeasibilityStatus = "unrealistic";
  if (requiredMonthly !== null && avgMonthlySavingCapacity > 0) {
    if (requiredMonthly <= 0.8 * avgMonthlySavingCapacity) feasibilityStatus = "feasible";
    else if (requiredMonthly <= avgMonthlySavingCapacity) feasibilityStatus = "tight";
  }

  // ── Bonus: Prévisionnel integration ──────────────────────────────────────────

  let baseMonthlyRemaining: number | null = null;
  try {
    const recurringRaw = await prisma.recurringItem.findMany({
      where: { userId, deletedAt: null },
    });
    if (recurringRaw.length > 0) {
      const exceptionalRaw = await prisma.exceptionalCharge.findMany({
        where: { userId, deletedAt: null },
      });
      const projection = computeProjection(
        recurringRaw.map((r) => ({
          id: r.id,
          type: r.type as "REVENUE" | "CHARGE",
          label: r.label,
          amountMAD: Number(r.amountMAD),
          periodicity: r.periodicity as "WEEKLY" | "MONTHLY",
        })),
        exceptionalRaw.map((e) => ({
          id: e.id,
          label: e.label,
          amountMAD: Number(e.amountMAD),
          startMonth: e.startMonth,
          durationMonths: e.durationMonths,
        }))
      );
      baseMonthlyRemaining = projection.baseMonthlyRemaining;
    }
  } catch {
    // Prévisionnel data is optional — silently ignore
  }

  return {
    reached: false,
    goalId: goal.id,
    title: goal.title,
    targetMAD,
    currentMAD,
    remaining,
    targetDate: goal.targetDate?.toISOString().slice(0, 10) ?? null,
    monthsUntilDeadline,
    requiredMonthly,
    avgMonthlySavingCapacity: Math.round(avgMonthlySavingCapacity * 100) / 100,
    avgMonthlyIncome: Math.round(avgMonthlyIncome * 100) / 100,
    avgMonthlyExpense: Math.round(avgMonthlyExpense * 100) / 100,
    feasibilityStatus,
    baseMonthlyRemaining:
      baseMonthlyRemaining !== null
        ? Math.round(baseMonthlyRemaining * 100) / 100
        : null,
    recentTopCategories,
  };
}
