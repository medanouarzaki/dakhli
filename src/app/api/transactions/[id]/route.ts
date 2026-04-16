import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateTransactionSchema } from "@/lib/validations/transaction";

// ─── Shared ownership check ───────────────────────────────────────────────────

async function assertTransactionOwnership(userId: string, txId: string) {
  return prisma.transaction.findFirst({
    where: { id: txId, userId, deletedAt: null },
    select: { id: true },
  });
}

// ─── PATCH /api/transactions/[id] ────────────────────────────────────────────

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
  const parsed = updateTransactionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const input = parsed.data;

  try {
    // 4. Verify transaction ownership
    const tx = await assertTransactionOwnership(session.user.id, params.id);
    if (!tx) {
      return NextResponse.json(
        { error: "transaction_not_found" },
        { status: 404 }
      );
    }

    // 5. Verify accountId belongs to the user
    const account = await prisma.financialAccount.findFirst({
      where: { id: input.accountId, userId: session.user.id, deletedAt: null },
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json({ error: "account_not_found" }, { status: 404 });
    }

    // 6. If categoryId provided, verify ownership and type coherence
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

    // 7. Update
    const occurredAt = new Date(input.occurredAt + "T00:00:00.000Z");

    const updated = await prisma.transaction.update({
      where: { id: params.id },
      data: {
        type: input.type,
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
        description: input.description,
        amount: input.amount,
        currency: "MAD",
        amountMAD: input.amount,
        exchangeRate: 1,
        occurredAt,
      },
      select: { id: true },
    });

    return NextResponse.json({ id: updated.id }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}

// ─── DELETE /api/transactions/[id] ───────────────────────────────────────────

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
    // 2. Verify transaction ownership
    const tx = await assertTransactionOwnership(session.user.id, params.id);
    if (!tx) {
      return NextResponse.json(
        { error: "transaction_not_found" },
        { status: 404 }
      );
    }

    // 3. Soft delete
    await prisma.transaction.update({
      where: { id: params.id },
      data: { deletedAt: new Date() },
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
