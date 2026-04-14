import createMiddleware from "next-intl/middleware";
import { getToken } from "next-auth/jwt";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { routing } from "./i18n/routing";

// ─── next-intl middleware instance ───────────────────────────────────────────
// Created once at module level — not re-created per request.
const intlMiddleware = createMiddleware(routing);

// ─── Private route definitions ───────────────────────────────────────────────
// These are pathnames WITHOUT the locale prefix.
// A request to /fr/dashboard → strippedPath = /dashboard → matches.
// Add new protected sections here as the app grows.
const PRIVATE_PATHS = [
  "/dashboard",
  "/transactions",
  "/budget",
  "/settings",
  "/goals",
  "/accounts",
  "/import",
  "/insights",
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract the locale segment from a pathname.
 * Returns null if the pathname doesn't start with a known locale prefix.
 * Works because localePrefix: "always" guarantees /{locale}/... shape.
 */
function getLocale(pathname: string): string | null {
  for (const locale of routing.locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return null;
}

/**
 * Strip the locale prefix from a pathname.
 * "/fr/dashboard" → "/dashboard"
 * "/fr"           → "/"
 */
function stripLocalePrefix(pathname: string, locale: string): string {
  if (pathname.startsWith(`/${locale}/`)) {
    return pathname.slice(`/${locale}`.length); // keeps the leading /
  }
  return "/"; // pathname === `/${locale}` — the localized home
}

/**
 * Check whether a stripped pathname (no locale) falls under a private section.
 * Matches exact paths and sub-paths: "/dashboard" and "/dashboard/settings" both match.
 */
function isPrivatePath(strippedPathname: string): boolean {
  return PRIVATE_PATHS.some(
    (privatePath) =>
      strippedPathname === privatePath ||
      strippedPathname.startsWith(`${privatePath}/`)
  );
}

// ─── Unified middleware ───────────────────────────────────────────────────────

export default async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Step 1: Determine if the request targets a localized private route.
  // If the URL has no locale prefix yet (e.g. bare /dashboard), next-intl
  // will handle the redirect to /{defaultLocale}/dashboard in Step 3,
  // and that follow-up request will go through this check again.
  const locale = getLocale(pathname);

  if (locale !== null) {
    const strippedPath = stripLocalePrefix(pathname, locale);

    if (isPrivatePath(strippedPath)) {
      // Step 2: Verify the NextAuth JWT. getToken() reads the cookie directly
      // — no database call, compatible with Edge Runtime.
      const token = await getToken({
        req,
        secret: process.env.NEXTAUTH_SECRET,
      });

      if (!token) {
        // Redirect to the localized login page, preserving the intended
        // destination so the login page can redirect back after sign-in.
        const loginUrl = new URL(`/${locale}/login`, req.url);
        loginUrl.searchParams.set("callbackUrl", req.url);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  // Step 3: Delegate to next-intl for locale detection, prefix redirects,
  // and locale cookie management. This runs for all public routes and for
  // authenticated requests to private routes.
  return intlMiddleware(req);
}

// ─── Matcher — unchanged from the original next-intl setup ───────────────────
// Excludes: /api/*, /_next/*, /_vercel/*, and static files (*.ext).
export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
