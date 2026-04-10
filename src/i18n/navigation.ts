import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware navigation helpers for Dakhli.
 *
 * These are drop-in replacements for Next.js navigation primitives.
 * They automatically prepend the current locale to any href,
 * so you can write <Link href="/dashboard"> and it will resolve to
 * /fr/dashboard, /en/dashboard or /ar/dashboard based on context.
 *
 * Always import Link, redirect, usePathname, useRouter, getPathname
 * from this file instead of "next/link" or "next/navigation".
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
