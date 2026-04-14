import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { TransactionsList } from "@/components/transactions/transactions-list";
import { EmptyState } from "@/components/transactions/empty-state";

type Props = {
  params: { locale: string };
};

export default async function TransactionsPage({ params: { locale } }: Props) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("Transactions");

  const transactions = await prisma.transaction.findMany({
    where: {
      userId: session.user.id,
      deletedAt: null,
    },
    orderBy: { occurredAt: "desc" },
    include: {
      category: true,
      account: true,
    },
  });

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t("page_title")}</h1>
          <Button asChild>
            <Link href={`/${locale}/transactions/new`}>{t("cta_new")}</Link>
          </Button>
        </div>

        {transactions.length === 0 ? (
          <EmptyState locale={locale} />
        ) : (
          <TransactionsList transactions={transactions} locale={locale} />
        )}
      </div>
    </div>
  );
}
