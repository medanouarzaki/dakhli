// Deterministic 12-month cash-flow projection — zero AI, zero external deps.

export const PROJECTION_MONTHS = 12;

// 52 weeks / 12 months — converts a weekly amount to its monthly equivalent
const WEEKLY_TO_MONTHLY = 52 / 12;

// ─── Input types ─────────────────────────────────────────────────────────────

export type RecurringItemInput = {
  id: string;
  type: "REVENUE" | "CHARGE";
  label: string;
  amountMAD: number;
  periodicity: "WEEKLY" | "MONTHLY";
};

export type ExceptionalChargeInput = {
  id: string;
  label: string;
  amountMAD: number;
  startMonth: Date; // UTC midnight, first day of month
  durationMonths: number;
};

// ─── Output types ─────────────────────────────────────────────────────────────

export type ProjectionMonth = {
  index: number;           // 0 = current month
  monthIso: string;        // "YYYY-MM"
  revenue: number;
  fixedCharges: number;
  exceptionalCharges: number;
  remaining: number;
};

export type ProjectionResult = {
  totalMonthlyRevenue: number;
  totalMonthlyCharge: number;
  baseMonthlyRemaining: number;
  months: ProjectionMonth[];
  minRemaining: number;
  hasNegativeMonth: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthlyEquivalent(amount: number, periodicity: "WEEKLY" | "MONTHLY"): number {
  return periodicity === "WEEKLY" ? amount * WEEKLY_TO_MONTHLY : amount;
}

function startOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
}

function toMonthIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function computeProjection(
  recurring: RecurringItemInput[],
  exceptional: ExceptionalChargeInput[]
): ProjectionResult {
  const revenues = recurring.filter((r) => r.type === "REVENUE");
  const charges = recurring.filter((r) => r.type === "CHARGE");

  const totalMonthlyRevenue = revenues.reduce(
    (sum, r) => sum + monthlyEquivalent(r.amountMAD, r.periodicity),
    0
  );
  const totalMonthlyCharge = charges.reduce(
    (sum, r) => sum + monthlyEquivalent(r.amountMAD, r.periodicity),
    0
  );
  const baseMonthlyRemaining = totalMonthlyRevenue - totalMonthlyCharge;

  const now = new Date();
  const months: ProjectionMonth[] = [];

  for (let m = 0; m < PROJECTION_MONTHS; m++) {
    const monthStart = startOfMonth(addMonths(now, m));

    // Sum exceptional charges active during this month
    let exceptionalTotal = 0;
    for (const charge of exceptional) {
      const chargeStart = startOfMonth(charge.startMonth);
      const chargeEnd = startOfMonth(addMonths(charge.startMonth, charge.durationMonths));
      if (
        monthStart.getTime() >= chargeStart.getTime() &&
        monthStart.getTime() < chargeEnd.getTime()
      ) {
        exceptionalTotal += charge.amountMAD;
      }
    }

    months.push({
      index: m,
      monthIso: toMonthIso(monthStart),
      revenue: totalMonthlyRevenue,
      fixedCharges: totalMonthlyCharge,
      exceptionalCharges: exceptionalTotal,
      remaining: baseMonthlyRemaining - exceptionalTotal,
    });
  }

  const minRemaining = months.length > 0
    ? months.reduce((min, m) => Math.min(min, m.remaining), months[0].remaining)
    : 0;

  return {
    totalMonthlyRevenue,
    totalMonthlyCharge,
    baseMonthlyRemaining,
    months,
    minRemaining,
    hasNegativeMonth: months.some((m) => m.remaining < 0),
  };
}
