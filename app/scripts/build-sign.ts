/**
 * 打包簽名頁成單一自包含 HTML。
 *
 * 跑法：pnpm build:sign
 *
 * 產出的 sign/index.html 是純靜態，沒有後端。丟到任何能放靜態檔的地方就能用，
 * 交易資料從網址的 `#` 後面讀，不會送到伺服器。
 */

import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const bundled = await build({
  entryPoints: [`${here}/../src/sign/main.ts`],
  bundle: true,
  format: "iife",
  target: "es2022",
  platform: "browser",
  write: false,
  minify: true,
  legalComments: "none",
});

const js = bundled.outputFiles?.[0]?.text;
if (js === undefined) throw new Error("esbuild 沒有產出內容");
if (js.includes("</script")) throw new Error("打包後的 JS 含有 </script，需要轉義");

const css = readFileSync(`${here}/../src/sign/styles.css`, "utf-8");

const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="referrer" content="no-referrer">
<title>簽名前最後一步</title>
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

const outPath = `${here}/../sign/index.html`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html, "utf-8");
console.log(`wrote sign/index.html (${(Buffer.byteLength(html, "utf8") / 1024).toFixed(1)} KB)`);
