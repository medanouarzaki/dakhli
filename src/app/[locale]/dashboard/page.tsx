import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

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
import { computeBudgetUsage } from "@/lib/budgets/usage";

import { AppNav } from "@/components/nav/AppNav";
import { PeriodSelector } from "@/components/dashboard/PeriodSelector";
import { KpiCard } from "@/components/dashboard/KpiCard";
import { CategoryBreakdownChart } from "@/components/dashboard/CategoryBreakdownChart";
import { IncomeExpenseChart } from "@/components/dashboard/IncomeExpenseChart";
import { TopCategoriesList } from "@/components/dashboard/TopCategoriesList";
import { RecentTransactionsList } from "@/components/dashboard/RecentTransactionsList";
import { WeekdayHeatmap } from "@/components/dashboard/WeekdayHeatmap";
import { DashboardEmptyState } from "@/components/dashboard/DashboardEmptyState";
import { BudgetUsageMini } from "@/components/dashboard/BudgetUsageMini";
import { WeeklyAdviceSection } from "@/components/dashboard/WeeklyAdviceSection";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

  const [tDashboard, tBudgets] = await Promise.all([
    getTranslations("Dashboard"),
    getTranslations("Budgets"),
  ]);

  const periodKey: PeriodKey = parsePeriodParam(searchParams.period);
  const range = getPeriodRange(periodKey);
  const previousRange = getPreviousRange(periodKey);

  const [kpis, breakdown, series, heatmap, recent, totalTxCount, budgetUsage] =
    await Promise.all([
      computeKpisWithTrend(prisma, userId, range, previousRange),
      computeExpenseBreakdownByCategory(prisma, userId, range, locale, 5),
      computeIncomeExpenseSeries(prisma, userId, range),
      computeWeekdayExpenseHeatmap(prisma, userId, range),
      computeRecentTransactions(prisma, userId, range, 5),
      prisma.transaction.count({
        where: { userId, deletedAt: null },
      }),
      computeBudgetUsage(prisma, userId, locale),
    ]);

  if (totalTxCount === 0) {
    return (
      <>
        <AppNav
          locale={locale}
          userName={session.user.name ?? null}
          userEmail={session.user.email!}
        />
        <div className="min-h-[calc(100vh-3.5rem)] bg-muted/40 px-4 py-12">
          <div className="mx-auto max-w-3xl">
            <DashboardEmptyState locale={locale} />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppNav
        locale={locale}
        userName={session.user.name ?? null}
        userEmail={session.user.email!}
      />
      <div className="min-h-screen bg-muted/40 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Header */}
          <div>
            <h1 className="text-2xl font-bold">{tDashboard("title")}</h1>
            <p className="text-sm text-muted-foreground">
              {tDashboard("welcome", {
                name: session.user.name ?? session.user.email ?? "",
              })}
            </p>
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

          {/* Weekly AI advice */}
          <WeeklyAdviceSection userId={userId} locale={locale as "fr" | "en" | "ar"} />

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

          {/* Budget usage */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{tBudgets("dashboard_section.title")}</CardTitle>
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/${locale}/budgets`}>
                    {tBudgets("dashboard_section.cta_manage")}
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {budgetUsage.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {tBudgets("dashboard_section.no_budgets")}
                </p>
              ) : (
                <div className="space-y-4">
                  {budgetUsage.map((row) => (
                    <BudgetUsageMini key={row.budgetId} row={row} locale={locale} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
