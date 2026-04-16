import Link from "next/link";
import { PieChart } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

type Props = {
  locale: string;
};

export async function DashboardEmptyState({ locale }: Props) {
  const t = await getTranslations("Dashboard");

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-6 py-20 text-center">
      <PieChart
        size={48}
        strokeWidth={1.5}
        className="mb-6 text-muted-foreground"
      />
      <h2 className="mb-2 text-xl font-semibold">{t("empty.title")}</h2>
      <p className="mb-8 max-w-sm text-sm text-muted-foreground">
        {t("empty.subtitle")}
      </p>
      <Button asChild>
        <Link href={`/${locale}/transactions/new`}>{t("empty.cta")}</Link>
      </Button>
    </div>
  );
}
