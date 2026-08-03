/**
 * 把 Moss 的結構化 Receipt 資料轉成人看得懂的一句話。
 *
 * 為什麼不直接用 Moss 的 `text`：那是寫給 agent 看的，金額是 wei、地址是完整 42 字元。
 * 產品的前提是非技術使用者三十秒讀懂，直接顯示會直接失敗。
 * 實際跑主網看到的原文長這樣：
 *   "Native MON Transfer: 250000000000000000 from 0xcccc… to 0x1b68…"
 *
 * 認得的形狀就重寫成人話，認不得的就退回原文並把地址縮短。不編造語意。
 */

import { formatUnits } from "viem";
import type { Change, TokenMap } from "../contract.js";

export type Direction = "out" | "in" | "approval" | "pending" | "";

export interface Humanized {
  direction: Direction;
  text: string;
}

const NATIVE_SYMBOL = "MON";
const NATIVE_DECIMALS = 18;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ADDRESS_RE = /0x[0-9a-fA-F]{40}/g;

/**
 * 超過這個值就當作實質無上限。**全專案共用這一個門檻**（pipeline 的比對規則
 * 與這裡的顯示都從這裡拿），兩邊分岔的話會出現「面板說無上限、規則不當它是
 * 無上限」這種自相矛盾。
 *
 * 原本是 `2^256/2`，只認得 `type(uint256).max` 那一種寫法。實務上無上限授權
 * 常常寫成 `type(uint160).max`（Permit2 的額度型別）或 `type(uint96).max`，
 * 兩個都遠小於 2^255，於是規則完全看不到它們。
 *
 * 現在的門檻是 `2^96 - 1`，也就是 uint96.max 本身。它約等於 7.9e28，
 * 對 18 位小數的代幣是 790 億顆——任何真實代幣的合理授權都不會到這個量級。
 *
 * 方向上刻意寧可誤報：把「很大但有上限」的授權判成無上限，結果是 partial、
 * 使用者多確認一次；漏掉一筆真的無上限授權，結果是 match、使用者直接簽下去。
 * 兩種錯的代價差很多。
 *
 * 更精確的做法是拿使用者當下的餘額比（超過餘額 N 倍就算無上限），
 * 但結構比對那層目前拿不到餘額，等錢包連接做完再說。
 */
export const EFFECTIVELY_UNLIMITED = 2n ** 96n - 1n;

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

const ADDRESS_EXACT = /^0x[0-9a-fA-F]{40}$/;

/**
 * 意圖參數的顯示值。
 *
 * 授權額度常常是 2^256-1，那是 78 位數，直接印出來是雜訊而且看不出意思。
 * 地址也一樣要縮短。其他值原樣顯示。
 */
export function displayParamValue(value: string, account?: string): string {
  if (ADDRESS_EXACT.test(value)) {
    if (account !== undefined && value.toLowerCase() === account.toLowerCase()) return "你自己";
    return shortAddress(value);
  }
  if (/^\d{16,}$/.test(value)) {
    try {
      if (BigInt(value) >= EFFECTIVELY_UNLIMITED) return "無上限";
    } catch {
      // 不是數字就原樣顯示
    }
  }
  return value;
}

/** 退回原文時的安全網：把裡面的完整地址縮短，不然結論頁會塞滿 hex */
export function shortenAddressesIn(text: string): string {
  return text.replace(ADDRESS_RE, (match) => shortAddress(match));
}

/**
 * wei 轉人看的數字。去掉尾端的零，超過六位小數就截斷。
 * 截斷過的會標 `~`，不讓人誤以為那是精確值。
 */
export function formatAmount(raw: string, decimals: number): string {
  let full: string;
  try {
    full = formatUnits(BigInt(raw), decimals);
  } catch {
    return raw;
  }
  const [whole = "0", fraction = ""] = full.split(".");
  const trimmed = fraction.replace(/0+$/, "");
  if (trimmed === "") return whole;
  if (trimmed.length <= 6) return `${whole}.${trimmed}`;
  return `~${whole}.${trimmed.slice(0, 6)}`;
}

