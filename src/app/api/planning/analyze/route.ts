import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeProjection } from "@/lib/planning/projection";
import { analyzePlanningData, PlanningAnalysisError } from "@/lib/planning/analyze";

export const runtime = "nodejs";
export const maxDuration = 90;

const bodySchema = z.object({
  locale: z.enum(["fr", "en", "ar"]).default("fr"),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "validation_error" }, { status: 400 });
  const { locale } = parsed.data;

  // Fetch planning data
  const [recurringRaw, exceptionalRaw] = await Promise.all([
    prisma.recurringItem.findMany({ where: { userId, deletedAt: null } }),
    prisma.exceptionalCharge.findMany({ where: { userId, deletedAt: null } }),
  ]);

  const recurring = recurringRaw.map((r) => ({
    id: r.id,
    type: r.type as "REVENUE" | "CHARGE",
    label: r.label,
    amountMAD: Number(r.amountMAD),
    periodicity: r.periodicity as "WEEKLY" | "MONTHLY",
  }));

  const exceptional = exceptionalRaw.map((e) => ({
    id: e.id,
    label: e.label,
    amountMAD: Number(e.amountMAD),
    startMonth: e.startMonth,
    durationMonths: e.durationMonths,
  }));

  const projection = computeProjection(recurring, exceptional);

  try {
    const analysis = await analyzePlanningData({ ...projection, projection, locale });

    const insight = await prisma.aiInsight.create({
      data: {
        userId,
        type: "FORECAST",
        title: `PLANNING_ANALYSIS:${locale}`,
        content: `[${analysis.verdict.status.toUpperCase()}] ${analysis.verdict.summary}`,
        payload: { verdict: analysis.verdict, levers: analysis.levers, locale },
      },
    });

    return NextResponse.json({
      ok: true,
      id: insight.id,
      generatedAt: insight.createdAt.toISOString(),
      verdict: analysis.verdict,
      levers: analysis.levers,
    });
  } catch (error) {
    console.error("[planning/analyze]", error);
    if (error instanceof PlanningAnalysisError) {
      return NextResponse.json({ error: "analysis_failed", message: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
