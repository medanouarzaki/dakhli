import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Wallet } from "lucide-react";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeBudgetUsage } from "@/lib/budgets/usage";

import { AppNav } from "@/components/nav/AppNav";
import { BudgetRow } from "@/components/budgets/BudgetRow";
import { Button } from "@/components/ui/button";

type Props = {
  params: { locale: string };
};

export default async function BudgetsPage({ params: { locale } }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations("Budgets");

  const rows = await computeBudgetUsage(prisma, session.user.id, locale);

  return (
    <>
      <AppNav
        locale={locale}
        userName={session.user.name ?? null}
        userEmail={session.user.email!}
      />
      <div className="min-h-[calc(100vh-3.5rem)] bg-muted/40 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold">{t("page_title")}</h1>
            <Button asChild>
              <Link href={`/${locale}/budgets/new`}>{t("cta_new")}</Link>
            </Button>
          </div>

          {rows.length === 0 ? (
            /* Empty state */
            <div className="rounded-xl border bg-card shadow-sm p-12 text-center space-y-4">
              <div className="mx-auto w-fit rounded-full bg-primary/10 p-3">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <p className="font-semibold">{t("empty.title")}</p>
              <p className="text-sm text-muted-foreground">{t("empty.subtitle")}</p>
              <Button asChild>
                <Link href={`/${locale}/budgets/new`}>{t("empty.cta")}</Link>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {rows.map((row) => (
                <BudgetRow key={row.budgetId} budget={row} locale={locale} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
