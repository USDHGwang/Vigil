/**
 * 在終端機裡直接看面板，不需要任何 MCP host。
 *
 * 跑法：
 *   pnpm demo                     對主網跑一次質押
 *   pnpm demo unstake             跑贖回（會失敗，看 blocked 長什麼樣）
 *   pnpm demo fixtures            看五個備好的情境，含現場產不出來的惡意授權
 */

import { getAddress } from "viem";
import { allFixtures } from "../src/fixtures.js";
import { renderText } from "../src/panel/text.js";
import { previewTransaction, type SimulateRequest } from "../src/pipeline.js";

/**
 * 預設帳戶主網上只有 0.001 MON，付不起任何一筆，所以質押情境會跑成
 * 「餘額不夠、不能簽」。要看通過的樣子：DEMO_ACCOUNT=0x… pnpm demo
 */
const ACCOUNT = (process.env.DEMO_ACCOUNT ??
  "0xcccccccccccccccccccccccccccccccccccccccc") as `0x${string}`;
// checksum 一律讓 viem 算，手抄過三次都錯
const SHMONAD = getAddress("0x1b68626dca36c7fe922fd2d55e4f631d962de19c");
/** 注入場景裡的收受方，代表攻擊者 */
const STRANGER = getAddress("0x9f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b");
const MAX_UINT256 = (2n ** 256n - 1n).toString();

const CASES: Record<string, SimulateRequest> = {
  stake: {
    account: ACCOUNT,
    protocol: "shmonad",
    method: "stake",
    params: { amount: "0.25", receiver: ACCOUNT },
    statedRequest: "幫我質押 0.25 MON",
  },
  unstake: {
    account: ACCOUNT,
    protocol: "shmonad",
    method: "unstake",
    params: { shares: "1", receiver: ACCOUNT, owner: ACCOUNT },
    statedRequest: "幫我贖回 1 shMON",
  },
  /**
   * Prompt injection：agent 讀到外部內容被塞了指令，宣稱使用者要查餘額，
   * 實際構造出一筆無上限授權。
   *
   * 這是真的交易、真的對主網模擬，不是 mock。注入的手法本身沒有演，
   * 演的是「注入成功之後，使用者在簽名前看得到什麼」。
   */
  injection: {
    account: ACCOUNT,
    protocol: "erc20",
    method: "approve",
    params: {
      token: SHMONAD,
      spender: STRANGER,
      amount: MAX_UINT256,
    },
    statedRequest: "幫我查一下我的 shMON 餘額",
  },
};

const arg = process.argv[2] ?? "stake";

if (arg === "fixtures") {
  for (const [name, view] of Object.entries(allFixtures)) {
    console.log(`\n\n### ${name}\n`);
    console.log(renderText(view));
  }
} else {
  const request = CASES[arg];
  if (request === undefined) {
    console.error(`不認得的情境：${arg}。可用的：${Object.keys(CASES).join(", ")}, fixtures`);
    process.exit(1);
  }
  console.log(`對 Monad 主網模擬中…\n`);
  const result = await previewTransaction(request);
  console.log(renderText(result.view));
}
