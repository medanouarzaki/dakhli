"use client";

import * as Lucide from "lucide-react";
import { AlertTriangle } from "lucide-react";

type AnomalyDTO = {
  id: string;
  description: string;
  amountMAD: number;
  occurredAt: string;
  reason: string | null;
  categoryName: string;
  categoryColor: string | null;
  categoryIcon: string | null;
};

type Props = {
  anomaly: AnomalyDTO;
  locale: "fr" | "en" | "ar";
};

export function AnomalyCard({ anomaly, locale }: Props) {
  const dateFmt = new Date(anomaly.occurredAt).toLocaleDateString(
    locale === "ar" ? "ar-MA" : locale === "en" ? "en-US" : "fr-FR",
    { day: "numeric", month: "short" }
  );

  const amountFmt = anomaly.amountMAD.toLocaleString(
    locale === "ar" ? "ar-MA" : locale === "en" ? "en-US" : "fr-FR",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 }
  );

  const IconCmp =
    anomaly.categoryIcon &&
    (Lucide as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
      anomaly.categoryIcon
    ];
  const Icon = IconCmp || AlertTriangle;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm">
      <div className="absolute start-0 top-0 h-full w-1 bg-warning" aria-hidden="true" />
      <div className="ps-2 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0">
            <div
              className="rounded-md p-1.5 shrink-0"
              style={{
                backgroundColor: anomaly.categoryColor ? `${anomaly.categoryColor}1a` : undefined,
              }}
            >
              <Icon
                className="h-4 w-4"
                style={{ color: anomaly.categoryColor ?? undefined }}
              />
            </div>
            <div className="min-w-0">
              <h4 className="font-semibold leading-tight truncate">{anomaly.description}</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {dateFmt} · {anomaly.categoryName}
              </p>
            </div>
          </div>
          <span className="shrink-0 text-sm font-semibold text-destructive">
            −{amountFmt} MAD
          </span>
        </div>
        {anomaly.reason && (
          <p className="text-sm text-muted-foreground">{anomaly.reason}</p>
        )}
      </div>
    </div>
  );
}
