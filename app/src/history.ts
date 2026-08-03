/**
 * 這個 session 看過哪些交易。
 *
 * 目的（product-brief §6 的「v1 走瀏覽器本機記錄」，改放 server 端）：
 * 使用者在對話裡連續叫 agent 做好幾件事之後，想回頭看「剛剛那筆到底是什麼」
 * 而不用把對話往上捲。這是「省時間」那條敘事的一部分——放手讓 agent 做，
 * 但隨時回頭看得到做了什麼。
 *
 * **為什麼放 server 不放面板**：MCP App 的面板跑在 sandboxed iframe，
 * 沒有 `allow-same-origin` 就沒有 localStorage，而那是 host 決定的、我們控制不了。
 * server 端這條在 stdio 模式下是單一使用者的自己的 process，記在這裡最單純。
 *
 * ## 只記錄我們確實知道的
 *
 * 記的是**預覽**，不是「有沒有簽下去」。簽名發生在面板外面的錢包裡，server
 * 收不到結果——除非簽名頁回報，而託管版的簽名頁是純靜態、沒有可回報的對象。
 * 與其猜一個 `signed` 欄位，不如誠實只記「這一筆被預覽過、結論是什麼」。
 * 這跟整個專案的原則一致：不宣稱沒被驗證的事。
 *
 * ## 邊界
 *
 * - **記憶體內，process 結束就沒了。** stdio 模式下 host 關掉就重來，這是刻意的：
 *   落地檔案會在使用者不知情的情況下把交易紀錄留在硬碟上。要持久化是另一個決定。
 * - **多使用者的遠端部署不能直接用這個。** 無狀態 HTTP 模式下所有人的紀錄會混在
 *   同一個 process 裡。遠端部署前必須先綁 session，否則會把 A 的紀錄給 B 看到。
 */

import type { EvidencePanelView } from "./contract.js";

/** 一筆預覽紀錄。刻意不存 calldata 與完整參數——回頭看不需要，留著只是風險。 */
export interface PreviewRecord {
  /** 毫秒 epoch，由呼叫端給，方便測試 */
  at: number;
  /** agent 宣稱使用者要求什麼。未經驗證的輸入，標籤要跟面板一致。 */
  statedRequest: string;
  protocol: string;
  method: string;
  /** 結構比對的結論 */
  verdict: EvidencePanelView["verdict"]["kind"];
  signable: boolean;
  /** 交接指紋，讓使用者能把紀錄跟簽名頁上看過的那串對起來 */
  fingerprint: string;
  /** 一句話效果摘要，人話版。沒有 receipt 時是變動筆數。 */
  summary: string;
}

/**
 * 上限。server 可能開著一整天，不設限就是一條會長大的記憶體。
 * 50 筆足夠回頭找「剛剛那筆」，也不至於變成一份完整的行為紀錄。
 */
export const MAX_RECORDS = 50;

/** 從 view 抽出要記的東西。純函式，好測。 */
export function toRecord(view: EvidencePanelView, at: number): PreviewRecord {
  const receipt = view.receipt;
  const summary =
    receipt !== null && receipt.text !== ""
      ? receipt.text
      : `${view.changes.length} 筆未解讀的變動`;
  return {
    at,
    statedRequest: view.intent?.text ?? "（沒有可對照的要求）",
    protocol: view.intent?.protocol ?? "",
    method: view.intent?.method ?? "",
    verdict: view.verdict.kind,
    signable: view.signable,
    fingerprint: view.fingerprint,
    summary,
  };
}

/**
 * 加一筆，回傳新的清單。**純函式，不改輸入。**
 *
 * 同一個指紋只留最新一筆：使用者在面板裡改參數重新模擬時，改到一半的中間狀態
 * 沒有回頭看的價值，留著只會把清單洗掉。指紋涵蓋 chainId 與每筆交易的
 * from/to/value/data，所以「同指紋」就是「同一筆交易」。
 */
export function append(
  list: readonly PreviewRecord[],
  record: PreviewRecord,
  max = MAX_RECORDS,
): PreviewRecord[] {
  const withoutSame = list.filter((r) => r.fingerprint !== record.fingerprint);
  // 最新的在前面：回頭看幾乎都是找最近那筆
  return [record, ...withoutSame].slice(0, max);
}

/** 這個 process 的紀錄。 */
let records: PreviewRecord[] = [];

export function record(view: EvidencePanelView, at: number = Date.now()): void {
  records = append(records, toRecord(view, at));
}

export function recent(limit = MAX_RECORDS): PreviewRecord[] {
  return records.slice(0, Math.max(0, limit));
}

/** 測試用。正式路徑不該清空——使用者沒要求就不要動他的紀錄。 */
export function resetHistory(): void {
  records = [];
}
