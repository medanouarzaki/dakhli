import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";

import { authOptions } from "@/lib/auth";
import { generateDemoData } from "@/lib/demo/generate";

const bodySchema = z.object({
  months: z.union([z.literal(3), z.literal(6)]).default(6),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_error" }, { status: 400 });
  }

  try {
    const created = await generateDemoData(session.user.id, parsed.data.months);
    return NextResponse.json({ created }, { status: 201 });
  } catch (err) {
    console.error("[demo/generate]", err);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
