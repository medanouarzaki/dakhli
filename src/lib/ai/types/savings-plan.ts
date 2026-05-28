import { z } from "zod";

// ─── Locale & localized text ──────────────────────────────────────────────────

export const SUPPORTED_LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LocalizedTextSchema = z.object({
  fr: z.string().min(2).max(400),
  en: z.string().min(2).max(400),
  ar: z.string().min(2).max(400),
});

export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

// ─── Feasibility enum ─────────────────────────────────────────────────────────

export const FEASIBILITY_LEVELS = ["EASY", "REALISTIC", "STRETCH", "UNREALISTIC"] as const;
export type Feasibility = (typeof FEASIBILITY_LEVELS)[number];

// ─── Schemas ──────────────────────────────────────────────────────────────────

export const LeverSchema = z.object({
  categoryName: z.string().min(1).max(80),
  currentMonthlyMAD: z.number().nonnegative(),
  suggestedMonthlyMAD: z.number().nonnegative(),
  potentialSavingsMAD: z.number().nonnegative(),
  advice: LocalizedTextSchema,
});

export const SavingsPlanSchema = z.object({
  monthlyTargetMAD: z.number().positive(),
  monthsRemaining: z.number().int().positive(),
  feasibility: z.enum(FEASIBILITY_LEVELS),
  leversByCategory: z.array(LeverSchema).min(0).max(5),
  summary: LocalizedTextSchema,
});

export type Lever = z.infer<typeof LeverSchema>;
export type SavingsPlan = z.infer<typeof SavingsPlanSchema>;

// ─── Generation result ────────────────────────────────────────────────────────

export type GenerationUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  latencyMs: number;
};

export type GenerationResult = {
  plan: SavingsPlan;
  usage: GenerationUsage;
  insightId: string;
  generatedAt: string;
};

// ─── Errors ───────────────────────────────────────────────────────────────────

export type SavingsPlannerErrorCode =
  | "INVALID_INPUT"
  | "API_ERROR"
  | "PARSE_ERROR"
  | "INSUFFICIENT_HISTORY"
  | "GOAL_NOT_FOUND"
  | "GOAL_ALREADY_ACHIEVED"
  | "GOAL_OVERDUE"
  | "EMPTY_RESULT";

export class SavingsPlannerError extends Error {
  constructor(
    public code: SavingsPlannerErrorCode,
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = "SavingsPlannerError";
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function pickLocalizedText(text: LocalizedText, locale: Locale): string {
  return text[locale];
}

export function pickLeverAdvice(lever: Lever, locale: Locale): string {
  return lever.advice[locale];
}
