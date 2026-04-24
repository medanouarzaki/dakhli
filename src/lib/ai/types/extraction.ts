import { z } from "zod";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const IsoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "ISO date (YYYY-MM-DD) required");

export const ExtractedTransactionSchema = z.object({
  date: IsoDateSchema,
  description: z.string().min(1).max(500),
  amount: z.number().positive().finite(),
  currency: z.enum(["MAD", "EUR", "USD"]).default("MAD"),
  type: z.enum(["EXPENSE", "INCOME"]),
});

export const ExtractionMetadataSchema = z.object({
  bank: z.string().nullable(),
  accountHolder: z.string().nullable(),
  periodStart: IsoDateSchema.nullable(),
  periodEnd: IsoDateSchema.nullable(),
  currency: z.string().default("MAD"),
  openingBalance: z.number().nullable(),
  closingBalance: z.number().nullable(),
});

export const ExtractionResponseSchema = z.object({
  transactions: z.array(ExtractedTransactionSchema),
  metadata: ExtractionMetadataSchema,
});

// ─── Inferred types ───────────────────────────────────────────────────────────

export type ExtractedTransaction = z.infer<typeof ExtractedTransactionSchema>;
export type ExtractionMetadata = z.infer<typeof ExtractionMetadataSchema>;
export type ExtractionResponse = z.infer<typeof ExtractionResponseSchema>;

export type ExtractionUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  latencyMs: number;
};

export type ExtractionResult = ExtractionResponse & {
  usage: ExtractionUsage;
};

// ─── Error class ─────────────────────────────────────────────────────────────

export type PdfExtractionErrorCode =
  | "INVALID_INPUT"
  | "API_ERROR"
  | "PARSE_ERROR"
  | "EMPTY_RESULT"
  | "TIMEOUT";

export class PdfExtractionError extends Error {
  constructor(
    public code: PdfExtractionErrorCode,
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = "PdfExtractionError";
  }
}
