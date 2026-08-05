"use client";

/**
 * 旋轉 3D 線框球體 — 「守夜人的觀測」。
 *
 * Canvas 2D 投影一個旋轉的經緯線球：經線（longitude）與緯線（latitude）+
 * 節點光點，緩慢自轉。這是你說的「球型網格」。克制：不載 three.js，
 * 純 Canvas 2D 手動投影，約 60fps 輕量。
 *
 * 生成用 seed（避免 hydration mismatch），旋轉在 useEffect/rAF 內進行。
 */

import { useEffect, useRef } from "react";

interface Props {
  className?: string;
  /** 球體大小（px 半徑）（繪圖座標） */
  radius?: number;
  /** 自轉速度（弧度/幀） */
  speed?: number;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function WireSphere({ className, radius = 130, speed = 0.004 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const rand = mulberry32(20260804);

    // 預建 3D 節點（緯線上的點）
    const LATS = 8; // 緯線數
    const LONGS = 14; // 經度分割
    const points: { x: number; y: number; z: number }[] = [];

    // 經線（longitude）：垂直大圓
    const meridians: { x: number; y: number; z: number }[][] = [];
    for (let m = 0; m < 10; m++) {
      const phi = (m / 10) * Math.PI * 2;
      const line: { x: number; y: number; z: number }[] = [];
      for (let i = 0; i <= 40; i++) {
        const theta = (i / 40) * Math.PI;
        line.push({
          x: Math.sin(theta) * Math.cos(phi),
          y: Math.cos(theta),
          z: Math.sin(theta) * Math.sin(phi),
        });
      }
      meridians.push(line);
    }

    // 緯線（latitude）：水平小圓
    const parallels: { x: number; y: number; z: number }[][] = [];
    for (let l = 1; l < LATS; l++) {
      const lat = (l / LATS) * Math.PI - Math.PI / 2;
      const line: { x: number; y: number; z: number }[] = [];
      for (let i = 0; i <= LONGS; i++) {
        const lng = (i / LONGS) * Math.PI * 2;
        line.push({
          x: Math.cos(lat) * Math.cos(lng),
          y: Math.sin(lat),
          z: Math.cos(lat) * Math.sin(lng),
        });
      }
      parallels.push(line);
    }

    // 隨機節點（點綴）
    const nodes: { x: number; y: number; z: number; size: number; a: number }[] = [];
    for (let i = 0; i < 22; i++) {
      // 隨機單位向量
      const u = rand() * 2 - 1;
      const theta = rand() * Math.PI * 2;
      const sq = Math.sqrt(1 - u * u);
      nodes.push({
        x: sq * Math.cos(theta),
        y: u,
        z: sq * Math.sin(theta),
        size: 0.05 + rand() * 0.09,
        a: 0.4 + rand() * 0.5,
      });
    }

    // 畫布尺寸（用 CSS 尺寸 * DPR）
    const cssW = canvas.offsetWidth || 400;
    const cssH = canvas.offsetHeight || 400;
    const DPR = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = cssW * DPR;
    canvas.height = cssH * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const cx = cssW / 2;
    const cy = cssH / 2;

    // 3D 旋轉（Y 軸 + 微傾 X）
    let ry = 0;
    const TILT = 0.18;
    const rotY = (p: { x: number; y: number; z: number }, t: number) => {
      const c = Math.cos(t);
      const s = Math.sin(t);
      return { x: p.x * c + p.z * s, y: p.y, z: -p.x * s + p.z * c };
    };
    const rotX = (p: { x: number; y: number; z: number }, t: number) => {
      const c = Math.cos(t);
      const s = Math.sin(t);
      return { x: p.x, y: p.y * c - p.z * s, z: p.y * s + p.z * c };
    };

    let raf = 0;
    const draw = () => {
      ctx.clearRect(0, 0, cssW, cssH);
      ry += speed;

      const proj = (p: { x: number; y: number; z: number }) => {
        let q = rotY(p, ry);
        q = rotX(q, TILT);
        // 正規尺寸
        const px = q.x * radius;
        const py = q.y * radius;
        const pz = q.z * radius;
        // 簡易透視
        const persp = 1 / (1.9 - q.z * 0.45);
        return { sx: cx + px * persp, sy: cy + py * persp, depth: q.z };
      };

      // 暗色半透明畫布底色（網格線很淡）
      // 畫網格線 — 只畫前半（z>0 亮，背面藏到陰影）
      ctx.lineWidth = 1;
      for (const line of [...meridians, ...parallels]) {
        ctx.strokeStyle = "rgba(90,120,200,0.16)";
        ctx.beginPath();
        let moved = false;
        for (const p of line) {
          const { sx, sy } = proj(p);
          if (!moved) {
            ctx.moveTo(sx, sy);
            moved = true;
          } else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
      }

      // 節點光點 — 前面亮、後面暗
      for (const n of nodes) {
        const { sx, sy, depth } = proj(n);
        const alpha = n.a * (0.35 + (depth + 1) * 0.4);
        ctx.beginPath();
        ctx.arc(sx, sy, n.size * radius * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(140,170,255,${alpha})`;
        ctx.fill();
      }

      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => cancelAnimationFrame(raf);
  }, [radius, speed]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={className}
      style={{ width: "100%", height: "100%" }}
    />
  );
}
