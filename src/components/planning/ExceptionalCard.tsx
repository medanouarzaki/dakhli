"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Trash2, CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
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

export type ExceptionalChargeProps = {
  id: string;
  label: string;
  amountMAD: number;
  startMonth: string; // "YYYY-MM"
  durationMonths: number;
};

type Props = {
  initialItems: ExceptionalChargeProps[];
  locale: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function endMonthIso(startMonth: string, durationMonths: number): string {
  const [y, m] = startMonth.split("-").map(Number);
  const end = new Date(Date.UTC(y, m - 1 + durationMonths - 1, 1));
  return `${end.getUTCFullYear()}-${String(end.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonthLabel(monthIso: string, locale: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1))
  );
}

// ─── Form schema ──────────────────────────────────────────────────────────────

const formSchema = z.object({
  label: z.string().min(1),
  amountMAD: z.coerce.number().positive(),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/, "YYYY-MM"),
  durationMonths: z.coerce.number().int().min(1).max(120),
});
type FormValues = z.infer<typeof formSchema>;

// ─── Component ────────────────────────────────────────────────────────────────

export function ExceptionalCard({ initialItems, locale }: Props) {
  const t = useTranslations("Planning");
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmItem, setConfirmItem] = useState<ExceptionalChargeProps | null>(null);

  const todayYM = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`;
  })();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { label: "", amountMAD: 0, startMonth: todayYM, durationMonths: 1 },
  });

  async function onSubmit(values: FormValues) {
    setAdding(true);
    try {
      const res = await fetch("/api/planning/exceptional", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) throw new Error("server_error");
      toast.success(t("exceptional.add_success"));
      form.reset({ label: "", amountMAD: 0, startMonth: todayYM, durationMonths: 1 });
      router.refresh();
    } catch {
      toast.error(t("exceptional.error"));
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(item: ExceptionalChargeProps) {
    setDeletingId(item.id);
    setConfirmItem(null);
    try {
      const res = await fetch(`/api/planning/exceptional/${item.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("server_error");
      toast.success(t("exceptional.delete_success"));
      router.refresh();
    } catch {
      toast.error(t("exceptional.error"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <>
      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>{t("exceptional.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Form */}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("exceptional.label_label")}</FormLabel>
                      <FormControl>
                        <Input placeholder={t("exceptional.label_placeholder")} {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="amountMAD"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("exceptional.amount_label")}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} step="0.01" placeholder="0" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="startMonth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("exceptional.start_month_label")}</FormLabel>
                      <FormControl>
                        <Input type="month" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="durationMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("exceptional.duration_label")}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={120} step={1} placeholder="1" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit" disabled={adding} className="w-full sm:w-auto">
                {adding && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
                {t("exceptional.add_btn")}
              </Button>
            </form>
          </Form>

          {/* List */}
          {initialItems.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border bg-muted/30 px-4 py-8 text-center">
              <div className="mb-3 rounded-full bg-primary/10 p-3">
                <CalendarRange className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">{t("exceptional.empty")}</p>
            </div>
          ) : (
            <div className="space-y-1">
              {initialItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatMAD(item.amountMAD, locale)}/{t("exceptional.month_abbr")} ·{" "}
                      {item.durationMonths === 1
                        ? formatMonthLabel(item.startMonth, locale)
                        : `${formatMonthLabel(item.startMonth, locale)} → ${formatMonthLabel(endMonthIso(item.startMonth, item.durationMonths), locale)}`}
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
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!confirmItem} onOpenChange={(open) => { if (!open) setConfirmItem(null); }}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("exceptional.delete_confirm_title")}</DialogTitle>
            <DialogDescription>
              {confirmItem ? `"${confirmItem.label}"` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmItem(null)}>
              {t("exceptional.delete_cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmItem && handleDelete(confirmItem)}
            >
              {t("exceptional.delete_ok")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
