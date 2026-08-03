/**
 * 人話轉換層。
 *
 * 這個檔案存在的原因是 2026-08-01 凌晨實際用面板時發現的問題：
 * 拿手寫的漂亮 fixture 驗收全綠，接上真實主網資料就整個退化成開發者文字，
 * 金額是 wei（250000000000000000）、地址是完整 42 字元。
 *
 * 所以這裡的測試全部用 Moss 真實輸出的 data 形狀，不用自己發明的形狀。
 */

import { describe, expect, it } from "vitest";
import type { Change, TokenMap } from "../src/contract.js";
import { formatAmount, humanize, shortAddress, shortenAddressesIn } from "../src/panel/humanize.js";

const ME = "0xcccccccccccccccccccccccccccccccccccccccc";
const SHMONAD = "0x1b68626dca36c7fe922fd2d55e4f631d962de19c";
const STRANGER = "0x9f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b";
const USDC = "0xf817257fed379853cde0fa4f97ab987181b1e5ea";
const ZERO = "0x0000000000000000000000000000000000000000";

const TOKENS: TokenMap = {
  [SHMONAD]: { symbol: "shMON", decimals: 18 },
  [USDC]: { symbol: "USDC", decimals: 6 },
};

const anyEvent: Change = { kind: "event", address: SHMONAD, topics: ["0x00"], data: "0x" };
const anyNative: Change = { kind: "nativeTransfer", from: ME, to: SHMONAD, value: "1" };

const h = (data: unknown, change: Change = anyEvent, fallback = "FALLBACK") =>
  humanize(data, change, ME, TOKENS, fallback);

describe("formatAmount", () => {
  it("wei 轉成人看的數字", () => {
    expect(formatAmount("250000000000000000", 18)).toBe("0.25");
    expect(formatAmount("1000000000000000000", 18)).toBe("1");
    expect(formatAmount("1400000000", 6)).toBe("1400");
  });

  it("小數尾端的零去掉", () => {
    expect(formatAmount("1500000000000000000", 18)).toBe("1.5");
  });

  it("超過六位小數截斷並標記，不假裝是精確值", () => {
    const out = formatAmount("156494950863022477", 18);
    expect(out.startsWith("~")).toBe(true);
    expect(out).toBe("~0.156494");
  });

  it("解不開的值原樣回傳，不丟例外", () => {
    expect(formatAmount("not-a-number", 18)).toBe("not-a-number");
  });
});

describe("地址縮寫", () => {
  it("縮成頭尾", () => {
    expect(shortAddress(STRANGER)).toBe("0x9f2c…a41b");
  });

  it("退回原文時把裡面的地址一起縮短", () => {
    const text = `Native MON Transfer: 100 from ${ME} to ${SHMONAD}`;
    const out = shortenAddressesIn(text);
    expect(out).not.toContain(ME);
    expect(out).toContain("0xcccc…cccc");
  });
});

describe("原生轉帳", () => {
  const data = (from: string, to: string, value: string) => ({
    operation: "nativeTransfer",
    kind: "nativeTransfer",
    from,
    to,
    value,
  });

  it("從我出去是支出", () => {
    const out = h(data(ME, SHMONAD, "250000000000000000"), anyNative);
    expect(out.direction).toBe("out");
    expect(out.text).toBe("你支出 0.25 MON");
  });

  it("進到我這裡是收到", () => {
    const out = h(data(SHMONAD, ME, "1000000000000000000"), anyNative);
    expect(out.direction).toBe("in");
    expect(out.text).toBe("你收到 1 MON");
  });

  it("與我無關的轉帳兩邊地址都縮短", () => {
    const out = h(data(STRANGER, SHMONAD, "1000000000000000000"), anyNative);
    expect(out.direction).toBe("");
    expect(out.text).not.toMatch(/0x[0-9a-fA-F]{40}/);
  });
});

describe("ERC20 轉帳", () => {
  it("鑄給我的說明是新鑄出的", () => {
    const out = h({
      operation: "transfer",
      token: SHMONAD,
      from: ZERO,
      to: ME,
      amount: "156494950863022477",
    });
    expect(out.direction).toBe("in");
    expect(out.text).toContain("shMON");
    expect(out.text).toContain("新鑄出的");
  });

  it("從我這裡銷毀的說明是被銷毀", () => {
    const out = h({
      operation: "transfer",
      token: SHMONAD,
      from: ME,
      to: ZERO,
      amount: "5000000000000000000",
    });
    expect(out.direction).toBe("out");
    expect(out.text).toBe("你的 5 shMON 被銷毀");
  });

  // 原本這裡只要求「不編一個符號出來」，金額則以 decimals=0 原樣印。
  // 那對 42 這種小數字看不出問題，對 250000000000000000 就是個錯數字。
  // 現在的要求是連數量都不准假裝換算得出來，細節見下方「查不到代幣資訊時」。
  it("查不到的代幣不編單位出來，也不假裝換算得出數量", () => {
    const out = h({
      operation: "transfer",
      token: "0x1111111111111111111111111111111111111111",
      from: ZERO,
      to: ME,
      amount: "42",
    });
    expect(out.text).toContain("個最小單位");
    expect(out.text).toContain("換算不了");
    expect(out.text).not.toContain("MON");
  });
});

