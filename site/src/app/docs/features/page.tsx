"use client";

/**
 * /docs/features — MCP 功能：工具清單、HTML 面板資源、傳輸方式、簽名頁。
 * 內容事實來源：app/src/mcp/server.ts 與 app/MCP-SETUP.md（已查證）。
 */

import Nav from "@/components/Nav";
import Starfield from "@/components/Starfield";
import Reveal from "@/components/Reveal";
import { useLocale } from "@/i18n";
import { docsFor } from "../content";

export default function FeaturesPage() {
  const { locale } = useLocale();
  const c = docsFor(locale).features;

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

        {/* ── 工具清單 ── */}
        <section className="mt-16">
          <Reveal>
            <p className="tag mb-6">{c.toolsTag}</p>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2">
            {c.tools.map((tool, i) => (
              <Reveal key={tool.name} delay={i * 80}>
                <div className="group flex h-full flex-col rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_36px_-18px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:border-[rgba(255,255,255,0.18)]">
                  <div className="flex items-center gap-2.5">
                    <span className="rounded-full border border-[rgba(120,160,255,0.3)] bg-[rgba(61,92,255,0.12)] px-2 py-0.5 font-mono text-[10px] tracking-[0.08em] text-[#8ab4ff]">
                      {tool.badge}
                    </span>
                    <h2 className="font-mono text-[14px] font-medium tracking-[-0.01em] text-[var(--color-ink)] transition-colors duration-300 group-hover:text-white">
                      {tool.name}
                    </h2>
                  </div>
                  <p className="mt-3 text-[14.5px] font-medium leading-[1.55] text-[var(--color-ink-2)]">
                    {tool.title}
                  </p>
                  <p className="mt-2 text-[13.5px] leading-[1.65] text-[var(--color-ink-3)] transition-colors duration-300 group-hover:text-[var(--color-ink-2)]">
                    {tool.body}
                  </p>
                  <p className="mt-3 border-l-2 border-[rgba(120,160,255,0.3)] pl-3 text-[12.5px] leading-[1.6] text-[var(--color-ink-3)]">
                    {tool.detail}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── HTML 面板資源 ── */}
        <section className="mt-20">
          <Reveal>
            <p className="tag mb-6">{c.resourceTag}</p>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-1">
            {c.resources.map((r, i) => (
              <Reveal key={r.uri} delay={i * 80}>
                <div className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.02)] p-6">
                  <div className="flex items-center gap-2.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#74a487]" />
                    <span className="font-mono text-[13px] text-[#74a487]">{r.uri}</span>
                  </div>
                  <h2 className="mt-3 text-[16px] font-medium tracking-[-0.01em] text-[var(--color-ink)]">
                    {r.title}
                  </h2>
                  <p className="mt-2 text-[14px] leading-[1.7] text-[var(--color-ink-3)]">{r.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── 傳輸方式 ── */}
        <section id="transport" className="mt-20 scroll-mt-28">
          <Reveal>
            <p className="tag mb-6">{c.transportTag}</p>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2">
            {c.transports.map((tr, i) => (
              <Reveal key={tr.name} delay={i * 80}>
                <div className="h-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] p-6">
                  <h2 className="font-mono text-[14px] font-medium tracking-[-0.01em] text-[var(--color-ink)]">
                    {tr.name}
                  </h2>
                  <p className="mt-1 text-[13px] font-medium text-[var(--color-ink-2)]">{tr.title}</p>
                  <p className="mt-2 text-[13.5px] leading-[1.65] text-[var(--color-ink-3)]">{tr.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── 簽名頁 ── */}
        <section id="sign" className="mt-20 scroll-mt-28">
          <Reveal>
            <p className="tag mb-6">{c.signTag}</p>
          </Reveal>
          <Reveal>
            <div className="rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.02)] p-6">
              <h2 className="text-[16px] font-medium tracking-[-0.01em] text-[var(--color-ink)]">
                {c.sign.title}
              </h2>
              <p className="mt-2 text-[14px] leading-[1.7] text-[var(--color-ink-2)]">{c.sign.body}</p>
              <ul className="mt-4 space-y-2.5">
                {c.sign.points.map((p, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-[13.5px] leading-[1.6] text-[var(--color-ink-3)]">
                    <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#8ab4ff]" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </section>

        <Reveal delay={100}>
          <a
            href="/docs"
            className="mt-12 inline-flex items-center gap-2 text-[14px] font-medium text-[var(--color-ink-3)] transition hover:text-white"
          >
            <span aria-hidden>←</span> Docs
          </a>
        </Reveal>
      </div>
    </main>
  );
}
