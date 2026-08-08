/**
 * Cloudflare Workers 進入點。
 *
 * 跟 http.ts（express）同一個 server core，差別只在 transport 走 Web
 * Standard：MCP SDK 的 WebStandardStreamableHTTPServerTransport 原生
 * 支援 Workers（Request → Response），SDK 文件明寫 Cloudflare Workers
 * 用這個類別。
 *
 * Workers 沒有 fs：面板與簽名頁 HTML 在建置時用 esbuild text loader
 * 內嵌（見 scripts/build-worker.ts）。
 *
 * 部屬：
 *   pnpm build:worker && pnpm worker:deploy
 * 本機驗證：
 *   pnpm build:worker && pnpm worker:dev   （wrangler dev，預設 8787）
 */

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
// ?raw：vitest 原生支援字串 import；esbuild 側由 build-worker.ts 的
// raw-html plugin 處理（見 scripts/build-worker.ts）
import panelHtml from "../../panel/index.html?raw";
import signHtml from "../../sign/index.html?raw";
import { createServer } from "./server.js";
import { isOriginAllowed } from "./origin.js";

const PUBLIC_URL = (process.env.PUBLIC_URL ?? "http://localhost:8787").replace(/\/+$/, "");
const SIGN_PAGE_URL = `${PUBLIC_URL}/sign`;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extra },
  });
}

function jsonError(message: string, code: number, status = 403): Response {
  return json({ jsonrpc: "2.0", error: { code, message }, id: null }, status);
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  return {
    "access-control-allow-origin": origin ?? "*",
    "access-control-expose-headers": "Mcp-Session-Id",
    "access-control-allow-headers": "Content-Type, Mcp-Session-Id, Mcp-Protocol-Version, Authorization",
    "access-control-allow-methods": "POST, GET, OPTIONS",
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // CORS 只讓瀏覽器不把回應交給發起的網頁，請求本身還是會執行到；
    // 跟 http.ts 一樣在進 handler 前先看 Origin 真的擋掉。
    const origin = request.headers.get("origin");
    if (origin !== null && !isOriginAllowed(origin, ALLOWED_ORIGINS)) {
      return jsonError("Origin not allowed.", -32000);
    }

    if (url.pathname === "/health") {
      return json({ ok: true, server: "vigil", signPage: SIGN_PAGE_URL });
    }

    if (url.pathname.startsWith("/sign")) {
      // 交易資料在 # 後面，不會進到請求裡——同一份 HTML 回給任何路徑
      return new Response(signHtml, {
        headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
      });
    }

    if (url.pathname === "/mcp" && request.method === "POST") {
      // 無狀態模式：每個請求新建 server 與 transport（跟 http.ts 相同）
      const server = createServer({ signPageUrl: SIGN_PAGE_URL, stateless: true, panelHtml });
      const transport = new WebStandardStreamableHTTPServerTransport();
      await server.connect(transport);
      const response = await transport.handleRequest(request);
      const headers = new Headers(response.headers);
      for (const [k, v] of Object.entries(corsHeaders(request))) headers.set(k, v);
      return new Response(response.body, { status: response.status, headers });
    }

    // 無狀態模式不支援 server 主動推送，明確回不支援比讓它掛住好
    return jsonError("Method not allowed in stateless mode.", -32000, 405);
  },
};
