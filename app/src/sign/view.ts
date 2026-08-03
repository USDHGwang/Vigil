/**
 * 簽名頁的純渲染層。沒有 DOM、沒有 window.ethereum，可直接測。
 *
 * 跟 panel/render.ts 同樣的切法：這裡只有「什麼狀態顯示什麼」，
 * 錢包互動全部留在 main.ts。
 */

import { formatEther } from "viem";
import { formatFingerprint, type HandoffPayload } from "../handoff.js";
import { esc, shortHex } from "../html.js";

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
export function actionFor(phase: Phase): Action | null {
  switch (phase.kind) {
    case "checking":
      return { label: "檢查錢包…", disabled: true };
    case "connect":
      return { label: "連接錢包並簽名", disabled: false };
    case "waiting":
      return { label: "在錢包裡確認…", disabled: true };
    case "failed":
      return { label: "再試一次", disabled: false };
    // 帳戶對不上時不給按鈕。要能簽，得先在錢包裡切到對的帳戶，
    // 給一顆按不動或按了會失敗的鈕只會讓人以為是我們壞掉。
    case "wrongAccount":
    case "sent":
    case "noWallet":
      return null;
  }
}

export function noticeFor(phase: Phase): { tone: "good" | "bad"; text: string } | null {
  switch (phase.kind) {
    case "noWallet":
      return { tone: "bad", text: "這個瀏覽器沒有偵測到錢包擴充。裝一個再回來。" };
    case "failed":
      return { tone: "bad", text: `沒有送出：${phase.message}` };
    case "sent":
      return { tone: "good", text: "已送出。" };
    case "wrongAccount":
      return {
        tone: "bad",
        text:
          "這筆交易的發起帳戶，不是你錢包現在連著的那個。" +
          "面板上算的餘額與「你支出多少」都是照發起帳戶算的，跟你無關。" +
          "要簽的話，先在錢包裡切到發起帳戶。",
      };
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
export function formatValue(value: string): string {
  const wei = BigInt(value);
  return wei === 0n ? "不附帶 MON" : `${formatEther(wei)} MON`;
}

function txRows(payload: HandoffPayload): string {
  const tx = payload.transactions[0];
  if (tx === undefined) return "";
  const rows: [string, string][] = [
    // 發起帳戶要顯示：面板上所有「你支出多少」都是照它算的，而它是 agent 給的
    ["從", tx.from],
    ["送到", tx.to],
    ["附帶金額", formatValue(tx.value)],
    ["資料", shortHex(tx.data, 20, 16)],
  ];
  return rows
    .map(([k, v]) => `<div class="row"><span class="k">${esc(k)}</span><span>${esc(v)}</span></div>`)
    .join("");
}

function accountConflict(phase: Phase): string {
  if (phase.kind !== "wrongAccount") return "";
  return `<div class="tx conflict">
    <div class="row"><span class="k">交易的發起帳戶</span><span>${esc(phase.expected)}</span></div>
    <div class="row"><span class="k">你錢包現在是</span><span>${esc(phase.connected)}</span></div>
  </div>`;
}

export function renderCard(payload: HandoffPayload, phase: Phase): string {
  const many = payload.transactions.length > 1;
  const action = actionFor(phase);
  const notice = noticeFor(phase);

  return `<div class="card">
    <div class="brand">
      <span class="mark">證</span>
      <span class="name">Vigil · 簽名前檢查</span>
      <span class="src"><span class="live"></span>Monad 主網模擬</span>
    </div>
    <h1>簽名前最後一步</h1>
    <p class="lead">${esc(payload.summary)}</p>

    <div class="fp">
      <div class="k">交接指紋</div>
      <div class="v">${esc(formatFingerprint(payload.fingerprint))}</div>
      <p class="hint">跟面板上顯示的對一下。一樣，代表這筆交易中間沒有被換過。</p>
    </div>

    <div class="tx">
      <div class="k">${many ? `這批有 ${payload.transactions.length} 筆，以下是第 1 筆` : "交易內容"}</div>
      ${txRows(payload)}
    </div>

    ${many ? `<p class="bad">目前一次只送得出一筆。要送完整批，等多筆簽名做好再來。</p>` : ""}
    ${notice ? `<p class="${notice.tone}">${esc(notice.text)}</p>` : ""}
    ${accountConflict(phase)}
    ${phase.kind === "sent" ? `<p class="good">交易雜湊：<code>${esc(phase.hash)}</code></p>` : ""}
    ${
      action
        ? `<button id="go"${action.disabled ? " disabled" : ""}>${esc(action.label)}</button>`
        : ""
    }

    <p class="foot">這一頁不會保存也不會上傳你的交易。它碰不到你的私鑰，簽名在你的錢包裡完成。</p>
  </div>`;
}

export function renderFailure(message: string): string {
  return `<div class="card"><h1>沒辦法繼續</h1><p class="bad">${esc(message)}</p></div>`;
}
