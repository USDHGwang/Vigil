/**
 * 結構比對的離線測試 + 整條管線對 Monad 主網的實跑。
 *
 * live 測試用 MOSS_SKIP_E2E=1 跳過（跟 Moss 的慣例一致）。
 * 模擬不簽名不送出，對主網跑不花錢。
 */

import type { AddressValue, Change, Receipt } from "@themoss/core";
import { encodeAbiParameters, encodeEventTopics, getAddress, parseAbi } from "viem";
import { describe, expect, it } from "vitest";
import { assertViewInvariants, type UnsignedTx } from "../src/contract.js";
import {
  affordability,
  affordabilityWarning,
  findApprovals,
  findOperatorApprovals,
  feeUnknownWarning,
  gasUnitsFrom,
  multiTransactionWarning,
  previewTransaction,
  type SimulateRequest,
  structuralVerdict,
} from "../src/pipeline.js";

const ACCOUNT = getAddress("0xcccccccccccccccccccccccccccccccccccccccc");
const STRANGER = getAddress("0x9f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b");
const TOKEN = getAddress("0xf817257fed379853cde0fa4f97ab987181b1e5ea");
/** 使用者指名的正當對象（例如市場合約），用來跟 STRANGER 區分 */
const MARKET = getAddress("0x1b68626dca36c7fe922fd2d55e4f631d962de19c");
const ZERO = getAddress("0x0000000000000000000000000000000000000000");

const NFT = getAddress("0x5c7d2e19a4f83b016d9a2c74e1f0538bd6a91c3e");

