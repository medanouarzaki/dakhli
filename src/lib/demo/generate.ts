import { prisma } from "@/lib/prisma";
import { TransactionSource, TransactionType } from "@prisma/client";

// ─── helpers ─────────────────────────────────────────────────────────────────

function rndInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rndAmt(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getDate();
}

function dateAt(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, Math.min(day, daysInMonth(year, month))));
}

type CatMap = Record<string, string>;

async function loadCatMap(): Promise<CatMap> {
  const rows = await prisma.category.findMany({
    where: { isSystem: true },
    select: { code: true, id: true },
  });
  return Object.fromEntries(
    rows.filter((r): r is { code: string; id: string } => r.code !== null).map((r) => [r.code, r.id])
  );
}

// ─── per-month transaction builder ───────────────────────────────────────────

interface TxData {
  userId: string;
  accountId: string;
  categoryId: string | null;
  type: TransactionType;
  description: string;
  amount: number;
  currency: string;
  amountMAD: number;
  exchangeRate: number;
  occurredAt: Date;
  source: TransactionSource;
  aiCategorized: boolean;
  aiConfidence: number | null;
  isAnomaly: boolean;
  importBatchId: null;
}

function buildMonthTxs(
  year: number,
  month: number,
  userId: string,
  accountId: string,
  catMap: CatMap,
  hasOutlier: boolean
): TxData[] {
  const max = daysInMonth(year, month);
  const txs: TxData[] = [];

  const add = (
    code: string | null,
    type: TransactionType,
    desc: string,
    amount: number,
    day: number
  ) => {
    const amt = Math.round(amount * 100) / 100;
    txs.push({
      userId,
      accountId,
      categoryId: code ? (catMap[code] ?? null) : null,
      type,
      description: desc,
      amount: amt,
      currency: "MAD",
      amountMAD: amt,
      exchangeRate: 1,
      occurredAt: dateAt(year, month, day),
      source: TransactionSource.DEMO_SEED,
      aiCategorized: false,
      aiConfidence: null,
      isAnomaly: false,
      importBatchId: null,
    });
  };

  // Salary (1/month, day 1–3)
  add(
    "income-salary",
    TransactionType.INCOME,
    pick(["Virement salaire", "Salaire"]),
    rndAmt(7500, 8500),
    rndInt(1, 3)
  );

  // Freelance (0–1/month)
  if (Math.random() < 0.4) {
    add(
      "income-freelance",
      TransactionType.INCOME,
      pick(["Mission freelance", "Prestation client", "Paiement projet"]),
      rndAmt(500, 2000),
      rndInt(10, 28)
    );
  }

  // Loyer (1/month, day 1–5)
  add(
    "expense-housing",
    TransactionType.EXPENSE,
    pick(["Loyer colocation", "Loyer", "Virement loyer"]),
    rndAmt(2500, 3500),
    rndInt(1, 5)
  );

  // Transfert famille (mid-month)
  add(
    "expense-family",
    TransactionType.EXPENSE,
    pick(["Transfert famille", "Virement famille", "Aide famille"]),
    rndAmt(1000, 1500),
    rndInt(13, 17)
  );

  // Télécom (1/month)
  add(
    "expense-telecom",
    TransactionType.EXPENSE,
    pick(["Recharge Inwi", "Forfait Orange", "Forfait Maroc Telecom"]),
    rndAmt(100, 300),
    rndInt(5, 25)
  );

  // Électricité/eau (1/month)
  add(
    "expense-utilities",
    TransactionType.EXPENSE,
    pick(["Facture Lydec", "Redal", "Facture eau-électricité"]),
    rndAmt(150, 450),
    rndInt(10, 20)
  );

  // Abonnements (0–1/month)
  if (Math.random() < 0.6) {
    add(
      "expense-entertainment",
      TransactionType.EXPENSE,
      pick(["Netflix", "Shahid", "Spotify"]),
      rndAmt(50, 150),
      rndInt(1, 15)
    );
  }

  // Courses (4–6/month)
  const courseCount = rndInt(4, 6);
  const courseLabels = ["Marjane", "Carrefour Market", "Épicerie du coin", "BIM", "Acima"];
  for (let i = 0; i < courseCount; i++) {
    add("expense-food", TransactionType.EXPENSE, pick(courseLabels), rndAmt(150, 600), rndInt(1, max));
  }

  // Café/restaurant (8–14/month)
  const cafeCount = rndInt(8, 14);
  const cafeLabels = ["Café", "Restaurant", "Snack", "Pâtisserie", "Café librairie", "Déjeuner"];
  for (let i = 0; i < cafeCount; i++) {
    add("expense-food", TransactionType.EXPENSE, pick(cafeLabels), rndAmt(20, 150), rndInt(1, max));
  }

  // Transport (10–18/month)
  const transportCount = rndInt(10, 18);
  const transportLabels = ["Taxi", "Careem", "Tramway", "Train ONCF", "Carburant", "InDrive"];
  for (let i = 0; i < transportCount; i++) {
    add("expense-transport", TransactionType.EXPENSE, pick(transportLabels), rndAmt(8, 80), rndInt(1, max));
  }

  // Vêtements (0–2/month)
  const clothingCount = rndInt(0, 2);
  for (let i = 0; i < clothingCount; i++) {
    add(
      "expense-shopping",
      TransactionType.EXPENSE,
      pick(["Zara", "Vêtements", "Chaussures", "H&M"]),
      rndAmt(200, 800),
      rndInt(1, max)
    );
  }

  // Santé (0–1/month)
  if (Math.random() < 0.4) {
    add(
      "expense-health",
      TransactionType.EXPENSE,
      pick(["Pharmacie", "Consultation médecin", "Médicaments"]),
      rndAmt(100, 500),
      rndInt(1, max)
    );
  }

  // Loisirs (0–2/month)
  const loisirCount = rndInt(0, 2);
  for (let i = 0; i < loisirCount; i++) {
    add(
      "expense-entertainment",
      TransactionType.EXPENSE,
      pick(["Cinéma", "Salle de sport", "Sortie", "Bowling"]),
      rndAmt(50, 250),
      rndInt(1, max)
    );
  }

  // Outlier — one large unusual expense (isAnomaly = false so live detection can flag it)
  if (hasOutlier) {
    add(
      "expense-other",
      TransactionType.EXPENSE,
      pick(["Achat ordinateur portable", "Réparation voiture", "Achat téléphone"]),
      rndAmt(3000, 6000),
      rndInt(10, 25)
    );
  }

  return txs;
}

