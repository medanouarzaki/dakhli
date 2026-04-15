import type { Metadata } from "next";
import localFont from "next/font/local";
import "../globals.css";
import { cn } from "@/lib/utils";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { Toaster } from "@/components/ui/sonner";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import type { Locale } from "@/i18n/routing";
import { RadixDirectionProvider } from "@/components/providers/direction-provider";

const geistSans = localFont({
  src: "../fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "../fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Dakhli",
  description: "Your personal finance assistant",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: { locale: string };
};

export default async function LocaleLayout({
  children,
  params: { locale },
}: Props) {
  // Reject unknown locales with a 404 instead of silently falling back.
  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  // Required for static rendering with next-intl — establishes the locale
  // for the current request before any async operations.
  setRequestLocale(locale);

  // Load messages server-side so NextIntlClientProvider can forward them
  // to any client components in the subtree.
  const messages = await getMessages();

  const direction = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={direction}
      className={cn("font-sans", geistSans.variable)}
    >
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <RadixDirectionProvider dir={direction}>
          <AuthSessionProvider>
            <NextIntlClientProvider locale={locale} messages={messages}>
              {children}
              <Toaster />
            </NextIntlClientProvider>
          </AuthSessionProvider>
        </RadixDirectionProvider>
      </body>
    </html>
  );
}
