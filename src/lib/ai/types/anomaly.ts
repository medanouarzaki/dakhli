import { z } from "zod";

// ─── Locale ───────────────────────────────────────────────────────────────────

export const SUPPORTED_LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

// ─── Localized reason ─────────────────────────────────────────────────────────

export const LocalizedReasonSchema = z.object({
  fr: z.string().min(5).max(280),
  en: z.string().min(5).max(280),
  ar: z.string().min(5).max(280),
});

export type LocalizedReason = z.infer<typeof LocalizedReasonSchema>;

// ─── Enums ────────────────────────────────────────────────────────────────────

export const ANOMALY_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export const ANOMALY_DETECTION_METHODS = ["ZSCORE", "AI", "HYBRID"] as const;

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const AiAnomalyJudgmentSchema = z.object({
  isAnomaly: z.boolean(),
  reason: LocalizedReasonSchema,
  priority: z.enum(ANOMALY_PRIORITIES),
});

export const AiAnomalyJudgmentBatchSchema = z.object({
  judgments: z.array(AiAnomalyJudgmentSchema),
});

// ─── Inferred types ──────────────────────────────────────────────────────────

export type AiAnomalyJudgment = z.infer<typeof AiAnomalyJudgmentSchema>;

export type AnomalyResult = {
  transactionId: string;
  isAnomaly: boolean;
  reason: LocalizedReason | null;
  priority: "HIGH" | "MEDIUM" | "LOW" | null;
  method: "ZSCORE" | "AI" | "HYBRID";
  zScore: number | null;
};

export type DetectionUsage = {
  totalTransactionsAnalyzed: number;
  anomaliesDetected: number;
  zScoreOnly: number;
  aiCalled: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  latencyMs: number;
};

export type DetectionResult = {
  results: AnomalyResult[];
  usage: DetectionUsage;
};

// ─── Errors ──────────────────────────────────────────────────────────────────

export type AnomalyErrorCode =
  | "INVALID_INPUT"
  | "API_ERROR"
  | "PARSE_ERROR"
  | "INSUFFICIENT_HISTORY"
  | "EMPTY_RESULT";

export class AnomalyError extends Error {
  constructor(
    public code: AnomalyErrorCode,
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = "AnomalyError";
  }
}

// ─── Storage helpers ──────────────────────────────────────────────────────────

export function serializeLocalizedReason(reason: LocalizedReason): string {
  return JSON.stringify(reason);
}

export function pickLocalizedReason(
  stored: string | null | undefined,
  locale: Locale
): string | null {
  if (!stored) return null;

  try {
    const parsed = JSON.parse(stored);
    const validation = LocalizedReasonSchema.safeParse(parsed);
    if (validation.success) {
      return validation.data[locale];
    }
  } catch {
    // not JSON → fall through to legacy handling
  }

  // Legacy single-language plain string — return as-is
  return stored;
}
