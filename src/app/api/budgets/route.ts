import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createBudgetSchema } from "@/lib/validations/budget";

export async function POST(request: Request) {
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
  const parsed = createBudgetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;

  // 4. Verify category exists, belongs to user or is system, and is EXPENSE
  const category = await prisma.category.findFirst({
    where: {
      id: input.categoryId,
      OR: [{ userId: session.user.id }, { isSystem: true }],
    },
    select: { id: true, type: true },
  });
  if (!category) {
    return NextResponse.json({ error: "category_not_found" }, { status: 404 });
  }
  if (category.type !== "EXPENSE") {
    return NextResponse.json(
      { error: "category_must_be_expense" },
      { status: 400 }
    );
  }

  // 5. Check for existing active budget for this (userId, categoryId, "monthly")
  const existing = await prisma.budget.findFirst({
    where: {
      userId: session.user.id,
      categoryId: input.categoryId,
      period: "monthly",
      deletedAt: null,
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "budget_already_exists" },
      { status: 409 }
    );
  }

  // 6. Create budget
  try {
    const created = await prisma.budget.create({
      data: {
        userId: session.user.id,
        categoryId: input.categoryId,
        amountMAD: input.amountMAD,
        period: "monthly",
      },
      select: { id: true },
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
