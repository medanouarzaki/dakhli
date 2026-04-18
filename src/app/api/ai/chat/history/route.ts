import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_LOCALES = ["fr", "en", "ar"] as const;
type ValidLocale = (typeof VALID_LOCALES)[number];

function isValidLocale(value: string): value is ValidLocale {
  return (VALID_LOCALES as readonly string[]).includes(value);
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const localeParam = request.nextUrl.searchParams.get("locale") ?? "fr";
  const locale: ValidLocale = isValidLocale(localeParam) ? localeParam : "fr";

  const messages = await prisma.chatMessage.findMany({
    where: { userId: session.user.id, locale },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ messages }, { status: 200 });
}
