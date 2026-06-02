"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DemoDataCard() {
  const t = useTranslations("DemoData");
  const router = useRouter();
  const [months, setMonths] = useState<"3" | "6">("6");
  const [generating, setGenerating] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/demo/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ months: Number(months) }),
      });
      const data = (await res.json()) as { created?: number; error?: string };
      if (!res.ok) throw new Error(data.error ?? "server_error");
      toast.success(t("generateSuccess", { count: data.created ?? 0 }));
      router.refresh();
    } catch {
      toast.error(t("error"));
    } finally {
      setGenerating(false);
    }
  }

  async function handleReset() {
    setResetting(true);
    setConfirmOpen(false);
    try {
      const res = await fetch("/api/demo/reset", { method: "POST" });
      if (!res.ok) throw new Error("server_error");
      toast.success(t("resetSuccess"));
      router.refresh();
    } catch {
      toast.error(t("error"));
    } finally {
      setResetting(false);
    }
  }

  return (
    <>
      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{t("period")}</span>
            <Select value={months} onValueChange={(v) => setMonths(v as "3" | "6")}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">{t("months3")}</SelectItem>
                <SelectItem value="6">{t("months6")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleGenerate} disabled={generating} className="w-full sm:w-auto">
            {generating && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {generating ? t("generating") : t("generate")}
          </Button>

          <div className="border-t pt-4">
            <Button
              variant="destructive"
              disabled={resetting}
              onClick={() => setConfirmOpen(true)}
              className="w-full sm:w-auto"
            >
              {resetting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("reset")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>{t("resetTitle")}</DialogTitle>
            <DialogDescription>{t("resetConfirm")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t("resetCancel")}
            </Button>
            <Button variant="destructive" onClick={handleReset} disabled={resetting}>
              {resetting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("resetConfirmBtn")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
