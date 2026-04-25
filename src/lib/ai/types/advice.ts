import { z } from "zod";

export const ADVICE_PRIORITIES = ["HIGH", "MEDIUM", "LOW"] as const;
export const ADVICE_KINDS = [
  "SAVING",
  "SPENDING_ALERT",
  "OPPORTUNITY",
  "POSITIVE_REINFORCEMENT",
] as const;

const SafeIcon = z
  .string()
  .min(1)
  .max(40)
  .regex(/^[A-Za-z][A-Za-z0-9]*$/, "Icon must be a Lucide PascalCase name");

export const AdviceItemSchema = z.object({
  title: z.string().min(3).max(80),
  observation: z.string().min(10).max(280),
  recommendation: z.string().min(10).max(400),
  priority: z.enum(ADVICE_PRIORITIES),
  kind: z.enum(ADVICE_KINDS),
  icon: SafeIcon,
});

export const AdviceResponseSchema = z.object({
  generatedAt: z.string(),
  locale: z.enum(["fr", "en", "ar"]),
  items: z.array(AdviceItemSchema).min(1).max(7),
});

export type AdviceItem = z.infer<typeof AdviceItemSchema>;
export type AdviceResponse = z.infer<typeof AdviceResponseSchema>;

export type AdviceErrorCode =
  | "INVALID_INPUT"
  | "API_ERROR"
  | "PARSE_ERROR"
  | "EMPTY_RESULT"
  | "INSUFFICIENT_DATA"
  | "RATE_LIMITED";

export class AdviceError extends Error {
  constructor(
    public code: AdviceErrorCode,
    message: string,
    public cause?: unknown
  ) {
    super(message);
    this.name = "AdviceError";
  }
}
