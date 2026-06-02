import Anthropic from "@anthropic-ai/sdk";
import { normalizeItems } from "@/lib/ai/normalize";
import type { ProjectionResult } from "./projection";

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;
const REQUEST_TIMEOUT_MS = 60_000;

// ─── Client (lazy singleton) ──────────────────────────────────────────────────

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new PlanningAnalysisError("MISSING_KEY", "ANTHROPIC_API_KEY not set");
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    });
  }
  return anthropicClient;
}

// ─── Error type ───────────────────────────────────────────────────────────────

export class PlanningAnalysisError extends Error {
  constructor(
    public readonly code: "MISSING_KEY" | "PARSE_ERROR" | "API_ERROR",
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "PlanningAnalysisError";
  }
}

// ─── Output types ─────────────────────────────────────────────────────────────

export type PlanningVerdict = {
  status: "feasible" | "tight" | "at_risk";
  summary: string;
};

export type PlanningLever = {
  title: string;
  description: string;
};

export type PlanningAnalysis = {
  verdict: PlanningVerdict;
  levers: PlanningLever[];
};

// ─── System prompt (≥ 2048 tokens for prompt caching) ────────────────────────
//
// Single English prompt with locale rule at the end.
// Comprehensive few-shot examples ensure the model understands all cases.

