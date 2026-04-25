import Anthropic from "@anthropic-ai/sdk";
import type { PrismaClient } from "@prisma/client";
import { AdviceResponseSchema, AdviceError, type AdviceItem } from "./types/advice";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 2048;
const REQUEST_TIMEOUT_MS = 60_000;
const MIN_TRANSACTIONS_FOR_ADVICE = 5;
const ANALYSIS_WINDOW_DAYS = 28;

let anthropicClient: Anthropic | null = null;

function getClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new AdviceError("INVALID_INPUT", "ANTHROPIC_API_KEY missing from environment");
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      timeout: REQUEST_TIMEOUT_MS,
    });
  }
  return anthropicClient;
}

const SYSTEM_PROMPT_BY_LOCALE: Record<"fr" | "en" | "ar", string> = {
  fr: `Tu es un conseiller financier personnel pour de jeunes actifs marocains (18-30 ans) utilisant l'application Dakhli.

CONTEXTE CULTUREL ET ÉCONOMIQUE
- Salaires typiques : 5 000 à 15 000 MAD par mois pour un jeune actif urbain
- Loyer en colocation à Casablanca/Rabat : 1 500 à 3 500 MAD
- Transferts familiaux fréquents (parents, frères et sœurs étudiants) : 500 à 2 000 MAD/mois
- Pratiques religieuses : zakat, sadaqa
- Catégories de dépenses typiques : Glovo (livraison), Marjane/Carrefour (courses), Inwi/Orange (télécom), Lydec (électricité), Careem (transport), Netflix
- Devise principale : MAD (dirham marocain). Quelques achats en EUR ou USD ponctuellement
- Outils de paiement courants : carte bancaire, virement, cash, CIH Mobile

TA MISSION
Analyser les statistiques financières fournies (4 dernières semaines) et générer 3 à 5 conseils :
- Concrets, chiffrés en MAD
- Adaptés au pouvoir d'achat marocain (ne JAMAIS suggérer "économisez 20% de votre revenu" ou "investissez en bourse")
- Basés sur des comparaisons réelles avec l'historique de l'utilisateur
- Avec un mélange de tons : alertes mais aussi encouragements positifs si les chiffres sont bons
- Évitant les généralités vides ("faites attention à vos dépenses")

CHAQUE CONSEIL CONTIENT
- title : phrase courte de 4 à 10 mots, accrocheuse
- observation : constat factuel chiffré en 1 à 2 phrases (max 280 caractères)
- recommendation : action concrète et culturellement pertinente (max 400 caractères)
- priority : "HIGH" si urgent (dépassement budget, dépense anormalement élevée), "MEDIUM" si optimisation possible, "LOW" si suggestion de fond
- kind : "SAVING" (épargne possible), "SPENDING_ALERT" (alerte dépense), "OPPORTUNITY" (bon moment pour agir), "POSITIVE_REINFORCEMENT" (bravo)
- icon : nom d'icône Lucide PascalCase pertinent (PiggyBank, TrendingDown, TrendingUp, ShoppingCart, AlertTriangle, Sparkles, Target, Heart, Coffee, Utensils, Car, Phone, Home, Gift)

EXEMPLES DE BON CONSEIL
{ "title": "Réduisez vos commandes Glovo", "observation": "Vous avez dépensé 540 MAD en livraison cette semaine, 40% de plus que la moyenne du mois.", "recommendation": "Préparer 2 dîners maison par semaine vous économiserait environ 300 MAD/semaine, soit ~1 200 MAD/mois.", "priority": "HIGH", "kind": "SPENDING_ALERT", "icon": "Utensils" }

{ "title": "Belle régularité sur les transferts familiaux", "observation": "Vous avez envoyé 1 000 MAD à votre famille ce mois-ci, comme prévu, sans dépasser votre budget.", "recommendation": "Continuez ainsi. Si votre situation s'améliore, vous pourriez envisager une petite épargne dédiée pour les imprévus familiaux.", "priority": "LOW", "kind": "POSITIVE_REINFORCEMENT", "icon": "Heart" }

FORMAT DE SORTIE
Tu réponds UNIQUEMENT avec un objet JSON valide de la forme exacte :
{
  "items": [
    { "title": "...", "observation": "...", "recommendation": "...", "priority": "HIGH|MEDIUM|LOW", "kind": "SAVING|SPENDING_ALERT|OPPORTUNITY|POSITIVE_REINFORCEMENT", "icon": "..." }
  ]
}

AUCUN texte avant ou après le JSON. PAS de triple backticks. PAS de commentaire. Juste le JSON brut.`,

  en: `You are a personal financial advisor for young Moroccan adults (18-30) using the Dakhli app.

CULTURAL AND ECONOMIC CONTEXT
- Typical salaries: 5,000 to 15,000 MAD/month for young urban professionals
- Shared apartment rent in Casablanca/Rabat: 1,500 to 3,500 MAD
- Frequent family transfers (parents, student siblings): 500 to 2,000 MAD/month
- Religious practices: zakat, sadaqa
- Typical spending categories: Glovo (delivery), Marjane/Carrefour (groceries), Inwi/Orange (telecom), Lydec (electricity), Careem (rides), Netflix
- Primary currency: MAD (Moroccan dirham). Occasional EUR or USD purchases
- Common payment tools: bank card, transfer, cash, CIH Mobile

YOUR MISSION
Analyze the financial statistics provided (last 4 weeks) and generate 3 to 5 pieces of advice:
- Concrete, with MAD figures
- Calibrated to Moroccan purchasing power (NEVER suggest "save 20% of your income" or "invest in the stock market")
- Based on real comparisons with the user's history
- With a mix of tones: alerts but also positive reinforcement when numbers look good
- Avoiding empty generalities ("watch your spending")

EACH PIECE OF ADVICE CONTAINS
- title: 4-10 word catchy phrase
- observation: factual figured statement, 1-2 sentences (max 280 chars)
- recommendation: concrete and culturally relevant action (max 400 chars)
- priority: "HIGH" if urgent, "MEDIUM" if optimization possible, "LOW" if soft suggestion
- kind: "SAVING", "SPENDING_ALERT", "OPPORTUNITY", "POSITIVE_REINFORCEMENT"
- icon: relevant Lucide PascalCase icon name (PiggyBank, TrendingDown, TrendingUp, ShoppingCart, AlertTriangle, Sparkles, Target, Heart, Coffee, Utensils, Car, Phone, Home, Gift)

OUTPUT FORMAT
You respond ONLY with a valid JSON object:
{ "items": [ { "title": "...", "observation": "...", "recommendation": "...", "priority": "HIGH|MEDIUM|LOW", "kind": "...", "icon": "..." } ] }

No text before or after the JSON. No triple backticks. No comments. Just the raw JSON.`,

  ar: `أنت مستشار مالي شخصي للشباب المغاربة (18-30 سنة) الذين يستخدمون تطبيق Dakhli.

السياق الثقافي والاقتصادي
- الرواتب النموذجية: 5,000 إلى 15,000 درهم شهرياً للشباب العاملين في المدن
- إيجار السكن المشترك في الدار البيضاء/الرباط: 1,500 إلى 3,500 درهم
- التحويلات العائلية المتكررة (للوالدين، الإخوة الطلبة): 500 إلى 2,000 درهم شهرياً
- الممارسات الدينية: الزكاة والصدقة
- فئات الإنفاق النموذجية: Glovo (التوصيل)، مرجان/كارفور (التسوق)، إنوي/أورانج (الاتصالات)، Lydec (الكهرباء)، Careem (النقل)، Netflix
- العملة الأساسية: الدرهم المغربي (MAD). مشتريات بالأورو أو الدولار من حين لآخر

مهمتك
تحليل الإحصائيات المالية المقدمة (آخر 4 أسابيع) وتقديم 3 إلى 5 نصائح:
- ملموسة ومرفقة بأرقام بالدرهم
- متناسبة مع القدرة الشرائية المغربية (لا تقترح أبداً "ادخر 20% من دخلك" أو "استثمر في البورصة")
- مبنية على مقارنات حقيقية مع تاريخ المستخدم
- بمزيج من النبرات: تنبيهات وأيضاً تشجيعات إيجابية إذا كانت الأرقام جيدة
- تجنب العموميات الفارغة

كل نصيحة تحتوي على
- title: عبارة قصيرة من 4-10 كلمات
- observation: ملاحظة واقعية مرقمة، 1-2 جملة (280 حرف كحد أقصى)
- recommendation: إجراء ملموس وذو صلة ثقافية (400 حرف كحد أقصى)
- priority: "HIGH" / "MEDIUM" / "LOW"
- kind: "SAVING" / "SPENDING_ALERT" / "OPPORTUNITY" / "POSITIVE_REINFORCEMENT"
- icon: اسم أيقونة Lucide بصيغة PascalCase

تنسيق الإخراج
ترد فقط بكائن JSON صالح. لا نص قبل أو بعد JSON. لا backticks ثلاثية. لا تعليقات.`,
};

