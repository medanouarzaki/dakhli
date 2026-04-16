import { CategoryIcon } from "@/lib/categories/icon-map";
import type { BudgetUsageRow } from "@/lib/budgets/usage";

type Props = { row: BudgetUsageRow; locale: string };

export function BudgetUsageMini({ row, locale }: Props) {
  const formatMAD = (v: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "MAD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  const barColor =
    row.status === "exceeded"
      ? "bg-red-500"
      : row.status === "warning"
        ? "bg-amber-500"
        : "bg-emerald-500";

  const barWidth = Math.min(row.percent, 100);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="flex items-center gap-2">
          <CategoryIcon
            name={row.categoryIcon}
            className="size-4"
            style={{ color: row.categoryColor ?? undefined }}
          />
          <span className="font-medium">{row.categoryName}</span>
        </span>
        <span className="tabular-nums text-muted-foreground">
          {formatMAD(row.consumedMAD)} / {formatMAD(row.amountMAD)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${barWidth}%` }}
        />
      </div>
    </div>
  );
}
