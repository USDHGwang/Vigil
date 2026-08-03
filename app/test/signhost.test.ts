/**
 * 簽名頁的主機。
 *
 * 這一層存在的理由：先前 `build:panel` 把建置那台機器的絕對路徑烤進面板
 * （`file:///D:/dev/...`），結果只有那一台跑得起來。改成執行時起一個小 server
 * 並把網址隨結果送給面板，任何人裝了都能用。
 */

import { afterEach, describe, expect, it } from "vitest";
import { readSignHtml, type SignHost, startSignHost } from "../src/mcp/signhost.js";

let host: SignHost | undefined;

afterEach(async () => {
  await host?.close();
  host = undefined;
});

describe("簽名頁 HTML", () => {
  it("讀得到，而且是自包含的", () => {
    const html = readSignHtml();
    expect(html.length).toBeGreaterThan(5000);
    // sandbox 與離線都要能跑，不能有外部 script 或 stylesheet
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+stylesheet/);
  });
});

describe("起本機主機", () => {
  it("只綁 127.0.0.1，不對外開", async () => {
    host = await startSignHost();
    expect(host.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+\/sign$/);
  });

  it("走 http 不走 file：MetaMask 預設不注入 file:// 頁面", async () => {
    host = await startSignHost();
    expect(host.url.startsWith("http://")).toBe(true);
  });

  // 打包時 esbuild 預設 charset=ascii，中文會變成 \uXXXX（而且是大寫十六進位）。
  // 所以別對 bundle 裡的字串下斷言，那是 minifier 的實作細節；認 HTML 外殼就好。
  const looksLikeSignPage = (html: string): boolean =>
    html.includes("<title>簽名前最後一步</title>") && html.includes('id="root"');

  it("服務得出簽名頁", async () => {
    host = await startSignHost();
    const res = await fetch(host.url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    expect(looksLikeSignPage(await res.text())).toBe(true);
  });

  it("任何路徑都回同一頁：交易在 # 後面，根本不會送到 server", async () => {
    host = await startSignHost();
    const res = await fetch(`${host.url}/anything/at/all`);
    expect(res.status).toBe(200);
    expect(looksLikeSignPage(await res.text())).toBe(true);
  });

  it("不快取，免得改版之後拿到舊的那一頁", async () => {
    host = await startSignHost();
    const res = await fetch(host.url);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("關掉之後 port 就收回去了", async () => {
    const one = await startSignHost();
    const url = one.url;
    await one.close();
    await expect(fetch(url)).rejects.toThrow();
  });

  it("每次起用不同的 port，不會跟既有服務打架", async () => {
    const a = await startSignHost();
    const b = await startSignHost();
    expect(a.url).not.toBe(b.url);
    await a.close();
    await b.close();
  });
});
