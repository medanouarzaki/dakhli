"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { Feasibility } from "@/lib/ai/types/savings-plan";

type Props = {
  feasibility: Feasibility;
};

const STYLES: Record<Feasibility, string> = {
  EASY: "bg-success/10 text-success",
  REALISTIC: "bg-info/10 text-info",
  STRETCH: "bg-warning/10 text-warning",
  UNREALISTIC: "bg-destructive/10 text-destructive",
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
