/**
 * 文字版面板，給不能渲染 HTML 的 host 用。
 *
 * 為什麼需要這個：Claude Code、Codex、Hermes 這些 CLI agent 不支援 MCP Apps 的
 * UI resource，但它們正是使用者叫 agent 上鏈做事的地方。官方 client-matrix 只列
 * Claude web 與 Claude Desktop 支援 app 渲染，CLI 一律不在內。
 *
 * 所以這不是備案，是那批 host 的主要形態。內容與 HTML 版一致，共用 humanize，
 * 差別只在排版媒介。
 */

import type { EvidencePanelView } from "../contract.js";
import { displayParamValue, humanize } from "./humanize.js";
import { t, type Locale } from "./i18n.js";
import { flattenReceipt } from "./render.js";

const WIDTH = 74;

/**
 * 剝掉內容字串裡的 C0/C1 控制字元（ANSI/terminal injection 防護）。
 *
 * 面板的「內容」有兩種來源：程式自己產生的（i18n 字典、框架、標題）與
 * 外部進來的（agent 轉述使用者原話的 intent、模擬器的 warning、未知操作的
 * fallback 文字）。外部字串不可信——`\x1b[2J` 可以清掉 CLI host 的整個
 * 畫面、`\x1b[31m` 可以讓假 verdict 看起來像真的，所以輸出前一律先過這一關。
 *
 * 移除：C0 控制字元（U+0000–U+0008、U+000B–U+001F，含 ESC U+001B）、
 * DEL（U+007F）、C1 控制字元（U+0080–U+009F）。
 * 保留：\t（U+0009）、\n（U+000A）、\r（U+000D）——這些是合法排版字元。
 *
 * 只處理內容，不碰框架：tint 的 ANSI 色碼要在 clean 之後才加上去，
 * 順序反了會把程式自己的顏色也剝掉。
 */
export function clean(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u0080-\u009f]/g, "");
}

/** 東亞全形字在終端機佔兩格，換行要按顯示寬度算，不能按字元數 */
export function displayWidth(text: string): number {
  let width = 0;
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    const wide =
      (code >= 0x1100 && code <= 0x115f) ||
      (code >= 0x2e80 && code <= 0xa4cf) ||
      (code >= 0xac00 && code <= 0xd7a3) ||
      (code >= 0xf900 && code <= 0xfaff) ||
      (code >= 0xfe30 && code <= 0xfe6f) ||
      (code >= 0xff00 && code <= 0xff60) ||
      (code >= 0xffe0 && code <= 0xffe6) ||
      (code >= 0x20000 && code <= 0x3fffd);
    width += wide ? 2 : 1;
  }
  return width;
}

/** 按顯示寬度斷行，續行縮排對齊 */
/**
 * 切成可以斷行的單位。
 *
 * 中文任何兩個字之間都能斷，所以 CJK 每個字自己一個單位。數字和拉丁字母不行：
 * 「~0.015862」被切成「~0.0158」跟「62」之後，讀到的是兩個錯的數字。金額是這個
 * 面板最要緊的東西，不能因為排版變成另一個值。
 */
function units(text: string): string[] {
  return text.match(/[0-9A-Za-z.,~%+-]+|\s+|[\s\S]/gu) ?? [];
}

export function wrap(text: string, width: number, indent: string): string[] {
  const lines: string[] = [];
  let current = "";
  const flush = (): void => {
    if (current !== "") lines.push(current);
    current = "";
  };

  for (const unit of units(text)) {
    if (current === "" && /^\s+$/u.test(unit)) continue; // 換行後不留行首空白
    if (displayWidth(current + unit) <= width) {
      current += unit;
      continue;
    }
    flush();
    if (/^\s+$/u.test(unit)) continue;
    if (displayWidth(unit) <= width) {
      current = unit;
      continue;
    }
    // 單一單位就寬過整行，只能硬切，否則排不進去
    for (const char of unit) {
      if (displayWidth(current + char) > width) flush();
      current += char;
    }
  }
  flush();
  return lines.map((line, i) => (i === 0 ? line : indent + line));
}

/** 文案只能講機器真的驗過的事，理由見 render.ts 的同一份對照表 */
function verdictLine(locale: Locale, kind: string): string {
  switch (kind) {
    case "match":
      return `✓  ${t(locale, "verdict_match")}`;
    case "partial":
      return `!  ${t(locale, "verdict_partial")}`;
    case "mismatch":
      return `✗  ${t(locale, "verdict_mismatch")}`;
    case "noIntent":
      return `–  ${t(locale, "verdict_noIntent")}`;
    case "blocked":
      return `■  ${t(locale, "verdict_blocked")}`;
    default:
      return kind;
  }
}