const ERC20 = parseAbi([
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

/** ERC-721 單顆授權：跟 ERC-20 Approval 同 topic0，但三個參數全 indexed */
const ERC721 = parseAbi([
  "event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId)",
]);

/** ERC-721 與 ERC-1155 共用這個簽章 */
const NFT_ABI = parseAbi([
  "event ApprovalForAll(address indexed owner, address indexed operator, bool approved)",
]);

/**
 * encodeEventTopics 的回傳型別含 null 與陣列（未指定的 indexed 參數）。
 * 這裡每個 indexed 參數都給了值，所以實際不會有 null，用型別守衛收窄而不是 cast。
 */
function topicsOf(...args: Parameters<typeof encodeEventTopics>): `0x${string}`[] {
  return encodeEventTopics(...args).filter((t): t is `0x${string}` => typeof t === "string");
}

function approval(owner: AddressValue, spender: AddressValue, value: bigint): Change {
  return {
    kind: "event",
    address: TOKEN,
    topics: topicsOf({ abi: ERC20, eventName: "Approval", args: { owner, spender } }),
    data: encodeAbiParameters([{ type: "uint256" }], [value]),
  };
}

function erc721Approval(owner: AddressValue, approved: AddressValue, tokenId: bigint): Change {
  return {
    kind: "event",
    address: NFT,
    topics: topicsOf({ abi: ERC721, eventName: "Approval", args: { owner, approved, tokenId } }),
    data: "0x",
  };
}

function approvalForAll(owner: AddressValue, operator: AddressValue, approved: boolean): Change {
  return {
    kind: "event",
    address: NFT,
    topics: topicsOf({ abi: NFT_ABI, eventName: "ApprovalForAll", args: { owner, operator } }),
    data: encodeAbiParameters([{ type: "bool" }], [approved]),
  };
}

function transfer(from: AddressValue, to: AddressValue, value: bigint): Change {
  return {
    kind: "event",
    address: TOKEN,
    topics: topicsOf({ abi: ERC20, eventName: "Transfer", args: { from, to } }),
    data: encodeAbiParameters([{ type: "uint256" }], [value]),
  };
}

const stakeRequest: SimulateRequest = {
  account: ACCOUNT,
  protocol: "shmonad",
  method: "stake",
  params: { amount: "0.25", receiver: ACCOUNT },
  statedRequest: "幫我質押 0.25 MON",
};

function receiptWith(operation: string): Receipt {
  return {
    kind: "receipt",
    protocol: "shmonad",
    outcome: { operation },
    text: "t",
    changes: [],
  };
}

describe("findApprovals", () => {
  it("認得無上限授權", () => {
    const found = findApprovals([approval(ACCOUNT, STRANGER, 2n ** 256n - 1n)]);
    expect(found).toHaveLength(1);
    expect(found[0]?.unlimited).toBe(true);
    expect(found[0]?.spender.toLowerCase()).toBe(STRANGER.toLowerCase());
  });

  it("有限額度不算無上限", () => {
    const found = findApprovals([approval(ACCOUNT, STRANGER, 1000n)]);
    expect(found[0]?.unlimited).toBe(false);
  });

  /**
   * 門檻原本是 2^255，只認得 type(uint256).max 那一種寫法。實務上無上限授權
   * 常寫成 Permit2 的 type(uint160).max 或 type(uint96).max，兩個都遠小於
   * 2^255，於是規則對它們完全失明——回 match、可簽名。
   */
  it("認得 Permit2 的 uint160.max", () => {
    const found = findApprovals([approval(ACCOUNT, STRANGER, 2n ** 160n - 1n)]);
    expect(found[0]?.unlimited).toBe(true);
  });

  it("認得 uint96.max", () => {
    const found = findApprovals([approval(ACCOUNT, STRANGER, 2n ** 96n - 1n)]);
    expect(found[0]?.unlimited).toBe(true);
  });

  it("認得 uint128.max", () => {
    const found = findApprovals([approval(ACCOUNT, STRANGER, 2n ** 128n - 1n)]);
    expect(found[0]?.unlimited).toBe(true);
  });

  // 一般大額授權還是要能通過，不然規則等於見大就報
  it("門檻底下的大額授權不算無上限", () => {
    // 100 萬顆 18 位小數的代幣
    const found = findApprovals([approval(ACCOUNT, STRANGER, 10n ** 24n)]);
    expect(found[0]?.unlimited).toBe(false);
  });

  it("Transfer 不會被誤認成授權", () => {
    expect(findApprovals([transfer(ACCOUNT, STRANGER, 1n)])).toHaveLength(0);
  });

  it("原生轉帳不會被誤認成授權", () => {
    const native: Change = { kind: "nativeTransfer", from: ACCOUNT, to: STRANGER, value: "1" };
    expect(findApprovals([native])).toHaveLength(0);
  });

  // ERC-721 的 Approval 跟 ERC-20 topic0 相同、layout 不同（4 個 topic、data 空）。
  // 先前兩個 finder 都解不開它，一筆交出單顆 NFT 轉移權的授權完全隱形。
  it("認得 ERC-721 的單顆授權（同 topic0、4 個 topic）", () => {
    const found = findApprovals([erc721Approval(ACCOUNT, STRANGER, 7n)]);
    expect(found).toHaveLength(1);
    expect(found[0]?.kind).toBe("erc721");
    expect(found[0]?.spender.toLowerCase()).toBe(STRANGER.toLowerCase());
    expect(found[0]?.value).toBe(7n);
    expect(found[0]?.unlimited).toBe(false);
  });

  it("ERC-721 授權給零地址是撤銷，不當威脅", () => {
    expect(findApprovals([erc721Approval(ACCOUNT, ZERO, 7n)])).toHaveLength(0);
  });
});

describe("structuralVerdict", () => {
  it("乾淨的質押算一致", () => {
    const verdict = structuralVerdict(stakeRequest, receiptWith("stake"), [], "zh-TW");
    expect(verdict.kind).toBe("match");
  });

  it("冒出使用者沒要求的無上限授權算不一致", () => {
    const verdict = structuralVerdict(stakeRequest, receiptWith("stake"), [
      approval(ACCOUNT, STRANGER, 2n ** 256n - 1n),
    ], "zh-TW");
    expect(verdict.kind).toBe("mismatch");
    if (verdict.kind !== "mismatch") throw new Error("unreachable");
    expect(verdict.conflicts[0]).toContain("無上限授權");
  });

  /**
   * 對象在參數裡就不算「多出來」——那是 rule 1 的判斷，維持不變。
   *
   * 但它也不能是 match。參數是 agent 給的，被注入的 agent 只要把攻擊者填進
   * spender、額度壓在無上限門檻以下，rule 1 與 rule 4 就都不觸發。機器在這裡
   * 驗到的只有「交易對得上呼叫的操作」，撐不起一個綠勾。
   */
  it("授權對象在意圖裡出現過 → 不是 conflict，但也不是 match", () => {
    const request: SimulateRequest = {
      ...stakeRequest,
      params: { amount: "0.25", receiver: ACCOUNT, spender: STRANGER },
    };
    const verdict = structuralVerdict(request, receiptWith("stake"), [
      approval(ACCOUNT, STRANGER, 1000n),
    ], "zh-TW");
    expect(verdict.kind).toBe("partial");
    if (verdict.kind !== "partial") throw new Error("unreachable");
    expect(verdict.reason).toContain("agent");
  });

  it("額度壓在無上限門檻以下也一樣，不會因為數字沒到門檻就變成綠勾", () => {
    const request: SimulateRequest = {
      ...stakeRequest,
      params: { amount: "0.25", receiver: ACCOUNT, spender: STRANGER },
    };
    const verdict = structuralVerdict(request, receiptWith("stake"), [
      approval(ACCOUNT, STRANGER, 2n ** 96n - 2n),
    ], "zh-TW");
    expect(verdict.kind).toBe("partial");
  });

  it("授權給自己是 no-op，不用打斷使用者", () => {
    const request: SimulateRequest = {
      ...stakeRequest,
      params: { amount: "0.25", receiver: ACCOUNT, spender: ACCOUNT },
    };
    const verdict = structuralVerdict(request, receiptWith("stake"), [
      approval(ACCOUNT, ACCOUNT, 1000n),
    ], "zh-TW");
    expect(verdict.kind).toBe("match");
  });

  it("實際 operation 對不上呼叫的 method 算不一致", () => {
    const verdict = structuralVerdict(stakeRequest, receiptWith("unstake"), [], "zh-TW");
    expect(verdict.kind).toBe("mismatch");
  });

  it("沒有解讀模組時回報 partial 而不是假裝一致", () => {
    const verdict = structuralVerdict(stakeRequest, null, [], "zh-TW");
    expect(verdict.kind).toBe("partial");
  });

  // prompt injection 的核心：agent 宣告一件事、呼叫另一件事。
  // 結構層看到的是「呼叫 approve、交易真的 approve」，那是相符的，
  // 所以不能靠結構層抓。能抓的是「無上限授權本身就值得停一下」。
  it("明白呼叫的無上限授權也要人確認，不能當成沒事", () => {
    const request: SimulateRequest = {
      account: ACCOUNT,
      protocol: "erc20",
      method: "approve",
      params: { token: TOKEN, spender: STRANGER, amount: (2n ** 256n - 1n).toString() },
      statedRequest: "幫我查一下餘額",
    };
    const verdict = structuralVerdict(request, receiptWith("approve"), [
      approval(ACCOUNT, STRANGER, 2n ** 256n - 1n),
    ], "zh-TW");
    expect(verdict.kind).toBe("partial");
    if (verdict.kind !== "partial") throw new Error("unreachable");
    expect(verdict.reason).toContain("無上限");
  });

  it("有上限的授權不會被誤報成需要確認", () => {
    const request: SimulateRequest = {
      account: ACCOUNT,
      protocol: "erc20",
      method: "approve",
      params: { token: TOKEN, spender: STRANGER, amount: "1000" },
      statedRequest: "授權 1000 個給它",
    };
    const verdict = structuralVerdict(request, receiptWith("approve"), [
      approval(ACCOUNT, STRANGER, 1000n),
    ], "zh-TW");
    expect(verdict.kind).toBe("match");
  });

  // 先前 method 含 approve/permit/allow 就整段跳過 rule 1，「有上限、但給錯人」
  // 的授權在 approve 類操作裡隱形，回 match、可簽名。
  it("method 是 approve 也擋得住給錯人的授權：對象不在意圖裡就算不一致", () => {
    const request: SimulateRequest = {
      account: ACCOUNT,
      protocol: "erc20",
      method: "approve",
      params: { token: TOKEN, spender: MARKET, amount: "1000" },
      statedRequest: "授權 1000 個給那個市場",
    };
    // 使用者指名 MARKET，鏈上卻是授權給 STRANGER，而且有上限（rule 4 管不到）
    const verdict = structuralVerdict(request, receiptWith("approve"), [
      approval(ACCOUNT, STRANGER, 1000n),
    ], "zh-TW");
    expect(verdict.kind).toBe("mismatch");
    if (verdict.kind !== "mismatch") throw new Error("型別收窄");
    expect(verdict.conflicts[0]).toContain("不是這個操作指定的對象");
  });

  // ERC-721 單顆授權先前對兩條規則完全隱形，verdict 是 match、可簽名。
  it("冒出使用者沒要求的 ERC-721 單顆授權算不一致", () => {
    const verdict = structuralVerdict(stakeRequest, receiptWith("stake"), [
      erc721Approval(ACCOUNT, STRANGER, 7n),
    ], "zh-TW");
    expect(verdict.kind).toBe("mismatch");
    if (verdict.kind !== "mismatch") throw new Error("型別收窄");
    expect(verdict.conflicts[0]).toContain("NFT 授權");
    expect(verdict.conflicts[0]).toContain("編號 7");
  });
});

/**
 * 簽名頁一次只送得出第一筆，而指紋與證據涵蓋整包。多筆可簽名的話，
 * 使用者以為簽的是整個操作（swap），實際上鏈的只有第一筆（approve）。
 */
describe("多筆交易", () => {
  const tx = (value: `0x${string}`): UnsignedTx => ({
    from: ACCOUNT,
    to: STRANGER,
    data: "0x",
    value,
  });

  it("單筆不需要警告", () => {
    expect(multiTransactionWarning([tx("0x0")], "zh-TW")).toBeNull();
  });

  it("多筆要擋，理由講真話：講筆數、講只送得出第一筆", () => {
    const warning = multiTransactionWarning([tx("0x0"), tx("0x1")], "zh-TW");
    expect(warning?.code).toBe("MULTI_TX_UNSUPPORTED");
    expect(warning?.message).toContain("2 筆");
    expect(warning?.message).toContain("第一筆");
    expect(warning?.message).toContain("不開放簽名");
  });
});

/**
 * `ApprovalForAll` 的 topic 跟 ERC-20 的 `Approval` 不同。先前只防 ERC-20 那一半，
 * 一筆 setApprovalForAll 會被判成 match、顯示「沒有發現意料外的動作」、可簽名。
 * 那是 NFT drainer 最標準的第一步。
 */
describe("整批授權（setApprovalForAll）", () => {
  const nftIntent: SimulateRequest = {
    account: ACCOUNT,
    protocol: "erc1155",
    method: "transfer",
    params: { collection: NFT, tokenId: "7", amount: "1", to: ACCOUNT },
    statedRequest: "把那個 NFT 轉去我另一個錢包",
  };

  it("抓得到整批授權", () => {
    const found = findOperatorApprovals([approvalForAll(ACCOUNT, STRANGER, true)]);
    expect(found).toHaveLength(1);
    expect(found[0]?.operator.toLowerCase()).toBe(STRANGER.toLowerCase());
    expect(found[0]?.collection.toLowerCase()).toBe(NFT.toLowerCase());
    expect(found[0]?.approved).toBe(true);
  });

  it("ERC-20 的 Approval 不會被誤認成整批授權", () => {
    expect(findOperatorApprovals([approval(ACCOUNT, STRANGER, 2n ** 256n - 1n)])).toHaveLength(0);
  });

  it("整批授權也不會被 findApprovals 誤認成 ERC-20 額度", () => {
    expect(findApprovals([approvalForAll(ACCOUNT, STRANGER, true)])).toHaveLength(0);
  });

  it("說要轉一個 NFT 卻交出整個系列，算不一致", () => {
    const verdict = structuralVerdict(nftIntent, null, [approvalForAll(ACCOUNT, STRANGER, true)], "zh-TW");
    expect(verdict.kind).toBe("mismatch");
    if (verdict.kind !== "mismatch") throw new Error("型別收窄");
    expect(verdict.conflicts[0]).toContain("整批授權");
    expect(verdict.conflicts[0]).toContain("每一個");
  });

  it("撤銷不是威脅，不該被警告", () => {
    // approved: false 是把權限收回來
    const verdict = structuralVerdict(nftIntent, receiptWith("transfer"), [
      approvalForAll(ACCOUNT, STRANGER, false),
    ], "zh-TW");
    expect(verdict.kind).toBe("match");
  });

  // receipt 用真實形狀：Moss 的 erc1155.approve 產出的 operation 是
  // "approvalForAll" 不是 "approve"（vendor/moss/packages/erc/src/erc1155.ts）。
  // 之前這裡手捏 receiptWith("approve")，測的是一個 registry 產不出來的世界，
  // 而真實形狀會被 rule 2 的字串相等判恆 mismatch，rule 3 永遠輪不到。
  it("明白呼叫的整批授權也要人確認，不能當成沒事（receipt 用真實 operation）", () => {
    const asked: SimulateRequest = {
      account: ACCOUNT,
      protocol: "erc1155",
      method: "approve",
      params: { collection: NFT, operator: STRANGER, approved: "true" },
      statedRequest: "授權那個市場幫我掛單",
    };
    const verdict = structuralVerdict(asked, receiptWith("approvalForAll"), [
      approvalForAll(ACCOUNT, STRANGER, true),
    ], "zh-TW");
    expect(verdict.kind).toBe("partial");
    if (verdict.kind !== "partial") throw new Error("型別收窄");
    // 要講清楚範圍：整個系列、含以後才拿到的
    expect(verdict.reason).toContain("每一個");
    expect(verdict.reason).toContain("以後才拿到");
  });

  it("operation 是同義表以外的值，照樣算對不上", () => {
    const asked: SimulateRequest = {
      account: ACCOUNT,
      protocol: "erc1155",
      method: "approve",
      params: { collection: NFT, operator: STRANGER, approved: "true" },
      statedRequest: "授權那個市場幫我掛單",
    };
    const verdict = structuralVerdict(asked, receiptWith("transfer"), [], "zh-TW");
    expect(verdict.kind).toBe("mismatch");
  });

  it("整批授權比無上限 ERC-20 授權更該先講，兩個都在時報前者", () => {
    const verdict = structuralVerdict(
      { ...nftIntent, method: "approve", params: { operator: STRANGER, spender: STRANGER } },
      receiptWith("approvalForAll"),
      [approvalForAll(ACCOUNT, STRANGER, true), approval(ACCOUNT, STRANGER, 2n ** 256n - 1n)],
      "zh-TW",
    );
    expect(verdict.kind).toBe("partial");
    if (verdict.kind !== "partial") throw new Error("型別收窄");
    expect(verdict.reason).toContain("系列");
  });
});

/**
 * Moss 的模擬器會把發送方餘額蓋成 100 萬 MON 才跑 trace，所以模擬永遠成功。
 * 我們宣稱的是「簽名前看到實際會發生什麼」，付不出來的交易實際會 revert，
 * 所以真實餘額要另外對。這一組守住那個算術。
 */
describe("餘額夠不夠", () => {
  const tx = (value: `0x${string}`): UnsignedTx => ({
    from: ACCOUNT,
    to: STRANGER,
    data: "0x",
    value,
  });
  const ONE = 10n ** 18n;

  it("餘額剛好等於本金加手續費，算付得起", () => {
    const a = affordability(ONE + 21_000n * 100n, [tx("0xde0b6b3a7640000")], 21_000n, 100n);
    expect(a.short).toBe(0n);
    expect(affordabilityWarning(a, "zh-TW")).toBeNull();
  });

  it("手續費差一 wei 就算付不起，不四捨五入放行", () => {
    const a = affordability(ONE + 21_000n * 100n - 1n, [tx("0xde0b6b3a7640000")], 21_000n, 100n);
    expect(a.short).toBe(1n);
    expect(affordabilityWarning(a, "zh-TW")?.code).toBe("INSUFFICIENT_BALANCE");
  });

  it("手續費要算進去：本金付得起但加了手續費就不夠", () => {
    const a = affordability(ONE, [tx("0xde0b6b3a7640000")], 21_000n, 100n);
    expect(a.value).toBe(ONE);
    expect(a.fee).toBe(2_100_000n);
    expect(a.short).toBe(2_100_000n);
  });

  it("多筆交易的金額要加總，不能只看第一筆", () => {
    const a = affordability(ONE, [tx("0xde0b6b3a7640000"), tx("0xde0b6b3a7640000")], 0n, 0n);
    expect(a.needed).toBe(2n * ONE);
    expect(a.short).toBe(ONE);
  });

  it("訊息講 MON 不講 wei，而且說得出差多少", () => {
    const message = affordabilityWarning(affordability(0n, [tx("0xde0b6b3a7640000")], 0n, 0n), "zh-TW")
      ?.message;
    expect(message).toContain("1 MON");
    expect(message).not.toMatch(/\d{15,}/);
    expect(message).toContain("差");
  });
});

/**
 * Moss 的 gas 估算走非標準的 `eth_estimateGas` 三參數形式，任何失敗都吞掉並
 * 寫 `gas: null`。原本 `BigInt(r.gas ?? 0)` 把 null 當 0，手續費靜默變成 0，
 * 餘額檢查退化成只比本金——而這個檢查存在的理由就是攔下「付不出手續費會
 * revert、手續費照扣」的交易。而且沒有任何訊號會說 fee 被當成 0。
 */
describe("gas 估不到的時候", () => {
  it("每一筆都有就加總", () => {
    expect(gasUnitsFrom([{ gas: "21000" }, { gas: "50000" }])).toBe(71_000n);
  });

  it("沒有任何一筆時是 0 不是 null", () => {
    expect(gasUnitsFrom([])).toBe(0n);
  });

  // 這是 M-1 的核心：null 不能當 0
  it("任何一筆是 null 就回 null，不當 0", () => {
    expect(gasUnitsFrom([{ gas: "21000" }, { gas: null }])).toBeNull();
    expect(gasUnitsFrom([{ gas: null }])).toBeNull();
  });

  it("解不成數字的值也回 null", () => {
    expect(gasUnitsFrom([{ gas: "not-a-number" }])).toBeNull();
  });

  it("估不到時的警告講清楚是檢查沒做完，不是交易有問題", () => {
    const warning = feeUnknownWarning(10n ** 18n, 10n ** 17n, "zh-TW");
    expect(warning.code).toBe("FEE_ESTIMATE_UNAVAILABLE");
    expect(warning.message).toContain("估不出來");
    expect(warning.message).toContain("檢查沒做完");
    // 已知的部分還是要講，而且照全專案的顯示規則
    expect(warning.message).toContain("0.1 MON");
    expect(warning.message).toContain("1 MON");
    expect(warning.message).not.toMatch(/\d{15,}/);
  });
});

describe.skipIf(!!process.env.MOSS_SKIP_E2E)("對 Monad 主網實跑", () => {
  it(
    "質押 0.25 MON：模擬跑得出效果，但這個帳戶付不起，所以擋下來",
    { timeout: 180_000 },
    async () => {
      const result = await previewTransaction(stakeRequest);

      // 模擬本身是成功的：效果算得出來，使用者才判斷得了值不值得去補錢
      expect(result.view.receipt).not.toBeNull();
      expect(result.view.changes.length).toBeGreaterThan(0);

      // 但真實餘額不夠，所以不可簽名
      expect(result.view.warnings.map((w) => w.code)).toContain("INSUFFICIENT_BALANCE");
      expect(result.view.verdict.kind).toBe("blocked");
      expect(result.view.signable).toBe(false);

      // 面板契約的不變式必須成立，含 Moss 的覆蓋檢查
      expect(() => assertViewInvariants(result.view)).not.toThrow();

      // 使用者原話要原樣帶到 view 上
      expect(result.view.intent?.text).toBe(stakeRequest.statedRequest);
    },
  );

  // 有錢的帳戶才驗得了 match。設 DEMO_ACCOUNT 指到一個真的有 MON 的地址再跑。
  it.skipIf(!process.env.DEMO_ACCOUNT)(
    "有餘額的帳戶質押小額：結構比對一致且可簽名",
    { timeout: 180_000 },
    async () => {
      const funded = getAddress(process.env.DEMO_ACCOUNT ?? ACCOUNT);
      const result = await previewTransaction({
        account: funded,
        protocol: "shmonad",
        method: "stake",
        params: { amount: "0.25", receiver: funded },
        statedRequest: "幫我質押 0.25 MON",
      });

      expect(result.view.warnings).toEqual([]);
      expect(result.view.verdict.kind).toBe("match");
      expect(result.view.signable).toBe(true);
      expect(() => assertViewInvariants(result.view)).not.toThrow();
    },
  );

  it(
    "贖回沒有 shMON 的帳戶：模擬失敗，回報 blocked 且不可簽名",
    { timeout: 180_000 },
    async () => {
      const result = await previewTransaction({
        account: ACCOUNT,
        protocol: "shmonad",
        method: "unstake",
        params: { shares: "1", receiver: ACCOUNT, owner: ACCOUNT },
        statedRequest: "幫我贖回 1 shMON",
      });

      expect(result.view.verdict.kind).toBe("blocked");
      expect(result.view.signable).toBe(false);
      expect(result.view.warnings.length).toBeGreaterThan(0);
      expect(() => assertViewInvariants(result.view)).not.toThrow();
    },
  );
});
