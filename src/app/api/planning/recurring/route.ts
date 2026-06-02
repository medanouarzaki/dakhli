import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  type: z.enum(["REVENUE", "CHARGE"]),
  label: z.string().min(1).max(100),
  amountMAD: z.number().positive(),
  periodicity: z.enum(["WEEKLY", "MONTHLY"]),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const items = await prisma.recurringItem.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const item = await prisma.recurringItem.create({
      data: {
        userId: session.user.id,
        type: parsed.data.type,
        label: parsed.data.label,
        amountMAD: parsed.data.amountMAD,
        periodicity: parsed.data.periodicity,
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
