"use client";

/**
 * 語言切換 — en / zh-TW / zh-CN / ja / ko。
 *
 * 原則（John 2026-08 定案）：
 *  - 切換器用「地球 icon + dropdown」大廠標準（不是廉價的中/EN 開關）。
 *  - 品牌 mono 標籤與程式語彙（Vigil、TRACE、MONAD NODE、debug_traceCall、
 *    stake、shMONAD、calldata、指紋字串）刻意不翻——那是產品本體。
 *  - 只翻敘事文案與 UI 字：hero / 段落 / CTA / mechanism / evidence /
 *    showcase 六幕標題與場景標籤。
 *  - 語言狀態 React context 全域共享 + localStorage 記住選擇。
 */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Locale = "en" | "zh-TW" | "zh-CN" | "ja" | "ko";

/** 語系元資料：dropdown 標籤 + <html lang> */
export const LANGUAGES: { code: Locale; label: string; htmlLang: string }[] = [
  { code: "en", label: "English", htmlLang: "en" },
  { code: "zh-TW", label: "繁體中文", htmlLang: "zh-TW" },
  { code: "zh-CN", label: "简体中文", htmlLang: "zh-CN" },
  { code: "ja", label: "日本語", htmlLang: "ja" },
  { code: "ko", label: "한국어", htmlLang: "ko" },
];

const LocaleContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
}>({
  locale: "en",
  setLocale: () => {},
});

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<Locale>("en");

  // 記住使用者選擇（下次造訪沿用）
  useEffect(() => {
    const saved = localStorage.getItem("vigil:locale");
    if (LANGUAGES.some((l) => l.code === saved)) setLocale(saved as Locale);
  }, []);

  // <html lang> 要跟著切。螢幕閱讀器用它挑發音、瀏覽器用它決定要不要提議翻譯。
  useEffect(() => {
    const meta = LANGUAGES.find((l) => l.code === locale);
    document.documentElement.lang = meta?.htmlLang ?? "en";
  }, [locale]);

  const set = (l: Locale) => {
    setLocale(l);
    try {
      localStorage.setItem("vigil:locale", l);
    } catch {
      /* localStorage 不可用時忽略 */
    }
  };

  return (
    <LocaleContext.Provider value={{ locale, setLocale: set }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  return useContext(LocaleContext);
}

/**
 * 全頁文案字典 — 5 語系。
 * 品牌 mono 標籤（Vigil、TRACE 等）刻意不翻，維持品牌一致性。
 */
export const DICT = {
  en: {
    tagline: "Vigil — the night watchman",
    heroSee: "See.",
    heroReport: "Report.",
    heroDecide: "And let you decide.",
    heroSub: "The watchman sees, reports, and never decides for you — vigil, Latin.",
    ctaAdd: "Add Vigil to your agent",
    ctaHow: "See how it works",
    gapTag: "The gap",
    gapTitle: "You can't see behind the agent.",
    gapBody:
      "When you ask an agent to act on-chain, the only account of what it's doing is the agent's own description — and the agent is the one who built the transaction. A bug, a misunderstanding, or an injected instruction reads exactly like a normal request. Your only options are sign, or don't. Signing is irreversible.",
    howTag: "How it works",
    howTitle: "The receipt comes from execution, not from the agent.",
    howSteps: [
      { n: "01", title: "Prepare", body: "Your agent calls Vigil over MCP with the transaction it built." },
      { n: "02", title: "Simulate", body: "Vigil runs it against a Monad node. Nothing is broadcast." },
      { n: "03", title: "Compare", body: "Vigil sets what the node actually returned beside what your agent claimed — discrepancies surface on their own." },
    ],
    archTag: "From your words to the chain",
    archTitle: "How Vigil sees, step by step.",
    evidenceTag: "Evidence",
    navDocs: "Docs",
    evidenceTitle: "Evidence you can verify.",
    evidenceCards: [
      { title: "Runs on Monad mainnet", body: "A real simulation against a live node — not a mockup." },
      { title: "Every claim traces to its data", body: "Expand any finding to see the node's raw output." },
      { title: "A handoff fingerprint you can check", body: "The same short string appears on the panel and on the signing page. If anything swapped the transaction in between, you see it." },
    ],
    ctaLine1: "Your agent plans.",
    ctaLine2: "Vigil keeps watch.",
    footer: "Sign in your own wallet. Vigil never touches your private key.",
    footerTag: "Vigil — see, report, let you decide.",
    navGap: "The gap",
    navHow: "How it works",
    navEvidence: "Evidence",
        addShort: "Add",
    addPage: {
      title: "Add Vigil to your agent",
      sub: "Wire Vigil into any MCP-capable agent in minutes. It runs locally — previews hit the Monad mainnet, and your keys never leave your wallet.",
      stepCloneTitle: "1 · Clone and build",
      stepCloneBody: "The server is a Node app in this repo. Install and build — the panel and sign page come out self-contained.",
      localTag: "Local install — works today",
      cardAny: "Any MCP host",
      howClaudeWeb: "In claude.ai → Settings → Connectors, add the remote endpoint (your own tunnel or the hosted one). Renders the full panel.",
      stepsClaudeWeb: [
        "Open claude.ai → Customize → Connectors",
        "Click + → Add custom connector, paste the URL below",
        "Click Add — you're connected (Free plan gets one connector)",
      ],
      howGpt: "In ChatGPT → Settings → Apps & Connectors, add the remote endpoint (your own tunnel or the hosted one). Renders the full panel.",
      stepsChatGPT: [
        "Open ChatGPT → Settings → Apps & Connectors → Advanced Settings, enable Developer mode (paid plan)",
        "Click Create, paste the URL below",
        "Choose auth, click Create — you're connected",
      ],
      openInClaude: "Open in Claude",
      openInGpt: "Open in ChatGPT",
      howClaude: "Paste into claude_desktop_config.json, then fully quit and reopen Claude Desktop.",
      stepsClaudeDesktop: [
        "Open claude_desktop_config.json",
        "Paste the config below",
        "Fully quit and reopen Claude Desktop",
      ],
      howCode: "Run once in your terminal — user scope, available everywhere.",
      stepsCode: [
        "Run the command below once in your terminal",
        "Restart Claude Code and verify with /mcp",
      ],
      howCodex: "Run once in your terminal — registers the server in ~/.codex/config.toml.",
      stepsCodex: [
        "Run the command below once in your terminal",
        "Restart Codex",
      ],
      howHermes: "Add under mcp_servers in ~/.hermes/config.yaml, then restart Hermes.",
      stepsHermes: [
        "Edit ~/.hermes/config.yaml",
        "Paste the mcp_servers block below",
        "Restart Hermes",
      ],
      howOpenCode: "Add the block to your opencode.json (global or project).",
      stepsOpenCode: [
        "Edit opencode.json (global or project)",
        "Paste the block below",
        "Restart OpenCode",
      ],
      howAny: "Most MCP hosts (Cursor, Windsurf, VS Code…) accept the same mcpServers JSON.",
      stepsAny: [
        "Open your host's MCP settings",
        "Paste the JSON below",
        "Restart the host",
      ],
      remoteTag: "Remote endpoint",
      remoteNote: "Claude Desktop Connectors and ChatGPT require an https URL. Ours ships with the demo deployment — or run pnpm mcp:http and tunnel it yourself.",
      copy: "Copy",
      copied: "Copied",
      trust: "Evidence comes from simulating on the Monad mainnet — not from the agent that built the transaction. Vigil never touches your private key.",
      docs: "Full install notes on GitHub →",
    },
    showcase: {
      acts: [
        { num: "01", title: "You say a word", body: "Your intent takes shape. Nothing is built yet." },
        { num: "02", title: "The agent builds", body: "The transaction is constructed — where it goes, what it does." },
        { num: "03", title: "Simulated on mainnet", body: "The chain runs it first. The node answers what would actually happen." },
        { num: "04", title: "Verified", body: "What the agent claimed is checked against what the node returned." },
        { num: "05", title: "The fingerprint", body: "The handoff gets a fingerprint you can verify anywhere." },
        { num: "06", title: "You decide", body: "The proof reaches you first. Then your call — nothing broadcasts without you." },
      ],
      scene: {
        bubble: "Help me stake my MON",
        simulate: "SIMULATE",
        resolved: "resolved",
        agentSaid: "AGENT SAID",
        chainReturned: "CHAIN RETURNED",
        panel: "PANEL",
        signPage: "SIGN PAGE",
        match: "MATCH",
        verified: "VERIFIED",
        youDecide: "YOU DECIDE",
        sign: "SIGN",
        reject: "REJECT",
        broadcasts: "broadcasts",
        nothingMoves: "nothing moves",
      },
    },
  },

  "zh-TW": {
    tagline: "Vigil — 守夜人",
    heroSee: "看見。",
    heroReport: "回報。",
    heroDecide: "決定權在你。",
    heroSub: "守夜人只負責看見、回報、不替你決定 — vigil，拉丁語。",
    ctaAdd: "將 Vigil 加到你的 Agent",
    ctaHow: "看看它怎麼運作",
    gapTag: "缺口",
    gapTitle: "你看不見 agent 背後做了什麼。",
    gapBody:
      "當你叫 agent 在鏈上做事，唯一能得知它做了什麼的，是 agent 自己的描述——而 agent 就是構造那筆交易的一方。一個 bug、一次誤解、或一段被注入的指令，讀起來跟正常請求一模一樣。你只有兩個選擇：簽，或不簽。簽了就無法挽回。",
    howTag: "運作方式",
    howTitle: "證據來自執行，不是來自 agent。",
    howSteps: [
      { n: "01", title: "準備", body: "你的 agent 透過 MCP 呼叫 Vigil，帶上它構造好的交易。" },
      { n: "02", title: "模擬", body: "Vigil 對 Monad 節點跑模擬。不會上鏈、不會廣播。" },
      { n: "03", title: "比對", body: "Vigil 把節點實際回傳的結果，與 agent 的宣稱並排陳列——差異自己現形。" },
    ],
    archTag: "從一句話到上鏈",
    archTitle: "Vigil 如何一步一步地看。",
    evidenceTag: "證據",
    navDocs: "文件",
    evidenceTitle: "你可查證的證據。",
    evidenceCards: [
      { title: "跑在 Monad 主網", body: "對真實節點的模擬，不是 mock。" },
      { title: "每條宣稱都能追到原始資料", body: "展開任何發現，看節點的原始輸出。" },
      { title: "可以核對的交接指紋", body: "面板與簽名頁顯示同一串短字串。中途有人把交易換掉，你看得出來。" },
    ],
    ctaLine1: "你的 agent 規劃。",
    ctaLine2: "Vigil 守著。",
    footer: "在你自己的錢包裡簽名。Vigil 永遠不碰你的私鑰。",
    footerTag: "Vigil — 看見、回報、決定權在你。",
    navGap: "缺口",
    navHow: "運作方式",
    navEvidence: "證據",
        addShort: "加入",
    addPage: {
      title: "把 Vigil 加進你的 Agent",
      sub: "幾分鐘內把 Vigil 接進任何支援 MCP 的 agent。它在本機執行——預覽對 Monad 主網真實模擬，私鑰永遠不離開你的錢包。",
      stepCloneTitle: "1 · 複製並建置",
      stepCloneBody: "server 是這個 repo 裡的 Node 應用。安裝並建置——面板與簽名頁都是自包含產物。",
      localTag: "本機安裝——今天就能用",
      cardAny: "任何 MCP host",
      howClaudeWeb: "在 claude.ai → Settings → Connectors 加入遠端端點（自己的隧道或託管版）。渲染完整面板。",
      stepsClaudeWeb: [
        "開啟 claude.ai → Customize → Connectors",
        "按 + → Add custom connector，貼上下方 URL",
        "按 Add——完成連線（Free 方案可用一個 connector）",
      ],
      howGpt: "在 ChatGPT → Settings → Apps & Connectors 加入遠端端點（自己的隧道或託管版）。渲染完整面板。",
      stepsChatGPT: [
        "開啟 ChatGPT → Settings → Apps & Connectors → Advanced Settings，開啟 Developer mode（需付費方案）",
        "按 Create，貼上下方 URL",
        "選擇驗證方式，按 Create——完成連線",
      ],
      openInClaude: "在 Claude 中開啟",
      openInGpt: "在 ChatGPT 中開啟",
      howClaude: "貼進 claude_desktop_config.json，然後完全結束並重開 Claude Desktop。",
      stepsClaudeDesktop: [
        "開啟 claude_desktop_config.json",
        "貼上下方設定",
        "完全結束並重開 Claude Desktop",
      ],
      howCode: "在終端機跑一次——user scope，處處可用。",
      stepsCode: [
        "在終端機執行下方指令一次",
        "重啟 Claude Code，用 /mcp 確認",
      ],
      howCodex: "在終端機跑一次——註冊進 ~/.codex/config.toml。",
      stepsCodex: [
        "在終端機執行下方指令一次",
        "重啟 Codex",
      ],
      howHermes: "在 ~/.hermes/config.yaml 的 mcp_servers 下加入，然後重啟 Hermes。",
      stepsHermes: [
        "編輯 ~/.hermes/config.yaml",
        "貼上下方 mcp_servers 區塊",
        "重啟 Hermes",
      ],
      howOpenCode: "把區塊加進你的 opencode.json（全域或專案）。",
      stepsOpenCode: [
        "編輯 opencode.json（全域或專案）",
        "貼上下方區塊",
        "重啟 OpenCode",
      ],
      howAny: "多數 MCP host（Cursor、Windsurf、VS Code…）吃同一份 mcpServers JSON。",
      stepsAny: [
        "打開你的 host 的 MCP 設定",
        "貼上下方 JSON",
        "重啟 host",
      ],
      remoteTag: "遠端端點",
      remoteNote: "Claude Desktop Connectors 與 ChatGPT 需要 https 網址。demo 部署時會上線——或自己跑 pnpm mcp:http 並開隧道。",
      copy: "複製",
      copied: "已複製",
      trust: "證據來自 Monad 主網模擬——不是來自構造交易的那個 agent。Vigil 永遠不碰你的私鑰。",
      docs: "GitHub 上的完整安裝說明 →",
    },
    showcase: {
      acts: [
        { num: "01", title: "你開口", body: "你的意圖成形。什麼都還沒上鏈。" },
        { num: "02", title: "agent 構造交易", body: "交易被構造出來——去向、動作。" },
        { num: "03", title: "主網模擬", body: "鏈先跑一遍。節點回答真正會發生什麼。" },
        { num: "04", title: "驗證", body: "agent 的宣稱，對照節點的回傳逐一查核。" },
        { num: "05", title: "指紋", body: "交接附上一串指紋，你在任何地方都能查核。" },
        { num: "06", title: "你決定", body: "證據先到。決定在你——你不簽，什麼都不會廣播。" },
      ],
      scene: {
        bubble: "幫我質押 MON",
        simulate: "模擬",
        resolved: "已處理",
        agentSaid: "AGENT 宣稱",
        chainReturned: "鏈的回傳",
        panel: "面板",
        signPage: "簽名頁",
        match: "吻合",
        verified: "已驗證",
        youDecide: "你決定",
        sign: "簽署",
        reject: "拒絕",
        broadcasts: "會廣播",
        nothingMoves: "什麼都不動",
      },
    },
  },

  "zh-CN": {
    tagline: "Vigil — 守夜人",
    heroSee: "看见。",
    heroReport: "回报。",
    heroDecide: "决定权在你。",
    heroSub: "守夜人只负责看见、回报、不替你决定 — vigil，拉丁语。",
    ctaAdd: "将 Vigil 加到你的 Agent",
    ctaHow: "看看它怎么运作",
    gapTag: "缺口",
    gapTitle: "你看不见 agent 背后做了什么。",
    gapBody:
      "当你叫 agent 在链上做事，唯一能得知它做了什么的是 agent 自己的描述——而 agent 就是构造那笔交易的一方。一个 bug、一次误解、或一段被注入的指令，读起来跟正常请求一模一样。你只有两个选择：签，或不签。签了就无法挽回。",
    howTag: "运作方式",
    howTitle: "证据来自执行，不是来自 agent。",
    howSteps: [
      { n: "01", title: "准备", body: "你的 agent 通过 MCP 调用 Vigil，带上它构造好的交易。" },
      { n: "02", title: "模拟", body: "Vigil 对 Monad 节点跑模拟。不会上链、不会广播。" },
      { n: "03", title: "比对", body: "Vigil 把节点实际回传的结果，与 agent 的宣称并排陈列——差异自己现形。" },
    ],
    archTag: "从一句话到上链",
    archTitle: "Vigil 如何一步一步地看。",
    evidenceTag: "证据",
    navDocs: "文档",
    evidenceTitle: "你可查证的证据。",
    evidenceCards: [
      { title: "跑在 Monad 主网", body: "对真实节点的模拟，不是 mock。" },
      { title: "每条宣称都能追到原始资料", body: "展开任何发现，看节点的原始输出。" },
      { title: "可以核对的交接指纹", body: "面板与签名页显示同一串短字符串。中途有人把交易换掉，你看得出来。" },
    ],
    ctaLine1: "你的 agent 规划。",
    ctaLine2: "Vigil 守着。",
    footer: "在你自己的钱包里签名。Vigil 永远不碰你的私钥。",
    footerTag: "Vigil — 看见、回报、决定权在你。",
    navGap: "缺口",
    navHow: "运作方式",
    navEvidence: "证据",
    addShort: "加入",
    addPage: {
      title: "把 Vigil 加进你的 Agent",
      sub: "几分钟内把 Vigil 接进任何支持 MCP 的 agent。它在本地运行——预览对 Monad 主网真实模拟，私钥永远不离开你的钱包。",
      stepCloneTitle: "1 · 克隆并构建",
      stepCloneBody: "server 是这个仓库里的 Node 应用。安装并构建——面板与签名页都是自包含产物。",
      localTag: "本地安装——今天就能用",
      cardAny: "任何 MCP host",
      howClaudeWeb: "在 claude.ai → Settings → Connectors 添加远程端点（自己的隧道或托管版）。渲染完整面板。",
      stepsClaudeWeb: [
        "打开 claude.ai → Customize → Connectors",
        "点击 + → Add custom connector，粘贴下方 URL",
        "点击 Add——完成连接（Free 方案可用一个 connector）",
      ],
      howGpt: "在 ChatGPT → Settings → Apps & Connectors 添加远程端点（自己的隧道或托管版）。渲染完整面板。",
      stepsChatGPT: [
        "打开 ChatGPT → Settings → Apps & Connectors → Advanced Settings，开启 Developer mode（需付费方案）",
        "点击 Create，粘贴下方 URL",
        "选择验证方式，点击 Create——完成连接",
      ],
      openInClaude: "在 Claude 中打开",
      openInGpt: "在 ChatGPT 中打开",
      howClaude: "粘贴到 claude_desktop_config.json，然后完全退出并重开 Claude Desktop。",
      stepsClaudeDesktop: [
        "打开 claude_desktop_config.json",
        "粘贴下方配置",
        "完全退出并重开 Claude Desktop",
      ],
      howCode: "在终端运行一次——user scope，处处可用。",
      stepsCode: [
        "在终端运行下方命令一次",
        "重启 Claude Code，用 /mcp 确认",
      ],
      howCodex: "在终端运行一次——注册进 ~/.codex/config.toml。",
      stepsCodex: [
        "在终端运行下方命令一次",
        "重启 Codex",
      ],
      howHermes: "在 ~/.hermes/config.yaml 的 mcp_servers 下加入，然后重启 Hermes。",
      stepsHermes: [
        "编辑 ~/.hermes/config.yaml",
        "粘贴下方 mcp_servers 区块",
        "重启 Hermes",
      ],
      howOpenCode: "把区块加进你的 opencode.json（全局或项目）。",
      stepsOpenCode: [
        "编辑 opencode.json（全局或项目）",
        "粘贴下方区块",
        "重启 OpenCode",
      ],
      howAny: "多数 MCP host（Cursor、Windsurf、VS Code…）接受同一份 mcpServers JSON。",
      stepsAny: [
        "打开你的 host 的 MCP 设置",
        "粘贴下方 JSON",
        "重启 host",
      ],
      remoteTag: "远程端点",
      remoteNote: "Claude Desktop Connectors 与 ChatGPT 需要 https 网址。demo 部署时会上线——或自己跑 pnpm mcp:http 并开隧道。",
      copy: "复制",
      copied: "已复制",
      trust: "证据来自 Monad 主网模拟——不是来自构造交易的那个 agent。Vigil 永远不会碰你的私钥。",
      docs: "GitHub 上的完整安装说明 →",
    },
    showcase: {
      acts: [
        { num: "01", title: "你开口", body: "你的意图成形。什么都还没上链。" },
        { num: "02", title: "agent 构造交易", body: "交易被构造出来——去向、动作。" },
        { num: "03", title: "主网模拟", body: "链先跑一遍。节点回答真正会发生什么。" },
        { num: "04", title: "验证", body: "agent 的宣称，对照节点的回传逐一查核。" },
        { num: "05", title: "指纹", body: "交接附上一串指纹，你在任何地方都能查核。" },
        { num: "06", title: "你决定", body: "证据先到。决定在你——你不签，什么都不会广播。" },
      ],
      scene: {
        bubble: "帮我把 MON 质押起来",
        simulate: "模拟",
        resolved: "已处理",
        agentSaid: "AGENT 宣称",
        chainReturned: "链的回传",
        panel: "面板",
        signPage: "签名页",
        match: "吻合",
        verified: "已验证",
        youDecide: "你来决定",
        sign: "签署",
        reject: "拒绝",
        broadcasts: "会广播",
        nothingMoves: "什么都不动",
      },
    },
  },

  ja: {
    tagline: "Vigil — 夜警",
    heroSee: "見る。",
    heroReport: "報告する。",
    heroDecide: "決めるのはあなた。",
    heroSub: "夜警は見て、報告し、決してあなたの代わりに決めない — vigil（ラテン語）。",
    ctaAdd: "Vigil をエージェントに追加",
    ctaHow: "仕組みを見る",
    gapTag: "ギャップ",
    gapTitle: "エージェントの裏側は見えない。",
    gapBody:
      "エージェントにオンチェーンで動いてもらうとき、それが何をしているか唯一の手がかりはエージェント自身の説明だけ——そして取引を組み立てたのもエージェントだ。バグも、誤解も、注入された指示も、普通のリクエストとまったく同じに見える。あなたにできるのは署名するか、しないか。署名は取り消せない。",
    howTag: "仕組み",
    howTitle: "証拠は実行から来る。エージェントからではない。",
    howSteps: [
      { n: "01", title: "準備", body: "エージェントが構築した取引を携えて、MCP 経由で Vigil を呼び出す。" },
      { n: "02", title: "シミュレーション", body: "Vigil が Monad ノードで実行する。何もブロードキャストされない。" },
      { n: "03", title: "照合", body: "Vigil は、ノードが実際に返した結果をエージェントの主張と並べて示す——食い違いは自然に浮かび上がる。" },
    ],
    archTag: "あなたの言葉からチェーンへ",
    archTitle: "Vigil がどう見ているか——段階ごとに。",
    evidenceTag: "証拠",
    navDocs: "ドキュメント",
    evidenceTitle: "検証できる証拠。",
    evidenceCards: [
      { title: "Monad メインネット上で動作", body: "ライブノードへの本物のシミュレーション。モックではない。" },
      { title: "すべての主張はデータに遡れる", body: "どの指摘も展開すればノードの生の出力が見える。" },
      { title: "検証できる引き渡し指紋", body: "パネルと署名ページに同じ短い文字列が表示される。途中で取引がすり替えられたら、あなたは気づける。" },
    ],
    ctaLine1: "エージェントは計画する。",
    ctaLine2: "Vigil は見張る。",
    footer: "あなた自身のウォレットで署名する。Vigil が秘密鍵に触れることは決してない。",
    footerTag: "Vigil — 見て、報告して、あなたに決めさせる。",
    navGap: "ギャップ",
    navHow: "仕組み",
    navEvidence: "証拠",
        addShort: "追加",
    addPage: {
      title: "Vigil をエージェントに追加",
      sub: "MCP 対応エージェントなら数分で接続できます。ローカルで動作し、プレビューは Monad メインネットに対して実行。秘密鍵がウォレットの外に出ることはありません。",
      stepCloneTitle: "1 · クローンしてビルド",
      stepCloneBody: "サーバーはこのリポジトリ内の Node アプリです。インストールしてビルド——パネルと署名ページは自己完結します。",
      localTag: "ローカルインストール——今すぐ使える",
      cardAny: "任意の MCP ホスト",
      howClaudeWeb: "claude.ai → Settings → Connectors でリモートエンドポイント（自分で張ったトンネルかホスト版）を追加。フルパネルで表示されます。",
      stepsClaudeWeb: [
        "claude.ai → Customize → Connectors を開く",
        "+ → Add custom connector を選び、下の URL を貼り付け",
        "Add を押して接続完了（Free プランでも 1 つ使えます）",
      ],
      howGpt: "ChatGPT → Settings → Apps & Connectors でリモートエンドポイント（自分で張ったトンネルかホスト版）を追加。フルパネルで表示されます。",
      stepsChatGPT: [
        "ChatGPT → Settings → Apps & Connectors → Advanced Settings で Developer mode を有効化（有料プラン）",
        "Create を押し、下の URL を貼り付け",
        "認証方式を選び Create を押して接続完了",
      ],
      openInClaude: "Claude で開く",
      openInGpt: "ChatGPT で開く",
      howClaude: "claude_desktop_config.json に貼り付け、Claude Desktop を完全終了してから開き直します。",
      stepsClaudeDesktop: [
        "claude_desktop_config.json を開く",
        "下の設定を貼り付け",
        "Claude Desktop を完全終了して開き直す",
      ],
      howCode: "ターミナルで一度実行するだけ——user スコープでどこでも使えます。",
      stepsCode: [
        "ターミナルで下のコマンドを一度実行",
        "Claude Code を再起動し /mcp で確認",
      ],
      howCodex: "ターミナルで一度実行——~/.codex/config.toml に登録されます。",
      stepsCodex: [
        "ターミナルで下のコマンドを一度実行",
        "Codex を再起動",
      ],
      howHermes: "~/.hermes/config.yaml の mcp_servers に追加し、Hermes を再起動します。",
      stepsHermes: [
        "~/.hermes/config.yaml を編集",
        "下の mcp_servers ブロックを貼り付け",
        "Hermes を再起動",
      ],
      howOpenCode: "opencode.json（グローバルまたはプロジェクト）にブロックを追加します。",
      stepsOpenCode: [
        "opencode.json（グローバルまたはプロジェクト）を編集",
        "下のブロックを貼り付け",
        "OpenCode を再起動",
      ],
      howAny: "ほとんどの MCP ホスト（Cursor、Windsurf、VS Code など）は同じ mcpServers JSON を受け付けます。",
      stepsAny: [
        "ホストの MCP 設定を開く",
        "下の JSON を貼り付け",
        "ホストを再起動",
      ],
      remoteTag: "リモートエンドポイント",
      remoteNote: "Claude Desktop Connectors と ChatGPT は https の URL が必要です。デモのデプロイと同時に公開します——または pnpm mcp:http を自分で起動してトンネルを張ってください。",
      copy: "コピー",
      copied: "コピー済み",
      trust: "証拠は Monad メインネットでのシミュレーションから来ます——取引を作ったエージェントからではありません。Vigil が秘密鍵に触れることは決してありません。",
      docs: "GitHub の完全なインストールノート →",
    },
    showcase: {
      acts: [
        { num: "01", title: "言葉を発する", body: "あなたの意図が形になる。まだ何も作られていない。" },
        { num: "02", title: "エージェントが組み立てる", body: "取引が組み立てられる——どこへ、何をするか。" },
        { num: "03", title: "メインネットでシミュレーション", body: "チェーンが先に実行する。実際に何が起きるか、ノードが答える。" },
        { num: "04", title: "検証済み", body: "エージェントの主張を、ノードが返した結果と照合する。" },
        { num: "05", title: "フィンガープリント", body: "引き渡しには指紋が付く。どこでも検証できる。" },
        { num: "06", title: "あなたが決める", body: "証拠が先に届く。決めるのはあなた——署名しなければ、何もブロードキャストされない。" },
      ],
      scene: {
        bubble: "MON をステークしてほしい",
        simulate: "シミュレート",
        resolved: "解決済み",
        agentSaid: "エージェントの主張",
        chainReturned: "チェーンの返答",
        panel: "パネル",
        signPage: "署名ページ",
        match: "一致",
        verified: "検証済み",
        youDecide: "あなたが決める",
        sign: "署名",
        reject: "拒否",
        broadcasts: "ブロードキャスト",
        nothingMoves: "何も動かない",
      },
    },
  },

  ko: {
    tagline: "Vigil — 야경꾼",
    heroSee: "본다.",
    heroReport: "보고한다.",
    heroDecide: "결정하는 건 당신.",
    heroSub: "야경꾼은 보고, 보고하며, 결코 당신을 대신해 결정하지 않는다 — vigil, 라틴어.",
    ctaAdd: "Vigil을 에이전트에 추가",
    ctaHow: "작동 방식 보기",
    gapTag: "간극",
    gapTitle: "에이전트 뒤에서는 볼 수 없다.",
    gapBody:
      "에이전트에게 온체인 작업을 맡기면, 무엇을 하는지 알 수 있는 유일한 근거는 에이전트 자신의 설명뿐입니다——그리고 거래를 만든 쪽도 바로 에이전트입니다. 버그든, 오해든, 주입된 지시든 일반 요청과 똑같이 읽힙니다. 당신이 할 수 있는 선택은 서명하거나, 하지 않거나. 서명은 되돌릴 수 없습니다.",
    howTag: "작동 방식",
    howTitle: "증거는 실행에서 온다. 에이전트에게서가 아니다.",
    howSteps: [
      { n: "01", title: "준비", body: "에이전트가 만든 거래를 들고 MCP를 통해 Vigil을 호출한다." },
      { n: "02", title: "시뮬레이션", body: "Vigil이 Monad 노드에서 실행한다. 아무것도 브로드캐스트되지 않는다." },
      { n: "03", title: "대조", body: "Vigil은 노드가 실제로 반환한 결과를 에이전트의 주장과 나란히 보여준다——불일치는 저절로 드러난다." },
    ],
    archTag: "당신의 말에서 체인까지",
    archTitle: "Vigil이 단계별로 보는 방법.",
    evidenceTag: "증거",
    navDocs: "문서",
    evidenceTitle: "검증할 수 있는 증거.",
    evidenceCards: [
      { title: "Monad 메인넷에서 실행", body: "라이브 노드에 대한 실제 시뮬레이션. 모형이 아닙니다." },
      { title: "모든 주장은 데이터로 거슬러 올라간다", body: "어떤 발견이든 펼치면 노드의 원시 출력을 볼 수 있습니다." },
      { title: "확인할 수 있는 인계 지문", body: "패널과 서명 페이지에 동일한 짧은 문자열이 표시됩니다. 그 사이에 거래가 바뀌었다면, 당신이 볼 수 있습니다." },
    ],
    ctaLine1: "에이전트는 계획한다.",
    ctaLine2: "Vigil은 지킨다.",
    footer: "당신의 지갑에서 직접 서명하세요. Vigil은 절대 개인 키에 손대지 않습니다.",
    footerTag: "Vigil — 보고, 보고하고, 당신이 결정하게 한다.",
    navGap: "간극",
    navHow: "작동 방식",
    navEvidence: "증거",
        addShort: "추가",
    addPage: {
      title: "에이전트에 Vigil 추가",
      sub: "MCP를 지원하는 모든 에이전트에 몇 분 만에 연결합니다. 로컬에서 실행되며——미리보기는 Monad 메인넷에서 실제로 돌고, 개인 키는 지갑 밖으로 나가지 않습니다.",
      stepCloneTitle: "1 · 클론하고 빌드",
      stepCloneBody: "서버는 이 저장소 안의 Node 앱입니다. 설치하고 빌드하면——패널과 서명 페이지가 자체 포함으로 나옵니다.",
      localTag: "로컬 설치——오늘 바로 사용 가능",
      cardAny: "모든 MCP 호스트",
      howClaudeWeb: "claude.ai → Settings → Connectors에서 원격 엔드포인트(직접 뚫은 터널 또는 호스팅 버전)를 추가하세요. 전체 패널로 렌더링됩니다.",
      stepsClaudeWeb: [
        "claude.ai → Customize → Connectors 열기",
        "+ → Add custom connector 선택 후 아래 URL 붙여넣기",
        "Add 클릭——연결 완료 (Free 요금제도 1개 사용 가능)",
      ],
      howGpt: "ChatGPT → Settings → Apps & Connectors에서 원격 엔드포인트(직접 뚫은 터널 또는 호스팅 버전)를 추가하세요. 전체 패널로 렌더링됩니다.",
      stepsChatGPT: [
        "ChatGPT → Settings → Apps & Connectors → Advanced Settings에서 Developer mode 활성화 (유료 요금제)",
        "Create 클릭 후 아래 URL 붙여넣기",
        "인증 방식 선택 후 Create 클릭——연결 완료",
      ],
      openInClaude: "Claude에서 열기",
      openInGpt: "ChatGPT에서 열기",
      howClaude: "claude_desktop_config.json에 붙여넣고 Claude Desktop을 완전히 종료한 뒤 다시 엽니다.",
      stepsClaudeDesktop: [
        "claude_desktop_config.json 열기",
        "아래 설정 붙여넣기",
        "Claude Desktop 완전히 종료 후 다시 열기",
      ],
      howCode: "터미널에서 한 번 실행——user 스코프로 어디서든 사용 가능합니다.",
      stepsCode: [
        "터미널에서 아래 명령을 한 번 실행",
        "Claude Code 재시작 후 /mcp로 확인",
      ],
      howCodex: "터미널에서 한 번 실행——~/.codex/config.toml에 등록됩니다.",
      stepsCodex: [
        "터미널에서 아래 명령을 한 번 실행",
        "Codex 재시작",
      ],
      howHermes: "~/.hermes/config.yaml의 mcp_servers에 추가하고 Hermes를 재시작합니다.",
      stepsHermes: [
        "~/.hermes/config.yaml 편집",
        "아래 mcp_servers 블록 붙여넣기",
        "Hermes 재시작",
      ],
      howOpenCode: "opencode.json(전역 또는 프로젝트)에 블록을 추가하세요.",
      stepsOpenCode: [
        "opencode.json(전역 또는 프로젝트) 편집",
        "아래 블록 붙여넣기",
        "OpenCode 재시작",
      ],
      howAny: "대부분의 MCP 호스트(Cursor, Windsurf, VS Code…)는 같은 mcpServers JSON을 받습니다.",
      stepsAny: [
        "호스트의 MCP 설정 열기",
        "아래 JSON 붙여넣기",
        "호스트 재시작",
      ],
      remoteTag: "원격 엔드포인트",
      remoteNote: "Claude Desktop Connectors와 ChatGPT는 https URL이 필요합니다. 데모 배포와 함께 공개됩니다——또는 pnpm mcp:http를 직접 실행해 터널을 뚫으세요.",
      copy: "복사",
      copied: "복사됨",
      trust: "증거는 Monad 메인넷 시뮬레이션에서 나옵니다——거래를 만든 에이전트에게서가 아닙니다. Vigil은 절대 개인 키를 건드리지 않습니다.",
      docs: "GitHub의 전체 설치 노트 →",
    },
    showcase: {
      acts: [
        { num: "01", title: "말을 건넨다", body: "당신의 의도가 구체화된다. 아직 아무것도 만들어지지 않았다." },
        { num: "02", title: "에이전트가 구성한다", body: "거래가 구성된다——어디로, 무엇을 하는지." },
        { num: "03", title: "메인넷에서 시뮬레이션", body: "체인이 먼저 실행한다. 실제로 어떤 일이 벌어지는지 노드가 답한다." },
        { num: "04", title: "검증됨", body: "에이전트가 주장한 것을 노드가 반환한 결과와 대조한다." },
        { num: "05", title: "지문", body: "인계 과정에 지문이 붙는다. 어디서든 검증할 수 있다." },
        { num: "06", title: "당신이 결정한다", body: "증거가 먼저 도착한다. 결정하는 건 당신——서명하지 않으면 아무것도 브로드캐스트되지 않는다." },
      ],
      scene: {
        bubble: "MON 스테이킹을 도와줘",
        simulate: "시뮬레이션",
        resolved: "처리됨",
        agentSaid: "에이전트의 주장",
        chainReturned: "체인이 반환한 것",
        panel: "패널",
        signPage: "서명 페이지",
        match: "일치",
        verified: "검증됨",
        youDecide: "당신이 결정합니다",
        sign: "서명",
        reject: "거부",
        broadcasts: "브로드캐스트",
        nothingMoves: "아무것도 움직이지 않습니다",
      },
    },
  },
} as const;

export type Dict = (typeof DICT)["en"];

/** 讀翻譯（依目前 locale） */
export function useTranslation() {
  const { locale } = useLocale();
  return DICT[locale];
}

/** 地球 icon（inline SVG，不載資源） */
function GlobeIcon({ size = 15 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
    </svg>
  );
}

/** 語言切換 — 地球 icon + 下拉選單（大廠標準） */
export function LocaleToggle() {
  const { locale, setLocale } = useLocale();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 點外面關閉
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Select language"
        aria-expanded={open}
        className="grid h-8 w-8 place-items-center rounded-full text-[var(--color-ink-3)] transition hover:bg-[rgba(255,255,255,0.07)] hover:text-[var(--color-ink)]"
      >
        <GlobeIcon />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-36 overflow-hidden rounded-[10px] py-1 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.8)]"
          style={{
            background: "rgba(20,22,28,0.92)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(255,255,255,0.10)",
          }}
        >
          {LANGUAGES.map(({ code, label }) => (
            <button
              key={code}
              onClick={() => {
                setLocale(code);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-4 py-2 text-left text-[13.5px] transition hover:bg-[rgba(255,255,255,0.06)] ${
                locale === code ? "text-[var(--color-ink)]" : "text-[var(--color-ink-2)]"
              }`}
            >
              {label}
              {locale === code && <span className="text-[var(--color-link)]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
