import { z } from "zod";

const TITLE_MIN = 2;
const TITLE_MAX = 80;

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Goals.validation.date_format")
  .refine((s) => !Number.isNaN(new Date(s).getTime()), "Goals.validation.date_invalid");

export const createGoalSchema = z.object({
  title: z
    .string()
    .trim()
    .min(TITLE_MIN, "Goals.validation.title_min")
    .max(TITLE_MAX, "Goals.validation.title_max"),
  targetMAD: z.coerce
    .number({ invalid_type_error: "Goals.validation.amount_number" })
    .positive("Goals.validation.amount_positive")
    .max(10_000_000, "Goals.validation.amount_max"),
  targetDate: dateString,
});

export const updateGoalSchema = createGoalSchema.partial();

export const addProgressSchema = z.object({
  amountMAD: z.coerce
    .number({ invalid_type_error: "Goals.validation.amount_number" })
    .positive("Goals.validation.amount_positive")
    .max(10_000_000, "Goals.validation.amount_max"),
});

export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type AddProgressInput = z.infer<typeof addProgressSchema>;
