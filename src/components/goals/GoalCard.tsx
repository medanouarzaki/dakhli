"use client";

import { useTranslations } from "next-intl";
import { Pencil, Trash2, PlusCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { GoalDTO } from "./GoalsClient";

type Props = {
  goal: GoalDTO;
  locale: string;
  onAddProgress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPlanClick: () => void;
};

function formatAmount(value: number, locale: string): string {
  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
  const currency = locale === "ar" ? "د.م." : "MAD";
  return `${formatted} ${currency}`;
}

function formatTargetDate(isoDate: string | null, locale: string): string {
  if (!isoDate) return "—";
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(
    new Date(isoDate)
  );
}

function getDaysRemaining(isoDate: string | null): number | null {
  if (!isoDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(isoDate);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function GoalCard({ goal, locale, onAddProgress, onEdit, onDelete, onPlanClick }: Props) {
  const t = useTranslations("Goals");

  const percent = goal.targetMAD > 0
    ? Math.min(100, (goal.currentMAD / goal.targetMAD) * 100)
    : 0;
  const achieved = goal.currentMAD >= goal.targetMAD && goal.targetMAD > 0;
  const daysRemaining = getDaysRemaining(goal.targetDate);
  const overdue = daysRemaining !== null && daysRemaining < 0 && !achieved;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <span className="font-medium leading-snug">{goal.title}</span>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={onAddProgress}
              title={t("card.add_progress")}
            >
              <PlusCircle className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={onEdit}
              title={t("card.edit")}
            >
              <Pencil className="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              title={t("card.delete")}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Amounts */}
        <div className="flex items-center justify-between text-sm">
          <span className="tabular-nums">
            {formatAmount(goal.currentMAD, locale)}{" "}
            <span className="text-muted-foreground">{t("card.of_target")}</span>{" "}
            {formatAmount(goal.targetMAD, locale)}
          </span>
          <span className="font-semibold tabular-nums">{Math.round(percent)}%</span>
        </div>

        {/* Progress bar */}
        <Progress value={percent} className="h-2" />

        {/* Footer: date + status */}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{formatTargetDate(goal.targetDate, locale)}</span>
          {achieved ? (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-success font-medium">
              {t("card.achieved")}
            </span>
          ) : overdue ? (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive font-medium">
              {t("card.overdue")}
            </span>
          ) : daysRemaining !== null ? (
            <span>
              {t("card.remaining_days", { count: daysRemaining })}
            </span>
          ) : null}
        </div>

        {/* AI Plan action */}
        <Button
          variant="outline"
          size="sm"
          onClick={onPlanClick}
          className="w-full text-warning border-warning/30 hover:bg-warning/5"
        >
          <Sparkles className="me-1.5 h-3.5 w-3.5" />
          {t("card.ai_plan")}
        </Button>
      </CardContent>
    </Card>
  );
}
