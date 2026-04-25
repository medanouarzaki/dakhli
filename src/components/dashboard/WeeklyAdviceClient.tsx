"use client";

import { useState } from "react";
import { Sparkles, MoreVertical, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AdviceItem } from "@/lib/ai/types/advice";

import { AdviceCard } from "./AdviceCard";
import { AdviceEmptyState } from "./AdviceEmptyState";
import { AdviceLoading } from "./AdviceLoading";

type Labels = {
  sectionTitle: string;
  sectionSubtitle: string;
  generateButton: string;
  regenerateButton: string;
  forceRegenerate: string;
  cooldownLabel: string;
  emptyTitle: string;
  emptySubtitle: string;
  loadingTitle: string;
  loadingReassurance: string;
  loadingStep1: string;
  loadingStep2: string;
  loadingStep3: string;
  errorGeneric: string;
  errorInsufficientData: string;
  errorCooldown: string;
  priorityHigh: string;
  priorityMedium: string;
  priorityLow: string;
};

type Props = {
  locale: "fr" | "en" | "ar";
  initialItems: AdviceItem[];
  initialGeneratedAt: string | null;
  initialCooldownUntil: string | null;
  labels: Labels;
};

export function WeeklyAdviceClient({
  locale,
  initialItems,
  initialGeneratedAt,
  initialCooldownUntil,
  labels,
}: Props) {
  const [items, setItems] = useState<AdviceItem[]>(initialItems);
  const [generatedAt, setGeneratedAt] = useState<string | null>(initialGeneratedAt);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(initialCooldownUntil);
  const [isLoading, setIsLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const isInCooldown =
    cooldownUntil !== null && new Date(cooldownUntil).getTime() > Date.now();

  async function generate(force: boolean) {
    setIsLoading(true);
    setMenuOpen(false);

    try {
      const res = await fetch("/api/ai/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, force }),
        credentials: "include",
      });

      if (res.status === 429) {
        const data = await res.json();
        toast.error(labels.errorCooldown);
        if (data.cooldownUntil) setCooldownUntil(data.cooldownUntil);
        return;
      }
      if (res.status === 422) {
        toast.error(labels.errorInsufficientData);
        return;
      }
      if (!res.ok) {
        toast.error(labels.errorGeneric);
        return;
      }

      const data = await res.json();
      setItems(data.items);
      setGeneratedAt(data.generatedAt);
      setCooldownUntil(data.cooldownUntil);
    } catch {
      toast.error(labels.errorGeneric);
    } finally {
      setIsLoading(false);
    }
  }

  const cooldownLabel = (() => {
    if (!cooldownUntil) return null;
    const d = new Date(cooldownUntil);
    return d.toLocaleDateString(
      locale === "ar" ? "ar-MA" : locale === "en" ? "en-US" : "fr-FR",
      { day: "numeric", month: "long" }
    );
  })();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {labels.sectionTitle}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{labels.sectionSubtitle}</p>
          </div>

          {items.length > 0 && (
            <div className="relative">
              <button
                aria-label="Menu"
                onClick={() => setMenuOpen((o) => !o)}
                className="rounded-md p-1.5 hover:bg-muted"
                type="button"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div className="absolute end-0 mt-1 w-56 rounded-md border bg-popover shadow-md z-10 text-sm">
                  <button
                    type="button"
                    onClick={() => generate(true)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-start hover:bg-muted"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    {labels.forceRegenerate}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <AdviceLoading
            title={labels.loadingTitle}
            reassurance={labels.loadingReassurance}
            step1={labels.loadingStep1}
            step2={labels.loadingStep2}
            step3={labels.loadingStep3}
          />
        ) : items.length === 0 ? (
          <AdviceEmptyState
            title={labels.emptyTitle}
            subtitle={labels.emptySubtitle}
            buttonLabel={labels.generateButton}
            onGenerate={() => generate(false)}
            disabled={isInCooldown}
          />
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((it, i) => (
                <AdviceCard
                  key={i}
                  item={it}
                  priorityLabel={
                    it.priority === "HIGH"
                      ? labels.priorityHigh
                      : it.priority === "MEDIUM"
                      ? labels.priorityMedium
                      : labels.priorityLow
                  }
                />
              ))}
            </div>

            {generatedAt && (
              <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
                <span>
                  {new Date(generatedAt).toLocaleDateString(
                    locale === "ar" ? "ar-MA" : locale === "en" ? "en-US" : "fr-FR",
                    { day: "numeric", month: "long", year: "numeric" }
                  )}
                </span>
                {isInCooldown && cooldownLabel ? (
                  <span>
                    {labels.cooldownLabel} {cooldownLabel}
                  </span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => generate(false)}
                    disabled={isLoading}
                  >
                    {labels.regenerateButton}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
