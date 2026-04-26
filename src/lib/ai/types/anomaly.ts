import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const ANOMALY_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export const ANOMALY_DETECTION_METHODS = ["ZSCORE", "AI", "HYBRID"] as const;

// ─── Schemas ─────────────────────────────────────────────────────────────────

export const AiAnomalyJudgmentSchema = z.object({
  isAnomaly: z.boolean(),
  reason: z.string().min(5).max(280),
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
  reason: string | null;
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
