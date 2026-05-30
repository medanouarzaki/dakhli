"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

import type { BudgetUsageRow } from "@/lib/budgets/usage";
import { CategoryIcon } from "@/lib/categories/icon-map";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  budget: BudgetUsageRow;
  locale: string;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function BudgetRow({ budget, locale }: Props) {
  const t = useTranslations("Budgets");
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const formatNum = (v: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(v);

  const barColor =
    budget.status === "exceeded"
      ? "bg-destructive"
      : budget.status === "warning"
        ? "bg-warning"
        : "bg-success";

  const barWidth = Math.min(budget.percent, 100);

  const remaining = budget.amountMAD - budget.consumedMAD;
  const exceededBy = budget.consumedMAD - budget.amountMAD;

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/budgets/${budget.budgetId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success(t("delete_dialog.success_toast"));
        setDialogOpen(false);
        router.refresh();
        return;
      }

      toast.error(t("delete_dialog.error_toast"));
    } catch {
      toast.error(t("delete_dialog.error_toast"));
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          {/* Category identity */}
          <div className="flex items-center gap-2 min-w-0">
            <CategoryIcon
              name={budget.categoryIcon}
              className="size-5 shrink-0"
              style={{ color: budget.categoryColor ?? undefined }}
            />
            <span className="font-medium truncate">{budget.categoryName}</span>
          </div>

          {/* Limit + actions */}
          <div className="flex items-center gap-1 shrink-0">
            <span className="text-sm text-muted-foreground tabular-nums mr-2">
              {formatNum(budget.amountMAD)}&nbsp;MAD&nbsp;
              <span className="text-xs">{t("card.per_month")}</span>
            </span>

            {/* Edit */}
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() =>
                router.push(`/${locale}/budgets/${budget.budgetId}/edit`)
              }
            >
              <Pencil className="size-4" />
            </Button>

            {/* Delete */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </DialogTrigger>
              <DialogContent showCloseButton={false}>
                <DialogHeader>
                  <DialogTitle>{t("delete_dialog.title")}</DialogTitle>
                  <DialogDescription>
                    {t("delete_dialog.description")}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                    disabled={isDeleting}
                  >
                    {t("delete_dialog.cancel")}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isDeleting}
                  >
                    {isDeleting
                      ? t("delete_dialog.deleting")
                      : t("delete_dialog.confirm")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>

        {/* Labels under bar */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {t("card.consumed", { consumed: formatNum(budget.consumedMAD) })}
          </span>
          {budget.status === "exceeded" ? (
            <span className="font-medium text-destructive">
              {t("card.exceeded_by", { amount: formatNum(exceededBy) })}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t("card.remaining", { remaining: formatNum(remaining) })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
