import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { authOptions } from "@/lib/auth";
import { SignOutButton } from "@/components/sign-out-button";

type Props = {
  params: { locale: string };
};

export default async function DashboardPage({ params: { locale } }: Props) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("auth");

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-[400px] space-y-4 text-center">
        <h1 className="text-2xl font-bold">
          {t("dashboard.greeting", {
            name: session.user.name ?? session.user.email ?? "",
          })}
        </h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">{t("dashboard.email_label")} : </span>
          {session.user.email}
        </p>
        <SignOutButton locale={locale} label={t("dashboard.sign_out")} />
      </div>
    </div>
  );
}
