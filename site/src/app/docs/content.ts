/**
 * /docs 內容（en + zh-TW 雙語；其他語系 fallback en）。
 * 內容事實來源：app/src/mcp/server.ts（工具清單）與 app/MCP-SETUP.md。
 */

export type DocsContent = {
  navDocs: string;
  index: {
    tag: string;
    title: string;
    sub: string;
    sections: { href: string; title: string; body: string }[];
    back: string;
  };
  features: {
    tag: string;
    title: string;
    sub: string;
    toolsTag: string;
    tools: {
      name: string;
      badge: string;
      title: string;
      body: string;
      detail: string;
    }[];
    resourceTag: string;
    resources: { uri: string; title: string; body: string }[];
    transportTag: string;
    transports: { name: string; title: string; body: string }[];
    signTag: string;
    sign: { title: string; body: string; points: string[] };
  };
};

export const DOCS: Record<"en" | "zh-TW", DocsContent> = {
  en: {
    navDocs: "Docs",
    index: {
      tag: "Vigil · Docs",
      title: "Documentation",
      sub: "How Vigil works, what it can simulate, and where the trust boundaries are.",
      sections: [
        {
          href: "/docs/features",
          title: "MCP capabilities",
          body: "The tools Vigil exposes over MCP — preview, recall, discover, remember — and the HTML panel resource.",
        },
        {
          href: "/docs/features#transport",
          title: "Transports",
          body: "Run Vigil locally over stdio, or host it over HTTP for remote connectors (Claude web, ChatGPT).",
        },
        {
          href: "/docs/features#sign",
          title: "Signing page",
          body: "Why signing happens on a separate page, and how the transaction travels without touching a server.",
        },
      ],
      back: "Back to home",
    },
    features: {
      tag: "Vigil · MCP capabilities",
      title: "What Vigil can do",
      sub: "Four tools and one HTML resource over MCP. The evidence comes from executing against a Monad node — not from whatever prepared the transaction.",
      toolsTag: "Tools",
      tools: [
        {
          name: "preview_transaction",
          badge: "core",
          title: "Preview a transaction before signing",
          body: "Simulate a prepared Monad transaction and show the user what it will actually do. Returns a structured evidence view plus a text fallback for CLI hosts.",
          detail:
            "Takes the user's own words (statedRequest, quoted verbatim, max 2000 chars), the protocol.method, parameters, an optional account, and a panel locale. The evidence is computed by executing against a Monad node — the agent's description never replaces execution.",
        },
        {
          name: "recent_previews",
          badge: "recall",
          title: "What this session has previewed",
          body: "List the transactions previewed in this session, newest first: what the agent said the user asked for, the structural verdict, and the handoff fingerprint.",
          detail:
            "These are previews, not signatures — signing happens in the user's own wallet, and Vigil never learns the outcome. Use it to answer 'what was that earlier transaction' without scrolling back.",
        },
        {
          name: "discover",
          badge: "data",
          title: "What this server can simulate",
          body: "List the operations Vigil can preview: protocol.method, a one-line summary, and the exact parameters each one takes.",
          detail:
            "Agents call this first when the user asks to do something on-chain. Query-like reads (balances, allowances) are omitted — you don't sign for a read.",
        },
        {
          name: "remember_account",
          badge: "session",
          title: "Remember the user's wallet address",
          body: "Store the user's own wallet address for the rest of this conversation, so later previews simulate against their real balance.",
          detail:
            "Honest boundary: the address is remembered, not verified. The panel still marks it 'agent-provided, unverified', and the signing page checks it against the wallet. Memory is in-process only — it never persists across sessions, and stateless HTTP deployments don't support it at all.",
        },
      ],
      resourceTag: "HTML panel resource",
      resources: [
        {
          uri: "ui://vigil/panel.html",
          title: "The evidence panel",
          body: "Hosts that support MCP Apps (Claude web, Claude Desktop, ChatGPT, Cursor 2.6+, VS Code Copilot, Goose, and others per the official client matrix) render this resource as an HTML panel. Hosts without support automatically fall back to the text view — the same evidence, plain text.",
        },
      ],
      transportTag: "Transports",
      transports: [
        {
          name: "stdio",
          title: "Local, fastest",
          body: "One command in your terminal. The server binds a sign page on 127.0.0.1 and the panel works offline. Best for local development and CLI agents.",
        },
        {
          name: "HTTP",
          title: "Remote, for connectors",
          body: "One process serves /mcp, /sign, and /health. This is what Claude web and ChatGPT connectors need — a public https URL. Note: remote connectors reach your server from Anthropic's/OpenAI's cloud, so it must be publicly reachable; a localhost tunnel works, a private network doesn't.",
        },
      ],
      signTag: "Signing page",
      sign: {
        title: "Why signing happens on a separate page",
        body: "The MCP Apps panel runs in a sandboxed iframe that cannot reach window.ethereum — that isolation is in the spec, not a missing feature. So signing happens on a dedicated page served over http(s).",
        points: [
          "The transaction data travels in the URL fragment (#), which never goes in an HTTP request — the host serving the page never sees the transaction.",
          "A fingerprint appears on both the panel and the signing page; if anything swapped the transaction in between, the fingerprints diverge.",
          "If the wallet account doesn't match the address in the transaction, the page refuses to send it.",
        ],
      },
    },
  },
  "zh-TW": {
    navDocs: "文件",
    index: {
      tag: "Vigil · 文件",
      title: "文件",
      sub: "Vigil 怎麼運作、能模擬什麼、信任邊界在哪裡。",
      sections: [
        {
          href: "/docs/features",
          title: "MCP 功能",
          body: "Vigil 透過 MCP 暴露的工具——preview、recall、discover、remember——以及 HTML 面板資源。",
        },
        {
          href: "/docs/features#transport",
          title: "傳輸方式",
          body: "本機用 stdio 跑，或架 HTTP 給 remote connector 用（Claude web、ChatGPT）。",
        },
        {
          href: "/docs/features#sign",
          title: "簽名頁",
          body: "為什麼簽名要另開一頁，以及交易資料如何不經伺服器傳遞。",
        },
      ],
      back: "回首頁",
    },
    features: {
      tag: "Vigil · MCP 功能",
      title: "Vigil 能做什麼",
      sub: "透過 MCP 提供四個工具和一個 HTML 資源。證據來自對 Monad 節點的實際執行——不是準備交易的那一方說了算。",
      toolsTag: "工具",
      tools: [
        {
          name: "preview_transaction",
          badge: "核心",
          title: "簽名前預覽交易",
          body: "模擬一筆準備好的 Monad 交易，顯示它實際會做什麼。回傳結構化證據視圖，加上給 CLI host 的文字降級版。",
          detail:
            "帶入使用者自己的話（statedRequest，逐字引用，最多 2000 字元）、protocol.method、參數、可選帳戶與面板語系。證據是對 Monad 節點執行算出來的——agent 的描述永遠不能取代執行。",
        },
        {
          name: "recent_previews",
          badge: "回顧",
          title: "這個 session 看過哪些交易",
          body: "列出本 session 預覽過的交易，最新優先：agent 說使用者要求了什麼、結構判定、交接指紋。",
          detail:
            "這些是預覽不是簽名——簽名發生在使用者自己的錢包裡，Vigil 永遠不知道結果。用來回答「剛才那筆是什麼」而不必往回翻對話。",
        },
        {
          name: "discover",
          badge: "資料",
          title: "這個 server 能模擬什麼",
          body: "列出 Vigil 能預覽的操作：protocol.method、一句話摘要、每個操作需要的確切參數。",
          detail:
            "使用者要求做鏈上操作時，agent 先呼叫這個。查詢類讀取（餘額、allowance）被省略——讀取不需要簽名。",
        },
        {
          name: "remember_account",
          badge: "session",
          title: "記住使用者的錢包地址",
          body: "在這個對話裡記住使用者自己的錢包地址，之後的預覽用真實餘額模擬。",
          detail:
            "誠實邊界：地址只是記住，不是驗證。面板照樣標「agent 提供的、沒驗過」，簽名頁也會跟錢包比對。記憶只在記憶體、session 結束消失；無狀態 HTTP 部署完全不支援。",
        },
      ],
      resourceTag: "HTML 面板資源",
      resources: [
        {
          uri: "ui://vigil/panel.html",
          title: "證據面板",
          body: "支援 MCP Apps 的 host（Claude web、Claude Desktop、ChatGPT、Cursor 2.6+、VS Code Copilot、Goose 等，依官方 client matrix）把這個資源渲染成 HTML 面板。不支援的 host 自動降級成文字視圖——同樣的證據，純文字。",
        },
      ],
      transportTag: "傳輸方式",
      transports: [
        {
          name: "stdio",
          title: "本機，最快",
          body: "終端機一行指令。server 在 127.0.0.1 起簽名頁，面板可離線運作。最適合本機開發與 CLI agent。",
        },
        {
          name: "HTTP",
          title: "遠端，給 connector 用",
          body: "一個 process 提供 /mcp、/sign、/health。這是 Claude web 和 ChatGPT connector 需要的——公開 https 網址。注意：remote connector 是從 Anthropic/OpenAI 的雲端連你的 server，必須公開可達；本機隧道可以，內網不行。",
        },
      ],
      signTag: "簽名頁",
      sign: {
        title: "為什麼簽名要另開一頁",
        body: "MCP Apps 面板跑在 sandbox iframe 裡，碰不到 window.ethereum——那是規格定的隔離，不是實作缺漏。所以簽名一定要在 http(s) 提供的獨立頁面完成。",
        points: [
          "交易資料放在網址 fragment（#）後面，不會進 HTTP 請求——託管頁面的伺服器永遠看不到交易內容。",
          "面板和簽名頁顯示同一串指紋；中間有人偷換交易，指紋就會不一致。",
          "錢包帳戶跟交易裡的地址不符時，頁面拒絕送出。",
        ],
      },
    },
  },
};

/** 依 locale 取 docs 內容；非 en/zh-TW 語系 fallback 到 en。 */
export function docsFor(locale: string): DocsContent {
  return DOCS[locale === "zh-TW" ? "zh-TW" : "en"];
}
