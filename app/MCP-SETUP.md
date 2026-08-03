# 安裝與接線

## 先講一件事：這一版任何人都裝得起來

先前版本有兩個地方寫死在開發機上，別人 clone 下來是壞的：

1. **簽名頁的網址**在 `pnpm build:panel` 時被烤進面板（`file:///D:/dev/...`），
   按下簽名會開到一個不存在的檔案。
2. **Moss 用 `link:` 指向外部 checkout**，`pnpm install` 直接失敗。

兩個都處理掉了：

- 簽名頁由 **MCP server 在執行時服務並把網址隨結果送給面板**。stdio 模式起一個只綁
  `127.0.0.1` 的小 server，HTTP 模式用自己的 `/sign` 路由。同一份程式碼，本機與部署都通。
- Moss 收進 `vendor/moss/`，`pnpm install` 會自動建。詳見 `vendor/moss/README.md`。

驗證方式不是「應該可以」，是實際做過：把 88 個受版控的檔案複製到全新目錄，
`pnpm install` → `pnpm check` → `pnpm build:all` 全數通過，沒有外部相依。

## 為什麼簽名要另開一頁

MCP App 的面板跑在 sandbox iframe 裡，**碰不到 `window.ethereum`**。那是規格定的隔離，
不是實作缺漏。所以簽名一定要在一個不在 sandbox 裡的頁面完成。

那一頁必須從 **http(s)** 提供，不能是 `file://`——MetaMask 預設不注入 `file://` 頁面，
使用者得自己去擴充設定裡開權限。這就是為什麼要起一個小 server 而不是直接開檔案。

交易資料放在網址的 `#` 後面。fragment 不會進 HTTP 請求，**所以交易內容不會送到
託管這一頁的伺服器上**，即使之後部署到雲端也一樣。

---

## 裝法一：stdio（本機，最快）

```bash
cd <repo>/app
pnpm install        # 會自動建 vendor 裡的 Moss
pnpm build:panel    # panel/index.html，自包含
pnpm build:sign     # sign/index.html，自包含
pnpm build:mcp      # dist/cli.js
```

或直接 `pnpm build:all`。

設定檔在 `%APPDATA%\Claude\claude_desktop_config.json`（macOS 是
`~/Library/Application Support/Claude/`），跟 `preferences` 同一層加一個 key，
**保留原本的內容**：

```json
"mcpServers": {
  "vigil": {
    "command": "node",
    "args": ["<你的絕對路徑>/app/dist/cli.js"]
  }
}
```

存檔後**完全結束 Claude Desktop 再重開**（關視窗不夠）。

用 `node` 加絕對路徑不是隨便選的，三個坑都踩過：

- pnpm 會把訊息寫到 stdout，JSON-RPC 混進一個雜訊字元整條就壞
- vite-node 要從專案根解析設定，換個 cwd 完全沒輸出
- 打包後的 `dist/cli.js` 從任意目錄啟動都通（實測過）

啟動時 stderr 會印簽名頁的位置：

```
Vigil 簽名頁：http://127.0.0.1:52835/sign
```

port 每次不同（用臨時 port，不跟既有服務搶）。要固定就設 `SIGN_PORT`。

### 簽名頁託管在外面（`SIGN_PAGE_URL`）

```json
"mcpServers": {
  "vigil": {
    "command": "node",
    "args": ["<你的絕對路徑>/app/dist/cli.js"],
    "env": { "SIGN_PAGE_URL": "https://你的網域/sign/" }
  }
}
```

設了就不起本機 server，面板直接指過去。

**為什麼會需要**：本機模式的簽名頁是 `http://127.0.0.1:<每次都不同的 port>`，
而 MCP host 對面板能開哪些網址有政策。**localhost 加浮動 port 正好是最容易被擋的形狀**
——2026-08-04 實機驗到 `openLink` 回 `isError`，使用者按了簽名什麼都不會發生
（現在有退路會把網址攤出來，見 `panel/main.ts`）。指到固定的 https 網址通常就不再被擋。

簽名頁是完全自包含的靜態 HTML，交易在網址的 `#` 後面不會送到伺服器，
所以它可以放在任何靜態託管（GitHub Pages、Cloudflare Pages）上，不需要後端，
**信任模型也不因為換了託管方而改變**——那一頁拿不到你的私鑰，也收不到交易內容。

那個 server 有 `unref()`，不會把 process 撐著——Claude Desktop 關掉 stdin 之後
會跟著退出，不留孤兒。

## 裝法二：HTTP（部署用）

```bash
pnpm mcp:http                                   # http://127.0.0.1:8848
PORT=3000 PUBLIC_URL=https://你的網域 HOST=0.0.0.0 \
  ALLOWED_ORIGINS=https://你的網域 pnpm mcp:http   # 部署時
```

同一個 process 提供三件事：

| 路徑 | 用途 |
|---|---|
| `POST /mcp` | MCP 端點，無狀態模式 |
| `GET /sign` | 簽名頁 |
| `GET /health` | 健康檢查，順便回報簽名頁位置 |

**`PUBLIC_URL` 要填使用者的瀏覽器連得到的位置**，不是這個 process 自己看到的。
容器裡這兩者常常不一樣，填錯的話面板會叫瀏覽器去開一個連不到的網址。

### 綁定與來源（08-04 收緊）

