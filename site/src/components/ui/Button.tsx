"use client";

/**
 * Vigil 按鈕 — 高質感 + 動畫。
 *
 * 三種變體（primary / ghost / glass），共通：hover 光暈、按下 scale 回饋、
 * 顯眼 focus ring、箭頭 hover 位移。背後邏輯留空（onClick 由 caller 決定）。
 * 用 <a> 以便錨點滾動，也支援 <button>。
 */

import { useRef, type ReactNode, type MouseEvent } from "react";

type Variant = "primary" | "ghost" | "glass";

interface ButtonProps {
  children: ReactNode;
  variant?: Variant;
  href?: string;
  onClick?: (e: MouseEvent) => void;
  className?: string;
  size?: "md" | "lg";
  arrow?: boolean;
}

const sizes = {
  md: "px-5 py-2.5 text-[14.5px]",
  lg: "px-7 py-4 text-[15.5px]",
};

export default function Button({
  children,
  variant = "primary",
  href,
  onClick,
  className = "",
  size = "md",
  arrow = false,
}: ButtonProps) {
  const ref = useRef<HTMLAnchorElement | null>(null);

  const baseStyle: React.CSSProperties =
    variant === "primary"
      ? {
          // 玻璃：透出背景星空 + 模糊 + 極淡白底讓文字可讀
          background: "linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))",
          color: "#fff",
          backdropFilter: "blur(14px) saturate(140%)",
          WebkitBackdropFilter: "blur(14px) saturate(140%)",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,0.18), 0 0 0 1px rgba(255,255,255,0.12), 0 6px 24px -10px rgba(0,0,0,0.5), 0 0 24px -8px rgba(80,140,255,0.35)",
          textShadow: "0 1px 0 rgba(0,0,0,0.2)",
          border: "1px solid rgba(255,255,255,0.10)",
        }
      : variant === "ghost"
        ? {
            color: "var(--color-ink)",
            boxShadow: "0 0 0 1px var(--color-line)",
            background: "transparent",
          }
        : {
            // glass：玻璃透星空，更淡，hover 才亮
            color: "var(--color-ink)",
            background: "rgba(255,255,255,0.04)",
            backdropFilter: "blur(10px) saturate(130%)",
            WebkitBackdropFilter: "blur(10px) saturate(130%)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 0 0 1px rgba(255,255,255,0.07)",
          };

  const cls = `group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-[9px] font-medium transition-all duration-200 ${
    sizes[size]
  } ${className}`;

  const content = (
    <>
      {/* primary：一圈流光邊框（透星空玻璃底 + 邊框流光） */}
      {variant === "primary" && (
        <span className="shine-border" aria-hidden />
      )}
      {/* hover 光暈 sweep（primary）— 淡藍，配合玻璃透星空 */}
      {variant === "primary" && (
        <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-[rgba(120,170,255,0.18)] to-transparent transition-transform duration-700 ease-out group-hover:translate-x-full" />
      )}
      {/* 常駐底部微光線（ghost） */}
      {variant === "ghost" && (
        <span className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)]/60 to-transparent opacity-0 transition group-hover:opacity-100" />
      )}
      <span className="relative">{children}</span>
      {arrow && (
        <span className="relative transition-transform duration-200 group-hover:translate-x-1">
          →
        </span>
      )}
    </>
  );

  // 字母間距 / 字重補丁
  const contentStyle: React.CSSProperties =
    variant === "primary"
      ? { textShadow: "0 1px 0 rgba(0,0,0,0.12)" }
      : {};

  const body = <span style={contentStyle}>{content}</span>;

  if (href) {
    // 外部連結（http/https）開新分頁，不離開 landing
    const external = /^https?:/.test(href);
    return (
      <a
        ref={ref}
        href={href}
        onClick={onClick}
        className={cls}
        style={baseStyle}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {body}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls} style={baseStyle}>
      {body}
    </button>
  );
}
