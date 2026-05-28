import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateSavingsPlan, getLatestSavingsPlan } from "@/lib/ai/savings-planner";
import { SavingsPlannerError } from "@/lib/ai/types/savings-plan";

export const runtime = "nodejs";
export const maxDuration = 90;

const POST_BODY_SCHEMA = z.object({
  goalId: z.string().min(1),
  locale: z.enum(["fr", "en", "ar"]),
});

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_BODY"
  | "GOAL_NOT_FOUND"
  | "GOAL_ALREADY_ACHIEVED"
  | "GOAL_OVERDUE"
  | "INSUFFICIENT_HISTORY"
  | "GENERATION_FAILED"
  | "INTERNAL_ERROR";

function err(code: ApiErrorCode, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, ...(extra ?? {}) }, { status });
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", 401);

  const url = new URL(request.url);
  const goalId = url.searchParams.get("goalId");
  if (!goalId) return err("INVALID_BODY", 400, { reason: "missing goalId" });

  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!goal) return err("GOAL_NOT_FOUND", 404);

  const latest = await getLatestSavingsPlan(prisma, session.user.id, goalId);
  if (!latest) {
    return NextResponse.json({ ok: true, plan: null });
  }
  return NextResponse.json({
    ok: true,
    plan: latest.plan,
    generatedAt: latest.generatedAt,
    insightId: latest.insightId,
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("INVALID_BODY", 400, { reason: "malformed JSON" });
  }

  const parsed = POST_BODY_SCHEMA.safeParse(body);
  if (!parsed.success) return err("INVALID_BODY", 400, { issues: parsed.error.issues });

  const { goalId, locale } = parsed.data;

  try {
    const result = await generateSavingsPlan(prisma, session.user.id, goalId, locale);
    return NextResponse.json({
      ok: true,
      plan: result.plan,
      generatedAt: result.generatedAt,
      insightId: result.insightId,
      usage: result.usage,
    });
  } catch (error) {
    console.error("[POST /api/ai/savings-plans] failed:", error);
    if (error instanceof SavingsPlannerError) {
      const map: Partial<Record<string, ApiErrorCode>> = {
        GOAL_NOT_FOUND: "GOAL_NOT_FOUND",
        GOAL_ALREADY_ACHIEVED: "GOAL_ALREADY_ACHIEVED",
        GOAL_OVERDUE: "GOAL_OVERDUE",
        INSUFFICIENT_HISTORY: "INSUFFICIENT_HISTORY",
      };
      const code = map[error.code] ?? "GENERATION_FAILED";
      const status =
        code === "GOAL_NOT_FOUND" ? 404 : code === "GENERATION_FAILED" ? 502 : 422;
      return err(code, status, { message: error.message });
    }
    return err("INTERNAL_ERROR", 500);
  }
}
