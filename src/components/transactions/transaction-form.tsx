"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";
import type { FinancialAccountType, TransactionType } from "@prisma/client";

import {
  createTransactionSchema,
  type CreateTransactionInput,
} from "@/lib/validations/transaction";
import { CategoryIcon } from "@/lib/categories/icon-map";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ───────────────────────────────────────────────────────────────────

type AccountProp = {
  id: string;
  name: string;
  type: FinancialAccountType;
  currency: string;
};

type CategoryProp = {
  id: string;
  name: string;
  nameEn: string | null;
  nameAr: string | null;
  type: TransactionType;
  icon: string | null;
  color: string | null;
  code: string | null;
};

type Props = {
  accounts: AccountProp[];
  categories: CategoryProp[];
  locale: string;
  mode?: "create" | "edit";
  transactionId?: string;
  initialValues?: {
    type: "INCOME" | "EXPENSE";
    accountId: string;
    categoryId: string | null;
    description: string;
    amount: number;
    occurredAt: string; // YYYY-MM-DD
  };
};

type AiSuggestion = {
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  categoryNameEn: string | null;
  categoryNameAr: string | null;
  confidence: number;
} | null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NONE_VALUE = "__none__";

function getCategoryName(cat: CategoryProp, locale: string): string {
  if (locale === "ar") return cat.nameAr ?? cat.name;
  if (locale === "en") return cat.nameEn ?? cat.name;
  return cat.name;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TransactionForm({
  accounts,
  categories,
  locale,
  mode = "create",
  transactionId,
  initialValues,
}: Props) {
  if (mode === "edit" && (!transactionId || !initialValues)) {
    throw new Error(
      "TransactionForm: mode='edit' requires both transactionId and initialValues."
    );
  }

  const t = useTranslations("Transactions");
  const router = useRouter();

  // Strip "Transactions." prefix from Zod i18n keys before passing to t()
  const translateError = (key: string | undefined): string => {
    if (!key) return "";
    const localKey = key.startsWith("Transactions.")
      ? key.slice("Transactions.".length)
      : key;
    try {
      return t(localKey as Parameters<typeof t>[0]);
    } catch {
      // Defensive: if Zod returned a raw English message that isn't an i18n key,
      // fall back to a generic validation error rather than crashing the form.
      return t("form.error_validation");
    }
  };

  const cashAccount = accounts.find((a) => a.type === "CASH");
  const defaultAccountId = cashAccount?.id ?? accounts[0]?.id ?? "";
  const today = new Date().toISOString().split("T")[0];

  const form = useForm<CreateTransactionInput>({
    resolver: zodResolver(createTransactionSchema),
    defaultValues:
      mode === "edit" && initialValues
        ? {
            type: initialValues.type,
            accountId: initialValues.accountId,
            categoryId: initialValues.categoryId ?? undefined,
            description: initialValues.description,
            amount: initialValues.amount,
            occurredAt: initialValues.occurredAt,
          }
        : {
            type: "EXPENSE",
            accountId: defaultAccountId,
            categoryId: undefined,
            description: "",
            occurredAt: today,
          },
  });

  const { setValue, watch } = form;
  const watchedType = watch("type");
  const isSubmitting = form.formState.isSubmitting;

  // ─── AI suggestion state ─────────────────────────────────────────────────

  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDescriptionRef = useRef<string>("");
  const lastAiCategoryIdRef = useRef<string | null>(null);

  const fetchAiSuggestion = useCallback(
    async (description: string, type: string) => {
      if (description.trim().length < 3 || mode === "edit") return;

      // Don't re-fetch if description hasn't changed
      if (description === lastDescriptionRef.current) return;
      lastDescriptionRef.current = description;

      setAiLoading(true);
      try {
        const res = await fetch("/api/ai/categorize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: description.trim(), type }),
        });

        if (!res.ok) {
          setAiSuggestion(null);
          return;
        }

        const data = (await res.json()) as { suggestion: AiSuggestion };

        if (data.suggestion && data.suggestion.confidence >= 0.5) {
          setAiSuggestion(data.suggestion);

          // Auto-select the category if user hasn't manually chosen a different one.
          // If currentCat matches the previous AI suggestion, the user passively
          // accepted it — so we update to the new suggestion.
          const currentCat = form.getValues("categoryId");
          const isUntouched =
            !currentCat ||
            currentCat === "" ||
            currentCat === "__none__" ||
            currentCat === lastAiCategoryIdRef.current;

          if (isUntouched) {
            form.setValue("categoryId", data.suggestion.categoryId);
          }
          lastAiCategoryIdRef.current = data.suggestion.categoryId;
        } else {
          setAiSuggestion(null);
        }
      } catch {
        setAiSuggestion(null);
      } finally {
        setAiLoading(false);
      }
    },
    [mode, form]
  );

  // ─── Debounce on description field ──────────────────────────────────────

  const watchedDescription = watch("description");

  useEffect(() => {
    // Clear previous debounce
    if (debounceRef.current) clearTimeout(debounceRef.current);

    // Don't trigger AI in edit mode
    if (mode === "edit") return;

    // Don't trigger if description is too short
    if (!watchedDescription || watchedDescription.trim().length < 3) {
      setAiSuggestion(null);
      return;
    }

    // Debounce 500ms
    debounceRef.current = setTimeout(() => {
      fetchAiSuggestion(watchedDescription, watchedType);
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [watchedDescription, watchedType, mode, fetchAiSuggestion]);

  // ─── Reset category + AI suggestion on type change ───────────────────────

  // Skip the very first render so the pre-selected category in edit mode
  // is not wiped immediately on mount.
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setValue("categoryId", undefined);
    setAiSuggestion(null);
    lastDescriptionRef.current = "";
    lastAiCategoryIdRef.current = null;
  }, [watchedType, setValue]);

  const filteredCategories = categories.filter(
    (cat) => (cat.type as string) === watchedType
  );

  // ─── Submit ─────────────────────────────────────────────────────────────

  async function onSubmit(values: CreateTransactionInput) {
    // Convert sentinel "no category" value to null before sending
    const categoryId =
      values.categoryId === NONE_VALUE || values.categoryId == null
        ? null
        : values.categoryId;

    const url =
      mode === "edit"
        ? `/api/transactions/${transactionId}`
        : "/api/transactions";
    const method = mode === "edit" ? "PATCH" : "POST";

    const aiAccepted =
      mode === "create" &&
      aiSuggestion !== null &&
      categoryId === aiSuggestion.categoryId;

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          categoryId,
          aiCategorized: aiAccepted,
          aiConfidence: aiAccepted ? aiSuggestion.confidence : null,
        }),
      });

      if (res.ok) {
        toast.success(
          mode === "edit"
            ? t("form.success_toast_updated")
            : t("form.success_toast")
        );
        router.push(`/${locale}/transactions`);
        router.refresh();
        return;
      }

      const data = (await res.json()) as { error: string };

      if (res.status === 400 && data.error === "validation_error") {
        toast.error(t("form.error_validation"));
        return;
      }

      toast.error(t("form.error_server"));
    } catch {
      toast.error(t("form.error_server"));
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-xl">
          {mode === "edit" ? t("form.title_edit") : t("form.title")}
        </CardTitle>
        <CardDescription>
          {mode === "edit" ? t("form.subtitle_edit") : t("form.subtitle")}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-5"
            noValidate
          >
            {/* ── Type toggle ────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="type"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t("form.type_label")}</FormLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => field.onChange("EXPENSE")}
                      className={cn(
                        "rounded-lg border py-2 text-sm font-medium transition-colors",
                        field.value === "EXPENSE"
                          ? "border-destructive bg-destructive text-destructive-foreground"
                          : "border-input bg-transparent text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {t("form.type_expense")}
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => field.onChange("INCOME")}
                      className={cn(
                        "rounded-lg border py-2 text-sm font-medium transition-colors",
                        field.value === "INCOME"
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-input bg-transparent text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {t("form.type_income")}
                    </button>
                  </div>
                  {fieldState.error?.message && (
                    <p className="text-destructive text-sm">
                      {translateError(fieldState.error.message)}
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* ── Montant ────────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="amount"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t("form.amount_label")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        inputMode="decimal"
                        placeholder={t("form.amount_placeholder")}
                        className="pr-14"
                        disabled={isSubmitting}
                        name={field.name}
                        ref={field.ref}
                        onBlur={field.onBlur}
                        value={
                          (field.value as string | number | undefined) ?? ""
                        }
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

            {/* ── Description ────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t("form.description_label")}</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder={t("form.description_placeholder")}
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

            {/* ── AI suggestion indicator ──────────────────────────── */}
            {mode === "create" && (
              <div className="flex items-center gap-2 text-xs min-h-[20px]">
                {aiLoading && (
                  <>
                    <Sparkles className="size-3.5 animate-pulse text-amber-500" />
                    <span className="text-muted-foreground">{t("form.ai_suggesting")}</span>
                  </>
                )}
                {!aiLoading && aiSuggestion && (
                  <>
                    <Sparkles className="size-3.5 text-amber-500" />
                    <span className="text-muted-foreground">
                      {t("form.ai_suggestion")} :{" "}
                      <span className="font-medium text-foreground">
                        {locale === "ar"
                          ? (aiSuggestion.categoryNameAr ?? aiSuggestion.categoryName)
                          : locale === "en"
                            ? (aiSuggestion.categoryNameEn ?? aiSuggestion.categoryName)
                            : aiSuggestion.categoryName}
                      </span>
                      <span className="ml-1 text-muted-foreground">
                        ({Math.round(aiSuggestion.confidence * 100)}%)
                      </span>
                    </span>
                  </>
                )}
              </div>
            )}

            {/* ── Catégorie ──────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t("form.category_label")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                  >
                    <FormControl>
                      <SelectTrigger
                        className="w-full"
                        disabled={isSubmitting}
                      >
                        <SelectValue
                          placeholder={t("form.category_placeholder")}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {/* "No category" sentinel option */}
                      <SelectItem value={NONE_VALUE}>
                        <span className="text-muted-foreground">
                          {t("form.category_none")}
                        </span>
                      </SelectItem>
                      {filteredCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <span className="flex items-center gap-2">
                            <CategoryIcon
                              name={cat.icon}
                              className="size-4 shrink-0"
                              style={{ color: cat.color ?? undefined }}
                            />
                            <span>{getCategoryName(cat, locale)}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error?.message && (
                    <p className="text-destructive text-sm">
                      {translateError(fieldState.error.message)}
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* ── Compte ─────────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="accountId"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t("form.account_label")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger
                        className="w-full"
                        disabled={isSubmitting}
                      >
                        <SelectValue
                          placeholder={t("form.account_placeholder")}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {accounts.map((acc) => (
                        <SelectItem key={acc.id} value={acc.id}>
                          <span className="flex items-center gap-3">
                            <span>{acc.name}</span>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              {acc.type}
                            </span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error?.message && (
                    <p className="text-destructive text-sm">
                      {translateError(fieldState.error.message)}
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* ── Date ───────────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="occurredAt"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t("form.date_label")}</FormLabel>
                  <FormControl>
                    <Input type="date" disabled={isSubmitting} {...field} />
                  </FormControl>
                  {fieldState.error?.message && (
                    <p className="text-destructive text-sm">
                      {translateError(fieldState.error.message)}
                    </p>
                  )}
                </FormItem>
              )}
            />

            {/* ── Submit ─────────────────────────────────────────────── */}
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {mode === "edit"
                    ? t("form.submitting_edit")
                    : t("form.submitting")}
                </>
              ) : mode === "edit" ? (
                t("form.submit_edit")
              ) : (
                t("form.submit")
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
