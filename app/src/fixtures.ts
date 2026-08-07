/**
 * 五個情況的假資料。用來呈現對主網現場產不出來的情況（惡意授權之類），
 * 以及在沒有網路時仍能看面板。
 *
 * **這裡的 data 形狀必須跟 Moss 真實輸出一致。**
 * 2026-07-31 對主網實跑確認的形狀：
 *   { operation: "nativeTransfer", kind, from, to, value }
 *   { operation: "transfer", token, from, to, amount }
 *   { operation: "approve", token, owner, spender, amount }
 *   { operation: "deposit", depositor, receiver, assets, shares }
 *   { operation: "withdraw", owner, receiver, assets, shares }
 *
 * 曾經這裡用自己發明的 { direction, amount } 形狀，結果面板拿真資料跑就整個
 * 退化成開發者文字。fixture 跟現實分岔是真實踩過的坑，不要再開一次。
 *
 * 事件 topics 由 viem 依標準簽章現算，沒有手抄的常數。
 */

import type { AddressValue, JsonSafeValue } from "@themoss/core";
import type { Warning } from "./contract.js";
import { encodeAbiParameters, encodeEventTopics, getAddress, type Hex } from "viem";
import type {
  Change,
  EvidencePanelView,
  Receipt,
  ReceiptChange,
  StatedIntent,
  TokenMap,
  UnsignedTx,
} from "./contract.js";
import { fingerprintOf, MONAD_CHAIN_ID } from "./handoff.js";

// checksum 一律交給 viem 算，不手抄
/** shMONAD 主網地址，取自 @themoss/protocol-shmonad */
const SHMONAD: AddressValue = getAddress("0x1b68626dca36c7fe922fd2d55e4f631d962de19c");
const ACCOUNT: AddressValue = getAddress("0x4e9a3b2c7f5d18e6a0b4c93d2f7185ae6cb0d3f2");
const STRANGER: AddressValue = getAddress("0x9f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b");
const USDC: AddressValue = getAddress("0xf817257fed379853cde0fa4f97ab987181b1e5ea");
const ZERO: AddressValue = getAddress("0x0000000000000000000000000000000000000000");

const TOKENS: TokenMap = {
  [SHMONAD.toLowerCase()]: { symbol: "shMON", decimals: 18 },
  [USDC.toLowerCase()]: { symbol: "USDC", decimals: 6 },
};

const erc20Abi = [
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Approval",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "spender", type: "address", indexed: true },
      { name: "value", type: "uint256", indexed: false },
    ],
  },
] as const;

const approvalForAllAbi = [
  {
    type: "event",
    name: "ApprovalForAll",
    inputs: [
      { name: "owner", type: "address", indexed: true },
      { name: "operator", type: "address", indexed: true },
      { name: "approved", type: "bool", indexed: false },
    ],
  },
] as const;

const erc4626Abi = [
  {
    type: "event",
    name: "Deposit",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "assets", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Withdraw",
    inputs: [
      { name: "sender", type: "address", indexed: true },
      { name: "receiver", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "assets", type: "uint256", indexed: false },
      { name: "shares", type: "uint256", indexed: false },
    ],
  },
] as const;

const uint256 = [{ type: "uint256" }] as const;
const twoUint256 = [{ type: "uint256" }, { type: "uint256" }] as const;
const MAX_UINT256 = (2n ** 256n - 1n).toString();

function topicsOf(...args: Parameters<typeof encodeEventTopics>): Hex[] {
  return encodeEventTopics(...args).filter((t): t is Hex => typeof t === "string");
}

function transferChange(token: AddressValue, from: AddressValue, to: AddressValue, value: bigint): Change {
  return {
    kind: "event",
    address: token,
    topics: topicsOf({ abi: erc20Abi, eventName: "Transfer", args: { from, to } }),
    data: encodeAbiParameters(uint256, [value]),
  };
}

function approvalChange(
  token: AddressValue,
  owner: AddressValue,
  spender: AddressValue,
  value: bigint,
): Change {
  return {
    kind: "event",
    address: token,
    topics: topicsOf({ abi: erc20Abi, eventName: "Approval", args: { owner, spender } }),
    data: encodeAbiParameters(uint256, [value]),
  };
}

function depositChange(sender: AddressValue, owner: AddressValue, assets: bigint, shares: bigint): Change {
  return {
    kind: "event",
    address: SHMONAD,
    topics: topicsOf({ abi: erc4626Abi, eventName: "Deposit", args: { sender, owner } }),
    data: encodeAbiParameters(twoUint256, [assets, shares]),
  };
}

