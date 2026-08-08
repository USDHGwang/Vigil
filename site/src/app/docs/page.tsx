"use client";

/**
 * /docs — 文件總覽。
 * 內容在 ./content.ts（en + zh-TW 雙語，其他語系 fallback en）。
 */

import Nav from "@/components/Nav";
import Starfield from "@/components/Starfield";
import Reveal from "@/components/Reveal";
import { useLocale } from "@/i18n";
import { docsFor } from "./content";

export default function DocsPage() {
  const { locale } = useLocale();
  const c = docsFor(locale).index;

  return (
    <main id="top" className="relative flex min-h-screen flex-col">
      <Starfield />
      <Nav />

      <div className="relative mx-auto w-full max-w-4xl flex-1 px-6 pt-32 pb-20 sm:px-10">
        <Reveal>
          <p className="tag-accent mb-6">{c.tag}</p>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="max-w-3xl text-4xl font-normal leading-[1.12] tracking-[-0.02em] text-[var(--color-ink)] md:text-5xl">
            {c.title}
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mt-6 max-w-2xl text-lg leading-[1.7] text-[var(--color-ink-2)]">{c.sub}</p>
        </Reveal>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {c.sections.map((s, i) => (
            <Reveal key={s.href} delay={i * 90}>
              <a
                href={s.href}
                className="group block h-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_36px_-18px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:border-[rgba(255,255,255,0.18)]"
              >
                <span className="font-mono text-[11px] tracking-[0.08em] text-[#8ab4ff]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <h2 className="mt-2 text-[16px] font-medium tracking-[-0.01em] text-[var(--color-ink)] transition-colors duration-300 group-hover:text-white">
                  {s.title}
                </h2>
                <p className="mt-2 text-[13.5px] leading-[1.6] text-[var(--color-ink-3)] transition-colors duration-300 group-hover:text-[var(--color-ink-2)]">
                  {s.body}
                </p>
              </a>
            </Reveal>
          ))}
        </div>

        <Reveal delay={200}>
          <a
            href="/"
            className="mt-12 inline-flex items-center gap-2 text-[14px] font-medium text-[var(--color-ink-3)] transition hover:text-white"
          >
            <span aria-hidden>←</span> {c.back}
          </a>
        </Reveal>
      </div>
    </main>
  );
}
