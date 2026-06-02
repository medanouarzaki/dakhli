/**
 * Shared helper: extract an ordered array from various wrapper shapes that
 * Claude models may return depending on output language or phrasing.
 *
 * Extracted from advice.ts so planning/analyze.ts and future modules can
 * reuse without duplication.
 */

export function normalizeItems(parsed: unknown): unknown[] | null {
  // Case A: wrapped object — look for a known array key
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const WRAPPER_KEYS = ["items", "insights", "advice", "recommendations", "tips"] as const;
    for (const key of WRAPPER_KEYS) {
      if (key in obj) {
        const inner = obj[key];
        if (Array.isArray(inner)) return inner;
        if (inner && typeof inner === "object") {
          return objectToOrderedArray(inner as Record<string, unknown>);
        }
        return null;
      }
    }
    // No known wrapper — maybe it's a numeric-keyed object
    return objectToOrderedArray(obj);
  }
  // Case B: already an array
  if (Array.isArray(parsed)) return parsed;
  return null;
}

export function objectToOrderedArray(obj: Record<string, unknown>): unknown[] {
  const entries = Object.entries(obj).filter(([k]) => /^\d+$/.test(k));
  if (entries.length === 0) return [];
  entries.sort(([a], [b]) => Number(a) - Number(b));
  return entries.map(([, v]) => v);
}
