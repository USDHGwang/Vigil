/**
 * 產生預覽頁 mock/index.html。
 *
 * 情境資料優先跑真實主網模擬；跑不到（沒網路之類）就退回備好的 fixture，
 * 並在頁面上標明哪一筆是真的、哪一筆不是。不讓人誤以為看到的是真資料。
 *
 * 跑法：pnpm build:mock
 */

import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { EvidencePanelView } from "../src/contract.js";
import { allFixtures } from "../src/fixtures.js";
import { previewTransaction, type SimulateRequest } from "../src/pipeline.js";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * 模擬用的帳戶。
 *
 * 預設這個地址在主網上只有 0.001 MON，付不起任何一筆交易，所以「質押」情境
 * 會跑成「餘額不夠、不能簽」。那是真話，不是壞掉。
 *
 * 要看正常通過的樣子，設 DEMO_ACCOUNT 指到一個真的有 MON 的地址：
 *   DEMO_ACCOUNT=0x… pnpm build:mock
 */
const ACCOUNT = (process.env.DEMO_ACCOUNT ?? "0xcccccccccccccccccccccccccccccccccccccccc") as
  `0x${string}`;

interface Scenario {
  label: string;
  live: boolean;
  view: EvidencePanelView;
}

/** 這些能對主網跑出真結果 */
const LIVE_CASES: { key: string; label: string; request: SimulateRequest }[] = [
  {
    key: "liveStake",
    label: "質押（真實模擬）",
    request: {
      account: ACCOUNT,
      protocol: "shmonad",
      method: "stake",
      params: { amount: "0.25", receiver: ACCOUNT },
      statedRequest: "幫我質押 0.25 MON",
    },
  },
  {
    key: "liveBlocked",
    label: "模擬失敗（真實）",
    request: {
      account: ACCOUNT,
      protocol: "shmonad",
      method: "unstake",
      params: { shares: "1", receiver: ACCOUNT, owner: ACCOUNT },
      statedRequest: "幫我贖回 1 shMON",
    },
  },
];

/** 這幾種現場產不出來（需要真的惡意交易），用備好的資料呈現 */
const FIXTURE_CASES: { key: keyof typeof allFixtures; label: string }[] = [
  { key: "approveMismatch", label: "無上限授權（不一致）" },
  { key: "operatorApprovalMismatch", label: "整批交出 NFT 系列（不一致）" },
  { key: "unstakePartial", label: "贖回（部分不符）" },
  { key: "blockedByBalance", label: "餘額不夠（有效果但不能簽）" },
  { key: "noAdapterModeB", label: "無解讀模組" },
];

const scenarios: Record<string, Scenario> = {};

for (const item of LIVE_CASES) {
  try {
    const result = await previewTransaction(item.request);
    scenarios[item.key] = { label: item.label, live: true, view: result.view };
    console.log(`  live  ${item.key}: ${result.view.verdict.kind}`);
  } catch (error) {
    console.log(`  SKIP  ${item.key}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

for (const item of FIXTURE_CASES) {
  scenarios[item.key] = { label: item.label, live: false, view: allFixtures[item.key] };
}

const bundled = await build({
  entryPoints: [`${here}/../src/panel/mock-entry.ts`],
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

const css = readFileSync(`${here}/../src/panel/styles.css`, "utf-8");
const data = JSON.stringify(scenarios);
if (data.includes("</script") || js.includes("</script")) {
  throw new Error("內容會提早關掉 script 標籤，需要轉義");
}

const html = `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<title>Vigil · 情境預覽</title>
<style>
${css}

/* 預覽頁專用，不是產品的一部分 */
body { padding: 20px 16px 56px; }
.harness {
  display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
  max-width: 560px; margin: 0 auto 10px;
}
.harness .tag {
  font-size: 10.5px; letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--text-3); margin-right: 4px;
}
.harness button {
  font: inherit; font-size: 12.5px; padding: 4px 10px;
  border: 1px solid var(--line); background: var(--surface);
  color: var(--text-2); border-radius: var(--r); cursor: pointer;
  transition: transform 140ms var(--ease-out), border-color 140ms ease;
}
.harness button:active { transform: scale(0.97); }
.harness button[aria-pressed="true"] {
  background: var(--accent); border-color: var(--accent); color: var(--on-accent);
}
.provenance {
  max-width: 560px; margin: 0 auto 12px;
  font-size: 11.5px; color: var(--text-3);
}
</style>
</head>
<body>
<div id="root"></div>
<script>window.__SCENARIOS__ = ${data};</script>
<script type="module">
${js}
</script>
</body>
</html>
`;

const outPath = `${here}/../mock/index.html`;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, html, "utf-8");

// 給 v0 / Bolt 這類工具當輸入用的純資料
writeFileSync(
  `${here}/../fixtures.json`,
  `${JSON.stringify(
    Object.fromEntries(Object.entries(scenarios).map(([k, s]) => [k, s.view])),
    null,
    2,
  )}\n`,
  "utf-8",
);

const liveCount = Object.values(scenarios).filter((s) => s.live).length;
console.log(
  `wrote mock/index.html (${(Buffer.byteLength(html, "utf8") / 1024).toFixed(1)} KB, ` +
    `${liveCount} live / ${Object.keys(scenarios).length - liveCount} fixture)`,
);
