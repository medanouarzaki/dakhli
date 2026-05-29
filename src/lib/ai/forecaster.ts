import Anthropic from "@anthropic-ai/sdk";
import type { PrismaClient } from "@prisma/client";
import {
  ForecastSchema,
  ForecasterError,
  type Forecast,
  type GenerationResult,
  type GenerationUsage,
} from "./types/forecast";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 3500;
const REQUEST_TIMEOUT_MS = 60_000;
const HISTORY_WINDOW_DAYS = 180;

let anthropicClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new ForecasterError("INVALID_INPUT", "ANTHROPIC_API_KEY missing");
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    });
  }
  return anthropicClient;
}

function normalizeForecast(parsed: unknown): unknown | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  const WRAPPER_KEYS = ["forecast", "prediction", "result", "data"] as const;
  for (const key of WRAPPER_KEYS) {
    if (
      key in obj &&
      typeof obj[key] === "object" &&
      obj[key] !== null &&
      !Array.isArray(obj[key])
    ) {
      return obj[key];
    }
  }
  return obj;
}

const SYSTEM_PROMPT = `You are an expert financial forecaster for a Moroccan personal finance app (Dakhli) targeting young adults aged 18-30 in Morocco.

YOUR TASK
Given a user's expense history (last 6 months) and a list of pre-detected recurring transactions, predict their expenses for the NEXT calendar month, broken down by category. Identify seasonality and recurring commitments. Be honest, not optimistic.

INPUTS YOU RECEIVE
- The target month for the forecast (YYYY-MM) and its English name
- The user's monthly expense totals over the last 6 months
- Per-category monthly history (last 6 months, top 10 categories by total)
- A list of pre-detected recurring commitments (same description + similar amount appearing 3+ months in a row)
- Today's date

OUTPUT (strict JSON, no preamble, no markdown fences)
{
  "forecastMonth": "2026-06",
  "totalForecastMAD": 8500,
  "totalLastMonthMAD": 9200,
  "byCategoryForecasts": [
    {
      "categoryName": "Alimentation & Resto",
      "predictedMAD": 2500,
      "lastMonthMAD": 2700,
      "averageMAD": 2400,
      "trend": "STABLE",
      "explanation": {
        "fr": "Tu dépenses 2 400-2 700 MAD/mois en Alimentation. Pas d'événement particulier en juin, prévision dans la moyenne.",
        "en": "You spend 2,400-2,700 MAD/month on Food. No special event in June, forecast stays at your average.",
        "ar": "تنفق 2,400-2,700 درهم/شهرياً في الطعام. لا حدث خاص في يونيو، التوقع يبقى ضمن متوسطك."
      }
    }
  ],
  "recurringCommitments": [
    {
      "categoryName": "Logement",
      "amountMAD": 2500,
      "label": { "fr": "Loyer mensuel", "en": "Monthly rent", "ar": "إيجار شهري" }
    }
  ],
  "seasonalContext": null,
  "summary": {
    "fr": "Prévision juin 2026 : 8 500 MAD, en baisse vs mai (9 200 MAD) car l'Aïd al-Adha est passé.",
    "en": "June 2026 forecast: 8,500 MAD, lower than May (9,200 MAD) since Eid al-Adha is behind us.",
    "ar": "توقع يونيو 2026: 8,500 درهم، أقل من ماي (9,200 درهم) لأن عيد الأضحى انتهى."
  }
}

RULES
- byCategoryForecasts: 5-10 top categories by spending. Skip categories with < 50 MAD/month average.
- predictedMAD must be a sensible blend of historical average, recent trend, and seasonality. Round to nearest 10 MAD.
- trend values:
    STABLE          — variation < 15% vs 3-month average
    UP              — clear upward trend over 2-3 last months (>15%)
    DOWN            — clear downward trend over 2-3 last months (>15%)
    SEASONAL_UP     — temporary spike expected due to a known event (Ramadan, Eid, summer holidays, Aïd Al-Adha, school start in September, December holidays)
    SEASONAL_DOWN   — temporary dip expected (e.g. month after Ramadan often shows lower expenses)
- recurringCommitments: review the pre-detected list, KEEP the legitimate ones, REWORD the "label" in all 3 languages naturally. Discard hallucinated/noisy entries.
- seasonalContext: null IF the forecast month has no notable Moroccan event. Otherwise short text in 3 languages explaining the event's expected impact (e.g. "Aïd al-Adha mid-June expected to push Family & Food spending by 15-25%").
- Moroccan seasonality cheat-sheet (use only if it matches forecastMonth):
    * Ramadan (Hijri month, varies each Gregorian year) → +20-40% in Food/Family, −30% in Restaurants
    * Eid al-Fitr (end of Ramadan) → +15-25% in Family transfers and gifts
    * Eid al-Adha (~70 days after Eid al-Fitr) → +30-50% in Food (sheep), Family transfers
    * July-August → +20% Travel, +15% Transport
    * September → +25% Education (back to school)
    * December → +20% Shopping, Gifts
- summary: 1-2 sentences in each language, tutoyer in French, address the user directly. No false enthusiasm.
- ALL three languages (fr, en, ar) REQUIRED for every advice/explanation/label/summary field. Write fresh, not machine-translated.`;

