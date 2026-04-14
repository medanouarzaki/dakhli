import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { authOptions } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { SignOutButton } from "@/components/sign-out-button";

type Props = {
  params: { locale: string };
};

export default async function DashboardPage({ params: { locale } }: Props) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect(`/${locale}/login`);
  }

  const [tAuth, tTx] = await Promise.all([
    getTranslations("auth"),
    getTranslations("Transactions"),
  ]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-[400px] space-y-4 text-center">
        <h1 className="text-2xl font-bold">
          {tAuth("dashboard.greeting", {
            name: session.user.name ?? session.user.email ?? "",
          })}
        </h1>
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">{tAuth("dashboard.email_label")} : </span>
          {session.user.email}
        </p>
        <div className="flex flex-col gap-2 pt-2">
          <Button asChild variant="outline">
            <Link href={`/${locale}/transactions`}>{tTx("dashboard_link")}</Link>
          </Button>
          <SignOutButton locale={locale} label={tAuth("dashboard.sign_out")} />
        </div>
      </div>
    </div>
  );
}
