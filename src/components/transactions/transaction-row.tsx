"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { TransactionType } from "@prisma/client";

import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { AmountDisplay } from "./amount-display";
import { AnomalyBadge } from "./AnomalyBadge";

// ─── Types ───────────────────────────────────────────────────────────────────

export type TransactionRowData = {
  id: string;
  type: TransactionType;
  description: string;
  formattedDate: string;
  amount: number;
  currency: string;
  amountMAD: number;
  accountName: string;
  categoryName: string | null;
  categoryColor: string | null;
  isAnomaly: boolean;
  anomalyReason: string | null;
};

type Props = {
  tx: TransactionRowData;
  locale: string;
};

// ─── Component ───────────────────────────────────────────────────────────────

export function TransactionRow({ tx, locale }: Props) {
  const t = useTranslations("Transactions");
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  function handleRowClick() {
    router.push(`/${locale}/transactions/${tx.id}/edit`);
  }

  function handleRowKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleRowClick();
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/transactions/${tx.id}`, {
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
    <TableRow
      className="cursor-pointer transition-colors hover:bg-muted/50"
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={handleRowKeyDown}
      aria-label={t("row_actions.edit_aria")}
    >
      {/* Date */}
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        {tx.formattedDate}
      </TableCell>

      {/* Description */}
      <TableCell className="font-medium">{tx.description}</TableCell>

      {/* Category */}
      <TableCell>
        {tx.categoryName !== null ? (
          <span className="inline-flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: tx.categoryColor ?? "#94a3b8" }}
            />
            <span className="text-sm">{tx.categoryName}</span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {t("category_none")}
          </span>
        )}
      </TableCell>

      {/* Account */}
      <TableCell className="text-sm text-muted-foreground">
        {tx.accountName}
      </TableCell>

      {/* Amount */}
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          {tx.isAnomaly && <AnomalyBadge reason={tx.anomalyReason} />}
          <AmountDisplay
            amount={tx.amount}
            currency={tx.currency}
            amountMAD={tx.amountMAD}
            type={tx.type}
            locale={locale}
          />
        </div>
      </TableCell>

      {/* Actions — stopPropagation so row click doesn't fire when opening dialog */}
      <TableCell
        className="w-10 text-right"
        onClick={(e) => e.stopPropagation()}
      >
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              aria-label={t("row_actions.delete")}
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
      </TableCell>
    </TableRow>
  );
}
