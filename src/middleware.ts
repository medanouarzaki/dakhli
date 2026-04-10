import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

/**
 * next-intl middleware for Dakhli.
 *
 * Intercepts every matching request and:
 *   - Detects the locale from the URL prefix (/fr, /en, /ar).
 *   - Falls back to Accept-Language header, then to defaultLocale.
 *   - Redirects unprefixed URLs (e.g. /dashboard -> /fr/dashboard).
 *   - Stores the user's last locale preference in a cookie.
 */
export default createMiddleware(routing);

/**
 * Matcher config: which routes the middleware should run on.
 *
 * - Matches all paths EXCEPT:
 *   - /api/*          (API routes, handled separately)
 *   - /_next/*        (Next.js internals)
 *   - /_vercel/*      (Vercel infrastructure)
 *   - static files    (anything with a file extension, e.g. favicon.ico)
 */
export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
