import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { AppNav } from "@/components/nav/AppNav";
import { ChatInterface } from "@/components/chat/ChatInterface";

type Props = {
  params: { locale: string };
};

export default async function ChatPage({ params: { locale } }: Props) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations({ locale, namespace: "Chat" });

  const rawMessages = await prisma.chatMessage.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      role: true,
      content: true,
      createdAt: true,
    },
  });

  // Serialise dates to ISO strings for client component
  const messages = rawMessages.map((msg) => ({
    ...msg,
    createdAt: msg.createdAt.toISOString(),
  }));

  const suggestions = [
    t("empty.suggestion_1"),
    t("empty.suggestion_2"),
    t("empty.suggestion_3"),
  ];

  return (
    <>
      <AppNav
        locale={locale}
        userName={session.user.name ?? null}
        userEmail={session.user.email!}
      />
      <div className="mx-auto flex max-w-3xl flex-col min-h-[calc(100vh-3.5rem)] px-4 sm:px-6 lg:px-8 py-4">
        <ChatInterface
          initialMessages={messages}
          locale={locale}
          suggestions={suggestions}
        />
      </div>
    </>
  );
}
