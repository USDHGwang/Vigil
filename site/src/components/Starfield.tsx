"use client";

/**
 * 夜空背景 — 守夜人的意象。
 *
 * 暗底不能是死黑：深藍-黑漸層 + 散布星點 + 中央微光 + 低頻流動的「極光」
 * 光暈（讓夜空有深度、不平面）。全部 CSS 生成，不載圖片。
 *
 * ⚠️ 不能有 Math.random()：Client Component 若 SSR，random 會讓 server/client
 * 渲染不同 → React hydration mismatch → 內容卡住。星點用確定性 seed
 * （mulberry32）產生，任何一次 render 結果都一樣。
 */

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function Starfield() {
  const rand = mulberry32(20260803);
  const stars = Array.from({ length: 40 }, (_, i) => {
    const x = 26 + rand() * 72;
    const y = 6 + rand() * 88;
    const size = 1 + rand() * 1.6;
    const delay = rand() * 6;
    const dur = 4 + rand() * 5;
    const o = 0.25 + rand() * 0.45;
    return { x, y, size, delay, dur, o, i };
  });

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        background:
          "radial-gradient(120% 90% at 70% 12%, #0c1322 0%, #08090a 55%, #050608 100%)",
      }}
    >
      {/* 地平線晨光 — 隨下滑(守夜→黎明)從底部泛起，象徵守到天明 */}
      <div
        className="absolute bottom-0 left-0 w-full"
        style={{
          height: "55vh",
          background:
            "linear-gradient(to top, rgba(160,140,220,0.22) 0%, rgba(120,150,230,0.12) 35%, rgba(60,90,180,0.05) 60%, transparent 100%)",
          opacity: "var(--daybreak, 0)",
          filter: "blur(18px)",
          transition: "opacity 0.1s linear",
        }}
      />
      {/* 天色微亮 overlay — 隨下滑,整片夜空從深黑變冷藍微亮 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 100% at 70% 10%, rgba(30,50,110,0.28) 0%, rgba(12,20,44,0.35) 55%, rgba(8,10,18,0.45) 100%)",
          opacity: "var(--daybreak, 0)",
          transition: "opacity 0.1s linear",
        }}
      />
      {/* 中央微光 — 守夜人的燈 */}
      <div
        className="absolute"
        style={{
          width: "70vw",
          height: "70vw",
          left: "50%",
          top: "48%",
          transform: "translate(-50%, -50%)",
          background:
            "radial-gradient(circle, rgba(0,82,255,0.10) 0%, rgba(0,82,255,0.03) 40%, transparent 70%)",
        }}
      />

      {/* 低頻流動的「極光」光暈 — 讓夜空有深度、不平面 */}
      {/* 以下「天空物件」整體依 --star-drift 微幅上移 = 捲動視差（背景比內容慢） */}
      <div
        style={{
          transform: "translateY(var(--star-drift, 0px))",
          willChange: "transform",
        }}
      >
        <div
          className="absolute"
          style={{
            width: "60vw",
            height: "55vh",
            left: "-12%",
            top: "8%",
            filter: "blur(60px)",
            background:
              "radial-gradient(ellipse at center, rgba(70,110,210,0.12) 0%, transparent 65%)",
            animation: "aurora 26s ease-in-out infinite alternate",
            willChange: "transform, opacity",
          }}
        />
        <div
          className="absolute"
          style={{
            width: "50vw",
            height: "45vh",
            right: "-8%",
            bottom: "4%",
            filter: "blur(60px)",
            background:
              "radial-gradient(ellipse at center, rgba(40,180,180,0.09) 0%, transparent 65%)",
            animation: "aurora2 32s ease-in-out infinite alternate-reverse",
            willChange: "transform, opacity",
          }}
        />

        {/* 星點 */}
        <div style={{ opacity: "calc(1 - var(--daybreak, 0))", transition: "opacity 0.1s linear" }}>
          {stars.map((s) => (
            <span
              key={s.i}
              className="absolute rounded-full"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: `${s.size}px`,
                height: `${s.size}px`,
                background: "rgba(214,224,255,0.5)",
                boxShadow: "0 0 4px 0 rgba(214,224,255,0.35)",
                opacity: s.o,
                animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
              }}
            />
          ))}
        </div>

        {/* 銀河帶 — 對角一帶星塵聚集的「璀璨」核心（比均勻星點更亮） */}
        <div
          className="absolute"
          style={{
            width: "160vw",
            height: "70vh",
            left: "-30vw",
            top: "-18vh",
            transform: "rotate(-22deg)",
            background:
              "radial-gradient(ellipse 60% 45% at 50% 50%, rgba(180,200,255,0.14) 0%, rgba(120,150,230,0.06) 45%, transparent 75%)",
            filter: "blur(20px)",
            opacity: "calc(1 - var(--daybreak, 0))",
            transition: "opacity 0.1s linear",
          }}
        />
      </div>

      {/* 兩旁的山稜剪影 — 左山 + 右山，中間凹進讓銀河露出來 */}
      {/* 暫時移除:山稜視覺太奇怪,改用 scroll-motion 的天空變化(守夜→黎明) */}

      <style jsx global>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 0.75; }
        }
        @keyframes aurora {
          0% { transform: translate3d(0,0,0) scale(1); opacity: 0.7; }
          100% { transform: translate3d(6vw, -4vh, 0) scale(1.15); opacity: 1; }
        }
        @keyframes aurora2 {
          0% { transform: translate3d(0,0,0) scale(1); opacity: 0.6; }
          100% { transform: translate3d(-5vw, 3vh, 0) scale(1.1); opacity: 0.9; }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="animation"] { animation: none !important; }
        }
      `}</style>
    </div>
  );
}
