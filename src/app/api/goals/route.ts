import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createGoalSchema } from "@/lib/validations/goal";

export const runtime = "nodejs";

type ApiErrorCode = "UNAUTHORIZED" | "INVALID_BODY" | "INTERNAL_ERROR";

function err(code: ApiErrorCode, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, ...(extra ?? {}) }, { status });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", 401);

  const goals = await prisma.goal.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    ok: true,
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      targetMAD: Number(g.targetMAD),
      currentMAD: Number(g.currentMAD),
      targetDate: g.targetDate?.toISOString() ?? null,
      createdAt: g.createdAt.toISOString(),
    })),
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

  const parsed = createGoalSchema.safeParse(body);
  if (!parsed.success) return err("INVALID_BODY", 400, { issues: parsed.error.issues });

  try {
    const goal = await prisma.goal.create({
      data: {
        userId: session.user.id,
        title: parsed.data.title,
        targetMAD: parsed.data.targetMAD,
        currentMAD: 0,
        targetDate: new Date(parsed.data.targetDate),
      },
    });
    return NextResponse.json({
      ok: true,
      goal: {
        id: goal.id,
        title: goal.title,
        targetMAD: Number(goal.targetMAD),
        currentMAD: Number(goal.currentMAD),
        targetDate: goal.targetDate?.toISOString() ?? null,
        createdAt: goal.createdAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("[POST /api/goals] failed:", e);
    return err("INTERNAL_ERROR", 500);
  }
}