type CategoryMonthlyHistory = {
  categoryName: string;
  monthlyTotalsMAD: { month: string; totalMAD: number }[];
  averageMAD: number;
};

type RecurringCandidate = {
  categoryName: string;
  description: string;
  averageAmountMAD: number;
  monthsObserved: number;
};

export async function generateForecast(
  prisma: PrismaClient,
  userId: string
): Promise<GenerationResult> {
  const startedAt = Date.now();

  // 1. Compute forecast month (next calendar month)
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const forecastMonth = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  const forecastMonthLabel = next.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  // 2. Pull 6 months of expense transactions
  const historyStart = new Date();
  historyStart.setDate(historyStart.getDate() - HISTORY_WINDOW_DAYS);

  const txs = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      type: "EXPENSE",
      occurredAt: { gte: historyStart },
    },
    select: {
      amountMAD: true,
      description: true,
      occurredAt: true,
      category: { select: { name: true } },
    },
  });

  if (txs.length < 10) {
    throw new ForecasterError(
      "INSUFFICIENT_HISTORY",
      `Only ${txs.length} expense transactions in the last 180 days. Need at least 10.`
    );
  }

  // 3. Aggregate per category per month
  const monthBuckets = new Map<string, Map<string, number>>();
  const allCategoryNames = new Set<string>();

  for (const t of txs) {
    const cat = t.category?.name ?? "Sans catégorie";
    const month = `${t.occurredAt.getFullYear()}-${String(t.occurredAt.getMonth() + 1).padStart(2, "0")}`;
    const inner = monthBuckets.get(cat) ?? new Map<string, number>();
    inner.set(month, (inner.get(month) ?? 0) + Number(t.amountMAD));
    monthBuckets.set(cat, inner);
    allCategoryNames.add(cat);
  }

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const categoryHistory: CategoryMonthlyHistory[] = Array.from(allCategoryNames).map((cat) => {
    const inner = monthBuckets.get(cat) ?? new Map<string, number>();
    const monthlyTotalsMAD = months.map((m) => ({
      month: m,
      totalMAD: Math.round((inner.get(m) ?? 0) * 100) / 100,
    }));
    const totalAcross = monthlyTotalsMAD.reduce((s, x) => s + x.totalMAD, 0);
    const averageMAD = Math.round((totalAcross / 6) * 100) / 100;
    return { categoryName: cat, monthlyTotalsMAD, averageMAD };
  });

  const topCategories = categoryHistory
    .filter((c) => c.averageMAD > 50)
    .sort((a, b) => b.averageMAD - a.averageMAD)
    .slice(0, 10);

  if (topCategories.length === 0) {
    throw new ForecasterError(
      "INSUFFICIENT_HISTORY",
      "No category with monthly average > 50 MAD. Forecast not meaningful."
    );
  }

  // 4. Detect recurring commitments deterministically
  const recurringMap = new Map<
    string,
    { catName: string; desc: string; amounts: number[]; monthsSeen: Set<string> }
  >();

  for (const t of txs) {
    const cat = t.category?.name ?? "Sans catégorie";
    const descStem = t.description.trim().toLowerCase().slice(0, 30);
    const amount = Number(t.amountMAD);
    const bucket = Math.round(amount / 50) * 50;
    const key = `${cat}|||${descStem}|||${bucket}`;
    const acc = recurringMap.get(key) ?? {
      catName: cat,
      desc: t.description,
      amounts: [],
      monthsSeen: new Set<string>(),
    };
    acc.amounts.push(amount);
    acc.monthsSeen.add(
      `${t.occurredAt.getFullYear()}-${String(t.occurredAt.getMonth() + 1).padStart(2, "0")}`
    );
    recurringMap.set(key, acc);
  }

  const recurringCandidates: RecurringCandidate[] = Array.from(recurringMap.values())
    .filter((g) => g.monthsSeen.size >= 3)
    .map((g) => ({
      categoryName: g.catName,
      description: g.desc,
      averageAmountMAD: Math.round((g.amounts.reduce((s, x) => s + x, 0) / g.amounts.length) * 100) / 100,
      monthsObserved: g.monthsSeen.size,
    }))
    .sort((a, b) => b.monthsObserved - a.monthsObserved)
    .slice(0, 8);

  const lastMonthKey = months[months.length - 1];
  const totalLastMonthMAD =
    Math.round(
      topCategories.reduce((s, c) => {
        const m = c.monthlyTotalsMAD.find((x) => x.month === lastMonthKey);
        return s + (m?.totalMAD ?? 0);
      }, 0) * 100
    ) / 100;

  // 5. Call Sonnet 4.6
  const userPayload = {
    today: now.toISOString().slice(0, 10),
    forecastMonth,
    forecastMonthLabel,
    months,
    totalLastMonthMAD,
    categoryHistory: topCategories,
    recurringCandidates,
  };

  const userMessage =
    `Forecast next month's expenses for this user.\n\n${JSON.stringify(userPayload, null, 2)}\n\n` +
    `Return strict JSON. ALL "explanation" / "label" / "summary" / "seasonalContext" fields MUST be { fr, en, ar } with fresh writing in each language.`;

  const client = getClient();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [
      {
        type: "text",
        text: SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new ForecasterError("EMPTY_RESULT", "Sonnet returned no text block");
  }

  const cleaned = textBlock.text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new ForecasterError(
      "PARSE_ERROR",
      `Invalid JSON. First 500 chars: ${cleaned.slice(0, 500)}`,
      e
    );
  }

  const normalized = normalizeForecast(parsed);
  const validation = ForecastSchema.safeParse(normalized);
  if (!validation.success) {
    throw new ForecasterError(
      "PARSE_ERROR",
      `Schema validation failed: ${validation.error.message}`
    );
  }
  const forecast: Forecast = validation.data;

  // 6. Persist
  const usageMeta = response.usage;
  const usage: GenerationUsage = {
    inputTokens: usageMeta.input_tokens ?? 0,
    outputTokens: usageMeta.output_tokens ?? 0,
    cacheReadTokens:
      (usageMeta as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0,
    cacheCreationTokens:
      (usageMeta as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0,
    latencyMs: Date.now() - startedAt,
  };

  const insight = await prisma.aiInsight.create({
    data: {
      userId,
      type: "FORECAST",
      title: `FORECAST:${forecastMonth}`,
      content: `Forecast for ${forecastMonthLabel}: ${forecast.totalForecastMAD} MAD total.`,
      model: MODEL,
      payload: {
        forecast,
        inputs: {
          forecastMonth,
          totalLastMonthMAD,
          topCategoriesCount: topCategories.length,
          recurringCandidatesCount: recurringCandidates.length,
        },
        usage,
      },
    },
  });

  return {
    forecast,
    usage,
    insightId: insight.id,
    generatedAt: insight.createdAt.toISOString(),
  };
}

export async function getLatestForecast(
  prisma: PrismaClient,
  userId: string
): Promise<{ forecast: Forecast; insightId: string; generatedAt: string } | null> {
  const insight = await prisma.aiInsight.findFirst({
    where: { userId, type: "FORECAST" },
    orderBy: { createdAt: "desc" },
    select: { id: true, payload: true, createdAt: true },
  });

  if (!insight?.payload) return null;
  const payload = insight.payload as { forecast?: unknown };
  if (!payload.forecast) return null;

  const validation = ForecastSchema.safeParse(payload.forecast);
  if (!validation.success) return null;

  return {
    forecast: validation.data,
    insightId: insight.id,
    generatedAt: insight.createdAt.toISOString(),
  };
}
