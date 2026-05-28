import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { addProgressSchema } from "@/lib/validations/goal";

export const runtime = "nodejs";

type Params = { params: { id: string } };

export async function POST(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 });
  }
  const parsed = addProgressSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "INVALID_BODY", issues: parsed.error.issues },
      { status: 400 }
    );
  }

  const existing = await prisma.goal.findFirst({
    where: { id: params.id, userId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  try {
    const updated = await prisma.goal.update({
      where: { id: params.id },
      data: { currentMAD: { increment: parsed.data.amountMAD } },
    });
    return NextResponse.json({
      ok: true,
      goal: {
        id: updated.id,
        currentMAD: Number(updated.currentMAD),
        targetMAD: Number(updated.targetMAD),
      },
    });
  } catch (e) {
    console.error("[POST /api/goals/:id/progress] failed:", e);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
