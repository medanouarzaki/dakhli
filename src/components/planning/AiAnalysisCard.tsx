"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Sparkles, CheckCircle, AlertTriangle, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlanningVerdict } from "@/lib/planning/analyze";

// ─── Types ────────────────────────────────────────────────────────────────────

export type InitialInsight = {
  verdict: PlanningVerdict;
  levers: Array<{ title: string; description: string }>;
  generatedAt: string;
} | null;

type Props = {
  initialInsight: InitialInsight;
  locale: "fr" | "en" | "ar";
  hasData: boolean;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusIcon(status: PlanningVerdict["status"]) {
  if (status === "feasible") return <CheckCircle className="h-5 w-5 text-success" />;
  if (status === "tight") return <AlertTriangle className="h-5 w-5 text-warning" />;
  return <XCircle className="h-5 w-5 text-destructive" />;
}

function statusClass(status: PlanningVerdict["status"]): string {
  if (status === "feasible") return "text-success";
  if (status === "tight") return "text-warning";
  return "text-destructive";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AiAnalysisCard({ initialInsight, locale, hasData }: Props) {
  const t = useTranslations("Planning");
  const [analyzing, setAnalyzing] = useState(false);
  const [insight, setInsight] = useState<InitialInsight>(initialInsight);

  async function handleAnalyze() {
    setAnalyzing(true);
    try {
      const res = await fetch("/api/planning/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        verdict?: PlanningVerdict;
        levers?: Array<{ title: string; description: string }>;
        generatedAt?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok) throw new Error(data.message ?? data.error ?? "server_error");
      setInsight({
        verdict: data.verdict!,
        levers: data.levers ?? [],
        generatedAt: data.generatedAt ?? new Date().toISOString(),
      });
      toast.success(t("analyze.success"));
    } catch (err) {
      toast.error(t("analyze.error"));
      console.error("[planning/analyze]", err);
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardHeader>
        <CardTitle>{t("analyze.title")}</CardTitle>
        <p className="text-sm text-muted-foreground">{t("analyze.subtitle")}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          onClick={handleAnalyze}
          disabled={analyzing || !hasData}
          className="w-full sm:w-auto"
        >
          {analyzing ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="me-2 h-4 w-4" />
          )}
          {analyzing ? t("analyze.analyzing") : t("analyze.btn")}
        </Button>

        {!hasData && (
          <p className="text-xs text-muted-foreground">{t("analyze.no_data_hint")}</p>
        )}

        {insight && (
          <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
            {/* Verdict */}
            <div className="flex items-start gap-3">
              {statusIcon(insight.verdict.status)}
              <div>
                <p className={`text-sm font-semibold ${statusClass(insight.verdict.status)}`}>
                  {t(`analyze.status_${insight.verdict.status}`)}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{insight.verdict.summary}</p>
              </div>
            </div>

            {/* Levers */}
            {insight.levers.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("analyze.levers_title")}
                </p>
                {insight.levers.map((lever, i) => (
                  <div key={i} className="rounded-lg border bg-card px-3 py-2">
                    <p className="text-sm font-medium">{lever.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{lever.description}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Timestamp */}
            <p className="text-xs text-muted-foreground">
              {t("analyze.generated_at")}{" "}
              {new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(insight.generatedAt))}
            </p>
          </div>
        )}

        {!insight && !analyzing && (
          <div className="flex flex-col items-center rounded-xl border bg-muted/30 px-4 py-8 text-center">
            <div className="mb-3 rounded-full bg-primary/10 p-3">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{t("analyze.empty")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
