/**
 * 把面板打包成單一自包含 HTML，給 MCP App 的 ui:// resource 用。
 *
 * 為什麼要自包含：MCP App 的 sandbox 預設 connect-src 'none'，
 * 外部 script 與 stylesheet 都載不到。所有東西必須內嵌。
 *
 * 跑法：pnpm build:panel
 */

import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const entry = `${here}/../src/panel/main.ts`;
const cssPath = `${here}/../src/panel/styles.css`;
const outPath = `${here}/../panel/index.html`;

/**
 * 打包進面板的後備網址。**預設是空的，這是刻意的。**
 *
 * 簽名頁的位置由 MCP server 在執行時決定並隨結果送給面板，因為它跟部署方式有關。
 * 先前這裡預設 `file://` 加建置機器的絕對路徑，結果烤進面板之後只有那一台跑得起來，
 * 別人 clone 下來按簽名會開到一個不存在的檔案。
 *
 * 只有 mock 頁那種沒有 server 的情境才需要設它。
 */
const SIGN_PAGE_URL = process.env.SIGN_PAGE_URL ?? "";

const result = await build({
  entryPoints: [entry],
  define: { __SIGN_PAGE_URL__: JSON.stringify(SIGN_PAGE_URL) },
  bundle: true,
  format: "iife",
  target: "es2022",
  platform: "browser",
  write: false,
  // resource 每次被 host 抓取都要傳一次，壓小一點
  minify: true,
  legalComments: "none",
});

const js = result.outputFiles?.[0]?.text;
if (js === undefined) throw new Error("esbuild 沒有產出內容");

const css = readFileSync(cssPath, "utf-8");

// 內嵌的內容不能提早關掉 script 標籤
if (js.includes("</script")) throw new Error("打包後的 JS 含有 </script，需要轉義");

const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<title>Vigil · 簽名前檢查</title>
<style>
${css}
</style>
</head>
<body>
<div id="root"></div>
<script type="module">
${js}
</script>
</body>
</html>
`;

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html, "utf-8");

const kb = (Buffer.byteLength(html, "utf8") / 1024).toFixed(1);
console.log(`wrote panel/index.html (${kb} KB, self-contained)`);
console.log(
  SIGN_PAGE_URL === ""
    ? "  簽名頁位置：執行時由 MCP server 決定（正常情況）"
    : `  簽名頁後備網址：${SIGN_PAGE_URL}`,
);
