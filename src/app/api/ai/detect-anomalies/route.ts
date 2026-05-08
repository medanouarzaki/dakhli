import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { detectAnomalies } from "@/lib/ai/anomaly-detector";
import { AnomalyError, pickLocalizedReason } from "@/lib/ai/types/anomaly";

export const runtime = "nodejs";
export const maxDuration = 90;

// `locale` is accepted for backward compatibility with the existing client
// payload but is no longer used: detection now generates all three languages
// in a single pass and stores them as a JSON object on the transaction.
const BODY_SCHEMA = z.object({
  locale: z.enum(["fr", "en", "ar"]).optional(),
});

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INVALID_BODY"
  | "INSUFFICIENT_HISTORY"
  | "DETECTION_FAILED"
  | "INTERNAL_ERROR";

function err(code: ApiErrorCode, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, ...(extra ?? {}) }, { status });
}

// ─── GET: latest anomalies for the user (top 5 by occurredAt desc) ────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", 401);

  const userId = session.user.id;

  const anomalies = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      isAnomaly: true,
    },
    select: {
      id: true,
      description: true,
      amountMAD: true,
      occurredAt: true,
      anomalyReason: true,
      category: { select: { name: true, nameEn: true, nameAr: true, color: true, icon: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: 5,
  });

  const lastScan = await prisma.aiInsight.findFirst({
    where: { userId, type: "ANOMALY" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  return NextResponse.json({
    ok: true,
    anomalies: anomalies.map((a) => ({
      id: a.id,
      description: a.description,
      amountMAD: Number(a.amountMAD),
      occurredAt: a.occurredAt.toISOString(),
      reasonByLocale: {
        fr: pickLocalizedReason(a.anomalyReason, "fr"),
        en: pickLocalizedReason(a.anomalyReason, "en"),
        ar: pickLocalizedReason(a.anomalyReason, "ar"),
      },
      categoryName: a.category?.name ?? null,
      categoryNameEn: a.category?.nameEn ?? null,
      categoryNameAr: a.category?.nameAr ?? null,
      categoryColor: a.category?.color ?? null,
      categoryIcon: a.category?.icon ?? null,
    })),
    lastScanAt: lastScan?.createdAt.toISOString() ?? null,
  });
}

// ─── POST: trigger a new anomaly scan ─────────────────────────────────────────

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
  // `locale` from body is intentionally ignored — see BODY_SCHEMA comment above.
  void parsed.data;

  try {
    const result = await detectAnomalies(prisma, userId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[detect-anomalies] failed:", error);
    if (error instanceof AnomalyError) {
      if (error.code === "INSUFFICIENT_HISTORY") {
        return err("INSUFFICIENT_HISTORY", 422, { message: error.message });
      }
      return err("DETECTION_FAILED", 502, { message: error.message });
    }
    return err("INTERNAL_ERROR", 500);
  }
}
