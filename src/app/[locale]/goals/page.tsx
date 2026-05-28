import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/nav/AppNav";
import { GoalsClient } from "@/components/goals/GoalsClient";

type Props = {
  params: { locale: string };
};

export default async function GoalsPage({ params }: Props) {
  const locale = params.locale as "fr" | "en" | "ar";

  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect(`/${locale}/login`);
  }

  const goals = await prisma.goal.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  const initialGoals = goals.map((g) => ({
    id: g.id,
    title: g.title,
    targetMAD: Number(g.targetMAD),
    currentMAD: Number(g.currentMAD),
    targetDate: g.targetDate?.toISOString() ?? null,
    createdAt: g.createdAt.toISOString(),
  }));

  return (
    <>
      <AppNav
        locale={locale}
        userName={session.user.name ?? null}
        userEmail={session.user.email!}
      />
      <GoalsClient locale={locale} initialGoals={initialGoals} />
    </>
  );
}
