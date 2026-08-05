"use client";

/**
 * animejs 驅動的 scroll reveal。
 *
 * 用 CSS `.reveal-init`（opacity:0 + 位移）設初始態，animejs 進場時清除，
 * 避免 inline style 卡住 opacity=0 的 FOUC 問題。元素進到視口才播，只播一次。
 * respect prefers-reduced-motion。
 */

import { useEffect, useRef, type ReactNode } from "react";
import { animate } from "animejs";

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}

export default function Reveal({ children, delay = 0, y = 26, className }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.remove("reveal-init");
      return;
    }

    // 若元素已在視口內 → 直接播（不等 observer，避免永遠卡在隱藏態）
    const run = () => {
      el.classList.remove("reveal-init");
      animate(el, {
        opacity: [0, 1],
        translateY: [y, 0],
        duration: 900,
        delay,
        ease: "outExpo",
      });
    };

    const rect = el.getBoundingClientRect();
    const inView =
      rect.top < window.innerHeight && rect.bottom > 0 && rect.top >= 0;

    if (inView) {
      // 小延遲等 paint 完成
      requestAnimationFrame(run);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            run();
            io.disconnect();
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [delay, y]);

  return (
    <div ref={ref} className={`reveal-init ${className ?? ""}`}>
      {children}
    </div>
  );
}
