import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { AppNav } from "@/components/nav/AppNav";
import { BudgetForm } from "@/components/budgets/BudgetForm";
import { Button } from "@/components/ui/button";

type Props = {
  params: { locale: string };
};

export default async function NewBudgetPage({ params: { locale } }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations("Budgets");

  const [allExpenseCategories, activeBudgets] = await Promise.all([
    prisma.category.findMany({
      where: {
        OR: [{ userId: session.user.id }, { isSystem: true }],
        type: "EXPENSE",
      },
      select: {
        id: true,
        name: true,
        nameEn: true,
        nameAr: true,
        icon: true,
        color: true,
      },
      orderBy: { name: "asc" },
    }),
    prisma.budget.findMany({
      where: { userId: session.user.id, deletedAt: null, period: "monthly" },
      select: { categoryId: true },
    }),
  ]);

  const budgetedCategoryIds = new Set(activeBudgets.map((b) => b.categoryId));
  const availableCategories = allExpenseCategories.filter(
    (c) => !budgetedCategoryIds.has(c.id)
  );

  return (
    <>
      <AppNav
        locale={locale}
        userName={session.user.name ?? null}
        userEmail={session.user.email!}
      />
      <div className="min-h-[calc(100vh-3.5rem)] bg-muted/40 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-lg space-y-6">
          <Button variant="ghost" size="sm" asChild className="-ms-2">
            <Link href={`/${locale}/budgets`}>← {t("form.back")}</Link>
          </Button>

          <BudgetForm
            categories={availableCategories}
            locale={locale}
            mode="create"
          />
        </div>
      </div>
    </>
  );
}
