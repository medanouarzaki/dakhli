import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { Button } from "@/components/ui/button";

type Props = {
  params: { locale: string };
};

export default async function NewTransactionPage({ params: { locale } }: Props) {
  const t = await getTranslations("Transactions");

  return (
    <div className="min-h-screen bg-muted/40 px-4 py-8">
      <div className="mx-auto max-w-lg space-y-6 text-center">
        <h1 className="text-2xl font-bold">{t("new_page.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("new_page.coming_soon")}</p>
        <Button variant="outline" asChild>
          <Link href={`/${locale}/transactions`}>{t("new_page.back")}</Link>
        </Button>
      </div>
    </div>
  );
}
