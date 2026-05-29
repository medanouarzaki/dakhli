import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getLatestForecast } from "@/lib/ai/forecaster";
import type { Locale, Trend } from "@/lib/ai/types/forecast";
import { ForecastClient } from "./ForecastClient";

type Props = {
  userId: string;
  locale: Locale;
};

export async function ForecastSection({ userId, locale }: Props) {
  const t = await getTranslations("Forecast");
  const latest = await getLatestForecast(prisma, userId);

  const trendLabels: Record<Trend, string> = {
    STABLE: t("trend.STABLE"),
    UP: t("trend.UP"),
    DOWN: t("trend.DOWN"),
    SEASONAL_UP: t("trend.SEASONAL_UP"),
    SEASONAL_DOWN: t("trend.SEASONAL_DOWN"),
  };

  return (
    <ForecastClient
      locale={locale}
      initialForecast={latest?.forecast ?? null}
      initialGeneratedAt={latest?.generatedAt ?? null}
      labels={{
        sectionTitle: t("section_title"),
        sectionSubtitle: t("section_subtitle"),
        generateButton: t("generate_button"),
        regenerateButton: t("regenerate_button"),
        analyzingLabel: t("analyzing"),
        totalForecast: t("total_forecast"),
        totalLastMonth: t("total_last_month"),
        byCategory: t("by_category"),
        recurringCommitments: t("recurring_commitments"),
        seasonalContext: t("seasonal_context"),
        summary: t("summary"),
        generatedOn: t("generated_on"),
        chartPredicted: t("chart_predicted"),
        chartLastMonth: t("chart_last_month"),
        chartMad: t("chart_mad"),
        trendLabels,
        emptyTitle: t("empty.title"),
        emptySubtitle: t("empty.subtitle"),
        errorGeneric: t("errors.generic"),
        errorInsufficient: t("errors.insufficient"),
        successGenerated: t("success_generated"),
      }}
    />
  );
}
