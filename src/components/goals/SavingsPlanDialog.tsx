"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Sparkles, RotateCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  pickLocalizedText,
  pickLeverAdvice,
  type Locale,
  type SavingsPlan,
} from "@/lib/ai/types/savings-plan";
import type { GoalDTO } from "./GoalsClient";
import { PlanFeasibilityBadge } from "./PlanFeasibilityBadge";

type Props = {
  goal: GoalDTO | null;
  locale: Locale;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type DialogState =
  | { kind: "idle" }
  | { kind: "fetching" }
  | { kind: "no_plan" }
  | { kind: "has_plan"; plan: SavingsPlan; generatedAt: string }
  | { kind: "generating" }
  | { kind: "error"; messageKey: "goal_not_found" | "goal_achieved" | "goal_overdue" | "generic" };

export function SavingsPlanDialog({ goal, locale, open, onOpenChange }: Props) {
  const t = useTranslations("Goals.ai_plan");
  const [state, setState] = useState<DialogState>({ kind: "idle" });

  useEffect(() => {
    if (!open || !goal) {
      setState({ kind: "idle" });
      return;
    }
    let cancelled = false;
    (async () => {
      setState({ kind: "fetching" });
      try {
        const res = await fetch(
          `/api/ai/savings-plans?goalId=${encodeURIComponent(goal.id)}`,
          { credentials: "include" }
        );
        if (cancelled) return;
        if (!res.ok) {
          setState({ kind: "error", messageKey: "generic" });
          return;
        }
        const data = await res.json() as { ok: boolean; plan: SavingsPlan | null; generatedAt?: string };
        if (data.plan && data.generatedAt) {
          setState({ kind: "has_plan", plan: data.plan, generatedAt: data.generatedAt });
        } else {
          setState({ kind: "no_plan" });
        }
      } catch {
        if (!cancelled) setState({ kind: "error", messageKey: "generic" });
      }
    })();
    return () => { cancelled = true; };
  }, [open, goal]);

  async function generate() {
    if (!goal) return;
    setState({ kind: "generating" });
    try {
      const res = await fetch("/api/ai/savings-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goalId: goal.id, locale }),
        credentials: "include",
      });
      const data = await res.json() as { ok?: boolean; plan?: SavingsPlan; generatedAt?: string; error?: string };
      if (res.status === 422) {
        const messageKey =
          data.error === "GOAL_ALREADY_ACHIEVED"
            ? "goal_achieved"
            : data.error === "GOAL_OVERDUE"
            ? "goal_overdue"
            : "generic";
        setState({ kind: "error", messageKey });
        return;
      }
      if (!res.ok || !data.plan) {
        setState({ kind: "error", messageKey: "generic" });
        return;
      }
      setState({ kind: "has_plan", plan: data.plan, generatedAt: data.generatedAt! });
      toast.success(t("success_generated"));
    } catch {
      setState({ kind: "error", messageKey: "generic" });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-warning" />
            {t("title")}
          </DialogTitle>
          {goal && (
            <DialogDescription>{goal.title}</DialogDescription>
          )}
        </DialogHeader>

        {state.kind === "fetching" && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {state.kind === "no_plan" && (
          <NoPlanView
            onGenerate={generate}
            labels={{
              title: t("empty.title"),
              subtitle: t("empty.subtitle"),
              cta: t("empty.cta"),
            }}
          />
        )}

        {state.kind === "generating" && (
          <GeneratingView
            labels={{
              title: t("generating.title"),
              reassurance: t("generating.reassurance"),
              step1: t("generating.step1"),
              step2: t("generating.step2"),
              step3: t("generating.step3"),
            }}
          />
        )}

        {state.kind === "has_plan" && (
          <PlanView
            plan={state.plan}
            locale={locale}
            generatedAt={state.generatedAt}
            labels={{
              monthlyTarget: t("plan.monthly_target"),
              monthsRemaining: t("plan.months_remaining"),
              feasibility: t("plan.feasibility"),
              leversTitle: t("plan.levers_title"),
              currentSpend: t("plan.current_spend"),
              suggestedSpend: t("plan.suggested_spend"),
              savings: t("plan.potential_savings"),
              summaryTitle: t("plan.summary_title"),
              generatedOn: t("plan.generated_on"),
              regenerate: t("plan.regenerate"),
            }}
            onRegenerate={generate}
          />
        )}

        {state.kind === "error" && (
          <div className="py-6 text-center space-y-3">
            <p className="text-sm text-destructive">{t(`errors.${state.messageKey}` as Parameters<typeof t>[0])}</p>
            <Button variant="outline" size="sm" onClick={() => setState({ kind: "no_plan" })}>
              {t("errors.retry")}
            </Button>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-views ────────────────────────────────────────────────────────────────

function NoPlanView({
  onGenerate,
  labels,
}: {
  onGenerate: () => void;
  labels: { title: string; subtitle: string; cta: string };
}) {
  return (
    <div className="py-8 text-center space-y-4">
      <div className="mx-auto rounded-full bg-warning/10 p-3 w-fit">
        <Sparkles className="h-6 w-6 text-warning" />
      </div>
      <div>
        <h3 className="font-semibold">{labels.title}</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">{labels.subtitle}</p>
      </div>
      <Button onClick={onGenerate}>
        <Sparkles className="me-2 h-4 w-4" />
        {labels.cta}
      </Button>
    </div>
  );
}

function GeneratingView({
  labels,
}: {
  labels: { title: string; reassurance: string; step1: string; step2: string; step3: string };
}) {
  return (
    <div className="py-8 text-center space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-warning mx-auto" />
      <h3 className="font-semibold">{labels.title}</h3>
      <p className="text-xs text-muted-foreground">{labels.reassurance}</p>
      <ul className="text-sm text-muted-foreground space-y-1">
        <li>· {labels.step1}</li>
        <li>· {labels.step2}</li>
        <li>· {labels.step3}</li>
      </ul>
    </div>
  );
}

function formatMAD(amount: number, locale: Locale): string {
  const n = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
  const label = locale === "ar" ? "د.م." : "MAD";
  return `${n} ${label}`;
}

function PlanView({
  plan,
  locale,
  generatedAt,
  labels,
  onRegenerate,
}: {
  plan: SavingsPlan;
  locale: Locale;
  generatedAt: string;
  labels: {
    monthlyTarget: string;
    monthsRemaining: string;
    feasibility: string;
    leversTitle: string;
    currentSpend: string;
    suggestedSpend: string;
    savings: string;
    summaryTitle: string;
    generatedOn: string;
    regenerate: string;
  };
  onRegenerate: () => void;
}) {
  const dateFmt = new Date(generatedAt).toLocaleDateString(
    locale === "ar" ? "ar-MA" : locale === "en" ? "en-US" : "fr-FR",
    { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }
  );

  return (
    <div className="space-y-5">
      {/* Top stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card shadow-sm p-3 text-center">
          <p className="text-xs text-muted-foreground">{labels.monthlyTarget}</p>
          <p className="text-xl font-semibold mt-1">{formatMAD(plan.monthlyTargetMAD, locale)}</p>
        </div>
        <div className="rounded-xl border bg-card shadow-sm p-3 text-center">
          <p className="text-xs text-muted-foreground">{labels.monthsRemaining}</p>
          <p className="text-xl font-semibold mt-1">{plan.monthsRemaining}</p>
        </div>
        <div className="rounded-xl border bg-card shadow-sm p-3 text-center">
          <p className="text-xs text-muted-foreground">{labels.feasibility}</p>
          <div className="mt-1 flex justify-center">
            <PlanFeasibilityBadge feasibility={plan.feasibility} />
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-lg border-s-4 border-s-warning bg-warning/5 p-4">
        <h4 className="text-sm font-semibold mb-1">{labels.summaryTitle}</h4>
        <p className="text-sm leading-relaxed">{pickLocalizedText(plan.summary, locale)}</p>
      </div>

      {/* Levers */}
      {plan.leversByCategory.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">{labels.leversTitle}</h4>
          <div className="space-y-2">
            {plan.leversByCategory.map((lever, i) => (
              <div key={i} className="rounded-xl border bg-card shadow-sm p-3 space-y-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{lever.categoryName}</span>
                  <span className="text-sm font-semibold text-success">
                    −{formatMAD(lever.potentialSavingsMAD, locale)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {labels.currentSpend}: {formatMAD(lever.currentMonthlyMAD, locale)} → {labels.suggestedSpend}: {formatMAD(lever.suggestedMonthlyMAD, locale)}
                </p>
                <p className="text-sm">{pickLeverAdvice(lever, locale)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2">
        <span>{labels.generatedOn} {dateFmt}</span>
        <Button variant="outline" size="sm" onClick={onRegenerate}>
          <RotateCw className="me-2 h-3 w-3" />
          {labels.regenerate}
        </Button>
      </div>
    </div>
  );
}
