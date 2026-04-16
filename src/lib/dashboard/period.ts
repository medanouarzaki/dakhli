// ─── Period utilities for the dashboard ──────────────────────────────────────
// All computations use UTC to avoid timezone drift across server environments.

export type PeriodKey =
  | "this_month"
  | "last_month"
  | "last_3_months"
  | "this_year"
  | "all";

export type PeriodRange = {
  /** Inclusive lower bound, 00:00:00.000 UTC */
  start: Date;
  /** Exclusive upper bound, 00:00:00.000 UTC of the day after the last included day */
  end: Date;
};

// ─── getPeriodRange ───────────────────────────────────────────────────────────

/**
 * Returns the [start, end) date range for the given period key.
 * Pass `now` to override the current time (useful for tests).
 */
export function getPeriodRange(key: PeriodKey, now?: Date): PeriodRange {
  const n = now ?? new Date();
  const y = n.getUTCFullYear();
  const m = n.getUTCMonth(); // 0-based
  const d = n.getUTCDate();

  switch (key) {
    case "this_month":
      return {
        start: new Date(Date.UTC(y, m, 1)),
        end: new Date(Date.UTC(y, m + 1, 1)),
      };

    case "last_month":
      return {
        start: new Date(Date.UTC(y, m - 1, 1)),
        end: new Date(Date.UTC(y, m, 1)),
      };

    case "last_3_months":
      // Rolling 3 months: from exactly 3 months ago (same day) to tomorrow.
      // Covers today's partial month, giving the user the most recent 90-ish days.
      return {
        start: new Date(Date.UTC(y, m - 3, d)),
        end: new Date(Date.UTC(y, m, d + 1)),
      };

    case "this_year":
      return {
        start: new Date(Date.UTC(y, 0, 1)),
        end: new Date(Date.UTC(y + 1, 0, 1)),
      };

    case "all":
      return {
        start: new Date(0), // 1970-01-01T00:00:00Z
        end: new Date(Date.UTC(y, m, d + 1)), // tomorrow 00:00 UTC
      };
  }
}

// ─── getPreviousRange ─────────────────────────────────────────────────────────

/**
 * Returns the previous comparable range for trend calculations.
 * Returns null when no meaningful comparison exists (this_year, all).
 *
 * Examples
 *   this_month (April 2026)  → March 2026
 *   last_month (March 2026)  → February 2026
 *   last_3_months            → the 3 months before that rolling window
 */
export function getPreviousRange(
  key: PeriodKey,
  now?: Date
): PeriodRange | null {
  const n = now ?? new Date();
  const y = n.getUTCFullYear();
  const m = n.getUTCMonth();
  const d = n.getUTCDate();

  switch (key) {
    case "this_month":
      return {
        start: new Date(Date.UTC(y, m - 1, 1)),
        end: new Date(Date.UTC(y, m, 1)),
      };

    case "last_month":
      return {
        start: new Date(Date.UTC(y, m - 2, 1)),
        end: new Date(Date.UTC(y, m - 1, 1)),
      };

    case "last_3_months":
      // Previous rolling 3-month window (immediately before the current one)
      return {
        start: new Date(Date.UTC(y, m - 6, d)),
        end: new Date(Date.UTC(y, m - 3, d)),
      };

    case "this_year":
    case "all":
      return null;
  }
}

// ─── getPeriodI18nKey ─────────────────────────────────────────────────────────

/**
 * Returns the next-intl key for the human-readable period label.
 * Component must call t(getPeriodI18nKey(key)) to render it.
 */
export function getPeriodI18nKey(key: PeriodKey): string {
  return `dashboard.period.${key}`;
}

// ─── parsePeriodParam ─────────────────────────────────────────────────────────

const VALID_PERIOD_KEYS: PeriodKey[] = [
  "this_month",
  "last_month",
  "last_3_months",
  "this_year",
  "all",
];

/**
 * Parses a URL search param value into a PeriodKey.
 * Falls back to "this_month" for any invalid / missing value.
 */
export function parsePeriodParam(
  raw: string | string[] | undefined
): PeriodKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value && (VALID_PERIOD_KEYS as string[]).includes(value)) {
    return value as PeriodKey;
  }
  return "this_month";
}
