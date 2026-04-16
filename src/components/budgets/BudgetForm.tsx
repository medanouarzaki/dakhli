"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import {
  createBudgetSchema,
  type CreateBudgetInput,
} from "@/lib/validations/budget";
import { CategoryIcon } from "@/lib/categories/icon-map";

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

type CategoryOption = {
  id: string;
  name: string;
  nameEn: string | null;
  nameAr: string | null;
  icon: string | null;
  color: string | null;
};

type Props = {
  categories: CategoryOption[];
  locale: string;
  mode?: "create" | "edit";
  budgetId?: string;
  initialValues?: {
    categoryId: string;
    amountMAD: number;
  };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCatName(cat: CategoryOption, locale: string): string {
  if (locale === "ar") return cat.nameAr ?? cat.name;
  if (locale === "en") return cat.nameEn ?? cat.name;
  return cat.name;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BudgetForm({
  categories,
  locale,
  mode = "create",
  budgetId,
  initialValues,
}: Props) {
  const t = useTranslations("Budgets");
  const router = useRouter();

  // Strip "Budgets." prefix from Zod i18n keys before passing to t()
  const translateError = (key: string | undefined): string => {
    if (!key) return "";
    const localKey = key.startsWith("Budgets.")
      ? key.slice("Budgets.".length)
      : key;
    try {
      return t(localKey as Parameters<typeof t>[0]);
    } catch {
      return t("form.error_validation");
    }
  };

  const form = useForm<CreateBudgetInput>({
    resolver: zodResolver(createBudgetSchema),
    defaultValues:
      mode === "edit" && initialValues
        ? {
            categoryId: initialValues.categoryId,
            amountMAD: initialValues.amountMAD,
          }
        : {
            categoryId: "",
            amountMAD: undefined,
          },
  });

  const isSubmitting = form.formState.isSubmitting;

  // ─── Submit ─────────────────────────────────────────────────────────────

  async function onSubmit(values: CreateBudgetInput) {
    const url =
      mode === "edit" ? `/api/budgets/${budgetId}` : "/api/budgets";
    const method = mode === "edit" ? "PATCH" : "POST";
    const body =
      mode === "edit"
        ? { amountMAD: values.amountMAD }
        : { categoryId: values.categoryId, amountMAD: values.amountMAD };

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        toast.success(
          mode === "edit"
            ? t("form.success_toast_updated")
            : t("form.success_toast")
        );
        router.push(`/${locale}/budgets`);
        router.refresh();
        return;
      }

      const data = (await res.json()) as { error: string };

      if (res.status === 409 && data.error === "budget_already_exists") {
        toast.error(t("form.error_already_exists"));
        return;
      }

      if (res.status === 400 && data.error === "validation_error") {
        toast.error(t("form.error_validation"));
        return;
      }

      toast.error(t("form.error_server"));
    } catch {
      toast.error(t("form.error_server"));
    }
  }

  // ─── Empty state ────────────────────────────────────────────────────────

  if (mode === "create" && categories.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            {t("form.no_categories_left")}
          </p>
        </CardContent>
      </Card>
    );
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
            {/* ── Catégorie ──────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="categoryId"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t("form.category_label")}</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={mode === "edit" || isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue
                          placeholder={t("form.category_placeholder")}
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          <span className="flex items-center gap-2">
                            <CategoryIcon
                              name={cat.icon}
                              className="size-4 shrink-0"
                              style={{ color: cat.color ?? undefined }}
                            />
                            <span>{getCatName(cat, locale)}</span>
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

            {/* ── Montant ────────────────────────────────────────────── */}
            <FormField
              control={form.control}
              name="amountMAD"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t("form.amount_label")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        step="1"
                        min="1"
                        inputMode="numeric"
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
