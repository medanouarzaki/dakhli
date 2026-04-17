import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { categorizeTransaction } from "@/lib/ai/categorize";
import { prisma } from "@/lib/prisma";

const requestSchema = z.object({
  description: z.string().min(3).max(200),
  type: z.enum(["INCOME", "EXPENSE"]),
});

export async function POST(request: Request) {
  // 1. Auth
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 2. Parse
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // 3. Call AI
  const result = await categorizeTransaction(
    parsed.data.description,
    parsed.data.type
  );

  if (!result) {
    return NextResponse.json({ suggestion: null }, { status: 200 });
  }

  // 4. Resolve categoryCode → categoryId
  const category = await prisma.category.findFirst({
    where: {
      code: result.categoryCode,
      OR: [{ userId: session.user.id }, { isSystem: true }],
    },
    select: { id: true, code: true, name: true, nameEn: true, nameAr: true },
  });

  if (!category) {
    return NextResponse.json({ suggestion: null }, { status: 200 });
  }

  return NextResponse.json(
    {
      suggestion: {
        categoryId: category.id,
        categoryCode: category.code,
        categoryName: category.name,
        categoryNameEn: category.nameEn,
        categoryNameAr: category.nameAr,
        confidence: result.confidence,
      },
    },
    { status: 200 }
  );
}
