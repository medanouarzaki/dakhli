import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "test@dakhli.local" },
  });
  if (!user) {
    console.error("User not found");
    process.exit(1);
  }

  let account = await prisma.financialAccount.findFirst({
    where: { userId: user.id },
  });
  if (!account) {
    account = await prisma.financialAccount.create({
      data: {
        userId: user.id,
        name: "Cash",
        type: "CASH",
        currency: "MAD",
        balance: 0,
      },
    });
    console.log("Created default account for test user");
  }

  const cats = await prisma.category.findMany({
    where: { isSystem: true },
    select: { id: true, code: true },
  });
  const byCode = Object.fromEntries(cats.map((c) => [c.code, c.id]));

  const now = new Date();
  const txs = [
    { code: "income-salary", amount: 8000, type: "INCOME" as const, desc: "Salaire Avril", days: 5 },
    { code: "expense-food", amount: 450, type: "EXPENSE" as const, desc: "Courses Marjane", days: 3 },
    { code: "expense-telecom", amount: 199, type: "EXPENSE" as const, desc: "Inwi mensuel", days: 2 },
    { code: "expense-family", amount: 1000, type: "EXPENSE" as const, desc: "Transfert parents", days: 1 },
  ];

  for (const t of txs) {
    const date = new Date(now);
    date.setDate(date.getDate() - t.days);
    await prisma.transaction.create({
      data: {
        userId: user.id,
        accountId: account.id,
        categoryId: byCode[t.code],
        type: t.type,
        description: t.desc,
        amount: t.amount,
        currency: "MAD",
        amountMAD: t.amount,
        exchangeRate: 1,
        occurredAt: date,
        source: "MANUAL",
      },
    });
  }
  console.log(`Inserted ${txs.length} test transactions for ${user.email}`);
}

main()
  .catch((err: unknown) => {
    console.error("Seed test transactions failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });