import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { TransactionSource } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createTransactionSchema } from "@/lib/validations/transaction";

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

  // 3. Validate with shared schema
  const parsed = createTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;

  // 4. Verify accountId belongs to the user and is not soft-deleted
  const account = await prisma.financialAccount.findFirst({
    where: {
      id: input.accountId,
      userId: session.user.id,
      deletedAt: null,
    },
    select: { id: true },
  });
  if (!account) {
    return NextResponse.json({ error: "account_not_found" }, { status: 404 });
  }

  // 5. If categoryId provided, verify ownership and type coherence
  if (input.categoryId) {
    const category = await prisma.category.findFirst({
      where: {
        id: input.categoryId,
        OR: [{ userId: session.user.id }, { isSystem: true }],
      },
      select: { id: true, type: true },
    });
    if (!category) {
      return NextResponse.json(
        { error: "category_not_found" },
        { status: 404 }
      );
    }
    if ((category.type as string) !== input.type) {
      return NextResponse.json(
        { error: "category_type_mismatch" },
        { status: 400 }
      );
    }
  }

  // 6. Create transaction — MAD only in T4
  try {
    const occurredAt = new Date(input.occurredAt + "T00:00:00.000Z");

    const created = await prisma.transaction.create({
      data: {
        userId: session.user.id,
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
        type: input.type,
        description: input.description,
        amount: input.amount,
        currency: "MAD",
        amountMAD: input.amount,
        exchangeRate: 1,
        occurredAt,
        source: TransactionSource.MANUAL,
        aiCategorized: false,
        isAnomaly: false,
      },
      select: { id: true },
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
