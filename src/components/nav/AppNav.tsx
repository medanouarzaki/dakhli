"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { LayoutDashboard, ListOrdered, MessageCircle, Target, Wallet } from "lucide-react";

import { SignOutButton } from "@/components/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { cn } from "@/lib/utils";

type Props = {
  locale: string;
  userName: string | null;
  userEmail: string;
};

export function AppNav({ locale, userName, userEmail }: Props) {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  const links = [
    { href: `/${locale}/dashboard`, label: t("dashboard"), icon: LayoutDashboard },
    { href: `/${locale}/transactions`, label: t("transactions"), icon: ListOrdered },
    { href: `/${locale}/budgets`, label: t("budgets"), icon: Wallet },
    { href: `/${locale}/goals`, label: t("goals"), icon: Target },
    { href: `/${locale}/chat`, label: t("chat"), icon: MessageCircle },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-1">
          <Link href={`/${locale}/dashboard`} className="me-4">
            <Logo />
          </Link>
          {links.map((link) => {
            const isActive = pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
              >
                <Icon size={16} />
                <span className="hidden sm:inline">{link.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          <SignOutButton
            locale={locale}
            label={userName ?? userEmail}
          />
        </div>
      </div>
    </header>
  );
}