function sameAddress(a: unknown, b: unknown): boolean {
  return (
    typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase()
  );
}

/**
 * 長整數的縮短顯示。
 *
 * 換算不了的時候還是要讓人看得到原始值（可以自己去 explorer 對），但直接印
 * 18 位數字是雜訊，也會撞到「畫面上不准出現未格式化長整數」那條回歸測試。
 */
export function shortNumber(raw: string): string {
  if (!/^\d+$/.test(raw) || raw.length <= 12) return raw;
  return `${raw.slice(0, 6)}…${raw.slice(-4)}`;
}

interface TokenDisplay {
  symbol: string;
  decimals: number;
  /** false 代表這個代幣的 symbol/decimals 沒查到，金額換算不了 */
  known: boolean;
}

function token(tokens: TokenMap, address: unknown): TokenDisplay {
  if (typeof address === "string") {
    const info = tokens[address.toLowerCase()];
    if (info) return { ...info, known: true };
  }
  return { symbol: "", decimals: 0, known: false };
}

/**
 * 查不到代幣資訊時**不能用 decimals=0 硬印**。
 *
 * 那會把 250000000000000000 原封不動放上畫面，讀的人會以為那是 2.5 億個代幣，
 * 實際上是 0.25 個。寧可講「換算不了」也不要給一個看起來像數量的錯數字。
 */
