<!--
  badge 的 OWNER/REPO 要換成實際的 GitHub 位置。
  這裡先填最可能的 USDHGwang/vigil，repo 名不同就改這兩行。
  推上去之前 CI badge 會顯示 "not found"，那是正常的。
-->

# Vigil

[![CI](https://github.com/USDHGwang/vigil/actions/workflows/ci.yml/badge.svg)](https://github.com/USDHGwang/vigil/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Monad](https://img.shields.io/badge/Monad-mainnet%20143-6E54FF)](https://www.monad.xyz/)
[![MCP](https://img.shields.io/badge/MCP-Apps-000000)](https://modelcontextprotocol.io/)

[English](README.md) | **繁體中文**

[**安裝**](app/MCP-SETUP.md) · [**設計簡報**](app/DESIGN-BRIEF.md)

> 拉丁文 *vigil*：守夜人。看見、回報，不替你決定。

AI agent 幫你在 Monad 上執行鏈上操作。**簽名之前，在同一個對話裡看到這筆交易實際會做什麼。**

證據由 Monad 節點模擬執行產生，構造那筆交易的 agent 碰不到它的內容。

## 長這樣

一筆正常的質押：

```
Vigil · 簽名前檢查 · 證據來自 Monad 主網模擬，不是來自準備這筆交易的程式
──────────────────────────────────────────────────────────────────────────
agent 說你要求的
  幫我質押 10 MON
  amount    10
  receiver  你自己

✓  沒有發現意料外的動作

鏈上會發生的
  支出    你支出 10 MON
  取得    你取得 9.87 shMON（新鑄出的）
  事件    協議記錄這筆質押：10 MON 換 9.87 shMON
──────────────────────────────────────────────────────────────────────────
機器只驗了交易與這個操作相符。你說的話對不對得上，要你自己看上面兩段。
要簽的話，簽名在你自己的錢包裡完成，這個工具碰不到你的私鑰。
```

同樣一句話，但 agent 被注入了指令：

```
agent 說你要求的
  幫我質押 10 MON

══════════════════════════════════════════════════════════════════════════
✗  交易內容跟這個操作對不上
   · 沒有任何 MON 被質押
   · 多出一筆無上限授權給 0x9F2c…a41b，你要求的操作不需要授權
══════════════════════════════════════════════════════════════════════════

鏈上會發生的
  授權    授權 0x9F2c…a41b 動用你的 USDC，沒有上限
──────────────────────────────────────────────────────────────────────────
這筆不能簽。
```

**不需要任何 LLM 判斷。** 意圖錨在使用者的話，效果來自節點，對不上就會被看見。

支援 MCP Apps 的 host（Claude Desktop、claude.ai）渲染成圖形面板；CLI agent
（Claude Code、Codex）拿到的就是上面這份文字。**兩者內容一致，不是降級版。**

---

## 問題

使用者叫 agent 幫他在鏈上做事。從他講完話到一筆交易出現，中間發生什麼他看不到。他能拿到的唯一線索是 agent 自己的轉述，而 agent 就是構造那筆交易的一方。

構造方的 bug、被注入的指令、或單純的誤解，會原樣進入那句轉述，讀起來毫無異狀。使用者手上只有一個動作：簽，或不簽。簽了不可逆。

兩個佐證：

- 2025-02 Bybit 損失約 15 億美元。攻擊者竄改 Safe 錢包的網頁前端，簽名者畫面上是正常轉帳，實際簽出的交易改掉了錢包控制權（[NCC Group](https://www.nccgroup.com/research/in-depth-technical-analysis-of-the-bybit-hack/)、[BlockSec](https://blocksecteam.medium.com/bybit-1-5b-hack-in-depth-analysis-of-the-malicious-safe-wallet-upgrade-attack-2b82e37d4d28)）。簽名的是專業人員。
- [Scam Sniffer 2024 年報](https://drops.scamsniffer.io/scam-sniffer-2024-web3-phishing-attacks-wallet-drainers-drain-494-million/)：wallet drainer 一年捲走約 4.94 億美元，33.2 萬個地址受害。

自己開 dapp 網頁手動操作的人不在此列。dapp 前端會顯示預期結果，那個情境不需要這個工具。

## 為什麼錢包補不了

錢包在 `eth_sendTransaction` 只拿得到 `to / from / value / data / gas`。使用者說了什麼、agent 打算做什麼，錢包看不到。

2026-07 查證七家錢包（MetaMask、Rabby、Phantom、Coinbase、Trust、OKX、Backpack），全部是「模擬 calldata 的資產變動 + 比對風險資料庫」，沒有一家做「使用者要什麼」對「交易做什麼」的比對。不是不想做，是結構上沒有那個輸入。

ERC-7730 的 clear signing 解的是「看不看得懂」，它的 intent 是靜態的 per-function 描述，由建構方標註，不是這個人這一次要什麼。

## 現有玩家停在哪

| | 靜態規則 | 惡意模式庫 | 使用者當下的意圖 |
|---|---|---|---|
| **簽名前** | Fireblocks、Turnkey、Privy、Dfns、BitGo、MoonPay PayBox、Crossmint | MetaMask+Blockaid、Phantom+Blowfish、Coinbase、Trust、Rabby、Hexagate、MetaMask Agent Wallet | **空的** |
| **執行後** | — | — | Cobo Argus `postExecCheck`、MetaMask Advanced Permissions |

零件都存在，沒有人在簽名前這一格組起來。

**而這一格正在變得更重要。** MetaMask Advanced Permissions（ERC-7715）已經在 Monad
主網[上線](https://docs.metamask.io/smart-accounts-kit/get-started/supported-networks/)：使用者授權一次之後，agent 執行時**不再有錢包彈窗**。
彈窗一消失，人就再也看不到每一筆在做什麼。那個洞正是這個面板站的位置。

## 做法

```
① 你講了一句話   agent 轉述它、呼叫 preview_transaction。
                 那句轉述是未經驗證的輸入
        ↓
② 建交易         Moss 建出未簽交易。
                 構造它的那一方，我們一樣假設它可能出錯
        ↓
③ 模擬           debug_traceCall 打 Monad 主網。
                 不上鏈、不花 gas、不用簽名
        ↓
④ 查核與比對     覆蓋檢查（不漏、不重、不捏造）
                 · 五條結構規則 · 真實餘額檢查 · 人話轉換
        ↓
⑤ 你自己比       面板把「agent 說你要求的」與「鏈上會發生的」並排
        ↓
⑥ 你決定         面板直送簽名頁，不繞回 agent。
                 兩頁顯示同一串指紋，錢包還會比對帳戶
```

⑤ 是人的工作不是機器的。**④ 比的是「交易」對「agent 呼叫的操作」，不是對「使用者說的那句話」。**
這是兩個不同的宣稱，只有前者機器驗得了，見下面的[兩層比對](#兩層比對)。

支援 MCP Apps 的 host 把 ⑤ 渲染成面板；CLI agent 拿到內容等價的文字面板。

④ 裡面的 `verifyReceiptCoverage` 是完整性檢查，不是意圖比對：它驗報告與原始變動一一對應，
數量相等且逐筆做物件身分比對，防漏、防重複、防捏造。意圖比對是下面那五條規則。

### 兩層比對

| 層 | 誰做 | 抓什麼 |
|---|---|---|
| 結構 | 機器，確定性 | 模擬效果 vs agent 實際呼叫的 capability 與參數 |
| 語意 | 人 | agent 宣稱使用者要求的那句話 vs 實際效果 |

語意層不交給 LLM 判斷。那個 LLM 讀同一批內容，一樣可被注入，信任會繞回原點。改成把兩者並排給人看。

結構層有五條規則，**都不需要 per-protocol 知識**：

1. 出現這個操作沒指定的授權對象（ERC-20 額度、ERC-721 單顆授權、NFT 整批授權都算）
2. receipt 的 operation 對不上呼叫的 method
3. 任何 `setApprovalForAll`（整個系列的轉移權，含你以後才拿到的）
4. 任何無上限 ERC-20 授權
5. 沒有解讀模組就誠實說比不了，不猜

### 簽名怎麼交回你的錢包

面板跑在 MCP App 的 sandbox iframe 裡，**碰不到 `window.ethereum`**。所以簽名開一個獨立頁面，由使用者自己的錢包完成。

三個設計決定：

- **交易由面板直接交出去，不繞回 agent。** agent 是我們假設不可信的那一方，讓它在人核准之後再碰一次交易，前面的驗證就白做了。
- **交易放在網址的 `#` 後面。** fragment 不會被瀏覽器放進 HTTP 請求，所以就算部署到雲端，交易內容也不會送到那台伺服器。
- **交接指紋。** 面板顯示一串 16 個字，簽名頁顯示它「實際收到的東西」算出來的那串——涵蓋 chain id 與每筆交易的 `from`、`to`、`value`、`data`。**這是 hash 不是 MAC**：面板與簽名頁之間沒有共享祕密，所以「換了交易、連指紋一起重算」的攻擊者，解碼時的自洽檢查一定會放行。抓它的是人工比對——簽名頁那串跟面板已經顯示的那串不會一樣，而面板那串攻擊者改不到。解碼器擋得住的是「指紋跟內容對不上」與「鏈不是 Monad 主網」這兩種。

簽名頁還會比對錢包當下的帳戶——不是這筆交易的發起人就不讓簽。

## 兩個講清楚的邊界

**這個產品驗一致性，不驗安全性。** agent 誠實宣告一件有害的事並如實執行，我們會正確回報一致。

**stated intent 與 account 都是 agent 傳來的未經驗證輸入。** 介面標籤寫「agent 說你要求的」，不寫「你要求的」；帳戶那行明講「這個地址是 agent 給的，我們沒驗過」。

## 現在做到哪

| 項目 | 狀態 |
|---|---|
| 資料契約 + 七種情境 fixtures | 完成 |
| 面板渲染（純函式，可測） | 完成 |
| 人話轉換層 | 完成 |
| 真實模擬管線 | 完成，對 Monad 主網實跑 |
| 結構層比對（五條規則） | 完成 |
| 真實餘額檢查 | 完成 |
| MCP server + UI resource | 完成，MCP Apps 面板（Claude Desktop、claude.ai）與 CLI host 的 ANSI 文字都渲染成功 |
| 文字面板（CLI host 用） | 完成 |
| 簽名交回錢包 | 完成。三條路都用真實地址在瀏覽器實測：正常路指紋與面板同一串、「沿用舊指紋」被擋、「連指紋一起重算」照設計是人工比對擋不是自動擋（`pnpm handoff-url --tamper-recompute`）。端到端（錢包彈窗 → explorer）已於 2026-08-07 主網實送驗證 |
| 錢包連接（讓 account 不再由 agent 提供） | 未開始 |
| 部署到雲端 endpoint | site 已上線 [vigilapp.vercel.app](https://vigilapp.vercel.app)；MCP server 目前跑本機 + 隧道，正式部署待辦 |

`pnpm check`：**336 tests**，含對 Monad 主網的實跑。詳細狀態、決定紀錄、風險維護在內部文件。

### 自己驗過的（非文件轉述）

`rpc.monad.xyz` 實跑：`debug_traceCall` 可用、chain ID 143、CORS 對任意 origin 開放。trace 同時證實 shMONAD proxy 指向的 implementation 與程式碼內常數一致。

Monad 主網支援 EIP-7702：帶 authorization 的交易 gas 比對照組多 25,382，符合規範每個授權 25,000。

## 跑起來

```bash
cd app
pnpm install          # 會自動建 vendor 裡的 Moss，不需要外部 checkout
pnpm check            # typecheck + 336 tests
pnpm demo             # 終端機直接看面板，不需要任何 host
pnpm demo injection   # 看被注入指令的那一幕
pnpm build:all        # 面板、簽名頁、預覽頁、MCP server
```

**預設模擬帳戶主網上只有 0.001 MON**，付不起任何一筆交易，所以質押情境會顯示「餘額不夠、不能簽」。**那是真話不是壞掉**——我們會拿真實餘額對，不吃模擬時被蓋上去的數字。要看通過的樣子：`DEMO_ACCOUNT=0x… pnpm demo`。

接進 Claude Desktop 的步驟見 [app/MCP-SETUP.md](app/MCP-SETUP.md)。

## 底層

[Moss](https://github.com/nishuzumi/moss)：Monad 上的鏈上操作與模擬框架，MIT。作者是
Monad Foundation 的 DevRel 工程師，但專案掛在個人帳號下，README 自標
`unaudited alpha software`。

原始碼收在 [`app/vendor/moss/`](app/vendor/moss/README.md)，釘在上游 `97df9c1`。
收進來的理由、改了哪兩個欄位、怎麼更新，都寫在那份 README 裡。

本專案作者寫的 shMONAD protocol adapter 已開 PR 進 Moss upstream（[#128](https://github.com/nishuzumi/moss/pull/128)）。

我們對 Moss 的曝險分三層，哪一層擋得住哪一層擋不住，分析維護在內部文件。

## 文件

| 檔案 | 內容 |
|---|---|
| [app/MCP-SETUP.md](app/MCP-SETUP.md) | 安裝與接線 |
| [app/DESIGN-BRIEF.md](app/DESIGN-BRIEF.md) | 給做介面的人 |

## 授權

[MIT](LICENSE)。

---

Monad Builder Camp Hackathon 2026
