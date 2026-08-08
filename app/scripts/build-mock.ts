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
    label: "Stake (live sim)",
    request: {
      account: ACCOUNT,
      protocol: "shmonad",
      method: "stake",
      params: { amount: "0.25", receiver: ACCOUNT },
      statedRequest: "Stake 0.25 MON",
    },
  },
  {
    key: "liveBlocked",
    label: "Simulation failed (live)",
    request: {
      account: ACCOUNT,
      protocol: "shmonad",
      method: "unstake",
      params: { shares: "1", receiver: ACCOUNT, owner: ACCOUNT },
      statedRequest: "Unstake 1 shMON",
    },
  },
];

/** 這幾種現場產不出來（需要真的惡意交易），用備好的資料呈現 */
const FIXTURE_CASES: { key: keyof typeof allFixtures; label: string }[] = [
  { key: "approveMismatch", label: "Unlimited approval (mismatch)" },
  { key: "operatorApprovalMismatch", label: "Batch NFT grant (mismatch)" },
  { key: "unstakePartial", label: "Unstake (partial)" },
  { key: "blockedByBalance", label: "Insufficient balance (blocked)" },
  { key: "noAdapterModeB", label: "No decoder" },
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

/**
 * mock 是設計檢視工具，一律用英文展示（demo 畫面）。
 * fixtures 的文案是 zh-TW（它是 zh 渲染的測試資料支柱，不能動），
 * 所以在建置層做一份 mock 專用英文化——只改展示欄位，不碰產品。
 */
function translateForMock(view: EvidencePanelView): EvidencePanelView {
  const v: EvidencePanelView = { ...view, locale: "en" };
  if (v.intent !== null) {
    v.intent = { ...v.intent, text: EN[v.intent.text] ?? v.intent.text };
  }
  if (v.verdict.kind === "partial") {
    v.verdict = { ...v.verdict, reason: EN[v.verdict.reason] ?? v.verdict.reason };
  }
  if (v.verdict.kind === "mismatch") {
    v.verdict = { ...v.verdict, conflicts: v.verdict.conflicts.map((c) => EN[c] ?? c) };
  }
  if (v.verdict.kind === "blocked") {
    v.verdict = { ...v.verdict, warnings: v.verdict.warnings.map((w) => ({ ...w, message: EN[w.message] ?? w.message })) };
  }
  return v;
}

/** fixtures 中文文案 → mock 英文展示 */
const EN: Record<string, string> = {
  "幫我質押 0.25 MON": "Stake 0.25 MON",
  "幫我質押 10 MON": "Stake 10 MON",
  "幫我贖回 1 shMON": "Unstake 1 shMON",
  "幫我贖回 5 shMON": "Unstake 5 shMON",
  "把那個 NFT 轉去我另一個錢包": "Move that NFT to my other wallet",
  "這筆交易不會讓 MON 現在回到你的帳戶，贖回要等協議的解鎖流程走完":
    "MON doesn't come back to your account in this transaction — unstaking waits for the protocol's unlock flow",
  "沒有任何 MON 被質押": "No MON gets staked",
  "多出一筆無上限授權給 0x9F2c…a41b，它不是這個操作指定的對象":
    "An unlimited approval to 0x9F2c…a41b — not the account this operation targets",
  "多出一筆整批授權：0x9F2c…a41b 可以轉走你在 0x5C7d…1C3e 這個系列裡的每一個，它不是這個操作指定的對象":
    "A collection-wide grant: 0x9F2c…a41b can move every token you hold in 0x5C7d…1C3e — not the account this operation targets",
  "餘額不夠。你有 ~9.087640 MON，這筆需要 ~10.015862 MON（其中約 ~0.015862 MON 是手續費）,差 ~0.928222 MON。照這樣送出去會失敗，手續費照樣扣。":
    "Insufficient balance. You have ~9.087640 MON, this needs ~10.015862 MON (about ~0.015862 MON in gas), short by ~0.928222 MON. Sending it as-is will fail and the gas is still charged.",
};

for (const item of FIXTURE_CASES) {
  scenarios[item.key] = { label: item.label, live: false, view: translateForMock(allFixtures[item.key]) };
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
