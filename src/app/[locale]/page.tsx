import { useTranslations } from "next-intl";
import { setRequestLocale } from "next-intl/server";

type Props = {
  params: { locale: string };
};

export default function HomePage({ params: { locale } }: Props) {
  // Required for static rendering — must be called before useTranslations.
  setRequestLocale(locale);

  const t = useTranslations("HomePage");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">{t("title")}</h1>
      <p className="text-xl text-muted-foreground">{t("subtitle")}</p>
      <p className="text-lg">{t("welcome")}</p>
    </main>
  );
}
