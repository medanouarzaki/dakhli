"use client";

import { useLocale } from "next-intl";
import { Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePathname, useRouter } from "@/i18n/navigation";

const LANGUAGES = [
  { locale: "fr", label: "Français", short: "FR" },
  { locale: "en", label: "English", short: "EN" },
  { locale: "ar", label: "العربية", short: "ع" },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  function handleChange(newLocale: string) {
    router.replace(pathname, { locale: newLocale });
  }

  const current = LANGUAGES.find((l) => l.locale === locale);

  return (
    <Select value={locale} onValueChange={handleChange}>
      <SelectTrigger aria-label="Select language" className="gap-1.5 border-0 bg-transparent shadow-none hover:bg-accent focus:ring-0 focus-visible:ring-0 h-8 px-2">
        <Globe size={14} className="shrink-0 text-muted-foreground" />
        <SelectValue>
          <span className="text-sm font-medium">{current?.short}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        {LANGUAGES.map(({ locale: l, label }) => (
          <SelectItem key={l} value={l}>
            {label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
