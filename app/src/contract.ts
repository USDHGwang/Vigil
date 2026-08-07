/**
 * 前端資料契約。
 *
 * 這一層只做兩件事：
 *   1. 把 Moss 的既有型別原樣接進來（不複製、不改名）
 *   2. 補上 Moss 沒有的東西：使用者的意圖，以及意圖與證據的比對結論
 *
 * 介面實作對著這個檔案寫，不要對著任何截圖或口頭描述寫。
 */

import { type Change, type Receipt, type UnsignedTx, verifyReceiptCoverage } from "@themoss/core";
import type { Warning as SimulatorWarning } from "@themoss/simulator";
import type { Locale } from "./panel/i18n.js";

export type { Change, Receipt, ReceiptChange, Stub, UnsignedTx } from "@themoss/core";
export type { TransactionSimulation } from "@themoss/simulator";

/**
 * 面板的 warning 代碼。
 *
 * 大部分沿用 Moss 模擬器的（它那個聯集是封閉的），另外加上我們自己查的東西。
 * 模擬器不查不代表使用者不需要知道 —— `INSUFFICIENT_BALANCE` 就是一例：
 * 模擬時發送方餘額被蓋掉了，真實餘額要我們自己對。
 */
export type WarningCode =
  | SimulatorWarning["code"]
  | "INSUFFICIENT_BALANCE"
  // 多筆交易目前只送得出第一筆，簽出去會跟面板驗過的整包不一致，先擋簽名
  | "MULTI_TX_UNSUPPORTED"
  // 兩條 gas 估算路都失敗，付不付得起這件事沒驗成。不是通過也不是有危險。
  | "FEE_ESTIMATE_UNAVAILABLE";

export interface Warning {
  code: WarningCode;
  message: string;
}

/** 意圖從哪裡來。面板點選與 agent 產生的計畫都算意圖，貼進來的裸交易沒有意圖。 */
export type IntentSource = "panel" | "agent";

/** 使用者原本要什麼。Mode A 才有，Mode B 是 null。 */
export interface StatedIntent {
  source: IntentSource;
  protocol: string;
  method: string;
  /** 已經轉成人看得懂的參數值，例如 { amount: "10 MON" } */
  params: Readonly<Record<string, string>>;
  /** 一句話：「在 shMONAD 質押 10 MON」 */
  text: string;
}

/**
 * 比對結論。
 *
 * blocked 優先於其他所有結論：只要模擬過程出現 warning，
 * Moss 規定必須阻止簽名（packages/mcp-server/src/server.ts:178）。
 */
export type Verdict =
  | { kind: "match" }
  | { kind: "partial"; reason: string }
  | { kind: "mismatch"; conflicts: readonly string[] }
  | { kind: "noIntent" }
  | { kind: "blocked"; warnings: readonly Warning[] };

export type VerdictKind = Verdict["kind"];

/** 代幣的顯示資訊，從鏈上讀來，用來把 wei 變成人看得懂的數字。 */
export interface TokenInfo {
  symbol: string;
  decimals: number;
}

/** key 是小寫地址。原生代幣用 "native"。 */
export type TokenMap = Readonly<Record<string, TokenInfo>>;

/**
 * 面板渲染需要的全部東西。
 *
 * receipt 為 null 代表這個協議沒有支援模組，畫面直接渲染 changes。
 * changes 任何情況都有，它是不經任何人解讀的那一層。
 */
