"use client";

/**
 * /add — 安裝分頁：把 Vigil 接進任何 MCP host。
 *
 * 結構：
 *  1. 複製並建置（clone + build:all）
 *  2. 本機安裝（stdio）— host 卡片：Claude Desktop / Claude Code /
 *     Hermes Agent / 任何 MCP host，各附可複製設定
 *  3. 遠端端點（https，部署後）
 *
 * 誠實邊界：本機路徑今天就能用；遠端要等部署或自己開隧道。
 * 設定片段用 <repo> 佔位——路徑是使用者自己的機器，填不了預設值。
 */

import { useState } from "react";
import Nav from "@/components/Nav";
import Starfield from "@/components/Starfield";
import Reveal from "@/components/Reveal";
import { useTranslation } from "@/i18n";
import { HostLogo, type HostLogoKind } from "./host-logos";

function CopyButton({
  text,
  label,
  copiedLabel,
}: {
  text: string;
  label: string;
  copiedLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch {
          /* clipboard 不可用時忽略（非主要路徑） */
        }
      }}
      aria-label={label}
      className={`rounded-full border px-3 py-1 font-mono text-[10px] tracking-[0.1em] transition-colors duration-200 active:scale-[0.97] ${
        copied
          ? "border-[#74a487] text-[#74a487]"
          : "border-[rgba(255,255,255,0.16)] text-[var(--color-ink-2)] hover:border-[var(--color-accent)] hover:text-white"
      }`}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}

function Snippet({ code, label, copiedLabel }: { code: string; label: string; copiedLabel: string }) {
  return (
    <div className="group/snippet relative mt-4 overflow-hidden rounded-[10px] border border-[rgba(255,255,255,0.08)] bg-[rgba(10,14,24,0.85)] transition-colors duration-300 hover:border-[rgba(255,255,255,0.16)]">
      <div className="absolute right-2.5 top-2.5 z-10">
        <CopyButton text={code} label={label} copiedLabel={copiedLabel} />
      </div>
      <pre className="overflow-x-auto px-4 pb-3.5 pt-11 pr-20 font-mono text-[12px] leading-[1.75] text-[var(--color-ink-2)]">
        {code}
      </pre>
    </div>
  );
}

