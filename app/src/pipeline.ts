/**
 * 真實管線：從「agent 想做什麼」到「面板要顯示什麼」。
 *
 *   registry.action()  構造出 Capability
 *   simulator.simulate()  對 Monad 主網跑 debug_traceCall
 *   registry.parseReceipt()  把 Change 翻成 Receipt（Moss 內部驗覆蓋）
 *   toPanelView()  組成面板要的 EvidencePanelView
 *
 * 比對分兩層（見 product-brief §4）：這裡只做機器能確定性判斷的結構層。
 * 語意層（使用者說的話 vs 實際效果）由面板並排顯示，交給人。
 */

import {
  type AddressValue,
  type Change,
  createRuntime,
  MONAD_CHAIN_ID as MOSS_CHAIN_ID,
  Registry,
  type Receipt,
} from "@themoss/core";
import * as erc from "@themoss/erc";
import * as kuru from "@themoss/protocol-kuru";
import * as shmonad from "@themoss/protocol-shmonad";
import { createTraceSimulator } from "@themoss/simulator";
import * as system from "@themoss/system";
import { decodeEventLog, parseAbi, toEventSelector } from "viem";
// EFFECTIVELY_UNLIMITED 的定義與理由在 humanize.ts。
// **顯示與規則必須用同一個門檻**，分岔的話會出現「面板寫無上限、規則不當它是
// 無上限」這種自相矛盾。
import { EFFECTIVELY_UNLIMITED, formatAmount } from "./panel/humanize.js";
import type {
  EvidencePanelView,
  StatedIntent,
  TokenInfo,
  TokenMap,
  UnsignedTx,
  Verdict,
  Warning,
} from "./contract.js";
import { fingerprintOf, MONAD_CHAIN_ID } from "./handoff.js";
import { isLocale, t, type Locale } from "./panel/i18n.js";

/** 授權事件的 topic0，用簽章現算，不手抄常數。 */
const APPROVAL_TOPIC = toEventSelector("Approval(address,address,uint256)");
const APPROVAL_ABI = parseAbi([
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
]);

/**
 * ERC-721 的單顆 Approval 跟 ERC-20 **共用同一個 topic0**（事件簽章字串一模一樣），
 * 差在 layout：ERC-721 三個參數全 indexed（4 個 topic、data 空），ERC-20 兩個
 * indexed（3 個 topic、額度在 data）。只解 ERC-20 那種等於對它的 NFT 版失明——
 * 一筆把單顆高價 NFT 轉移權交出去的 Approval 會完全不被任何規則看到。
 */
const ERC721_APPROVAL_ABI = parseAbi([
  "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
]);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * 整批授權。ERC-721 與 ERC-1155 共用這個事件簽章。
 *
 * **它的 topic 跟 ERC-20 的 `Approval` 不同**，所以 `findApprovals` 抓不到。
 * 只防 ERC-20 那一半，等於對 NFT drainer 最標準的第一步完全失明——而它比
 * 無上限 ERC-20 授權更狠：沒有金額欄位，拿到的是整個系列的轉移權，
 * 包含使用者以後才鑄到或買到的。
 */
const APPROVAL_FOR_ALL_TOPIC = toEventSelector("ApprovalForAll(address,address,bool)");
const APPROVAL_FOR_ALL_ABI = parseAbi([
  "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
]);

export interface SimulateRequest {
  /** 交易的發起帳戶 */
  account: AddressValue;
  protocol: string;
  method: string;
  params: Record<string, unknown>;
  /** agent 宣稱使用者要求什麼。未經驗證的輸入。 */
  statedRequest: string;
  /** 面板文案語言。agent 從對話語言決定；預設 en。 */
  locale?: Locale;
}

let cached: Awaited<ReturnType<typeof buildStack>> | undefined;

/**
 * Moss 認定的鏈 ID 必須跟我們交接給錢包時宣告的一致。
 * 兩邊各有一份常數，分岔的話模擬的是一條鏈、簽名頁叫錢包切到另一條。
 */
