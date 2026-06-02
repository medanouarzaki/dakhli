"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMAD } from "@/lib/format/money";
import type { SavingsVerdict } from "@/lib/savings/analyze";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SavingsPlanData = {
  verdict: SavingsVerdict;
  recommendedMonthlyAmount: number;
  estimatedMonths: number;
  levers: Array<{ title: string; description: string }>;
  generatedAt: string;
};

type Props = {
  goalId: string;
  goalTitle: string;
  targetMAD: number;
  currentMAD: number;
  initialPlan: SavingsPlanData | null;
  locale: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function verdictStyles(status: SavingsVerdict["status"]): {
  icon: React.ReactNode;
  labelKey: "status_feasible" | "status_tight" | "status_unrealistic";
  badgeClass: string;
} {
  if (status === "feasible")
    return {
      icon: <CheckCircle className="h-4 w-4" />,
      labelKey: "status_feasible",
      badgeClass: "bg-success/10 text-success",
    };
  if (status === "tight")
    return {
      icon: <AlertTriangle className="h-4 w-4" />,
      labelKey: "status_tight",
      badgeClass: "bg-warning/10 text-warning",
    };
  return {
    icon: <XCircle className="h-4 w-4" />,
    labelKey: "status_unrealistic",
    badgeClass: "bg-destructive/10 text-destructive",
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SavingsPlanCard({
  goalId,
  goalTitle,
  targetMAD,
  currentMAD,
  initialPlan,
  locale,
}: Props) {
  const t = useTranslations("SavingsPlan");
  const [plan, setPlan] = useState<SavingsPlanData | null>(initialPlan);
  const [generating, setGenerating] = useState(false);

  const achieved = currentMAD >= targetMAD && targetMAD > 0;

  if (achieved) return null;

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/savings/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId, locale }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        reached?: boolean;
        verdict?: SavingsVerdict;
        recommendedMonthlyAmount?: number;
        estimatedMonths?: number;
        levers?: Array<{ title: string; description: string }>;
        generatedAt?: string;
        error?: string;
        message?: string;
      };

      if (data.reached) {
        toast.success(t("toast_reached"));
        return;
      }
      if (!res.ok) throw new Error(data.message ?? data.error ?? "server_error");

      setPlan({
        verdict: data.verdict!,
        recommendedMonthlyAmount: data.recommendedMonthlyAmount!,
        estimatedMonths: data.estimatedMonths!,
        levers: data.levers ?? [],
        generatedAt: data.generatedAt ?? new Date().toISOString(),
      });
      toast.success(t("toast_success"));
    } catch {
      toast.error(t("toast_error"));
    } finally {
      setGenerating(false);
    }
  }

  const vStyles = plan ? verdictStyles(plan.verdict.status) : null;

  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm">{t("section_title")}</CardTitle>
          <Button
            size="sm"
            variant={plan ? "outline" : "default"}
            disabled={generating}
            onClick={handleGenerate}
            className="shrink-0"
          >
            {generating ? (
              <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="me-1.5 h-3.5 w-3.5" />
            )}
            {generating
              ? t("btn_generating")
              : plan
              ? t("btn_regenerate")
              : t("btn_generate")}
          </Button>
        </div>
        {goalTitle && (
          <p className="text-xs text-muted-foreground truncate">{goalTitle}</p>
        )}
      </CardHeader>

      <CardContent>
        {!plan && !generating && (
          <div className="flex flex-col items-center rounded-xl border bg-muted/30 px-4 py-6 text-center">
            <div className="mb-2 rounded-full bg-primary/10 p-3">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">{t("empty_hint")}</p>
          </div>
        )}

        {generating && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {plan && vStyles && (
          <div className="space-y-4">
            {/* Verdict badge + summary */}
            <div className="flex items-start gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold shrink-0 ${vStyles.badgeClass}`}
              >
                {vStyles.icon}
                {t(vStyles.labelKey)}
              </span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {plan.verdict.summary}
            </p>

            {/* Key numbers */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("recommended_monthly")}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">
                  {formatMAD(plan.recommendedMonthlyAmount, locale)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-3 text-center">
                <p className="text-xs text-muted-foreground">{t("estimated_months")}</p>
                <p className="mt-1 text-lg font-bold tabular-nums">
                  {plan.estimatedMonths}{" "}
                  <span className="text-sm font-normal">{t("months_unit")}</span>
                </p>
              </div>
            </div>

            {/* Levers */}
            {plan.levers.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("levers_title")}
                </p>
                {plan.levers.map((lever, i) => (
                  <div key={i} className="rounded-lg border bg-card px-3 py-2">
                    <p className="text-sm font-medium">{lever.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{lever.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Timestamp */}
            <p className="text-xs text-muted-foreground">
              {t("generated_at")}{" "}
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
                numberingSystem: "latn",
              }).format(new Date(plan.generatedAt))}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
