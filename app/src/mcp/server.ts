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
import { previewTransaction } from "../pipeline.js";
import { formatFingerprint } from "../handoff.js";
import { MAX_RECORDS, recent, record } from "../history.js";

export const PANEL_RESOURCE_URI = "ui://vigil/panel.html";

/** MCP Apps extension 的識別碼，client 會在 capabilities.extensions 裡宣告 */
export const UI_EXTENSION_ID = "io.modelcontextprotocol/ui";

/** 模擬用的預設帳戶。模擬器會替它預先注資，不需要真的持有資產。 */
const DEFAULT_ACCOUNT = "0xcccccccccccccccccccccccccccccccccccccccc";

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
        "against what they actually asked for.",
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
    async ({ statedRequest, protocol, method, params, account }): Promise<CallToolResult> => {
      try {
        const result = await previewTransaction({
          account: (account ?? DEFAULT_ACCOUNT) as AddressValue,
          protocol,
          method,
          params: params as Record<string, unknown>,
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

  return server;
}
