# 專案進度總表

> 2026-08-04 | Monad Builder Camp Hackathon | 8/9 14:00 Open Day，剩 5 天
>
> 單一入口。要接手、交接、寫提交材料，從這裡開始。

## 一句話

讓 agent 幫你在 Monad 上執行鏈上操作，簽名之前，在同一個對話裡看到這筆交易實際會做什麼。

## 現在能跑的

```bash
cd D:/dev/monad-camp/hackathon/app
pnpm install          # 會自動建 vendor 裡的 Moss，不需要外部 checkout
pnpm check            # typecheck + 276 tests，含對 Monad 主網的實跑
pnpm demo             # 終端機直接看面板，不需要任何 host
pnpm demo injection   # 看 prompt injection 那一幕
pnpm build:all        # 面板、簽名頁、預覽頁、MCP server
pnpm handoff-url          # 產一個真的交接網址
pnpm handoff-url --tamper # 沿用舊指紋的竄改，簽名頁自動擋下來
pnpm handoff-url --tamper-recompute  # 連指紋一起重算的竄改，自動檢查會過，靠人比對
```

`handoff-url` 三個都需要模擬結果可簽名，所以要 `DEMO_ACCOUNT=0x…` 指到有 MON 的地址。

預設帳戶主網上只有 0.001 MON，付不起任何一筆，所以質押情境會跑成「餘額不夠」。
那是**真話不是壞掉**。要看通過的樣子：`DEMO_ACCOUNT=0x… pnpm demo`。

| 項目 | 狀態 |
|---|---|
| 前端資料契約 + 七種情境 fixtures | 完成 |
| 面板渲染（純函式，可測） | 完成 |
| 人話轉換層 | 完成。把 Moss 給 agent 看的文字轉成人看的 |
| 真實模擬管線 | 完成。對 Monad 主網實跑通過 |
| 結構層比對 | 完成（五條不需協議知識的規則）。08-04 補掉三個洞，見下 |
| **真實餘額檢查** | **完成。Moss 會把餘額蓋成 100 萬 MON，真實餘額要自己對** |
| MCP server + UI resource | 完成。已在 Claude Desktop 渲染成功 |
| TUI 文字面板（CLI host 用） | 完成 |
| prompt injection 場景 | 完成，真的 ERC20 approve 對主網模擬 |
| **簽名交回錢包** | **完成。指紋涵蓋 chainId + from/to/value/data、錢包帳戶比對、瀏覽器實測過。指紋是 hash 不是 MAC，重算型竄改靠人工比對擋，見下** |
| **Moss 收進 vendor 並升到最新** | **完成。fresh clone 驗證過，不需要外部 checkout** |
| shMONAD adapter 事件歸屬修復 | 完成，已收進 vendor。上游 PR 仍未合併 |
| 錢包連接（讓 account 不再由 agent 提供） | 未開始，階段二 |
| `approvalForAll` 的比對與顯示 | **完成。setApprovalForAll 不再被誤報成安全** |
| 專案名 | 已定：Vigil |
| 部署到雲端 endpoint | 未開始，本機已完整可用 |

**核心迴路全部跑通，含簽名交回錢包。** 剩下的是真人測試與提交材料。收尾清單見 [2026-08-02-closing-plan.md](2026-08-02-closing-plan.md)。

## 8/4 做了什麼（外部 code review 的六條 HIGH）

完整報告 [docs/code-review-2026-08-04.md](docs/code-review-2026-08-04.md)。六條全修，`pnpm check` 276 綠。
**六條裡有四條的共同病灶是「用名字判斷，不看實際結構」**，跟 8/3 那個 `approvalForAll` 是同一類。

1. **指紋不涵蓋 `from`（HIGH）。** 指紋只串 `to|value|data`，但簽名頁的帳戶比對與
   `eth_sendTransaction` 用的就是 `from`。改 `from` 指紋不變 → 錢包會以另一個帳戶送出
   一段用原帳戶模擬出來的 calldata。現在指紋涵蓋 `chainId` + 每筆的 `from|to|value|data`，
   `decodeHandoff` 另外驗 chainId 必須是 Monad 主網。
