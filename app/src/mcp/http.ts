#!/usr/bin/env node
/**
 * HTTP 進入點，給 Claude Desktop 的 Connectors 用。
 *
 * 加法跟 PayBox 一樣：Connectors → Add MCP → 填 URL。
 * 差別只在 PayBox 的 URL 在他們的伺服器上，我們的在 localhost。
 *
 * stdio 版本在 cli.ts，那個要改 claude_desktop_config.json。兩個都能用。
 */

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import cors from "cors";
import express from "express";
import { isOriginAllowed, parseAllowedOrigins } from "./origin.js";
import { createServer } from "./server.js";
import { readSignHtml } from "./signhost.js";

const PORT = Number(process.env.PORT ?? 8848);

/**
 * 綁哪個介面。**預設只綁 loopback。**
 *
 * 原本省略 host，Node 預設綁 `0.0.0.0`，等於在咖啡廳或宿舍 wifi 上，同網段
 * 任何人都能直接呼叫這台的 `/mcp` 驅動模擬、耗掉 RPC 配額、讀到 `/health`
 * 裡的簽名頁位置。本機開發不需要那個暴露面。
 *
 * 部署到雲端才需要對外綁，那時明確設 `HOST=0.0.0.0`。
 */
const HOST = process.env.HOST ?? "127.0.0.1";

/** 允許的瀏覽器來源。規則與理由見 origin.ts。 */
const ALLOWED_ORIGINS = parseAllowedOrigins(process.env.ALLOWED_ORIGINS, PORT);

/**
 * 對外看得到的位置。部署到雲端就設 `PUBLIC_URL=https://…`，本機不必設。
 *
 * 面板拿這個網址開簽名頁，所以它必須是**使用者的瀏覽器連得到**的位置，
 * 不是這個 process 自己看到的。兩者在容器裡常常不同。
 */
const PUBLIC_URL = (process.env.PUBLIC_URL ?? `http://localhost:${PORT}`).replace(/\/+$/, "");
const SIGN_PAGE_URL = `${PUBLIC_URL}/sign`;

const app = express();
app.use(express.json());

// Claude Desktop 從自己的 origin 打過來，需要放行，而且要把 session header 露出去
app.use(
  cors({
    origin: (origin, callback) => {
      // cors 套件把「沒有 Origin」給成 undefined，跟 isOriginAllowed 的約定一致
      callback(null, isOriginAllowed(origin ?? undefined, ALLOWED_ORIGINS));
    },
    exposedHeaders: ["Mcp-Session-Id"],
    allowedHeaders: ["Content-Type", "Mcp-Session-Id", "Mcp-Protocol-Version", "Authorization"],
  }),
);

/**
 * CORS 只讓瀏覽器不把回應交給發起的網頁，請求本身還是會執行到。
 * 要真的擋掉，在跑到 handler 之前先看 Origin。
 */
app.use((req, res, next) => {
  if (!isOriginAllowed(req.headers.origin, ALLOWED_ORIGINS)) {
    res.status(403).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Origin not allowed." },
      id: null,
    });
    return;
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, server: "vigil", signPage: SIGN_PAGE_URL });
});

/**
 * 簽名頁。面板碰不到 `window.ethereum`（sandbox），所以簽名開這一頁。
 *
 * 交易資料在網址的 `#` 後面，**不會**進到這個請求裡，所以這裡不需要路由也
 * 沒有後端。同一份 HTML 回給任何路徑。
 */
const signHtml = readSignHtml();
app.get(["/sign", "/sign/*splat"], (_req, res) => {
  res.set("cache-control", "no-store").type("html").send(signHtml);
});

/**
 * 無狀態模式：每個請求開一個新的 server 與 transport。
 * 對這個用途夠用，而且不用管 session 生命週期。
 */
app.post("/mcp", async (req, res) => {
  try {
    // stateless: true —— 每個請求新建 server，remember_account 的跨請求記憶
    // 沒有意義（module 級 Map 會被所有請求共用），server 側直接不寫。
    const server = createServer({ signPageUrl: SIGN_PAGE_URL, stateless: true });
    // 不傳 options 就是無狀態：沒有 session id、不做 session 驗證
    const transport = new StreamableHTTPServerTransport();

    res.on("close", () => {
      void transport.close();
      void server.close();
    });

    // SDK 用 getter/setter 宣告 onclose，在 exactOptionalPropertyTypes 下
    // 跟 Transport 介面對不上。這是 SDK 的型別寫法，不是邏輯問題，
    // 在邊界收一次，不為了它關掉整個專案的嚴格度。
    await server.connect(transport as unknown as Transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: String(error) },
        id: null,
      });
    }
  }
});

// 無狀態模式不支援 server 主動推送，明確回不支援比讓它掛住好
const notAllowed = (_req: express.Request, res: express.Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed in stateless mode." },
    id: null,
  });
};
app.get("/mcp", notAllowed);
app.delete("/mcp", notAllowed);

app.listen(PORT, HOST, () => {
  process.stderr.write(`Vigil MCP server: ${PUBLIC_URL}/mcp\n`);
  process.stderr.write(`Vigil 簽名頁：     ${SIGN_PAGE_URL}\n`);
  process.stderr.write(`綁定介面：         ${HOST}:${PORT}\n`);
});
