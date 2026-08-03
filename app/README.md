# Vigil

> 拉丁文 *vigil*：守夜人。看見、回報，不替你決定。

簽名前的交易證據面板。agent 準備好一筆 Monad 交易後，這個東西對主網跑模擬，
把實際會發生什麼渲染在 agent 的對話裡。

## 跑起來

```bash
pnpm install        # 會自動建 vendor 裡的 Moss，不需要外部 checkout
pnpm check          # typecheck + 276 tests（含對 Monad 主網的實跑）
pnpm build:all      # 面板、簽名頁、預覽頁、MCP server

pnpm demo           # 在終端機直接看面板，不需要任何 MCP host
pnpm demo unstake   # 看模擬失敗長什麼樣
pnpm demo fixtures  # 五個情境，含現場產不出來的惡意授權
```

## 兩種形態，同一份資料

| host | 看到什麼 | 走哪個欄位 |
|---|---|---|
| Claude Desktop、claude.ai、ChatGPT | 渲染出來的面板 | `ui://` resource + `structuredContent` |
| **Claude Code、Codex、Hermes 這類 CLI** | **文字版面板** | `content[0].text` |

官方 client-matrix 只列 Claude web 與 Claude Desktop 支援 MCP Apps 的 UI resource，
CLI agent 一律不在內。而那些正是使用者叫 agent 上鏈做事的地方，所以文字版**不是備案**，
是那批 host 的主要形態。

兩邊共用 `humanize.ts`，內容一致，差別只在排版媒介。

看預覽頁：開 `mock/index.html`。裡面有五個情境，兩個是**對主網真實模擬**跑出來的，
三個是備好的資料（惡意授權那種現場產不出來），頁面上有標。

接進 Claude Desktop：見 [MCP-SETUP.md](MCP-SETUP.md)。

## 這裡有什麼

| 路徑 | 作用 |
|---|---|
| `src/contract.ts` | 前端資料契約。唯一來源，Moss 型別原樣接入 |
| `src/pipeline.ts` | 真管線：構造交易 → 主網模擬 → 結構比對 → 組成 view |
| `src/panel/render.ts` | 面板渲染，純函式，可測 |
| `src/panel/humanize.ts` | 把 Moss 的結構化資料轉成人話 |
| `src/panel/main.ts` | MCP App 進入點，接 App Bridge |
| `src/mcp/server.ts` | MCP server：tool + UI resource |
| `src/mcp/cli.ts` / `http.ts` | stdio 與 HTTP 兩種進入點 |
| `src/fixtures.ts` | 五個情境的假資料 |
| `test/` | 95 tests |

## 四條硬規則

由 `assertViewInvariants()` 強制，測試會驗：

1. **有 warning 就不能簽。** `signable` 直接用 view 上的值，不要自己推。
2. **沒有意圖就不能出比對結論。**
3. **`changes` 任何情況都有。** 它是不經任何人解讀的那一層，`receipt` 可以是 null。
4. **`receipt` 的葉節點握的是原始 `Change` 物件本身。** 內容相同但物件不同就是捏造，
   Moss 的 `verifyReceiptCoverage` 會抓。渲染時不要複製或重建 change 物件。

## 一個踩過的坑，寫下來免得再犯

2026-08-01 凌晨實際用面板時發現：拿手寫的漂亮 fixture 驗收全綠，接上真實主網資料
就整個退化成開發者文字。

面板上長這樣：

```
轉帳  Native MON Transfer: 250000000000000000 from 0xcccccccc… to 0x1b68626d…
```

金額是 wei，地址是完整 42 字元。產品的前提是非技術使用者三十秒讀懂，這樣直接失敗。

根因是 **fixture 的 `data` 形狀是自己發明的，跟 Moss 真實輸出不同**。

兩件事因此固定下來：

- `src/fixtures.ts` 的 `data` **必須跟 Moss 真實輸出的形狀一致**，檔案開頭有實測記錄
- `src/panel/humanize.ts` 拿 Moss 的**結構化 `data`** 重寫成人話，不直接顯示它的 `text`
  （那是寫給 agent 看的）。認不得的形狀退回原文並縮短地址
- `test/render.test.ts` 有一組回歸測試，掃全部情境不准出現完整地址或未格式化的長整數

現在同一筆資料長這樣：

```
支出  你支出 0.25 MON
取得  你取得 ~0.156494 shMON（新鑄出的）
事件  協議記錄這筆質押：0.25 MON 換 ~0.156494 shMON
```

## 為什麼自己建 MCP server 而不改 Moss 的

1. Moss 的 mcp-server 在 PR #128 的分支上，加東西會污染 PR
2. 它的依賴裡沒有 shmonad（只有 kuru 與 pancakeswap）
3. 「agent 說使用者要求什麼」這個參數是本產品的東西，不是 Moss 的

Moss 用 library 方式接（README 有記載的用法），不動它的任何檔案。
