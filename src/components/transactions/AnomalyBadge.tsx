"use client";

import { AlertTriangle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  reason: string | null;
};

export function AnomalyBadge({ reason }: Props) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning cursor-help"
            aria-label={reason ?? "Anomaly"}
          >
            <AlertTriangle className="h-3 w-3" />
            <span>!</span>
          </span>
        </TooltipTrigger>
        {reason && (
          <TooltipContent side="top" className="max-w-xs">
            <p className="text-xs leading-snug">{reason}</p>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  );
}
