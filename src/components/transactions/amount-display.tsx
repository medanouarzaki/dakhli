// Server Component — no interactivity needed, purely presentational.
import { Decimal } from "@prisma/client/runtime/library";
import { getTranslations } from "next-intl/server";
import { TransactionType } from "@prisma/client";

type Props = {
  amount: Decimal;
  currency: string;
  amountMAD: Decimal;
  type: TransactionType;
  locale: string;
};

export async function AmountDisplay({
  amount,
  currency,
  amountMAD,
  type,
  locale,
}: Props) {
  const t = await getTranslations("Transactions");

  const colorClass =
    type === "INCOME"
      ? "text-green-600"
      : type === "EXPENSE"
        ? "text-red-600"
        : "text-muted-foreground";

  const sign = type === "INCOME" ? "+" : type === "EXPENSE" ? "−" : "";

  const amountNum = Number(amount);
  const amountMADNum = Number(amountMAD);

  const formattedAmount = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).format(amountNum);

  // Only show MAD conversion when the original currency is not MAD
  const showConversion = currency !== "MAD";
  const formattedMAD = showConversion
    ? new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "MAD",
        maximumFractionDigits: 2,
      }).format(amountMADNum)
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
