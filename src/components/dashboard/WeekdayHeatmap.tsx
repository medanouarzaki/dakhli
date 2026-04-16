import { getTranslations } from "next-intl/server";

import type { HeatmapCell } from "@/lib/dashboard/stats";

type Props = {
  cells: HeatmapCell[];
  locale: string;
};

// 2024-01-01 was a Monday (weekday index 0)
const MONDAY_REF = new Date(Date.UTC(2024, 0, 1));

function dayLabel(index: number, locale: string): string {
  const date = new Date(MONDAY_REF.getTime() + index * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  }).format(date);
}

export async function WeekdayHeatmap({ cells, locale }: Props) {
  const t = await getTranslations("Dashboard");

  const allZero = cells.every((c) => c.totalMAD === 0);

  if (allZero) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {t("empty.no_data_period")}
      </p>
    );
  }

  const maxTotal = Math.max(...cells.map((c) => c.totalMAD));

  const formatMAD = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "MAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div className="max-w-full space-y-2">
      {cells.map((cell) => {
        const barPct = maxTotal > 0 ? (cell.totalMAD / maxTotal) * 100 : 0;
        return (
          <div
            key={cell.weekday}
            className="grid items-center gap-3"
            style={{ gridTemplateColumns: "60px 1fr 120px" }}
          >
            {/* Day label */}
            <span className="text-sm text-muted-foreground">
              {dayLabel(cell.weekday, locale)}
            </span>

            {/* Bar */}
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-red-500 transition-all"
                style={{ width: `${barPct}%` }}
              />
            </div>

            {/* Values */}
            <div className="flex items-baseline gap-1 text-right">
              <span className="text-sm font-medium tabular-nums">
                {formatMAD(cell.totalMAD)}
              </span>
              <span className="text-xs text-muted-foreground">
                ({cell.txCount})
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
