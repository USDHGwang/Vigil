/**
 * 交接：把被模擬過的那筆未簽交易，從面板送到使用者自己的錢包。
 *
 * 為什麼需要這一層：MCP App 的 iframe 是 sandbox，碰不到 `window.ethereum`。
 * 這是規格寫死的安全設計，不是實作缺漏。
 *
 * 為什麼不繞回 agent：agent 正是我們假設不可信的那一方。它在人核准之後才
 * 拿到交易，可以交出去一筆不一樣的，前面的驗證就白做了。所以交接必須由
 * 面板直接做。
 *
 * 指紋的用途：面板顯示一串短雜湊，簽名頁顯示同一串。使用者要確認中間沒被
 * 換掉，對這一串就好。這讓「被簽的是被模擬的那一筆」從宣稱變成可查核。
 */

import type { UnsignedTx } from "@themoss/core";
import { keccak256, toHex } from "viem";
import type { Locale } from "./panel/i18n.js";

/** Monad 主網。Moss v1 只支援這條鏈，Runtime 會驗。 */
export const MONAD_CHAIN_ID = 143;

export interface HandoffPayload {
  chainId: number;
  transactions: readonly UnsignedTx[];
  /** 面板上顯示過的那句話，簽名頁再顯示一次讓使用者對照 */
  summary: string;
  fingerprint: string;
  /** 面板的語言。簽名頁跟著它顯示，不然英文對話會跳到中文簽名頁。 */
  locale?: Locale;
}

/**
 * 交易的指紋。
 *
 * 對 chainId 與每筆的 from / to / value / data 串接後取 keccak256 的前 8 個位元組。
 * 只要任何一個位元組被改動，指紋就不同。
 *
 * `from` 必須蓋進來：簽名頁的帳戶比對與 eth_sendTransaction 用的就是它，
 * 不蓋的話「只改 from」的竄改對指紋不可見——錢包會以另一個帳戶送出一段
 * 用原帳戶模擬出來的 calldata。chainId 同理，它決定錢包被要求切到哪條鏈。
 *
 * 邊界要講清楚：**這是 hash，不是 MAC。** 面板與簽名頁之間沒有共享祕密，
 * 所以「連指紋一起重算」的竄改者機器擋不下來（見 decodeHandoff）。擋它的
 * 是人工比對——面板顯示一串、簽名頁顯示一串，兩串要一樣。竄改者改得了
 * 網址裡的指紋，改不了使用者已經在面板上看到的那串。
 */
export function fingerprintOf(
  transactions: readonly UnsignedTx[],
  chainId: number,
): string {
  const canonical = [
    String(chainId),
    ...transactions.map(
      (tx) =>
        `${tx.from.toLowerCase()}|${tx.to.toLowerCase()}|${tx.value.toLowerCase()}|${tx.data.toLowerCase()}`,
    ),
  ].join("\n");
  return keccak256(toHex(canonical)).slice(2, 18).toUpperCase();
}

/** 分四組顯示，人比對的時候不容易看丟 */
export function formatFingerprint(fingerprint: string): string {
  return (fingerprint.match(/.{1,4}/g) ?? [fingerprint]).join(" ");
}

function base64UrlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(encoded: string): string {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/**
 * 交易資料放在網址的 `#` 後面。
 *
 * fragment 不會被瀏覽器放進 HTTP 請求，所以交易內容不會送到託管簽名頁的
 * 伺服器上，只留在使用者的瀏覽器裡。
 */
export function encodeHandoff(payload: HandoffPayload): string {
  return base64UrlEncode(JSON.stringify(payload));
}

export function decodeHandoff(encoded: string): HandoffPayload {
  let parsed: HandoffPayload;
  try {
    parsed = JSON.parse(base64UrlDecode(encoded)) as HandoffPayload;
  } catch {
    // atob / JSON.parse 的原生錯誤是給開發者看的，不要漏到使用者面前
    throw new Error("交接資料讀不出來，這串網址不完整或被改過");
  }
  if (!Array.isArray(parsed.transactions) || parsed.transactions.length === 0) {
    throw new Error("交接資料裡沒有交易");
  }
  // 這一頁只簽 Monad 主網。鏈不對就不是我們產的交接，直接擋。
  if (parsed.chainId !== MONAD_CHAIN_ID) {
    throw new Error(
      `交接資料的鏈不對（${String(parsed.chainId)}），這一頁只處理 Monad 主網（${MONAD_CHAIN_ID}）`,
    );
  }
  // 指紋自己重算一次。**這是自洽檢查，不是防偽**：擋得住傳輸損壞和忘記
  // 重算指紋的竄改，擋不住連指紋一起重算的竄改者——那種要靠使用者比對
  // 面板與這一頁顯示的指紋（見 fingerprintOf 的註解）。
  const recomputed = fingerprintOf(parsed.transactions, parsed.chainId);
  if (recomputed !== parsed.fingerprint) {
    throw new Error("交接資料的指紋對不上，這串網址被改過或不完整");
  }
  return parsed;
}

export function handoffUrl(base: string, payload: HandoffPayload): string {
  return `${base}#${encodeHandoff(payload)}`;
}