2. **指紋是 hash 不是 MAC（HIGH，改的是宣稱不是機制）。** 面板與簽名頁沒有共享祕密，
   所以「換交易 + 重算指紋」的攻擊者，自洽檢查一定放行。**這是設計邊界，不是 bug**——
   擋它的是人工比對（面板那串攻擊者改不到）。原本 README/STATUS 寫成「網址被改過直接擋」，
   那是把人工防線寫成機器保證，已改掉。新增 `pnpm handoff-url --tamper-recompute` 把這條
   攻擊路徑演出來，測試也補了一條把邊界釘住。
3. **`erc1155.approve` 恆判 mismatch（HIGH）。** Moss 的 method 叫 `approve`、產出的
   operation 是 `approvalForAll`，rule 2 用字串相等比 → 合法呼叫被判「對不上」，
   而 rule 3 寫得最好的那段 partial 文案（「含你以後才拿到的」）永遠輪不到。加了
   `OPERATION_SYNONYMS` 對照表。**舊測試手捏 `receiptWith("approve")`，測的是 registry
   產不出來的世界**，已改成真實 operation。
4. **method 名稱含 approve/permit/allow 就整段跳過 rule 1（HIGH）。** 「有上限、但給錯人」
   的授權在 approve 類操作裡完全隱形，回 `match`、可簽名。開關拿掉——使用者指名的對象
   本來就在 `known` 裡，逐筆比對就夠。
5. **ERC-721 單顆 approve 對所有規則隱形（HIGH）。** 它跟 ERC-20 `Approval` **topic0 完全相同**，
   差在三個參數全 indexed（4 個 topic、data 空），`decodeEventLog` 解不開被 catch 吞掉 →
   一筆交出單顆高價 NFT 轉移權的授權會顯示「沒有發現意料外的動作」。`findApprovals` 加了
   4-topic 分支（授權給零地址算撤銷，不警告）。
6. **多筆交易只送得出第一筆卻可簽名（HIGH）。** kuru 的 token→token swap 會展開成兩筆
   （先 approve 再 swap）。原本：receipt 被丟掉、理由誤稱「這個協議沒有解讀模組」、
   verdict partial → 可簽名，但簽名頁只送第一筆——使用者以為簽了 swap，上鏈的只有 approve。
   現在多筆一律 `MULTI_TX_UNSUPPORTED` 擋簽名，效果照樣顯示。那句誤導的 banner 文案也改了
   （「這部分沒有可用的解讀」）。

**同日續修的兩條 MEDIUM：**

- **M-2 MCP HTTP server 的暴露面。** 原本綁 `0.0.0.0`（同網段任何人連得到）
  加 `cors({origin:true})`（任何網頁都能 fetch 驅動它）。現在預設綁 `127.0.0.1`，
  加 Origin 驗證，非白名單一律 403。`HOST` / `ALLOWED_ORIGINS` 可覆寫，部署設定
  見 [app/MCP-SETUP.md](app/MCP-SETUP.md)。實測：`netstat` 確認只在 loopback 監聽、
  從 LAN IP 連線被拒、六種 Origin 逐一 curl 過。這個檔原本零測試覆蓋，補了 11 條。
- **M-4 代幣查不到時印出錯數字。** `decimals` 退回 0，等於把 `250000000000000000`
  原樣印上畫面——讀的人會以為是 2.5 億個代幣，實際是 0.25 個。現在明講「換算不了」
  並附縮短過的原始值。另外失敗**不再永久快取**（改 60 秒 TTL），`decimals` 解不出
  合理整數也當查不到，不讓 NaN 流進 `formatUnits`。

- **M-1 gas 估不到時手續費靜默歸零。** Moss 的 gas 估算走非標準的 `eth_estimateGas`
  三參數形式，失敗就吞掉並寫 `gas: null`；原本 `BigInt(r.gas ?? 0)` 把它當 0，
  手續費變成 0，餘額檢查退化成只比本金——而這個檢查存在的理由就是攔下「付不出
  手續費會 revert、手續費照扣」的交易，且沒有任何訊號會說 fee 被當成 0。
  現在 `gasUnitsFrom` 遇到 null 就回 null，**先退回標準的 `eth_estimateGas`
  （不帶 overrides）**，兩條都失敗才發 `FEE_ESTIMATE_UNAVAILABLE` 擋簽名，
  訊息明講「這是檢查沒做完，不是這筆交易有問題」。