const SYSTEM_PROMPT = `You are an expert cash-flow planning advisor for Dakhli, a personal finance app built for young Moroccan adults (ages 18–35) living in Casablanca, Rabat, or other Moroccan cities.

═══════════════════════════════════════════════════════════════
CONTEXT — WHO IS YASSINE?
═══════════════════════════════════════════════════════════════

Yassine is a typical Dakhli user. He earns between 7,000 and 12,000 MAD/month, often lives in a shared apartment (loyer colocation 2,500–3,500 MAD), sends monthly transfers to his family (1,000–1,500 MAD), pays telecom (100–300 MAD), utilities (150–450 MAD), and subscriptions (50–150 MAD). He uses Careem/Taxi daily, shops at Marjane and Carrefour Market, and occasionally buys clothes or electronics.

His financial horizon is short-to-medium term: he plans around upcoming large purchases (laptop, phone, car repair, travel, move to a new apartment), not long-term investment portfolios. He does not have access to easy credit. His "remaining" money after fixed charges is his real operational budget.

═══════════════════════════════════════════════════════════════
WHAT YOU RECEIVE
═══════════════════════════════════════════════════════════════

You receive a JSON object with:
- totalMonthlyRevenue: sum of all recurring revenues (MAD, monthly equivalent)
- totalMonthlyCharge: sum of all recurring fixed charges (MAD, monthly equivalent)
- baseMonthlyRemaining: revenue − fixed charges, before any exceptional spending
- exceptionalCharges: list of future one-off or spreading expenses (label, amountMAD per month, startMonth, durationMonths, active months)
- projection: 12-month series — each month has revenue, fixedCharges, exceptionalCharges, remaining
- minRemaining: the lowest "remaining" value across all 12 months (can be negative)
- hasNegativeMonth: true if any month has remaining < 0
- locale: the user's language preference

═══════════════════════════════════════════════════════════════
VERDICT CRITERIA
═══════════════════════════════════════════════════════════════

"feasible":
  • No month with remaining < 0, OR only mild dips (remaining >= -500 MAD for at most 1–2 months)
  • Base monthly remaining >= 2,000 MAD
  • Exceptional charges spread well across the period

"tight":
  • Some months with remaining between -500 MAD and -2,000 MAD, OR
  • Base monthly remaining between 1,000 MAD and 2,000 MAD, OR
  • Exceptional charges create visible but manageable pressure

"at_risk":
  • One or more months with remaining < -2,000 MAD, OR
  • Base monthly remaining < 1,000 MAD, OR
  • Multiple exceptional charges cluster in the same period creating a severe cumulative deficit, OR
  • User has no buffer against any unexpected expense

═══════════════════════════════════════════════════════════════
LEVER GUIDELINES — 2 TO 3 LEVERS
═══════════════════════════════════════════════════════════════

Levers must be:
- Concrete and actionable (specific amounts in MAD, specific months)
- Culturally calibrated (no "invest in stocks", no "open an index fund")
- Realistic for a young Moroccan professional
- Focused on the actual bottleneck revealed by the data

Good lever types:
1. Spread an exceptional charge over more months to reduce peak impact
2. Build a savings buffer before the tight period (e.g., "save 800 MAD/month for 3 months before July")
3. Defer a non-urgent exceptional expense to a less loaded month
4. Identify a small recurring charge that could be temporarily reduced
5. Suggest a modest supplementary income (freelance mission 1,000–2,000 MAD) before the tight period
6. Prioritize which exceptional charge is truly essential this year

═══════════════════════════════════════════════════════════════
WORKED EXAMPLES
═══════════════════════════════════════════════════════════════

──────────────────────────────────────────────────────────────
EXAMPLE A — "feasible" with minor seasonal dip
──────────────────────────────────────────────────────────────
Input summary:
  totalMonthlyRevenue: 8500
  totalMonthlyCharge: 5800
  baseMonthlyRemaining: 2700
  exceptionalCharges: [{ label: "Achat laptop", amountMAD: 1200, startMonth: "2025-07", durationMonths: 3 }]
  months worst: July, Aug, Sep → remaining = 2700 − 1200 = 1500 MAD
  minRemaining: 1500
  hasNegativeMonth: false

Expected output:
{
  "verdict": {
    "status": "feasible",
    "summary": "Your plan is solid. The laptop purchase (3 months × 1,200 MAD) reduces your monthly remaining to 1,500 MAD from July to September, which stays positive. Your base margin of 2,700 MAD/month provides good resilience."
  },
  "levers": [
    {
      "title": "Build a buffer before July",
      "description": "Set aside 400–600 MAD/month from April to June (1,200–1,800 MAD total) so the laptop period feels smooth and you have a cushion for any unexpected cost."
    },
    {
      "title": "Consider spreading over 4 months",
      "description": "Splitting the 3,600 MAD cost over 4 months (900 MAD/month) instead of 3 keeps your July–October remaining at 1,800 MAD — 20% more comfortable."
    }
  ]
}

──────────────────────────────────────────────────────────────
EXAMPLE B — "at_risk" due to clustered exceptional charges
──────────────────────────────────────────────────────────────
Input summary:
  totalMonthlyRevenue: 7500
  totalMonthlyCharge: 6200
  baseMonthlyRemaining: 1300
  exceptionalCharges: [
    { label: "Caution appartement", amountMAD: 6000, startMonth: "2025-10", durationMonths: 1 },
    { label: "Déménagement + mobilier", amountMAD: 2500, startMonth: "2025-10", durationMonths: 1 }
  ]
  months worst: October → remaining = 1300 − 6000 − 2500 = −7200 MAD
  minRemaining: −7200
  hasNegativeMonth: true

Expected output:
{
  "verdict": {
    "status": "at_risk",
    "summary": "October concentrates 8,500 MAD of exceptional charges, creating a -7,200 MAD deficit. With a base margin of only 1,300 MAD/month and no buffer, this plan is not executable without a prior savings effort or a renegotiation of the deposit terms."
  },
  "levers": [
    {
      "title": "Save 1,500 MAD/month starting now",
      "description": "If you're 6 months away from October, saving 1,500 MAD/month builds a 9,000 MAD reserve that covers the entire exceptional spend. Adjust the amount based on how many months you have."
    },
    {
      "title": "Negotiate a lower deposit",
      "description": "In Casablanca and Rabat, a caution of 1 month's rent (2,800–3,200 MAD) is often negotiable. Reducing the deposit by 2,000–3,000 MAD directly cuts your October deficit by the same amount."
    },
    {
      "title": "Defer the furniture purchase",
      "description": "Move the mobilier expense to November or December (2 × 1,250 MAD), separating it from the deposit month. This alone brings October's deficit from -7,200 to -4,700 MAD."
    }
  ]
}

──────────────────────────────────────────────────────────────
EXAMPLE C — "tight" with low base margin
──────────────────────────────────────────────────────────────
Input summary:
  totalMonthlyRevenue: 6500
  totalMonthlyCharge: 5700
  baseMonthlyRemaining: 800
  exceptionalCharges: [] (none)
  minRemaining: 800
  hasNegativeMonth: false

Expected output:
{
  "verdict": {
    "status": "tight",
    "summary": "Your fixed charges absorb 88% of your income, leaving only 800 MAD/month. While no month is negative today, there is zero room for an unexpected expense — a car repair or medical bill would immediately push you into deficit."
  },
  "levers": [
    {
      "title": "Audit your subscriptions and telecom",
      "description": "Review your recurring telecom and streaming subscriptions. Switching operator or removing one subscription (e.g., one of Netflix/Shahid) can free 100–250 MAD/month with minimal lifestyle impact."
    },
    {
      "title": "Target one modest side income",
      "description": "Even a single freelance mission of 1,000–1,500 MAD per month would increase your margin by 125–188% and allow you to gradually build an emergency fund of 3,000–5,000 MAD over 3–4 months."
    }
  ]
}

══════════════════════════════════════════════════════════════
OUTPUT FORMAT — STRICT JSON
══════════════════════════════════════════════════════════════

Respond ONLY with a single valid JSON object matching exactly:
{
  "verdict": { "status": "feasible" | "tight" | "at_risk", "summary": "..." },
  "levers": [ { "title": "...", "description": "..." }, ... ]
}

Rules:
- 2 to 3 levers, no more, no fewer
- No text before or after the JSON
- No triple backticks, no markdown, no comments
- Numbers in the text must use Latin digits
- Currency amounts must be expressed in MAD

══════════════════════════════════════════════════════════════
LOCALE RULE (ALWAYS LAST)
══════════════════════════════════════════════════════════════

The locale field in the input data tells you which language to use:
  "fr"  → respond entirely in French
  "ar"  → respond entirely in Arabic (Modern Standard Arabic natural for a Moroccan app)
  "en"  → respond in English
Never mix languages within a single response.`;

// ─── Normalize planning result ────────────────────────────────────────────────

function normalizePlanningResult(parsed: unknown): { verdict?: unknown; levers?: unknown } | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  // Accept the root object or a single-key wrapper
  if ("verdict" in obj) return obj as { verdict: unknown; levers: unknown };
  for (const key of ["result", "plan", "analysis", "data"]) {
    if (key in obj && obj[key] && typeof obj[key] === "object") {
      return obj[key] as { verdict: unknown; levers: unknown };
    }
  }
  return null;
}

// ─── Input type ───────────────────────────────────────────────────────────────

export type PlanningAnalysisInput = {
  totalMonthlyRevenue: number;
  totalMonthlyCharge: number;
  baseMonthlyRemaining: number;
  projection: ProjectionResult;
  locale: "fr" | "en" | "ar";
};

// ─── Main export ──────────────────────────────────────────────────────────────

export async function analyzePlanningData(
  input: PlanningAnalysisInput
): Promise<PlanningAnalysis> {
  const { locale, projection } = input;

  const payload = JSON.stringify(input, null, 2);

  const userMessage =
    locale === "fr"
      ? `Voici les données du plan de trésorerie de l'utilisateur. Analyse-le et génère un verdict + 2 à 3 leviers d'action.\n\n${payload}`
      : locale === "ar"
      ? `إليك بيانات خطة التدفق النقدي للمستخدم. قم بتحليلها وأنشئ حكماً + 2 إلى 3 إجراءات.\n\n${payload}`
      : `Here is the user's cash-flow plan data. Analyze it and generate a verdict + 2 to 3 action levers.\n\n${payload}`;

  const client = getClient();

  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
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
        throw new PlanningAnalysisError("PARSE_ERROR", "No text block in response");
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
        throw new PlanningAnalysisError(
          "PARSE_ERROR",
          `Invalid JSON: ${cleaned.slice(0, 300)}`,
          e
        );
      }

      const normalized = normalizePlanningResult(parsed);
      if (!normalized?.verdict) {
        throw new PlanningAnalysisError(
          "PARSE_ERROR",
          `Missing verdict in response: ${cleaned.slice(0, 300)}`
        );
      }

      const verdict = normalized.verdict as { status: string; summary: string };
      if (!["feasible", "tight", "at_risk"].includes(verdict.status)) {
        throw new PlanningAnalysisError(
          "PARSE_ERROR",
          `Unknown verdict status: ${verdict.status}`
        );
      }

      // Normalize levers (handles array or numeric-keyed object)
      const rawLevers = normalizeItems(
        Array.isArray(normalized.levers) ? { items: normalized.levers } : normalized.levers ?? []
      ) ?? [];

      const levers = rawLevers
        .filter((l): l is { title: string; description: string } =>
          !!l && typeof l === "object" && "title" in (l as object) && "description" in (l as object)
        )
        .slice(0, 3);

      void projection; // projection is already part of input passed to Claude

      return {
        verdict: {
          status: verdict.status as PlanningVerdict["status"],
          summary: String(verdict.summary ?? ""),
        },
        levers,
      };
    } catch (error) {
      lastError = error;
      if (error instanceof PlanningAnalysisError && error.code === "PARSE_ERROR") throw error;
      if (attempt < 2) await new Promise((r) => setTimeout(r, 1500));
    }
  }

  throw new PlanningAnalysisError(
    "API_ERROR",
    `Analysis failed after 2 attempts: ${(lastError as Error)?.message ?? "unknown"}`,
    lastError
  );
}
