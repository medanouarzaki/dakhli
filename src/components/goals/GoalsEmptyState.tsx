"use client";

import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  subtitle: string;
  cta: string;
  onCreateClick: () => void;
};

export function GoalsEmptyState({ title, subtitle, cta, onCreateClick }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-xl border bg-card shadow-sm p-12 text-center">
      <div className="rounded-full bg-primary/10 p-3">
        <Target className="h-6 w-6 text-primary" />
      </div>
      <div className="space-y-1">
        <h4 className="font-semibold">{title}</h4>
        <p className="text-sm text-muted-foreground max-w-md">{subtitle}</p>
      </div>
      <Button onClick={onCreateClick}>{cta}</Button>
    </div>
  );
}
