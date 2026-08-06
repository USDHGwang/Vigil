/**
 * MCP App 的協定面：tool 有沒有正確宣告 UI resource、resource 回不回得出 HTML。
 * 用 in-memory transport 跑，不需要 Claude Desktop，也不動任何人的設定。
 *
 * 呼叫 tool 會真的對 Monad 主網跑模擬，所以那組歸在 live，MOSS_SKIP_E2E=1 可跳過。
 * 視覺確認（面板真的渲染在對話裡）只能在 host 裡看，不在這裡。
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeAll, describe, expect, it } from "vitest";
import type { EvidencePanelView } from "../src/contract.js";
import { assertViewInvariants } from "../src/contract.js";
import { createServer, PANEL_RESOURCE_URI } from "../src/mcp/server.js";

const SIGN_PAGE_URL = "http://127.0.0.1:65000/sign";

let client: Client;

beforeAll(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  // 交接網址由進入點在執行時決定，這裡給一個假的來驗它有沒有被傳到面板手上
  const server = createServer({ signPageUrl: SIGN_PAGE_URL });
  client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

async function previewTool(args: Record<string, unknown>) {
  const result = await client.callTool({ name: "preview_transaction", arguments: args });
  return result;
}

describe("MCP App 協定面", () => {
  it("暴露 preview_transaction，並宣告 UI resource", async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "preview_transaction");
    expect(tool).toBeDefined();
    // 這一行是整件事的重點：host 靠它知道要去抓哪個 UI 來渲染。
    // _meta 在協定上是開放欄位，型別是 unknown，這裡收窄成要驗的形狀。
    const ui = tool?._meta?.ui as { resourceUri?: string } | undefined;
    expect(ui?.resourceUri).toBe(PANEL_RESOURCE_URI);
  });

  it("input schema 收使用者原話與操作座標", async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "preview_transaction");
    const props = Object.keys(tool?.inputSchema.properties ?? {});
    expect(props).toContain("statedRequest");
    expect(props).toContain("protocol");
    expect(props).toContain("method");
    expect(props).toContain("params");
  });

  it("description 要求 agent 逐字引用使用者原話", async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "preview_transaction");
    expect(tool?.description).toMatch(/verbatim/i);
  });

  // 沒有格式驗證的話，垃圾值會一路流到 viem 才爆，錯誤訊息是開發者導向的
  // 原生例外；而且它會先被加進「使用者知情的地址」集合，影響結構比對。
  it("account 不是位址就在邊界擋下，不讓它流進管線", async () => {
    const result = await previewTool({
      statedRequest: "幫我質押 0.25 MON",
      protocol: "shmonad",
      method: "stake",
      params: { amount: "0.25" },
      account: "0x1234",
    });
    expect(result.isError).toBe(true);
    const text = JSON.stringify(result.content);
    expect(text).toMatch(/address/i);
    // 不該漏出 viem 的原生例外
    expect(text).not.toMatch(/InvalidAddressError|viem/i);
  });

  it("resource 回得出自包含的 HTML", async () => {
    const result = await client.readResource({ uri: PANEL_RESOURCE_URI });
    const first = result.contents[0];
    expect(first?.uri).toBe(PANEL_RESOURCE_URI);
    // contents 是 text | blob 的 union，收窄後才拿得到 text
    if (first === undefined || !("text" in first)) throw new Error("expected a text resource");
    const html = first.text;
    expect(html).toContain("<title>");
    // 自包含：sandbox 的 connect-src 預設是 none，不能有外部 script / stylesheet
    expect(html).not.toMatch(/<script[^>]+src=["']https?:/i);
    expect(html).not.toMatch(/<link[^>]+href=["']https?:/i);
  });

  it("不存在的協議回報錯誤而不是丟例外", async () => {
    const result = await previewTool({
      statedRequest: "做一件事",
      protocol: "nonexistent",
      method: "doStuff",
      params: {},
    });
    expect(result.isError).toBe(true);
  });
});

describe("host 診斷", () => {
  it("暴露 panel_host_info", async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toContain("panel_host_info");
  });

  it("回報 client 有沒有宣告 MCP Apps extension", async () => {
    const result = await client.callTool({ name: "panel_host_info", arguments: {} });
    const structured = result.structuredContent as {
      supportsMcpApps: boolean;
      declaredExtensions: string[];
    };
    // 測試用的 client 沒宣告 extension，所以應該是 false
    expect(structured.supportsMcpApps).toBe(false);
    expect(Array.isArray(structured.declaredExtensions)).toBe(true);

    const text = (result.content as { text: string }[])[0]?.text ?? "";
    expect(text).toContain("支援 MCP Apps 渲染");
  });
});

describe.skipIf(!!process.env.MOSS_SKIP_E2E)("呼叫 tool（對主網實跑）", () => {
  it("質押回傳可渲染的 view，且原話原樣帶著", { timeout: 180_000 }, async () => {
    const result = await previewTool({
      statedRequest: "幫我質押 0.25 MON",
      protocol: "shmonad",
      method: "stake",
      params: { amount: "0.25", receiver: "0xcccccccccccccccccccccccccccccccccccccccc" },
    });

    const { view } = result.structuredContent as { view: EvidencePanelView };
    expect(view.intent?.text).toBe("幫我質押 0.25 MON");
    // 這個測試帳戶只有 0.001 MON，付不起 0.25 加手續費，所以擋下來。
    // 模擬本身仍然成功，效果照樣算得出來。
    expect(view.receipt).not.toBeNull();
    expect(view.warnings.map((w) => w.code)).toContain("INSUFFICIENT_BALANCE");
    expect(view.signable).toBe(false);
    expect(() => assertViewInvariants(view)).not.toThrow();
  });

  it("content 是完整的文字面板，不是摘要", { timeout: 180_000 }, async () => {
    // Claude Code、Codex 這類 host 不渲染 HTML，使用者直接讀這段文字。
    // 官方 client-matrix 只列 Claude web 與 Desktop 支援 MCP Apps 的 UI resource。
    const result = await previewTool({
      statedRequest: "幫我質押 0.25 MON",
      protocol: "shmonad",
      method: "stake",
      params: { amount: "0.25", receiver: "0xcccccccccccccccccccccccccccccccccccccccc" },
    });

    const first = (result.content as { type: string; text: string }[])[0];
    const text = first?.text ?? "";
    expect(text).toContain("簽名前檢查");
    expect(text).toContain("agent 說你要求的");
    expect(text).toContain("鏈上會發生的");
    // 這個帳戶付不起，所以是不能簽的那條分支，理由要寫出來
    expect(text).toContain("這筆不能簽");
    expect(text).toContain("餘額不夠");
    // 給人讀的，不能有 wei 或完整地址
    expect(text).not.toMatch(/0x[0-9a-fA-F]{40}/);
    expect(text).not.toMatch(/\d{15,}/);
  });

  it("交接網址隨結果送給面板，不在打包時寫死", { timeout: 180_000 }, async () => {
    // 寫死等於把建置那台機器的路徑烤進面板，只有那一台跑得起來。
    // 位置跟部署方式有關（stdio 起本機 port、HTTP 模式用自己的 /sign），
    // 所以由執行時決定。
    const result = await previewTool({
      statedRequest: "幫我質押 0.25 MON",
      protocol: "shmonad",
      method: "stake",
      params: { amount: "0.25", receiver: "0xcccccccccccccccccccccccccccccccccccccccc" },
    });

    const structured = result.structuredContent as { signPageUrl: string | null };
    expect(structured.signPageUrl).toBe(SIGN_PAGE_URL);
  });

  it("模擬失敗時回報 blocked 且不可簽名", { timeout: 180_000 }, async () => {
    const result = await previewTool({
      statedRequest: "幫我贖回 1 shMON",
      protocol: "shmonad",
      method: "unstake",
      params: {
        shares: "1",
        receiver: "0xcccccccccccccccccccccccccccccccccccccccc",
        owner: "0xcccccccccccccccccccccccccccccccccccccccc",
      },
    });

    const { view } = result.structuredContent as { view: EvidencePanelView };
    expect(view.verdict.kind).toBe("blocked");
    expect(view.signable).toBe(false);
    expect(() => assertViewInvariants(view)).not.toThrow();
  });

  it("discover 列出可模擬的操作，含 shmonad.stake 與參數描述", { timeout: 180_000 }, async () => {
    const result = await client.callTool({ name: "discover", arguments: {} });

    const text = (result.content as { type: string; text: string }[])[0]?.text ?? "";
    // 人話版：要能看到質押這項操作
    expect(text).toContain("shmonad.stake");
    expect(text).toContain("Monad 上可以模擬的操作");

    // 結構化版：agent 要靠它準備交易，參數描述必須在
    const { operations } = result.structuredContent as {
      operations: { protocol: string; method: string; intent: string; params: Record<string, unknown> }[];
    };
    const stake = operations.find((o) => o.protocol === "shmonad" && o.method === "stake");
    expect(stake).toBeDefined();
    expect(Object.keys(stake?.params ?? {})).toContain("amount");

    // kuru.swap 的 token 參數要提示 native 字面量（agent 會用 0xEeee/WMON 猜，兩條都爆）
    // overlay 在 text 版（agent 主要讀這個）
    expect(text).toContain("kuru.swap");
    expect(text).toContain('literal "native"');

    // discover 只列 capability：讀取類操作不該出現
    const balanceOf = operations.find((o) => o.method === "balanceOf");
    expect(balanceOf).toBeUndefined();
  });

  it("discover 不宣告 UI resource（資料工具，渲染器沒有 view 可畫）", async () => {
    // 修過一次：discover 帶 _meta.ui.resourceUri 時，host 會嘗試用面板
    // 渲染它的結果，但 discover 回的是操作清單不是 EvidencePanelView，
    // 於是顯示「沒有可以顯示的結果」。這是資料工具，不是使用者視圖。
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "discover");
    const ui = tool?._meta?.ui as { resourceUri?: string } | undefined;
    expect(ui?.resourceUri).toBeUndefined();
  });

  it("receiver 省略時視為質押給發送帳戶，模擬照跑", { timeout: 180_000 }, async () => {
    // 使用者說「幫我質押 0.25 MON」時沒指定收款人——質押給自己是常態。
    // agent 不該被「不知道 receiver 填什麼」卡住，server 自動補發送帳戶。
    const result = await previewTool({
      statedRequest: "幫我質押 0.25 MON",
      protocol: "shmonad",
      method: "stake",
      params: { amount: "0.25" },
      account: "0xcccccccccccccccccccccccccccccccccccccccc",
    });

    const { view } = result.structuredContent as { view: EvidencePanelView };
    // receiver 被補成發送帳戶，模擬不因缺參數中斷
    expect(view.intent?.params.receiver).toBe("0xcccccccccccccccccccccccccccccccccccccccc");
    expect(view.receipt).not.toBeNull();
    expect(() => assertViewInvariants(view)).not.toThrow();
  });

  it("remember_account 記住後，不帶 account 的預覽用記住的地址", { timeout: 180_000 }, async () => {
    const WALLET = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const remember = await client.callTool({
      name: "remember_account",
      arguments: { address: WALLET },
    });
    const remembered = (remember.structuredContent as { remembered?: string }).remembered;
    expect(remembered).toBe(WALLET);

    const result = await previewTool({
      statedRequest: "幫我質押 0.25 MON",
      protocol: "shmonad",
      method: "stake",
      params: { amount: "0.25" },
      // 不帶 account：應該用 remember_account 記住的地址
    });

    const { view } = result.structuredContent as { view: EvidencePanelView };
    expect(view.account.toLowerCase()).toBe(WALLET);
    expect(view.intent?.params.receiver).toBe(WALLET);
    expect(() => assertViewInvariants(view)).not.toThrow();
  });

  it("remember_account 不是 UI 工具（不宣告 resource）", async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "remember_account");
    expect(tool).toBeDefined();
    const ui = tool?._meta?.ui as { resourceUri?: string } | undefined;
    expect(ui?.resourceUri).toBeUndefined();
  });

  it("vigil 入口工具回總覽：目的、信任模型、指令對照", async () => {
    const result = await client.callTool({ name: "vigil", arguments: {} });

    const text = (result.content as { type: string; text: string }[])[0]?.text ?? "";
    expect(text).toContain("Vigil — 簽名前檢查");
    expect(text).toContain("主網模擬");
    // 指令對照要能帶 agent 找到對應工具
    expect(text).toContain("vigil-preview");
    expect(text).toContain("preview_transaction");

    const { commands } = result.structuredContent as {
      commands: { phrase: string; tool: string }[];
    };
    expect(commands).toContainEqual({ phrase: "vigil-preview", tool: "preview_transaction" });
    expect(commands).toContainEqual({ phrase: "vigil-remember", tool: "remember_account" });
  });

  it("vigil 入口工具不是 UI 工具", async () => {
    const { tools } = await client.listTools();
    const tool = tools.find((t) => t.name === "vigil");
    const ui = tool?._meta?.ui as { resourceUri?: string } | undefined;
    expect(ui?.resourceUri).toBeUndefined();
  });
});
