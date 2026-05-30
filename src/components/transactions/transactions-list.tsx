import { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TransactionRow, type TransactionRowData } from "./transaction-row";

type TransactionWithRelations = Prisma.TransactionGetPayload<{
  include: { category: true; account: true };
}>;

type Props = {
  transactions: TransactionWithRelations[];
  locale: string;
};

export async function TransactionsList({ transactions, locale }: Props) {
  const t = await getTranslations("Transactions");

  return (
    <div className="rounded-xl border bg-card shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">{t("columns.date")}</TableHead>
            <TableHead>{t("columns.description")}</TableHead>
            <TableHead>{t("columns.category")}</TableHead>
            <TableHead>{t("columns.account")}</TableHead>
            <TableHead className="text-right">{t("columns.amount")}</TableHead>
            {/* Empty header for the actions column */}
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => {
            // Pre-compute locale-aware category name server-side
            const categoryName =
              tx.category === null
                ? null
                : locale === "ar"
                  ? (tx.category.nameAr ?? tx.category.name)
                  : locale === "en"
                    ? (tx.category.nameEn ?? tx.category.name)
                    : tx.category.name;

            // Pre-format date server-side so no Date object crosses the RSC boundary
            const formattedDate = new Intl.DateTimeFormat(locale, {
              day: "2-digit",
              month: "short",
              year: "numeric",
            }).format(new Date(tx.occurredAt));

            // Serialize Prisma Decimal to plain number before passing to client
            const rowData: TransactionRowData = {
              id: tx.id,
              type: tx.type,
              description: tx.description,
              formattedDate,
              amount: Number(tx.amount),
              currency: tx.currency,
              amountMAD: Number(tx.amountMAD),
              accountName: tx.account.name,
              categoryName,
              categoryColor: tx.category?.color ?? null,
              isAnomaly: tx.isAnomaly,
              anomalyReason: tx.anomalyReason,
            };

            return <TransactionRow key={tx.id} tx={rowData} locale={locale} />;
          })}
        </TableBody>
      </Table>
    </div>
  );
}
