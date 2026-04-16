import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateBudgetSchema } from "@/lib/validations/budget";

// ─── Shared ownership check ───────────────────────────────────────────────────

async function assertBudgetOwnership(userId: string, budgetId: string) {
  return prisma.budget.findFirst({
    where: { id: budgetId, userId, deletedAt: null },
    select: { id: true },
  });
}

// ─── PATCH /api/budgets/[id] ─────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  // 1. Auth
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // 3. Validate
  const parsed = updateBudgetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;

  try {
    // 4. Verify ownership
    const budget = await assertBudgetOwnership(session.user.id, params.id);
    if (!budget) {
      return NextResponse.json({ error: "budget_not_found" }, { status: 404 });
    }

    // 5. Update amountMAD
    const updated = await prisma.budget.update({
      where: { id: params.id },
      data: { amountMAD: input.amountMAD },
      select: { id: true },
    });

    return NextResponse.json({ id: updated.id }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// ─── DELETE /api/budgets/[id] ────────────────────────────────────────────────

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  // 1. Auth
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    // 2. Verify ownership
    const budget = await assertBudgetOwnership(session.user.id, params.id);
    if (!budget) {
      return NextResponse.json({ error: "budget_not_found" }, { status: 404 });
    }

    // 3. Soft delete
    await prisma.budget.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
