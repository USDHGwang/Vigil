#!/usr/bin/env node
/**
 * stdio 進入點，給 Claude Desktop 這類 host 用。
 *
 * 順帶起一個只綁 127.0.0.1 的小 server 服務簽名頁。面板在 sandbox 裡碰不到錢包，
 * 簽名要開一個真的頁面，而那一頁不能走 `file://`（MetaMask 預設不注入）。
 * 網址在這裡算出來傳給 server，不在打包時寫死 —— 寫死的是建置那台機器的路徑。
 *
 * 一律寫 stderr。stdout 是 JSON-RPC 的線路，寫進去會把協定弄壞。
 */

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { startSignHost } from "./signhost.js";

/**
 * 簽名頁託管在外面時指過去，本機就不起 server。
 *
 * 為什麼需要這個：本機模式的簽名頁是 `http://127.0.0.1:<每次都不同的 port>`，
 * 而 MCP host 對面板能開哪些網址有政策，localhost 加浮動 port 正好是最容易
 * 被擋的形狀 —— 2026-08-04 實機就是這樣，`openLink` 回 isError，使用者按了
 * 簽名什麼都不會發生（見 panel/main.ts 的退路）。
 *
 * 指到一個固定的 https 網址通常就不再被擋。簽名頁是完全自包含的靜態 HTML，
 * 交易在網址的 `#` 後面不會送到伺服器，所以它可以放在任何靜態託管上，
 * 不需要後端，也不會因為換了託管方而改變信任模型。
 */
const HOSTED_SIGN_PAGE = process.env.SIGN_PAGE_URL?.trim();

let signPageUrl: string | undefined;
if (HOSTED_SIGN_PAGE !== undefined && HOSTED_SIGN_PAGE !== "") {
  if (!/^https?:\/\//i.test(HOSTED_SIGN_PAGE)) {
    process.stderr.write(
      `Vigil SIGN_PAGE_URL 必須是 http(s) 網址，收到的是「${HOSTED_SIGN_PAGE}」，改用本機簽名頁\n`,
    );
  } else {
    signPageUrl = HOSTED_SIGN_PAGE.replace(/\/+$/, "");
    process.stderr.write(`Vigil 簽名頁（外部託管）：${signPageUrl}\n`);
  }
}

// 起不來也要讓 server 活著：模擬與證據不需要它，只有按下簽名那一步用得到。
if (signPageUrl === undefined) {
  try {
    const host = await startSignHost();
    signPageUrl = host.url;
    process.stderr.write(`Vigil 簽名頁：${host.url}\n`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Vigil 簽名頁起不來，證據照顯示但不能交接：${message}\n`);
  }
}

const server = createServer(signPageUrl === undefined ? {} : { signPageUrl });
await server.connect(new StdioServerTransport());
