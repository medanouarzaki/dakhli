import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateWeeklyAdvice } from "@/lib/ai/advice";
import { AdviceError, AdviceResponseSchema } from "@/lib/ai/types/advice";

export const runtime = "nodejs";
export const maxDuration = 90;

const COOLDOWN_DAYS = 6;

const BODY_SCHEMA = z.object({
  locale: z.enum(["fr", "en", "ar"]),
  force: z.boolean().optional().default(false),
});

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_BODY"
  | "COOLDOWN"
  | "INSUFFICIENT_DATA"
  | "GENERATION_FAILED"
  | "INTERNAL_ERROR";

function err(code: ApiErrorCode, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, ...(extra ?? {}) }, { status });
}

function cooldownUntil(generatedAt: Date): Date {
  const d = new Date(generatedAt);
  d.setDate(d.getDate() + COOLDOWN_DAYS);
  return d;
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", 401);

  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") ?? "fr";
  if (!["fr", "en", "ar"].includes(locale)) return err("INVALID_BODY", 400);

  const latest = await prisma.aiInsight.findFirst({
    where: {
      userId: session.user.id,
      type: "ADVICE",
      title: `WEEKLY_ADVICE:${locale}`,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!latest) return NextResponse.json({ ok: true, latest: null });

  const payload = latest.payload as { items?: unknown } | null;
  const itemsParse = AdviceResponseSchema.shape.items.safeParse(payload?.items);

  return NextResponse.json({
    ok: true,
    latest: {
      id: latest.id,
      generatedAt: latest.createdAt.toISOString(),
      locale,
      items: itemsParse.success ? itemsParse.data : [],
      cooldownUntil: cooldownUntil(latest.createdAt).toISOString(),
    },
  });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", 401);
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return err("INVALID_BODY", 400, { reason: "malformed JSON" });
  }

  const parsed = BODY_SCHEMA.safeParse(body);
  if (!parsed.success) return err("INVALID_BODY", 400, { issues: parsed.error.issues });
  const { locale, force } = parsed.data;

  if (!force) {
    const last = await prisma.aiInsight.findFirst({
      where: { userId, type: "ADVICE", title: `WEEKLY_ADVICE:${locale}` },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (last) {
      const until = cooldownUntil(last.createdAt);
      if (until.getTime() > Date.now()) {
        return err("COOLDOWN", 429, {
          cooldownUntil: until.toISOString(),
          lastGeneratedAt: last.createdAt.toISOString(),
        });
      }
    }
  }

  try {
    const result = await generateWeeklyAdvice(prisma, userId, locale);

    const insight = await prisma.aiInsight.create({
      data: {
        userId,
        type: "ADVICE",
        title: `WEEKLY_ADVICE:${locale}`,
        content: result.items
          .map((it) => `• [${it.priority}] ${it.title} — ${it.observation}`)
          .join("\n"),
        model: result.usage.model,
        payload: {
          items: result.items,
          usage: result.usage,
          contextSummary: {
            totalIncomeMAD: result.context.totalIncomeMAD,
            totalExpenseMAD: result.context.totalExpenseMAD,
            netMAD: result.context.netMAD,
            transactionCount: result.context.transactionCount,
            windowDays: 28,
          },
        },
      },
    });

    return NextResponse.json({
      ok: true,
      id: insight.id,
      generatedAt: insight.createdAt.toISOString(),
      locale,
      items: result.items,
      cooldownUntil: cooldownUntil(insight.createdAt).toISOString(),
    });
  } catch (error) {
    console.error("[advice] generation failed:", error);
    if (error instanceof AdviceError) {
      if (error.code === "INSUFFICIENT_DATA") {
        return err("INSUFFICIENT_DATA", 422, { message: error.message });
      }
      return err("GENERATION_FAILED", 502, { message: error.message });
    }
    return err("INTERNAL_ERROR", 500);
  }
}
