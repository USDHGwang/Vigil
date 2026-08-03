/**
 * 簽名頁的主機。
 *
 * 面板在 MCP App 的 sandbox 裡碰不到 `window.ethereum`，所以簽名必須開一個
 * 真的頁面。那一頁要從 http(s) 提供而不是 `file://` —— MetaMask 預設不注入
 * `file://` 頁面，使用者得自己去擴充設定裡開權限才行。
 *
 * 為什麼是執行時起，而不是打包時把網址寫死：先前 `build:panel` 把建置那台機器的
 * 絕對路徑烤進面板（`file:///D:/dev/...`），結果只有那一台跑得起來，別人 clone
 * 下來按簽名會開到一個不存在的檔案。網址改成執行時算，任何人裝了都能用。
 *
 * 只綁 127.0.0.1，不對外開。瀏覽器把 127.0.0.1 當安全來源，錢包會正常注入。
 */

import { createServer, type Server } from "node:http";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";

/**
 * 從原始碼跑（src/mcp/）和從打包後跑（dist/）的相對位置不同，兩個都試。
 * 跟 server.ts 找面板 HTML 是同一套邏輯。
 */
const SIGN_HTML_CANDIDATES = [
  new URL("../../sign/index.html", import.meta.url),
  new URL("../sign/index.html", import.meta.url),
];

export function readSignHtml(): string {
  for (const candidate of SIGN_HTML_CANDIDATES) {
    try {
      return readFileSync(candidate, "utf-8");
    } catch {
      // 換下一個候選位置
    }
  }
  throw new Error(
    `找不到簽名頁 HTML。跑過 pnpm build:sign 了嗎？找過：${SIGN_HTML_CANDIDATES.map(String).join(", ")}`,
  );
}

export interface SignHost {
  /** 面板要交接過去的網址，交易接在 `#` 後面 */
  url: string;
  close(): Promise<void>;
}

/**
 * 起一個只服務簽名頁的小 server。
 *
 * 任何路徑都回同一頁：交易資料在 `#` 後面，根本不會送到這裡來，所以不需要路由。
 * 這也是這一頁不需要後端的原因。
 */
export function startSignHost(port = Number(process.env.SIGN_PORT ?? 0)): Promise<SignHost> {
  const html = readSignHtml();

  return new Promise((resolve, reject) => {
    const server: Server = createServer((_req, res) => {
      res.writeHead(200, {
        "content-type": "text/html; charset=utf-8",
        // 這一頁不存也不傳交易，快取只會讓改版之後拿到舊的
        "cache-control": "no-store",
      });
      res.end(html);
    });

    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      // 不讓這個 server 自己把 process 撐著。stdio 模式下 host 關掉 stdin 之後
      // MCP transport 就結束了，這時 process 應該跟著退出；沒有 unref 的話它會
      // 一直活著，每開一次 Claude Desktop 就多留一個孤兒。
      server.unref();
      const address = server.address() as AddressInfo | null;
      if (address === null) {
        reject(new Error("簽名頁 server 起來了卻拿不到 port"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}/sign`,
        close: () =>
          new Promise<void>((done) => {
            server.close(() => done());
          }),
      });
    });
  });
}
