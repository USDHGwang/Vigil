/**
 * 面板主題 token 的一致性。
 *
 * 為什麼需要這個檔：同一組 token 在 styles.css 裡有三份——
 *   `:root`（淺色預設）、`@media (prefers-color-scheme: dark)`、
 *   `:root[data-theme="dark"]`、`:root[data-theme="light"]`
 * host 會用哪一條取決於它推不推主題，所以四份都會被真的用到。
 *
 * 2026-08-04 就漂過一次：修對比度時只改到其中一份，另一份還是舊值，
 * 而深色下那個舊值是 3.30:1（AA 要 4.5），肉眼看不出來是哪一份在作用。
 *
 * 這裡不驗顏色好不好看，只驗「四份的 token 名稱一致」與「同名 token 在
 * 兩個深色區塊必須相同、兩個淺色區塊必須相同」。
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../src/panel/styles.css", import.meta.url), "utf-8");

/** 抓出某個選擇器區塊裡的所有自訂屬性 */
function tokensIn(blockStart: string): Record<string, string> {
  const at = css.indexOf(blockStart);
  if (at === -1) throw new Error(`styles.css 裡找不到區塊：${blockStart}`);
  const open = css.indexOf("{", at + blockStart.length - 1);
  // 從第一個 { 開始數括號，取到配對的 }
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = css.slice(open, end);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)) {
    const name = m[1];
    const value = m[2];
    if (name !== undefined && value !== undefined) out[name] = value.trim();
  }
  return out;
}

/** 只比顏色類 token，字體與 easing 那些只定義在 :root，不需要每份都有 */
function colorTokens(tokens: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tokens)) {
    if (/^#|^rgba?\(/i.test(v)) out[k] = v.toLowerCase();
  }
  return out;
}

const base = colorTokens(tokensIn(":root {"));
const mediaDark = colorTokens(tokensIn("@media (prefers-color-scheme: dark)"));
const attrDark = colorTokens(tokensIn(':root[data-theme="dark"]'));
const attrLight = colorTokens(tokensIn(':root[data-theme="light"]'));

describe("主題 token 四份要對得上", () => {
  it("每一份都定義了顏色 token", () => {
    for (const [name, set] of Object.entries({ base, mediaDark, attrDark, attrLight })) {
      expect(Object.keys(set).length, `${name} 沒有任何顏色 token`).toBeGreaterThan(10);
    }
  });

  it("兩個深色區塊完全相同", () => {
    expect(attrDark).toEqual(mediaDark);
  });

  it("淺色的 data-theme 區塊跟 :root 預設相同", () => {
    expect(attrLight).toEqual(base);
  });

  it("深色與淺色定義的 token 名稱集合一致", () => {
    expect(Object.keys(attrDark).sort()).toEqual(Object.keys(base).sort());
  });
});

/**
 * 10px 的微標籤在深色下用 --text-4。WCAG AA 對這個尺寸要 4.5:1，
 * 而 site 的 #62666d 在面板底色上只有 3.30。這條把下限釘住。
 */
describe("小字的對比度", () => {
  const hex = (h: string): [number, number, number] => {
    const s = h.replace("#", "");
    const n = Number.parseInt(
      s.length === 3
        ? s
            .split("")
            .map((c) => c + c)
            .join("")
        : s,
      16,
    );
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const lum = (h: string): number => {
    const channel = (v: number): number => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    };
    const [r, g, b] = hex(h);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const ratio = (a: string, b: string): number => {
    const [hi, lo] = lum(a) > lum(b) ? [lum(a), lum(b)] : [lum(b), lum(a)];
    return (hi + 0.05) / (lo + 0.05);
  };

  /**
   * 要比最差的那個背景，不是只比 --surface。
   *
   * 指紋列、evidence 區塊、verdict 都坐在 --surface-2 上，而淺色的 surface-2
   * 比 surface 暗——只比 surface 會漏掉。2026-08-04 就漏了一次：`.fp .k` 實測
   * 4.08，測試卻是綠的。
   */
  const surfaces = ["--surface", "--surface-2"] as const;

  it.each([
    ["深色", attrDark],
    ["淺色", base],
  ])("%s 的 --text-4 對每一層表面都至少 4.5:1", (_name, set) => {
    const fg = set["--text-4"];
    if (fg === undefined) throw new Error("token 缺了");
    for (const s of surfaces) {
      const bg = set[s];
      if (bg === undefined) throw new Error(`${s} 缺了`);
      expect(ratio(fg, bg), `--text-4 對 ${s}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it.each([
    ["深色", attrDark],
    ["淺色", base],
  ])("%s 的 --text-3 對每一層表面都至少 4.5:1", (_name, set) => {
    const fg = set["--text-3"];
    if (fg === undefined) throw new Error("token 缺了");
    for (const s of surfaces) {
      const bg = set[s];
      if (bg === undefined) throw new Error(`${s} 缺了`);
      expect(ratio(fg, bg), `--text-3 對 ${s}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  /**
   * verdict 的標題是彩色字配同色系底。那是這個面板最需要被讀到的一行，
   * 而且 13.5px 加粗還不算 WCAG 的「大字」，所以一樣要 4.5。
   */
  it.each([
    ["深色", attrDark],
    ["淺色", base],
  ])("%s 的 verdict 標題對它自己的底至少 4.5:1", (_name, set) => {
    for (const kind of ["partial", "mismatch", "blocked"] as const) {
      const fg = set[`--${kind}`];
      const bg = set[`--${kind}-bg`];
      if (fg === undefined || bg === undefined) throw new Error(`${kind} token 缺了`);
      expect(ratio(fg, bg), `--${kind} 對 --${kind}-bg`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
