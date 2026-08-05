"use client";

/**
 * 機制段 — 三步 rollout 動畫 + 玻璃卡片 + 鼠標 spotlight。
 *
 * 玻璃質感沿用 nav 的語言（半透明白底 + backdrop-blur + 極細邊 + 內側微光），
 * 三步在滑進視口時依序帶入（animejs stagger）。鼠標互動是 Stripe/Linear 式
 * spotlight：radial 光暈跟隨滑鼠位置，hover 時浮起 + 邊框轉產品藍。
 * 不旋轉、不彈跳 — 信任產品的克制互動。
 */

import { useEffect, useRef } from "react";
import { animate, stagger } from "animejs";

interface Step {
  n: string;
  title: string;
  body: string;
}

export default function MechanismSteps({ steps }: { steps: readonly Step[] }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.querySelectorAll("[data-step]").forEach((s) =>
        (s as HTMLElement).style.opacity = "1",
      );
      return;
    }

    const steps = el.querySelectorAll("[data-step]");
    // 初始隱藏
    steps.forEach((s) => ((s as HTMLElement).style.opacity = "0"));

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            animate(steps, {
              opacity: [0, 1],
              translateY: [24, 0],
              duration: 700,
              delay: stagger(140),
              ease: "outExpo",
            });
            io.disconnect();
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /** spotlight 跟隨滑鼠：把游標位置寫成 CSS 變數，overlay 的 radial 光暈跟著走 */
  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty(
      "--mx",
      `${((e.clientX - rect.left) / rect.width) * 100}%`,
    );
    e.currentTarget.style.setProperty(
      "--my",
      `${((e.clientY - rect.top) / rect.height) * 100}%`,
    );
  };

  return (
    <div ref={ref} className="mt-14 grid gap-4 md:grid-cols-3">
      {steps.map((s, i) => (
        <div
          key={s.n}
          data-step
          onMouseMove={handleMove}
          className="group relative h-full overflow-hidden rounded-2xl border border-[rgba(255,255,255,0.10)] bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.02))] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_10px_36px_-18px_rgba(0,0,0,0.7)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-[rgba(120,160,255,0.35)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_18px_44px_-18px_rgba(0,0,0,0.85)]"
          style={{ opacity: 0, "--mx": "50%", "--my": "50%" } as React.CSSProperties}
        >
          {/* 鼠標 spotlight — hover 時浮現 */}
          <div
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(280px circle at var(--mx,50%) var(--my,50%), rgba(120,160,255,0.18), transparent 70%)",
            }}
          />
          <span className="tag mb-4 block text-[var(--color-ink-3)] transition-colors duration-300 group-hover:text-[#8ab4ff]">
            {s.n}
          </span>
          <h3
            className="text-[18px] font-medium tracking-[-0.01em]"
            style={{ color: i === steps.length - 1 ? "var(--color-match)" : "var(--color-ink-2)" }}
          >
            {s.title}
          </h3>
          <p className="mt-3 text-[15px] font-light leading-[1.65] text-[var(--color-ink-2)]">
            {s.body}
          </p>
        </div>
      ))}
    </div>
  );
}