function amountWithSymbol(raw: unknown, info: TokenDisplay): string {
  const value = typeof raw === "string" ? raw : String(raw);
  if (!info.known) {
    return `${shortNumber(value)} 個最小單位（查不到小數位，換算不了）`;
  }
  return `${formatAmount(value, info.decimals)} ${info.symbol}`;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * vault 的底層資產（`assets` 欄位用哪個單位）。
 *
 * 原本這裡寫死 18 位與 "MON"。對目前註冊的協議是對的——shMONAD 的底層就是
 * 原生 MON，Moss 自己還會斷言 `assets` 等於那筆 native transfer 的 value
 * （shmonad.ts:229）。但這是 operation 名稱層級的分派，**任何新協議只要產出
 * `deposit` 形狀就會套用同一組數字**：底層是 USDC（6 位）的 vault 會拿到
 * 錯了 10^12 倍的金額，配上錯的符號，而且不會有任何警示。
 *
 * 所以先看 adapter 有沒有明講底層資產（`asset` / `assetToken`）。有就照它查，
 * 查不到就走 M-4 那條「換算不了」，不猜。沒有那個欄位才退回原生——
 * 這是目前唯一註冊的形狀，退回的理由寫在這裡而不是藏在魔術數字裡。
 */
function vaultAsset(tokens: TokenMap, d: Record<string, unknown>): TokenDisplay {
  const explicit = str(d.asset) ?? str(d.assetToken);
  if (explicit !== undefined) return token(tokens, explicit);
  return { symbol: NATIVE_SYMBOL, decimals: NATIVE_DECIMALS, known: true };
}

/**
 * 認得的 operation 就重寫，認不得就退回 fallback 原文。
 *
 * Moss 實際產出的形狀（2026-07-31 對主網實跑確認）：
 *   { operation: "nativeTransfer", from, to, value }
 *   { operation: "transfer", token, from, to, amount }
 *   { operation: "deposit", depositor, receiver, assets, shares }
 *   { operation: "withdraw", owner, receiver, assets, shares }
 */
export function humanize(
  data: unknown,
  change: Change,
  account: string,
  tokens: TokenMap,
  fallback: string,
): Humanized {
  const safeFallback = { direction: "" as Direction, text: shortenAddressesIn(fallback) };
  if (data === null || typeof data !== "object" || Array.isArray(data)) return safeFallback;

  const d = data as Record<string, unknown>;
  const operation = str(d.operation);

  if (operation === "nativeTransfer") {
    const amount = `${formatAmount(String(d.value ?? "0"), NATIVE_DECIMALS)} ${NATIVE_SYMBOL}`;
    if (sameAddress(d.from, account)) {
      return { direction: "out", text: `你支出 ${amount}` };
    }
    if (sameAddress(d.to, account)) {
      return { direction: "in", text: `你收到 ${amount}` };
    }
    return {
      direction: "",
      text: `${shortAddress(str(d.from) ?? "?")} 轉 ${amount} 給 ${shortAddress(str(d.to) ?? "?")}`,
    };
  }

  if (operation === "transfer") {
    const info = token(tokens, d.token);
    const amount = amountWithSymbol(d.amount, info);
    const minted = sameAddress(d.from, ZERO_ADDRESS);
    const burned = sameAddress(d.to, ZERO_ADDRESS);

    if (sameAddress(d.to, account)) {
      return { direction: "in", text: minted ? `你取得 ${amount}（新鑄出的）` : `你收到 ${amount}` };
    }
    if (sameAddress(d.from, account)) {
      return { direction: "out", text: burned ? `你的 ${amount} 被銷毀` : `你支出 ${amount}` };
    }
    return {
      direction: "",
      text: `${shortAddress(str(d.from) ?? "?")} 轉 ${amount} 給 ${shortAddress(str(d.to) ?? "?")}`,
    };
  }

  if (operation === "approval" || operation === "approve") {
    const info = token(tokens, d.token);
    const raw = str(d.amount) ?? str(d.value) ?? "0";
    let unlimited = false;
    try {
      unlimited = BigInt(raw) >= EFFECTIVELY_UNLIMITED;
    } catch {
      unlimited = false;
    }
    const spender = shortAddress(str(d.spender) ?? "?");
    const what = info.known ? info.symbol : "這個代幣";
    return {
      direction: "approval",
      text: unlimited
        ? `授權 ${spender} 動用你的 ${what}，沒有上限`
        : `授權 ${spender} 動用 ${amountWithSymbol(raw, info)}`,
    };
  }

  // 整批授權沒有金額欄位，所以不能套 approve 那條的寫法。要講的是範圍：
  // 整個系列、含以後才拿到的。這是 NFT drainer 最標準的一步。
  if (operation === "approvalForAll") {
    const operator = shortAddress(str(d.operator) ?? "?");
    const collection = shortAddress(str(d.collection) ?? "?");
    return {
      direction: "approval",
      text:
        d.approved === true
          ? `讓 ${operator} 可以轉走你在 ${collection} 這個系列裡的每一個，包含你以後才拿到的`
          : `收回 ${operator} 對 ${collection} 這個系列的轉移權`,
    };
  }

  // deposit / withdraw 是協議的記帳事件，不是價值移動。那筆價值已經在上面的
  // native transfer 與 token transfer 算過了，這裡再標成流入流出會變成重複計算，
  // 讀的人會以為拿到兩次。所以方向留白，讓它讀起來就是一筆紀錄。
  if (operation === "deposit") {
    const assets = amountWithSymbol(d.assets ?? "0", vaultAsset(tokens, d));
    const shares = amountWithSymbol(
      d.shares,
      token(tokens, change.kind === "event" ? change.address : undefined),
    );
    return { direction: "", text: `協議記錄這筆質押：${assets} 換 ${shares}` };
  }

  if (operation === "withdraw") {
    const assets = amountWithSymbol(d.assets ?? "0", vaultAsset(tokens, d));
    const shares = amountWithSymbol(
      d.shares,
      token(tokens, change.kind === "event" ? change.address : undefined),
    );
    return { direction: "pending", text: `協議記錄這筆贖回：${shares} 換回 ${assets}，款項不在這筆交易裡到帳` };
  }

  return safeFallback;
}
