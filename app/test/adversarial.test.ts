/**
 * 對抗性測試：故意給錯誤資訊，驗證證據面板揭露得了。
 *
 * 這是黑箱測試——透過 MCP 協定呼叫，斷言的是「使用者實際看到的文字面板」。
 * 情境都是「agent 搞錯或說謊」的形狀：
 *
 *  - statedRequest 說的跟 params 做的不一樣（說 A 做 B）
 *  - 交易內容與使用者意圖無關（查餘額 → 無上限授權）
 *  - 收受方給錯人（質押給自己 → 轉給陌生人）
 *  - 引用不存在的意圖（說「我沒要求過」）
 *  - 邊界：畸形地址、超長原話、垃圾參數
 *
 * 斷言原則：不是看「有沒有報錯」，而是看面板文字裡有沒有
 * 讓使用者停下來看的字眼（verdict、無上限、不符、blocked…）。
 */

import { beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { EvidencePanelView } from "../src/contract.js";
import { record, resetHistory } from "../src/history.js";
import { createServer } from "../src/mcp/server.js";

const SIGN_PAGE_URL = "http://127.0.0.1:65000/sign";
/** 模擬帳戶（主網付不起，但模擬跑得動） */
const ACCOUNT = "0xcccccccccccccccccccccccccccccccccccccccc";
/** 攻擊者/陌生收受方 */
const STRANGER = "0x9f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b";

let client: Client;

beforeAll(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({ signPageUrl: SIGN_PAGE_URL });
  client = new Client({ name: "adversarial", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

async function previewTool(args: Record<string, unknown>) {
  const result = await client.callTool({
    name: "preview_transaction",
    arguments: { locale: "zh-TW", ...args },
  });
  return result;
}

/** 取出文字面板內容（SDK 型別較寬，跟既有測試一樣收窄成 text 陣列） */
function textOf(result: unknown): string {
  const content = (result as { content?: unknown })?.content;
  const t = (content as { type: string; text?: string }[] | undefined)?.find(
    (c) => c.type === "text",
  )?.text ?? "";
  return t;
}

describe("對抗性：agent 說 A 做 B", () => {
  it("statedRequest 說質押，params 卻是贖回 → 至少要被擋下或明確警示", async () => {
    const result = await previewTool({
      statedRequest: "幫我質押 0.25 MON",
      protocol: "shmonad",
      method: "unstake",
      params: { shares: "1", receiver: ACCOUNT, owner: ACCOUNT },
      account: ACCOUNT,
    });
    const text = textOf(result);
    // 結構層看 method=unstake 與鏈上 unstake 是相符的——「說 A 做 B」要靠
    // ① 原話並排（agent 說你要求的）② 模擬失敗擋下（這筆不能簽）來揭露。
    // 兩者任一出現都算揭露成功；不能是「乾淨 match + 可簽名」。
    const hasStatedRequest = text.includes("幫我質押 0.25 MON");
    const isBlocked = /這筆不能簽|blocked|不能簽/.test(text);
    expect(hasStatedRequest).toBe(true);
    expect(isBlocked).toBe(true);
    // 面板底部必須提醒使用者自己對照（不是替使用者下結論）
    expect(text).toMatch(/你自己|自己看/);
  });

  it("statedRequest 說查餘額，實際是無上限授權 → 面板要叫使用者停下來", async () => {
    const result = await previewTool({
      statedRequest: "幫我查一下餘額",
      protocol: "erc20",
      method: "approve",
      params: { token: "0x760AfE86e5de5aE0f0db4bD63b9B98A2a1d2e4f6", spender: STRANGER, amount: "115792089237316195423570985008687907853269984665640564039457584007913129639935" },
      account: ACCOUNT,
    });
    const text = textOf(result);
    expect(text).toMatch(/無上限|最大授權|確認/);
  });
});

describe("對抗性：收受方給錯人", () => {
  it("statedRequest 說質押給自己，receiver 卻填陌生人 → 結構比對要抓到", async () => {
    const result = await previewTool({
      statedRequest: "幫我質押 0.25 MON 給我自己的地址",
      protocol: "shmonad",
      method: "stake",
      params: { amount: "0.25", receiver: STRANGER },
      account: ACCOUNT,
    });
    const text = textOf(result);
    // 意圖說自己、交易給陌生人——至少要有警示字眼，不能只顯示「金額 0.25」
    expect(text).toMatch(/注意|不符|檢查|陌生|不一致/);
  });
});

describe("對抗性：引用不存在的意圖", () => {
  it("statedRequest 提到『我沒要求過』的對象 → 面板要保留原話讓使用者對照", async () => {
    const result = await previewTool({
      statedRequest: "這是我沒要求過的操作，你為什麼要執行",
      protocol: "shmonad",
      method: "stake",
      params: { amount: "0.25", receiver: ACCOUNT },
      account: ACCOUNT,
    });
    const text = textOf(result);
    // 原話必須原樣出現在面板（使用者靠它對照）
    expect(text).toContain("這是我沒要求過的操作");
  });
});

describe("對抗性：輸入邊界", () => {
  it("畸形地址（0x1234）→ 邊界擋下，錯誤訊息是給人看的", async () => {
    const result = await previewTool({
      statedRequest: "幫我質押",
      protocol: "shmonad",
      method: "stake",
      params: { amount: "0.25" },
      account: "0x1234",
    });
    const text = textOf(result);
    expect(text).toMatch(/Could not preview|0x|address|位址/);
  });

  it("statedRequest 超過 2000 字元 → 邊界擋下", async () => {
    const result = await previewTool({
      statedRequest: "好".repeat(2001),
      protocol: "shmonad",
      method: "stake",
      params: { amount: "0.25" },
      account: ACCOUNT,
    });
    const text = textOf(result);
    expect(text).toMatch(/Could not preview|too long|2000/);
  });

  it("protocol 不存在 → 回報錯誤而不是丟例外", async () => {
    const result = await previewTool({
      statedRequest: "幫我做奇怪的事",
      protocol: "not-a-real-protocol",
      method: "whatever",
      params: {},
      account: ACCOUNT,
    });
    const text = textOf(result);
    expect(text).toMatch(/Could not preview/);
    expect(text).not.toMatch(/TypeError|undefined|NaN/);
  });

  it("amount 是垃圾值 → 錯誤訊息不能是開發者例外", async () => {
    const result = await previewTool({
      statedRequest: "幫我質押",
      protocol: "shmonad",
      method: "stake",
      params: { amount: "garbage-not-a-number", receiver: ACCOUNT },
      account: ACCOUNT,
    });
    const text = textOf(result);
    expect(text).not.toMatch(/TypeError|RangeError|at \/|stack/i);
  });
});

describe("對抗性：無狀態模式（HTTP 部署）", () => {
  async function statelessClient(name: string): Promise<Client> {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = createServer({ signPageUrl: SIGN_PAGE_URL, stateless: true });
    const c = new Client({ name, version: "0.0.0" });
    await Promise.all([server.connect(serverTransport), c.connect(clientTransport)]);
    return c;
  }

  it("remember_account 在無狀態模式回 supported:false，不寫共享記憶", async () => {
    const c = await statelessClient("adversarial-stateless");
    const result = await c.callTool({
      name: "remember_account",
      arguments: { address: ACCOUNT, locale: "zh-TW" },
    });
    const text = textOf(result);
    expect(text).toMatch(/supported:false|不支援|無狀態/);
  });

  /**
   * history 的 records 是 module 級的，而無狀態部署每個請求開一個新 server
   * 卻共用同一個 process。不擋的話 A 的原話會出現在 B 的 recent_previews 裡。
   */
  it("recent_previews 在無狀態模式不吐別人的紀錄", async () => {
    resetHistory();
    record({
      intent: {
        source: "agent",
        protocol: "shmonad",
        method: "stake",
        params: {},
        text: "另一個使用者的原話",
      },
      receipt: null,
      changes: [],
      warnings: [],
      verdict: { kind: "match" },
      signable: true,
      account: ACCOUNT,
      locale: "zh-TW",
      accountSource: "agent",
      tokens: {},
      transactions: [],
      fingerprint: "AAAABBBBCCCCDDDD",
    } as unknown as EvidencePanelView);

    const c = await statelessClient("adversarial-other-user");
    const text = textOf(await c.callTool({ name: "recent_previews", arguments: { locale: "zh-TW" } }));
    expect(text).not.toContain("另一個使用者的原話");
    expect(text).toMatch(/不保存|無狀態/);
    resetHistory();
  });
});
