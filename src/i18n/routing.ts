import { defineRouting } from "next-intl/routing";

/**
 * i18n routing configuration for Dakhli.
 *
 * - Supported locales: fr (default), en, ar (RTL).
 * - Locale prefix strategy: "always" — every URL is prefixed
 *   (e.g. /fr/dashboard, /en/dashboard, /ar/dashboard).
 *   This is SEO-friendly and makes shareable, language-specific URLs.
 */
export const routing = defineRouting({
  locales: ["fr", "en", "ar"],
  defaultLocale: "fr",
  localePrefix: "always",
  // Disable Accept-Language detection — always default to "fr" unless
  // the user has an explicit locale cookie (set by a future language picker).
  localeDetection: false,
});

export type Locale = (typeof routing.locales)[number];
