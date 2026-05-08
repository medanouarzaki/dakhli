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

// AR gets its localized abbreviation; every other locale/currency uses the ISO code.
function getCurrencyLabel(currency: string, locale: string): string {
  if (currency === "MAD" && locale === "ar") return "د.م.";
  return currency;
}

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

  const numberPart = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));

  const currencyLabel = getCurrencyLabel(currency, locale);
  const formattedAmount = `${sign}${numberPart} ${currencyLabel}`;

  // Only show MAD conversion when the original currency is not MAD
  const showConversion = currency !== "MAD";
  const formattedMAD = showConversion
    ? `${new Intl.NumberFormat(locale, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Math.abs(amountMAD))} ${getCurrencyLabel("MAD", locale)}`
    : null;

  return (
    <div className="inline-flex flex-col items-end gap-0.5">
      <span className={`font-medium tabular-nums whitespace-nowrap ${colorClass}`}>
        {formattedAmount}
      </span>
      {showConversion && formattedMAD !== null && (
        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
          {t("amount_converted", { amount: formattedMAD })}
        </span>
      )}
    </div>
  );
}
