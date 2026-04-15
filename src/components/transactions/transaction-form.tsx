"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const NONE_VALUE = "__none__";

function getCategoryName(cat: CategoryProp, locale: string): string {
  if (locale === "ar") return cat.nameAr ?? cat.name;
  if (locale === "en") return cat.nameEn ?? cat.name;
  return cat.name;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function TransactionForm({ accounts, categories, locale }: Props) {
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
    defaultValues: {
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

  // Reset category whenever the transaction type changes
  useEffect(() => {
    setValue("categoryId", undefined);
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

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, categoryId }),
      });

      if (res.ok) {
        toast.success(t("form.success_toast"));
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
        <CardTitle className="text-xl">{t("form.title")}</CardTitle>
        <CardDescription>{t("form.subtitle")}</CardDescription>
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
                  {t("form.submitting")}
                </>
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
