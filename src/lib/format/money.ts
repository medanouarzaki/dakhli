// Single source of truth for MAD currency formatting across the dashboard.
// Latin digits are forced in every locale (project-wide convention), and the
// default is zero fraction digits to match the dashboard's integer amounts.
export function formatMAD(
  value: number,
  locale: string,
  options: { fractionDigits?: number } = {},
): string {
  const { fractionDigits = 0 } = options;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "MAD",
    numberingSystem: "latn",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}
