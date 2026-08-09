/**
 * Workers 部屬模式的對抗測試。
 *
 * worker.ts 是新的攻擊面：部屬到 CF 邊緣後，任何能連到 workers.dev 的
 * 人都能打。http.ts（express 版）有 origin 檢查，worker 版必須一樣——
 * 而且它是無狀態的，每個請求都開新 server，驗證「請求之間不能互相
 * 污染」也是重點。
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";

const ALLOWED = "https://claude.ai,https://chatgpt.com";
const PUBLIC_URL = "https://vigil-mcp.test.workers.dev";

type WorkerFetch = (req: Request) => Promise<Response>;

let worker: { fetch: WorkerFetch };

beforeAll(async () => {
  process.env.ALLOWED_ORIGINS = ALLOWED;
  process.env.PUBLIC_URL = PUBLIC_URL;
  worker = (await import("../src/mcp/worker.js")).default;
});

afterAll(() => {
  delete process.env.ALLOWED_ORIGINS;
  delete process.env.PUBLIC_URL;
});

const MCP_INIT = JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "adversarial-probe", version: "0" },
  },
});

describe("origin 阻擋（跟 http.ts 同規則）", () => {
  it("不在白名單的 origin 直接 403，且回應是 JSON-RPC 錯誤", async () => {
    const res = await worker.fetch(
      new Request("https://vigil-mcp.test.workers.dev/mcp", {
        method: "POST",
        headers: { Origin: "https://evil.example", "Content-Type": "application/json" },
        body: MCP_INIT,
      }),
    );
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe(-32000);
    expect(body.error.message).toContain("Origin not allowed");
  });

  it("白名單內的 origin 不會被擋（走到 MCP 層）", async () => {
    const res = await worker.fetch(
      new Request("https://vigil-mcp.test.workers.dev/mcp", {
        method: "POST",
        headers: { Origin: "https://claude.ai", "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
        body: MCP_INIT,
      }),
    );
    expect(res.status).not.toBe(403);
  });

  it("沒有 Origin 的請求（CLI 客戶端）放行", async () => {
    const res = await worker.fetch(
      new Request("https://vigil-mcp.test.workers.dev/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: MCP_INIT,
      }),
    );
    expect(res.status).not.toBe(403);
  });

  it("CORS 預檢：204 + 露 Mcp-Session-Id 給瀏覽器", async () => {
    const res = await worker.fetch(
      new Request("https://vigil-mcp.test.workers.dev/mcp", {
        method: "OPTIONS",
        headers: { Origin: "https://claude.ai" },
      }),
    );
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("https://claude.ai");
    expect(res.headers.get("access-control-expose-headers")).toContain("Mcp-Session-Id");
    expect(res.headers.get("access-control-allow-headers")).toContain("Mcp-Protocol-Version");
  });
});

describe("路由（stateless 模式的邊界）", () => {
  it("/health 回 server 資訊與簽名頁位置", async () => {
    const res = await worker.fetch(new Request("https://vigil-mcp.test.workers.dev/health"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.signPage).toBe(`${PUBLIC_URL}/sign`);
  });

  it("/sign 回同一份 HTML 且禁止快取（交易資料在 URL 上）", async () => {
    for (const path of ["/sign", "/sign/0xabc"]) {
      const res = await worker.fetch(new Request(`https://vigil-mcp.test.workers.dev${path}`));
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("GET /mcp 明確回 405（stateless 不支援 server 主動推送）", async () => {
    const res = await worker.fetch(new Request("https://vigil-mcp.test.workers.dev/mcp", { method: "GET" }));
    expect(res.status).toBe(405);
  });

  it("DELETE /mcp 回 405", async () => {
    const res = await worker.fetch(new Request("https://vigil-mcp.test.workers.dev/mcp", { method: "DELETE" }));
    expect(res.status).toBe(405);
  });
});

describe("無狀態：請求之間不能互相污染", () => {
  it("連續兩個 initialize 都獨立成功", async () => {
    for (let i = 0; i < 2; i++) {
      const res = await worker.fetch(
        new Request("https://vigil-mcp.test.workers.dev/mcp", {
          method: "POST",
          // SDK：POST 必須同時接受 application/json 與 text/event-stream
          headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
          body: MCP_INIT,
        }),
      );
      expect(res.status).toBe(200);
      const text = await res.text();
      // Streamable HTTP 回 JSON 或 SSE——兩者都該帶 serverInfo
      expect(text).toContain("vigil");
      expect(text).toContain("serverInfo");
    }
  });
});

/**
 * 面板 resource 在 Workers 路由上讀得出來。
 *
 * 2026-08-09 線上實測抓到：`resources/list` 列得出 `ui://vigil/panel.html`，
 * `resources/read` 回 `-32603 Invalid URL string.`。resource handler 直接呼叫
 * `readPanelHtml()`，那條路走 `new URL(..., import.meta.url)`，而 workerd 的
 * `import.meta.url` 不是合法 URL。`ServerOptions.panelHtml` 早就宣告了、
 * worker.ts 也傳了，只是 handler 沒接。後果是支援 MCP Apps 的 host 拿不到
 * 面板，只能退回文字版。
 *
 * **這一組跑在 Node 上，重現不了那個失敗**——Node 有 fs、import.meta.url 也
 * 合法，readPanelHtml() 會成功。真正鎖住 wiring 的那條在 mcp-server.test.ts：
 * 注入的 panelHtml 必須是被送出去的那一份。這裡守的是路由層還通。
 */
describe("面板 resource（MCP Apps 的主要出口）", () => {
  async function rpc(body: unknown): Promise<string> {
    const res = await worker.fetch(
      new Request("https://vigil-mcp.test.workers.dev/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
        body: JSON.stringify(body),
      }),
    );
    expect(res.status).toBe(200);
    return res.text();
  }

  it("resources/list 列得出面板", async () => {
    const text = await rpc({ jsonrpc: "2.0", id: 1, method: "resources/list" });
    expect(text).toContain("ui://vigil/panel.html");
  });

  it("resources/read 回得出面板 HTML，不是錯誤", async () => {
    const text = await rpc({
      jsonrpc: "2.0",
      id: 2,
      method: "resources/read",
      params: { uri: "ui://vigil/panel.html" },
    });
    expect(text).not.toContain("Invalid URL string");
    expect(text).not.toContain('"error"');
    expect(text.toLowerCase()).toContain("<!doctype html");
    expect(text.length).toBeGreaterThan(10_000);
  });
});
