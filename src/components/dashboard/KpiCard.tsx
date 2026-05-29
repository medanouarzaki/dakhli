"use client";

import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslations } from "next-intl";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Props = {
  label: string;
  valueMAD: number;
  deltaPct: number | null;
  /** When true: green = good (income growing, net positive). When false: inversed (expense growing = bad). */
  positiveIsGood: boolean;
  locale: string;
  variant?: "currency" | "count";
};

export function KpiCard({ label, valueMAD, deltaPct, positiveIsGood, locale, variant = "currency" }: Props) {
  const t = useTranslations("Dashboard");

  const formattedValue =
    variant === "count"
      ? new Intl.NumberFormat(locale).format(valueMAD)
      : new Intl.NumberFormat(locale, {
          style: "currency",
          currency: "MAD",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }).format(valueMAD);

  let deltaText = "";
  let DeltaIcon: LucideIcon = Minus;
  let colorClass = "text-muted-foreground";

  if (deltaPct !== null) {
    const abs = Math.abs(deltaPct);
    if (abs > 999) {
      // Very large delta: express as multiplier (e.g. 2150% → ×21.5)
      const multiplier = Math.round((abs / 100) * 10) / 10;
      deltaText = `×${multiplier}`;
    } else {
      deltaText = `${deltaPct > 0 ? "+" : ""}${deltaPct.toFixed(1)}%`;
    }

    if (deltaPct > 0) {
      DeltaIcon = ArrowUpRight;
      colorClass = positiveIsGood ? "text-emerald-600" : "text-red-600";
    } else if (deltaPct < 0) {
      DeltaIcon = ArrowDownRight;
      colorClass = positiveIsGood ? "text-red-600" : "text-emerald-600";
    }
    // deltaPct === 0 keeps Minus icon + muted color
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm text-muted-foreground uppercase tracking-wide">
          {label}
        </p>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tabular-nums">{formattedValue}</p>
        {deltaPct !== null && (
          <div className={`mt-1.5 flex items-center gap-1 ${colorClass}`}>
            <DeltaIcon size={14} />
            <span className="text-sm font-medium">{deltaText}</span>
            <span className="ms-1 text-xs text-muted-foreground">
              {t("kpi.vs_previous")}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
