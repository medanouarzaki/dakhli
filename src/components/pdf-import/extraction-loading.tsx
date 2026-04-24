"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle, Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

const STEP_INTERVAL_MS = 4000;
const TOTAL_STEPS = 4;

// Bounce the progress bar value between 15 and 85 to simulate indeterminate state.
function useIndeterminateProgress() {
  const [value, setValue] = useState(15);
  const [direction, setDirection] = useState<1 | -1>(1);

  useEffect(() => {
    const id = setInterval(() => {
      setValue((v) => {
        const next = v + direction * 12;
        if (next >= 85) setDirection(-1);
        if (next <= 15) setDirection(1);
        return next;
      });
    }, 400);
    return () => clearInterval(id);
    // direction is intentionally not in deps — we track it via setDirection callback
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return value;
}

export function ExtractionLoading() {
  const t = useTranslations("ImportPdf");
  const [activeStep, setActiveStep] = useState(0);
  const progressValue = useIndeterminateProgress();

  const steps = [
    t("loading.step1"),
    t("loading.step2"),
    t("loading.step3"),
    t("loading.step4"),
  ] as const;

  useEffect(() => {
    const id = setInterval(() => {
      setActiveStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <Card>
      <CardContent className="pt-8 pb-8">
        <div className="flex flex-col items-center gap-6">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />

          <div className="w-full max-w-md space-y-3 text-center">
            <p className="font-semibold text-lg">{t("loading.title")}</p>
            <Progress value={progressValue} className="h-2" />
          </div>

          <ul className="w-full max-w-md space-y-2">
            {steps.map((label, i) => {
              const isDone = i < activeStep;
              const isActive = i === activeStep;
              return (
                <li
                  key={i}
                  className={[
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    isDone ? "text-green-600" : isActive ? "font-semibold text-primary" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {isDone ? (
                    <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
                  ) : (
                    <span className={[
                      "h-4 w-4 shrink-0 rounded-full border-2",
                      isActive ? "border-primary" : "border-muted-foreground/30",
                    ].join(" ")} />
                  )}
                  {label}
                </li>
              );
            })}
          </ul>

          <p className="text-xs text-muted-foreground text-center max-w-sm">
            {t("loading.reassurance")}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
