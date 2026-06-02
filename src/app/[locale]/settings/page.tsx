import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { authOptions } from "@/lib/auth";
import { AppNav } from "@/components/nav/AppNav";
import { DemoDataCard } from "@/components/settings/DemoDataCard";

type Props = {
  params: { locale: string };
};

export default async function SettingsPage({ params: { locale } }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("Settings");

  return (
    <>
      <AppNav
        locale={locale}
        userName={session.user.name ?? null}
        userEmail={session.user.email!}
      />
      <div className="min-h-screen bg-muted/40 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <DemoDataCard />
        </div>
      </div>
    </>
  );
}
