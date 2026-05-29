import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/logo";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";

export async function PublicHeader() {
  const t = await getTranslations("Landing");

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Dakhli home">
          <Logo />
        </Link>

        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
          <Button variant="ghost" asChild>
            <Link href="/login">{t("nav.signIn")}</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">{t("nav.getStarted")}</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
