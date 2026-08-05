"use client";

/**
 * 守夜人黎明 — 背景隨滑動轉變。
 *
 * 敘事：守夜人徹夜看守，下滑到後半段，背景地平線開始泛起晨光（最暗後將
 * 亮），星點隨之淡出、天際微暖。象徵「守到你安全的那一刻」。
 *
 * 實作：用 scroll 進度驅動 `<html>` 上的 CSS 變數 `--daybreak`（0→1）。
 * 背景顏色與元素依賴這個變數做 interpolate。scroll listener + rAF，
 * 尊重 prefers-reduced-motion（鎖死 night）。
 */

import { useEffect } from "react";

export default function Daybreak() {
  useEffect(() => {
    const html = document.documentElement;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      html.style.setProperty("--daybreak", "0");
      html.style.setProperty("--star-drift", "0px");
      return;
    }

    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        // 滾動進度：0(頂) → 1(底)
        const doc = document.documentElement;
        const max = doc.scrollHeight - window.innerHeight;
        const t = max > 0 ? Math.min(Math.max(window.scrollY / max, 0), 1) : 0;
        // 讓轉變集中在中後段（0.35 以後才明顯）— 前面 35% 保持深夜
        const p = Math.max(0, (t - 0.2) / 0.8);
        html.style.setProperty("--daybreak", String(p));
        // 星際視差：背景天空物件緩慢上移（比內容慢 ~4%），深度感
        html.style.setProperty("--star-drift", `${window.scrollY * -0.04}px`);
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  return null;
}
