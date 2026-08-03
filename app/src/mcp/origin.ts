/**
 * HTTP transport 的來源檢查。
 *
 * 抽成獨立模組是為了可測：`http.ts` 在載入時就 `app.listen`，測試 import 它
 * 會直接把 server 起起來。
 *
 * 為什麼需要這層：`cors({ origin: true })` 是把請求方的 origin 原樣反射回去，
 * 等於任何網站都通過。使用者跑著這個 server 時瀏覽任何一個網頁，那個網頁就能
 * `fetch('http://localhost:8848/mcp')` 驅動它（DNS rebinding / CSRF）。
 * MCP 官方對 local HTTP transport 明確要求驗 Origin 並綁 localhost。
 */

/** Claude Desktop 的 webview 在不同版本會用不同子網域，所以整個網域放行。 */
const CLAUDE_HOST = "claude.ai";

export function defaultAllowedOrigins(port: number): string[] {
  return [`https://${CLAUDE_HOST}`, `http://localhost:${port}`, `http://127.0.0.1:${port}`];
}

function normalize(origin: string): string {
  return origin.trim().replace(/\/+$/, "");
}

export function parseAllowedOrigins(raw: string | undefined, port: number): string[] {
  if (raw === undefined || raw.trim() === "") return defaultAllowedOrigins(port);
  return raw.split(",").map(normalize).filter((o) => o !== "");
}

/**
 * `undefined` 是「這個請求沒帶 Origin」，不是空字串。
 *
 * 沒有 Origin 的請求放行：Claude Desktop 這類原生程式不送 Origin，而瀏覽器發
 * 跨來源請求時一定會送（`content-type: application/json` 的 POST 還會先 preflight）。
 * 所以「沒有 Origin」不是瀏覽器攻擊面。
 *
 * `claude.ai` 的子網域用 URL 解析後比對 hostname，不做前綴或 includes 比對——
 * `https://claude.ai.evil.com` 與 `https://notclaude.ai` 都不能通過。
 */
export function isOriginAllowed(
  origin: string | undefined,
  allowed: readonly string[],
): boolean {
  if (origin === undefined) return true;
  const candidate = normalize(origin);
  if (allowed.includes(candidate)) return true;
  // 明確設了清單就只認清單，不再套用 claude.ai 的萬用規則
  if (!allowed.includes(`https://${CLAUDE_HOST}`)) return false;
  try {
    const { protocol, hostname } = new URL(candidate);
    return protocol === "https:" && (hostname === CLAUDE_HOST || hostname.endsWith(`.${CLAUDE_HOST}`));
  } catch {
    return false;
  }
}