if (MOSS_CHAIN_ID !== MONAD_CHAIN_ID) {
  throw new Error(
    `鏈 ID 對不上：Moss 是 ${MOSS_CHAIN_ID}，交接層是 ${MONAD_CHAIN_ID}`,
  );
}

async function buildStack() {
  // createRuntime 會讀 MOSS_RPC_URL，沒設就用公開節點。它自己驗鏈 ID。
  const runtime = await createRuntime();
  const registry = new Registry(runtime).use(system, erc, kuru, shmonad);
  const simulator = createTraceSimulator(runtime, {
    receipt: (capability, changes) => registry.parseReceipt(capability, changes),
  });
  return { runtime, registry, simulator };
}

/** Runtime 會驗 chain ID，建一次就好。 */
export async function getStack() {
  cached ??= await buildStack();
  return cached;
}

// ---------------------------------------------------------------------------
// 代幣資訊
// ---------------------------------------------------------------------------

const TOKEN_ABI = parseAbi([
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
]);

/**
 * 查不到的代幣不放進表裡，面板會說「換算不了」而不是編一個數字出來。
 *
 * 失敗**不能永久快取**。查不到的原因常常是暫時的（RPC 抖動、限流），而這個
 * Map 活在 module scope，永久記下等於整個 process 往後每一筆這個代幣的金額
 * 都變成「換算不了」。成功的結果才可以永久留——symbol 與 decimals 不會變。
 */
const NEGATIVE_TTL_MS = 60_000;
const tokenCache = new Map<string, TokenInfo>();
const tokenMisses = new Map<string, number>();

function missedRecently(address: string, now: number): boolean {
  const at = tokenMisses.get(address);
  if (at === undefined) return false;
  if (now - at < NEGATIVE_TTL_MS) return true;
  tokenMisses.delete(address);
  return false;
}

/** 測試用：清掉快取，讓每條測試從乾淨狀態開始 */
export function resetTokenCache(): void {
  tokenCache.clear();
  tokenMisses.clear();
}

/**
 * 讀出這批 Change 碰到的代幣的 symbol 與 decimals。
 *
 * 沒有這個，面板只能顯示 wei（250000000000000000），使用者讀不懂，
 * 產品「三十秒讀懂」的前提就不成立。
 */
export async function readTokens(changes: readonly Change[]): Promise<TokenMap> {
  const { runtime } = await getStack();
  const addresses = new Set<string>();
  for (const change of changes) {
    if (change.kind === "event") addresses.add(change.address.toLowerCase());
  }

  const out: Record<string, TokenInfo> = {};
  const now = Date.now();
  await Promise.all(
    [...addresses].map(async (address) => {
      if (!tokenCache.has(address) && !missedRecently(address, now)) {
        try {
          const [symbol, decimals] = await Promise.all([
            runtime.client.readContract({
              address: address as AddressValue,
              abi: TOKEN_ABI,
              functionName: "symbol",
            }),
            runtime.client.readContract({
              address: address as AddressValue,
              abi: TOKEN_ABI,
              functionName: "decimals",
            }),
          ]);
          // decimals 解不出數字就當查不到。硬塞 NaN 進去，formatUnits 會回
          // NaN 或丟例外，面板上會出現一個看不出是錯的錯數字。
          const places = Number(decimals);
          if (!Number.isInteger(places) || places < 0 || places > 36) {
            throw new Error(`decimals 不是合理的值：${String(decimals)}`);
          }
          tokenCache.set(address, { symbol, decimals: places });
        } catch {
          // 不是 ERC20，或這次讀不到。記時間點，TTL 過了會再問一次。
          tokenMisses.set(address, now);
        }
      }
      const info = tokenCache.get(address);
      if (info) out[address] = info;
    }),
  );
  return out;
}

// ---------------------------------------------------------------------------
// 結構層比對
// ---------------------------------------------------------------------------

interface ApprovalFinding {
  /** 發出事件的代幣合約 */
  token: string;
  spender: string;
  /** ERC-20 是額度；ERC-721 是被授權的 tokenId */
  value: bigint;
  unlimited: boolean;
  /** 同一個 topic0 兩種 layout：3 個 topic 是 ERC-20 額度，4 個是 ERC-721 單顆 */
  kind: "erc20" | "erc721";
}

