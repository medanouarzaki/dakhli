"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import type { CategoryForecast } from "@/lib/ai/types/forecast";

type Props = {
  forecasts: CategoryForecast[];
  locale: string;
  labels: { predicted: string; lastMonth: string; mad: string };
};

export function ForecastBreakdownChart({ forecasts, locale, labels }: Props) {
  const data = forecasts.map((f) => ({
    name: f.categoryName.length > 18 ? `${f.categoryName.slice(0, 16)}…` : f.categoryName,
    [labels.lastMonth]: Math.round(f.lastMonthMAD),
    [labels.predicted]: Math.round(f.predictedMAD),
  }));

  const madLabel = labels.mad;

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36)}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 12, left: 8, bottom: 5 }}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          width={110}
          tick={{ fontSize: 11 }}
        />
        <Tooltip
          formatter={(value) =>
            typeof value === "number"
              ? `${value.toLocaleString(locale)} ${madLabel}`
              : String(value)
          }
          contentStyle={{ borderRadius: 6, fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar
          dataKey={labels.lastMonth}
          fill="#94a3b8"
          radius={[0, 4, 4, 0]}
        />
        <Bar
          dataKey={labels.predicted}
          fill="#6366f1"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
