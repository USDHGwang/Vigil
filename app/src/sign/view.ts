/**
 * 簽名頁的純渲染層。沒有 DOM、沒有 window.ethereum，可直接測。
 *
 * 跟 panel/render.ts 同樣的切法：這裡只有「什麼狀態顯示什麼」，
 * 錢包互動全部留在 main.ts。
 */

import { formatEther } from "viem";
import { formatFingerprint, type HandoffPayload } from "../handoff.js";
import { esc, shortHex } from "../html.js";
import { t, type Locale } from "../panel/i18n.js";
import { LOGOMARK_SVG } from "../panel/brand.js";

export type Phase =
  /** 剛載入，還在問瀏覽器有沒有錢包 */
  | { kind: "checking" }
  /** 沒連過這個網站，要使用者按一下才能要求連接 */
  | { kind: "connect" }
  /** 已經把請求丟給錢包，等它回應 */
  | { kind: "waiting" }
  /**
   * 錢包連著的帳戶不是這筆交易的發起人。
   *
   * account 目前是 agent 傳給我們的參數，未經驗證。面板上每一句「你支出」
   * 都建立在它上面。這裡是唯一一個問得到真實答案的地方 —— 錢包知道自己是誰。
   */
  | { kind: "wrongAccount"; connected: string; expected: string }
  | { kind: "sent"; hash: string }
  | { kind: "failed"; message: string }
  | { kind: "noWallet" };

export interface Action {
  label: string;
  disabled: boolean;
}

/** null 代表這個階段不該有按鈕 */
export function actionFor(phase: Phase, locale: Locale = "zh-TW"): Action | null {
  switch (phase.kind) {
    case "checking":
      return { label: t(locale, "sign_checking"), disabled: true };
    case "connect":
      return { label: t(locale, "sign_connect"), disabled: false };
    case "waiting":
      return { label: t(locale, "sign_confirm"), disabled: true };
    case "failed":
      return { label: t(locale, "sign_retry"), disabled: false };
    // 帳戶對不上時不給按鈕。要能簽，得先在錢包裡切到對的帳戶，
    // 給一顆按不動或按了會失敗的鈕只會讓人以為是我們壞掉。
    case "wrongAccount":
    case "sent":
    case "noWallet":
      return null;
  }
}

export function noticeFor(phase: Phase, locale: Locale = "zh-TW"): { tone: "good" | "bad"; text: string } | null {
  switch (phase.kind) {
    case "noWallet":
      return { tone: "bad", text: t(locale, "sign_no_wallet") };
    case "failed":
      return { tone: "bad", text: t(locale, "sign_not_sent", { message: phase.message }) };
    case "sent":
      return { tone: "good", text: t(locale, "sign_sent") };
    case "wrongAccount":
      return { tone: "bad", text: t(locale, "sign_wrong_account") };
    default:
      return null;
  }
}

/** 錢包連著的帳戶裡，有沒有這筆交易的發起人 */
export function accountMatches(
  payload: HandoffPayload,
  accounts: readonly string[],
): boolean {
  const expected = payload.transactions[0]?.from.toLowerCase();
  if (expected === undefined) return false;
  return accounts.some((a) => a.toLowerCase() === expected);
}

/**
 * 要不要一載入就直接觸發錢包。
 *
 * 兩個條件都要成立：
 *   已經連過 —— eth_requestAccounts 需要 user gesture，沒連過就自動叫會被吃掉
 *   只有一筆 —— 多筆時我們目前只送第一筆，不能在沒人按的情況下悄悄送出其中一筆
 */
export function canAutoStart(payload: HandoffPayload, connected: boolean): boolean {
  return connected && payload.transactions.length === 1;
}

/** 金額用人看得懂的單位。跟面板同一條規則，不給 wei。 */
export function formatValue(value: string, locale: Locale = "zh-TW"): string {
  const wei = BigInt(value);
  return wei === 0n ? t(locale, "sign_no_value") : `${formatEther(wei)} MON`;
}

function txRows(payload: HandoffPayload, locale: Locale): string {
  const tx = payload.transactions[0];
  if (tx === undefined) return "";
  const rows: [string, string][] = [
    // 發起帳戶要顯示：面板上所有「你支出多少」都是照它算的，而它是 agent 給的
    [t(locale, "sign_from"), tx.from],
    [t(locale, "sign_to"), tx.to],
    [t(locale, "sign_value"), formatValue(tx.value, locale)],
    [t(locale, "sign_data"), shortHex(tx.data, 20, 16)],
  ];
  return rows
    .map(([k, v]) => `<div class="row"><span class="k">${esc(k)}</span><span>${esc(v)}</span></div>`)
    .join("");
}

function accountConflict(phase: Phase, locale: Locale): string {
  if (phase.kind !== "wrongAccount") return "";
  return `<div class="tx conflict">
    <div class="row"><span class="k">${t(locale, "sign_tx_from")}</span><span>${esc(phase.expected)}</span></div>
    <div class="row"><span class="k">${t(locale, "sign_wallet_now")}</span><span>${esc(phase.connected)}</span></div>
  </div>`;
}

export function renderCard(payload: HandoffPayload, phase: Phase, locale: Locale = "zh-TW"): string {
  const many = payload.transactions.length > 1;
  const action = actionFor(phase, locale);
  const notice = noticeFor(phase, locale);

  return `<div class="card">
    <div class="brand">
      <span class="mark">${LOGOMARK_SVG}</span>
      <span class="name">${t(locale, "panel_name")}</span>
      <span class="src"><span class="live"></span>${t(locale, "panel_source")}</span>
    </div>
    <h1>${t(locale, "sign_title")}</h1>
    <p class="lead">${esc(payload.summary)}</p>

    <div class="fp">
      <div class="k">${t(locale, "sign_fingerprint")}</div>
      <div class="v">${esc(formatFingerprint(payload.fingerprint))}</div>
      <p class="hint">${t(locale, "sign_fp_hint")}</p>
    </div>

    <div class="tx">
      <div class="k">${many ? t(locale, "sign_batch_prefix", { n: String(payload.transactions.length) }) : t(locale, "sign_tx_content")}</div>
      ${txRows(payload, locale)}
    </div>

    ${many ? `<p class="bad">${t(locale, "sign_many_warn")}</p>` : ""}
    ${notice ? `<p class="${notice.tone}">${esc(notice.text)}</p>` : ""}
    ${accountConflict(phase, locale)}
    ${phase.kind === "sent" ? `<p class="good">${t(locale, "sign_tx_hash")} <code>${esc(phase.hash)}</code></p>` : ""}
    ${
      action
        ? `<button id="go"${action.disabled ? " disabled" : ""}>${esc(action.label)}</button>`
        : ""
    }

    <p class="foot">${t(locale, "sign_foot")}</p>
  </div>`;
}

export function renderFailure(message: string, locale: Locale = "zh-TW"): string {
  return `<div class="card"><h1>${t(locale, "sign_fail_title")}</h1><p class="bad">${esc(message)}</p></div>`;
}