interface OperatorFinding {
  /** 發出事件的合約，也就是被交出去的那個系列 */
  collection: string;
  operator: string;
  /** false 是撤銷。撤銷把權限收回來，不需要警告。 */
  approved: boolean;
}

/** 訊息是給人讀的，地址縮短。完整值在原始資料分頁看得到。 */
function shortWho(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/** 從原始 Change 找出整批授權。跟 findApprovals 一樣不依賴任何 adapter 的解讀。 */
export function findOperatorApprovals(changes: readonly Change[]): OperatorFinding[] {
  const out: OperatorFinding[] = [];
  for (const change of changes) {
    if (change.kind !== "event") continue;
    if (change.topics[0] !== APPROVAL_FOR_ALL_TOPIC) continue;
    try {
      const decoded = decodeEventLog({
        abi: APPROVAL_FOR_ALL_ABI,
        topics: change.topics as [`0x${string}`, ...`0x${string}`[]],
        data: change.data,
      });
      out.push({
        collection: change.address,
        operator: decoded.args.operator,
        approved: decoded.args.approved,
      });
    } catch {
      // 解不開就不當授權處理，寧可漏報也不誤報
    }
  }
  return out;
}

/** 從原始 Change 找出授權（ERC-20 額度與 ERC-721 單顆）。不依賴任何 adapter 的解讀。 */
export function findApprovals(changes: readonly Change[]): ApprovalFinding[] {
  const out: ApprovalFinding[] = [];
  for (const change of changes) {
    if (change.kind !== "event") continue;
    if (change.topics[0] !== APPROVAL_TOPIC) continue;
    try {
      if (change.topics.length === 4) {
        // ERC-721 layout（見 ERC721_APPROVAL_ABI 的註解）
        const decoded = decodeEventLog({
          abi: ERC721_APPROVAL_ABI,
          topics: change.topics as [`0x${string}`, ...`0x${string}`[]],
          data: change.data,
        });
        // 授權給零地址是撤銷，把權限收回來不需要警告
        if (decoded.args.approved.toLowerCase() === ZERO_ADDRESS) continue;
        out.push({
          token: change.address,
          spender: decoded.args.approved,
          value: decoded.args.tokenId,
          unlimited: false,
          kind: "erc721",
        });
        continue;
      }
      const decoded = decodeEventLog({
        abi: APPROVAL_ABI,
        topics: change.topics as [`0x${string}`, ...`0x${string}`[]],
        data: change.data,
      });
      const value = decoded.args.value;
      out.push({
        token: change.address,
        spender: decoded.args.spender,
        value,
        unlimited: value >= EFFECTIVELY_UNLIMITED,
        kind: "erc20",
      });
    } catch {
      // 解不開就不當授權處理，寧可漏報也不誤報
    }
  }
  return out;
}

/** 意圖裡出現過的地址，比對時當作「使用者知情」的對象。 */
function addressesInIntent(request: SimulateRequest): Set<string> {
  const set = new Set<string>([request.account.toLowerCase()]);
  for (const value of Object.values(request.params)) {
    if (typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value)) {
      set.add(value.toLowerCase());
    }
  }
  return set;
}

/**
 * method 與 receipt operation 的合法對應。
 *
 * Moss 的 ERC-1155 capability method 叫 `approve`，但它產出的 operation 是
 * `approvalForAll`（vendor/moss/packages/erc/src/erc1155.ts）。直接字串相等會把
 * 這條合法路徑恆判 mismatch，rule 3 的「明白呼叫也要人確認」永遠輪不到。
 * 不在表裡的組合照樣算對不上。
 */
const OPERATION_SYNONYMS: Record<string, readonly string[]> = {
  approve: ["approvalForAll"],
};

