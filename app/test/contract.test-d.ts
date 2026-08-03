/**
 * 編譯期契約測試。這個檔案不執行，靠 `pnpm typecheck` 檢查。
 *
 * 每個 @ts-expect-error 都是一條斷言：下一行必須編譯失敗。
 * 如果契約被放寬（例如某個欄位變成 optional），這裡會反過來報錯，
 * 因為預期的錯誤沒有發生。
 */

import type { Change } from "@themoss/core";
import type { EvidencePanelView, StatedIntent, Verdict } from "../src/contract.js";

const account = "0x4E9A3B2c7F5d18e6A0b4C93D2f7185aE6cB0d3F2";

const intent: StatedIntent = {
  source: "panel",
  protocol: "shmonad",
  method: "stake",
  params: { amount: "10 MON" },
  text: "在 shMONAD 質押 10 MON",
};

// 合法用法要能編譯
const ok: EvidencePanelView = {
  intent,
  receipt: null,
  changes: [{ kind: "nativeTransfer", from: account, to: account, value: "1" }],
  warnings: [],
  verdict: { kind: "noIntent" },
  signable: true,
  account,
  accountSource: "agent",
  tokens: {},
  transactions: [{ from: account, to: account, data: "0x", value: "0x0" }],
  fingerprint: "AABBCCDD11223344",
};
void ok;

// intent 的來源只有 panel 與 agent
// @ts-expect-error dapp 不是合法的意圖來源
const badSource: StatedIntent = { ...intent, source: "dapp" };
void badSource;

// verdict 是 discriminated union，kind 必須是已知的五種之一
// @ts-expect-error looksFine 不是合法的 verdict
const badVerdict: Verdict = { kind: "looksFine" };
void badVerdict;

// mismatch 一定要帶 conflicts
// @ts-expect-error 少了 conflicts
const missingConflicts: Verdict = { kind: "mismatch" };
void missingConflicts;

// partial 一定要帶 reason
// @ts-expect-error 少了 reason
const missingReason: Verdict = { kind: "partial" };
void missingReason;

// changes 是唯讀的，UI 不准就地改證據
const view: EvidencePanelView = ok;
// @ts-expect-error changes 是 readonly array
view.changes.push({ kind: "nativeTransfer", from: account, to: account, value: "1" });

// Change 只有 event 與 nativeTransfer 兩種
// @ts-expect-error storageWrite 不是 Moss 認可的 Change
const badChange: Change = { kind: "storageWrite", slot: "0x0", value: "0x1" };
void badChange;

// receipt 可以是 null，但不能省略
// @ts-expect-error 缺少 receipt 欄位
const missingReceipt: EvidencePanelView = {
  intent,
  changes: [],
  warnings: [],
  verdict: { kind: "match" },
  signable: true,
};
void missingReceipt;
