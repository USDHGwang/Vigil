"use client";

/**
 * 刷新時回到頁面最上面。
 *
 * Next.js App Router 會嘗試恢復瀏覽器上次的捲動位置（scroll restoration），
 * 導致 F5 刷新後停在頁面中間。這個組件在 mount 時強制回到頂部。
 * 只有「真正的整頁重載」才觸發——錨點點擊（#how）是 SPA 內滾動，不受影響。
 */

import { useEffect } from "react";

export default function ScrollReset() {
  useEffect(() => {
    // 用 history.scrollRestoration 讓瀏覽器不要自動恢復捲動
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
    window.scrollTo(0, 0);
    // 瀏覽器可能在 React mount 之後才恢復捲動位置 — rAF 再打一次
    const t = requestAnimationFrame(() => window.scrollTo(0, 0));
    return () => cancelAnimationFrame(t);
  }, []);

  return null;
}
