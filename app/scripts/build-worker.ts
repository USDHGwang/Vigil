/**
 * Workers bundle：esbuild 把 worker.ts 打包成單一檔案（含內嵌的
 * panel/sign HTML），輸出到 dist/worker.js 給 wrangler 用。
 *
 * .html 用 text loader 內嵌成字串（Workers 沒有 fs，讀不了 runtime 檔案）。
 */

import { build } from "esbuild";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** 處理 `?raw` 字串 import（worker.ts 用 vitest 相容語法；esbuild 側補上） */
const rawHtml = {
  name: "raw-html",
  setup(b: import("esbuild").PluginBuild) {
    b.onResolve({ filter: /\.html\?raw$/ }, (args) => ({
      // onResolve 不能回 resolveDir——自己用 args.resolveDir 解成絕對路徑
      path: resolve(args.resolveDir, args.path.replace(/\?raw$/, "")),
      namespace: "rawhtml",
    }));
    b.onLoad({ filter: /.*/, namespace: "rawhtml" }, async (args) => ({
      contents: await readFile(args.path, "utf-8"),
      loader: "text",
    }));
  },
};

await build({
  entryPoints: [`${here}/../src/mcp/worker.ts`],
  outfile: `${here}/../dist/worker.js`,
  bundle: true,
  format: "esm",
  target: "es2022",
  platform: "browser",
  // node:* 由 Workers 的 nodejs_compat 提供（readPanelHtml 在 Workers 模式
  // 不會被呼叫——panelHtml 由 options 注入），esbuild 不用打包它們
  external: ["node:*"],
  plugins: [rawHtml],
  legalComments: "none",
  logLevel: "info",
});
console.log("wrote dist/worker.js (Workers bundle)");
