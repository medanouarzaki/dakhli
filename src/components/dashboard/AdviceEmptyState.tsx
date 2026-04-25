"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  subtitle: string;
  buttonLabel: string;
  onGenerate: () => void;
  disabled: boolean;
};

export function AdviceEmptyState({ title, subtitle, buttonLabel, onGenerate, disabled }: Props) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div className="rounded-full bg-primary/10 p-3">
        <Sparkles className="h-6 w-6 text-primary" />
      </div>
      <h4 className="font-semibold">{title}</h4>
      <p className="text-sm text-muted-foreground max-w-md">{subtitle}</p>
      <Button onClick={onGenerate} disabled={disabled} className="mt-2">
        <Sparkles className="me-2 h-4 w-4" />
        {buttonLabel}
      </Button>
    </div>
  );
}