- **M-3 無上限門檻只認 2^255。** 實務上無上限授權常寫成 Permit2 的
  `type(uint160).max` 或 `type(uint96).max`，兩個都遠小於 2^255，規則對它們
  完全失明——回 `match`、可簽名。門檻降到 `2^96 - 1`（約 7.9e28，對 18 位小數
  是 790 億顆），方向刻意寧可誤報：把大額判成無上限只是多確認一次，
  漏掉一筆真無上限授權是直接簽下去。**顯示與規則現在共用同一個常數**
  （定義在 `humanize.ts`），分岔會出現「面板寫無上限、規則不當它是無上限」。
- **M-5 `account` 無格式驗證。** schema 加 regex，垃圾值在邊界就擋掉，
  不讓它流到 viem 才爆出開發者導向的例外，也不讓它先被加進
  `addressesInIntent` 的「使用者知情地址」集合影響比對。
- **M-6 deposit/withdraw 寫死 18 decimals 與 "MON"。** 這是 operation 名稱層級的
  分派，任何新協議產出 `deposit` 形狀都會套用同一組數字——底層是 USDC（6 位）的
  vault 會拿到錯了 10^12 倍的金額配錯的符號，且無任何警示。改成先看 adapter 有沒有
  明講底層資產（`asset` / `assetToken`），有就照它查、查不到就走「換算不了」，
  **沒有那個欄位才退回原生**。shMONAD 走的正是最後這條（底層就是原生 MON，
  Moss 自己會斷言 `assets` 等於 native transfer 的 value）。

**MEDIUM 六條全部修完。仍未修：LOW 六條**，清單在報告裡。其中值得知道的是
L-6：簽名頁只帶 agent 的說詞不帶 verdict，使用者若從面板直接點過去簽，
最後一眼看到的是「agent 的說詞 + 一串 hex」，沒有可對照的東西。

## 8/4 用真實地址跑過的（John 提供 `0x0829…ecC0`，主網 9.087 MON）

**全部是唯讀模擬**（`debug_traceCall` / `eth_getBalance` / `eth_estimateGas`），沒有簽名、
沒有送出、鏈上狀態沒有改變。

- **`pnpm check` 276 passed、0 skipped。** 那條一直被 skip 的
  「有餘額的帳戶質押小額：結構比對一致且可簽名」第一次真的跑起來——
  **`match` + `signable: true` 這條路徑在此之前從來沒有被真實資料驗過**，只有 fixture。
- **`pnpm demo` 通過的樣子**：`✓ 沒有發現意料外的動作`、支出 0.25 MON、
  取得 ~0.156325 shMON。這是 demo 當天要給評審看的那一幕。
- **交接三條路全部實跑**（先前 `--tamper-recompute` 只過 typecheck、一次都沒執行過）：

  | 路徑 | 簽名頁的實際行為 |
  |---|---|
  | 正常 | 渲染，指紋 `FFC9 2520 32B2 B188`，收款是 shMONAD |
  | `--tamper`（沿用舊指紋） | **擋下**：「交接資料的指紋對不上，這串網址被改過或不完整」 |
  | `--tamper-recompute`（重算指紋） | **渲染，自動檢查通過**。收款變成 `0x9F2c…a41b`，指紋顯示 `F9F9 47C7 D874 E222` |

  第三條就是設計邊界：hash 不是 MAC，機器擋不住，靠人對照兩頁的指紋。
  面板那串 `FFC9…` 與這頁的 `F9F9…` 不同，人看得出來。
- **面板指紋 == 簽名頁指紋**：mock 頁 live 情境顯示 `FFC9 2520 32B2 B188`，
  簽名頁正常路顯示同一串。「被簽的是被模擬的那一筆」這條宣稱有執行證據了。

**仍然沒驗的**：`eth_requestAccounts` → 切鏈 → `eth_sendTransaction` 這一段。
開發環境的瀏覽器沒有錢包擴充，簽名頁正確顯示「沒有偵測到錢包擴充」。要 John 實機跑。
多筆交易（kuru token→token swap）也還沒實測，那需要帳戶裡有 ERC-20 餘額。

