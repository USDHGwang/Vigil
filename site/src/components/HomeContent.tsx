"use client";

/**
 * Landing 主體 — client component。
 * 接 i18n hooks（useTranslation / useLocale），切換語言時整段 fade 過渡。
 */

import Starfield from "@/components/Starfield";
import Nav from "@/components/Nav";
import Reveal from "@/components/Reveal";
import MechanismSteps from "@/components/MechanismSteps";
import TxShowcase from "@/components/TxShowcase";
import ScrollReset from "@/components/ScrollReset";
import Daybreak from "@/components/Daybreak";
import Button from "@/components/ui/Button";
import { useLocale, useTranslation } from "@/i18n";

function LocaleTransition({ children }: { children: React.ReactNode }) {
  const { locale } = useLocale();
  return (
    <div key={locale} className="anim-locale">
      {children}
    </div>
  );
}

export default function HomeContent() {
  const t = useTranslation();

  return (
    <main id="top" className="relative flex min-h-screen flex-col">
      <ScrollReset />
      <Daybreak />
      <Starfield />
      <Nav />

      <LocaleTransition>
        {/* ======================= HERO ======================= */}
        <section className="relative flex min-h-svh flex-col px-6 pt-24 pb-12 sm:px-10">
          <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center">
            <Reveal>
              <p className="tag-accent mb-8">{t.tagline}</p>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="text-[11vw] leading-[1.24] font-light tracking-[-0.03em] text-[var(--color-ink)] sm:text-7xl md:text-[96px]">
                {t.heroSee}
              </h1>
            </Reveal>
            <Reveal delay={180}>
              <h1 className="text-[11vw] leading-[1.24] font-light tracking-[-0.03em] text-[var(--color-ink)] sm:text-7xl md:text-[96px]">
                {t.heroReport}
              </h1>
            </Reveal>
            <Reveal delay={280}>
              <h1 className="text-[9.5vw] leading-[1.24] font-light tracking-[-0.03em] sm:text-6xl md:text-[80px]">
                <span className="text-[var(--color-ink-2)]">
                  {t.heroDecide}
                </span>
              </h1>
            </Reveal>
            <Reveal delay={400}>
              <p className="mt-10 max-w-xl text-lg leading-[1.6] text-[var(--color-ink-3)]">
                {t.heroSub}
              </p>
            </Reveal>
            <Reveal delay={500}>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Button href="/add" size="lg" arrow>
                  {t.ctaAdd}
                </Button>
                <Button href="#how" size="lg" variant="glass">
                  {t.ctaHow}
                </Button>
              </div>
            </Reveal>
          </div>
          {/* 往下捲的提示 — 獨立佔位在內容下方，矮 viewport 不與內容重疊 */}
          <Reveal delay={650}>
            <div className="pointer-events-none flex flex-col items-center gap-2.5 pb-1">
              <span className="font-mono text-[10px] tracking-[0.14em] text-[var(--color-ink-3)]">
                SCROLL
              </span>
              <span className="relative h-8 w-px overflow-hidden bg-[rgba(255,255,255,0.12)]">
                <span className="scroll-dot absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[var(--color-accent)]" />
              </span>
            </div>
          </Reveal>
        </section>

        {/* ======================= THE GAP ======================= */}
        <section id="gap" className="px-6 py-28 sm:px-10">
          <div className="mx-auto w-full max-w-5xl">
            <Reveal>
              <p className="tag mb-6">{t.gapTag}</p>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="max-w-3xl text-4xl font-normal leading-[1.12] tracking-[-0.02em] text-[var(--color-ink)] md:text-5xl">
                {t.gapTitle}
              </h2>
            </Reveal>
            <Reveal delay={200}>
              <p className="mt-6 max-w-2xl text-lg leading-[1.7] text-[var(--color-ink-2)]">
                {t.gapBody}
              </p>
            </Reveal>
          </div>
        </section>

        {/* ======================= HOW IT WORKS ======================= */}
        <section id="how" className="px-6 py-28 sm:px-10">
          <div className="mx-auto w-full max-w-5xl">
            <Reveal>
              <p className="tag mb-6">{t.howTag}</p>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="max-w-3xl text-4xl font-normal leading-[1.12] tracking-[-0.02em] text-[var(--color-ink)] md:text-5xl">
                {t.howTitle}
              </h2>
            </Reveal>
            <MechanismSteps steps={t.howSteps} />
          </div>
        </section>

        {/* ======================= ARCHITECTURE ======================= */}
        <section id="architecture" className="px-6 py-28 sm:px-10">
          <div className="mx-auto w-full max-w-5xl">
            <Reveal>
              <p className="tag mb-6">{t.archTag}</p>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="max-w-3xl text-4xl font-normal leading-[1.12] tracking-[-0.02em] text-[var(--color-ink)] md:text-5xl">
                {t.archTitle}
              </h2>
            </Reveal>
            <TxShowcase />
          </div>
        </section>

        {/* ======================= EVIDENCE ======================= */}
        <section id="evidence" className="px-6 py-28 sm:px-10">
          <div className="mx-auto w-full max-w-5xl">
            <Reveal>
              <p className="tag mb-6">{t.evidenceTag}</p>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="max-w-3xl text-4xl font-normal leading-[1.12] tracking-[-0.02em] text-[var(--color-ink)] md:text-5xl">
                {t.evidenceTitle}
              </h2>
            </Reveal>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {t.evidenceCards.map((c, i) => (
                <Reveal key={c.title} delay={i * 110}>
                  <div className="h-full rounded-[10px] bg-[rgba(255,255,255,0.02)] p-6 shadow-[0_0_0_1px_var(--color-line)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[rgba(255,255,255,0.04)] hover:shadow-[0_0_0_1px_rgba(0,82,255,0.35),0_12px_36px_-16px_rgba(0,0,0,0.7)]">
                    <h3 className="text-[17px] font-medium tracking-[-0.01em] text-[var(--color-ink)]">
                      {c.title}
                    </h3>
                    <p className="mt-3 text-[15px] leading-[1.6] text-[var(--color-ink-2)]">
                      {c.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ======================= CTA ======================= */}
        <section className="px-6 py-32 sm:px-10">
          <div className="mx-auto w-full max-w-5xl">
            <Reveal>
              <h2 className="max-w-3xl text-4xl font-normal leading-[1.12] tracking-[-0.02em] text-[var(--color-ink)] md:text-6xl">
                {t.ctaLine1}
                <br />
                <span className="text-[var(--color-ink-3)]">{t.ctaLine2}</span>
              </h2>
            </Reveal>
            <Reveal delay={120}>
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <Button href="/add" size="lg" arrow>
                  {t.ctaAdd}
                </Button>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ======================= FOOTER ======================= */}
        <footer className="border-t border-[var(--color-line-soft)] px-6 py-10 sm:px-10">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <p className="text-[13px] font-normal text-[var(--color-ink-3)]">{t.footer}</p>
            <p className="tag">{t.footerTag}</p>
          </div>
        </footer>
      </LocaleTransition>

      <style jsx global>{`
        .anim-locale { animation: localeFade 320ms var(--ease-out); }
        @keyframes localeFade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .anim-locale { animation: none; }
        }
      `}</style>
    </main>
  );
}
