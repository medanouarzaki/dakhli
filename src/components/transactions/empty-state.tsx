import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  locale: string;
};

export async function EmptyState({ locale }: Props) {
  const t = await getTranslations("Transactions");

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-card shadow-sm px-6 py-20 text-center">
      <div className="mb-6 rounded-full bg-primary/10 p-3">
        <Wallet className="h-6 w-6 text-primary" />
      </div>
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