還有一條不是 finding 但離核心宣稱最近：**`humanize` 完全信 adapter 給的 `leaf.data`，
從不跟同一葉節點的原始 topics 交叉驗證**。「證據來自執行」在 raw changes 那層成立，
在人話那層信的是 Moss 的解讀。要補的話是把 transfer/approve 分支改成自己從 topics 解、
跟 `leaf.data` 比對，不一致就退回原始資料。

## 8/3 做了什麼

1. **簽名交接做完了。** 面板 → 簽名頁 → 錢包。交易放在網址 `#` 後面（不會進 HTTP 請求，託管伺服器收不到）；交接指紋讓「被簽的是被模擬的那一筆」可查核；解碼時自己重算，指紋跟內容對不上就擋。瀏覽器實測過竄改與正常兩條路。（08-04 更正：這裡原本寫「網址被改過直接擋」，不成立——見下方 08-04 那節。）
2. **三次點擊減成兩次**，跟一般 dapp 一樣。已連過錢包就自動觸發。
3. **抓到並修掉一個會讓核心宣稱失效的 bug**（見下）。
4. **簽名頁比對錢包帳戶**，不是發起人就擋。
5. **面板把 `account` 標成「agent 給的」**，跟 stated intent 同一個處理原則。
6. **Moss 收進 `vendor/`，同時升到上游最新**（`97df9c1`，2026-08-02）。
7. **ERC-7715 查證：走不通**（見決定紀錄）。
8. **補上 `approvalForAll` 的洞**（見下）。測試從 148 個變成 225 個。

## 一個更嚴重的坑（8/3）

拿真實地址跑質押 10 MON，面板回報 `match`、可簽名、「沒有發現意料外的動作」。

**但那個地址只有 9.08 MON，這筆送出去必定 revert。**

根因在 Moss `simulator/src/index.ts:104`：

```ts
overrides[sender] = { balance: prefund, ... }   // DEFAULT_PREFUND_WEI = 10^24
```

每次模擬前把發送方餘額蓋成 100 萬 MON。**對 Moss 是合理的預設**——它是通用框架，要能回答「這個呼叫會做什麼」而不管有沒有錢。對我們是錯的，因為我們宣稱的是「簽名前看到實際會發生什麼」。

**影響範圍比一筆大：** demo 帳戶 `0xCccc…ccccC` 主網上只有 0.001 MON，連手續費都付不出來。所以先前所有「對主網實跑」的綠色測試、`pnpm demo`、mock 頁的 live 情境，驗的都是一筆送不出去的交易。

跟 07-31 那個 fixture 坑同一個病：**驗收方式錯了，不是程式碼寫錯。** 而且這次是靠 John 拿真地址當使用者用才發現的，不是靠任何系統性檢查。

對策：模擬跑完另外拿真實餘額對 `本金 + gas × gasPrice`，不夠就 warning、不可簽名，**但效果照樣顯示**（要先知道這筆想做什麼，才判斷得了值不值得去補錢）。

## 昨天到今天的變化

1. **傳輸方式改了**。原本要用本機 stdio（因為好接），查完官方文件與四個 GitHub 實例後改成 **remote HTTPS**。Anthropic 自己把 remote 定位為 recommended、stdio 與 `.mcpb` 為 secondary；UI 渲染兩者無技術落差，差別全在分發，只有 remote 能讓評審不裝東西就試。
2. **真管線接通**。從 fixture 換成對主網跑 `debug_traceCall`。
3. **發現並修掉一個會毀掉產品前提的問題**（見下）。
4. 測試從 27 個變成 95 個。

## 一個踩過的坑（寫下來免得再犯）

管線接通後自己開面板看，長這樣：

```
轉帳  Native MON Transfer: 250000000000000000 from 0xcccccccc… to 0x1b68626d…
```

金額是 wei，地址完整 42 字元。產品前提是非技術使用者三十秒讀懂，直接失敗。

**根因不是渲染寫錯，是驗收方式錯了。** 一直拿手寫的漂亮 fixture 跑測試，全綠；而那些 fixture 的資料形狀是自己發明的，跟 Moss 真實輸出不同。測試保護的是一個不存在的世界。

