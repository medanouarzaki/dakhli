import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getPeriodRange,
  getPreviousRange,
  parsePeriodParam,
  type PeriodKey,
} from "@/lib/dashboard/period";
import {
  computeKpisWithTrend,
  computeExpenseBreakdownByCategory,
  computeIncomeExpenseSeries,
  computeWeekdayExpenseHeatmap,
  computeRecentTransactions,
} from "@/lib/dashboard/stats";

import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { CategoryBreakdownChart } from "@/components/dashboard/CategoryBreakdownChart";
import { IncomeExpenseChart } from "@/components/dashboard/IncomeExpenseChart";
import { TopCategoriesList } from "@/components/dashboard/TopCategoriesList";
import { RecentTransactionsList } from "@/components/dashboard/RecentTransactionsList";
import { WeekdayHeatmap } from "@/components/dashboard/WeekdayHeatmap";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { SignOutButton } from "@/components/sign-out-button";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Props = {
  params: { locale: string };
  searchParams: { period?: string | string[] };
};

export default async function DashboardPage({
  params: { locale },
  searchParams,
}: Props) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const userId = session.user.id;

  const [tDashboard, tAuth] = await Promise.all([
    getTranslations("Dashboard"),
    getTranslations("auth"),
  ]);

  const periodKey: PeriodKey = parsePeriodParam(searchParams.period);
  const range = getPeriodRange(periodKey);
  const previousRange = getPreviousRange(periodKey);

  const [kpis, breakdown, series, heatmap, recent, totalTxCount] =
    await Promise.all([
      computeKpisWithTrend(prisma, userId, range, previousRange),
      computeExpenseBreakdownByCategory(prisma, userId, range, locale, 5),
      computeIncomeExpenseSeries(prisma, userId, range),
      computeWeekdayExpenseHeatmap(prisma, userId, range),
      computeRecentTransactions(prisma, userId, range, 5),
      prisma.transaction.count({
        where: { userId, deletedAt: null },
      }),
    ]);

  if (totalTxCount === 0) {
    return (
      <div className="min-h-screen bg-muted/40 px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <DashboardEmptyState locale={locale} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{tDashboard("title")}</h1>
            <p className="text-sm text-muted-foreground">
              {tDashboard("welcome", {
                name: session.user.name ?? session.user.email ?? "",
              })}
            </p>
          </div>
          <SignOutButton locale={locale} label={tAuth("dashboard.sign_out")} />
        </div>

        <PeriodSelector currentPeriod={periodKey} locale={locale} />

        {/* KPI row */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard
            label={tDashboard("kpi.income")}
            valueMAD={kpis.incomeMAD}
            deltaPct={kpis.incomeDeltaPct}
            positiveIsGood={true}
            locale={locale}
          />
          <KpiCard
            label={tDashboard("kpi.expense")}
            valueMAD={kpis.expenseMAD}
            deltaPct={kpis.expenseDeltaPct}
            positiveIsGood={false}
            locale={locale}
          />
          <KpiCard
            label={tDashboard("kpi.net")}
            valueMAD={kpis.netMAD}
            deltaPct={null}
            positiveIsGood={true}
            locale={locale}
          />
          <KpiCard
            label={tDashboard("kpi.tx_count")}
            valueMAD={kpis.txCount}
            deltaPct={null}
            positiveIsGood={true}
            locale={locale}
            variant="count"
          />
        </div>

        {/* Breakdown + Top categories */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{tDashboard("sections.breakdown")}</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryBreakdownChart rows={breakdown} locale={locale} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{tDashboard("sections.top_categories")}</CardTitle>
            </CardHeader>
            <CardContent>
              <TopCategoriesList rows={breakdown} locale={locale} />
            </CardContent>
          </Card>
        </div>

        {/* Income/expense over time — full width */}
        <Card>
          <CardHeader>
            <CardTitle>{tDashboard("sections.series")}</CardTitle>
          </CardHeader>
          <CardContent>
            <IncomeExpenseChart buckets={series} locale={locale} />
          </CardContent>
        </Card>

        {/* Recent transactions + Weekday heatmap */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{tDashboard("sections.recent")}</CardTitle>
            </CardHeader>
            <CardContent>
              <RecentTransactionsList
                transactions={recent}
                locale={locale}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{tDashboard("sections.heatmap")}</CardTitle>
            </CardHeader>
            <CardContent>
              <WeekdayHeatmap cells={heatmap} locale={locale} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
