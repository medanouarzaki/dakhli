import { getTranslations } from "next-intl/server";

import type { CategoryBreakdownRow } from "@/lib/dashboard/stats";
import { CategoryIcon } from "@/lib/categories/icon-map";

type Props = {
  rows: CategoryBreakdownRow[];
  locale: string;
};

export async function TopCategoriesList({ rows, locale }: Props) {
  const t = await getTranslations("Dashboard");

  const formatMAD = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "MAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  if (rows.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        {t("empty.no_expense_period")}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row, index) => (
        <li key={row.categoryId ?? `other-${index}`}>
          <div className="mb-1 flex items-center gap-2">
            <span
              className="shrink-0"
              style={{ color: row.color ?? "#94a3b8" }}
            >
              <CategoryIcon name={row.icon} className="h-4 w-4" />
            </span>
            <span className="flex-1 truncate text-sm">{row.name}</span>
            <span className="shrink-0 text-sm font-medium tabular-nums">
              {formatMAD(row.totalMAD)}
            </span>
            <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
              ({row.percentOfTotal}%)
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{
                width: `${row.percentOfTotal}%`,
                backgroundColor: row.color ?? "#94a3b8",
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
