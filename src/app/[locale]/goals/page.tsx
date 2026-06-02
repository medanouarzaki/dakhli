import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/nav/AppNav";
import { GoalsClient } from "@/components/goals/GoalsClient";
import type { SavingsPlanData } from "@/components/goals/SavingsPlanCard";
import type { SavingsVerdict } from "@/lib/savings/analyze";

type Props = {
  params: { locale: string };
};

export default async function GoalsPage({ params }: Props) {
  const locale = params.locale as "fr" | "en" | "ar";

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }
  const userId = session.user.id;

  const goals = await prisma.goal.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const goalIds = goals.map((g) => g.id);

  // Fetch latest savings plan insights scoped to each goal (using the new goalId FK)
  const planInsights =
    goalIds.length > 0
      ? await prisma.aiInsight.findMany({
          where: { userId, type: "SAVINGS_PLAN", goalId: { in: goalIds } },
          orderBy: { createdAt: "desc" },
          select: { goalId: true, payload: true, createdAt: true },
        })
      : [];

  // Keep only the latest per goalId
  const latestByGoalId: Record<string, SavingsPlanData> = {};
  for (const insight of planInsights) {
    if (!insight.goalId || latestByGoalId[insight.goalId]) continue;
    const p = insight.payload as {
      verdict?: SavingsVerdict;
      recommendedMonthlyAmount?: number;
      estimatedMonths?: number;
      levers?: Array<{ title: string; description: string }>;
    } | null;
    if (p?.verdict?.status) {
      latestByGoalId[insight.goalId] = {
        verdict: p.verdict,
        recommendedMonthlyAmount: p.recommendedMonthlyAmount ?? 0,
        estimatedMonths: p.estimatedMonths ?? 0,
        levers: p.levers ?? [],
        generatedAt: insight.createdAt.toISOString(),
      };
    }
  }

  const initialGoals = goals.map((g) => ({
    id: g.id,
    title: g.title,
    targetMAD: Number(g.targetMAD),
    currentMAD: Number(g.currentMAD),
    targetDate: g.targetDate?.toISOString() ?? null,
    createdAt: g.createdAt.toISOString(),
  }));

  return (
    <>
      <AppNav
        locale={locale}
        userName={session.user.name ?? null}
        userEmail={session.user.email!}
      />
      <GoalsClient locale={locale} initialGoals={initialGoals} initialPlans={latestByGoalId} />
    </>
  );
}
