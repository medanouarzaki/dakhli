"use client";

import { useTranslations } from "next-intl";
import type { TransactionType } from "@prisma/client";

type Props = {
  amount: number;
  currency: string;
  amountMAD: number;
  type: TransactionType;
  locale: string;
};

export function AmountDisplay({
  amount,
  currency,
  amountMAD,
  type,
  locale,
}: Props) {
  const t = useTranslations("Transactions");

  const colorClass =
    type === "INCOME"
      ? "text-green-600"
      : type === "EXPENSE"
        ? "text-red-600"
        : "text-muted-foreground";

  const sign = type === "INCOME" ? "+" : type === "EXPENSE" ? "−" : "";

  const formattedAmount = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amount);

  // Only show MAD conversion when the original currency is not MAD
  const showConversion = currency !== "MAD";
  const formattedMAD = showConversion
    ? new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "MAD",
        maximumFractionDigits: 2,
      }).format(amountMAD)
    : null;

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <span className={`font-medium tabular-nums ${colorClass}`}>
        {sign}
        {formattedAmount}
      </span>
      {showConversion && formattedMAD !== null && (
        <span className="text-xs text-muted-foreground tabular-nums">
          {t("amount_converted", { amount: formattedMAD })}
        </span>
      )}
    </div>
  );
}
