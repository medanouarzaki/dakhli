import { getTranslations } from "next-intl/server";
import { setRequestLocale } from "next-intl/server";
import {
  ArrowRight,
  CalendarDays,
  Check,
  FileText,
  FileUp,
  Lightbulb,
  MessagesSquare,
  PiggyBank,
  Sparkles,
  Tags,
  TrendingUp,
  TriangleAlert,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { Logo } from "@/components/logo";
import { PublicHeader } from "@/components/landing/public-header";
import { ZelligePattern } from "@/components/landing/zellige-pattern";

type Props = {
  params: { locale: string };
};

export default async function LandingPage({ params: { locale } }: Props) {
  setRequestLocale(locale);
  const t = await getTranslations("Landing");

  const features = [
    { key: "categorize", icon: Tags },
    { key: "anomalies", icon: TriangleAlert },
    { key: "forecast", icon: TrendingUp },
    { key: "chat", icon: MessagesSquare },
    { key: "advice", icon: Lightbulb },
    { key: "pdf", icon: FileText },
    { key: "savings", icon: PiggyBank },
    { key: "planning", icon: CalendarDays },
  ] as const;

  const howSteps = [
    { key: "step1", icon: UserPlus },
    { key: "step2", icon: FileUp },
    { key: "step3", icon: Sparkles },
  ] as const;

  const moroccoPoints = [
    t("morocco.point1"),
    t("morocco.point2"),
    t("morocco.point3"),
    t("morocco.point4"),
  ];

  return (
    <>
      <PublicHeader />

      <main>
        {/* ── HERO ── */}
        <section className="relative overflow-hidden">
          <ZelligePattern className="pointer-events-none absolute -top-28 -end-28 z-0 h-[420px] w-[420px] text-primary opacity-[0.04]" />

          <div className="relative z-10 mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              {/* Left column */}
              <div className="flex flex-col gap-6">
                <div className="inline-flex w-fit items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm">
                  <span className="h-2 w-2 rounded-full bg-primary" />
                  <span className="text-muted-foreground">{t("hero.eyebrow")}</span>
                </div>

                <h1 className="font-heading text-4xl font-bold tracking-tight sm:text-5xl">
                  {t("hero.title")}
                </h1>

                <p className="text-lg text-muted-foreground leading-relaxed">
                  {t("hero.subtitle")}
                </p>

                <div className="flex flex-wrap gap-3">
                  <Button size="lg" asChild>
                    <Link href="/signup" className="gap-2">
                      {t("hero.ctaPrimary")}
                      <ArrowRight size={16} />
                    </Link>
                  </Button>
                  <Button size="lg" variant="ghost" asChild>
                    <Link href="/login">{t("hero.ctaSecondary")}</Link>
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground">{t("hero.trust")}</p>
              </div>

              {/* Right column — product preview card */}
              <div className="rounded-2xl border bg-card p-6 shadow-xl shadow-foreground/[0.06]">
                <div className="mb-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    {t("preview.balanceLabel")}
                  </p>
                  <div className="flex items-baseline gap-3">
                    <span dir="ltr" className="font-mono text-3xl font-bold tabular-nums">12 450 MAD</span>
                    <span className="flex items-center gap-1 text-sm font-medium text-success">
                      <TrendingUp size={14} />
                      {t("preview.delta")}
                    </span>
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/40 p-3">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 h-12 w-[3px] shrink-0 rounded-full bg-primary" />
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Sparkles size={14} className="text-primary" />
                        <span className="text-sm font-medium">{t("preview.adviceTitle")}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {t("preview.adviceBody")}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              {t("features.title")}
            </h2>
            <p className="mt-3 text-muted-foreground text-lg">{t("features.subtitle")}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ key, icon: Icon }) => (
              <div key={key} className="rounded-xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md hover:shadow-foreground/5">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon size={20} />
                </div>
                <p className="font-medium">{t(`features.${key}.title` as Parameters<typeof t>[0])}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(`features.${key}.desc` as Parameters<typeof t>[0])}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <h2 className="font-heading mb-12 text-center text-3xl font-bold tracking-tight sm:text-4xl">
              {t("how.title")}
            </h2>

            <div className="grid gap-8 sm:grid-cols-3">
              {howSteps.map(({ key, icon: Icon }, idx) => (
                <div key={key} className="flex flex-col items-center gap-4 rounded-xl border bg-card p-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                    <Icon size={24} />
                  </div>
                  <div>
                    <p className="mb-1 flex items-center justify-center gap-2 font-medium">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                        {idx + 1}
                      </span>
                      {t(`how.${key}.title` as Parameters<typeof t>[0])}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t(`how.${key}.desc` as Parameters<typeof t>[0])}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── MOROCCO ── */}
        <section className="bg-primary/5">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
            <div className="mb-10 text-center">
              <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
                {t("morocco.title")}
              </h2>
              <p className="mt-3 text-muted-foreground text-lg">{t("morocco.subtitle")}</p>
            </div>

            <ul className="mx-auto max-w-xl space-y-4">
              {moroccoPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-3">
                  <Check size={18} className="mt-0.5 shrink-0 text-success" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── CTA ── */}
        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
          <div className="rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground sm:px-12">
            <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">{t("cta.title")}</h2>
            <div className="mt-8">
              <Button size="lg" variant="secondary" asChild className="bg-background text-foreground hover:bg-background/90">
                <Link href="/signup" className="gap-2">
                  {t("cta.button")}
                  <ArrowRight size={16} />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="border-t">
          <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-col items-center gap-4 text-center">
              <Logo />
              <p className="text-muted-foreground">{t("footer.tagline")}</p>
              <p className="text-xs text-muted-foreground">
                {t("footer.project")} · {t("footer.rights")}
              </p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
