# Vigil MCP — 安装与接线

[English](MCP-SETUP.md) | **简体中文** | [繁體中文](MCP-SETUP.zh-TW.md)

Vigil 是通过 [MCP](https://modelcontextprotocol.io/) 提供的签名前交易证据面板。agent 准备好一笔 Monad 交易后，Vigil 对主网跑模拟，把实际会发生什么渲染在对话里。

三种跑法：**stdio**（本机，最快）、**HTTP**（部署后给 remote connector 用）、**Cloudflare Workers**（线上那份用的就是这个）。

---

## 装法一：stdio（本机，最快）

```bash
cd <repo>/app
pnpm install        # 会一并建 vendor 里的 Moss，不需要外部 checkout
pnpm build:all      # 建面板、签名页、MCP server
```

配置文件在 `%APPDATA%\Claude\claude_desktop_config.json`（macOS 是
`~/Library/Application Support/Claude/`），跟 `preferences` 同一层加一个 key，
**保留原本的内容**：

```json
"mcpServers": {
  "vigil": {
    "command": "node",
    "args": ["<你的绝对路径>/app/dist/cli.js"]
  }
}
```

存盘后**完全退出 Claude Desktop 再重开**（关窗口不够）。

> 为什么用 `node` 加绝对路径：pnpm 会把消息写到 stdout，混进 JSON-RPC 会破坏协议；
> 打包后的 `dist/cli.js` 从任意目录启动都能跑。

启动时 stderr 会打印签名页的位置：

```
Vigil 签名页：http://127.0.0.1:52835/sign
```

端口每次不同（临时端口，不跟已有服务抢）。要固定就设 `SIGN_PORT`。

### 签名页托管在外面（`SIGN_PAGE_URL`）

```json
"mcpServers": {
  "vigil": {
    "command": "node",
    "args": ["<你的绝对路径>/app/dist/cli.js"],
    "env": { "SIGN_PAGE_URL": "https://你的域名/sign/" }
  }
}
```

设了就不起本机 server，面板直接指过去。

**为什么需要**：本机模式的签名页是 `http://127.0.0.1:<浮动端口>`，而 MCP host
对面板能打开哪些网址有策略——localhost 加浮动端口是最容易被拦的形状。指到固定的
https 网址通常就不再被拦。

签名页是完全自包含的静态 HTML：交易数据放在网址的 `#` 后面，fragment 不会进
HTTP 请求，所以**交易内容不会送到托管这一页的服务器上**，不需要后端。

技术上它可以放在任何静态托管，但**建议只放一个地方**，官方那份就在 worker 的
`/sign`。理由不是安全模型会变，是那一页「只读网址」的性质让任何人都做得出一个
指向它的链接——所以它必须自己解 calldata、不挂「主网模拟」徽章、解出授权时不
自动叫钱包（见 `src/sign/calldata.ts`）。每多一份托管就多一个要维持这些性质的
地方，而各份的更新路径不一样：worker 是 build 时内嵌，静态托管是复制文件。
2026-08-09 就漂过一次，两边版本不同了几个小时都没有人发现。

---

## 装法二：HTTP（部署用）

```bash
pnpm mcp:http                                   # http://127.0.0.1:8848
PORT=3000 PUBLIC_URL=https://你的域名 HOST=0.0.0.0 \
  ALLOWED_ORIGINS=https://你的域名 pnpm mcp:http   # 部署时
```

同一个 process 提供三件事：

| 路径 | 用途 |
|---|---|
| `POST /mcp` | MCP 端点，无状态模式 |
| `GET /sign` | 签名页 |
| `GET /health` | 健康检查，回报签名页位置 |

**`PUBLIC_URL` 要填用户的浏览器连得到的位置**，不是这个 process 自己看到的。
容器里这两者常常不一样，填错的话面板会叫浏览器去打开一个连不到的网址。

### 绑定与来源

**默认只绑 `127.0.0.1`。** 要对外开才设 `HOST=0.0.0.0`。

**Origin 校验。** 只放行：

| Origin | 结果 |
|---|---|
| 没带（Claude Desktop 这类原生程序、curl） | 放行。浏览器发跨源请求一定会带，所以这不是浏览器攻击面 |
| `https://claude.ai` 与其子域名 | 放行 |
| `http://localhost:<PORT>`、`http://127.0.0.1:<PORT>` | 放行 |
| 其他 | 403 `Origin not allowed.` |

`ALLOWED_ORIGINS` 用逗号分隔可以覆盖整份清单。**明确设了就只认清单**，
`claude.ai` 的通配规则不再套用——部署时记得把 `https://claude.ai` 一起列进去。

> Claude Desktop 的 Connectors 只收 https，本机这条要配隧道或部署才接得上。

## 装法三：Cloudflare Workers（线上部署）

同一个 server core，改跑 Web Standard（fetch handler）：MCP SDK 的
`WebStandardStreamableHTTPServerTransport` 原生支持 Workers。面板与签名页
HTML 在构建时内嵌（Workers 没有 fs）。

```bash
pnpm build:worker        # dist/worker.js（esbuild bundle，含内嵌 HTML）
npx wrangler login       # 首次：浏览器 OAuth 授权
pnpm worker:deploy       # 部署到 https://vigil-mcp.<你的子域>.workers.dev
```

`wrangler.toml` 的 `PUBLIC_URL` 要填部署后的实际网址（面板拿它打开签名页），
`ALLOWED_ORIGINS` 用逗号分隔列出允许的浏览器来源。

Worker 与 http.ts 行为一致：`POST /mcp`（无状态）、`GET /sign`（no-store）、
`GET /health`、Origin 检查（不在清单直接 403）、无状态不支持 server 推送（405）。

**改过面板或签名页之后，只跑 `pnpm worker:deploy` 是不够的**——它们是构建时内嵌
进 bundle 的，要先 `pnpm build:worker`，不然推上去的还是旧 HTML。

---

## 各 host 的呈现形式

Vigil 用 MCP Apps extension（`io.modelcontextprotocol/ui`）渲染 HTML 面板；不支持的 host
自动降级成文字面板（ANSI 上色可用 `VIGIL_COLOR=1` 打开）。支持与否由 host 在握手时
自己声明（`extensions` 字段），不是 Vigil 猜的。

| Host | 呈现 | 安装方式 |
|---|---|---|
| Claude 网页版（Connectors） | **HTML 面板** | remote URL（`https://<endpoint>/mcp`） |
| Claude Desktop | **HTML 面板** | stdio config（装法一） |
| ChatGPT | **HTML 面板** | remote URL |
| Cursor 2.6+ | **HTML 面板** | mcpServers JSON |
| VS Code Copilot / Goose / Postman / MCPJam / M365 Copilot / Archestra / PostHog Code | **HTML 面板** | 各自格式 |
| Claude Code | 文字面板 | `claude mcp add` |
| Codex | 文字面板 | `codex mcp add vigil --command node --args …` |
| Hermes Agent | 文字面板 | config.yaml `mcp_servers` |
| OpenCode | 文字面板 | opencode.json `type: "local"` + `command` 数组 |

官方 matrix（社区维护）：<https://modelcontextprotocol.io/extensions/client-matrix>

---

## 为什么签名要另开一页

MCP App 的面板跑在 sandbox iframe 里，**碰不到 `window.ethereum`**——那是规范定的
隔离，不是实现缺漏。所以签名一定要在一个不在 sandbox 里的页面完成。

那一页必须从 **http(s)** 提供，不能是 `file://`——MetaMask 默认不注入 `file://`
页面。这就是为什么要起一个小 server 而不是直接打开文件。

---

## 试一下

在对话里说：

> 用 vigil 帮我看一下，我要质押 0.25 MON

它会调用 `preview_transaction`，对 Monad 主网跑真实模拟，面板渲染在对话里。

**默认的模拟账户主网上只有 0.001 MON**，付不起任何一笔交易，所以会显示「余额不够、
不能签」。那是真话不是坏掉——Vigil 拿真实余额对，不吃模拟时盖上去的余额。
要看通过的样子，在请求里带自己的地址。
