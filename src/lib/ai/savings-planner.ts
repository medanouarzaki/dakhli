import Anthropic from "@anthropic-ai/sdk";
import type { PrismaClient } from "@prisma/client";
import {
  SavingsPlanSchema,
  SavingsPlannerError,
  type GenerationResult,
  type GenerationUsage,
  type SavingsPlan,
} from "./types/savings-plan";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2500;
const REQUEST_TIMEOUT_MS = 60_000;
const HISTORY_WINDOW_DAYS = 90;

// ─── Anthropic client ─────────────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new SavingsPlannerError("INVALID_INPUT", "ANTHROPIC_API_KEY missing");
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    });
  }
  return anthropicClient;
}

// ─── Wrapper-key normalizer ───────────────────────────────────────────────────

function normalizePlan(parsed: unknown): unknown | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;

  const obj = parsed as Record<string, unknown>;
  const WRAPPER_KEYS = ["plan", "savings_plan", "savingsPlan", "result", "data"] as const;
  for (const key of WRAPPER_KEYS) {
    if (key in obj && typeof obj[key] === "object" && obj[key] !== null && !Array.isArray(obj[key])) {
      return obj[key];
    }
  }
  return obj;
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert personal finance advisor for a Moroccan app (Dakhli) targeting young adults aged 18-30 in Morocco.

YOUR TASK
For each user goal you are given, compute a realistic monthly savings plan and propose 2-4 concrete spending levers the user can pull to free that budget.

INPUTS YOU RECEIVE
- The user's goal: title, target amount in MAD, current saved amount in MAD, target date
- The number of months remaining until the target date
- The user's average monthly income (computed from their last 90 days)
- The user's average monthly spend per category (last 90 days, top categories)

OUTPUT (strict JSON, no preamble, no markdown fences)
{
  "monthlyTargetMAD": 1250,
  "monthsRemaining": 8,
  "feasibility": "REALISTIC",
  "leversByCategory": [
    {
      "categoryName": "Alimentation & Resto",
      "currentMonthlyMAD": 1800,
      "suggestedMonthlyMAD": 1400,
      "potentialSavingsMAD": 400,
      "advice": {
        "fr": "Garde 1 ou 2 sorties resto par semaine, cuisine le reste. ~400 MAD/mois récupérés.",
        "en": "Keep 1-2 restaurant outings per week, cook the rest. ~400 MAD/month freed.",
        "ar": "احتفظ بمرة أو مرتين فقط في الأسبوع للمطعم، اطبخ الباقي. ~400 درهم/شهر يتم استرجاعها."
      }
    }
  ],
  "summary": {
    "fr": "Met 1 250 MAD/mois de côté pendant 8 mois. C'est jouable en réduisant tes sorties resto et tes recharges Inwi de 200 MAD/mois.",
    "en": "Set aside 1,250 MAD/month for 8 months. Doable by trimming restaurant outings and Inwi recharges by 200 MAD/month.",
    "ar": "ادخر 1,250 درهم شهرياً لمدة 8 أشهر. أمر ممكن بتقليل الخروج للمطاعم وشحن إنوي بقيمة 200 درهم شهرياً."
  }
}

RULES
- monthlyTargetMAD = ceil((targetMAD - currentMAD) / monthsRemaining), rounded sensibly
- feasibility scale relative to monthly income:
    EASY:         monthlyTargetMAD < 10% of monthly income
    REALISTIC:    10-25% of monthly income
    STRETCH:      25-50% of monthly income — only proposable with strong levers
    UNREALISTIC:  > 50% of monthly income OR negative free cash. Be honest about it, suggest delaying the date or reducing the target.
- leversByCategory: ONLY include categories where reduction makes cultural sense. Do NOT propose to cut:
    * Family transfers (Famille / Transferts) — culturally sacred, never touch
    * Rent / housing — assumed non-negotiable for a 18-30 worker
    * Zakat & Sadaqa — religious, untouchable
