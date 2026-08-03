/**
 * 產一個真的交接網址，用來驗簽名頁。
 *
 * 交易來自對 Monad 主網的實際模擬，不是手寫的，所以這串網址跟面板按下去
 * 開出來的那串是同一種東西。
 *
 * 跑法：pnpm handoff-url [base] [--tamper|--tamper-recompute]
 *   base      預設本機靜態伺服器，要驗部署版就傳部署網址。
 *   --tamper  把收款地址換成別人的、指紋沿用原本的，模擬有人動了這串網址。
 *             簽名頁的自洽檢查應該擋下來，不是照著顯示。
 *   --tamper-recompute
 *             更強的攻擊者：換了交易、連指紋一起重算。自動檢查會通過——
 *             這是設計邊界（hash 不是 MAC）。抓它的是人工比對：簽名頁顯示
 *             的指紋跟面板顯示的不一樣。
 */

import { getAddress } from "viem";
import { encodeHandoff, fingerprintOf, handoffUrl, MONAD_CHAIN_ID } from "../src/handoff.js";
import { previewTransaction } from "../src/pipeline.js";

const args = process.argv.slice(2);
const tamper = args.includes("--tamper");
const tamperRecompute = args.includes("--tamper-recompute");
const base = args.find((a) => !a.startsWith("--")) ?? "http://localhost:8791/sign/index.html";

// 手抄 checksum 錯過三次，一律過 getAddress。
// 預設地址主網上只有 0.001 MON，付不起，所以會擋在餘額檢查 —— 那是對的行為。
// 要產得出交接網址就設 DEMO_ACCOUNT 指到有錢的地址。
const ACCOUNT = getAddress(
  process.env.DEMO_ACCOUNT ?? "0xcccccccccccccccccccccccccccccccccccccccc",
);

const { view } = await previewTransaction({
  account: ACCOUNT,
  protocol: "shmonad",
  method: "stake",
  params: { amount: "0.25", receiver: ACCOUNT },
  statedRequest: "幫我質押 0.25 MON",
});

if (!view.signable) {
  console.error(`模擬結果不可簽名（${view.verdict.kind}），產不出交接網址`);
  process.exit(1);
}

const payload = {
  chainId: MONAD_CHAIN_ID,
  transactions: view.transactions,
  summary: view.intent?.text ?? "這筆交易",
  fingerprint: view.fingerprint,
};

if (tamper || tamperRecompute) {
  const thief = getAddress("0x9f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b");
  const first = view.transactions[0];
  if (first === undefined) throw new Error("沒有交易可以動手腳");
  const forgedTxs = [{ ...first, to: thief }];
  console.log(`原本收款  ${first.to}`);
  console.log(`改成收款  ${thief}`);
  if (tamperRecompute) {
    // 攻擊者換了交易、連指紋一起重算。自動檢查會通過，抓它的是人工比對。
    const forged = {
      ...payload,
      transactions: forgedTxs,
      fingerprint: fingerprintOf(forgedTxs, MONAD_CHAIN_ID),
    };
    console.log(`面板指紋  ${payload.fingerprint}（使用者在面板上看到的）`);
    console.log(`網址指紋  ${forged.fingerprint}（簽名頁會顯示這串，自動檢查會通過）`);
    console.log(`兩串不同——這條路自動檢查擋不住，靠的是人對照上面兩串`);
    console.log(`\n${base}#${encodeHandoff(forged)}`);
  } else {
    // 攻擊者換了交易但沿用原本的指紋，自洽檢查會直接擋下
    const forged = { ...payload, transactions: forgedTxs };
    console.log(`沿用指紋  ${payload.fingerprint}`);
    console.log(`真實指紋  ${fingerprintOf(forgedTxs, MONAD_CHAIN_ID)}`);
    console.log(`\n${base}#${encodeHandoff(forged)}`);
  }
} else {
  const url = handoffUrl(base, payload);
  console.log(`指紋      ${view.fingerprint}`);
  console.log(`筆數      ${view.transactions.length}`);
  console.log(`重算一致  ${fingerprintOf(view.transactions, MONAD_CHAIN_ID) === view.fingerprint}`);
  console.log(`長度      ${url.length}`);
  console.log(url);
}
