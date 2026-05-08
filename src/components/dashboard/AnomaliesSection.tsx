import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { pickLocalizedReason, type Locale } from "@/lib/ai/types/anomaly";
import { AnomaliesClient } from "./AnomaliesClient";

type Props = {
  userId: string;
  locale: Locale;
};

export async function AnomaliesSection({ userId, locale }: Props) {
  const t = await getTranslations("Anomalies");

  const anomalies = await prisma.transaction.findMany({
    where: { userId, deletedAt: null, isAnomaly: true },
    select: {
      id: true,
      description: true,
      amountMAD: true,
      occurredAt: true,
      anomalyReason: true,
      category: { select: { name: true, nameEn: true, nameAr: true, color: true, icon: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: 5,
  });

  const lastScan = await prisma.aiInsight.findFirst({
    where: { userId, type: "ANOMALY" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  const initialAnomalies = anomalies.map((a) => ({
    id: a.id,
    description: a.description,
    amountMAD: Number(a.amountMAD),
    occurredAt: a.occurredAt.toISOString(),
    reason: pickLocalizedReason(a.anomalyReason, locale),
    categoryName: pickCategoryName(a.category, locale),
    categoryColor: a.category?.color ?? null,
    categoryIcon: a.category?.icon ?? null,
  }));

  return (
    <AnomaliesClient
      locale={locale}
      initialAnomalies={initialAnomalies}
      initialLastScanAt={lastScan?.createdAt.toISOString() ?? null}
      labels={{
        sectionTitle: t("section_title"),
        sectionSubtitle: t("section_subtitle"),
        analyzeButton: t("analyze_button"),
        analyzingLabel: t("analyzing"),
        viewAllLink: t("view_all_link"),
        emptyTitle: t("empty.title"),
        emptySubtitle: t("empty.subtitle"),
        lastScanLabel: t("last_scan"),
        errorGeneric: t("errors.generic"),
        errorInsufficient: t("errors.insufficient"),
      }}
    />
  );
}

function pickCategoryName(
  category: { name: string; nameEn: string | null; nameAr: string | null } | null,
  locale: Locale
): string {
  if (!category) return "—";
  if (locale === "ar") return category.nameAr ?? category.name;
  if (locale === "en") return category.nameEn ?? category.name;
  return category.name;
}
