"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { GoalCard } from "./GoalCard";
import { GoalForm } from "./GoalForm";
import { GoalsEmptyState } from "./GoalsEmptyState";
import { AddProgressDialog } from "./AddProgressDialog";
import { DeleteGoalDialog } from "./DeleteGoalDialog";
import { SavingsPlanDialog } from "./SavingsPlanDialog";
import { SavingsPlanCard, type SavingsPlanData } from "./SavingsPlanCard";
import type { Locale } from "@/lib/ai/types/savings-plan";

export type GoalDTO = {
  id: string;
  title: string;
  targetMAD: number;
  currentMAD: number;
  targetDate: string | null;
  createdAt: string;
};

type Props = {
  locale: Locale;
  initialGoals: GoalDTO[];
  initialPlans: Record<string, SavingsPlanData>;
};

export function GoalsClient({ locale, initialGoals, initialPlans }: Props) {
  const t = useTranslations("Goals");
  const [goals, setGoals] = useState<GoalDTO[]>(initialGoals);
  const [createOpen, setCreateOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalDTO | null>(null);
  const [deletingGoal, setDeletingGoal] = useState<GoalDTO | null>(null);
  const [addingProgressGoal, setAddingProgressGoal] = useState<GoalDTO | null>(null);
  const [planGoal, setPlanGoal] = useState<GoalDTO | null>(null);

  async function refetchGoals() {
    try {
      const res = await fetch("/api/goals");
      if (!res.ok) return;
      const data = (await res.json()) as { ok: boolean; goals: GoalDTO[] };
      if (data.ok) setGoals(data.goals);
    } catch {
      // silently ignore network errors on refetch
    }
  }

  async function handleCreate(values: { title: string; targetMAD: number; targetDate: string }) {
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success(t("success.created"));
      setCreateOpen(false);
      await refetchGoals();
    } else {
      toast.error(t("errors.create_failed"));
    }
  }

  async function handleEdit(id: string, values: Partial<{ title: string; targetMAD: number; targetDate: string }>) {
    const res = await fetch(`/api/goals/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    if (res.ok) {
      toast.success(t("success.updated"));
      setEditingGoal(null);
      await refetchGoals();
    } else {
      toast.error(t("errors.update_failed"));
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/goals/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success(t("success.deleted"));
      setDeletingGoal(null);
      await refetchGoals();
    } else {
      toast.error(t("errors.delete_failed"));
    }
  }

  async function handleAddProgress(id: string, amountMAD: number) {
    const res = await fetch(`/api/goals/${id}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amountMAD }),
    });
    if (res.ok) {
      const formatted = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amountMAD);
      toast.success(t("success.progress_added_fmt", { amount: formatted }));
      setAddingProgressGoal(null);
      await refetchGoals();
    } else {
      toast.error(t("errors.progress_failed"));
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-muted/40 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">{t("page_title")}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t("page_subtitle")}</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" />
            <span className="hidden sm:inline">{t("create_button")}</span>
          </Button>
        </div>

        {/* Grid or empty state */}
        {goals.length === 0 ? (
          <GoalsEmptyState
            title={t("empty.title")}
            subtitle={t("empty.subtitle")}
            cta={t("empty.cta")}
            onCreateClick={() => setCreateOpen(true)}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {goals.map((goal) => {
              const achieved = goal.currentMAD >= goal.targetMAD && goal.targetMAD > 0;
              return (
                <div key={goal.id} className="flex flex-col gap-3">
                  <GoalCard
                    goal={goal}
                    locale={locale}
                    onAddProgress={() => setAddingProgressGoal(goal)}
                    onEdit={() => setEditingGoal(goal)}
                    onDelete={() => setDeletingGoal(goal)}
                    onPlanClick={() => setPlanGoal(goal)}
                  />
                  {!achieved && (
                    <SavingsPlanCard
                      goalId={goal.id}
                      goalTitle={goal.title}
                      targetMAD={goal.targetMAD}
                      currentMAD={goal.currentMAD}
                      initialPlan={initialPlans[goal.id] ?? null}
                      locale={locale}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("form.sheet_title_create")}</DialogTitle>
          </DialogHeader>
          <GoalForm
            mode="create"
            onSubmit={handleCreate}
            onCancel={() => setCreateOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editingGoal} onOpenChange={(open) => { if (!open) setEditingGoal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("form.sheet_title_edit")}</DialogTitle>
          </DialogHeader>
          {editingGoal && (
            <GoalForm
              mode="edit"
              initialValues={{
                title: editingGoal.title,
                targetMAD: editingGoal.targetMAD,
                targetDate: editingGoal.targetDate
                  ? editingGoal.targetDate.slice(0, 10)
                  : "",
              }}
              onSubmit={(values) => handleEdit(editingGoal.id, values)}
              onCancel={() => setEditingGoal(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Add progress dialog */}
      {addingProgressGoal && (
        <AddProgressDialog
          goal={addingProgressGoal}
          locale={locale}
          onSubmit={(amount) => handleAddProgress(addingProgressGoal.id, amount)}
          onClose={() => setAddingProgressGoal(null)}
        />
      )}

      {/* Delete dialog */}
      {deletingGoal && (
        <DeleteGoalDialog
          goal={deletingGoal}
          onConfirm={() => handleDelete(deletingGoal.id)}
          onClose={() => setDeletingGoal(null)}
        />
      )}

      {/* AI Savings Plan dialog */}
      <SavingsPlanDialog
        goal={planGoal}
        locale={locale as Locale}
        open={planGoal !== null}
        onOpenChange={(open) => { if (!open) setPlanGoal(null); }}
      />
    </div>
  );
}
