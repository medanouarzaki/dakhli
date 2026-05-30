"use client";

import { ShieldCheck } from "lucide-react";

type Props = {
  title: string;
  subtitle: string;
};

export function AnomaliesEmptyState({ title, subtitle }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="rounded-full bg-success/10 p-3">
        <ShieldCheck className="h-6 w-6 text-success" />
      </div>
      <h4 className="font-semibold">{title}</h4>
      <p className="text-sm text-muted-foreground max-w-md">{subtitle}</p>
    </div>
  );
}