三個對策：加 `humanize` 拿 Moss 的結構化 `data` 重寫成人話（不用它給 agent 看的 `text`）、fixture 形狀改成跟主網實測一致並在檔頭記錄實測日期、加回歸測試掃全部情境不准出現完整地址或未格式化長整數。

現在同一筆：

```
支出  你支出 0.25 MON
取得  你取得 ~0.156494 shMON（新鑄出的）
事件  協議記錄這筆質押：0.25 MON 換 ~0.156494 shMON
```

順帶抓到一個語意錯誤：`Deposit` 原本標成「取得」，但那是協議記帳事件不是價值移動，前兩行已經算過，標成取得等於重複計算。改成中性的「協議記錄」。

## 決定紀錄

| 日期 | 決定 | 理由 |
|---|---|---|
| 07-28 | 兩檔行為：有意圖出比對，無意圖只出證據 | 分界是「有沒有 stated intent 可對照」 |
| 07-28 | 示範協議 Kuru + shMONAD | shMONAD 是自己的 adapter |
| 07-30 | 不打安全，改打 agent 執行端 | 安全工具要等人被咬過才裝 |
| 07-30 | 主網真簽小額 | Moss v1 只支援 chain 143 |
| 07-31 | 砍瀏覽器插件 | 三個同類產品兩個被吸收一個倒閉 |
| 07-31 | MCP App 為主要形態 | 範式在對話裡，分發走 MCP |
| 07-31 | 安全資訊為可選圖層 | 只放模擬看得出來的 |
| **08-01** | **傳輸走 remote HTTPS，stdio 只做本機開發** | 官方定位 + 評審不必安裝 |
| **08-01** | **顯示一律經過 humanize，不直接用框架的文字** | 框架文字是寫給 agent 的 |
| **08-03** | **交接由面板直送簽名頁，不繞回 agent** | agent 是假設不可信的那一方，讓它在人核准後再碰一次交易，前面全白做 |
| **08-03** | **不做 ERC-7715 session key** | 查證後確定做不到（見下） |
| **08-03** | **Moss 收進 vendor 並釘死 commit** | 上游自標 alpha、十天推十幾個提交、已經移除過我們在用的 API |
| **08-03** | **vendor 放原始碼不放編譯產物** | 主打「你可以自己查證」的產品，相依裡不該有讀不了的 blob |

## 自己驗過的事實（非報告轉述）

**2026-07-31 實跑 `rpc.monad.xyz`**：`debug_traceCall` 可用、chain ID 143（0x8f）、CORS 對任意 origin 開放。trace 同時證實 shMONAD proxy `0x1B68…E19c` DELEGATECALL 到 implementation `0x856A…8e1B`，與程式碼常數一致。

**2026-08-01 主網模擬實跑**：質押 0.25 MON 通過、有 receipt、結構比對一致；贖回無 shMON 帳戶回報 blocked 且不可簽名。四個測試每次 `pnpm check` 都會重跑。

**MCP 協定實跑**：`tools/list` 線路輸出含 `_meta.ui.resourceUri`，從任意目錄啟動皆可。

**2026-08-03 EIP-7702 / ERC-7715 查證**（一手來源，決定不投 15 小時）：

