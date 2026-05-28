"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

import { addProgressSchema } from "@/lib/validations/goal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { GoalDTO } from "./GoalsClient";

type Props = {
  goal: GoalDTO;
  locale: string;
  onSubmit: (amountMAD: number) => Promise<void>;
  onClose: () => void;
};

export function AddProgressDialog({ goal, locale, onSubmit, onClose }: Props) {
  const t = useTranslations("Goals");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatAmount = (v: number) =>
    new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = addProgressSchema.safeParse({ amountMAD: value });
    if (!parsed.success) {
      const key = parsed.error.issues[0]?.message ?? "Goals.validation.amount_number";
      const localKey = key.startsWith("Goals.") ? key.slice("Goals.".length) : key;
      try {
        setError(t(localKey as Parameters<typeof t>[0]));
      } catch {
        setError(key);
      }
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(parsed.data.amountMAD);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{t("progress_dialog.title")}</DialogTitle>
          <DialogDescription>
            {t("progress_dialog.subtitle_fmt", {
              title: goal.title,
              current: formatAmount(goal.currentMAD),
              target: formatAmount(goal.targetMAD),
            })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              {t("progress_dialog.amount_label")}
            </label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                value={value}
                onChange={(e) => { setValue(e.target.value); setError(null); }}
                className="pr-14"
                disabled={isSubmitting}
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 select-none text-sm text-muted-foreground">
                MAD
              </span>
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t("progress_dialog.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : t("progress_dialog.submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
