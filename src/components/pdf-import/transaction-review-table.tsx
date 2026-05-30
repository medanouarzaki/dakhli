"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RawTransaction = {
  date: string;
  description: string;
  amount: number;
  currency: "MAD" | "EUR" | "USD";
  type: "EXPENSE" | "INCOME";
};

type Metadata = {
  bank: string | null;
  accountHolder: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  currency: string;
  openingBalance: number | null;
  closingBalance: number | null;
};

type Row = RawTransaction & { checked: boolean; editing: keyof RawTransaction | null };

type Props = {
  transactions: RawTransaction[];
  metadata: Metadata;
  accounts: Array<{ id: string; name: string; currency: string }>;
  onReset: () => void;
  locale: "fr" | "en" | "ar";
};

function fmt(n: number) {
  return n.toLocaleString("fr-MA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function TransactionReviewTable({ transactions, metadata, accounts, onReset, locale }: Props) {
  const t = useTranslations("ImportPdf");
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>(() =>
    transactions.map((tx) => ({ ...tx, checked: true, editing: null }))
  );
  const [selectedAccountId, setSelectedAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [editValue, setEditValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [duplicatesDialog, setDuplicatesDialog] = useState<{
    open: boolean;
    duplicates: Array<{ candidate: RawTransaction; existingOccurredAt: string }>;
    uniqueCount: number;
  }>({ open: false, duplicates: [], uniqueCount: 0 });

  type ImportPayload = {
    transactions: RawTransaction[];
    confirmDuplicates: boolean;
  };

  async function handleImport(payload: ImportPayload) {
    if (payload.transactions.length === 0) return;

    setIsLoading(true);
    try {
      const res = await fetch("/api/transactions/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccountId,
          filename: "bank_statement.pdf",
          confirmDuplicates: payload.confirmDuplicates,
          transactions: payload.transactions.map((r) => ({
            date: r.date,
            description: r.description,
            amount: r.amount,
            currency: r.currency,
            type: r.type,
          })),
        }),
        credentials: "include",
      });

      if (res.status === 409) {
        const data = await res.json();
        setDuplicatesDialog({
          open: true,
          duplicates: (data.duplicates as Array<{ candidate: RawTransaction; existingOccurredAt: string }>).map((d) => ({
            candidate: d.candidate,
            existingOccurredAt: d.existingOccurredAt,
          })),
          uniqueCount: data.uniqueCount as number,
        });
        return;
      }

      if (!res.ok) {
        toast.error(t("import.error"));
        return;
      }

      const data = await res.json();
      toast.success(
        t("import.success", {
          count: data.createdCount as number,
          categorized: data.categorizedCount as number,
        })
      );
      router.push(`/${locale}/transactions`);
    } finally {
      setIsLoading(false);
    }
  }

  function getUniquesFromDialog(): RawTransaction[] {
    const dupKeys = new Set(
      duplicatesDialog.duplicates.map(
        (d) => `${d.candidate.date}|${d.candidate.description.trim().toLowerCase()}|${d.candidate.amount.toFixed(2)}`
      )
    );
    return rows
      .filter((r) => r.checked)
      .filter((r) => !dupKeys.has(`${r.date}|${r.description.trim().toLowerCase()}|${r.amount.toFixed(2)}`));
  }

  const checked = rows.filter((r) => r.checked);
  const totalExpenses = checked
    .filter((r) => r.type === "EXPENSE")
    .reduce((s, r) => s + r.amount, 0);
  const totalIncome = checked
    .filter((r) => r.type === "INCOME")
    .reduce((s, r) => s + r.amount, 0);

  function toggleRow(i: number) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, checked: !r.checked } : r)));
  }

  function toggleAll() {
    const allChecked = rows.every((r) => r.checked);
    setRows((prev) => prev.map((r) => ({ ...r, checked: !allChecked })));
  }

  function startEdit(i: number, field: keyof RawTransaction) {
    const row = rows[i];
    setEditValue(String(row[field]));
    setRows((prev) => prev.map((r, idx) => ({ ...r, editing: idx === i ? field : null })));
  }

  function commitEdit(i: number, field: keyof RawTransaction) {
    setRows((prev) =>
      prev.map((r, idx) => {
        if (idx !== i) return r;
        const updated = { ...r, editing: null };
        if (field === "amount") {
          const parsed = parseFloat(editValue.replace(",", "."));
          updated.amount = isNaN(parsed) ? r.amount : Math.abs(parsed);
        } else if (field === "description") {
          updated.description = editValue.trim() || r.description;
        } else if (field === "date") {
          updated.date = editValue.trim() || r.date;
        }
        return updated;
      })
    );
  }

  function cancelEdit(i: number) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, editing: null } : r)));
  }

  const allChecked = rows.length > 0 && rows.every((r) => r.checked);
  const someChecked = rows.some((r) => r.checked);

  return (
    <div className="space-y-4">
      {/* Metadata card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("review.metadata_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-3 text-sm">
            <div>
              <dt className="text-muted-foreground">{t("review.bank")}</dt>
              <dd className="font-medium">{metadata.bank ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("review.account_holder")}</dt>
              <dd className="font-medium">{metadata.accountHolder ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">{t("review.period")}</dt>
              <dd className="font-medium">
                {metadata.periodStart && metadata.periodEnd
                  ? `${metadata.periodStart} → ${metadata.periodEnd}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Account selector + summary */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="target-account">{t("review.target_account")}</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger id="target-account" className="w-full sm:w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
              <p className="text-muted-foreground">{t("review.selected_count", { count: checked.length })}</p>
            </div>
            <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
              <p className="text-muted-foreground">{t("review.total_expenses")}</p>
              <p className="font-semibold text-destructive">{fmt(totalExpenses)} MAD</p>
            </div>
            <div className="rounded-md border bg-muted/40 px-4 py-3 text-sm">
              <p className="text-muted-foreground">{t("review.total_income")}</p>
              <p className="font-semibold text-success">{fmt(totalIncome)} MAD</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Review table */}
      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={toggleAll}
                    aria-label="Tout sélectionner"
                  />
                </TableHead>
                <TableHead className="min-w-[110px]">{t("review.table.date")}</TableHead>
                <TableHead className="min-w-[200px]">{t("review.table.description")}</TableHead>
                <TableHead className="min-w-[110px] text-end">{t("review.table.amount")}</TableHead>
                <TableHead>{t("review.table.type")}</TableHead>
                <TableHead>{t("review.table.currency")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow key={i} data-state={row.checked ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={row.checked}
                      onCheckedChange={() => toggleRow(i)}
                      aria-label={`Sélectionner ligne ${i + 1}`}
                    />
                  </TableCell>

                  {/* Date */}
                  <TableCell>
                    {row.editing === "date" ? (
                      <Input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(i, "date")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit(i, "date");
                          if (e.key === "Escape") cancelEdit(i);
                        }}
                        className="h-7 w-32 text-xs"
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:underline text-sm"
                        onClick={() => startEdit(i, "date")}
                      >
                        {row.date}
                      </span>
                    )}
                  </TableCell>

                  {/* Description */}
                  <TableCell>
                    {row.editing === "description" ? (
                      <Input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(i, "description")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit(i, "description");
                          if (e.key === "Escape") cancelEdit(i);
                        }}
                        className="h-7 text-xs"
                      />
                    ) : (
                      <span
                        className="cursor-pointer hover:underline text-sm"
                        onClick={() => startEdit(i, "description")}
                      >
                        {row.description}
                      </span>
                    )}
                  </TableCell>

                  {/* Amount */}
                  <TableCell className="text-end">
                    {row.editing === "amount" ? (
                      <Input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => commitEdit(i, "amount")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit(i, "amount");
                          if (e.key === "Escape") cancelEdit(i);
                        }}
                        className="h-7 w-28 text-end text-xs"
                      />
                    ) : (
                      <span
                        className={[
                          "cursor-pointer hover:underline text-sm font-medium",
                          row.type === "EXPENSE" ? "text-destructive" : "text-success",
                        ].join(" ")}
                        onClick={() => startEdit(i, "amount")}
                      >
                        {row.type === "EXPENSE" ? "−" : "+"}{fmt(row.amount)}
                      </span>
                    )}
                  </TableCell>

                  {/* Type */}
                  <TableCell>
                    <span className={[
                      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                      row.type === "EXPENSE"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-success/10 text-success",
                    ].join(" ")}>
                      {row.type === "EXPENSE"
                        ? t("review.table.type_expense")
                        : t("review.table.type_income")}
                    </span>
                  </TableCell>

                  {/* Currency */}
                  <TableCell className="text-sm text-muted-foreground">
                    {row.currency}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Footer actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="outline" onClick={onReset}>
          {t("review.cancel_button")}
        </Button>

        <Button
          disabled={!someChecked || isLoading}
          onClick={() => handleImport({ transactions: rows.filter((r) => r.checked), confirmDuplicates: false })}
        >
          {isLoading
            ? t("review.import_pending")
            : t("review.import_button", { count: checked.length })}
        </Button>
      </div>

      <Dialog
        open={duplicatesDialog.open}
        onOpenChange={(open) => setDuplicatesDialog((prev) => ({ ...prev, open }))}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("duplicates.title")}</DialogTitle>
            <DialogDescription>
              {t("duplicates.description", {
                dupCount: duplicatesDialog.duplicates.length,
                uniqueCount: duplicatesDialog.uniqueCount,
              })}
            </DialogDescription>
          </DialogHeader>

          <ul className="max-h-60 overflow-y-auto space-y-1 text-sm border rounded-md p-3 bg-muted/30">
            {duplicatesDialog.duplicates.map((d, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="truncate">
                  {d.candidate.date} · {d.candidate.description}
                </span>
                <span className="text-muted-foreground shrink-0">
                  {d.candidate.amount.toFixed(2)} {d.candidate.currency}
                </span>
              </li>
            ))}
          </ul>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDuplicatesDialog((prev) => ({ ...prev, open: false }))}
            >
              {t("duplicates.cancel")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const uniques = getUniquesFromDialog();
                setDuplicatesDialog((prev) => ({ ...prev, open: false }));
                if (uniques.length === 0) {
                  toast.info(t("import.no_new_transactions"));
                  return;
                }
                handleImport({ transactions: uniques, confirmDuplicates: true });
              }}
            >
              {t("duplicates.skip_duplicates")}
            </Button>
            <Button
              onClick={() => {
                const selected = rows.filter((r) => r.checked);
                setDuplicatesDialog((prev) => ({ ...prev, open: false }));
                handleImport({ transactions: selected, confirmDuplicates: true });
              }}
            >
              {t("duplicates.import_anyway")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