export interface EvidencePanelView {
  intent: StatedIntent | null;
  receipt: Receipt | null;
  changes: readonly Change[];
  warnings: readonly Warning[];
  verdict: Verdict;
  /** 簽名鍵是否可按。UI 直接用這個值，不要自己推。 */
  signable: boolean;
  /** 誰在送這筆交易。判斷資產是流出還是流入要用它。 */
  account: string;
  /**
   * 面板文案語言。preview_transaction 收 locale 參數，由 agent 從對話
   * 語言決定；預設 en。TUI 與 MCP UI 兩個出口讀同一個值，語言一致。
   */
  locale: Locale;
  /**
   * `account` 是哪裡來的。
   *
   * `agent` —— agent 傳進來的參數，**未經驗證**，跟 `intent.text` 同一個等級。
   * 面板上每一句「你支出」「你取得」「你自己」都建立在它上面，它錯這些就一起錯。
   * 簽名頁會拿錢包當下的帳戶跟它比對，那是唯一問得到真實答案的地方。
   *
   * `wallet` —— 使用者自己連過錢包，地址由錢包提供，agent 碰不到。
   */
  accountSource: "agent" | "wallet";
  /** 這筆交易碰到的代幣資訊，用來格式化金額。查不到的代幣不會出現在這裡。 */
  tokens: TokenMap;
  /**
   * 要交給錢包簽的未簽交易。
   *
   * **這是被模擬的那一筆本身**，直接取自模擬結果，不是重新建構的。
   * 如果這裡的位元組跟被模擬的不同，前面所有的驗證都失效。
   */
  transactions: readonly UnsignedTx[];
  /**
   * 交接指紋：上面那些交易的短雜湊。
   *
   * 面板顯示它，簽名頁也顯示它。使用者要驗中間有沒有被換掉，對這一串就好。
   */
  fingerprint: string;
}

export class ContractViolation extends Error {
  constructor(rule: string, detail: string) {
    super(`${rule}: ${detail}`);
    this.name = "ContractViolation";
  }
}

/**
 * 契約不變式。fixtures 與真實管線的輸出都必須通過。
 *
 * 前端在 dev 模式可以呼叫它擋自己的錯誤，測試用它驗 fixtures。
 */
export function assertViewInvariants(view: EvidencePanelView): void {
  if (view.warnings.length > 0 && view.signable) {
    throw new ContractViolation("WARNING_BLOCKS_SIGNING", "有 warning 時 signable 必須為 false");
  }

  if (view.warnings.length > 0 && view.verdict.kind !== "blocked") {
    throw new ContractViolation(
      "WARNING_IMPLIES_BLOCKED",
      `有 warning 時 verdict 必須是 blocked，收到 ${view.verdict.kind}`,
    );
  }

  if (view.verdict.kind === "blocked" && view.warnings.length === 0) {
    throw new ContractViolation("BLOCKED_NEEDS_WARNING", "verdict 是 blocked 但沒有 warning");
  }

  if (view.intent === null && view.verdict.kind !== "noIntent" && view.verdict.kind !== "blocked") {
    throw new ContractViolation(
      "NO_INTENT_NO_COMPARISON",
      `沒有意圖就不能出比對結論，收到 ${view.verdict.kind}`,
    );
  }

  if (view.intent !== null && view.verdict.kind === "noIntent") {
    throw new ContractViolation("INTENT_MUST_COMPARE", "有意圖卻回報 noIntent");
  }

  if (view.changes.length === 0 && view.warnings.length === 0) {
    throw new ContractViolation("EVIDENCE_REQUIRED", "沒有 warning 就必須有原始 changes");
  }

  if (view.receipt !== null) {
    // Moss 自己的覆蓋檢查：不漏、不重、不捏造、順序不變、且握的是原始物件
    verifyReceiptCoverage(view.changes, view.receipt);
  }
}

/** 把 Receipt 樹壓平成葉節點，UI 列清單時用。與 core 的內部壓平規則一致。 */
export function receiptLeaves(receipt: Receipt): readonly { text: string; change: Change }[] {
  const out: { text: string; change: Change }[] = [];
  const walk = (node: Receipt["changes"][number]): void => {
    if (node.kind === "change") {
      out.push({ text: node.text, change: node.change });
      return;
    }
    for (const child of node.changes) walk(child);
  };
  for (const node of receipt.changes) walk(node);
  return out;
}
