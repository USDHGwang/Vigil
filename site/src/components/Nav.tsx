"use client";

/**
 * 頂部導覽 — 大廠玻璃質感。
 *
 * Glassmorphism 作法（Apple/Linear 那套）：純色底 + backdrop-blur 毛玻璃 +
 * 最細的半透明白框 + 頂端一線內光。滾動後才把「玻璃」從透明喚醒，
 * 保持首屏乾淨。active 段落在 nav 標示。
 *
 * 「Add」按鈕背後邏輯留空，只做視覺。
 */

import { useEffect, useState } from "react";
import { LocaleToggle, useTranslation } from "@/i18n";
import Logo from "@/components/Logo";

export default function Nav() {
  const t = useTranslation();
  const links = [
    { href: "#gap", label: t.navGap },
    { href: "#how", label: t.navHow },
    { href: "#evidence", label: t.navEvidence },
  ];
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-3 sm:px-6">
      <nav
        className="flex w-full max-w-4xl items-center justify-between rounded-full px-4 py-2.5 transition-all duration-500 sm:px-6"
        style={{
          // 玻璃質感：半透明白底 + 毛玻璃模糊 + 極細邊 + 內側微光
          background: scrolled
            ? "linear-gradient(rgba(255,255,255,0.06), rgba(255,255,255,0.03))"
            : "transparent",
          backdropFilter: scrolled ? "blur(20px) saturate(160%)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(20px) saturate(160%)" : "none",
          border: scrolled ? "1px solid rgba(255,255,255,0.10)" : "1px solid transparent",
          boxShadow: scrolled
            ? "0 1px 0 0 rgba(255,255,255,0.06) inset, 0 8px 32px -16px rgba(0,0,0,0.6)"
            : "none",
        }}
      >
        <a href="#top" className="group flex items-center gap-2.5">
          <Logo className="h-7 w-auto shrink-0 text-[var(--color-ink)] transition duration-300 group-hover:text-white" />
          <span className="tracking-[-0.02em] text-[15px] font-medium text-[var(--color-ink)] transition duration-300 group-hover:text-white">
            Vigil
          </span>
        </a>

        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-1.5 text-[13.5px] font-medium text-[var(--color-ink-3)] transition hover:bg-[rgba(255,255,255,0.06)] hover:text-[var(--color-ink)]"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <LocaleToggle />
          {/* 玻璃按鈕：外框透白 + hover 填充 */}
          <a
            href="#how"
            className="group relative overflow-hidden rounded-full border border-[rgba(255,255,255,0.18)] px-4 py-1.5 text-[13.5px] font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-white"
          >
            {/* hover 光暈 */}
            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[rgba(0,82,255,0.35)] to-transparent transition-transform duration-500 group-hover:translate-x-full" />
            <span className="relative">{t.addShort}</span>
          </a>
        </div>
      </nav>
    </header>
  );
}
