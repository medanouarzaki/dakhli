import Anthropic from "@anthropic-ai/sdk";
import type { PrismaClient } from "@prisma/client";
import {
  AiAnomalyJudgmentBatchSchema,
  AnomalyError,
  serializeLocalizedReason,
  type AnomalyResult,
  type DetectionResult,
  type DetectionUsage,
  type LocalizedReason,
} from "./types/anomaly";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;
const REQUEST_TIMEOUT_MS = 60_000;

const ANALYSIS_WINDOW_DAYS = 30;
const HISTORY_WINDOW_DAYS = 180;
const MIN_HISTORY_PER_CATEGORY = 5;

const ZSCORE_HIGH = 2.5;
const ZSCORE_LOW = 1.5;

// ─── Anthropic client (lazy singleton) ────────────────────────────────────────

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AnomalyError("INVALID_INPUT", "ANTHROPIC_API_KEY missing from environment");
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    });
  }
  return anthropicClient;
}

// ─── Wrapper-key normalizer (same pattern as advice.ts) ───────────────────────

function normalizeJudgments(parsed: unknown): unknown[] | null {
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const WRAPPER_KEYS = ["judgments", "items", "results", "anomalies"] as const;
    for (const key of WRAPPER_KEYS) {
      if (key in obj) {
        const inner = obj[key];
        if (Array.isArray(inner)) return inner;
        if (inner && typeof inner === "object") {
          return objectToOrderedArray(inner as Record<string, unknown>);
        }
        return null;
      }
    }
    return objectToOrderedArray(obj);
  }
  if (Array.isArray(parsed)) return parsed;
  return null;
}

