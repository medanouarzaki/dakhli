import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { AdviceResponseSchema, type AdviceItem } from "@/lib/ai/types/advice";
import { WeeklyAdviceClient } from "./WeeklyAdviceClient";

type Props = {
  userId: string;
  locale: "fr" | "en" | "ar";
};

export async function WeeklyAdviceSection({ userId, locale }: Props) {
  const t = await getTranslations("Advice");

  const latest = await prisma.aiInsight.findFirst({
    where: { userId, type: "ADVICE", title: `WEEKLY_ADVICE:${locale}` },
    orderBy: { createdAt: "desc" },
  });

  let initialItems: AdviceItem[] = [];
  let initialGeneratedAt: string | null = null;
  let initialCooldownUntil: string | null = null;

  if (latest) {
    const payload = latest.payload as { items?: unknown } | null;
    const parsed = AdviceResponseSchema.shape.items.safeParse(payload?.items);
    if (parsed.success) {
      initialItems = parsed.data;
      initialGeneratedAt = latest.createdAt.toISOString();
      const cd = new Date(latest.createdAt);
      cd.setDate(cd.getDate() + 6);
      initialCooldownUntil = cd.toISOString();
    }
  }

  return (
    <WeeklyAdviceClient
      locale={locale}
      initialItems={initialItems}
      initialGeneratedAt={initialGeneratedAt}
      initialCooldownUntil={initialCooldownUntil}
      labels={{
        sectionTitle: t("section_title"),
        sectionSubtitle: t("section_subtitle"),
        generateButton: t("generate_button"),
        regenerateButton: t("regenerate_button"),
        forceRegenerate: t("force_regenerate"),
        cooldownLabel: t("cooldown_label"),
        emptyTitle: t("empty.title"),
        emptySubtitle: t("empty.subtitle"),
        loadingTitle: t("loading.title"),
        loadingReassurance: t("loading.reassurance"),
        loadingStep1: t("loading.step1"),
        loadingStep2: t("loading.step2"),
        loadingStep3: t("loading.step3"),
        errorGeneric: t("errors.generic"),
        errorInsufficientData: t("errors.insufficient_data"),
        errorCooldown: t("errors.cooldown"),
        priorityHigh: t("priority.high"),
        priorityMedium: t("priority.medium"),
        priorityLow: t("priority.low"),
      }}
    />
  );
}
