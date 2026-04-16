import { z } from "zod";

export const createBudgetSchema = z.object({
  categoryId: z.string().min(1, "Budgets.validation.category_required"),
  amountMAD: z.coerce
    .number({
      required_error: "Budgets.validation.amount_positive",
      invalid_type_error: "Budgets.validation.amount_positive",
    })
    .positive("Budgets.validation.amount_positive")
    .max(999_999, "Budgets.validation.amount_too_large"),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;

export const updateBudgetSchema = z.object({
  amountMAD: z.coerce
    .number({
      required_error: "Budgets.validation.amount_positive",
      invalid_type_error: "Budgets.validation.amount_positive",
    })
    .positive("Budgets.validation.amount_positive")
    .max(999_999, "Budgets.validation.amount_too_large"),
});

export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
