import { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AmountDisplay } from "./amount-display";

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
    <div className="rounded-lg border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">{t("columns.date")}</TableHead>
            <TableHead>{t("columns.description")}</TableHead>
            <TableHead>{t("columns.category")}</TableHead>
            <TableHead>{t("columns.account")}</TableHead>
            <TableHead className="text-right">{t("columns.amount")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => {
            const categoryName =
              tx.category === null
                ? null
                : locale === "ar"
                  ? (tx.category.nameAr ?? tx.category.name)
                  : locale === "en"
                    ? (tx.category.nameEn ?? tx.category.name)
                    : tx.category.name;

            return (
              <TableRow key={tx.id}>
                {/* Date */}
                <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                  {new Intl.DateTimeFormat(locale, {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  }).format(new Date(tx.occurredAt))}
                </TableCell>

                {/* Description */}
                <TableCell className="font-medium">{tx.description}</TableCell>

                {/* Category */}
                <TableCell>
                  {categoryName !== null ? (
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor: tx.category?.color ?? "#94a3b8",
                        }}
                      />
                      <span className="text-sm">{categoryName}</span>
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">
                      {t("category_none")}
                    </span>
                  )}
                </TableCell>

                {/* Account */}
                <TableCell className="text-sm text-muted-foreground">
                  {tx.account.name}
                </TableCell>

                {/* Amount */}
                <TableCell className="text-right">
                  <AmountDisplay
                    amount={tx.amount}
                    currency={tx.currency}
                    amountMAD={tx.amountMAD}
                    type={tx.type}
                    locale={locale}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