function directionTag(locale: Locale, direction: string): string {
  switch (direction) {
    case "out":
      return t(locale, "dir_out");
    case "in":
      return t(locale, "dir_in");
    case "approval":
      return t(locale, "dir_approval");
    case "pending":
      return t(locale, "dir_pending");
    default:
      return "";
  }
}

function kindTag(locale: Locale, kind: string): string {
  return kind === "nativeTransfer" ? t(locale, "kind_nativeTransfer") : t(locale, "kind_event");
}

/**
 * 行級 ANSI 色。只包整行，不碰字元——wrap 是在純文字上算好的，
 * 上色是最後一層包裝，escape code 零寬，不影響任何排版計算。
 *
 * 預設關：text view 有兩個消費者——LLM（agent 讀內容理解證據）與
 * 使用者（terminal 顯示）。ANSI 對 LLM 是噪音，所以由 host 明確開。
 */
type ColorCode = 1 | 31 | 32 | 33 | 90 | 91 | 96;

function paint(line: string, code: ColorCode): string {
  return `\u001b[${code}m${line}\u001b[0m`;
}

/** verdict 語義對應的 ANSI 色：match 綠、partial 黃、mismatch/blocked 紅、noIntent 灰 */
function verdictColor(kind: string): ColorCode | null {
  switch (kind) {
    case "match":
      return 32;
    case "partial":
      return 33;
    case "mismatch":
    case "blocked":
      return 31;
    case "noIntent":
      return 90;
    default:
      return null;
  }
}

export interface TextRenderOptions {
  /** ANSI 上色。CLI host（Hermes CLI、Claude Code）開；web/gateway 關。預設關 */
  color?: boolean;
}

/** 版面元素要不要上色、上什麼色。null = 保持原樣 */
type Palette = {
  title: ColorCode | null;
  verdict: ColorCode | null;
  section: ColorCode | null;
  muted: ColorCode | null;
  frame: ColorCode | null;
  strong: ColorCode | null;
  danger: ColorCode | null;
};

function paletteFor(options: TextRenderOptions): Palette {
  if (options.color !== true) {
    return {
      title: null,
      verdict: null,
      section: null,
      muted: null,
      frame: null,
      strong: null,
      danger: null,
    };
  }
  return {
    title: 1, // bold 標題行
    verdict: null, // verdict 由語義色決定，這裡留 null 給個別行覆蓋
    section: 96, // 「要求」「鏈上行為」段落標題：亮青
    muted: 90, // 免責、註腳：灰
    frame: 90, // 分隔線：灰（mismatch 的 ═ 框會覆蓋成紅）
    strong: 1,
    danger: 31, // mismatch 全塊：紅
  };
}

/** 給一行上色；override 讓 verdict 這類「語義色」蓋過版面色。
 *  color 關閉時（palette 全 null）override 一律無效——語義色不能
 *  繞過開關，否則 blocked 的紅會在純文字 host 上也出現。 */
function tint(line: string, pal: Palette, override: ColorCode | null = null): string {
  if (pal.muted === null) return line; // color 關：任何上色都無效
  const code = override ?? pal.muted;
  return code === null ? line : paint(line, code);
}

/** 標籤欄的顯示寬度：英文最寬 "approve"/"receive" 7 字；中文「待處理」3 全形 = 6 格 */
const TAG_WIDTH = 7;
const EVIDENCE_INDENT = " ".repeat(2 + TAG_WIDTH + 2);

function rule(char = "─"): string {
  return char.repeat(WIDTH);
}

/** 按顯示寬度補到固定欄寬，全形字算兩格 */
function padTag(tag: string): string {
  return tag + " ".repeat(Math.max(0, TAG_WIDTH - displayWidth(tag)));
}

/** 一條證據：第一行帶標籤，續行對齊到內容欄 */
function evidenceLines(tag: string, text: string): string[] {
  const wrapped = wrap(text, WIDTH - EVIDENCE_INDENT.length, "");
  return wrapped.map((line, i) =>
    i === 0 ? `  ${padTag(tag)}  ${line}` : `${EVIDENCE_INDENT}${line}`,
  );
}