describe("整批授權", () => {
  const NFT = "0x5c7d2e19a4f83b016d9a2c74e1f0538bd6a91c3e";
  const grant = (approved: boolean) =>
    humanize(
      { operation: "approvalForAll", collection: NFT, account: ME, operator: STRANGER, approved },
      { kind: "event", address: NFT, topics: ["0x00"], data: "0x" },
      ME,
      TOKENS,
      `ERC1155 ApprovalForAll: ${STRANGER} approved for ${NFT}`,
    );

  it("講清楚範圍是整個系列，不是某一個", () => {
    const { direction, text } = grant(true);
    expect(direction).toBe("approval");
    expect(text).toContain("每一個");
  });

  it("講清楚含以後才拿到的，這是這種授權最容易被忽略的地方", () => {
    expect(grant(true).text).toContain("以後才拿到");
  });

  it("撤銷要讀得出來是收回不是給出", () => {
    const { text } = grant(false);
    expect(text).toContain("收回");
    expect(text).not.toContain("每一個");
  });

  it("不會退回 Moss 給 agent 看的原文", () => {
    expect(grant(true).text).not.toContain("ApprovalForAll");
  });

  it("地址縮短，不出現完整 42 字元", () => {
    expect(grant(true).text).not.toMatch(/0x[0-9a-fA-F]{40}/);
  });
});

describe("授權", () => {
  it("無上限授權講清楚沒有上限", () => {
    const out = h({
      operation: "approve",
      token: USDC,
      owner: ME,
      spender: STRANGER,
      amount: (2n ** 256n - 1n).toString(),
    });
    expect(out.direction).toBe("approval");
    expect(out.text).toContain("沒有上限");
    expect(out.text).toContain("USDC");
    expect(out.text).not.toMatch(/0x[0-9a-fA-F]{40}/);
  });

  it("有限額度顯示實際數字", () => {
    const out = h({
      operation: "approve",
      token: USDC,
      owner: ME,
      spender: STRANGER,
      amount: "1400000000",
    });
    expect(out.text).toContain("1400 USDC");
    expect(out.text).not.toContain("沒有上限");
  });
});

describe("協議記帳事件", () => {
  it("deposit 不標成流入，避免跟前面的轉帳重複計算", () => {
    const out = h({
      operation: "deposit",
      depositor: ME,
      receiver: ME,
      assets: "250000000000000000",
      shares: "156494950863022477",
    });
    expect(out.direction).toBe("");
    expect(out.text).toContain("協議記錄");
  });

  it("withdraw 標成待處理並說明款項不在這筆交易到帳", () => {
    const out = h({
      operation: "withdraw",
      owner: ME,
      receiver: ME,
      assets: "5065000000000000000",
      shares: "5000000000000000000",
    });
    expect(out.direction).toBe("pending");
    expect(out.text).toContain("不在這筆交易裡到帳");
  });
});

describe("認不得的形狀", () => {
  it("退回原文，但地址縮短", () => {
    const out = h({ operation: "somethingNew", foo: 1 }, anyEvent, `x ${STRANGER} y`);
    expect(out.direction).toBe("");
    expect(out.text).not.toContain(STRANGER);
    expect(out.text).toContain("0x9f2c…a41b");
  });

  it("data 不是物件時也不丟例外", () => {
    expect(h(null).text).toBe("FALLBACK");
    expect(h("string").text).toBe("FALLBACK");
    expect(h([1, 2]).text).toBe("FALLBACK");
  });
});

describe("回歸：真實主網資料不能出現 wei 或完整地址", () => {
  // 這三筆是 2026-07-31 對主網跑 shmonad.stake 實際拿到的 data
  const realLeaves = [
    {
      operation: "nativeTransfer",
      kind: "nativeTransfer",
      from: "0xcccccccccccccccccccccccccccccccccccccccc",
      to: "0x1b68626dca36c7fe922fd2d55e4f631d962de19c",
      value: "250000000000000000",
    },
    {
      operation: "transfer",
      token: "0x1b68626dca36c7fe922fd2d55e4f631d962de19c",
      from: "0x0000000000000000000000000000000000000000",
      to: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
      amount: "156494950863022477",
    },
    {
      operation: "deposit",
      depositor: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
      receiver: "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC",
      assets: "250000000000000000",
      shares: "156494950863022477",
    },
  ];

  it.each(realLeaves.map((d, i) => [i, d] as const))("第 %i 筆讀得懂", (_i, data) => {
    const out = h(data);
    expect(out.text).not.toMatch(/0x[0-9a-fA-F]{40}/);
    expect(out.text).not.toMatch(/\d{15,}/);
    expect(out.text.length).toBeGreaterThan(4);
  });
});

