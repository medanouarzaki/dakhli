import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "@/components/transactions/transaction-form";

type Props = {
  params: { locale: string };
};

export default async function NewTransactionPage({ params: { locale } }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations("Transactions");

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

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6">
        {/* Back link */}
        <Button variant="ghost" size="sm" asChild className="-ms-2">
          <Link href={`/${locale}/transactions`}>← {t("form.back")}</Link>
        </Button>

        {accounts.length === 0 ? (
          /* Defensive: impossible in practice (Cash account created at signup) */
          <div className="rounded-lg border bg-card p-6 text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              Aucun compte disponible.
            </p>
            <Button variant="outline" asChild>
              <Link href={`/${locale}/transactions`}>{t("form.back")}</Link>
            </Button>
          </div>
        ) : (
          <TransactionForm
            accounts={accounts}
            categories={categories}
            locale={locale}
          />
        )}
      </div>
    </div>
  );
}