function withdrawChange(
  sender: AddressValue,
  receiver: AddressValue,
  owner: AddressValue,
  assets: bigint,
  shares: bigint,
): Change {
  return {
    kind: "event",
    address: SHMONAD,
    topics: topicsOf({ abi: erc4626Abi, eventName: "Withdraw", args: { sender, receiver, owner } }),
    data: encodeAbiParameters(twoUint256, [assets, shares]),
  };
}

function approvalForAllChange(
  collection: AddressValue,
  owner: AddressValue,
  operator: AddressValue,
  approved: boolean,
): Change {
  return {
    kind: "event",
    address: collection,
    topics: topicsOf({ abi: approvalForAllAbi, eventName: "ApprovalForAll", args: { owner, operator } }),
    data: encodeAbiParameters([{ type: "bool" }], [approved]),
  };
}

function nativeTransfer(from: AddressValue, to: AddressValue, value: string): Change {
  return { kind: "nativeTransfer", from, to, value };
}

/** 葉節點握的是同一個 Change 物件，Moss 的覆蓋檢查靠這個成立 */
function leaf(change: Change, data: Record<string, JsonSafeValue>, text: string): ReceiptChange {
  return { kind: "change", change, data, text };
}

const base = {
  account: ACCOUNT,
  // agent 給的，未經驗證 —— 面板上的「你」全部建立在它上面
  accountSource: "agent" as const,
  // fixture 斷言的是 zh-TW 文案，所以 fixture 統一 zh-TW
  locale: "zh-TW" as const,
  tokens: TOKENS,
  warnings: [] as Warning[],
};

/** 未簽交易 + 對應指紋。真實情況下這兩者來自模擬結果，這裡是備好的。 */
function handoff(transactions: UnsignedTx[]) {
  return { transactions, fingerprint: fingerprintOf(transactions, MONAD_CHAIN_ID) };
}

const stakeTx: UnsignedTx[] = [
  {
    from: ACCOUNT,
    to: SHMONAD,
    data: "0x6e553f65000000000000000000000000000000000000000000000000008ac7230489e800000000000000000000000000004e9a3b2c7f5d18e6a0b4c93d2f7185ae6cb0d3f2",
    value: "0x8ac7230489e80000",
  },
];

const unstakeTx: UnsignedTx[] = [
  {
    from: ACCOUNT,
    to: SHMONAD,
    data: "0xba087652000000000000000000000000000000000000000000000000004563918244f400000000000000000000000000004e9a3b2c7f5d18e6a0b4c93d2f7185ae6cb0d3f2",
    value: "0x0",
  },
];

const approveTx: UnsignedTx[] = [
  {
    from: ACCOUNT,
    to: USDC,
    data: "0x095ea7b30000000000000000000000009f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41bffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
    value: "0x0",
  },
];

// ---------------------------------------------------------------------------
// 一：正常質押，意圖與證據一致
// ---------------------------------------------------------------------------

const stakeIntent: StatedIntent = {
  source: "agent",
  protocol: "shmonad",
  method: "stake",
  params: { amount: "10", receiver: ACCOUNT },
  text: "幫我質押 10 MON",
};

const stakeChanges: readonly Change[] = [
  nativeTransfer(ACCOUNT, SHMONAD, "10000000000000000000"),
  transferChange(SHMONAD, ZERO, ACCOUNT, 9_870_000_000_000_000_000n),
  depositChange(ACCOUNT, ACCOUNT, 10_000_000_000_000_000_000n, 9_870_000_000_000_000_000n),
];

const stakeReceipt: Receipt = {
  kind: "receipt",
  protocol: "shmonad",
  outcome: {
    operation: "stake",
    depositor: ACCOUNT,
    receiver: ACCOUNT,
    assets: "10000000000000000000",
    shares: "9870000000000000000",
  },
  text: "shMONAD Stake: 10000000000000000000 MON → 9870000000000000000 shMON",
  changes: [
    leaf(
      stakeChanges[0] as Change,
      {
        operation: "nativeTransfer",
        kind: "nativeTransfer",
        from: ACCOUNT,
        to: SHMONAD,
        value: "10000000000000000000",
      },
      "Native MON Transfer: 10000000000000000000",
    ),
    leaf(
      stakeChanges[1] as Change,
      {
        operation: "transfer",
        token: SHMONAD,
        from: ZERO,
        to: ACCOUNT,
        amount: "9870000000000000000",
      },
      "ERC20 Transfer: 9870000000000000000",
    ),
    leaf(
      stakeChanges[2] as Change,
      {
        operation: "deposit",
        depositor: ACCOUNT,
        receiver: ACCOUNT,
        assets: "10000000000000000000",
        shares: "9870000000000000000",
      },
      "shMONAD Stake: 10000000000000000000 MON",
    ),
  ],
};

