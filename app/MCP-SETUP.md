# Vigil MCP — install and wiring

**English** | [简体中文](MCP-SETUP.zh-CN.md) | [繁體中文](MCP-SETUP.zh-TW.md)

Vigil is a pre-sign evidence panel delivered over [MCP](https://modelcontextprotocol.io/).
Once an agent has prepared a Monad transaction, Vigil simulates it against
mainnet and renders what will actually happen inside the conversation.

Three ways to run it: **stdio** (local, quickest), **HTTP** (for a remote
connector), and **Cloudflare Workers** (what the hosted instance runs on).

---

## Option 1: stdio (local, quickest)

```bash
cd <repo>/app
pnpm install        # also builds the vendored Moss, no external checkout needed
pnpm build:all      # panel, signing page, MCP server
```

The config file is at `%APPDATA%\Claude\claude_desktop_config.json` (on macOS,
`~/Library/Application Support/Claude/`). Add one key next to `preferences` and
**keep whatever is already in the file**:

```json
"mcpServers": {
  "vigil": {
    "command": "node",
    "args": ["<your absolute path>/app/dist/cli.js"]
  }
}
```

Save, then **quit Claude Desktop completely and reopen it**. Closing the window
is not enough.

> Why `node` with an absolute path: pnpm writes messages to stdout, and anything
> mixed into stdout breaks the JSON-RPC stream. The bundled `dist/cli.js` starts
> from any working directory.

On startup the signing page location is printed to stderr:

```
Vigil sign page: http://127.0.0.1:52835/sign
```

The port differs every run (an ephemeral port, so it will not collide with
something you already have). Set `SIGN_PORT` to pin it.

### Hosting the signing page elsewhere (`SIGN_PAGE_URL`)

```json
"mcpServers": {
  "vigil": {
    "command": "node",
    "args": ["<your absolute path>/app/dist/cli.js"],
    "env": { "SIGN_PAGE_URL": "https://your-domain/sign/" }
  }
}
```

With this set, no local server starts and the panel points straight at that URL.

**Why you would want it:** in local mode the signing page is
`http://127.0.0.1:<floating port>`, and MCP hosts have policies about which URLs
a panel may open. Localhost plus a floating port is the shape most likely to be
blocked. A fixed https URL usually is not.

The signing page is fully self-contained static HTML. The transaction rides in
the URL fragment, and browsers do not put the fragment in the HTTP request, so
**the transaction never reaches the server hosting that page**. It needs no
backend.

Technically it can go on any static host, but **put it in exactly one place**.
The official copy is the worker's `/sign`. The reason is not that the trust
model changes; it is that a page which reads only its URL can be linked to by
anyone, so it has to decode the calldata itself, carry no "mainnet simulation"
badge, and refuse to auto-open the wallet on an approval (see
`src/sign/calldata.ts`). Every extra copy is another place those properties have
to hold, and the copies update by different routes: the worker embeds the HTML
at build time, a static host copies the file. On 2026-08-09 they drifted, and
the two were on different versions for hours before anyone noticed.

---

## Option 2: HTTP (for deployment)

```bash
pnpm mcp:http                                     # http://127.0.0.1:8848
PORT=3000 PUBLIC_URL=https://your-domain HOST=0.0.0.0 \
  ALLOWED_ORIGINS=https://your-domain pnpm mcp:http   # deployed
```

One process serves three things:

| Path | Purpose |
|---|---|
| `POST /mcp` | MCP endpoint, stateless mode |
| `GET /sign` | Signing page |
| `GET /health` | Health check, reports the signing page location |

**`PUBLIC_URL` must be the address the user's browser can reach**, not the one
this process sees for itself. Inside a container those are often different, and
getting it wrong means the panel tells the browser to open a URL that does not
resolve.

### Binding and origins

**Binds `127.0.0.1` only by default.** Set `HOST=0.0.0.0` to expose it.

**Origin checking.** What gets through:

| Origin | Result |
|---|---|
| Absent (native apps like Claude Desktop, curl) | Allowed. A browser always sends one on a cross-origin request, so this is not a browser attack surface |
| `https://claude.ai` and its subdomains | Allowed |
| `http://localhost:<PORT>`, `http://127.0.0.1:<PORT>` | Allowed |
| Anything else | 403 `Origin not allowed.` |

`ALLOWED_ORIGINS` takes a comma-separated list and replaces the whole set.
**Set it and only the list applies** — the `claude.ai` wildcard rule stops
applying, so remember to include `https://claude.ai` yourself when deploying.

> Claude Desktop's Connectors only accept https, so this one needs a tunnel or a
> real deployment before it will connect.

## Option 3: Cloudflare Workers (the hosted deployment)

Same server core on a Web Standard fetch handler: the MCP SDK's
`WebStandardStreamableHTTPServerTransport` supports Workers natively. The panel
and signing page HTML are embedded at build time, since Workers has no fs.

```bash
pnpm build:worker        # dist/worker.js (esbuild bundle with the HTML inlined)
npx wrangler login       # first time: browser OAuth
pnpm worker:deploy       # deploys to https://vigil-mcp.<your subdomain>.workers.dev
```

`PUBLIC_URL` in `wrangler.toml` has to be the real post-deploy address, since
the panel uses it to open the signing page. `ALLOWED_ORIGINS` is the
comma-separated list of browser origins to allow.

The worker behaves the same as the express version: `POST /mcp` (stateless),
`GET /sign` (no-store), `GET /health`, origin checking (403 when not listed),
and 405 for anything that would need server-initiated messages.

**`pnpm worker:deploy` alone is not enough after changing the panel or signing
page** — they are inlined at build time, so run `pnpm build:worker` first or you
will redeploy the old HTML.

---

## What each host shows

Vigil renders the HTML panel through the MCP Apps extension
(`io.modelcontextprotocol/ui`). Hosts that do not support it fall back to a text
panel automatically (`VIGIL_COLOR=1` turns on ANSI colour). Support is whatever
the host declares in its `extensions` field during the handshake, not something
Vigil guesses.

| Host | Shows | How to install |
|---|---|---|
| Claude web (Connectors) | **HTML panel** | Remote URL (`https://<endpoint>/mcp`) |
| Claude Desktop | **HTML panel** | stdio config (option 1) |
| ChatGPT | **HTML panel** | Remote URL |
| Cursor 2.6+ | **HTML panel** | mcpServers JSON |
| VS Code Copilot / Goose / Postman / MCPJam / M365 Copilot / Archestra / PostHog Code | **HTML panel** | Their own formats |
| Claude Code | Text panel | `claude mcp add` |
| Codex | Text panel | `codex mcp add vigil --command node --args …` |
| Hermes Agent | Text panel | config.yaml `mcp_servers` |
| OpenCode | Text panel | opencode.json `type: "local"` plus a `command` array |

Community-maintained matrix:
<https://modelcontextprotocol.io/extensions/client-matrix>

---

## Why signing opens a separate page

The MCP App panel runs in a sandboxed iframe and **cannot reach
`window.ethereum`**. That isolation is in the spec, not a gap in the
implementation, so signing has to happen on a page outside the sandbox.

That page has to be served over **http(s)**, not `file://`. MetaMask does not
inject into `file://` pages by default. That is why there is a small server
rather than a file opened directly.

---

## Try it

Say this in the conversation:

> use vigil to check this for me, I want to stake 0.25 MON

It calls `preview_transaction`, runs a real simulation against Monad mainnet,
and renders the panel in the conversation.

**The default simulation account holds 0.001 MON on mainnet.** It cannot pay for
any transaction, so you will see "not enough balance, cannot sign". That is
correct, not broken: Vigil checks the real balance and ignores the one the
simulator writes over it. To see the passing case, include your own address in
the request.
