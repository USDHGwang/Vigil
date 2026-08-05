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
      { n: "03", title: "Compare", body: "Vigil checks each change against the operation your agent called. Reading that against what you actually asked for is your call." },
    ],
    archTag: "From your words to the chain",
    archTitle: "How Vigil sees, step by step.",
    evidenceTag: "Evidence",
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
    showcase: {
      acts: [
        { num: "01", title: "You say a word", body: "Your intent takes shape. Nothing is built yet." },
        { num: "02", title: "The agent builds", body: "The transaction is constructed — where it goes, what it does." },
        { num: "03", title: "Simulated on mainnet", body: "The chain runs it first. The node answers what would actually happen." },
        { num: "04", title: "Verified", body: "What the agent claimed is checked against what the node returned." },
        { num: "05", title: "The fingerprint", body: "The handoff gets a fingerprint you can verify anywhere." },
        { num: "06", title: "You decide", body: "The proof reaches you. Sign — it broadcasts. Reject — nothing moves." },
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
      { n: "03", title: "比對", body: "Vigil 把節點產生的每筆變動，對照 agent 呼叫的那個操作。跟你原本要的對不對得上，由你自己看。" },
    ],
    archTag: "從一句話到上鏈",
    archTitle: "Vigil 如何一步一步地看。",
    evidenceTag: "證據",
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
    showcase: {
      acts: [
        { num: "01", title: "你開口", body: "你的意圖成形。什麼都還沒上鏈。" },
        { num: "02", title: "agent 構造交易", body: "交易被構造出來——去向、動作。" },
        { num: "03", title: "主網模擬", body: "鏈先跑一遍。節點回答真正會發生什麼。" },
        { num: "04", title: "驗證", body: "agent 的宣稱，對照節點的回傳逐一查核。" },
        { num: "05", title: "指紋", body: "交接附上一串指紋，你在任何地方都能查核。" },
        { num: "06", title: "你決定", body: "證據到你手上。簽——就廣播。拒絕——什麼都不動。" },
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
      { n: "03", title: "比对", body: "Vigil 把节点产生的每笔变动，对照 agent 调用的那个操作。跟你原本要的对不对得上，由你自己看。" },
    ],
    archTag: "从一句话到上链",
    archTitle: "Vigil 如何一步一步地看。",
    evidenceTag: "证据",
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
    showcase: {
      acts: [
        { num: "01", title: "你开口", body: "你的意图成形。什么都还没上链。" },
        { num: "02", title: "agent 构造交易", body: "交易被构造出来——去向、动作。" },
        { num: "03", title: "主网模拟", body: "链先跑一遍。节点回答真正会发生什么。" },
        { num: "04", title: "验证", body: "agent 的宣称，对照节点的回传逐一查核。" },
        { num: "05", title: "指纹", body: "交接附上一串指纹，你在任何地方都能查核。" },
        { num: "06", title: "你决定", body: "证据到你手上。签——就广播。拒绝——什么都不动。" },
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
      { n: "03", title: "照合", body: "Vigil は、エージェントが呼んだ操作と、ノードが返した各変更を照合する。自分が頼んだことと合っているかを見るのはあなた自身だ。" },
    ],
    archTag: "あなたの言葉からチェーンへ",
    archTitle: "Vigil がどう見ているか——段階ごとに。",
    evidenceTag: "証拠",
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
    showcase: {
      acts: [
        { num: "01", title: "言葉を発する", body: "あなたの意図が形になる。まだ何も作られていない。" },
        { num: "02", title: "エージェントが組み立てる", body: "取引が組み立てられる——どこへ、何をするか。" },
        { num: "03", title: "メインネットでシミュレーション", body: "チェーンが先に実行する。実際に何が起きるか、ノードが答える。" },
        { num: "04", title: "検証済み", body: "エージェントの主張を、ノードが返した結果と照合する。" },
        { num: "05", title: "フィンガープリント", body: "引き渡しには指紋が付く。どこでも検証できる。" },
        { num: "06", title: "あなたが決める", body: "証拠があなたに届く。署名すればブロードキャスト。拒否すれば何も動かない。" },
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
      { n: "03", title: "대조", body: "Vigil은 에이전트가 호출한 작업과 노드가 반환한 각 변경 사항을 대조한다. 당신이 요청한 것과 맞는지 판단하는 것은 당신의 몫이다." },
    ],
    archTag: "당신의 말에서 체인까지",
    archTitle: "Vigil이 단계별로 보는 방법.",
    evidenceTag: "증거",
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
    showcase: {
      acts: [
        { num: "01", title: "말을 건넨다", body: "당신의 의도가 구체화된다. 아직 아무것도 만들어지지 않았다." },
        { num: "02", title: "에이전트가 구성한다", body: "거래가 구성된다——어디로, 무엇을 하는지." },
        { num: "03", title: "메인넷에서 시뮬레이션", body: "체인이 먼저 실행한다. 실제로 어떤 일이 벌어지는지 노드가 답한다." },
        { num: "04", title: "검증됨", body: "에이전트가 주장한 것을 노드가 반환한 결과와 대조한다." },
        { num: "05", title: "지문", body: "인계 과정에 지문이 붙는다. 어디서든 검증할 수 있다." },
        { num: "06", title: "당신이 결정한다", body: "증거가 당신에게 도착한다. 서명하면 브로드캐스트. 거부하면 아무것도 움직이지 않는다." },
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
