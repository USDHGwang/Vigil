import Link from "next/link";

/**
 * 404 — on-brand 空狀態（守夜人主題）。
 * 根 layout 已提供 Starfield 夜空背景；這裡只放文案與回家的路。
 */

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-[var(--color-accent)] text-[15px] font-semibold text-white shadow-[0_0_24px_-4px_rgba(0,82,255,0.8)]">
        V
      </span>
      <p className="mt-8 font-mono text-[11px] tracking-[0.2em] text-[var(--color-ink-3)] uppercase">
        404 — nothing here
      </p>
      <h1 className="mt-4 max-w-md text-3xl font-light tracking-[-0.02em] text-[var(--color-ink)]">
        The watchman saw nothing here.
      </h1>
      <p className="mt-3 max-w-sm text-[15px] leading-[1.6] text-[var(--color-ink-2)]">
        This page was never signed, never simulated, never verified. It doesn&rsquo;t exist on
        this chain.
      </p>
      <Link
        href="/"
        className="mt-10 rounded-full border border-[rgba(255,255,255,0.18)] px-6 py-2.5 text-[14px] font-medium text-[var(--color-ink)] transition hover:border-[var(--color-accent)] hover:text-white"
      >
        Back to the watch
      </Link>
    </main>
  );
}
