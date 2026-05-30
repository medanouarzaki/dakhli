"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/lib/ai/types/anomaly";

import { AnomalyCard } from "./AnomalyCard";
import { AnomaliesEmptyState } from "./AnomaliesEmptyState";

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

type GetResponseAnomaly = {
  id: string;
  description: string;
  amountMAD: number;
  occurredAt: string;
  reasonByLocale: { fr: string | null; en: string | null; ar: string | null };
  categoryName: string | null;
  categoryNameEn: string | null;
  categoryNameAr: string | null;
  categoryColor: string | null;
  categoryIcon: string | null;
};

type Labels = {
  sectionTitle: string;
  sectionSubtitle: string;
  analyzeButton: string;
  analyzingLabel: string;
  viewAllLink: string;
  emptyTitle: string;
  emptySubtitle: string;
  lastScanLabel: string;
  errorGeneric: string;
  errorInsufficient: string;
};

type Props = {
  locale: Locale;
  initialAnomalies: AnomalyDTO[];
  initialLastScanAt: string | null;
  labels: Labels;
};

export function AnomaliesClient({
  locale,
  initialAnomalies,
  initialLastScanAt,
  labels,
}: Props) {
  const t = useTranslations("Anomalies");
  const [anomalies, setAnomalies] = useState<AnomalyDTO[]>(initialAnomalies);
  const [lastScanAt, setLastScanAt] = useState<string | null>(initialLastScanAt);
  const [isLoading, setIsLoading] = useState(false);

  async function runScan() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/detect-anomalies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
        credentials: "include",
      });

      if (res.status === 422) {
        toast.error(labels.errorInsufficient);
        return;
      }
      if (!res.ok) {
        toast.error(labels.errorGeneric);
        return;
      }

      const data = await res.json();
      const detected: number = data.usage?.anomaliesDetected ?? 0;
      const total: number = data.usage?.totalTransactionsAnalyzed ?? 0;

      // Re-fetch the rendered top 5
      const getRes = await fetch("/api/ai/detect-anomalies", {
        method: "GET",
        credentials: "include",
      });
      if (getRes.ok) {
        const refreshed = await getRes.json();
        const items: GetResponseAnomaly[] = refreshed.anomalies ?? [];
        setAnomalies(
          items.map((a) => ({
            id: a.id,
            description: a.description,
            amountMAD: a.amountMAD,
            occurredAt: a.occurredAt,
            reason: a.reasonByLocale?.[locale] ?? null,
            categoryName: pickCategoryName(a, locale),
            categoryColor: a.categoryColor,
            categoryIcon: a.categoryIcon,
          }))
        );
        setLastScanAt(refreshed.lastScanAt ?? new Date().toISOString());
      }

      toast.success(t("success_fmt", { count: detected, total }));
    } catch {
      toast.error(labels.errorGeneric);
    } finally {
      setIsLoading(false);
    }
  }

  const lastScanLabel = (() => {
    if (!lastScanAt) return null;
    const d = new Date(lastScanAt);
    return d.toLocaleDateString(
      locale === "ar" ? "ar-MA" : locale === "en" ? "en-US" : "fr-FR",
      { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }
    );
  })();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              {labels.sectionTitle}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{labels.sectionSubtitle}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={runScan}
            disabled={isLoading}
            className="shrink-0"
          >
            <Search className="me-2 h-3.5 w-3.5" />
            {isLoading ? labels.analyzingLabel : labels.analyzeButton}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {anomalies.length === 0 ? (
          <AnomaliesEmptyState title={labels.emptyTitle} subtitle={labels.emptySubtitle} />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              {anomalies.map((a) => (
                <AnomalyCard key={a.id} anomaly={a} locale={locale} />
              ))}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
              {lastScanLabel ? (
                <span>
                  {labels.lastScanLabel} {lastScanLabel}
                </span>
              ) : (
                <span />
              )}
              <Link
                href={`/${locale}/transactions`}
                className="text-primary hover:underline"
              >
                {labels.viewAllLink} →
              </Link>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function pickCategoryName(a: GetResponseAnomaly, locale: Locale): string {
  if (locale === "ar") return a.categoryNameAr ?? a.categoryName ?? "—";
  if (locale === "en") return a.categoryNameEn ?? a.categoryName ?? "—";
  return a.categoryName ?? "—";
}
