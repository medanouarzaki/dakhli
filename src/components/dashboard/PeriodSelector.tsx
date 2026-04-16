"use client";

import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

import type { PeriodKey } from "@/lib/dashboard/period";

const PERIOD_KEYS: PeriodKey[] = [
  "this_month",
  "last_month",
  "last_3_months",
  "this_year",
  "all",
];

type Props = {
  currentPeriod: PeriodKey;
  locale: string;
};

export function PeriodSelector({ currentPeriod, locale }: Props) {
  const t = useTranslations("Dashboard");
  const router = useRouter();
  const pathname = usePathname();

  const periodLabels: Record<PeriodKey, string> = {
    this_month: t("period.this_month"),
    last_month: t("period.last_month"),
    last_3_months: t("period.last_3_months"),
    this_year: t("period.this_year"),
    all: t("period.all"),
  };

  function handleSelect(key: PeriodKey) {
    const params = new URLSearchParams({ period: key });
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2" lang={locale}>
      {PERIOD_KEYS.map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => handleSelect(key)}
          className={
            key === currentPeriod
              ? "px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground font-medium"
              : "px-3 py-1.5 text-sm rounded-md bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          }
        >
          {periodLabels[key]}
        </button>
      ))}
    </div>
  );
}
