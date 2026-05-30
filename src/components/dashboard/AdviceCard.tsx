"use client";

import * as Lucide from "lucide-react";
import type { AdviceItem } from "@/lib/ai/types/advice";

type Props = {
  item: AdviceItem;
  priorityLabel: string;
};

const PRIORITY_BAR: Record<AdviceItem["priority"], string> = {
  HIGH: "bg-destructive",
  MEDIUM: "bg-warning",
  LOW: "bg-info",
};

const PRIORITY_BADGE: Record<AdviceItem["priority"], string> = {
  HIGH: "bg-destructive/10 text-destructive",
  MEDIUM: "bg-warning/10 text-warning",
  LOW: "bg-info/10 text-info",
};

export function AdviceCard({ item, priorityLabel }: Props) {
  const IconCmp =
    (Lucide as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
      item.icon
    ] ?? Lucide.Sparkles;

  return (
    <div className="relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm">
      <div
        className={`absolute start-0 top-0 h-full w-1 ${PRIORITY_BAR[item.priority]}`}
        aria-hidden="true"
      />
      <div className="ps-2 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <div className="rounded-md bg-muted p-1.5">
              <IconCmp className="h-4 w-4 text-foreground" />
            </div>
            <h4 className="font-semibold leading-tight">{item.title}</h4>
          </div>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${PRIORITY_BADGE[item.priority]}`}
          >
            {priorityLabel}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{item.observation}</p>
        <p className="text-sm">{item.recommendation}</p>
      </div>
    </div>
  );
}
