"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTranslations } from "next-intl";

import type { TimeBucket } from "@/lib/dashboard/stats";

type Granularity = "daily" | "monthly" | "yearly";

type Props = {
  buckets: TimeBucket[];
  locale: string;
};

function detectGranularity(firstLabel: string): Granularity {
  if (/^\d{4}$/.test(firstLabel)) return "yearly";
  if (/^\d{4}-\d{2}$/.test(firstLabel)) return "monthly";
  return "daily";
}

/** Short tick label for the X axis */
function formatTick(label: string, gran: Granularity, locale: string): string {
  if (gran === "yearly") return label;
  if (gran === "monthly") {
    const [y, m] = label.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, 1)));
  }
  // daily → show day number only ("01", "15")
  return label.slice(8);
}

/** Full label for the tooltip header */
function formatFull(label: string, gran: Granularity, locale: string): string {
  if (gran === "yearly") return label;
  if (gran === "monthly") {
    const [y, m] = label.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, 1)));
  }
  const [y, m, d] = label.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function IncomeExpenseChart({ buckets, locale }: Props) {
  const t = useTranslations("Dashboard");

  const allZero =
    buckets.length === 0 ||
    buckets.every((b) => b.incomeMAD === 0 && b.expenseMAD === 0);

  if (allZero) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        {t("empty.no_data_period")}
      </div>
    );
  }

  const gran = detectGranularity(buckets[0].label);

  const formatMAD = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "MAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  const formatCompact = (value: number) =>
    new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={buckets}
        margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
        barCategoryGap="30%"
      >
        <XAxis
          dataKey="label"
          tickFormatter={(v: string) => formatTick(v, gran, locale)}
          interval={buckets.length > 15 ? Math.ceil(buckets.length / 10) : 0}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tickFormatter={(v: number) => formatCompact(v)}
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={44}
        />
        <Tooltip
          cursor={{ fill: "hsl(var(--muted))", opacity: 0.6 }}
          content={({
            active,
            payload: tp,
            label: lbl,
          }) => {
            if (!active || !tp?.length) return null;
            const income =
              (tp.find((p) => p.dataKey === "incomeMAD")
                ?.value as number) ?? 0;
            const expense =
              (tp.find((p) => p.dataKey === "expenseMAD")
                ?.value as number) ?? 0;
            const net = income - expense;
            return (
              <div className="min-w-[180px] rounded-md border bg-card px-3 py-2 text-sm shadow-md">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  {formatFull(String(lbl), gran, locale)}
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between gap-6">
                    <span className="text-emerald-600">
                      {t("kpi.income")}
                    </span>
                    <span className="font-medium tabular-nums">
                      {formatMAD(income)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-6">
                    <span className="text-red-600">{t("kpi.expense")}</span>
                    <span className="font-medium tabular-nums">
                      {formatMAD(expense)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-6 border-t pt-1">
                    <span className="text-muted-foreground">
                      {t("kpi.net")}
                    </span>
                    <span
                      className={`font-medium tabular-nums ${
                        net >= 0 ? "text-emerald-600" : "text-red-600"
                      }`}
                    >
                      {formatMAD(net)}
                    </span>
                  </div>
                </div>
              </div>
            );
          }}
        />
        <Bar
          dataKey="incomeMAD"
          stackId="stack"
          fill="#16A34A"
          radius={[0, 0, 0, 0]}
          isAnimationActive={false}
        />
        <Bar
          dataKey="expenseMAD"
          stackId="stack"
          fill="#EF4444"
          radius={[3, 3, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
