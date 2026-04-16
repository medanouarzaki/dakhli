import { z } from "zod";

export const createTransactionSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE"], {
    required_error: "Transactions.validation.type_required",
    invalid_type_error: "Transactions.validation.type_required",
  }),
  accountId: z.string().min(1, "Transactions.validation.account_required"),
  categoryId: z.string().optional().nullable(),
  description: z
    .string()
    .min(2, "Transactions.validation.description_min")
    .max(120, "Transactions.validation.description_max"),
  amount: z.coerce
    .number({
      required_error: "Transactions.validation.amount_positive",
      invalid_type_error: "Transactions.validation.amount_positive",
    })
    .positive("Transactions.validation.amount_positive")
    .max(99_999_999.99, "Transactions.validation.amount_too_large"),
  occurredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Transactions.validation.date_required"),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = createTransactionSchema;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
