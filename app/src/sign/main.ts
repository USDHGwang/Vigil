/**
 * 簽名頁。面板把使用者核准過的那筆交易交到這裡，由使用者自己的錢包簽。
 *
 * 為什麼是一個獨立的頁面：MCP App 的 iframe 是 sandbox，碰不到
 * `window.ethereum`。面板用 openLink 把這頁開起來，交易放在網址的 `#` 後面。
 *
 * fragment 不會被瀏覽器送進 HTTP 請求，所以交易內容不會到託管這頁的伺服器上。
 *
 * 這頁再顯示一次交易與指紋，讓使用者對照面板上看到的。指紋對得上，代表中間
 * 沒有被換過。
 *
 * 已經連過錢包就直接觸發，不再多要一次點擊 —— 整條路變成「面板按一下、錢包
 * 確認一下」，跟一般 dapp 一樣兩步。
 */

import { decodeHandoff, type HandoffPayload, MONAD_CHAIN_ID } from "../handoff.js";
import { t, type Locale } from "../panel/i18n.js";
import {
  accountMatches,
  canAutoStart,
  type Phase,
  renderCard,
  renderFailure,
} from "./view.js";

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider;
  }
}

const root = document.getElementById("root");
if (root === null) throw new Error("找不到 #root");

const chainHex = `0x${MONAD_CHAIN_ID.toString(16)}`;
let provider: Eip1193Provider | undefined;
let payload: HandoffPayload | undefined;

/**
 * 每次讀入新的交接就加一。
 *
 * 只改 `#` 不會重新載入文件，所以同一個分頁可能連續收到兩筆交接。飛在半空中的
 * 前一筆回來時不能蓋掉新的畫面，否則使用者會看到 A 的結果配 B 的交易。
 */
let generation = 0;

function paint(phase: Phase, at: number = generation): void {
  if (root === null || at !== generation || payload === undefined) return;
  const locale: Locale = payload.locale ?? "zh-TW";
  document.title = t(locale, "sign_title");
  root.innerHTML = renderCard(payload, phase, locale);
  document.getElementById("go")?.addEventListener("click", () => void send());
}

/**
 * 錢包擴充是非同步注入的，頁面剛載入時 `window.ethereum` 可能還不在。
 * 直接判定「沒有錢包」會是誤報，所以等一下它的初始化事件。
 */
function waitForProvider(timeoutMs = 1500): Promise<Eip1193Provider | undefined> {
  if (window.ethereum !== undefined) return Promise.resolve(window.ethereum);
  return new Promise((resolve) => {
    const done = (): void => {
      clearTimeout(timer);
      window.removeEventListener("ethereum#initialized", done);
      resolve(window.ethereum);
    };
    const timer = setTimeout(done, timeoutMs);
    window.addEventListener("ethereum#initialized", done, { once: true });
  });
}

async function send(): Promise<void> {
  const at = generation;
  const current = payload;
  if (current === undefined) return;
  if (provider === undefined) {
    paint({ kind: "noWallet" }, at);
    return;
  }

  paint({ kind: "waiting" }, at);
  try {
    const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];

    // 連完再比一次。使用者可能剛剛才在錢包裡切了帳戶，或這一頁是舊的交接。
    const expected = current.transactions[0]?.from ?? "";
    if (!accountMatches(current, accounts)) {
      paint({ kind: "wrongAccount", connected: accounts[0] ?? t(current.locale ?? "zh-TW", "sign_none"), expected }, at);
      return;
    }

    const chain = (await provider.request({ method: "eth_chainId" })) as string;
    if (chain.toLowerCase() !== chainHex) {
      // 換到 Monad。沒加過這條鏈的話錢包會自己問要不要加。
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainHex }],
      });
    }

    // 從 send 進來時抓住的那一份取交易，不重讀 payload：
    // 中途換了交接就不該把舊的送出去。
    const tx = current.transactions[0];
    if (tx === undefined) throw new Error("沒有交易可以送");
    if (at !== generation) return;

    const hash = (await provider.request({
      method: "eth_sendTransaction",
      params: [{ from: tx.from, to: tx.to, data: tx.data, value: tx.value }],
    })) as string;

    paint({ kind: "sent", hash }, at);
  } catch (error) {
    paint({ kind: "failed", message: error instanceof Error ? error.message : String(error) }, at);
  }
}

async function boot(at: number): Promise<void> {
  provider = await waitForProvider();
  if (at !== generation) return;
  if (provider === undefined) {
    paint({ kind: "noWallet" }, at);
    return;
  }

  let accounts: string[] = [];
  try {
    // eth_accounts 不跳窗也不需要 user gesture，拿來判斷這個網站連過沒有
    const result = await provider.request({ method: "eth_accounts" });
    if (Array.isArray(result)) accounts = result as string[];
  } catch {
    // 問不到就當作沒連過，退回按鈕，不要卡在「檢查錢包」
  }

  if (at !== generation || payload === undefined) return;

  // 已經連了但帳戶不是這筆的發起人 —— 現在就講，不要等使用者按下去才發現
  if (accounts.length > 0 && !accountMatches(payload, accounts)) {
    paint(
      {
        kind: "wrongAccount",
        connected: accounts[0] ?? t(payload.locale ?? "zh-TW", "sign_none"),
        expected: payload.transactions[0]?.from ?? "",
      },
      at,
    );
    return;
  }

  if (canAutoStart(payload, accounts.length > 0)) {
    await send();
    return;
  }
  paint({ kind: "connect" }, at);
}

/**
 * 從網址讀入交接。
 *
 * 也掛在 hashchange 上：面板第二次交接時瀏覽器可能重用同一個分頁，
 * 只換 `#` 不重新載入文件。不重讀的話畫面會停在上一筆，簽出去的也是上一筆。
 */
function load(): void {
  generation += 1;
  const at = generation;
  try {
    const fragment = location.hash.slice(1);
    if (fragment === "") throw new Error("網址裡沒有交易資料。這一頁要從面板開啟。");
    payload = decodeHandoff(fragment);
    // paint 也放進 try：它會走 formatValue（BigInt）與 calldata 解碼，兩者都吃
    // 網址裡的值。丟在外面的話一個畸形 payload 會讓整頁變白，連 renderFailure
    // 都跑不到——使用者看到的是「壞了」而不是「這串網址有問題」。
    paint({ kind: "checking" }, at);
  } catch (error) {
    payload = undefined;
    if (root !== null) {
      root.innerHTML = renderFailure(error instanceof Error ? error.message : String(error));
    }
    return;
  }
  void boot(at);
}

window.addEventListener("hashchange", load);
load();
