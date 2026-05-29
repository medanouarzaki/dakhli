"use client";

import { useState } from "react";
import { Loader2, Sparkles, TrendingUp, TrendingDown, Minus, CalendarDays, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  pickLocalizedText,
  pickCategoryExplanation,
  pickCommitmentLabel,
  type Forecast,
  type Locale,
  type Trend,
} from "@/lib/ai/types/forecast";
import { ForecastBreakdownChart } from "./ForecastBreakdownChart";

type Labels = {
  sectionTitle: string;
  sectionSubtitle: string;
  generateButton: string;
  regenerateButton: string;
  analyzingLabel: string;
  totalForecast: string;
  totalLastMonth: string;
  byCategory: string;
  recurringCommitments: string;
  seasonalContext: string;
  summary: string;
  generatedOn: string;
  chartPredicted: string;
  chartLastMonth: string;
  chartMad: string;
  trendLabels: Record<Trend, string>;
  emptyTitle: string;
  emptySubtitle: string;
  errorGeneric: string;
  errorInsufficient: string;
  successGenerated: string;
};

type Props = {
  locale: Locale;
  initialForecast: Forecast | null;
  initialGeneratedAt: string | null;
  labels: Labels;
};

function formatMAD(amount: number, locale: Locale): string {
  const n = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  return locale === "ar" ? `${n} د.م.` : `${n} MAD`;
}

function TrendIcon({ trend }: { trend: Trend }) {
  if (trend === "STABLE") return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (trend === "UP") return <TrendingUp className="h-4 w-4 text-red-500" />;
  if (trend === "DOWN") return <TrendingDown className="h-4 w-4 text-emerald-500" />;
  if (trend === "SEASONAL_UP") return <TrendingUp className="h-4 w-4 text-amber-500" />;
  return <TrendingDown className="h-4 w-4 text-amber-500" />;
}

export function ForecastClient({
  locale,
  initialForecast,
  initialGeneratedAt,
  labels,
}: Props) {
  const [forecast, setForecast] = useState<Forecast | null>(initialForecast);
  const [generatedAt, setGeneratedAt] = useState<string | null>(initialGeneratedAt);
  const [isLoading, setIsLoading] = useState(false);

  async function runGeneration() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/ai/forecasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
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
      const data = await res.json() as { forecast: Forecast; generatedAt: string };
      setForecast(data.forecast);
      setGeneratedAt(data.generatedAt);
      toast.success(labels.successGenerated);
    } catch {
      toast.error(labels.errorGeneric);
    } finally {
      setIsLoading(false);
    }
  }

  const generatedAtLabel = generatedAt
    ? new Date(generatedAt).toLocaleDateString(
        locale === "ar" ? "ar-MA" : locale === "en" ? "en-US" : "fr-FR",
        { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
      )
    : null;

  const totalDelta = forecast
    ? forecast.totalForecastMAD - forecast.totalLastMonthMAD
    : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-indigo-500" />
              {labels.sectionTitle}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{labels.sectionSubtitle}</p>
          </div>
          {forecast && (
            <Button
              variant="outline"
              size="sm"
              onClick={runGeneration}
              disabled={isLoading}
              className="shrink-0"
            >
              {isLoading ? (
                <Loader2 className="me-2 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="me-2 h-3.5 w-3.5" />
              )}
              {isLoading ? labels.analyzingLabel : labels.regenerateButton}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {/* Empty state */}
        {!forecast && !isLoading && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-indigo-500/10 p-3">
              <Sparkles className="h-6 w-6 text-indigo-500" />
            </div>
            <div>
              <h3 className="font-semibold">{labels.emptyTitle}</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">{labels.emptySubtitle}</p>
            </div>
            <Button onClick={runGeneration} disabled={isLoading}>
              <Sparkles className="me-2 h-4 w-4" />
              {labels.generateButton}
            </Button>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <p className="text-sm text-muted-foreground">{labels.analyzingLabel}</p>
          </div>
        )}

        {/* Forecast content */}
        {forecast && !isLoading && (
          <div className="space-y-5">
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">{labels.totalForecast}</p>
                <p className="text-2xl font-bold mt-1 tabular-nums">
                  {formatMAD(forecast.totalForecastMAD, locale)}
                </p>
                {totalDelta !== 0 && (
                  <p
                    className={`text-xs mt-1 flex items-center gap-1 ${
                      totalDelta > 0 ? "text-red-500" : "text-emerald-500"
                    }`}
                  >
                    {totalDelta > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {totalDelta > 0 ? "+" : ""}
                    {formatMAD(Math.abs(totalDelta), locale)}
                  </p>
                )}
              </div>
              <div className="rounded-lg border bg-card p-4">
                <p className="text-xs text-muted-foreground">{labels.totalLastMonth}</p>
                <p className="text-2xl font-bold mt-1 tabular-nums text-muted-foreground">
                  {formatMAD(forecast.totalLastMonthMAD, locale)}
                </p>
              </div>
            </div>

            {/* Breakdown chart */}
            <div>
              <h4 className="text-sm font-semibold mb-2">{labels.byCategory}</h4>
              <ForecastBreakdownChart
                forecasts={forecast.byCategoryForecasts}
                locale={locale}
                labels={{
                  predicted: labels.chartPredicted,
                  lastMonth: labels.chartLastMonth,
                  mad: labels.chartMad,
                }}
              />
            </div>

            {/* Category list */}
            <div className="space-y-2">
              {forecast.byCategoryForecasts.map((cf, i) => (
                <div key={i} className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <TrendIcon trend={cf.trend} />
                      <span className="font-medium text-sm">{cf.categoryName}</span>
                      <span className="text-xs text-muted-foreground">
                        ({labels.trendLabels[cf.trend]})
                      </span>
                    </div>
                    <span className="tabular-nums text-sm font-semibold shrink-0">
                      {formatMAD(cf.predictedMAD, locale)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {pickCategoryExplanation(cf, locale)}
                  </p>
                </div>
              ))}
            </div>

            {/* Recurring commitments */}
            {forecast.recurringCommitments.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2">{labels.recurringCommitments}</h4>
                <div className="space-y-1.5">
                  {forecast.recurringCommitments.map((rc, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <span>{pickCommitmentLabel(rc, locale)}</span>
                      <span className="tabular-nums font-medium">
                        {formatMAD(rc.amountMAD, locale)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Seasonal context */}
            {forecast.seasonalContext && (
              <div className="rounded-lg border-s-4 border-s-amber-500 bg-amber-500/5 p-4">
                <h4 className="text-sm font-semibold mb-1">{labels.seasonalContext}</h4>
                <p className="text-sm leading-relaxed">
                  {pickLocalizedText(forecast.seasonalContext, locale)}
                </p>
              </div>
            )}

            {/* Summary */}
            <div className="rounded-lg border-s-4 border-s-indigo-500 bg-indigo-500/5 p-4">
              <h4 className="text-sm font-semibold mb-1">{labels.summary}</h4>
              <p className="text-sm leading-relaxed">
                {pickLocalizedText(forecast.summary, locale)}
              </p>
            </div>

            {/* Footer */}
            {generatedAtLabel && (
              <p className="text-xs text-muted-foreground">
                {labels.generatedOn} {generatedAtLabel}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