export function renderText(view: EvidencePanelView, options: TextRenderOptions = {}): string {
  const pal = paletteFor(options);
  const locale = view.locale;
  const out: string[] = [];

  out.push(tint(t(locale, "title"), pal, pal.title));
  out.push(tint(rule(), pal, pal.frame));

  // 意圖
  if (view.intent) {
    out.push(tint(t(locale, "section_intent"), pal, pal.section));
    for (const line of wrap(clean(view.intent.text), WIDTH - 2, "  ")) out.push(tint(`  ${line}`, pal, pal.strong));
    const params = Object.entries(view.intent.params);
    if (params.length > 0) {
      const pad = Math.max(...params.map(([k]) => displayWidth(k)));
      for (const [k, v] of params) {
        out.push(
          `  ${k}${" ".repeat(pad - displayWidth(k))}  ${clean(displayParamValue(v, view.account, locale))}`,
        );
      }
    }
  } else {
    out.push(tint(t(locale, "no_intent"), pal, pal.muted));
  }
  out.push("");

  // 比對結論。不一致的時候用整行標記讓它在終端機裡跳出來
  const kind = view.verdict.kind;
  const vColor = verdictColor(kind);
  if (kind === "mismatch") {
    out.push(tint(rule("═"), pal, pal.danger));
    out.push(tint(verdictLine(locale, kind), pal, pal.danger));
    for (const conflict of view.verdict.conflicts) {
      for (const line of wrap(`· ${clean(conflict)}`, WIDTH - 3, "     "))
        out.push(tint(`   ${line}`, pal, pal.danger));
    }
    out.push(tint(rule("═"), pal, pal.danger));
  } else {
    out.push(tint(verdictLine(locale, kind), pal, vColor));
    if (kind === "partial") {
      for (const line of wrap(clean(view.verdict.reason), WIDTH - 3, "   ")) out.push(tint(`   ${line}`, pal, vColor));
    }
    if (kind === "blocked") {
      for (const warning of view.verdict.warnings) {
        for (const line of wrap(`· ${clean(warning.message)}`, WIDTH - 3, "     ")) out.push(tint(`   ${line}`, pal, vColor));
      }
    }
  }
  out.push("");

  // 證據
  out.push(tint(t(locale, "section_evidence"), pal, pal.section));
  if (view.receipt !== null) {
    const leaves = flattenReceipt(view.receipt);
    if (leaves.length === 0) {
      out.push(`  ${t(locale, "zero_changes")}`);
    }
    for (const leafItem of leaves) {
      const { direction, text } = humanize(
        leafItem.data,
        leafItem.change,
        view.account,
        view.tokens,
        leafItem.text,
        locale,
      );
      const tag = directionTag(locale, direction) || kindTag(locale, leafItem.change.kind);
      out.push(...evidenceLines(tag, clean(text)));
    }
  } else if (view.changes.length > 0) {
    if (view.intent !== null) out.push(`  ${t(locale, "degraded")}`);
    for (const change of view.changes) {
      const { direction, text } =
        change.kind === "nativeTransfer"
          ? humanize(
              { operation: "nativeTransfer", from: change.from, to: change.to, value: change.value },
              change,
              view.account,
              view.tokens,
              "",
              locale,
            )
          : {
              direction: "" as const,
              text: t(locale, "no_readable", { addr: clean(`${change.address.slice(0, 6)}…${change.address.slice(-4)}`) }),
            };
      const tag = directionTag(locale, direction) || kindTag(locale, change.kind);
      out.push(...evidenceLines(tag, clean(text)));
    }
  } else {
    out.push(`  ${t(locale, "no_changes")}`);
  }

  out.push("");
  out.push(tint(rule(), pal, pal.frame));
  if (view.intent !== null) {
    // 機器驗不了自然語言，這件事要講出來，不能讓人以為已經驗過
    for (const line of wrap(t(locale, "checks_full"), WIDTH, "")) {
      out.push(tint(line, pal, pal.muted));
    }
  }
  // 上面每一句「你支出」都是照這個地址算的，而它多半是 agent 給的。
  // 不講出來，使用者會以為那個「你」已經驗過了。
  const who = `${view.account.slice(0, 10)}…${view.account.slice(-8)}`;
  for (const line of wrap(
    view.accountSource === "wallet"
      ? t(locale, "account_wallet", { who })
      : t(locale, "account_agent", { who }),
    WIDTH,
    "",
  )) {
    out.push(tint(line, pal, pal.muted));
  }

  // 不寫「可以簽名」。機器判斷不了這筆交易該不該簽，只能說按鈕做什麼，
  // 說「可以」等於替使用者背書一件它沒驗過的事。
  out.push(
    tint(
      view.signable ? t(locale, "sign_ok") : t(locale, "sign_no"),
      pal,
      pal.muted,
    ),
  );
  out.push(tint(t(locale, "raw_count", { n: String(view.changes.length) }), pal, pal.muted));

  return out.join("\n");
}
