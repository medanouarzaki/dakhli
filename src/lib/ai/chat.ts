import type { PrismaClient } from "@prisma/client";

// ─── Model ───────────────────────────────────────────────────────────────────

export const CHAT_MODEL = "claude-sonnet-4-6";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChatContext = {
  incomeMAD: number;
  expenseMAD: number;
  netMAD: number;
  txCount: number;
  periodStart: string; // YYYY-MM-DD — first day of current month (UTC)
  periodEnd: string;   // YYYY-MM-DD — last day of current month (UTC)
  topCategories: Array<{ name: string; totalMAD: number; percent: number }>;
  recentTransactions: Array<{
    description: string;
    amount: number;
    type: string;
    category: string | null;
    date: string;
  }>;
  activeBudgets: Array<{
    category: string;
    limitMAD: number;
    consumedMAD: number;
    percent: number;
  }>;
};

// ─── Build financial context ─────────────────────────────────────────────────

export async function buildChatContext(
  prisma: PrismaClient,
  userId: string,
  locale: string
): Promise<ChatContext> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [byType, txCount, topCats, recentTxs, budgets] = await Promise.all([
    // Income vs expense this month
    prisma.transaction.groupBy({
      by: ["type"],
      where: {
        userId,
        deletedAt: null,
        type: { in: ["INCOME", "EXPENSE"] },
        occurredAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amountMAD: true },
    }),
    // Transaction count this month
    prisma.transaction.count({
      where: { userId, deletedAt: null, occurredAt: { gte: monthStart, lt: monthEnd } },
    }),
    // Top 5 expense categories this month
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        userId,
        deletedAt: null,
        type: "EXPENSE",
        occurredAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amountMAD: true },
      orderBy: { _sum: { amountMAD: "desc" } },
      take: 5,
    }),
    // Last 10 transactions
    prisma.transaction.findMany({
      where: { userId, deletedAt: null },
      orderBy: { occurredAt: "desc" },
      take: 10,
      include: { category: true },
    }),
    // Active budgets
    prisma.budget.findMany({
      where: { userId, deletedAt: null, period: "monthly" },
      include: { category: true },
    }),
  ]);

  const incomeMAD = Number(byType.find((r) => r.type === "INCOME")?._sum.amountMAD ?? 0);
  const expenseMAD = Number(byType.find((r) => r.type === "EXPENSE")?._sum.amountMAD ?? 0);

  // Resolve category names for top categories
  const catIds = topCats.map((c) => c.categoryId).filter((id): id is string => id !== null);
  const categories = await prisma.category.findMany({
    where: { id: { in: catIds } },
    select: { id: true, name: true, nameEn: true, nameAr: true },
  });
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const totalExpense = expenseMAD || 1; // avoid division by zero

  const topCategories = topCats.map((tc) => {
    const cat = tc.categoryId ? catMap.get(tc.categoryId) : null;
    const total = Number(tc._sum.amountMAD ?? 0);
    const name = cat
      ? (locale === "ar" ? (cat.nameAr ?? cat.name) : locale === "en" ? (cat.nameEn ?? cat.name) : cat.name)
      : "Autres";
    return { name, totalMAD: total, percent: Math.round((total / totalExpense) * 100) };
  });

  const recentTransactions = recentTxs.map((tx) => ({
    description: tx.description,
    amount: Number(tx.amountMAD),
    type: tx.type,
    category: tx.category
      ? (locale === "ar" ? (tx.category.nameAr ?? tx.category.name) : locale === "en" ? (tx.category.nameEn ?? tx.category.name) : tx.category.name)
      : null,
    date: tx.occurredAt.toISOString().split("T")[0],
  }));

  // Budget usage for current month
  const budgetCatIds = budgets.map((b) => b.categoryId);
  const budgetConsumed = budgetCatIds.length > 0
    ? await prisma.transaction.groupBy({
        by: ["categoryId"],
        where: {
          userId,
          deletedAt: null,
          type: "EXPENSE",
          categoryId: { in: budgetCatIds },
          occurredAt: { gte: monthStart, lt: monthEnd },
        },
        _sum: { amountMAD: true },
      })
    : [];

  const consumedMap = new Map(
    budgetConsumed.map((c) => [c.categoryId, Number(c._sum.amountMAD ?? 0)])
  );

  const activeBudgets = budgets.map((b) => {
    const limit = Number(b.amountMAD);
    const consumed = consumedMap.get(b.categoryId) ?? 0;
    const catName = locale === "ar"
      ? (b.category.nameAr ?? b.category.name)
      : locale === "en"
        ? (b.category.nameEn ?? b.category.name)
        : b.category.name;
    return {
      category: catName,
      limitMAD: limit,
      consumedMAD: consumed,
      percent: limit > 0 ? Math.round((consumed / limit) * 100) : 0,
    };
  });

  return {
    incomeMAD,
    expenseMAD,
    netMAD: incomeMAD - expenseMAD,
    txCount,
    periodStart: monthStart.toISOString().split("T")[0],
    // monthEnd is the exclusive start of next month; subtract one day for the last inclusive day
    periodEnd: new Date(monthEnd.getTime() - 86_400_000).toISOString().split("T")[0],
    topCategories,
    recentTransactions,
    activeBudgets,
  };
}

