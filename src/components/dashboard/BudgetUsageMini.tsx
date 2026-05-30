import { CategoryIcon } from "@/lib/categories/icon-map";
import type { BudgetUsageRow } from "@/lib/budgets/usage";
import { formatMAD } from "@/lib/format/money";

type Props = { row: BudgetUsageRow; locale: string };

export function BudgetUsageMini({ row, locale }: Props) {
  const barColor =
    row.status === "exceeded"
      ? "bg-destructive"
      : row.status === "warning"
        ? "bg-warning"
        : "bg-success";

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
          {formatMAD(row.consumedMAD, locale)} / {formatMAD(row.amountMAD, locale)}
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
