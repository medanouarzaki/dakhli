import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";

type Props = {
  locale: string;
};

export async function DashboardEmptyState({ locale }: Props) {
  const t = await getTranslations("Dashboard");

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-6 py-20 text-center">
      <div className="mb-6 rounded-full bg-primary/10 p-3">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <h2 className="mb-2 text-xl font-semibold">{t("emptyTitle")}</h2>
      <p className="mb-8 max-w-sm text-sm text-muted-foreground">
        {t("emptyDescription")}
      </p>
      <Button asChild>
        <Link href={`/${locale}/settings`}>{t("emptyCta")}</Link>
      </Button>
    </div>
  );
}