/**
 * 結構層判斷。
 *
 * **這一層驗的是「交易做的事」對不對得上「agent 呼叫的操作」，不是對不對得上
 * 「使用者說的話」。** 後者是自然語言，機器判斷不了，由面板把兩者並排給人看。
 *
 * 這個界線很重要。agent 被注入指令的時候，它會宣告一件事、呼叫另一件事。
 * 結構層看到的是「呼叫 approve、交易真的 approve」，那是相符的。真正對不上的
 * 是使用者原本說的話，那要人自己判斷。所以 match 的文案不能寫成「跟你要的一致」，
 * 那會宣稱一件沒有被驗證的事。
 *
 * 五條規則，都不需要 per-protocol 知識：
 *   1. 出現這個操作沒指定的授權對象（ERC-20 額度、ERC-721 單顆、NFT 整批都算）
 *   2. receipt 的 operation 對不上呼叫的 method（同義對應見 OPERATION_SYNONYMS）
 *   3. 任何整批授權（setApprovalForAll）都要人確認
 *   4. 任何無上限 ERC-20 授權都要人確認
 *   5. 沒有解讀模組就誠實說比不了
 */
export function structuralVerdict(
  request: SimulateRequest,
  receipt: Receipt | null,
  changes: readonly Change[],
  locale: Locale,
): Verdict {
  const conflicts: string[] = [];
  const known = addressesInIntent(request);
  const approvals = findApprovals(changes);

  // 撤銷（approved: false）是把權限收回來，不需要警告
  const grants = findOperatorApprovals(changes).filter((g) => g.approved);

  // rule 1 不看 method 名稱決定跑不跑——之前 method 含 approve/permit/allow 就
  // 整段跳過，等於「有上限、但給錯人」的授權在 approve 類操作裡隱形。使用者
  // 指名的對象本來就在 known 裡，逐筆對 known 就夠了，不需要開關。
  for (const approval of approvals) {
    if (known.has(approval.spender.toLowerCase())) continue;
    const who = shortWho(approval.spender);
    conflicts.push(
      approval.kind === "erc721"
        ? t(locale, "conflict_nft_approval", {
            who,
            token: shortWho(approval.token),
            id: String(approval.value),
          })
        : approval.unlimited
          ? t(locale, "conflict_unlimited_approval", { who })
          : t(locale, "conflict_approval", { who }),
    );
  }
  for (const grant of grants) {
    if (known.has(grant.operator.toLowerCase())) continue;
    conflicts.push(
      t(locale, "conflict_batch_grant", {
        who: shortWho(grant.operator),
        collection: shortWho(grant.collection),
      }),
    );
  }

  const outcome = receipt?.outcome;
  if (outcome !== null && typeof outcome === "object" && !Array.isArray(outcome)) {
    const operation = (outcome as Record<string, unknown>).operation;
    if (
      typeof operation === "string" &&
      operation !== request.method &&
      !(OPERATION_SYNONYMS[request.method] ?? []).includes(operation)
    ) {
      conflicts.push(t(locale, "conflict_operation", { actual: operation, requested: request.method }));
    }
  }

  if (conflicts.length > 0) return { kind: "mismatch", conflicts };

  // 整批授權即使是明白呼叫的，也不能當成沒事，而且比無上限 ERC-20 授權更該停。
  // 它沒有金額欄位，交出去的是整個系列的轉移權，含使用者以後才拿到的那些。
  if (grants.length > 0) {
    const who = grants.map((g) => shortWho(g.operator)).join("、");
    const what = [...new Set(grants.map((g) => shortWho(g.collection)))].join("、");
    return {
      kind: "partial",
      reason: t(locale, "reason_batch_grant", { who, what }),
    };
  }

  // 無上限授權即使是明白呼叫的，也不能當成沒事。它把往後的所有餘額都交出去，
  // 而且是 drainer 最常用的一步，值得使用者停下來看一眼。
  const unlimited = approvals.filter((a) => a.unlimited);
  if (unlimited.length > 0) {
    const who = unlimited.map((a) => shortWho(a.spender)).join("、");
    return {
      kind: "partial",
      reason: t(locale, "reason_unlimited", { who }),
    };
  }

  /**
   * 剩下的授權：對象在 `known` 裡，額度也沒到無上限門檻。
   *
   * **這種情況不能回 match。** `known` 是 `addressesInIntent` 從 request.params
   * 掃出來的，而 params 是 agent 給的——被注入的 agent 只要把攻擊者地址填進
   * spender、額度壓在門檻以下（2^96-1 對 18 位小數代幣是 790 億顆，遠超任何
   * 真實需求），rule 1 與 rule 4 就都不會觸發，面板會顯示 ✓「沒有發現意料外的
   * 動作」並且可簽。機器在這裡真正驗到的只有「交易做的事對得上 agent 呼叫的
   * 操作」，那句話撐不起一個綠勾。
   *
   * 所以：**任何把餘額交給發送者以外的人的授權，至少是 partial。** 授權給自己
   * 是 no-op，不算。額度大小由人判斷，效果清單裡有數字。
   */
  const toOthers = approvals.filter(
    (a) => a.spender.toLowerCase() !== request.account.toLowerCase(),
  );
  if (toOthers.length > 0) {
    const who = [...new Set(toOthers.map((a) => shortWho(a.spender)))].join("、");
    const what = [...new Set(toOthers.map((a) => shortWho(a.token)))].join("、");
    return {
      kind: "partial",
      reason: t(locale, "reason_approval_named", { who, what }),
    };
  }

  if (receipt === null) {
    return {
      kind: "partial",
      reason: t(locale, "reason_no_module"),
    };
  }
  return { kind: "match" };
}

