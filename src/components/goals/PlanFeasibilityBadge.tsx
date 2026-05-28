"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Feasibility } from "@/lib/ai/types/savings-plan";

type Props = {
  feasibility: Feasibility;
};

const STYLES: Record<Feasibility, string> = {
  EASY: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  REALISTIC: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  STRETCH: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  UNREALISTIC: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export function PlanFeasibilityBadge({ feasibility }: Props) {
  const t = useTranslations("Goals.ai_plan.feasibility_labels");
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STYLES[feasibility]
      )}
    >
      {t(feasibility.toLowerCase() as Parameters<typeof t>[0])}
    </span>
  );
}
