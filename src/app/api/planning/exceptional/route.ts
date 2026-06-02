import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const createSchema = z.object({
  label: z.string().min(1).max(100),
  amountMAD: z.number().positive(),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM"),
  durationMonths: z.number().int().min(1).max(120),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const items = await prisma.exceptionalCharge.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { startMonth: "asc" },
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

  const [y, m] = parsed.data.startMonth.split("-").map(Number);
  const startMonth = new Date(Date.UTC(y, m - 1, 1));

  try {
    const item = await prisma.exceptionalCharge.create({
      data: {
        userId: session.user.id,
        label: parsed.data.label,
        amountMAD: parsed.data.amountMAD,
        startMonth,
        durationMonths: parsed.data.durationMonths,
      },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