export const stakeMatch: EvidencePanelView = {
  ...base,
  intent: stakeIntent,
  receipt: stakeReceipt,
  changes: stakeChanges,
  verdict: { kind: "match" },
  signable: true,
  ...handoff(stakeTx),
};

// ---------------------------------------------------------------------------
// 二：贖回，金額對得上但錢不會現在回來
// ---------------------------------------------------------------------------

const unstakeIntent: StatedIntent = {
  source: "agent",
  protocol: "shmonad",
  method: "unstake",
  params: { shares: "5", receiver: ACCOUNT, owner: ACCOUNT },
  text: "幫我贖回 5 shMON",
};

const unstakeChanges: readonly Change[] = [
  transferChange(SHMONAD, ACCOUNT, ZERO, 5_000_000_000_000_000_000n),
  withdrawChange(ACCOUNT, ACCOUNT, ACCOUNT, 5_065_000_000_000_000_000n, 5_000_000_000_000_000_000n),
];

const unstakeReceipt: Receipt = {
  kind: "receipt",
  protocol: "shmonad",
  outcome: {
    operation: "unstake",
    owner: ACCOUNT,
    receiver: ACCOUNT,
    assets: "5065000000000000000",
    shares: "5000000000000000000",
  },
  text: "shMONAD Unstake: 5000000000000000000 shMON",
  changes: [
    leaf(
      unstakeChanges[0] as Change,
      {
        operation: "transfer",
        token: SHMONAD,
        from: ACCOUNT,
        to: ZERO,
        amount: "5000000000000000000",
      },
      "ERC20 Transfer: 5000000000000000000",
    ),
    leaf(
      unstakeChanges[1] as Change,
      {
        operation: "withdraw",
        owner: ACCOUNT,
        receiver: ACCOUNT,
        assets: "5065000000000000000",
        shares: "5000000000000000000",
      },
      "shMONAD Unstake: 5065000000000000000 MON",
    ),
  ],
};

export const unstakePartial: EvidencePanelView = {
  ...base,
  intent: unstakeIntent,
  receipt: unstakeReceipt,
  changes: unstakeChanges,
  verdict: {
    kind: "partial",
    reason: "這筆交易不會讓 MON 現在回到你的帳戶，贖回要等協議的解鎖流程走完",
  },
  signable: true,
  ...handoff(unstakeTx),
};

// ---------------------------------------------------------------------------
// 三：說要質押，實際是無上限授權給陌生地址
// ---------------------------------------------------------------------------

const mismatchChanges: readonly Change[] = [approvalChange(USDC, ACCOUNT, STRANGER, 2n ** 256n - 1n)];

const mismatchReceipt: Receipt = {
  kind: "receipt",
  protocol: "erc20",
  outcome: { operation: "approve", token: USDC, owner: ACCOUNT, spender: STRANGER, amount: MAX_UINT256 },
  text: `ERC20 Approval: ${MAX_UINT256}`,
  changes: [
    leaf(
      mismatchChanges[0] as Change,
      { operation: "approve", token: USDC, owner: ACCOUNT, spender: STRANGER, amount: MAX_UINT256 },
      `ERC20 Approval: ${MAX_UINT256}`,
    ),
  ],
};

export const approveMismatch: EvidencePanelView = {
  ...base,
  intent: stakeIntent,
  receipt: mismatchReceipt,
  changes: mismatchChanges,
  verdict: {
    kind: "mismatch",
    // 訊息是給人讀的，地址縮短。跟 pipeline 產出的衝突訊息格式保持一致。
    conflicts: [
      "沒有任何 MON 被質押",
      `多出一筆無上限授權給 ${STRANGER.slice(0, 6)}…${STRANGER.slice(-4)}，它不是這個操作指定的對象`,
    ],
  },
  signable: false,
  ...handoff(approveTx),
};

// ---------------------------------------------------------------------------
// 四：模擬過程出現 warning，一律不能簽
// ---------------------------------------------------------------------------

const revertWarning: Warning = {
  code: "REVERTED",
  message: "execution reverted: ERC4626ExceededMaxRedeem",
};

export const blockedByWarning: EvidencePanelView = {
  ...base,
  intent: unstakeIntent,
  receipt: null,
  changes: [],
  warnings: [revertWarning],
  verdict: { kind: "blocked", warnings: [revertWarning] },
  signable: false,
  ...handoff(unstakeTx),
};

/**
 * 七：說要轉一個 NFT，實際是把整個系列的轉移權交出去。
 *
 * `ApprovalForAll` 的 topic 跟 ERC-20 的 `Approval` 不同，先前只防 ERC-20 那一半，
 * 這種交易會被判成 match、顯示「沒有發現意料外的動作」、可簽名。那是 NFT drainer
 * 最標準的第一步，而且比無上限 ERC-20 授權更狠：沒有金額欄位，交出去的是整個系列，
 * 含使用者以後才拿到的。
 */