// ---------------------------------------------------------------------------
// 組成面板要的 view
// ---------------------------------------------------------------------------

export interface Affordability {
  balance: bigint;
  /** 交易本身要送出去的原生代幣 */
  value: bigint;
  /** 估計手續費 */
  fee: bigint;
  needed: bigint;
  /** 差多少。夠的話是 0。 */
  short: bigint;
}

/**
 * 餘額夠不夠付這筆。
 *
 * 為什麼要自己算：Moss 的模擬器把發送方餘額蓋成 100 萬 MON 再跑
 * （simulator/src/index.ts 的 DEFAULT_PREFUND_WEI）。對 Moss 是合理的預設，
 * 它要能回答「這個呼叫會做什麼」而不管帳戶有沒有錢。
 *
 * 對我們是錯的。我們宣稱的是「簽名前看到這筆交易實際會發生什麼」，而一筆
 * 付不出來的交易，實際會發生的事是 revert 加上白付的手續費。不查這個，面板
 * 就會對一筆注定失敗的交易說「沒有發現意料外的動作」。
 */
export function affordability(
  balance: bigint,
  transactions: readonly UnsignedTx[],
  gasUnits: bigint,
  gasPrice: bigint,
): Affordability {
  const value = transactions.reduce((sum, tx) => sum + BigInt(tx.value), 0n);
  const fee = gasUnits * gasPrice;
  const needed = value + fee;
  return { balance, value, fee, needed, short: needed > balance ? needed - balance : 0n };
}

/**
 * 模擬結果裡的 gas 總量。**任何一筆估不到就回 null，不當 0。**
 *
 * Moss 的 `estimateGasWithOverrides` 用的是非標準的 `eth_estimateGas` 三參數
 * 形式（帶 state overrides），任何失敗都吞掉並寫 `gas: null`。原本這裡
 * `BigInt(r.gas ?? 0)` 把 null 當 0，手續費就靜默變成 0，餘額檢查退化成只比
 * 本金——而餘額檢查存在的理由正是「付不出手續費的交易會 revert，手續費照扣」。
 * 沒有任何訊號會告訴任何人 fee 被當成 0。
 */
export function gasUnitsFrom(results: readonly { gas: string | null }[]): bigint | null {
  let sum = 0n;
  for (const r of results) {
    if (r.gas === null) return null;
    try {
      sum += BigInt(r.gas);
    } catch {
      return null;
    }
  }
  return sum;
}

/**
 * 退回標準的 `eth_estimateGas`（不帶 overrides）。
 *
 * Moss 那條路失敗多半是節點不收第三個非標準參數，標準呼叫通常還是通的。
 * 這裡不覆蓋餘額，所以帳戶真的付不起時它會直接失敗——那也是有用的資訊，
 * 由呼叫端當成「估不到」處理並擋下簽名。
 */
