import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeProjection } from "@/lib/planning/projection";
import type { PlanningVerdict } from "@/lib/planning/analyze";

import { AppNav } from "@/components/nav/AppNav";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecurringCard } from "@/components/planning/RecurringCard";
import { ExceptionalCard } from "@/components/planning/ExceptionalCard";
import { ProjectionSection } from "@/components/planning/ProjectionSection";
import { AiAnalysisCard, type InitialInsight } from "@/components/planning/AiAnalysisCard";
import { formatMAD } from "@/lib/format/money";

type Props = {
  params: { locale: string };
};

export default async function PlanningPage({ params: { locale } }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/${locale}/login`);
  const userId = session.user.id;

  const [t, recurringRaw, exceptionalRaw, latestInsight] = await Promise.all([
    getTranslations("Planning"),
    prisma.recurringItem.findMany({ where: { userId, deletedAt: null }, orderBy: { createdAt: "asc" } }),
    prisma.exceptionalCharge.findMany({ where: { userId, deletedAt: null }, orderBy: { startMonth: "asc" } }),
    prisma.aiInsight.findFirst({
      where: { userId, type: "FORECAST", title: { startsWith: "PLANNING_ANALYSIS:" } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  // Serialize recurring items for client
  const recurring = recurringRaw.map((r) => ({
    id: r.id,
    type: r.type as "REVENUE" | "CHARGE",
    label: r.label,
    amountMAD: Number(r.amountMAD),
    periodicity: r.periodicity as "WEEKLY" | "MONTHLY",
  }));

  // Serialize exceptional charges for client ("YYYY-MM" strings)
  const exceptional = exceptionalRaw.map((e) => ({
    id: e.id,
    label: e.label,
    amountMAD: Number(e.amountMAD),
    startMonth: `${e.startMonth.getUTCFullYear()}-${String(e.startMonth.getUTCMonth() + 1).padStart(2, "0")}`,
    durationMonths: e.durationMonths,
  }));

  // Compute projection with raw Decimal→number conversion
  const projection = computeProjection(
    recurringRaw.map((r) => ({
      id: r.id,
      type: r.type as "REVENUE" | "CHARGE",
      label: r.label,
      amountMAD: Number(r.amountMAD),
      periodicity: r.periodicity as "WEEKLY" | "MONTHLY",
    })),
    exceptionalRaw.map((e) => ({
      id: e.id,
      label: e.label,
      amountMAD: Number(e.amountMAD),
      startMonth: e.startMonth,
      durationMonths: e.durationMonths,
    }))
  );

  const hasData = recurring.length > 0;
  const safeLocale = (["fr", "en", "ar"].includes(locale) ? locale : "fr") as "fr" | "en" | "ar";

  // Latest AI insight
  let initialInsight: InitialInsight = null;
  if (latestInsight?.payload) {
    const p = latestInsight.payload as { verdict?: PlanningVerdict; levers?: Array<{ title: string; description: string }> };
    if (p.verdict) {
      initialInsight = {
        verdict: p.verdict,
        levers: p.levers ?? [],
        generatedAt: latestInsight.createdAt.toISOString(),
      };
    }
  }

  // Summary colors
  function remainingVariant(value: number): string {
    if (value < 0) return "text-destructive";
    if (value < 1000) return "text-warning";
    return "text-success";
  }

  return (
    <>
      <AppNav locale={locale} userName={session.user.name ?? null} userEmail={session.user.email!} />
      <div className="min-h-screen bg-muted/40 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
          </div>

          {/* Recurring items */}
          <RecurringCard initialItems={recurring} locale={locale} />

          {/* Summary */}
          {hasData && (
            <Card className="rounded-xl border bg-card shadow-sm">
              <CardHeader>
                <CardTitle>{t("summary.title")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border bg-muted/30 p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{t("summary.revenue")}</p>
                    <p className="text-xl font-bold text-success tabular-nums">
                      {formatMAD(projection.totalMonthlyRevenue, locale)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{t("summary.charges")}</p>
                    <p className="text-xl font-bold text-destructive tabular-nums">
                      {formatMAD(projection.totalMonthlyCharge, locale)}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-muted/30 p-4 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{t("summary.remaining")}</p>
                    <p className={`text-xl font-bold tabular-nums ${remainingVariant(projection.baseMonthlyRemaining)}`}>
                      {formatMAD(projection.baseMonthlyRemaining, locale)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Exceptional charges */}
          <ExceptionalCard initialItems={exceptional} locale={locale} />

          {/* Projection (table + chart) */}
          <ProjectionSection months={projection.months} hasData={hasData} locale={locale} />

          {/* AI analysis */}
          <AiAnalysisCard initialInsight={initialInsight} locale={safeLocale} hasData={hasData} />
        </div>
      </div>
    </>
  );
}