export default function AddPage() {
  const t = useTranslation();
  const a = t.addPage;

  const cloneCode = `git clone https://github.com/USDHGwang/Vigil.git
cd Vigil/app && pnpm install && pnpm build:all`;

  const hosts: {
    glyph: string;
    logo?: HostLogoKind;
    name: string;
    steps: readonly string[];
    code: string;
    link?: { href: string; label: string };
  }[] = [
    {
      glyph: "◈",
      logo: "claude",
      name: "Claude (web)",
      steps: a.stepsClaudeWeb,
      code: "https://vigil-mcp.usdhgwang.workers.dev/mcp",
      // 官方 deep link：modal 預填名稱與正式 endpoint
      // （connectorUrl 參數，官網已上線）
      link: {
        href: "https://claude.ai/customize/connectors?modal=add-custom-connector&connectorName=Vigil&connectorUrl=https%3A%2F%2Fvigil-mcp.usdhgwang.workers.dev%2Fmcp",
        label: a.openInClaude,
      },
    },
    {
      glyph: "✦",
      logo: "openai",
      name: "ChatGPT",
      steps: a.stepsChatGPT,
      code: "https://vigil-mcp.usdhgwang.workers.dev/mcp",
      // ChatGPT 無 one-click deep link（官方限制），跳到 connectors 頁手動加
      link: { href: "https://chatgpt.com/connectors", label: a.openInGpt },
    },
    {
      glyph: "✦",
      logo: "claude",
      name: "Claude Desktop",
      steps: a.stepsClaudeDesktop,
      code: `{
  "mcpServers": {
    "vigil": {
      "command": "node",
      "args": ["<repo>/app/dist/cli.js"]
    }
  }
}`,
    },
    {
      glyph: ">_",
      logo: "claude",
      name: "Claude Code",
      steps: a.stepsCode,
      code: "claude mcp add --transport stdio vigil -s user -- node <repo>/app/dist/cli.js",
    },
    {
      glyph: "⌘",
      logo: "openai",
      name: "Codex",
      steps: a.stepsCodex,
      code: "codex mcp add vigil --command node --args <repo>/app/dist/cli.js",
    },
    {
      glyph: "❖",
      logo: "hermes",
      name: "Hermes Agent",
      steps: a.stepsHermes,
      code: `mcp_servers:
  vigil:
    command: "node"
    args: ["<repo>/app/dist/cli.js"]`,
    },
    {
      glyph: "⌘",
      logo: "opencode",
      name: "OpenCode",
      steps: a.stepsOpenCode,
      code: `{
  "mcp": {
    "vigil": {
      "type": "local",
      "command": ["node", "<repo>/app/dist/cli.js"],
      "enabled": true
    }
  }
}`,
    },
    {
      glyph: "⊞",
      logo: "mcp",
      name: a.cardAny,
      steps: a.stepsAny,
      code: `"vigil": {
  "command": "node",
  "args": ["<repo>/app/dist/cli.js"]
}`,
    },
  ];

  return (
    <main id="top" className="relative flex min-h-screen flex-col">
      <Starfield />
      <Nav />

      <div className="relative mx-auto w-full max-w-5xl flex-1 px-6 pt-32 pb-20 sm:px-10">
        <Reveal>
          <p className="tag-accent mb-6">MCP · INSTALL</p>
        </Reveal>
        <Reveal delay={80}>
          <h1 className="max-w-3xl text-4xl font-normal leading-[1.12] tracking-[-0.02em] text-[var(--color-ink)] md:text-5xl">
            {a.title}
          </h1>
        </Reveal>
        <Reveal delay={160}>
          <p className="mt-6 max-w-2xl text-lg leading-[1.7] text-[var(--color-ink-2)]">{a.sub}</p>
        </Reveal>

        {/* ── 1 · 複製並建置 ── */}
        <section className="mt-16">
          <Reveal>
            <h2 className="text-xl font-medium tracking-[-0.01em] text-[var(--color-ink)]">
              {a.stepCloneTitle}
            </h2>
            <p className="mt-2 max-w-xl text-[15px] leading-[1.65] text-[var(--color-ink-3)]">
              {a.stepCloneBody}
            </p>
            <Snippet code={cloneCode} label={a.copy} copiedLabel={a.copied} />
          </Reveal>
        </section>

        {/* ── 2 · 本機安裝 ── */}
        <section className="mt-20">
          <Reveal>
            <p className="tag mb-6">{a.localTag}</p>
          </Reveal>
          <div className="grid gap-4 md:grid-cols-2">
            {hosts.map((h, i) => (
              <Reveal key={h.name} delay={i * 90}>
                <div className="group h-full rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.015))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_36px_-18px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-0.5 hover:border-[rgba(255,255,255,0.18)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_18px_48px_-20px_rgba(0,0,0,0.85)]">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 place-items-center overflow-hidden rounded-[8px] border border-[rgba(120,160,255,0.25)] bg-[rgba(61,92,255,0.12)] transition-colors duration-300 group-hover:border-[rgba(120,160,255,0.5)] group-hover:bg-[rgba(61,92,255,0.2)]">
                      {h.logo ? <HostLogo kind={h.logo} className="h-4 w-4" /> : h.glyph}
                    </span>
                    <h3 className="text-[16px] font-medium tracking-[-0.01em] text-[var(--color-ink)] transition-colors duration-300 group-hover:text-white">
                      {h.name}
                    </h3>
                  </div>
                  <ol className="mt-3 space-y-1.5">
                    {h.steps.map((s, si) => (
                      <li key={si} className="flex items-start gap-2.5 text-[14px] leading-[1.55] text-[var(--color-ink-3)] transition-colors duration-300 group-hover:text-[var(--color-ink-2)]">
                        <span className="mt-[3px] grid h-[20px] w-[20px] shrink-0 place-items-center rounded-full border border-[rgba(120,160,255,0.3)] font-mono text-[11px] leading-none text-[#8ab4ff]">
                          {si + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                  {h.link && (
                    <a
                      href={h.link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-medium text-[#8ab4ff] transition-colors duration-300 hover:text-[#b9d6ff]"
                    >
                      {h.link.label}
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M7 17L17 7M7 7h10v10" />
                      </svg>
                    </a>
                  )}
                  <Snippet code={h.code} label={a.copy} copiedLabel={a.copied} />
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ── 3 · 遠端端點 ── */}
        <section className="mt-20">
          <Reveal>
            <p className="tag mb-6">{a.remoteTag}</p>
            <div className="max-w-3xl rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-6">
              <p className="text-[15px] leading-[1.7] text-[var(--color-ink-2)]">{a.remoteNote}</p>
              <div className="mt-4 inline-flex items-center gap-2.5 rounded-full border border-[rgba(255,255,255,0.10)] bg-[rgba(10,14,24,0.85)] px-5 py-2 font-mono text-[12px] tracking-[0.08em] text-[var(--color-ink-3)] transition-colors duration-300 hover:border-[rgba(255,255,255,0.2)] hover:text-[var(--color-ink-2)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#74a487]" />
                https://&lt;endpoint&gt;/mcp
              </div>
            </div>
          </Reveal>
        </section>

        {/* ── 信任聲明 ── */}
        <section className="mt-20">
          <Reveal>
            <p className="max-w-2xl border-l-2 border-[var(--color-accent)] pl-5 text-[15px] leading-[1.7] text-[var(--color-ink-2)]">
              {a.trust}
            </p>
          </Reveal>
          <Reveal delay={100}>
            <a
              href="https://github.com/USDHGwang/Vigil/blob/main/app/MCP-SETUP.md"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex items-center gap-2 text-[14.5px] font-medium text-[#8ab4ff] transition hover:text-white"
            >
              {a.docs}
            </a>
          </Reveal>
        </section>
      </div>

      <footer className="relative border-t border-[var(--color-line-soft)] px-6 py-10 sm:px-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
          <p className="text-[13px] font-normal text-[var(--color-ink-3)]">{t.footer}</p>
          <p className="tag">{t.footerTag}</p>
        </div>
      </footer>
    </main>
  );
}
