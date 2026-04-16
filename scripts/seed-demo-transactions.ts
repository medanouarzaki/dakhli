// ─── Demo transaction seed for test@dakhli.local ─────────────────────────────
// Generates ~6 months of realistic Moroccan household finances.
// Safe to re-run: hard-deletes existing DEMO_SEED rows first.
//
// Usage:
//   npx ts-node --compiler-options '{"module":"commonjs","esModuleInterop":true}' \
//     scripts/seed-demo-transactions.ts

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** UTC date at midnight for the given y/m (0-based)/d */
function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

/** Jitter ±jitter days around a base date */
function jitter(base: Date, days: number): Date {
  const offset = Math.floor((Math.random() * 2 - 1) * days) * 86400000;
  return new Date(base.getTime() + offset);
}

/** Vary an amount by ±pct percent */
function vary(base: number, pct: number): number {
  return Math.round(base * (1 + (Math.random() * 2 - 1) * pct));
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const USER_EMAIL = "test@dakhli.local";

  // 1. Find user
  const user = await prisma.user.findUnique({ where: { email: USER_EMAIL } });
  if (!user) {
    console.error(`User ${USER_EMAIL} not found. Create the account first.`);
    process.exit(1);
  }

  // 2. Hard-delete existing DEMO_SEED transactions
  const deleted = await prisma.transaction.deleteMany({
    where: { userId: user.id, source: "DEMO_SEED" },
  });
  console.log(`Deleted ${deleted.count} existing DEMO_SEED transactions.`);

  // 3. Get (or create) financial account
  let account = await prisma.financialAccount.findFirst({
    where: { userId: user.id, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
  if (!account) {
    account = await prisma.financialAccount.create({
      data: {
        userId: user.id,
        name: "CIH Courant",
        type: "BANK",
        currency: "MAD",
        balance: 0,
      },
    });
    console.log("Created default account.");
  }
  console.log(`Using account: ${account.name} (${account.id})`);

  // 4. Load system categories
  const cats = await prisma.category.findMany({
    where: { isSystem: true },
    select: { id: true, code: true },
  });
  const cat = Object.fromEntries(
    cats.map((c) => [c.code as string, c.id])
  ) as Record<string, string>;

  // Verify required categories are present
  const required = [
    "income-salary", "income-freelance",
    "expense-food", "expense-housing", "expense-telecom", "expense-family",
    "expense-transport", "expense-health", "expense-zakat",
    "expense-entertainment", "expense-shopping", "expense-utilities",
  ];
  for (const code of required) {
    if (!cat[code]) {
      console.warn(`⚠  Category not found: ${code} — related transactions will be uncategorised`);
    }
  }

  // ─── Transaction template ─────────────────────────────────────────────────
  type TxTemplate = {
    type: "INCOME" | "EXPENSE";
    categoryCode: string | null;
    amount: number;
    description: string;
    occurredAt: Date;
  };

  const txTemplates: TxTemplate[] = [];

  // Rolling window: today (2026-04-15) minus 6 months → October 2025
  const today = new Date();
  const startYear = today.getUTCFullYear();
  const startMonth = today.getUTCMonth(); // 0-based; today is April = 3

  // Iterate 6 months back (inclusive of current partial month)
  for (let i = 5; i >= 0; i--) {
    // month offset: i=5 → 6 months ago, i=0 → current month
    const y = startYear + Math.floor((startMonth - i) / 12);
    const m = ((startMonth - i) % 12 + 12) % 12;

    const monthStart = utc(y, m, 1);
    const isCurrentMonth = i === 0;

    // ── INCOME ──────────────────────────────────────────────────────────────

    // Monthly salary on 3rd (±1 day)
    txTemplates.push({
      type: "INCOME",
      categoryCode: "income-salary",
      amount: vary(9500, 0.03), // ~9 500 MAD/month (some variation)
      description: "Salaire mensuel",
      occurredAt: jitter(utc(y, m, 3), 1),
    });

    // Freelance income — roughly every other month
    if (m % 2 === 0) {
      txTemplates.push({
        type: "INCOME",
        categoryCode: "income-freelance",
        amount: vary(2200, 0.2),
        description: "Mission freelance",
        occurredAt: jitter(utc(y, m, 12), 3),
      });
    }

    // ── FIXED MONTHLY EXPENSES ───────────────────────────────────────────────

    // Rent on 5th (±1)
    txTemplates.push({
      type: "EXPENSE",
      categoryCode: "expense-housing",
      amount: 3200,
      description: "Loyer",
      occurredAt: jitter(utc(y, m, 5), 1),
    });

    // Telecom — inwi/orange monthly pack on 8th (±1)
    txTemplates.push({
      type: "EXPENSE",
      categoryCode: "expense-telecom",
      amount: vary(199, 0.05),
      description: "Forfait mensuel Inwi",
      occurredAt: jitter(utc(y, m, 8), 1),
    });

    // Utilities (eau/électricité) on 15th (±2)
    txTemplates.push({
      type: "EXPENSE",
      categoryCode: "expense-utilities",
      amount: vary(320, 0.15),
      description: "ONEE facture",
      occurredAt: jitter(utc(y, m, 15), 2),
    });

    // Family transfer on 10th (±2)
    txTemplates.push({
      type: "EXPENSE",
      categoryCode: "expense-family",
      amount: vary(1200, 0.1),
      description: "Virement famille",
      occurredAt: jitter(utc(y, m, 10), 2),
    });

    // ── FOOD — weekly ────────────────────────────────────────────────────────
    const foodDays = [4, 11, 18, 25];
    const foodDescs = [
      "Courses Marjane", "Courses Carrefour", "Souk légumes", "Acima Market",
    ];
    foodDays.forEach((day, idx) => {
      const d = utc(y, m, day);
      // Skip future dates if we're in the current month
      if (isCurrentMonth && d > today) return;
      txTemplates.push({
        type: "EXPENSE",
        categoryCode: "expense-food",
        amount: vary(280, 0.25),
        description: foodDescs[idx],
        occurredAt: jitter(d, 1),
      });
    });

    // ── TRANSPORT — twice/week (approx) ─────────────────────────────────────
    const transportDays = [2, 6, 9, 13, 16, 20, 23, 27];
    transportDays.forEach((day) => {
      const d = utc(y, m, day);
      if (isCurrentMonth && d > today) return;
      txTemplates.push({
        type: "EXPENSE",
        categoryCode: "expense-transport",
        amount: vary(25, 0.4),
        description: "Grand taxi / bus",
        occurredAt: jitter(d, 1),
      });
    });

    // ── HEALTH — once or twice a month ──────────────────────────────────────
    if (Math.random() > 0.4) {
      const healthD = utc(y, m, Math.floor(Math.random() * 26) + 2);
      if (!isCurrentMonth || healthD <= today) {
        txTemplates.push({
          type: "EXPENSE",
          categoryCode: "expense-health",
          amount: vary(180, 0.5),
          description: "Pharmacie / consultation",
          occurredAt: healthD,
        });
      }
    }

    // ── ZAKAT — once per quarter (in m=0,3,6,9 i.e. Jan/Apr/Jul/Oct) ────────
    if ([0, 3, 6, 9].includes(m)) {
      const zakatD = utc(y, m, 20);
      if (!isCurrentMonth || zakatD <= today) {
        txTemplates.push({
          type: "EXPENSE",
          categoryCode: "expense-zakat",
          amount: vary(500, 0.2),
          description: "Zakat / Sadaqa",
          occurredAt: zakatD,
        });
      }
    }

    // ── ENTERTAINMENT — 1–2 times a month ───────────────────────────────────
    const entDays = [7, 21];
    entDays.forEach((day) => {
      if (Math.random() > 0.5) {
        const d = utc(y, m, day);
        if (isCurrentMonth && d > today) return;
        txTemplates.push({
          type: "EXPENSE",
          categoryCode: "expense-entertainment",
          amount: vary(120, 0.4),
          description: "Cinéma / restaurant / café",
          occurredAt: jitter(d, 2),
        });
      }
    });

    // ── SHOPPING — 1–3 times a month ────────────────────────────────────────
    const shopDays = [14, 22];
    shopDays.forEach((day) => {
      if (Math.random() > 0.45) {
        const d = utc(y, m, day);
        if (isCurrentMonth && d > today) return;
        txTemplates.push({
          type: "EXPENSE",
          categoryCode: "expense-shopping",
          amount: vary(350, 0.5),
          description: "Vêtements / accessoires",
          occurredAt: jitter(d, 2),
        });
      }
    });
  }

  // 5. Insert all transactions
  console.log(`Inserting ${txTemplates.length} demo transactions…`);

  let inserted = 0;
  for (const t of txTemplates) {
    const catId = t.categoryCode ? (cat[t.categoryCode] ?? null) : null;
    await prisma.transaction.create({
      data: {
        userId: user.id,
        accountId: account.id,
        categoryId: catId,
        type: t.type,
        description: t.description,
        amount: t.amount,
        currency: "MAD",
        amountMAD: t.amount,
        exchangeRate: 1,
        occurredAt: t.occurredAt,
        source: "DEMO_SEED",
      },
    });
    inserted++;
  }

  console.log(`✓  Seeded ${inserted} transactions for ${USER_EMAIL}.`);
  console.log("   Re-run at any time to reset demo data.");
}

main()
  .catch((err: unknown) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
