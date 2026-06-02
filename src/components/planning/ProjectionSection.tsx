"use client";

import { useTranslations } from "next-intl";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMAD } from "@/lib/format/money";
import type { ProjectionMonth } from "@/lib/planning/projection";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  months: ProjectionMonth[];
  hasData: boolean;
  locale: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function monthLabel(monthIso: string, locale: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, 1))
  );
}

function remainingColor(value: number): string {
  if (value < 0) return "var(--destructive)";
  if (value < 1000) return "var(--warning)";
  return "var(--success)";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProjectionSection({ months, hasData, locale }: Props) {
  const t = useTranslations("Planning");

  if (!hasData) {
    return (
      <Card className="rounded-xl border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>{t("projection.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center rounded-xl border bg-muted/30 px-4 py-12 text-center">
            <div className="mb-3 rounded-full bg-primary/10 p-3">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <p className="text-sm text-muted-foreground">{t("projection.empty")}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = months.map((m) => ({
    label: monthLabel(m.monthIso, locale),
    remaining: Math.round(m.remaining),
  }));

  const formatCompact = (value: number) =>
    new Intl.NumberFormat(locale, {
      notation: "compact",
      maximumFractionDigits: 1,
      numberingSystem: "latn",
    }).format(value);

  return (
    <Card className="rounded-xl border bg-card shadow-sm">
      <CardHeader>
        <CardTitle>{t("projection.title")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Line chart */}
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={formatCompact}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={52}
            />
            <ReferenceLine y={0} stroke="var(--muted-foreground)" strokeDasharray="4 2" />
            <Tooltip
              cursor={{ stroke: "var(--border)" }}
              content={({ active, payload, label: lbl }) => {
                if (!active || !payload?.length) return null;
                const val = payload[0]?.value as number;
                return (
                  <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-md">
                    <p className="mb-1 text-xs font-medium text-muted-foreground">{lbl}</p>
                    <p
                      className="font-semibold tabular-nums"
                      style={{ color: remainingColor(val) }}
                    >
                      {formatMAD(val, locale)}
                    </p>
                  </div>
                );
              }}
            />
            <Line
              type="monotone"
              dataKey="remaining"
              stroke="var(--chart-1)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--chart-1)" }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("projection.col_month")}</TableHead>
              <TableHead className="text-end">{t("projection.col_revenue")}</TableHead>
              <TableHead className="text-end">{t("projection.col_fixed")}</TableHead>
              <TableHead className="text-end">{t("projection.col_exceptional")}</TableHead>
              <TableHead className="text-end">{t("projection.col_remaining")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {months.map((m) => (
              <TableRow key={m.monthIso}>
                <TableCell className="font-medium">{monthLabel(m.monthIso, locale)}</TableCell>
                <TableCell className="text-end tabular-nums text-success">
                  {formatMAD(m.revenue, locale)}
                </TableCell>
                <TableCell className="text-end tabular-nums text-destructive">
                  {formatMAD(m.fixedCharges, locale)}
                </TableCell>
                <TableCell className="text-end tabular-nums text-warning">
                  {m.exceptionalCharges > 0 ? formatMAD(m.exceptionalCharges, locale) : "—"}
                </TableCell>
                <TableCell
                  className="text-end tabular-nums font-semibold"
                  style={{ color: remainingColor(m.remaining) }}
                >
                  {formatMAD(m.remaining, locale)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
