import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const signupBodySchema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function POST(request: Request) {
  // 1. Parse and validate body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = signupBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_error", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { name, email, password } = parsed.data;

  // 2. Check for existing user — minimal select to avoid fetching sensitive data
  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "email_already_taken" },
      { status: 409 }
    );
  }

  // 3. Hash password (10 rounds)
  const passwordHash = await bcrypt.hash(password, 10);

  // 4. Detect preferred locale from Accept-Language header (fallback: "fr")
  const acceptLanguage = request.headers.get("accept-language") ?? "";
  const preferredLocale = acceptLanguage.startsWith("ar")
    ? "ar"
    : acceptLanguage.startsWith("en")
      ? "en"
      : "fr";

  // 5. Create user
  try {
    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        locale: preferredLocale,
        baseCurrency: "MAD",
      },
    });
  } catch {
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}
