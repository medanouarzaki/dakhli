import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { Prisma } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { formatMAD } from "@/lib/format/money";

type TxWithRelations = Prisma.TransactionGetPayload<{
  include: { category: true; account: true };
}>;

type Props = {
  transactions: TxWithRelations[];
  locale: string;
};

export async function RecentTransactionsList({ transactions, locale }: Props) {
  const t = await getTranslations("Dashboard");

  if (transactions.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="mb-4 text-sm text-muted-foreground">{t("empty.title")}</p>
        <Button asChild size="sm">
          <Link href={`/${locale}/transactions/new`}>{t("empty.cta")}</Link>
        </Button>
      </div>
    );
  }

  // Show at most 5 rows (computeRecentTransactions already returns ≤10, but cap here for safety)
  const list = transactions.slice(0, 5);

  return (
    <ul className="divide-y">
      {list.map((tx) => {
        const formattedDate = new Intl.DateTimeFormat(locale, {
          day: "2-digit",
          month: "short",
          timeZone: "UTC",
        }).format(new Date(tx.occurredAt));

        const amountFormatted = formatMAD(Number(tx.amountMAD), locale);

        const categoryName =
          tx.category === null
            ? null
            : locale === "ar"
              ? (tx.category.nameAr ?? tx.category.name)
              : locale === "en"
                ? (tx.category.nameEn ?? tx.category.name)
                : tx.category.name;

        const sign =
          tx.type === "INCOME" ? "+" : tx.type === "EXPENSE" ? "−" : "";
        const amountColor =
          tx.type === "INCOME"
            ? "text-success"
            : tx.type === "EXPENSE"
              ? "text-destructive"
              : "text-muted-foreground";

        return (
          <li key={tx.id}>
            <Link
              href={`/${locale}/transactions/${tx.id}/edit`}
              className="flex items-center gap-3 rounded-md px-3 py-2 transition-colors hover:bg-accent"
            >
              <span className="w-10 shrink-0 text-xs text-muted-foreground">
                {formattedDate}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">{tx.description}</span>
                {categoryName !== null && (
                  <span className="text-xs text-muted-foreground">
                    {categoryName}
                  </span>
                )}
              </span>
              <span
                className={`shrink-0 text-sm font-medium tabular-nums ${amountColor}`}
              >
                {sign}
                {amountFormatted}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