- DO propose levers on: dining/restaurants, entertainment, shopping, telecom (if abnormally high), travel (non-essential), subscriptions
- 2-4 levers max. Quality over quantity. Each lever must have:
    * realistic currentMonthlyMAD (matches the user's history)
    * suggestedMonthlyMAD between 60-90% of current (not asking for impossible cuts)
    * potentialSavingsMAD = currentMonthlyMAD - suggestedMonthlyMAD
    * advice: 1 actionable sentence in all 3 languages, written FRESH (not machine-translated)
- summary: 1-2 sentences in each language, addressed directly to the user ("tu" in French), realistic tone (no false enthusiasm)
- ALL three languages (fr, en, ar) are REQUIRED in every advice and summary field. Write each one naturally in that language.

EDGE CASES
- If monthsRemaining <= 0: not your problem — the API will block before calling you
- If currentMAD >= targetMAD: same, blocked upstream
- If monthly income is unknown or very low: still output a plan with feasibility=UNREALISTIC and honest summary
- If no transactions / very thin history: best-effort plan with empty or sparse leversByCategory`;

// ─── Internal types ───────────────────────────────────────────────────────────

type CategoryAverage = {
  categoryName: string;
  monthlyAverageMAD: number;
  transactionCount: number;
};

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function generateSavingsPlan(
  prisma: PrismaClient,
  userId: string,
  goalId: string,
  locale: "fr" | "en" | "ar"
): Promise<GenerationResult> {
  const startedAt = Date.now();

  // 1. Fetch and validate the goal
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId, deletedAt: null },
    select: {
      id: true,
      title: true,
      targetMAD: true,
      currentMAD: true,
      targetDate: true,
    },
  });
  if (!goal) {
    throw new SavingsPlannerError("GOAL_NOT_FOUND", `Goal ${goalId} not found for user`);
  }

  const targetMAD = Number(goal.targetMAD);
  const currentMAD = Number(goal.currentMAD);

  if (currentMAD >= targetMAD) {
    throw new SavingsPlannerError(
      "GOAL_ALREADY_ACHIEVED",
      `Goal already achieved: ${currentMAD} >= ${targetMAD} MAD`
    );
  }

  if (!goal.targetDate) {
    throw new SavingsPlannerError("INVALID_INPUT", "Goal has no target date");
  }

  const now = new Date();
  if (goal.targetDate.getTime() < now.getTime()) {
    throw new SavingsPlannerError(
      "GOAL_OVERDUE",
      `Goal target date ${goal.targetDate.toISOString()} is in the past`
    );
  }

  const monthsRemaining = Math.max(
    1,
    Math.round((goal.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.4))
  );

  // 2. Compute 90-day baseline
  const historyStart = new Date();
  historyStart.setDate(historyStart.getDate() - HISTORY_WINDOW_DAYS);
  const periodMonths = HISTORY_WINDOW_DAYS / 30.4;

  const incomeTxs = await prisma.transaction.findMany({
    where: { userId, deletedAt: null, type: "INCOME", occurredAt: { gte: historyStart } },
    select: { amountMAD: true },
  });
  const totalIncome = incomeTxs.reduce((s, t) => s + Number(t.amountMAD), 0);
  const monthlyIncomeMAD = totalIncome / periodMonths;

  const expenseTxs = await prisma.transaction.findMany({
    where: { userId, deletedAt: null, type: "EXPENSE", occurredAt: { gte: historyStart } },
    select: { amountMAD: true, category: { select: { name: true } } },
  });

  const byCategory = new Map<string, { sum: number; count: number }>();
  for (const t of expenseTxs) {
    const name = t.category?.name ?? "Sans catégorie";
    const acc = byCategory.get(name) ?? { sum: 0, count: 0 };
    acc.sum += Number(t.amountMAD);
    acc.count += 1;
    byCategory.set(name, acc);
  }
  const categoryAverages: CategoryAverage[] = Array.from(byCategory.entries())
    .map(([categoryName, acc]) => ({
      categoryName,
      monthlyAverageMAD: Math.round((acc.sum / periodMonths) * 100) / 100,
      transactionCount: acc.count,
    }))
    .sort((a, b) => b.monthlyAverageMAD - a.monthlyAverageMAD)
    .slice(0, 8);

  // 3. Call Sonnet 4.6
  const userPayload = {
    goal: {
      title: goal.title,
      targetMAD,
      currentMAD,
      targetDate: goal.targetDate.toISOString().slice(0, 10),
      monthsRemaining,
      gapMAD: targetMAD - currentMAD,
    },
    user: {
      monthlyIncomeMAD: Math.round(monthlyIncomeMAD * 100) / 100,
      categoryAverages,
    },
  };

  const localeHint =
    locale === "fr"
      ? "Tutoyer en français."
      : locale === "en"
      ? "Use English."
      : "استخدم العربية.";

  const userMessage =
    `Compute a savings plan for this goal:\n\n${JSON.stringify(userPayload, null, 2)}\n\n` +
    `Return strict JSON matching the output schema. ${localeHint}\n` +
    `All "advice" and "summary" fields MUST contain fresh writing in all three languages (fr, en, ar).`;

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
    throw new SavingsPlannerError("EMPTY_RESULT", "Sonnet returned no text block");
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
    throw new SavingsPlannerError(
      "PARSE_ERROR",
      `Invalid JSON. First 500 chars: ${cleaned.slice(0, 500)}`,
      e
    );
  }

  const normalized = normalizePlan(parsed);
  const validation = SavingsPlanSchema.safeParse(normalized);
  if (!validation.success) {
    throw new SavingsPlannerError(
      "PARSE_ERROR",
      `Schema validation failed: ${validation.error.message}`
    );
  }
  const plan: SavingsPlan = validation.data;

  // 4. Persist
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
      type: "SAVINGS_PLAN",
      title: `SAVINGS_PLAN:${goalId}`,
      content: `Plan for goal "${goal.title}" generated.`,
      model: MODEL,
      payload: {
        goalId,
        plan,
        inputs: { targetMAD, currentMAD, monthsRemaining, monthlyIncomeMAD, categoryAverages },
        usage,
      },
    },
  });

  return {
    plan,
    usage,
    insightId: insight.id,
    generatedAt: insight.createdAt.toISOString(),
  };
}

// ─── Fetch latest plan ────────────────────────────────────────────────────────

export async function getLatestSavingsPlan(
  prisma: PrismaClient,
  userId: string,
  goalId: string
): Promise<{ plan: SavingsPlan; insightId: string; generatedAt: string } | null> {
  const insight = await prisma.aiInsight.findFirst({
    where: { userId, type: "SAVINGS_PLAN", title: `SAVINGS_PLAN:${goalId}` },
    orderBy: { createdAt: "desc" },
    select: { id: true, payload: true, createdAt: true },
  });

  if (!insight?.payload) return null;

  const payload = insight.payload as { plan?: unknown };
  if (!payload.plan) return null;

  const validation = SavingsPlanSchema.safeParse(payload.plan);
  if (!validation.success) return null;

  return {
    plan: validation.data,
    insightId: insight.id,
    generatedAt: insight.createdAt.toISOString(),
  };
}