- Monad 主網支援 EIP-7702。實測：帶 authorization 的交易 gas 比對照組多 25,382，符合規範每個授權 25,000。
- MetaMask 的委派合約在 Monad 主網有 code（Delegator `0x63c0…E32B` 11,185 bytes、DelegationManager `0xdb9B…7dB3`、EntryPoint v0.7）。
- Monad 在 MetaMask [官方支援清單](https://docs.metamask.io/smart-accounts-kit/get-started/supported-networks/)裡，含 ERC-7715。
- **但 ERC-7715 只做得了純轉帳。** 官方文件寫明「套用這個 scope 時 toolkit 預設把 `exactCalldata` 設成 `0x`」，配上 `ExactCalldataEnforcer.sol` 的 `require(keccak256(termsCallData_) == keccak256(callData_))`，calldata 必須是空的。ERC-7715 的請求結構沒有 calldata 欄位，dapp 蓋不掉。→ **質押走不了這條**。

**2026-08-03 Moss 來歷查證**：作者 nishuzumi 即 BoxChen，GitHub bio 寫 `DevRel @ Monad Foundation`。但 repo 掛在個人帳號下（owner type `User`，不在 monad 組織），README 第 7 行自標 `unaudited alpha software. Do not use it with production funds.`

**pitch 講法**：不能說「Monad 官方框架」，要說「Monad Foundation 的 DevRel 工程師做的模擬框架，目前是 alpha」。

## 我們對 Moss 的曝險

Moss 在流程裡做兩件事：**建 calldata**、**解讀模擬出來的變動**。使用者最後簽的就是它建的 bytes。

| Moss 出錯的地方 | 我們擋不擋得住 |
|---|---|
| 建錯 calldata | **部分擋得住**。模擬跑的是那串 bytes 本身，效果從節點回來，不是 Moss 說的 |
| 解讀錯變動（receipt 層） | **半擋**。`verifyReceiptCoverage` 要求每筆變動被覆蓋剛好一次，加上原始資料分頁看得到原文 |
| 模擬器本身抽錯變動 | **擋不住**。餘額那個 bug 就是這一層 |

架構本來就對「準備交易的那一方不可信」做了設計，只是原本假設的不可信方是 agent；Moss 現在也落在同一個位置。這件事講得出口。

## 加新協議的真實成本

註冊是一行（`pipeline.ts` 的 `registry.use(...)`），顯示才是工作。

Moss 全部協議產出 9 種 operation，我們的 humanize 認得 6 種：

| | operation |
|---|---|
| 認得 | `nativeTransfer` `transfer` `approve` `approvalForAll` `deposit` `withdraw` |
| 不認得 | `swap` |

不認得的會退回 Moss 給 agent 看的原文，就是 07-31 那個坑。加協議 = 一行註冊 + 看它產出哪些 operation + 沒認過的補進 humanize。

**上游現成可用**：`protocols/apriori`（aPriori aprMON 流動性質押，operation 跟 shMONAD 同一組，接近零成本）、`pancakeswap`、`monad-cards`。

## 已補：`approvalForAll`（8/3）

結構層比對原本用 `Approval(address,address,uint256)` 的 topic 抓授權。
**`ApprovalForAll(address,address,bool)` 是不同 topic（`0x17307eab…` vs `0x8c5be1e5…`），抓不到。**

所以一筆 `setApprovalForAll` 會被判成 `match`、顯示「沒有發現意料外的動作」、可簽名。
那是 NFT drainer 最標準的第一步，而且比無上限 ERC-20 授權更狠——沒有金額欄位，
交出去的是整個系列的轉移權，含使用者以後才鑄到或買到的。

我們有規則專門抓無上限 ERC-20 授權，卻對它的 NFT 版本失明。同一類問題只防了一半。

現在補上兩條規則（未預期的整批授權算不一致；明白呼叫的也要人確認），加上 humanize
分支。**因為結構層看的是原始事件不是 adapter，ERC-721 與 ERC-1155 都會被抓到，
不需要 Moss 有對應的協議模組。**

實際輸出：

```
✗  交易內容跟這個操作對不上
   · 多出一筆整批授權：0x9F2c…a41b 可以轉走你在 0x5C7d…1C3e 這個系列裡的每
        一個，你要求的操作不需要授權

鏈上會發生的
  授權    讓 0x9F2c…a41b 可以轉走你在 0x5C7d…1C3e 這個系列裡的每一個，包含
          你以後才拿到的
```

## 剩下 5 天

收尾清單見 [2026-08-02-closing-plan.md](2026-08-02-closing-plan.md)。依重要性：

1. 真人測試（評分軸「用戶用得懂」，只有真人測得出來）
2. 實機跑一次錢包路徑（唯一還沒被任何方式驗過的一段）
3. 提交材料與錄製
4. 有時間才做：UI 重設計（見 [docs/ui-direction-2026-08-04.md](docs/ui-direction-2026-08-04.md)）、
   錢包連接階段二（6h）、加 apriori 當第二個示範協議（1h）

8/4 到 8/7 疊 Week 5 每日任務，算半天。

## 未解與風險

| 項目 | 狀態 |
|---|---|
| ~~面板渲染~~ | **已驗證。Claude Desktop 渲染成功，host 宣告 `io.modelcontextprotocol/ui`，mime type 相符** |
| ~~protocol version 疑慮~~ | 已排除。extension 走 capabilities 另外協商，與 base protocol version 無關 |
| ~~MCP App sandbox 碰不到 `window.ethereum`~~ | **已解。交接到獨立簽名頁，指紋可查核，瀏覽器實測過** |
| **錢包那一段沒有端到端實測** | `eth_requestAccounts` → 切鏈 → `eth_sendTransaction` 需要真錢包，開發環境沒有。**要 John 實機跑一次** |
| `account` 由 agent 提供，未經驗證 | 面板已標明，簽名頁會比對。根治要階段二錢包連接 |
| 多筆交易只送得出第一筆 | 簽名頁已誠實揭露，質押只有一筆所以不影響 demo |
| 部署 endpoint 未定 | 本機已完整可用，這是給評審自己試用的 |
| unstake 方向性斷言無 live 佐證 | 測試帳號無 shMON |
| Blockaid 對 Monad 的覆蓋 | 兩份研究矛盾，不要在 pitch 引用 |
| Rabby 的模擬引擎是誰 | 證據不足，不要引用 |
| 專案名 | 已定：Vigil |
| demo 錢包 | `0x0829…ecC0`（9.087 MON），08-04 整條路徑實測過 |

## 兩個要講清楚的邊界

1. **驗一致性，不驗安全性。** agent 誠實宣告一件有害的事並如實執行，我們會正確回報一致。
2. **stated intent 是 agent 傳來的未經驗證輸入。** 介面標「agent 說你要求的」，不寫「你要求的」。

## 檔案地圖

```
hackathon/
  README.md                    專案入口（給外部看）
  STATUS.md                    這份
  product-brief.md             產品定義 v0.2
  2026-07-28-problem.md        問題陳述
  2026-07-31-plan.md           時程
  team-intro.md                給團隊的白話說明
  docs/research-landscape.md   賽道盤點
  app/
    src/contract.ts            資料契約（唯一來源）
    src/pipeline.ts            真管線 + 結構比對 + 餘額檢查
    src/handoff.ts             交接編解碼 + 指紋
    src/html.ts                面板與簽名頁共用的跳脫
    src/panel/render.ts        面板渲染（純函式）
    src/panel/text.ts          TUI 渲染（純函式）
    src/panel/humanize.ts      人話轉換
    src/panel/main.ts          MCP App 進入點
    src/sign/view.ts           簽名頁渲染（純函式）
    src/sign/main.ts           簽名頁的錢包互動
    src/mcp/server.ts          MCP server
    src/mcp/cli.ts | http.ts   stdio / HTTP 進入點
    vendor/moss/               Moss 原始碼副本，釘 97df9c1。見該目錄的 README
    test/                      276 tests
    MCP-SETUP.md               接到 Claude Desktop
    DESIGN-BRIEF.md            給做介面的兩位
```

**Moss 已經收進 `app/vendor/moss/`，不再依賴外部 checkout。** fresh clone 驗證過：88 個檔案 → `pnpm install` → 202 tests → `pnpm build:all` 全數通過。

`D:/dev/moss` 那份是 John 的 fork（branch `feat/shmonad-adapter`），T1 修復仍未 commit，但 vendor 裡已經有了，所以 demo 不依賴那個 PR 有沒有被合併。

## 立刻要 John 決定的

1. **實機跑一次簽名路徑**（`pnpm build:all` → 重開 Claude Desktop → 質押 → 按簽名，先別按送出）。
   這是唯一還沒被任何方式驗過的一段，開發環境沒有錢包擴充。
2. 要不要推 GitHub（公開還是私有）。remote 已設 `USDHGwang/vigil`，目前有 unpushed commit。
3. demo 要用哪個地址。`0x0829…ecC0`（9.087 MON）已經驗過整條路徑；
   要換別的就重跑 `DEMO_ACCOUNT=0x… pnpm build:mock` 把 mock 頁的 live 情境指過去。
