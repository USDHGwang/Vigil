# Vigil MCP — 安裝與接線

Vigil 是透過 [MCP](https://modelcontextprotocol.io/) 提供的簽名前交易證據面板。agent 準備好一筆 Monad 交易後，Vigil 對主網跑模擬，把實際會發生什麼渲染在對話裡。

支援兩種傳輸：**stdio**（本機，最快）與 **HTTP**（部署後給 remote connector 用）。

---

## 裝法一：stdio（本機，最快）

```bash
cd <repo>/app
pnpm install        # 自動建 vendor 裡的 Moss，不需要外部 checkout
pnpm build:all      # 建面板、簽名頁、MCP server
```

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

> 為什麼用 `node` 加絕對路徑：pnpm 會把訊息寫到 stdout，混進 JSON-RPC 會壞掉協定；
> 打包後的 `dist/cli.js` 從任意目錄啟動都通。

啟動時 stderr 會印簽名頁的位置：

```
Vigil 簽名頁：http://127.0.0.1:52835/sign
```

port 每次不同（臨時 port，不跟既有服務搶）。要固定就設 `SIGN_PORT`。

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

**為什麼需要**：本機模式的簽名頁是 `http://127.0.0.1:<浮動 port>`，而 MCP host
對面板能開哪些網址有政策——localhost 加浮動 port 是最容易被擋的形狀。指到固定的
https 網址通常就不再被擋。

簽名頁是完全自包含的靜態 HTML：交易資料放在網址的 `#` 後面，fragment 不會進
HTTP 請求，所以**交易內容不會送到託管這一頁的伺服器上**——它可以放在任何靜態
託管（GitHub Pages、Cloudflare Pages），不需要後端，信任模型也不因為換託管方
而改變。

---

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
| `GET /health` | 健康檢查，回報簽名頁位置 |

**`PUBLIC_URL` 要填使用者的瀏覽器連得到的位置**，不是這個 process 自己看到的。
容器裡這兩者常常不一樣，填錯的話面板會叫瀏覽器去開一個連不到的網址。

### 綁定與來源

**預設只綁 `127.0.0.1`。** 要對外開才設 `HOST=0.0.0.0`。

**Origin 驗證。** 只放行：

| Origin | 結果 |
|---|---|
| 沒帶（Claude Desktop 這類原生程式、curl） | 放行。瀏覽器發跨來源請求一定會帶，所以這不是瀏覽器攻擊面 |
| `https://claude.ai` 與其子網域 | 放行 |
| `http://localhost:<PORT>`、`http://127.0.0.1:<PORT>` | 放行 |
| 其他 | 403 `Origin not allowed.` |

`ALLOWED_ORIGINS` 用逗號分隔可以覆寫整份清單。**明確設了就只認清單**，
`claude.ai` 的萬用規則不再套用——部署時記得把 `https://claude.ai` 一起列進去。

> Claude Desktop 的 Connectors 只收 https，本機這條要配隧道或部署才接得上。

---

## 各 host 的呈現形式

Vigil 用 MCP Apps extension（`io.modelcontextprotocol/ui`）渲染 HTML 面板；不支援的 host
自動降級成文字面板（ANSI 上色可用 `VIGIL_COLOR=1` 開啟）。支援與否由 host 在握手時
自己宣告（`extensions` 欄位），不是 Vigil 猜的。

| Host | 呈現 | 安裝方式 |
|---|---|---|
| Claude 網頁版（Connectors） | **HTML 面板** | remote URL（`https://<endpoint>/mcp`） |
| Claude Desktop | **HTML 面板** | stdio config（裝法一） |
| ChatGPT | **HTML 面板** | remote URL |
| Cursor 2.6+ | **HTML 面板** | mcpServers JSON |
| VS Code Copilot / Goose / Postman / MCPJam / M365 Copilot / Archestra / PostHog Code | **HTML 面板** | 各自格式 |
| Claude Code | 文字面板 | `claude mcp add` |
| Codex | 文字面板 | `codex mcp add vigil --command node --args …` |
| Hermes Agent | 文字面板 | config.yaml `mcp_servers` |
| OpenCode | 文字面板 | opencode.json `type: "local"` + `command` 陣列 |

官方 matrix（社群維護）：<https://modelcontextprotocol.io/extensions/client-matrix>

---

## 為什麼簽名要另開一頁

MCP App 的面板跑在 sandbox iframe 裡，**碰不到 `window.ethereum`**——那是規格定的
隔離，不是實作缺漏。所以簽名一定要在一個不在 sandbox 裡的頁面完成。

那一頁必須從 **http(s)** 提供，不能是 `file://`——MetaMask 預設不注入 `file://`
頁面。這就是為什麼要起一個小 server 而不是直接開檔案。

---

## 試一下

在對話裡說：

> 用 vigil 幫我看一下，我要質押 0.25 MON

它會呼叫 `preview_transaction`，對 Monad 主網跑真實模擬，面板渲染在對話裡。

**預設的模擬帳戶主網上只有 0.001 MON**，付不起任何一筆交易，所以會顯示「餘額不夠、
不能簽」。那是真話不是壞掉——Vigil 拿真實餘額對，不吃模擬時蓋上去的餘額。
要看通過的樣子，在請求裡帶自己的地址。
