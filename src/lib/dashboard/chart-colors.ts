// Deterministic chart palette bound to the design tokens (globals.css --chart-1..5).
// Charts and ranked lists color by rank index so the donut and the top-categories
// list always agree, and colors adapt to light/dark mode automatically.
export const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length];
}
