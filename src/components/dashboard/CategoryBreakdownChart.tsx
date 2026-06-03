"use client";

import { useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useTranslations } from "next-intl";

import type { CategoryBreakdownRow } from "@/lib/dashboard/stats";
import { CategoryIcon } from "@/lib/categories/icon-map";
import { chartColor } from "@/lib/dashboard/chart-colors";
import { formatMAD } from "@/lib/format/money";

type Props = {
  rows: CategoryBreakdownRow[];
  locale: string;
};

export function CategoryBreakdownChart({ rows, locale }: Props) {
  const t = useTranslations("Dashboard");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        {t("empty.no_expense_period")}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={rows}
            dataKey="totalMAD"
            nameKey="name"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            isAnimationActive={false}
          >
            {rows.map((row, index) => (
              <Cell
                key={`cell-${index}`}
                fill={chartColor(index)}
                opacity={
                  hoveredIndex === null || hoveredIndex === index ? 1 : 0.45
                }
                stroke={hoveredIndex === index ? "var(--background)" : "transparent"}
                strokeWidth={hoveredIndex === index ? 2 : 0}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload: tp }) => {
              if (!active || !tp?.length) return null;
              const row = tp[0].payload as CategoryBreakdownRow;
              return (
                <div className="min-w-[160px] rounded-md border bg-card px-3 py-2 text-sm shadow-md">
                  <p className="mb-1 font-medium">{row.name}</p>
                  <p className="tabular-nums text-muted-foreground">
                    {formatMAD(row.totalMAD, locale)}
                  </p>
                  <p className="text-muted-foreground">{row.percentOfTotal}%</p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Custom legend */}
      <ul className="space-y-1">
        {rows.map((row, index) => (
          <li
            key={row.categoryId ?? `other-${index}`}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent"
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded"
              style={{ color: chartColor(index) }}
            >
              <CategoryIcon name={row.icon} className="h-4 w-4" />
            </span>
            <span className="flex-1 truncate text-sm">{row.name}</span>
            <span className="shrink-0 text-sm font-medium tabular-nums">
              {formatMAD(row.totalMAD, locale)}
            </span>
            <span className="w-10 shrink-0 text-end text-xs text-muted-foreground">
              {row.percentOfTotal}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