const NFT: AddressValue = getAddress("0x5c7d2e19a4f83b016d9a2c74e1f0538bd6a91c3e");

const operatorGrantChanges: readonly Change[] = [
  approvalForAllChange(NFT, ACCOUNT, STRANGER, true),
];

const operatorGrantReceipt: Receipt = {
  kind: "receipt",
  protocol: "erc1155",
  outcome: {
    operation: "approvalForAll",
    collection: NFT,
    account: ACCOUNT,
    operator: STRANGER,
    approved: true,
  },
  text: `ERC1155 ApprovalForAll: ${STRANGER} approved for ${NFT}`,
  changes: [
    leaf(
      operatorGrantChanges[0] as Change,
      {
        operation: "approvalForAll",
        collection: NFT,
        account: ACCOUNT,
        operator: STRANGER,
        approved: true,
      },
      `ERC1155 ApprovalForAll: ${STRANGER} approved for ${NFT}`,
    ),
  ],
};

const nftTransferIntent: StatedIntent = {
  source: "agent",
  protocol: "erc1155",
  method: "transfer",
  params: { collection: NFT, tokenId: "7", amount: "1", to: ACCOUNT },
  text: "把那個 NFT 轉去我另一個錢包",
};

const operatorGrantTx: UnsignedTx[] = [
  {
    from: ACCOUNT,
    to: NFT,
    // setApprovalForAll(address,bool)
    data: "0xa22cb4650000000000000000000000009f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b0000000000000000000000000000000000000000000000000000000000000001",
    value: "0x0",
  },
];

export const operatorApprovalMismatch: EvidencePanelView = {
  ...base,
  intent: nftTransferIntent,
  receipt: operatorGrantReceipt,
  changes: operatorGrantChanges,
  verdict: {
    kind: "mismatch",
    conflicts: [
      `多出一筆整批授權：${STRANGER.slice(0, 6)}…${STRANGER.slice(-4)} 可以轉走你在 ${NFT.slice(0, 6)}…${NFT.slice(-4)} 這個系列裡的每一個，它不是這個操作指定的對象`,
    ],
  },
  signable: false,
  ...handoff(operatorGrantTx),
};

/**
 * 六：模擬跑得出效果，但帳戶付不起。
 *
 * 這是 blocked 的第二種來源，形狀跟第四種不一樣：**receipt 還在**。
 * Moss 的模擬器把發送方餘額蓋成 100 萬 MON 才跑 trace，所以模擬照樣成功；
 * 真實餘額是我們自己另外對的。使用者需要看到「這筆想做什麼」才判斷得了
 * 要不要去補錢，所以效果照顯示，只是不能簽。
 *
 * 這條訊息是全專案最長的一句人話，排版規則（不超過終端機寬度、數字不被切斷）
 * 靠它守著。
 */
const balanceWarning: Warning = {
  code: "INSUFFICIENT_BALANCE",
  message:
    "餘額不夠。你有 ~9.087640 MON，這筆需要 ~10.015862 MON（其中約 ~0.015862 MON 是手續費）," +
    "差 ~0.928222 MON。照這樣送出去會失敗，手續費照樣扣。",
};

export const blockedByBalance: EvidencePanelView = {
  ...base,
  intent: stakeIntent,
  receipt: stakeReceipt,
  changes: stakeChanges,
  warnings: [balanceWarning],
  verdict: { kind: "blocked", warnings: [balanceWarning] },
  signable: false,
  ...handoff(stakeTx),
};

// ---------------------------------------------------------------------------
// 五：從外面貼進來，協議沒有支援模組
// ---------------------------------------------------------------------------

const unknownChanges: readonly Change[] = [
  nativeTransfer(ACCOUNT, STRANGER, "250000000000000000"),
  transferChange(USDC, ACCOUNT, STRANGER, 1_400_000_000n),
];

export const noAdapterModeB: EvidencePanelView = {
  ...base,
  intent: null,
  receipt: null,
  changes: unknownChanges,
  verdict: { kind: "noIntent" },
  signable: true,
  ...handoff([{ from: ACCOUNT, to: USDC, data: "0xa9059cbb", value: "0x0" }]),
};

/** 全部 fixtures，測試逐一驗，預覽頁拿來切換 */
export const allFixtures = {
  stakeMatch,
  unstakePartial,
  approveMismatch,
  blockedByWarning,
  blockedByBalance,
  operatorApprovalMismatch,
  noAdapterModeB,
} satisfies Record<string, EvidencePanelView>;

export type FixtureName = keyof typeof allFixtures;
