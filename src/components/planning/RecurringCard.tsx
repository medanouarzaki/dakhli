"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Trash2, TrendingUp, TrendingDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMAD } from "@/lib/format/money";

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecurringItemProps = {
  id: string;
  type: "REVENUE" | "CHARGE";
  label: string;
  amountMAD: number;
  periodicity: "WEEKLY" | "MONTHLY";
};

type Props = {
  initialItems: RecurringItemProps[];
  locale: string;
};

// ─── Form schema ──────────────────────────────────────────────────────────────

const WEEKLY_TO_MONTHLY = 52 / 12;

const formSchema = z.object({
  type: z.enum(["REVENUE", "CHARGE"]),
  label: z.string().min(1),
  amountMAD: z.coerce.number().positive(),
  periodicity: z.enum(["WEEKLY", "MONTHLY"]),
});
type FormValues = z.infer<typeof formSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export function RecurringCard({ initialItems, locale }: Props) {
  const t = useTranslations("Planning");
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<RecurringItemProps | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: "CHARGE", label: "", amountMAD: 0, periodicity: "MONTHLY" },
  });

  const revenues = initialItems.filter((i) => i.type === "REVENUE");
  const charges = initialItems.filter((i) => i.type === "CHARGE");

  function monthlyEquiv(item: RecurringItemProps): number {
    return item.periodicity === "WEEKLY" ? item.amountMAD * WEEKLY_TO_MONTHLY : item.amountMAD;
  }

  async function onSubmit(values: FormValues) {
    setAdding(true);
    try {
      const res = await fetch("/api/planning/recurring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("server_error");
      toast.success(t("recurring.add_success"));
      form.reset();
      router.refresh();
    } catch {
      toast.error(t("recurring.error"));
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(item: RecurringItemProps) {
    setDeletingId(item.id);
    setConfirmItem(null);
    try {
      const res = await fetch(`/api/planning/recurring/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("server_error");
      toast.success(t("recurring.delete_success"));
      router.refresh();
    } catch {
      toast.error(t("recurring.error"));
    } finally {
      setDeletingId(null);
    }
  }

  function ItemRow({ item }: { item: RecurringItemProps }) {
    const equiv = monthlyEquiv(item);
    const isWeekly = item.periodicity === "WEEKLY";
    return (
      <div className="flex items-center justify-between py-2 border-b last:border-0">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{item.label}</p>
          <p className="text-xs text-muted-foreground">
            {formatMAD(item.amountMAD, locale)}{" "}
            {isWeekly
              ? `(${t("recurring.periodicity_weekly_short")}) ≈ ${formatMAD(equiv, locale)}/${t("recurring.month_abbr")}`
              : `/ ${t("recurring.month_abbr")}`}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ms-2 text-muted-foreground hover:text-destructive"
          onClick={() => setConfirmItem(item)}
          disabled={deletingId === item.id}
        >
          {deletingId === item.id ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </Button>
      </div>
    );
  }

  return (
    <>
      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>{t("recurring.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Add form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("recurring.label_label")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("recurring.label_placeholder")} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amountMAD"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("recurring.amount_label")}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} step="0.01" placeholder="0" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("recurring.type_label")}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="REVENUE">{t("recurring.type_revenue")}</SelectItem>
                          <SelectItem value="CHARGE">{t("recurring.type_charge")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="periodicity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("recurring.periodicity_label")}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="MONTHLY">{t("recurring.periodicity_monthly")}</SelectItem>
                          <SelectItem value="WEEKLY">{t("recurring.periodicity_weekly")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={adding} className="w-full sm:w-auto">
                {adding && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("recurring.add_btn")}
              </Button>
            </form>
          </Form>

          {/* Revenue list */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-success mb-2">
              <TrendingUp className="h-4 w-4" />
              {t("recurring.revenues_title")}
            </h3>
            {revenues.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("recurring.empty")}</p>
            ) : (
              revenues.map((item) => <ItemRow key={item.id} item={item} />)
            )}
          </div>

          {/* Charge list */}
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-destructive mb-2">
              <TrendingDown className="h-4 w-4" />
              {t("recurring.charges_title")}
            </h3>
            {charges.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("recurring.empty")}</p>
            ) : (
              charges.map((item) => <ItemRow key={item.id} item={item} />)
            )}
          </div>
        </CardContent>
      </Card>

      {/* Delete confirmation */}
      <Dialog open={!!confirmItem} onOpenChange={(open) => { if (!open) setConfirmItem(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("recurring.delete_confirm_title")}</DialogTitle>
            <DialogDescription>
              {confirmItem ? `"${confirmItem.label}"` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmItem(null)}>
              {t("recurring.delete_cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmItem && handleDelete(confirmItem)}
            >
              {t("recurring.delete_ok")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