async function estimateGasWithoutOverrides(
  client: { estimateGas: (args: Record<string, unknown>) => Promise<bigint> },
  transactions: readonly UnsignedTx[],
): Promise<bigint | null> {
  try {
    let sum = 0n;
    for (const tx of transactions) {
      sum += await client.estimateGas({
        account: tx.from,
        to: tx.to,
        data: tx.data,
        value: BigInt(tx.value),
      });
    }
    return sum;
  } catch {
    return null;
  }
}

/**
 * 兩條路都估不到手續費時的警告。
 *
 * 不能靜默放行：這個檢查的用途就是攔下「送出去會 revert、手續費白扣」的交易，
 * 估不到手續費等於這個檢查沒做。照設計 brief 的第五種狀態處理——
 * 「我們沒能驗證。不是通過，也不是有危險」，所以擋簽名但把已知的部分講出來。
 */
export function feeUnknownWarning(balance: bigint, value: bigint, locale: Locale = "en"): Warning {
  const mon = (wei: bigint): string => formatAmount(wei.toString(), 18);
  return {
    code: "FEE_ESTIMATE_UNAVAILABLE",
    message: t(locale, "warn_fee_unknown", {
      value: mon(value),
      balance: mon(balance),
    }),
  };
}

/**
 * 金額走 formatAmount 而不是 formatEther：後者會吐 18 位小數，人讀不了，
 * 也會撞到「畫面上不准出現未格式化長整數」那條回歸測試。顯示規則全專案一套。
 */
export function affordabilityWarning(a: Affordability, locale: Locale = "en"): Warning | null {
  if (a.short === 0n) return null;
  const mon = (wei: bigint): string => formatAmount(wei.toString(), 18);
  return {
    code: "INSUFFICIENT_BALANCE",
    message: t(locale, "warn_insufficient", {
      have: mon(a.balance),
      need: mon(a.needed),
      fee: mon(a.fee),
      short: mon(a.short),
    }),
  };
}

/**
 * 多筆交易目前簽不完整：簽名頁一次只送得出第一筆（sign/main.ts），而指紋與
 * 面板證據涵蓋的是整包。讓它可簽名，使用者以為簽的是整個操作（例如 swap），
 * 實際上鏈的只有第一筆（例如 approve）——「證據來自執行」就在這條路上破功。
 * 所以多筆一律擋下來，效果照樣顯示；多筆簽名做好之前不開放。
 */
export function multiTransactionWarning(
  transactions: readonly UnsignedTx[],
  locale: Locale = "en",
): Warning | null {
  if (transactions.length <= 1) return null;
  return {
    code: "MULTI_TX_UNSUPPORTED",
    message: t(locale, "warn_multi_tx", { n: String(transactions.length) }),
  };
}

export interface PipelineResult {
  view: EvidencePanelView;
  /** 給 agent 看的精簡文字 */
  summary: string;
}

