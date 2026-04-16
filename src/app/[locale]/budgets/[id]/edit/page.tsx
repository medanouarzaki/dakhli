import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { AppNav } from "@/components/nav/AppNav";
import { BudgetForm } from "@/components/budgets/BudgetForm";
import { Button } from "@/components/ui/button";

type Props = {
  params: { locale: string; id: string };
};

export default async function EditBudgetPage({
  params: { locale, id },
}: Props) {
  const session = await getServerSession(authOptions);
  if (!session) redirect(`/${locale}/login`);

  const t = await getTranslations("Budgets");

  const budget = await prisma.budget.findFirst({
    where: { id, userId: session.user.id, deletedAt: null },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          nameEn: true,
          nameAr: true,
          icon: true,
          color: true,
        },
      },
    },
  });

  if (!budget) notFound();

  const initialValues = {
    categoryId: budget.categoryId,
    amountMAD: Number(budget.amountMAD),
  };

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
            categories={[budget.category]}
            locale={locale}
            mode="edit"
            budgetId={budget.id}
            initialValues={initialValues}
          />
        </div>
      </div>
    </>
  );
}
