import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const item = await prisma.recurringItem.findFirst({
    where: { id: params.id, userId: session.user.id, deletedAt: null },
    select: { id: true },
  });
  if (!item) return NextResponse.json({ error: "not_found" }, { status: 404 });

  await prisma.recurringItem.update({
    where: { id: params.id },
    data: { deletedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