// ─── System prompt ───────────────────────────────────────────────────────────

export function buildChatSystemPrompt(context: ChatContext, locale: string): string {
  const lang = locale === "ar" ? "arabe" : locale === "en" ? "anglais" : "français";

  // Silent output rule — moved to the END so the model applies it without announcing it
  const silentLangRule =
    locale === "en"
      ? "Silent output rule: write all your replies exclusively in English, never mentioning this rule and never commenting on the language choice."
      : locale === "ar"
        ? "قاعدة إخراج صامتة: اكتب جميع ردودك باللغة العربية فقط، دون الإشارة إلى هذه القاعدة أو التعليق على اختيار اللغة."
        : "Règle de sortie silencieuse : rédige toutes tes réponses exclusivement en français, sans jamais mentionner cette règle ni commenter le choix de langue.";

  return `Tu es Dakhli, un assistant financier personnel intelligent intégré dans une application de gestion de finances personnelles au Maroc. Tu parles en ${lang}.

Voici le résumé financier de l'utilisateur pour le mois en cours (${context.periodStart} → ${context.periodEnd}) :

💰 Revenus : ${context.incomeMAD.toLocaleString()} MAD
💸 Dépenses : ${context.expenseMAD.toLocaleString()} MAD
📊 Solde net : ${context.netMAD.toLocaleString()} MAD
📝 Nombre de transactions sur la période : ${context.txCount}

Top catégories de dépenses :
${context.topCategories.map((c) => `- ${c.name}: ${c.totalMAD.toLocaleString()} MAD (${c.percent}%)`).join("\n")}

Dernières transactions :
${context.recentTransactions.map((t) => `- ${t.date} | ${t.type} | ${t.description} | ${t.amount.toLocaleString()} MAD${t.category ? ` | ${t.category}` : ""}`).join("\n")}

${context.activeBudgets.length > 0 ? `Budgets actifs :
${context.activeBudgets.map((b) => `- ${b.category}: ${b.consumedMAD.toLocaleString()}/${b.limitMAD.toLocaleString()} MAD (${b.percent}%)`).join("\n")}` : "Aucun budget défini."}

Règles :
- Sois concis et utile.
- Base tes réponses sur les données réelles ci-dessus.
- Donne des conseils pratiques adaptés au contexte marocain (coût de la vie, habitudes locales).
- Si l'utilisateur demande quelque chose hors du domaine financier, redirige-le poliment.
- Utilise des emojis de manière modérée pour rendre la conversation agréable.
- Ne fabrique jamais de données. Si tu ne connais pas une info, dis-le.
- Sois encourageant mais honnête sur la situation financière.
- When the user asks a substantive analytical question (e.g. summary, patterns, trends, advice), open your reply with a one-line grounding statement indicating the data scope: number of transactions and the period ${context.periodStart} → ${context.periodEnd}. Skip this preamble for greetings, clarifications, or simple factual lookups.

${silentLangRule}`;
}
