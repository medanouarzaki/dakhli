import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateForecast, getLatestForecast } from "@/lib/ai/forecaster";
import { ForecasterError } from "@/lib/ai/types/forecast";

export const runtime = "nodejs";
export const maxDuration = 90;

type ApiErrorCode =
  | "UNAUTHORIZED"
  | "INSUFFICIENT_HISTORY"
  | "GENERATION_FAILED"
  | "INTERNAL_ERROR";

function err(code: ApiErrorCode, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: code, ...(extra ?? {}) }, { status });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", 401);

  const latest = await getLatestForecast(prisma, session.user.id);
  if (!latest) {
    return NextResponse.json({ ok: true, forecast: null });
  }
  return NextResponse.json({
    ok: true,
    forecast: latest.forecast,
    generatedAt: latest.generatedAt,
    insightId: latest.insightId,
  });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return err("UNAUTHORIZED", 401);

  try {
    const result = await generateForecast(prisma, session.user.id);
    return NextResponse.json({
      ok: true,
      forecast: result.forecast,
      generatedAt: result.generatedAt,
      insightId: result.insightId,
      usage: result.usage,
    });
  } catch (error) {
    console.error("[POST /api/ai/forecasts] failed:", error);
    if (error instanceof ForecasterError) {
      if (error.code === "INSUFFICIENT_HISTORY") {
        return err("INSUFFICIENT_HISTORY", 422, { message: error.message });
      }
      return err("GENERATION_FAILED", 502, { message: error.message });
    }
    return err("INTERNAL_ERROR", 500);
  }
}
