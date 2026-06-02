import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeSavingsBaseline } from "@/lib/savings/plan";
import { analyzeSavingsGoal, SavingsAnalysisError } from "@/lib/savings/analyze";

export const runtime = "nodejs";
export const maxDuration = 90;

const bodySchema = z.object({
  goalId: z.string().min(1),
  locale: z.enum(["fr", "en", "ar"]).default("fr"),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }
  const { goalId, locale } = parsed.data;

  // Verify goal ownership
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId, deletedAt: null },
    select: { id: true },
  });
  if (!goal) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  try {
    const baseline = await computeSavingsBaseline(prisma, userId, goalId);

    if (baseline.reached) {
      return NextResponse.json({ reached: true });
    }

    const analysis = await analyzeSavingsGoal(baseline, locale);

    const insight = await prisma.aiInsight.create({
      data: {
        userId,
        type: "SAVINGS_PLAN",
        goalId,
        title: `SAVINGS_PLAN_V2:${goalId}`,
        content: `[${analysis.verdict.status.toUpperCase()}] ${analysis.verdict.summary}`,
        model: "claude-sonnet-4-6",
        payload: {
          verdict: analysis.verdict,
          recommendedMonthlyAmount: analysis.recommendedMonthlyAmount,
          estimatedMonths: analysis.estimatedMonths,
          levers: analysis.levers,
          locale,
          baseline: {
            remaining: baseline.remaining,
            avgMonthlySavingCapacity: baseline.avgMonthlySavingCapacity,
            requiredMonthly: baseline.requiredMonthly,
            monthsUntilDeadline: baseline.monthsUntilDeadline,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      id: insight.id,
      generatedAt: insight.createdAt.toISOString(),
      verdict: analysis.verdict,
      recommendedMonthlyAmount: analysis.recommendedMonthlyAmount,
      estimatedMonths: analysis.estimatedMonths,
      levers: analysis.levers,
    });
  } catch (error) {
    console.error("[savings/analyze]", error);
    if (error instanceof SavingsAnalysisError) {
      return NextResponse.json({ error: "analysis_failed", message: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
