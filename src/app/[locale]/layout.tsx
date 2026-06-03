import type { Metadata } from "next";
import localFont from "next/font/local";
import { Bricolage_Grotesque } from "next/font/google";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "../globals.css";
import { cn } from "@/lib/utils";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
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

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const plexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  variable: "--font-arabic",
  display: "swap",
});

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "Meta" });
  const description = t("description");
  return {
    title: "Dakhli",
    description,
    metadataBase: new URL("https://dakhli-ma.vercel.app"),
    openGraph: {
      title: "Dakhli",
      description,
      type: "website",
      siteName: "Dakhli",
      locale,
      url: `/${locale}`,
    },
  };
}

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
      suppressHydrationWarning
      className={cn(
        "font-sans",
        geistSans.variable,
        geistMono.variable,
        bricolage.variable,
        plexArabic.variable
      )}
    >
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
        >
          <RadixDirectionProvider dir={direction}>
            <AuthSessionProvider>
              <NextIntlClientProvider locale={locale} messages={messages}>
                {children}
                <Toaster />
              </NextIntlClientProvider>
            </AuthSessionProvider>
          </RadixDirectionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
