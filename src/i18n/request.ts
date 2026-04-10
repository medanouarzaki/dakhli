import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "./routing";

/**
 * Per-request i18n configuration for Dakhli.
 *
 * Runs on the server for every incoming request. It:
 *   1. Reads the locale from the URL (via next-intl middleware).
 *   2. Falls back to the default locale if the URL locale is invalid.
 *   3. Dynamically imports the matching messages file from src/messages/.
 *
 * The returned config is consumed automatically by NextIntlClientProvider
 * in the root layout and by all server-side translation calls.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