// ─── balance recompute ────────────────────────────────────────────────────────

async function recomputeBalance(accountId: string): Promise<void> {
  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.transaction.aggregate({
      where: { accountId, deletedAt: null, type: TransactionType.INCOME },
      _sum: { amountMAD: true },
    }),
    prisma.transaction.aggregate({
      where: { accountId, deletedAt: null, type: TransactionType.EXPENSE },
      _sum: { amountMAD: true },
    }),
  ]);

  const income = Number(incomeAgg._sum.amountMAD ?? 0);
  const expense = Number(expenseAgg._sum.amountMAD ?? 0);

  await prisma.financialAccount.update({
    where: { id: accountId },
    data: { balance: income - expense },
  });
}

// ─── public API ───────────────────────────────────────────────────────────────

export async function generateDemoData(userId: string, months: 3 | 6): Promise<number> {
  const catMap = await loadCatMap();

  // Get or create primary account
  let account = await prisma.financialAccount.findFirst({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  if (!account) {
    account = await prisma.financialAccount.create({
      data: { userId, name: "Compte principal", type: "BANK", currency: "MAD", balance: 0 },
    });
  }

  const accountId = account.id;

  // Build transactions for each month in the period
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth() + 1; // 1-based

  const outlierMonthIdx = rndInt(0, months - 1);
  const allTxs: TxData[] = [];

  for (let i = 0; i < months; i++) {
    let month = todayMonth - (months - 1 - i);
    let year = todayYear;
    while (month <= 0) {
      month += 12;
      year -= 1;
    }
    allTxs.push(...buildMonthTxs(year, month, userId, accountId, catMap, i === outlierMonthIdx));
  }

  // Atomic: soft-delete existing demo txs + insert new batch
  await prisma.$transaction(async (ptx) => {
    await ptx.transaction.updateMany({
      where: { userId, source: TransactionSource.DEMO_SEED, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await ptx.transaction.createMany({ data: allTxs });
  });

  await recomputeBalance(accountId);

  return allTxs.length;
}

export async function resetDemoData(userId: string): Promise<number> {
  // Collect affected account ids before deleting
  const affected = await prisma.transaction.findMany({
    where: { userId, source: TransactionSource.DEMO_SEED, deletedAt: null },
    select: { accountId: true },
    distinct: ["accountId"],
  });

  const result = await prisma.transaction.updateMany({
    where: { userId, source: TransactionSource.DEMO_SEED, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  for (const { accountId } of affected) {
    await recomputeBalance(accountId);
  }

  return result.count;
}
