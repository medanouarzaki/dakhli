import { z } from "zod";

// Keys are intentionally generic i18n-style strings.
// Translations will be wired in a later session.

export const signupSchema = z
  .object({
    name: z.string().min(2, "auth.validation.name_min"),
    email: z.string().email("auth.validation.email_invalid"),
    password: z.string().min(8, "auth.validation.password_min"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "auth.validation.passwords_mismatch",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  email: z.string().email("auth.validation.email_invalid"),
  // min(1) only — length policy is enforced at signup, not login
  password: z.string().min(1, "auth.validation.password_required"),
});

export type SignupFormValues = z.infer<typeof signupSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
