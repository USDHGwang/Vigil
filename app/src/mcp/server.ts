/**
 * MCP server：把簽名前的證據面板送進 agent 對話裡。
 *
 * 為什麼自己建一個而不是改 Moss 的 mcp-server：
 *   1. Moss 的 server 在 PR 分支上，加東西會污染 PR
 *   2. Moss 的 server 依賴裡沒有 shmonad
 *   3. 「agent 說使用者要求什麼」這個參數是本產品的東西，不是 Moss 的
 */

import {
  registerAppResource,
  registerAppTool,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { AddressValue } from "@themoss/core";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { renderText } from "../panel/text.js";
import { getStack, previewTransaction } from "../pipeline.js";
import { formatFingerprint } from "../handoff.js";
import { MAX_RECORDS, recent, record } from "../history.js";

export const PANEL_RESOURCE_URI = "ui://vigil/panel.html";

/** MCP Apps extension 的識別碼，client 會在 capabilities.extensions 裡宣告 */
export const UI_EXTENSION_ID = "io.modelcontextprotocol/ui";

/** 模擬用的預設帳戶。模擬器會替它預先注資，不需要真的持有資產。 */
const DEFAULT_ACCOUNT = "0xcccccccccccccccccccccccccccccccccccccccc";

/**
 * 這個 session 使用者提供的錢包地址（A1：session 記憶）。
 *
 * HTTP transport 用 extra.sessionId 區分對話；stdio 一個 process 服務
 * 一個 host 的一條連線，固定 key 就等於該 session。故意**不落盤**：
 * 產品不信任中間人，地址是使用者的資產資訊，只活在記憶體、session
 * 結束即消失。跨 session 記住（A3）是 wallet connect 之後的事。
 */
const SESSION_KEY_STDIO = "stdio";
const rememberedAccounts = new Map<string, string>();

/** 解析這次預覽的發送帳戶：參數 → session 記憶 → 模擬預設 */
function resolveAccount(account: string | undefined, sessionId: string | undefined): string {
  if (account !== undefined) return account;
  const remembered = rememberedAccounts.get(sessionId ?? SESSION_KEY_STDIO);
  return remembered ?? DEFAULT_ACCOUNT;
}

/**
 * 面板 HTML 由 `pnpm build:panel` 產生：自包含、內嵌 CSS 與 JS。
 * sandbox 的 connect-src 預設是 none，不能載外部資源。
 *
 * 從原始碼跑（src/mcp/）和從打包後跑（dist/）的相對位置不同，兩個都試。
 */
const PANEL_HTML_CANDIDATES = [
  new URL("../../panel/index.html", import.meta.url),
  new URL("../panel/index.html", import.meta.url),
];

function readPanelHtml(): string {
  for (const candidate of PANEL_HTML_CANDIDATES) {
    try {
      return readFileSync(candidate, "utf-8");
    } catch {
      // 換下一個候選位置
    }
  }
  throw new Error(
    `找不到面板 HTML。跑過 pnpm build:panel 了嗎？找過：${PANEL_HTML_CANDIDATES.map(String).join(", ")}`,
  );
}

export interface ServerOptions {
  /**
   * 簽名頁的網址，面板按下簽名時開這裡。
   *
   * 由進入點在執行時決定並傳進來，不在打包時寫死 —— 寫死的話烤進去的是建置那台
   * 機器的路徑，只有那一台跑得起來。stdio 走 `startSignHost()` 起的本機 server，
   * HTTP 模式走自己那個 `/sign` 路由。
   */
  signPageUrl?: string;
}

export function createServer(options: ServerOptions = {}): McpServer {
  const server = new McpServer({ name: "vigil", version: "0.2.0" });

  registerAppTool(
    server,
    "preview_transaction",
    {
      title: "Preview a transaction before signing",
      description:
        "Simulate a prepared Monad transaction and show the user what it will actually do. " +
        "The evidence comes from executing the transaction against a Monad node, not from " +
        "whatever prepared it. Call this before asking the user to sign anything. " +
        "Quote the user's own words verbatim in statedRequest so they can check the effect " +
        "against what they actually asked for. " +
        "A method's `receiver` parameter may be omitted — it defaults to the sending account " +
        "(staking to yourself is the common case).",
      inputSchema: {
        statedRequest: z
          .string()
          .describe("The user's own words for what they asked, quoted verbatim, not paraphrased."),
        protocol: z.string().describe("Protocol slug, for example 'shmonad' or 'kuru'."),
        method: z.string().describe("Method on that protocol, for example 'stake' or 'unstake'."),
        params: z
          .record(z.unknown())
          .default({})
          .describe("Parameters for the method, as described by the protocol."),
        // 沒有這條的話，垃圾值（"0x1234"）會一路流到 viem 才爆，錯誤訊息是
        // 開發者導向的原生例外；而且它會先被加進「使用者知情的地址」集合，
        // 影響結構比對。在邊界擋掉，錯誤訊息才控制得住。
        account: z
          .string()
          .regex(/^0x[0-9a-fA-F]{40}$/, "account must be a 20-byte hex address, like 0x1234…abcd")
          .optional()
          .describe("Address sending the transaction. Defaults to a simulation-only account."),
      },
      _meta: { ui: { resourceUri: PANEL_RESOURCE_URI } },
    },
    async ({ statedRequest, protocol, method, params, account }, extra): Promise<CallToolResult> => {
      try {
        // receiver 省略時視為質押給自己（= 發送帳戶）。質押給自己是
        // 最常見的形態，agent 不該被「不知道 receiver 填什麼」卡住——
        // 使用者說「幫我質押 0.25 MON」時本來就沒指定收款人。
        // 只補 receiver 這個語意參數；to/token 缺了是真正的錯誤，不補。
        const resolvedAccount = resolveAccount(account, extra.sessionId) as AddressValue;
        const paramsWithDefault = { ...params };
        if (paramsWithDefault.receiver === undefined) {
          paramsWithDefault.receiver = resolvedAccount;
        }
        const result = await previewTransaction({
          account: resolvedAccount,
          protocol,
          method,
          params: paramsWithDefault as Record<string, unknown>,
          statedRequest,
        });
        // 記一筆，讓使用者之後回頭找得到「剛剛那筆是什麼」。
        // 只記成功的預覽：回頭看的價值在於「我做過什麼」，不是「我試錯過什麼」。
        record(result.view);

        return {
          // content 是給不能渲染 HTML 的 host 用的（Claude Code、Codex 這類 CLI）。
          // 那些 host 上使用者直接讀這段文字，所以它必須是完整的面板，不是摘要。
          // 支援 MCP Apps 的 host 會另外抓 ui:// resource 渲染成畫面。
          //
          // VIGIL_COLOR=1 時開 ANSI 色：CLI host 的使用者直接看 terminal，顏色
          // 讓 verdict 跳出來。預設關——text 同時是給 LLM 讀的，ANSI 對它是噪音。
          content: [
            {
              type: "text",
              text: renderText(result.view, { color: process.env.VIGIL_COLOR === "1" }),
            },
          ],
          // view 是證據，signPageUrl 是「核准之後往哪裡交接」。兩件事分開放，
          // 不要把部署資訊混進資料契約裡。
          structuredContent: { view: result.view, signPageUrl: options.signPageUrl ?? null },
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          content: [{ type: "text", text: `Could not preview: ${message}` }],
          isError: true,
        };
      }
    },
  );

  /**
   * 這個 session 看過哪些交易。
   *
   * 面板可以透過 `callServerTool` 自己拿（host 有宣告 serverTools 的話），
   * CLI host 的使用者也可以直接叫 agent 呼叫它。記的是**預覽**不是簽名結果，
   * 理由見 history.ts。
   */
  server.registerTool(
    "recent_previews",
    {
      title: "What this session has previewed",
      description:
        "List the transactions previewed in this session, newest first: what the agent " +
        "said the user asked for, the structural verdict, and the handoff fingerprint. " +
        "These are previews, not signatures — signing happens in the user's own wallet " +
        "and this server never learns the outcome. Use it to answer 'what was that " +
        "earlier transaction' without scrolling back through the conversation.",
      inputSchema: {
        limit: z
          .number()
          .int()
          .min(1)
          .max(MAX_RECORDS)
          .optional()
          .describe(`How many to return, newest first. Defaults to ${MAX_RECORDS}.`),
      },
      _meta: { ui: { resourceUri: PANEL_RESOURCE_URI } },
    },
    async ({ limit }): Promise<CallToolResult> => {
      const list = recent(limit ?? MAX_RECORDS);
      const text =
        list.length === 0
          ? "這個 session 還沒有預覽過任何交易。"
          : list
              .map((r, i) => {
                const when = new Date(r.at).toLocaleTimeString();
                return [
                  `${i + 1}. ${when}  ${r.protocol}.${r.method}  [${r.verdict}]${r.signable ? "" : " 不可簽名"}`,
                  `   agent 說你要求的：${r.statedRequest}`,
                  `   效果：${r.summary}`,
                  `   指紋：${formatFingerprint(r.fingerprint)}`,
                ].join("\n");
              })
              .join("\n\n");
      return {
        content: [{ type: "text", text }],
        structuredContent: { previews: list },
      };
    },
  );

  /**
   * discover：這個 server 能模擬什麼。
   *
   * Moss 的能力鏈是 discover → load → action → simulate。Vigil 的
   * preview_transaction 是 simulate 層，但 agent 不知道 Monad 上有什麼
   * protocol、每個 method 的參數長什麼樣，就準備不出交易來呼叫它——
   * Claude 網頁版（沒有 Monad 工具）就是這樣卡住的。這裡把 discover 層
   * 暴露出來：agent 讀了就知道「質押是 shmonad.stake，參數是
   * amount/receiver」，才能準備交易、送進 preview_transaction。
   *
   * 只列 capability（會產生鏈上變動、需要簽名的），query（讀取）不算——
   * 使用者不會為了讀餘額簽名。
   */
  server.registerTool(
    "discover",
    {
      title: "What this server can simulate on Monad",
      description:
        "List the operations this server can preview: protocol.method, a one-line " +
        "summary, and the exact parameters each one takes. Read this first when " +
        "the user asks to do something on-chain — it tells you how to prepare the " +
        "transaction before calling preview_transaction. Query-like reads (balances, " +
        "allowances) are omitted: you don't sign for a read.",
      inputSchema: {},
      // 注意：discover 故意**不**宣告 ui resource。它是給 agent 讀的
      // 資料工具（操作清單），不是給使用者看的交易視圖——宣告了 host
      // 會嘗試用面板渲染，但 discover 的結果不是 EvidencePanelView，
      // 渲染器只會顯示「沒有可以顯示的結果」。
    },
    async (): Promise<CallToolResult> => {
      const { registry } = await getStack();
      const coordinates = registry.discover().filter((c) => c.kind === "capability");
      const stubs = registry.load(coordinates);
      const lines = stubs.map((s) => {
        const params = Object.entries(s.params)
          .map(([k, v]) => {
            // kuru 的 tokenIn/tokenOut 只收地址或字面量 "native"（Moss TokenReference）。
            // discover 的描述沒講，agent 會用 0xEeee.../WMON 地址去猜，兩條路都會爆。
            // 這裡補上提示，讓 agent 直接用 native 字面量走單腿市場。
            const hint =
              k === "tokenIn" || k === "tokenOut"
                ? ' (token address, or the literal "native" for native MON)'
                : "";
            return `${k} (${v.description}${hint})`;
          })
          .join("; ");
        return `${s.protocol}.${s.method} — ${s.intent}${params ? `  [${params}]` : ""}`;
      });
      return {
        content: [{ type: "text", text: `Monad 上可以模擬的操作（${stubs.length}）：\n\n${lines.join("\n")}` }],
        structuredContent: { operations: stubs },
      };
    },
  );

  /**
   * remember_account：這個對話記住使用者的錢包地址。
   *
   * 使用者告訴 agent 自己的地址後，agent 呼叫它——之後同 session 的
   * preview_transaction 不帶 account 也會用這個地址模擬（真實餘額、
   * 真實 gas 估算），不會再退回 0xcccc 模擬帳戶。這解決「每輪都要
   * 重新討地址」的摩擦。
   *
   * 誠實邊界：地址只是**記住**，不是**驗證**。Vigil 沒驗過它是使用者
   * 的錢包——面板照樣標「agent 給的、沒驗過」，簽名時錢包自己比對。
   * 記憶只在記憶體、session 結束消失（不落盤、不跨 session）。
   */
  server.registerTool(
    "remember_account",
    {
      title: "Remember the user's wallet address for this conversation",
      description:
        "Store the user's own wallet address for the rest of this conversation, so later " +
        "previews simulate against their real balance instead of the default simulation " +
        "account. Call this after the user tells you their address. Only store an address " +
        "the user actually provided — never invent or reuse one. The address is remembered " +
        "in memory for this session only; it is not verified by this server, and the " +
        "signing page still checks it against the wallet.",
      inputSchema: {
        address: z
          .string()
          .regex(/^0x[0-9a-fA-F]{40}$/, "address must be a 20-byte hex address, like 0x1234…abcd")
          .describe("The user's wallet address, exactly as they provided it."),
      },
      // 資料工具：不宣告 ui resource（理由同 discover）
    },
    async ({ address }, extra): Promise<CallToolResult> => {
      const key = extra.sessionId ?? SESSION_KEY_STDIO;
      rememberedAccounts.set(key, address);
      const short = `${address.slice(0, 6)}…${address.slice(-4)}`;
      return {
        content: [
          {
            type: "text",
            text:
              `已記住這個對話的錢包地址 ${short}。之後的預覽都會用這個地址模擬 ` +
              `（真實餘額與手續費）。僅存在這個 session 的記憶體，不會寫入任何地方。`,
          },
        ],
        structuredContent: { remembered: address, session: key === SESSION_KEY_STDIO ? null : key },
      };
    },
  );

  /**
   * 診斷：這個 host 到底支不支援把面板渲染成畫面。
   *
   * MCP Apps 是 opt-in 的 extension，client 與 server 都要在 capabilities 的
   * `extensions` 欄位宣告才會啟用（官方 extensions/overview 的協商機制）。
   * 所以這件事不用猜，問 client 自己宣告了什麼就知道。
   *
   * 官方的 client-matrix 是社群維護的，沒列到不等於不支援，不能拿它下結論。
   */
  server.registerTool(
    "panel_host_info",
    {
      title: "Check whether this host can render the panel",
      description:
        "Report what this MCP host declared about itself, including whether it supports " +
        "the MCP Apps UI extension. Use this to find out if the evidence panel will render " +
        "as a visual panel or fall back to the text version.",
      inputSchema: {},
    },
    async (): Promise<CallToolResult> => {
      const capabilities = server.server.getClientCapabilities();
      const client = server.server.getClientVersion();
      const extensions = (capabilities as Record<string, unknown> | undefined)?.extensions;
      const declared =
        extensions !== null && typeof extensions === "object"
          ? Object.keys(extensions as Record<string, unknown>)
          : [];
      const supportsApps = declared.includes(UI_EXTENSION_ID);

      return {
        content: [
          {
            type: "text",
            text: [
              `host: ${client?.name ?? "(未宣告)"} ${client?.version ?? ""}`.trim(),
              `宣告的 extensions: ${declared.length > 0 ? declared.join(", ") : "（沒有宣告任何 extension）"}`,
              `支援 MCP Apps 渲染: ${supportsApps ? "是，面板會渲染成畫面" : "否，會用文字版面板"}`,
              "",
              `完整 capabilities: ${JSON.stringify(capabilities ?? null)}`,
            ].join("\n"),
          },
        ],
        structuredContent: {
          client: client ?? null,
          capabilities: capabilities ?? null,
          declaredExtensions: declared,
          supportsMcpApps: supportsApps,
        },
      };
    },
  );

  registerAppResource(
    server,
    PANEL_RESOURCE_URI,
    PANEL_RESOURCE_URI,
    { mimeType: RESOURCE_MIME_TYPE },
    // 不標回傳型別：SDK 的 ReadResourceResult 在 exactOptionalPropertyTypes 下
    // 跟 ext-apps 的 McpUiReadResourceResult 對不上。讓它從字面量推導。
    async () => ({
      contents: [
        { uri: PANEL_RESOURCE_URI, mimeType: RESOURCE_MIME_TYPE, text: readPanelHtml() },
      ],
    }),
  );

  /**
   * vigil：入口工具。使用者第一次連上 Vigil 時問「這是什麼／能做什麼／怎麼用」，
   * agent 呼叫它回一份總覽。這份總覽同時是「指令對照」——agent 聽到使用者說
   * `vigil-preview`、`vigil preview` 或「用 Vigil 預覽」時，要對應到哪個工具。
   *
   * 為什麼需要：MCP 的工具列表是平的，agent 首次面對 5 個工具不知道從哪開始；
   * 使用者也不知道該叫 agent 做什麼。一個入口工具把「能力＋對應指令」講清楚，
   * 讓第一次使用不用摸索。
   */
  server.registerTool(
    "vigil",
    {
      title: "Vigil overview and command reference",
      description:
        "Call this when the user asks what Vigil is, what it can do, or how to use it " +
        "(e.g. 'vigil 是什麼', 'Vigil 能做什麼', 'vigil-preview 怎麼用'). Returns an " +
        "overview of Vigil's purpose, its trust model in one sentence, and a map from " +
        "user-facing commands (vigil-preview, vigil-discover, vigil-remember, vigil-recent) " +
        "to the underlying tools.",
      inputSchema: {},
      // 資料工具：不宣告 ui resource（理由同 discover）
    },
    async (): Promise<CallToolResult> => {
      const text = [
        "Vigil — 簽名前檢查。你叫 agent 在 Monad 上做事之前，先用 Vigil 把交易實際會做什麼模擬出來給你看。",
        "",
        "信任模型一句話：證據來自 Monad 主網模擬，不是來自準備這筆交易的 agent；你簽名之前，看到的每一項都是鏈上真的會發生的。",
        "",
        "指令對照（說這些話，agent 會對應去呼叫工具）：",
        "  vigil-preview   預覽一筆交易 → preview_transaction",
        "  vigil-discover  看 Monad 上能做什麼操作 → discover",
        "  vigil-remember  記住你的錢包地址（這個對話）→ remember_account",
        "  vigil-recent    回查這個對話預覽過什麼 → recent_previews",
        "",
        "第一次使用：告訴 agent 你的錢包地址（agent 會呼叫 vigil-remember），",
        "然後說你想做什麼（例如「幫我質押 0.25 MON 成 shMONAD」），",
        "agent 會 discover → 準備交易 → vigil-preview 給你看證據，你確認後在錢包裡簽名。",
        "",
        "你不需要記任何指令——直接說你想做什麼，agent 會用這些工具完成。",
      ].join("\n");
      return {
        content: [{ type: "text", text }],
        structuredContent: {
          purpose:
            "Before signing, Vigil simulates what the transaction will actually do on Monad and shows it to the user in the conversation.",
          trustModel:
            "Evidence comes from simulating on a Monad node, not from the agent that prepared the transaction.",
          commands: [
            { phrase: "vigil-preview", tool: "preview_transaction" },
            { phrase: "vigil-discover", tool: "discover" },
            { phrase: "vigil-remember", tool: "remember_account" },
            { phrase: "vigil-recent", tool: "recent_previews" },
          ],
        },
      };
    },
  );

  return server;
}
