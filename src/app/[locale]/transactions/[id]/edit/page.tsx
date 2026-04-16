import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { AppNav } from "@/components/nav/AppNav";
import { TransactionForm } from "@/components/transactions/transaction-form";

type Props = {
  params: { locale: string; id: string };
};

export default async function EditTransactionPage({
  params: { locale, id },
}: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations("Transactions");

  const tx = await prisma.transaction.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
    select: {
      id: true,
      type: true,
      accountId: true,
      categoryId: true,
      description: true,
      amount: true,
      occurredAt: true,
    },
  });

  if (!tx) notFound();

  // TRANSFER editing not supported in T5
  if (tx.type !== "INCOME" && tx.type !== "EXPENSE") notFound();

  const [accounts, categories] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { userId: session.user.id, deletedAt: null },
      select: { id: true, name: true, type: true, currency: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.category.findMany({
      where: {
        OR: [{ userId: session.user.id }, { isSystem: true }],
      },
      select: {
        id: true,
        name: true,
        nameEn: true,
        nameAr: true,
        type: true,
        icon: true,
        color: true,
        code: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const initialValues = {
    type: tx.type as "INCOME" | "EXPENSE",
    accountId: tx.accountId,
    categoryId: tx.categoryId,
    description: tx.description,
    amount: Number(tx.amount),
    occurredAt: tx.occurredAt.toISOString().split("T")[0],
  };

  return (
    <>
      <AppNav
        locale={locale}
        userName={session.user.name ?? null}
        userEmail={session.user.email!}
      />
      <div className="min-h-[calc(100vh-3.5rem)] bg-muted/40 px-4 py-8">
        <div className="mx-auto max-w-lg space-y-6">
          <Button variant="ghost" size="sm" asChild className="-ms-2">
            <Link href={`/${locale}/transactions`}>← {t("form.back")}</Link>
          </Button>

          <TransactionForm
            accounts={accounts}
            categories={categories}
            locale={locale}
            mode="edit"
            transactionId={tx.id}
            initialValues={initialValues}
          />
        </div>
      </div>
    </>
  );
}