type FinancialSnapshot = {
  totalIncomeMAD: number;
  totalExpenseMAD: number;
  netMAD: number;
  transactionCount: number;
  expensesByCategory: Array<{ name: string; totalMAD: number; share: number }>;
  topMerchants: Array<{ description: string; totalMAD: number; count: number }>;
  weeklyExpenseTrend: Array<{ weekStart: string; totalMAD: number }>;
  largestTransactions: Array<{ date: string; description: string; amountMAD: number }>;
  budgetsStatus: Array<{ categoryName: string; usedMAD: number; limitMAD: number; pct: number }>;
};

export async function buildAdviceContext(
  prisma: PrismaClient,
  userId: string,
  windowDays: number = ANALYSIS_WINDOW_DAYS
): Promise<FinancialSnapshot> {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);

  const transactions = await prisma.transaction.findMany({
    where: { userId, deletedAt: null, occurredAt: { gte: since } },
    include: { category: true },
    orderBy: { occurredAt: "desc" },
  });

  if (transactions.length < MIN_TRANSACTIONS_FOR_ADVICE) {
    throw new AdviceError(
      "INSUFFICIENT_DATA",
      `Only ${transactions.length} transactions in the last ${windowDays} days. Need at least ${MIN_TRANSACTIONS_FOR_ADVICE}.`
    );
  }

  const round = (n: number) => Math.round(n * 100) / 100;

  let totalIncome = 0;
  let totalExpense = 0;
  const byCategory = new Map<string, number>();
  const byMerchant = new Map<string, { total: number; count: number }>();
  const byWeek = new Map<string, number>();

  for (const tx of transactions) {
    const amt = Number(tx.amountMAD);
    if (tx.type === "INCOME") totalIncome += amt;
    if (tx.type === "EXPENSE") {
      totalExpense += amt;

      const catName = tx.category?.name ?? "Sans catégorie";
      byCategory.set(catName, (byCategory.get(catName) ?? 0) + amt);

      const desc = tx.description.trim().toUpperCase();
      const m = byMerchant.get(desc) ?? { total: 0, count: 0 };
      byMerchant.set(desc, { total: m.total + amt, count: m.count + 1 });

      const weekStart = startOfWeek(tx.occurredAt).toISOString().slice(0, 10);
      byWeek.set(weekStart, (byWeek.get(weekStart) ?? 0) + amt);
    }
  }

  const expensesByCategory = Array.from(byCategory.entries())
    .map(([name, totalMAD]) => ({
      name,
      totalMAD: round(totalMAD),
      share: totalExpense > 0 ? round((totalMAD / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.totalMAD - a.totalMAD)
    .slice(0, 8);

  const topMerchants = Array.from(byMerchant.entries())
    .map(([description, m]) => ({ description, totalMAD: round(m.total), count: m.count }))
    .sort((a, b) => b.totalMAD - a.totalMAD)
    .slice(0, 5);

  const weeklyExpenseTrend = Array.from(byWeek.entries())
    .map(([weekStart, totalMAD]) => ({ weekStart, totalMAD: round(totalMAD) }))
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart));

  const largestTransactions = transactions
    .filter((t) => t.type === "EXPENSE")
    .sort((a, b) => Number(b.amountMAD) - Number(a.amountMAD))
    .slice(0, 5)
    .map((t) => ({
      date: t.occurredAt.toISOString().slice(0, 10),
      description: t.description,
      amountMAD: round(Number(t.amountMAD)),
    }));

  const activeBudgets = await prisma.budget.findMany({
    where: { userId, deletedAt: null },
    include: { category: true },
  });
  const budgetsStatus = activeBudgets.map((b) => {
    const catName = b.category?.name ?? "";
    const usedMAD = round(byCategory.get(catName) ?? 0);
    const limitMAD = round(Number(b.amountMAD));
    return {
      categoryName: catName || "—",
      usedMAD,
      limitMAD,
      pct: limitMAD > 0 ? round((usedMAD / limitMAD) * 100) : 0,
    };
  });

  return {
    totalIncomeMAD: round(totalIncome),
    totalExpenseMAD: round(totalExpense),
    netMAD: round(totalIncome - totalExpense),
    transactionCount: transactions.length,
    expensesByCategory,
    topMerchants,
    weeklyExpenseTrend,
    largestTransactions,
    budgetsStatus,
  };
}

function normalizeItems(parsed: unknown): unknown[] | null {
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if ("items" in obj) {
      const inner = obj.items;
      if (Array.isArray(inner)) return inner;
      if (inner && typeof inner === "object") {
        return objectToOrderedArray(inner as Record<string, unknown>);
      }
      return null;
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

function startOfWeek(d: Date): Date {
  const diff = (d.getDay() + 6) % 7;
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  r.setDate(r.getDate() - diff);
  return r;
}

export type GenerateAdviceUsage = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  latencyMs: number;
};

export type GenerateAdviceResult = {
  items: AdviceItem[];
  usage: GenerateAdviceUsage;
  context: FinancialSnapshot;
};

export async function generateWeeklyAdvice(
  prisma: PrismaClient,
  userId: string,
  locale: "fr" | "en" | "ar"
): Promise<GenerateAdviceResult> {
  const context = await buildAdviceContext(prisma, userId);
  const startedAt = Date.now();

  const userPayload = { locale, windowDays: ANALYSIS_WINDOW_DAYS, snapshot: context };

  const userMessage =
    locale === "fr"
      ? `Voici les statistiques financières de l'utilisateur sur les ${ANALYSIS_WINDOW_DAYS} derniers jours :\n\n` +
        JSON.stringify(userPayload, null, 2) +
        `\n\nGénère 3 à 5 conseils personnalisés au format JSON strict, en français.`
      : locale === "en"
      ? `Here are the user's financial statistics for the last ${ANALYSIS_WINDOW_DAYS} days:\n\n` +
        JSON.stringify(userPayload, null, 2) +
        `\n\nGenerate 3 to 5 personalized advice items in strict JSON format, in English.`
      : `إليك الإحصائيات المالية للمستخدم خلال الـ ${ANALYSIS_WINDOW_DAYS} يوماً الماضية:\n\n` +
        JSON.stringify(userPayload, null, 2) +
        `\n\nقم بإنشاء 3 إلى 5 نصائح مخصصة بتنسيق JSON صارم، باللغة العربية.`;

  const client = getClient();
  const maxAttempts = 2;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT_BY_LOCALE[locale],
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [{ role: "user", content: userMessage }],
      });

      const textBlock = response.content.find((b) => b.type === "text");
      if (!textBlock || textBlock.type !== "text") {
        throw new AdviceError("EMPTY_RESULT", "Claude returned no text block");
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
        throw new AdviceError(
          "PARSE_ERROR",
          `Invalid JSON. First 500 chars: ${cleaned.slice(0, 500)}`,
          e
        );
      }

      const normalizedItems = normalizeItems(parsed);
      if (!normalizedItems) {
        throw new AdviceError(
          "PARSE_ERROR",
          `Could not extract items array from response. First 500 chars: ${cleaned.slice(0, 500)}`
        );
      }

      const wrapped = {
        generatedAt: new Date().toISOString(),
        locale,
        items: normalizedItems,
      };

      const validation = AdviceResponseSchema.safeParse(wrapped);
      if (!validation.success) {
        throw new AdviceError(
          "PARSE_ERROR",
          `Schema validation failed: ${validation.error.message}`,
          validation.error
        );
      }

      const usage = response.usage;
      return {
        items: validation.data.items,
        usage: {
          model: response.model,
          inputTokens: usage.input_tokens ?? 0,
          outputTokens: usage.output_tokens ?? 0,
          cacheReadTokens: (usage as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0,
          cacheCreationTokens: (usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0,
          latencyMs: Date.now() - startedAt,
        },
        context,
      };
    } catch (error) {
      lastError = error;
      if (error instanceof AdviceError && error.code !== "API_ERROR") throw error;
      const status = (error as { status?: number }).status;
      const isRetryable = !status || status >= 500 || status === 429;
      if (!isRetryable || attempt === maxAttempts) break;
      await new Promise((r) => setTimeout(r, attempt === 1 ? 1000 : 3000));
    }
  }

  throw new AdviceError(
    "API_ERROR",
    `Advice generation failed after ${maxAttempts} attempts: ${(lastError as Error)?.message ?? "unknown"}`,
    lastError
  );
}