/**
 * 代幣的 symbol / decimals 查不到時的行為。
 *
 * `readTokens` 靠 RPC 逐一問 `symbol()` / `decimals()`，任何一次失敗（限流、
 * 非標準代幣、代理合約）就查不到。原本 decimals 退回 0，等於把
 * 250000000000000000 原封不動印上畫面 —— 讀的人會以為是 2.5 億個代幣，
 * 實際上是 0.25 個。既撞到「不准出現未格式化長整數」那條規則，也是個
 * 看起來不像錯的錯數字。
 *
 * 這一組原本一條測試都沒有，所以那條回歸線在真實 RPC 失敗時是漏的。
 */
describe("查不到代幣資訊時", () => {
  const UNKNOWN = "0xdeadbeef00000000000000000000000000001234";
  const unknownEvent: Change = { kind: "event", address: UNKNOWN, topics: ["0x00"], data: "0x" };

  it("不印原始整數，明講換算不了", () => {
    const out = h({
      operation: "transfer",
      token: UNKNOWN,
      from: STRANGER,
      to: ME,
      amount: "250000000000000000",
    });
    expect(out.direction).toBe("in");
    expect(out.text).toContain("換算不了");
    expect(out.text).not.toMatch(/\d{15,}/);
  });

  it("原始值還是看得到，只是縮短過（可以自己去 explorer 對）", () => {
    const out = h({
      operation: "transfer",
      token: UNKNOWN,
      from: STRANGER,
      to: ME,
      amount: "250000000000000000",
    });
    expect(out.text).toContain("250000…0000");
  });

  it("短的數字不縮短", () => {
    const out = h({ operation: "transfer", token: UNKNOWN, from: STRANGER, to: ME, amount: "42" });
    expect(out.text).toContain("42 個最小單位");
  });

  it("授權金額同樣不印原始整數", () => {
    const out = h({ operation: "approve", token: UNKNOWN, spender: STRANGER, amount: "1000000000000000000" });
    expect(out.direction).toBe("approval");
    expect(out.text).not.toMatch(/\d{15,}/);
    expect(out.text).toContain("換算不了");
  });

  it("無上限授權查不到代幣時講「這個代幣」，不編一個符號", () => {
    const out = h({
      operation: "approve",
      token: UNKNOWN,
      spender: STRANGER,
      amount: (2n ** 256n - 1n).toString(),
    });
    expect(out.text).toContain("這個代幣");
    expect(out.text).toContain("沒有上限");
  });

  /**
   * `assets` 原本寫死 18 位與 "MON"。對 shMONAD 是對的（底層就是原生 MON），
   * 但這是 operation 名稱層級的分派，任何新協議產出 deposit 形狀就會套用同一組
   * 數字——底層是 USDC（6 位）的 vault 會拿到錯了 10^12 倍的金額配錯的符號。
   */
  it("adapter 有講底層資產就照它查，不再假設 18 位與 MON", () => {
    const out = h({
      operation: "deposit",
      depositor: ME,
      receiver: ME,
      asset: USDC,
      assets: "1400000000",
      shares: "1000000000000000000",
    });
    // 1400000000 在 6 位小數是 1400 USDC，當成 18 位會變成 0.0000000014
    expect(out.text).toContain("1400 USDC");
    expect(out.text).not.toContain("1400 MON");
  });

  it("底層資產查不到就說換算不了，不退回 18 位硬算", () => {
    const out = h({
      operation: "deposit",
      depositor: ME,
      receiver: ME,
      asset: "0xdeadbeef00000000000000000000000000001234",
      assets: "1400000000",
      shares: "1000000000000000000",
    });
    expect(out.text).toContain("換算不了");
    // 只看 assets 那一格：不准被當成 MON 硬算。
    // （shares 那格是 shMON，字串裡本來就會有 MON，不能整句比對）
    expect(out.text).not.toMatch(/質押：[\d.~]+ MON/);
  });

  it("沒有底層資產欄位才退回原生，shMONAD 走這條", () => {
    const out = h({
      operation: "deposit",
      depositor: ME,
      receiver: ME,
      assets: "250000000000000000",
      shares: "156494950863022477",
    });
    expect(out.text).toContain("0.25 MON");
  });

  it("deposit 的 shares 查不到也不印原始整數", () => {
    const out = h(
      {
        operation: "deposit",
        depositor: ME,
        receiver: ME,
        assets: "250000000000000000",
        shares: "156494950863022477",
      },
      unknownEvent,
    );
    expect(out.text).not.toMatch(/\d{15,}/);
    expect(out.text).toContain("換算不了");
  });
});
