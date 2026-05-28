import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateGoalSchema } from "@/lib/validations/goal";

export const runtime = "nodejs";

type ApiErrorCode = "UNAUTHORIZED" | "NOT_FOUND" | "INVALID_BODY" | "INTERNAL_ERROR";

function err(code: ApiErrorCode, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, ...(extra ?? {}) }, { status });
}

type Params = { params: { id: string } };

export async function GET(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", 401);

  const goal = await prisma.goal.findFirst({
    where: { id: params.id, userId: session.user.id, deletedAt: null },
  });
  if (!goal) return err("NOT_FOUND", 404);

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
}

export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("INVALID_BODY", 400);
  }
  const parsed = updateGoalSchema.safeParse(body);
  if (!parsed.success) return err("INVALID_BODY", 400, { issues: parsed.error.issues });

  const existing = await prisma.goal.findFirst({
    where: { id: params.id, userId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return err("NOT_FOUND", 404);

  try {
    const updated = await prisma.goal.update({
      where: { id: params.id },
      data: {
        ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
        ...(parsed.data.targetMAD !== undefined ? { targetMAD: parsed.data.targetMAD } : {}),
        ...(parsed.data.targetDate !== undefined
          ? { targetDate: new Date(parsed.data.targetDate) }
          : {}),
      },
    });
    return NextResponse.json({
      ok: true,
      goal: {
        id: updated.id,
        title: updated.title,
        targetMAD: Number(updated.targetMAD),
        currentMAD: Number(updated.currentMAD),
        targetDate: updated.targetDate?.toISOString() ?? null,
      },
    });
  } catch (e) {
    console.error("[PATCH /api/goals/:id] failed:", e);
    return err("INTERNAL_ERROR", 500);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", 401);

  const existing = await prisma.goal.findFirst({
    where: { id: params.id, userId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return err("NOT_FOUND", 404);

  try {
    await prisma.goal.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[DELETE /api/goals/:id] failed:", e);
    return err("INTERNAL_ERROR", 500);
  }
}