**預設只綁 `127.0.0.1`。** 原本省略 host，Node 會綁 `0.0.0.0`，等於在咖啡廳或宿舍
wifi 上同網段任何人都連得到你這台的 `/mcp`。要對外開才設 `HOST=0.0.0.0`。

**Origin 驗證。** 原本 `cors({ origin: true })` 把任何網站的 origin 反射回去，
你跑著這個 server 時瀏覽任何網頁，那個網頁都能 `fetch` 驅動它。現在：

| Origin | 結果 |
|---|---|
| 沒帶（Claude Desktop 這類原生程式、curl） | 放行。瀏覽器發跨來源請求一定會帶，所以這不是瀏覽器攻擊面 |
| `https://claude.ai` 與其子網域 | 放行 |
| `http://localhost:<PORT>`、`http://127.0.0.1:<PORT>` | 放行 |
| 其他 | 403 `Origin not allowed.` |

`ALLOWED_ORIGINS` 用逗號分隔可以覆寫整份清單。**明確設了就只認清單**，
`claude.ai` 的萬用規則不再套用——部署時要讓 Claude Desktop 連得到，
記得把 `https://claude.ai` 一起列進去。

Claude Desktop 的 Connectors 只收 https，所以本機這條要配隧道或部署才接得上。

---

## 傳輸方式的決定（2026-08-01）

**產品要走的是 remote HTTPS，不是本機 stdio。**

不是因為哪個好做，是查完之後的技術判斷：

- Anthropic 官方文件自己把 remote HTTPS 定位為 **recommended**，`.mcpb` 與 stdio 定位為 **secondary distribution path**
- 對 UI resource 的渲染，兩種傳輸**沒有技術落差**。官方 Quickstart 兩種範例並列，差別全在分發
- 只有 remote HTTPS 能讓評審**不裝任何東西**、在自己的電腦或手機上當場開
- 官方的 MCP tunnels 明文寫「not available as connectors in claude.ai」，那條路對這個場景沒用
- GitHub 上四個非官方 MCP Apps 實例，三個選 remote HTTP

stdio 版留著當本機開發與除錯用。

---

## 試一下

在對話裡說：

> 用 vigil 幫我看一下，我要質押 0.25 MON

它會呼叫 `preview_transaction`，對 Monad 主網跑真實模擬，面板渲染在對話裡。

**預設的模擬帳戶主網上只有 0.001 MON**，付不起任何一筆交易，所以會顯示「餘額不夠、
不能簽」。那是真話不是壞掉——我們會拿真實餘額對，不吃 Moss 模擬時蓋上去的
100 萬 MON。要看通過的樣子，在請求裡帶自己的地址。

## 已驗證（`pnpm check`，276 tests）

- tool 宣告 `_meta.ui.resourceUri`，經真實 MCP 協定往返後仍在
- **面板在 Claude Desktop 裡真的渲染出來**，host 宣告 `io.modelcontextprotocol/ui`，mime type 相符
- resource 回傳自包含 HTML，沒有外部 script 或 stylesheet
- **對 Monad 主網真實模擬**：質押的效果算得出來、餘額不夠時擋下來、贖回失敗回報 blocked
- 交接網址隨結果送到面板，不在打包時寫死
- 簽名頁 server：只綁 127.0.0.1、任何路徑回同一頁、關掉後 port 收回、每次不同 port
- stdio 的 stdout 只有 JSON-RPC，簽名頁網址走 stderr；stdin 關閉後 process 退出（exit 0）
- HTTP：`/health`、`/sign`、`initialize` 都有正確回應
- 面板與 TUI 不顯示完整地址與未格式化的 wei（七個情境全掃）
- 交接指紋涵蓋 chainId 與每筆的 `from|to|value|data`。三條路都用真實地址實跑過：
  正常路渲染且指紋與面板同一串、沿用原指紋的竄改被擋、**連指紋一起重算的竄改
  自動檢查會通過**（hash 不是 MAC，那條靠人工比對兩頁的指紋，
  `pnpm handoff-url --tamper-recompute` 演得出來）
- HTTP server 只綁 loopback（`netstat` 確認），非白名單 Origin 一律 403（六種來源逐一實測）

## 還沒驗證

**錢包那一段的端到端。** `eth_requestAccounts` → 切鏈 → `eth_sendTransaction` → 錢包彈窗，
需要真的裝了錢包的瀏覽器，開發環境沒有。要在實機跑一次。

跑法：`pnpm build:all` → 重開 Claude Desktop → 問質押 → 按「在錢包裡簽名」→ 確認
開得出頁、指紋跟面板上那串一樣、錢包有跳出來。**先別按最後那顆送出**，只驗路徑。

## 部署前要做的

- 選一個雲端 endpoint（Cloudflare Workers / Fly.io / Render 都可以）
- 部署 `src/mcp/http.ts`，設 `PUBLIC_URL`、`HOST=0.0.0.0`（預設只綁 loopback，不設對外連不到）
  以及 `ALLOWED_ORIGINS`（記得含 `https://claude.ai`，不然 Connectors 會吃 403）
- demo 前完整跑一次「貼 URL 加 connector → 觸發工具 → 面板渲染 → 交接到簽名頁」
- 不要當天才架隧道：ngrok 免費版的攔截頁會擋 handshake，cloudflared 的網址每次重啟會變