function objectToOrderedArray(obj: Record<string, unknown>): unknown[] {
  const entries = Object.entries(obj).filter(([k]) => /^\d+$/.test(k));
  if (entries.length === 0) return [];
  entries.sort(([a], [b]) => Number(a) - Number(b));
  return entries.map(([, v]) => v);
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an expert financial anomaly detector for a Moroccan personal finance app (Dakhli) targeting young adults aged 18-30.

YOUR TASK
For each transaction in the input, decide whether it is an anomaly given:
- the user's typical spending pattern in the same category (mean, std, sample size)
- the transaction's z-score (already computed, always positive in your input)
- the transaction's date, day-of-week, description

A z-score between 1.5 and 2.5 is the AMBIGUOUS upward zone. Above 2.5 the system already flags as anomaly without you. Negative z-scores (spend lower than usual) are NEVER sent to you — they are not anomalies by design.

OUTPUT for each transaction:
- isAnomaly (boolean): true if the transaction is unusual enough to warrant a user alert
- reason (object with three keys: "fr", "en", "ar"): a CONCISE, FACTUAL, MAD-FIGURED explanation, generated FRESH in each of the three languages (NOT machine-translated). Each must be under 280 characters. Examples:
    "fr": "Dépense Glovo de 280 MAD, environ 2× la moyenne habituelle en Alimentation."
    "en": "Glovo expense of 280 MAD, about 2× the usual average in Food & Dining."
    "ar": "مصروف Glovo بقيمة 280 درهم، حوالي 2× المتوسط المعتاد في الطعام."
- priority ("HIGH" | "MEDIUM" | "LOW"): HIGH if the amount is genuinely worrying for a young Moroccan (e.g., > 1000 MAD over baseline in food), MEDIUM if notable, LOW if isAnomaly=false (you still output it for completeness — use generic placeholder text in all three languages)

CULTURAL CONTEXT (Morocco)
- Salaries 5,000-15,000 MAD/month
- Family transfers 500-2,000 MAD/month are NORMAL, not anomalies
- Travel spikes during Ramadan/holidays are seasonal, not anomalies
- Telecom recharges of 500 MAD in one shot CAN be anomalies (vs typical 99-200 MAD postpaid)

OUTPUT FORMAT
Strict JSON, no preamble, no markdown fences:
{
  "judgments": [
    {
      "isAnomaly": true,
      "reason": { "fr": "...", "en": "...", "ar": "..." },
      "priority": "HIGH"
    },
    {
      "isAnomaly": false,
      "reason": { "fr": "Transaction normale.", "en": "Normal transaction.", "ar": "معاملة عادية." },
      "priority": "LOW"
    }
  ]
}

The order of judgments MUST match the input transaction order. ONE judgment per input transaction. No nesting. ALL THREE LANGUAGES are required for every judgment.`;

// ─── Types ────────────────────────────────────────────────────────────────────

type CategoryStats = {
  categoryId: string | null;
  categoryName: string;
  mean: number;
  std: number;
  sampleSize: number;
};

type TransactionForAnalysis = {
  id: string;
  amountMAD: number;
  description: string;
  occurredAt: Date;
  categoryId: string | null;
  categoryName: string;
};

type AmbiguousCase = {
  tx: TransactionForAnalysis;
  zScore: number;
  stats: CategoryStats;
};

// ─── Main detection function ──────────────────────────────────────────────────

export async function detectAnomalies(
  prisma: PrismaClient,
  userId: string
): Promise<DetectionResult> {
  const startedAt = Date.now();

  // 1. Build category stats over the history window (last 180 days)
  const historyStart = new Date();
  historyStart.setDate(historyStart.getDate() - HISTORY_WINDOW_DAYS);

  const historyTransactions = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      type: "EXPENSE",
      occurredAt: { gte: historyStart },
    },
    select: {
      categoryId: true,
      amountMAD: true,
      category: { select: { name: true } },
    },
  });

  const statsByCategory = new Map<string | null, CategoryStats>();
  const grouped = new Map<string | null, { sum: number; sumSq: number; n: number; name: string }>();
  for (const t of historyTransactions) {
    const key = t.categoryId;
    const amt = Number(t.amountMAD);
    const acc = grouped.get(key) ?? { sum: 0, sumSq: 0, n: 0, name: t.category?.name ?? "Sans catégorie" };
    acc.sum += amt;
    acc.sumSq += amt * amt;
    acc.n += 1;
    grouped.set(key, acc);
  }
  for (const [categoryId, acc] of Array.from(grouped.entries())) {
    if (acc.n < MIN_HISTORY_PER_CATEGORY) continue;
    const mean = acc.sum / acc.n;
    const variance = acc.sumSq / acc.n - mean * mean;
    const std = Math.sqrt(Math.max(variance, 0));
    statsByCategory.set(categoryId, {
      categoryId,
      categoryName: acc.name,
      mean,
      std,
      sampleSize: acc.n,
    });
  }

  // 2. Fetch transactions to analyze (last 30 days)
  const analysisStart = new Date();
  analysisStart.setDate(analysisStart.getDate() - ANALYSIS_WINDOW_DAYS);

  const recentTxs = await prisma.transaction.findMany({
    where: {
      userId,
      deletedAt: null,
      type: "EXPENSE",
      occurredAt: { gte: analysisStart },
    },
    select: {
      id: true,
      amountMAD: true,
      description: true,
      occurredAt: true,
      categoryId: true,
      category: { select: { name: true } },
    },
    orderBy: { occurredAt: "desc" },
  });

  if (recentTxs.length === 0) {
    throw new AnomalyError(
      "INSUFFICIENT_HISTORY",
      `No expense transactions in the last ${ANALYSIS_WINDOW_DAYS} days to analyze.`
    );
  }

  // 3. Classify each transaction by z-score
  const directAnomalies: AnomalyResult[] = [];
  const ambiguousCases: AmbiguousCase[] = [];
  const normalTxIds: string[] = [];

  for (const tx of recentTxs) {
    const stats = statsByCategory.get(tx.categoryId);
    const txAnalysis: TransactionForAnalysis = {
      id: tx.id,
      amountMAD: Number(tx.amountMAD),
      description: tx.description,
      occurredAt: tx.occurredAt,
      categoryId: tx.categoryId,
      categoryName: tx.category?.name ?? "Sans catégorie",
    };

    if (!stats || stats.std < 0.01) {
      normalTxIds.push(tx.id);
      continue;
    }

    const zScore = (txAnalysis.amountMAD - stats.mean) / stats.std;

    // Upward-only detection: a spend smaller than usual is not an anomaly worth alerting.
    if (zScore > ZSCORE_HIGH) {
      const ratio = txAnalysis.amountMAD / stats.mean;
      directAnomalies.push({
        transactionId: tx.id,
        isAnomaly: true,
        reason: buildAutoReason(txAnalysis, stats, ratio),
        priority: ratio > 3 ? "HIGH" : "MEDIUM",
        method: "ZSCORE",
        zScore,
      });
    } else if (zScore > ZSCORE_LOW) {
      ambiguousCases.push({ tx: txAnalysis, zScore, stats });
    } else {
      normalTxIds.push(tx.id);
    }
  }

  // 4. AI step for ambiguous cases (single batched call)
  const aiResults: AnomalyResult[] = [];
  let aiUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  };

  if (ambiguousCases.length > 0) {
    const aiOutcome = await callSonnetForAmbiguous(ambiguousCases);
    aiResults.push(...aiOutcome.results);
    aiUsage = aiOutcome.usage;
  }

  // 5. Persist results — reset window first for idempotent re-runs
  const allResults = [...directAnomalies, ...aiResults];

  await prisma.transaction.updateMany({
    where: { userId, occurredAt: { gte: analysisStart } },
    data: { isAnomaly: false, anomalyReason: null },
  });

  for (const result of allResults) {
    if (!result.isAnomaly || !result.reason) continue;
    await prisma.transaction.update({
      where: { id: result.transactionId },
      data: {
        isAnomaly: true,
        anomalyReason: serializeLocalizedReason(result.reason),
      },
    });
  }

  if (allResults.some((r) => r.isAnomaly)) {
    await prisma.aiInsight.create({
      data: {
        userId,
        type: "ANOMALY",
        title: `ANOMALY_SCAN`,
        content: `${allResults.filter((r) => r.isAnomaly).length} anomalies detected on ${recentTxs.length} expenses analyzed.`,
        model: ambiguousCases.length > 0 ? MODEL : null,
        payload: {
          windowDays: ANALYSIS_WINDOW_DAYS,
          totalAnalyzed: recentTxs.length,
          directAnomalies: directAnomalies.length,
          aiResolved: aiResults.length,
          aiTrueAnomalies: aiResults.filter((r) => r.isAnomaly).length,
          usage: aiUsage,
        },
      },
    });
  }

  const usage: DetectionUsage = {
    totalTransactionsAnalyzed: recentTxs.length,
    anomaliesDetected: allResults.filter((r) => r.isAnomaly).length,
    zScoreOnly: directAnomalies.length,
    aiCalled: ambiguousCases.length,
    inputTokens: aiUsage.inputTokens,
    outputTokens: aiUsage.outputTokens,
    cacheReadTokens: aiUsage.cacheReadTokens,
    cacheCreationTokens: aiUsage.cacheCreationTokens,
    latencyMs: Date.now() - startedAt,
  };

  return { results: allResults, usage };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildAutoReason(
  tx: TransactionForAnalysis,
  stats: CategoryStats,
  ratio: number
): LocalizedReason {
  const ratioStr = ratio.toFixed(1);
  const meanStr = Math.round(stats.mean).toString();
  const amountStr = tx.amountMAD.toFixed(0);
  return {
    fr: `Dépense de ${amountStr} MAD, environ ${ratioStr}× la moyenne (${meanStr} MAD) en ${stats.categoryName}.`,
    en: `Expense of ${amountStr} MAD, about ${ratioStr}× the average (${meanStr} MAD) in ${stats.categoryName}.`,
    ar: `مصروف بقيمة ${amountStr} درهم، حوالي ${ratioStr}× المتوسط (${meanStr} درهم) في ${stats.categoryName}.`,
  };
}

async function callSonnetForAmbiguous(
  cases: AmbiguousCase[]
): Promise<{
  results: AnomalyResult[];
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number };
}> {
  const client = getClient();

  const userPayload = {
    cases: cases.map((c) => ({
      transactionId: c.tx.id,
      amountMAD: c.tx.amountMAD,
      description: c.tx.description,
      date: c.tx.occurredAt.toISOString().slice(0, 10),
      dayOfWeek: c.tx.occurredAt.toLocaleDateString("en-US", { weekday: "long" }),
      categoryName: c.stats.categoryName,
      categoryMean: Math.round(c.stats.mean * 100) / 100,
      categoryStd: Math.round(c.stats.std * 100) / 100,
      categorySampleSize: c.stats.sampleSize,
      zScore: Math.round(c.zScore * 100) / 100,
    })),
  };

  const userMessage =
    `Here are ${cases.length} ambiguous transactions (z-score between 1.5 and 2.5, upward only) to judge:\n\n` +
    JSON.stringify(userPayload, null, 2) +
    `\n\nReturn ONE judgment per transaction, in the same order. Each "reason" MUST be an object with all three keys "fr", "en", "ar" — write each language fresh, do not machine-translate.`;

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
    throw new AnomalyError("EMPTY_RESULT", "Sonnet returned no text block");
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
    throw new AnomalyError(
      "PARSE_ERROR",
      `Invalid JSON. First 500 chars: ${cleaned.slice(0, 500)}`,
      e
    );
  }

  const normalized = normalizeJudgments(parsed);
  if (!normalized || normalized.length === 0) {
    throw new AnomalyError(
      "PARSE_ERROR",
      `Could not extract judgments. First 500 chars: ${cleaned.slice(0, 500)}`
    );
  }

  const validation = AiAnomalyJudgmentBatchSchema.safeParse({ judgments: normalized });
  if (!validation.success) {
    throw new AnomalyError(
      "PARSE_ERROR",
      `Schema validation failed: ${validation.error.message}`
    );
  }

  const judgments = validation.data.judgments;

  if (judgments.length !== cases.length) {
    throw new AnomalyError(
      "PARSE_ERROR",
      `Got ${judgments.length} judgments for ${cases.length} cases`
    );
  }

  const results: AnomalyResult[] = cases.map((c, i) => ({
    transactionId: c.tx.id,
    isAnomaly: judgments[i].isAnomaly,
    reason: judgments[i].isAnomaly ? judgments[i].reason : null,
    priority: judgments[i].isAnomaly ? judgments[i].priority : null,
    method: "AI",
    zScore: c.zScore,
  }));

  const usage = response.usage;
  return {
    results,
    usage: {
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      cacheReadTokens: (usage as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0,
      cacheCreationTokens: (usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0,
    },
  };
}
