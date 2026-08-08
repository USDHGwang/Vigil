"use client";

/**
 * TxShowcase — 一筆交易被看顧的旅程（GSAP ScrollTrigger 版 · v4）。
 *
 * v4 修正（John 回饋 08-06）：
 *  - 後四幕素材重做：不再用「圖示代表一件事」，改「系統在做事」——
 *    03 trace 結構化輸出、04 雙欄比對對齊線、05 指紋字串傳遞、
 *    06 SIGN/REJECT 選擇 + 廣播上鏈。
 *  - 素材交互：流動線、cascade、對齊線、字元鎖定、按鍵浮現。
 *  - 反 Slop：零光暈球/脈衝環/轉圈/粒子，只有 mono 排版 + 細線 + 產品色。
 *
 * 結構：550vh runway + ScrollTrigger pin。六幕，每幕 1 單位 timeline。
 * 指紋字串為 demo 值（4F8C A2D1），文案為草稿，待 John 對稿。
 */

import { useEffect, useRef } from "react";
import { useTranslation } from "@/i18n";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function TxShowcase() {
  const t = useTranslation();
  const acts = t.showcase.acts;
  const s = t.showcase.scene;
  // onUpdate / updateLabel 在 effect closure 裡，locale 切換後要讀最新的 acts
  const actsRef = useRef(acts);
  actsRef.current = acts;

  const mountRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const railRefs = useRef<(HTMLDivElement | null)[]>([]);
  const labelNumRef = useRef<HTMLSpanElement>(null);
  const labelTitleRef = useRef<HTMLHeadingElement>(null);
  const labelBodyRef = useRef<HTMLParagraphElement>(null);
  const lastActRef = useRef(0);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const ctx = gsap.context(() => {
      const scenes = gsap.utils.toArray<HTMLElement>("[data-scene]");
      const byId = (id: string) => mount.querySelector<HTMLElement>(`[data-anim="${id}"]`);

      gsap.set(scenes, { autoAlpha: 0 });
      gsap.set(scenes[0], { autoAlpha: 1 });

      const updateLabel = (act: number, animate: boolean) => {
        if (!labelNumRef.current || !labelTitleRef.current || !labelBodyRef.current) return;
        const targets = [labelNumRef.current, labelTitleRef.current, labelBodyRef.current];
        gsap.killTweensOf(targets);
        const A = actsRef.current;
        labelNumRef.current.textContent = A[act].num;
        labelTitleRef.current.textContent = A[act].title;
        labelBodyRef.current.textContent = A[act].body;
        if (animate) {
          gsap.fromTo(
            targets,
            { autoAlpha: 0, y: 10 },
            { autoAlpha: 1, y: 0, duration: 0.32, ease: "power2.out", overwrite: true },
          );
        }
      };

      if (reduced) return;

      const tl = gsap.timeline({
        defaults: { ease: "power2.out" },
        scrollTrigger: {
          trigger: mount,
          start: "top top",
          end: "bottom bottom",
          pin: stageRef.current,
          scrub: 0.5,
          anticipatePin: 1,
          onUpdate: (self) => {
            const p = self.progress;
            const act = Math.min(actsRef.current.length - 1, Math.floor(p * actsRef.current.length));
            const local = p * actsRef.current.length - act;

            if (act !== lastActRef.current) {
              updateLabel(act, true);
              lastActRef.current = act;
            }

            railRefs.current.forEach((seg, i) => {
              if (!seg) return;
              const done = i < act;
              const cur = i === act;
              seg.classList.toggle("seg-done", done);
              seg.classList.toggle("seg-current", cur);
              seg.style.transform = cur ? `scaleX(${0.2 + local * 0.8})` : "scaleX(1)";
            });
          },
        },
      });

      /* ---- 每幕：縮放沉澱 ---- */
      scenes.forEach((sc, k) => {
        tl.fromTo(sc, { scale: 1.04 }, { scale: 1, duration: 0.92, ease: "power1.out" }, k + 0.04);
      });

      /* ---- 幕間交叉淡化 ---- */
      for (let k = 0; k < scenes.length - 1; k++) {
        tl.to(scenes[k], { autoAlpha: 0, duration: 0.28, ease: "power1.inOut" }, k + 0.74);
        tl.set(scenes[k + 1], { autoAlpha: 1 }, k + 0.92);
      }

      /* ================= ACT 1 · say（0–1） ================= */
      const bubble = byId("bubble");
      const orb = byId("orb");
      if (bubble) {
        tl.fromTo(
          bubble,
          { autoAlpha: 0, y: 16 },
          { autoAlpha: 1, y: 0, duration: 0.5, ease: "power2.out" },
          0.02,
        );
      }
      if (orb) {
        tl.fromTo(
          orb,
          { autoAlpha: 0, scale: 0.85 },
          { autoAlpha: 1, scale: 1, duration: 0.4, ease: "power2.out" },
          0.3,
        );
      }

      /* ================= ACT 2 · build（1–2） ================= */
      const txCard = byId("txCard");
      const rows = gsap.utils.toArray<HTMLElement>("[data-anim^='row']");
      if (txCard) {
        tl.fromTo(
          txCard,
          { autoAlpha: 0, y: 14 },
          { autoAlpha: 1, y: 0, duration: 0.45, ease: "power2.out" },
          1.02,
        );
      }
      tl.fromTo(
        rows,
        { autoAlpha: 0, x: 24 },
        { autoAlpha: 1, x: 0, duration: 0.35, stagger: 0.12, ease: "power2.out" },
        1.18,
      );

      /* ================= ACT 3 · simulate（2–3） ================= */
      const callIn = byId("callIn");
      const flowDot = byId("flowDot");
      const nodeBox = byId("nodeBox");
      const traceRows = gsap.utils.toArray<HTMLElement>("[data-anim^='trace']");
      if (callIn) {
        tl.fromTo(
          callIn,
          { autoAlpha: 0, y: -16 },
          { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" },
          2.02,
        );
      }
      if (flowDot) {
        tl.fromTo(
          flowDot,
          { yPercent: -50, autoAlpha: 0 },
          { yPercent: 120, autoAlpha: 0.9, duration: 0.38, ease: "power1.in" },
          2.1,
        );
        tl.to(flowDot, { autoAlpha: 0, duration: 0.12 }, 2.46);
      }
      if (nodeBox) {
        tl.fromTo(
          nodeBox,
          { autoAlpha: 0, y: 8 },
          { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" },
          2.1,
        );
      }
      tl.fromTo(
        traceRows,
        { autoAlpha: 0, y: 8 },
        { autoAlpha: 1, y: 0, duration: 0.3, stagger: 0.14, ease: "power2.out" },
        2.32,
      );

      /* ================= ACT 4 · verify（3–4） ================= */
      const claimRows = gsap.utils.toArray<HTMLElement>("[data-anim^='claim']");
      const resRows = gsap.utils.toArray<HTMLElement>("[data-anim^='res']");
      const lines = gsap.utils.toArray<HTMLElement>("[data-anim^='line']");
      const verdict = byId("verdict");
      tl.fromTo(
        claimRows,
        { autoAlpha: 0, x: -20 },
        { autoAlpha: 1, x: 0, duration: 0.35, stagger: 0.12, ease: "power2.out" },
        3.04,
      );
      tl.fromTo(
        resRows,
        { autoAlpha: 0, x: 20 },
        { autoAlpha: 1, x: 0, duration: 0.35, stagger: 0.12, ease: "power2.out" },
        3.2,
      );
      tl.fromTo(
        lines,
        { scaleX: 0, transformOrigin: "0% 50%" },
        { scaleX: 1, duration: 0.35, stagger: 0.1, ease: "power2.inOut" },
        3.5,
      );
      if (verdict) {
        tl.fromTo(
          verdict,
          { autoAlpha: 0, y: 10 },
          { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" },
          3.8,
        );
      }

      /* ================= ACT 5 · fingerprint（4–5） ================= */
      const fpTop = byId("fpTop");
      const fpFlow = byId("fpFlow");
      const fpBot = byId("fpBot");
      const lock = byId("lock");
      if (fpTop) {
        tl.fromTo(
          fpTop,
          { autoAlpha: 0, y: -12, clipPath: "inset(0 100% 0 0)" },
          { autoAlpha: 1, y: 0, clipPath: "inset(0 0% 0 0)", duration: 0.45, ease: "power2.inOut" },
          4.02,
        );
      }
      if (fpFlow) {
        tl.fromTo(
          fpFlow,
          { yPercent: -40, autoAlpha: 0 },
          { yPercent: 140, autoAlpha: 0.9, duration: 0.4, ease: "power1.in" },
          4.2,
        );
        tl.to(fpFlow, { autoAlpha: 0, duration: 0.12 }, 4.56);
      }
      if (fpBot) {
        tl.fromTo(
          fpBot,
          { autoAlpha: 0, y: 12, clipPath: "inset(0 100% 0 0)" },
          { autoAlpha: 1, y: 0, clipPath: "inset(0 0% 0 0)", duration: 0.45, ease: "power2.inOut" },
          4.4,
        );
      }
      if (lock) {
        tl.fromTo(
          lock,
          { autoAlpha: 0, y: 8 },
          { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" },
          4.7,
        );
      }

      /* ================= ACT 6 · decide（5–6） ================= */
      const txArrive = byId("txArrive");
      const decideLabel = byId("decideLabel");
      const btnSign = byId("btnSign");
      const btnReject = byId("btnReject");
      const chainUp = byId("chainUp");
      const blks = [0, 1, 2].map((i) => byId(`blk${i}`));
      const dawn = byId("dawn");
      if (txArrive) {
        tl.fromTo(
          txArrive,
          { autoAlpha: 0, y: -14 },
          { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" },
          5.02,
        );
      }
      if (decideLabel) {
        tl.fromTo(
          decideLabel,
          { autoAlpha: 0, y: 8 },
          { autoAlpha: 1, y: 0, duration: 0.3, ease: "power2.out" },
          5.16,
        );
      }
      if (btnSign) {
        tl.fromTo(
          btnSign,
          { autoAlpha: 0, y: 10 },
          { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" },
          5.28,
        );
      }
      if (btnReject) {
        tl.fromTo(
          btnReject,
          { autoAlpha: 0, y: 10 },
          { autoAlpha: 1, y: 0, duration: 0.35, ease: "power2.out" },
          5.36,
        );
      }
      // 簽署 → SIGN 實心亮起（狀態改變）→ 卡片沉到鏈上，區塊依序點亮
      if (btnSign) {
        tl.to(
          btnSign,
          {
            backgroundColor: "rgba(116,164,135,0.85)",
            color: "#0c0e14",
            borderColor: "#74a487",
            duration: 0.25,
            ease: "power1.out",
          },
          5.44,
        );
      }
      if (txArrive) {
        tl.to(
          txArrive,
          { y: 14, duration: 0.7, ease: "power2.inOut", overwrite: "auto" },
          5.5,
        );
      }
      if (chainUp) {
        tl.fromTo(
          chainUp,
          { scaleX: 0, transformOrigin: "0% 50%" },
          { scaleX: 1, duration: 0.55, ease: "power2.inOut" },
          5.54,
        );
      }
      blks.forEach((b, i) => {
        if (b) {
          tl.to(
            b,
            {
              backgroundColor: "rgba(120,160,255,0.8)",
              borderColor: "rgba(120,160,255,0.9)",
              duration: 0.2,
              ease: "power1.out",
            },
            5.56 + i * 0.06,
          );
        }
      });
      if (dawn) {
        tl.fromTo(
          dawn,
          { autoAlpha: 0 },
          { autoAlpha: 1, duration: 0.7, ease: "power1.inOut" },
          5.66,
        );
      }
    }, mount);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={mountRef} className="relative mt-16 h-[550vh]">
      {/* 停駐舞台（ScrollTrigger pin） */}
      <div ref={stageRef} className="flex h-screen items-center justify-center overflow-hidden">
        <div className="relative h-[70vh] w-full max-w-5xl px-6">
          {/* 進度 rail（左） */}
          <div className="absolute top-1/2 left-2 flex -translate-y-1/2 flex-col items-center gap-3 sm:left-6">
            <div className="flex flex-col items-center gap-4">
              {acts.map((a, i) => (
                <div key={a.num} className="relative flex flex-col items-center">
                  <div
                    ref={(node) => {
                      railRefs.current[i] = node;
                    }}
                    className="h-[3px] w-10 origin-left rounded-full bg-[rgba(255,255,255,0.12)] transition-colors duration-300"
                  />
                  {i < acts.length - 1 && <div className="mt-1 h-4 w-px bg-[rgba(255,255,255,0.08)]" />}
                </div>
              ))}
            </div>
          </div>

          {/* 幕標籤（左下）— 壓縮過：body 收窄、行距收緊 */}
          <div className="absolute bottom-8 left-6 max-w-[300px] sm:left-24">
            <span
              ref={labelNumRef}
              className="font-mono text-[12px] font-medium tracking-[0.11em] text-[var(--color-accent)]"
            >
              01
            </span>
            <h3
              ref={labelTitleRef}
              className="mt-1.5 text-2xl font-normal tracking-[-0.02em] text-[var(--color-ink)]"
            >
              You say a word
            </h3>
            <p
              ref={labelBodyRef}
              className="mt-1.5 text-[14px] leading-[1.55] text-[var(--color-ink-2)]"
            >
              Your intent takes shape. Nothing is built yet.
            </p>
          </div>

          {/* 六幕場景 — pb-36 把置中盒上移，避開底部幕標籤區（高場景不碰撞） */}
          <div className="absolute inset-0 flex items-center justify-center pb-36">
            {/* 01 · say */}
            <div data-scene="0" className="absolute opacity-0">
              <div className="flex flex-col items-center gap-6">
                <div
                  data-anim="bubble"
                  className="w-[340px] rounded-2xl border border-[rgba(255,255,255,0.13)] bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] px-5 py-4 shadow-[0_0_50px_rgba(61,92,255,0.16),inset_0_1px_0_rgba(255,255,255,0.08)]"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,rgba(0,82,255,0.9),rgba(61,92,255,0.55))] text-[12px] font-semibold text-white shadow-[0_0_16px_rgba(0,82,255,0.5)]">
                      V
                    </div>
                    <div>
                      <p className="mt-1 text-[16px] font-normal tracking-[-0.01em] text-[var(--color-ink)]">
                        &ldquo;{s.bubble}&rdquo;
                      </p>
                    </div>
                  </div>
                </div>
                <div
                  data-anim="orb"
                  className="h-4 w-4 rounded-full bg-[rgba(120,160,255,0.95)] shadow-[0_0_26px_rgba(61,92,255,0.95),0_0_6px_rgba(160,190,255,1)]"
                />
              </div>
            </div>

            {/* 02 · build */}
            <div data-scene="1" className="absolute opacity-0">
              <div
                data-anim="txCard"
                className="w-[360px] rounded-2xl bg-[linear-gradient(160deg,rgba(120,160,255,0.28),rgba(255,255,255,0.06)_38%,rgba(61,92,255,0.18))] p-px shadow-[0_0_70px_rgba(61,92,255,0.14)]"
              >
                <div className="rounded-[15px] bg-[#0c0e14] p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="grid h-5 w-5 place-items-center rounded-[6px] bg-[rgba(0,82,255,0.25)] text-[11px] text-[#8ab4ff]">
                        ◈
                      </span>
                      <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--color-ink-3)]">
                        Transaction
                      </span>
                    </div>
                    <span className="status-dot h-2 w-2 rounded-full bg-[#74a487]" />
                  </div>
                  {[
                    { k: "TO", v: "shMONAD", w: "text-[#8ab4ff]" },
                    { k: "ACTION", v: "stake", w: "text-[var(--color-ink)]" },
                    { k: "DATA", v: "calldata", w: "text-[var(--color-ink-3)]" },
                  ].map((r) => (
                    <div
                      key={r.k}
                      data-anim={`row-${r.k.toLowerCase()}`}
                      className="mb-2.5 flex items-center justify-between rounded-[10px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.025)] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]"
                    >
                      <span className="font-mono text-[11px] tracking-[0.1em] text-[var(--color-ink-3)]">
                        {r.k}
                      </span>
                      <span className={`font-mono text-[12px] tracking-[0.08em] ${r.w}`}>
                        {r.v}
                      </span>
                    </div>
                  ))}
                  <div className="mt-4 flex justify-end">
                    <span className="rounded-full border border-[rgba(120,160,255,0.35)] px-4 py-1.5 font-mono text-[11px] tracking-[0.1em] text-[#8ab4ff]">
                      {s.simulate}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 03 · simulate — 呼叫流進節點，TRACE 結果噴出 */}
            <div data-scene="2" className="absolute opacity-0">
              <div className="flex w-[400px] flex-col items-stretch gap-0">
                <div className="flex items-center justify-between">
                  <div
                    data-anim="callIn"
                    className="flex items-center gap-2.5 rounded-lg border border-[rgba(120,160,255,0.35)] bg-[rgba(61,92,255,0.1)] px-4 py-1.5"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-[#8ab4ff]" />
                    <span className="font-mono text-[11px] tracking-[0.1em] text-[#8ab4ff]">
                      CALL · simulate
                    </span>
                  </div>
                </div>

                {/* 流動線 */}
                <div className="relative mx-4 h-7 w-px bg-[rgba(255,255,255,0.12)]">
                  <div
                    data-anim="flowDot"
                    className="absolute -left-[2.5px] top-0 h-[6px] w-[6px] rounded-full bg-[#8ab4ff] shadow-[0_0_8px_rgba(120,160,255,0.9)]"
                  />
                </div>

                <div
                  data-anim="nodeBox"
                  className="flex items-center justify-between rounded-[10px] border border-[rgba(255,255,255,0.16)] bg-[rgba(14,16,22,0.96)] px-5 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_0_1px_rgba(0,0,0,0.4)]"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-4 w-4 place-items-center rounded-[4px] bg-[rgba(0,82,255,0.3)] text-[10px] text-[#8ab4ff]">
                      ◈
                    </span>
                    <span className="font-mono text-[11px] tracking-[0.1em] text-[var(--color-ink)]">
                      MONAD NODE
                    </span>
                  </div>
                  <span className="font-mono text-[10px] tracking-[0.1em] text-[#74a487]">
                    ● mainnet
                  </span>
                </div>

                {/* TRACE 輸出 */}
                <div className="mt-4">
                  <p className="mb-1.5 font-mono text-[10px] tracking-[0.1em] text-[var(--color-ink-3)]">
                    TRACE
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {["balanceOf", "stake", "transfer", "gas"].map((op, i) => (
                      <div
                        key={op}
                        data-anim={`trace-${i}`}
                        className="flex items-center justify-between rounded-[8px] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] px-4 py-1.5"
                      >
                        <span className="flex items-center gap-3">
                          <span className="font-mono text-[11px] text-[var(--color-ink-3)]">
                            ▸
                          </span>
                          <span className="font-mono text-[12px] tracking-[0.05em] text-[var(--color-ink-2)]">
                            {op}
                          </span>
                        </span>
                        <span className="h-1.5 w-1.5 rounded-full bg-[#74a487]" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 04 · verify — 雙欄比對 + 對齊線 + verdict */}
            <div data-scene="3" className="absolute opacity-0">
              <div className="flex w-[440px] flex-col items-center gap-5">
                <div className="grid w-full grid-cols-[1fr_44px_1fr] items-center gap-0">
                  {/* AGENT SAID */}
                  <div>
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-3)]">
                      {s.agentSaid}
                    </p>
                    {["stake", "amount", "receiver"].map((k, i) => (
                      <div
                        key={k}
                        data-anim={`claim-${i}`}
                        className="mb-2 flex items-center justify-between rounded-[8px] border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] px-3.5 py-2.5"
                      >
                        <span className="font-mono text-[11px] tracking-[0.08em] text-[var(--color-ink-2)]">
                          {k}
                        </span>
                        <span className="h-[6px] w-14 rounded-full bg-[rgba(255,255,255,0.14)]" />
                      </div>
                    ))}
                  </div>
                  {/* 對齊線 gutter */}
                  <div className="flex flex-col items-center gap-2 pt-7">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        data-anim={`line-${i}`}
                        className="h-px w-full origin-left bg-gradient-to-r from-[rgba(116,164,135,0.1)] to-[#74a487]"
                      />
                    ))}
                  </div>
                  {/* CHAIN RETURNED */}
                  <div>
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-3)]">
                      {s.chainReturned}
                    </p>
                    {["stake", "amount", "receiver"].map((k, i) => (
                      <div
                        key={k}
                        data-anim={`res-${i}`}
                        className="mb-2 flex items-center justify-between rounded-[8px] border border-[rgba(116,164,135,0.2)] bg-[rgba(116,164,135,0.04)] px-3.5 py-2.5"
                      >
                        <span className="font-mono text-[11px] tracking-[0.08em] text-[var(--color-ink-2)]">
                          {k}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="h-[6px] w-14 rounded-full bg-[rgba(116,164,135,0.5)]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-[#74a487]" />
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div
                  data-anim="verdict"
                  className="flex items-center gap-3 rounded-full border border-[#74a487] bg-[rgba(116,164,135,0.08)] px-6 py-2.5"
                >
                  <span className="font-mono text-[11px] tracking-[0.1em] text-[#74a487]">
                    {s.aligned}
                  </span>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#74a487]" />
                </div>
              </div>
            </div>

            {/* 05 · fingerprint — 字串傳遞 + 字元鎖定 */}
            <div data-scene="4" className="absolute opacity-0">
              <div className="flex w-[380px] flex-col items-center">
                <div
                  data-anim="fpTop"
                  className="flex w-full items-center justify-between rounded-[10px] border border-[rgba(255,255,255,0.12)] bg-[rgba(14,16,22,0.92)] px-5 py-3.5"
                >
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-3)]">
                    {s.panel}
                  </span>
                  <span className="font-mono text-[16px] tracking-[0.12em] text-[var(--color-ink)]">
                    FFC9 2520
                  </span>
                </div>

                <div className="relative h-10 w-px bg-[rgba(255,255,255,0.12)]">
                  <div
                    data-anim="fpFlow"
                    className="absolute -left-[2.5px] top-0 h-[6px] w-[6px] rounded-full bg-[#8ab4ff] shadow-[0_0_8px_rgba(120,160,255,0.9)]"
                  />
                </div>

                <div
                  data-anim="fpBot"
                  className="flex w-full items-center justify-between rounded-[10px] border border-[rgba(255,255,255,0.12)] bg-[rgba(14,16,22,0.92)] px-5 py-3.5"
                >
                  <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-3)]">
                    {s.signPage}
                  </span>
                  <span className="font-mono text-[16px] tracking-[0.12em] text-[var(--color-ink)]">
                    FFC9 2520
                  </span>
                </div>

                <div
                  data-anim="lock"
                  className="mt-6 flex items-center gap-2.5 rounded-full border border-[#74a487] bg-[rgba(116,164,135,0.08)] px-5 py-2"
                >
                  <span className="text-[12px] text-[#74a487]">≡</span>
                  <span className="font-mono text-[11px] tracking-[0.1em] text-[#74a487]">
                    {s.match}
                  </span>
                </div>
              </div>
            </div>

            {/* 06 · decide — 驗證過的卡片 → YOU DECIDE → SIGN/REJECT → 廣播上鏈 */}
            <div data-scene="5" className="absolute opacity-0">
              <div className="flex flex-col items-center gap-6">
                {/* 驗證過的交易卡（旅程的結果） */}
                <div
                  data-anim="txArrive"
                  className="flex w-[260px] items-center justify-between rounded-xl border border-[rgba(116,164,135,0.35)] bg-[rgba(14,16,22,0.95)] px-5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_0_36px_rgba(116,164,135,0.15)]"
                >
                  <span className="font-mono text-[11px] tracking-[0.1em] text-[#74a487]">
                    {s.verified}
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[12px] text-[var(--color-ink)]">
                    stake shMONAD
                    <span className="status-dot h-1.5 w-1.5 rounded-full bg-[#74a487]" />
                  </span>
                </div>

                {/* 選擇的時刻 */}
                <p
                  data-anim="decideLabel"
                  className="text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-ink-2)]"
                >
                  {s.youDecide}
                </p>

                <div className="flex items-start gap-8">
                  <div className="flex flex-col items-center gap-2">
                    <span
                      data-anim="btnSign"
                      className="rounded-full border border-[#74a487] bg-[rgba(116,164,135,0.16)] px-6 py-2 font-mono text-[12px] tracking-[0.1em] text-[#74a487]"
                    >
                      {s.sign}
                    </span>
                    <span className="text-[11px] text-[var(--color-ink-3)]">
                      {s.broadcasts}
                    </span>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span
                      data-anim="btnReject"
                      className="rounded-full border border-[rgba(255,255,255,0.16)] px-6 py-2 font-mono text-[12px] tracking-[0.1em] text-[var(--color-ink-3)]"
                    >
                      {s.reject}
                    </span>
                    <span className="text-[11px] text-[var(--color-ink-3)]">
                      {s.nothingMoves}
                    </span>
                  </div>
                </div>

                {/* 鏈：3 個區塊，簽署後依序點亮 */}
                <div className="relative mt-3 flex items-center gap-2.5">
                  <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[rgba(255,255,255,0.10)]" />
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      data-anim={`blk${i}`}
                      className="relative z-[1] h-2.5 w-2.5 rounded-[3px] border border-[rgba(120,160,255,0.35)] bg-[rgba(14,16,22,0.95)]"
                    />
                  ))}
                  <div
                    data-anim="chainUp"
                    className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-gradient-to-r from-[rgba(61,92,255,0.95)] to-[rgba(61,92,255,0.25)] shadow-[0_0_12px_rgba(61,92,255,0.7)]"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 天亮 */}
        <div
          data-anim="dawn"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(120,150,255,0.28),transparent_60%)]"
        />

        <style jsx>{`
          @keyframes status-pulse {
            0%,
            100% {
              opacity: 1;
              box-shadow: 0 0 8px rgba(116, 164, 135, 0.7);
            }
            50% {
              opacity: 0.45;
              box-shadow: 0 0 2px rgba(116, 164, 135, 0.3);
            }
          }
          .status-dot {
            animation: status-pulse 2.2s ease-in-out infinite;
          }
          .seg-done {
            background-color: rgba(120, 160, 255, 0.75) !important;
          }
          .seg-current {
            background-color: rgba(120, 160, 255, 0.9) !important;
          }
          @media (prefers-reduced-motion: reduce) {
            .status-dot {
              animation: none;
            }
          }
        `}</style>
      </div>
    </div>
  );
}
