"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

type Props = {
  title: string;
  reassurance: string;
  step1: string;
  step2: string;
  step3: string;
};

const STEP_INTERVAL_MS = 3500;

export function AdviceLoading({ title, reassurance, step1, step2, step3 }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [progressValue, setProgressValue] = useState(15);
  const steps = [step1, step2, step3];

  useEffect(() => {
    const id = setInterval(() => {
      setActiveStep((s) => Math.min(s + 1, steps.length - 1));
    }, STEP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [steps.length]);

  useEffect(() => {
    let dir: 1 | -1 = 1;
    const id = setInterval(() => {
      setProgressValue((v) => {
        const next = v + dir * 10;
        if (next >= 85) dir = -1;
        if (next <= 15) dir = 1;
        return next;
      });
    }, 380);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="font-semibold">{title}</p>
      <Progress value={progressValue} className="h-1.5 max-w-md" />
      <ul className="w-full max-w-md space-y-1.5">
        {steps.map((label, i) => {
          const isDone = i < activeStep;
          const isActive = i === activeStep;
          return (
            <li
              key={i}
              className={`flex items-center gap-2 text-sm ${
                isDone
                  ? "text-success"
                  : isActive
                  ? "font-medium text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {isDone ? (
                <CheckCircle className="h-3.5 w-3.5 text-success" />
              ) : (
                <span
                  className={`h-3.5 w-3.5 rounded-full border-2 ${
                    isActive ? "border-primary" : "border-muted-foreground/30"
                  }`}
                />
              )}
              {label}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted-foreground">{reassurance}</p>
    </div>
  );
}
