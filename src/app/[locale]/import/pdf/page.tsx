import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/nav/AppNav";
import { PdfImportClient } from "./pdf-import-client";

type Props = {
  params: { locale: string };
};

export default async function ImportPdfPage({ params: { locale } }: Props) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect(`/${locale}/login?callbackUrl=/${locale}/import/pdf`);
  }

  const [accounts, t] = await Promise.all([
    prisma.financialAccount.findMany({
      where: { userId: session.user.id, deletedAt: null },
      select: { id: true, name: true, currency: true },
      orderBy: { createdAt: "asc" },
    }),
    getTranslations("ImportPdf"),
  ]);

  return (
    <>
      <AppNav
        locale={locale}
        userName={session.user.name ?? null}
        userEmail={session.user.email!}
      />
      <div className="min-h-[calc(100vh-3.5rem)] bg-muted/40 px-4 py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <h1 className="text-2xl font-bold">{t("page_title")}</h1>
          <PdfImportClient
            accounts={accounts}
            locale={locale as "fr" | "en" | "ar"}
          />
        </div>
      </div>
    </>
  );
}