export async function previewTransaction(request: SimulateRequest): Promise<PipelineResult> {
  const { registry, simulator, runtime } = await getStack();

  const params = { ...request.params };
  // receiver 省略時視為質押給自己（= 發送帳戶）。質押給自己是
  // 最常見的形態，agent 不該被「不知道 receiver 填什麼」卡住——
  // 使用者說「幫我質押 0.25 MON」時本來就沒指定收款人。
  // 只補「該 method 的 schema 真的收 receiver」的情況：erc20.transfer 這類
  // 不收 receiver 的方法硬塞進去會變成 Unrecognized key，整筆直接爆掉。
  // to/token 缺了是真正的錯誤，不補。
  if (params.receiver === undefined) {
    const stub = registry
      .load(
        registry
          .discover()
          .filter((c) => c.protocol === request.protocol && c.method === request.method),
      )
      .find((s) => s.protocol === request.protocol && s.method === request.method);
    if (stub !== undefined && "receiver" in stub.params) {
      params.receiver = request.account;
    }
  }

  const intent: StatedIntent = {
    source: "agent",
    protocol: request.protocol,
    method: request.method,
    // 用補完後的 params：receiver 被補成發送帳戶時，面板顯示的
    // 「agent 說你要求的」也要跟實際送進模擬的一致。
    params: Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    text: request.statedRequest,
  };

  const action = await registry.action(
    request.protocol,
    request.method,
    request.account,
    params,
  );
  if (action.kind !== "capability") {
    // agent 會把 discover 濾掉的 query 方法名直接傳進來（例如「讀餘額」），
    // 錯誤訊息要講清楚這是什麼狀況，語言跟面板一致。
    throw new Error(
      t(request.locale ?? "en", "err_query_no_tx", {
        protocol: request.protocol,
        method: request.method,
      }),
    );
  }

  const outcome = await simulator.simulate(action);

  // 依 Moss 的規定：任何 warning 都終止，且必須阻止簽名
  const warnings: Warning[] = outcome.results.flatMap((r) => r.warnings);
  const changes: Change[] = outcome.results.flatMap((r) => [...(r.changes ?? [])]);
  const receipts = outcome.results.map((r) => r.receipt).filter((r): r is Receipt => Boolean(r));

  // 交給錢包簽的必須是「被模擬的那一筆」本身。直接從模擬結果取，
  // 不從 capability 重新展開，避免中間有任何重建的機會。
  const transactions: UnsignedTx[] = outcome.results.map((r) => r.transaction);
  const fingerprint = fingerprintOf(transactions, MONAD_CHAIN_ID);

  // 單筆交易是常態。多筆（巢狀 Capability）時只有一份 receipt 能對應整包，
  // 對不上就退回原始變動，不猜。
  const receipt = receipts.length === 1 ? (receipts[0] ?? null) : null;

  // 模擬是在被蓋掉餘額的狀態下跑的，所以要另外拿真實餘額對一次。
  const [balance, gasPrice] = await Promise.all([
    runtime.client.getBalance({ address: request.account }),
    runtime.client.getGasPrice(),
  ]);
  const gasUnits =
    gasUnitsFrom(outcome.results) ??
    (await estimateGasWithoutOverrides(runtime.client, transactions));

  const value = transactions.reduce((sum, tx) => sum + BigInt(tx.value), 0n);
  const locale = request.locale ?? "en";
  const affordabilityCheck =
    gasUnits === null
      ? feeUnknownWarning(balance, value, locale)
      : affordabilityWarning(affordability(balance, transactions, gasUnits, gasPrice), locale);
  const multiTx = multiTransactionWarning(transactions, locale);

  const blocking: Warning[] = [
    ...warnings,
    ...(affordabilityCheck ? [affordabilityCheck] : []),
    ...(multiTx ? [multiTx] : []),
  ];

  if (blocking.length > 0 || outcome.halted) {
    const all: Warning[] =
      blocking.length > 0
        ? blocking
        : [{ code: "TRACE_FAILED", message: outcome.halted?.reason ?? t(locale, "trace_failed") }];
    return {
      view: {
        intent,
        // 餘額不夠時模擬本身是成功的，效果照樣顯示出來 ——
        // 使用者需要知道「這筆想做什麼」才判斷得了要不要去補錢。
        // 真的中止時沒有 receipt，這裡自然是 null。
        receipt,
        changes,
        warnings: all,
        verdict: { kind: "blocked", warnings: all },
        signable: false,
        account: request.account,
        locale: request.locale ?? "en",
        accountSource: "agent",
        tokens: await readTokens(changes),
        transactions,
        fingerprint,
      },
      summary: t(locale, "summary_blocked", {
        reasons: all.map((w) => w.message).join("; "),
      }),
    };
  }

  const verdict = structuralVerdict(request, receipt, changes, locale);

  return {
    view: {
      intent,
      receipt,
      changes,
      warnings: [],
      verdict,
      signable: verdict.kind !== "mismatch",
      account: request.account,
      locale: request.locale ?? "en",
      accountSource: "agent",
      tokens: await readTokens(changes),
      transactions,
      fingerprint,
    },
    summary: [
      `Agent says the user asked: ${request.statedRequest}`,
      `Structural check: ${verdict.kind}`,
      receipt ? `Effect: ${receipt.text}` : `No protocol module; ${changes.length} raw changes`,
      `Signable: ${verdict.kind !== "mismatch"}`,
    ].join("\n"),
  };
}
