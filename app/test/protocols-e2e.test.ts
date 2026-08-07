/**
 * 全 protocol 流暢度驗證（對 Monad 主網實跑）。
 *
 * 目標：discover 列出的每個 capability 都真的能從「準備參數」走到「完整面板」，
 * 不會在過程中爆原生例外或吐開發者訊息。verdict 是 match / partial / blocked
 * 都算系統正常回應——「流暢」的定義是每個輸入都有合理、可讀、en 的面板。
 *
 * 帳戶策略：全用 DEMO（0x0829…，真實餘額：質押過 0.25 MON、持有 ~0.156 shMON）。
 * 注意：模擬器的 prefund 百萬 MON 只在 trace 內部生效，affordability 檢查用的是
 * 真實餘額——所以成功路徑必須靠真實資產，金額壓小（wrap/swap 用 0.05）。
 *
 * 已知的 revert 路徑（測「失敗也流暢」）：
 *   - wmon.unwrap：沒有 WMON 可換回
 *   - erc20.transfer：帳戶沒有 USDC
 *   - erc721/erc1155.transfer / erc1155.approve：沒有確定的 NFT 合約地址可測，
 *     用 shMONAD 當 collection（它不是 NFT 標準，呼叫會 revert——驗證的是錯誤
 *     呈現，不是成功路徑）
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeAll, describe, expect, it } from "vitest";
import type { EvidencePanelView } from "../src/contract.js";
import { assertViewInvariants } from "../src/contract.js";
import { createServer } from "../src/mcp/server.js";

const DEMO = "0x08299d244c21bee544808c911fd3dea59051ecc0";
const DEFAULT = "0xcccccccccccccccccccccccccccccccccccccccc";
const STRANGER = "0x9f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b";
/** 主網原生 USDC（Circle 官方 + Kuru docs 確認；fixtures 的 0xf817… 是假地址，不是合約） */
const USDC = "0x754704Bc059F8C67012fEd69BC8A327a5aafb603";
/** shMONAD 主網地址（不是 NFT，故意拿來測 revert 路徑） */
const SHMONAD = "0x1b68626dca36c7fe922fd2d55e4f631d962de19c";

interface Case {
  name: string;
  protocol: string;
  method: string;
  params: Record<string, unknown>;
}

const CASES: Case[] = [
  {
    name: "shmonad.stake（demo 主線）",
    protocol: "shmonad",
    method: "stake",
    params: { amount: "0.25" },
  },
  {
    name: "shmonad.unstake",
    protocol: "shmonad",
    method: "unstake",
    params: { shares: "0.1", owner: DEMO },
  },
  {
    name: "wmon.wrap（小額，真實 MON）",
    protocol: "wmon",
    method: "wrap",
    params: { amount: "0.05" },
  },
  {
    name: "wmon.unwrap（無 WMON → revert 路徑）",
    protocol: "wmon",
    method: "unwrap",
    params: { amount: "0.05" },
  },
  {
    name: "erc20.approve（不需持有，只付 gas）",
    protocol: "erc20",
    method: "approve",
    params: { token: USDC, spender: STRANGER, amount: "100" },
  },
  {
    name: "erc20.transfer（無 USDC → revert 路徑）",
    protocol: "erc20",
    method: "transfer",
    params: { token: USDC, to: STRANGER, amount: "1" },
  },
  {
    name: "erc721.transfer（非 721 合約 → revert 路徑）",
    protocol: "erc721",
    method: "transfer",
    params: { collection: SHMONAD, tokenId: "1", to: STRANGER },
  },
  {
    name: "erc1155.transfer（非 1155 合約 → revert 路徑）",
    protocol: "erc1155",
    method: "transfer",
    params: { collection: SHMONAD, tokenId: "1", amount: "1", to: STRANGER },
  },
  {
    name: "erc1155.approve（非 1155 合約 → revert 路徑）",
    protocol: "erc1155",
    method: "approve",
    params: { collection: SHMONAD, operator: STRANGER, approved: true },
  },
  {
    // ⚠️ 金額要夠大：小額（<1 MON）成交走訂單簿，會觸發 Moss 不認得的
    // FlipOrderUpdated → RECEIPT_FAILED blocked（vendor 限制，8/8 實測確認）。
    // 1 MON 以上走 AMM 路徑只發 Trade → 可簽名。
    name: "kuru.swap（native→USDC，1 MON 走 AMM 路徑）",
    protocol: "kuru",
    method: "swap",
    params: { tokenIn: "native", tokenOut: USDC, amountIn: "1" },
  },
];

let client: Client;

beforeAll(async () => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({ signPageUrl: "http://127.0.0.1:65000/sign" });
  client = new Client({ name: "protocols-e2e", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
});

describe.skipIf(!!process.env.MOSS_SKIP_E2E)("全 protocol 流暢度（對主網實跑）", () => {
  it("discover 列的每個 capability 都有流暢的預覽", { timeout: 600_000 }, async () => {
    const results: { name: string; verdict: string; signable: boolean; err?: string }[] = [];

    for (const c of CASES) {
      const result = await client.callTool({
        name: "preview_transaction",
        arguments: {
          locale: "en",
          statedRequest: `run ${c.protocol}.${c.method} for flow check`,
          protocol: c.protocol,
          method: c.method,
          params: c.params,
          account: DEMO,
        },
      });

      if (result.isError) {
        // 錯誤也要是可讀的產品訊息，不是原生例外
        const text = JSON.stringify(result.content);
        expect(text).not.toMatch(/InvalidAddressError|viem|TypeError|Error: /);
        results.push({ name: c.name, verdict: "error", signable: false, err: text.slice(0, 120) });
        continue;
      }

      const view = result.structuredContent as { view?: EvidencePanelView } | undefined;
      const vv = view?.view;
      expect(vv, `${c.name}: 沒有 view`).toBeDefined();
      const v: EvidencePanelView = vv!;
      expect(() => assertViewInvariants(v), `${c.name}: invariants`).not.toThrow();

      // en 面板：不能混中文
      const text = JSON.stringify(result.content);
      expect(text, `${c.name}: en 混中文`).not.toMatch(/[\u4e00-\u9fff]/);

      results.push({ name: c.name, verdict: v.verdict.kind, signable: v.signable });
    }

    // 統計摘要（測試本身斷言的是上面逐筆的流暢；這裡列出讓 CI log 可讀）
    const byVerdict = new Map<string, number>();
    for (const r of results) byVerdict.set(r.verdict, (byVerdict.get(r.verdict) ?? 0) + 1);
    const summary = [...byVerdict.entries()]
      .map(([k, n]) => `${k}: ${n}`)
      .join(", ");
    console.log(`\n[protocols-e2e] ${results.length} capabilities — ${summary}`);
    for (const r of results) {
      console.log(
        `[protocols-e2e]   ${r.name.padEnd(40)} ${r.verdict.padEnd(8)} signable=${r.signable}${r.err ? ` err=${r.err}` : ""}`,
      );
    }
  });
});
