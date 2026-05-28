"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { createGoalSchema, type CreateGoalInput } from "@/lib/validations/goal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";

type Props = {
  mode: "create" | "edit";
  initialValues?: {
    title: string;
    targetMAD: number;
    targetDate: string;
  };
  onSubmit: (values: { title: string; targetMAD: number; targetDate: string }) => Promise<void>;
  onCancel: () => void;
};

export function GoalForm({ mode, initialValues, onSubmit, onCancel }: Props) {
  const t = useTranslations("Goals");

  const translateError = (key: string | undefined): string => {
    if (!key) return "";
    const localKey = key.startsWith("Goals.") ? key.slice("Goals.".length) : key;
    try {
      return t(localKey as Parameters<typeof t>[0]);
    } catch {
      return key;
    }
  };

  const today = new Date().toISOString().slice(0, 10);

  const form = useForm<CreateGoalInput>({
    resolver: zodResolver(createGoalSchema),
    defaultValues:
      mode === "edit" && initialValues
        ? {
            title: initialValues.title,
            targetMAD: initialValues.targetMAD,
            targetDate: initialValues.targetDate,
          }
        : {
            title: "",
            targetMAD: undefined,
            targetDate: "",
          },
  });

  const isSubmitting = form.formState.isSubmitting;

  async function handleSubmit(values: CreateGoalInput) {
    await onSubmit(values);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5" noValidate>
        {/* Title */}
        <FormField
          control={form.control}
          name="title"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t("form.title_label")}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t("form.title_placeholder")}
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              {fieldState.error?.message && (
                <p className="text-destructive text-sm">
                  {translateError(fieldState.error.message)}
                </p>
              )}
            </FormItem>
          )}
        />

        {/* Target amount */}
        <FormField
          control={form.control}
          name="targetMAD"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t("form.target_amount_label")}</FormLabel>
              <FormControl>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    inputMode="decimal"
                    placeholder={t("form.target_amount_placeholder")}
                    className="pr-14"
                    disabled={isSubmitting}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={(field.value as string | number | undefined) ?? ""}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 select-none text-sm text-muted-foreground">
                    MAD
                  </span>
                </div>
              </FormControl>
              {fieldState.error?.message && (
                <p className="text-destructive text-sm">
                  {translateError(fieldState.error.message)}
                </p>
              )}
            </FormItem>
          )}
        />

        {/* Target date */}
        <FormField
          control={form.control}
          name="targetDate"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t("form.target_date_label")}</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  min={today}
                  disabled={isSubmitting}
                  {...field}
                />
              </FormControl>
              {fieldState.error?.message && (
                <p className="text-destructive text-sm">
                  {translateError(fieldState.error.message)}
                </p>
              )}
            </FormItem>
          )}
        />

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
            {t("form.cancel")}
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : mode === "edit" ? (
              t("form.submit_edit")
            ) : (
              t("form.submit_create")
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
