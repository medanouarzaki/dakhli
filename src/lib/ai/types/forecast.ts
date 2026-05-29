import { z } from "zod";

export const SUPPORTED_LOCALES = ["fr", "en", "ar"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const LocalizedTextSchema = z.object({
  fr: z.string().min(2).max(240),
  en: z.string().min(2).max(240),
  ar: z.string().min(2).max(240),
});

export type LocalizedText = z.infer<typeof LocalizedTextSchema>;

export const TREND_LEVELS = ["STABLE", "UP", "DOWN", "SEASONAL_UP", "SEASONAL_DOWN"] as const;
export type Trend = (typeof TREND_LEVELS)[number];

export const CategoryForecastSchema = z.object({
  categoryName: z.string().min(1).max(80),
  predictedMAD: z.number().nonnegative(),
  lastMonthMAD: z.number().nonnegative(),
  averageMAD: z.number().nonnegative(),
  trend: z.enum(TREND_LEVELS),
  explanation: LocalizedTextSchema,
});

export const RecurringCommitmentSchema = z.object({
  categoryName: z.string().min(1).max(80),
  amountMAD: z.number().positive(),
  label: LocalizedTextSchema,
});

export const ForecastSchema = z.object({
  forecastMonth: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM format"),
  totalForecastMAD: z.number().nonnegative(),
  totalLastMonthMAD: z.number().nonnegative(),
  byCategoryForecasts: z.array(CategoryForecastSchema).min(1).max(7),
  recurringCommitments: z.array(RecurringCommitmentSchema).max(8),
  seasonalContext: LocalizedTextSchema.nullable(),
  summary: LocalizedTextSchema,
});

export type CategoryForecast = z.infer<typeof CategoryForecastSchema>;
export type RecurringCommitment = z.infer<typeof RecurringCommitmentSchema>;
export type Forecast = z.infer<typeof ForecastSchema>;

export type GenerationUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  latencyMs: number;
};

export type GenerationResult = {
  forecast: Forecast;
  usage: GenerationUsage;
  insightId: string;
  generatedAt: string;
};

export type ForecasterErrorCode =
  | "INVALID_INPUT"
  | "API_ERROR"
  | "PARSE_ERROR"
  | "INSUFFICIENT_HISTORY"
  | "EMPTY_RESULT";

export class ForecasterError extends Error {
  constructor(
    public code: ForecasterErrorCode,
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = "ForecasterError";
  }
}

export function pickLocalizedText(text: LocalizedText, locale: Locale): string {
  return text[locale];
}

export function pickCategoryExplanation(cf: CategoryForecast, locale: Locale): string {
  return cf.explanation[locale];
}

export function pickCommitmentLabel(rc: RecurringCommitment, locale: Locale): string {
  return rc.label[locale];
}
