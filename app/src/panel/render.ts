/**
 * 面板渲染。純函式：view 進，HTML 字串出。沒有 DOM 依賴，可直接測。
 *
 * 兩個出口共用這一份：
 *   mock/index.html   獨立瀏覽用，帶情境切換器，給設計看與當 v0 輸入
 *   panel/index.html  MCP App 的 ui:// resource，接 App Bridge 吃真實結果
 */

import type { Change, EvidencePanelView, Receipt, ReceiptChange } from "../contract.js";
import { formatFingerprint } from "../handoff.js";
import { esc, shortHex } from "../html.js";
import { displayParamValue, humanize, shortAddress } from "./humanize.js";

export { esc, shortHex };

export type Tab = "summary" | "raw";

export interface RenderOptions {
  tab: Tab;
  /** 哪一條證據的「依據」被展開，null 是都沒展開 */
  openSource: number | null;
  /** agent client 名稱，沒有就不顯示那一列 */
  requestedBy?: string | undefined;
  /**
   * host 允不允許面板自己回呼 tool（`serverTools` capability）。
   *
   * 允許的話參數就能改了：agent 猜錯金額或對象時，在這裡改完直接重跑，
   * 不用退回去跟它重講一遍——那正是「讓 agent 做事」要省下來的時間。
   * host 不支援時退回唯讀顯示，不給一顆按了沒反應的鍵。
   */
  canResimulate?: boolean | undefined;
  /** 正在重新模擬，輸入與按鍵要鎖住 */
  busy?: boolean | undefined;
}

/**
 * 文案只能講機器真的驗過的事。
 *
 * 結構層比的是「交易做的事」對「agent 呼叫的操作」，沒有比「使用者說的話」。
 * 所以不能寫「跟你要的一致」，那會宣稱一件沒被驗證的事，而 agent 被注入指令的
 * 情況正好落在這個縫裡。
 */
const VERDICT_TEXT: Record<string, [string, string]> = {
  match: ["✓", "沒有發現意料外的動作"],
  partial: ["!", "有需要你確認的地方"],
  mismatch: ["✗", "交易內容跟這個操作對不上"],
  noIntent: ["–", "沒有可以對照的東西"],
  // blocked 現在有兩種來源：檢查沒跑完，以及跑完了但確定送不出去（餘額不夠）。
  // headline 要對兩者都成立，細節由下面的 warning 清單交代。
  blocked: ["■", "這筆不能簽"],
};

const DIRECTION_LABEL: Record<string, string> = {
  out: "支出",
  in: "取得",
  approval: "授權",
  pending: "待處理",
};

/** 沒有 direction 的條目，標籤從 Change 的種類推，不編造語意 */
const KIND_LABEL: Record<Change["kind"], string> = {
  nativeTransfer: "轉帳",
  event: "事件",
};

/** 把 Receipt 樹壓平成葉節點，順序與 Change 陣列一致 */
export function flattenReceipt(receipt: Receipt): ReceiptChange[] {
  const out: ReceiptChange[] = [];
  const walk = (node: Receipt["changes"][number]): void => {
    if (node.kind === "change") {
      out.push(node);
      return;
    }
    for (const child of node.changes) walk(child);
  };
  for (const node of receipt.changes) walk(node);
  return out;
}

function changeRows(change: Change): [string, string][] {
  if (change.kind === "nativeTransfer") {
    return [
      ["kind", "nativeTransfer"],
      ["from", change.from],
      ["to", change.to],
      ["value", `${change.value} wei`],
    ];
  }
  return [
    ["kind", "event"],
    ["address", change.address],
    ...change.topics.map((t, i): [string, string] => [`topic${i}`, shortHex(t)]),
    ["data", shortHex(change.data)],
  ];
}

function rowsHtml(change: Change): string {
  return changeRows(change)
    .map(([k, v]) => `<div><span class="k">${esc(k)}</span><span>${esc(v)}</span></div>`)
    .join("");
}

function evidenceBlock(change: Change, caption: string): string {
  return `<div class="evidence"><span class="cap">${esc(caption)}</span>${rowsHtml(change)}</div>`;
}

/**
 * 意圖參數預設收起來。
 *
 * 它們多半是那句話的重複——「幫我質押 0.25 MON」已經把 amount 講完了。攤在
 * 預設層只是增加要讀的東西，而讀不完的面板等於沒有面板。想核對的人展開就看得到。
 */
function paramList(
  obj: Readonly<Record<string, string>>,
  account: string,
  options: RenderOptions,
): string {
  const entries = Object.entries(obj);
  if (entries.length === 0) return "";

  // 可改的時候給原始值，不給 displayParamValue 的「你自己」——
  // 那是顯示用的代稱，送回 tool 會變成一個不存在的地址。
  const rows = options.canResimulate
    ? entries
        .map(
          ([k, v]) =>
            `<dt><label for="p-${esc(k)}">${esc(k)}</label></dt>` +
            `<dd><input class="pedit" id="p-${esc(k)}" data-k="${esc(k)}" value="${esc(v)}"${
              options.busy ? " disabled" : ""
            }></dd>`,
        )
        .join("")
    : entries
        .map(
          ([k, v]) =>
            `<dt>${esc(k)}</dt><dd title="${esc(v)}">${esc(displayParamValue(v, account))}</dd>`,
        )
        .join("");

  const action = options.canResimulate
    ? `<button class="resim"${options.busy ? " disabled" : ""}>${
        options.busy ? "重新模擬中…" : "改完重新模擬"
      }</button>
       <p class="resim-note">改了參數會對主網重跑一次模擬。不上鏈、不花錢。</p>`
    : "";

  return `<details class="more"><summary>參數</summary><div class="more-body"><dl class="params">${rows}</dl>${action}</div></details>`;
}

function verdictBody(view: EvidencePanelView): string {
  const v = view.verdict;
  if (v.kind === "partial") return `<p class="v-note">${esc(v.reason)}</p>`;
  if (v.kind === "mismatch") {
    return `<ul>${v.conflicts.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>`;
  }
  if (v.kind === "blocked") {
    return `<ul>${v.warnings.map((w) => `<li>${esc(w.message)}</li>`).join("")}</ul>`;
  }
  return "";
}

function findings(view: EvidencePanelView, openSource: number | null): string {
  if (view.receipt !== null) {
    const leaves = flattenReceipt(view.receipt);
    if (leaves.length === 0) {
      return `<li><span class="cat" data-d="raw">無</span><span class="body">這筆交易沒有產生任何變動</span></li>`;
    }
    return leaves
      .map((leaf, i) => {
        // Moss 的 text 是寫給 agent 看的（wei、完整地址），這裡用它的結構化
        // data 重寫成人話。認不得的形狀退回原文並縮短地址。
        const { direction, text } = humanize(
          leaf.data,
          leaf.change,
          view.account,
          view.tokens,
          leaf.text,
        );
        const label = DIRECTION_LABEL[direction] ?? KIND_LABEL[leaf.change.kind];
        return `<li>
          <span class="cat" data-d="${esc(direction || "raw")}">${esc(label)}</span>
          <span class="body">${esc(text)}</span>
          <button class="srcbtn" data-src="${i}" aria-expanded="${openSource === i}" aria-label="展開這條的依據">依據</button>
          ${openSource === i ? evidenceBlock(leaf.change, "節點模擬跑出來的原始資料，不經任何解讀") : ""}
        </li>`;
      })
      .join("");
  }

  if (view.changes.length > 0) {
    // 沒有 Receipt 不代表什麼都講不出來。原生轉帳的 from/to/value 就寫在
    // Change 上，不需要任何協議知識就能解讀；合約事件才是真的解讀不了。
    return view.changes
      .map((change, i) => {
        const { direction, text } =
          change.kind === "nativeTransfer"
            ? humanize(
                {
                  operation: "nativeTransfer",
                  from: change.from,
                  to: change.to,
                  value: change.value,
                },
                change,
                view.account,
                view.tokens,
                "",
              )
            : {
                direction: "" as const,
                text: `${shortAddress(change.address)} 發出一個事件，這裡沒有對它的解讀`,
              };
        const label = DIRECTION_LABEL[direction] ?? KIND_LABEL[change.kind];
        return `<li>
          <span class="cat" data-d="${esc(direction || "raw")}">${esc(label)}</span>
          <span class="body">${esc(text)}</span>
          <button class="srcbtn" data-src="${i}" aria-expanded="${openSource === i}" aria-label="展開這條的依據">依據</button>
          ${openSource === i ? evidenceBlock(change, "未經解讀的原始資料") : ""}
        </li>`;
      })
      .join("");
  }

  return `<li><span class="cat" data-d="raw">無</span><span class="body">模擬中止，沒有產生任何變動</span></li>`;
}

/** 「結論」分頁 */
export function renderSummary(view: EvidencePanelView, options: RenderOptions): string {
  const [glyph, word] = VERDICT_TEXT[view.verdict.kind] ?? ["?", view.verdict.kind];

  return `
    ${
      options.requestedBy
        ? `<div class="who"><span class="id"><span class="dot"></span>${esc(options.requestedBy)}</span></div>`
        : ""
    }

    <div class="block">
      <div class="label">agent 說你要求的</div>
      ${
        view.intent
          ? `<p class="intent">${esc(view.intent.text)}</p>${paramList(view.intent.params, view.account, options)}`
          : `<p class="no-intent">這筆交易從外部來，沒有可以對照的要求，所以只呈現結果、不做對照。</p>`
      }
    </div>

    <div class="verdict" data-kind="${esc(view.verdict.kind)}">
      <div class="v-head"><span class="v-glyph">${glyph}</span>${esc(word)}</div>
      ${verdictBody(view)}
    </div>

    ${
      view.receipt === null && view.changes.length > 0
        ? `<div class="degraded">這部分沒有可用的解讀，只顯示原始變動，內容不做猜測。</div>`
        : ""
    }

    <div class="block" style="padding-bottom:2px"><div class="label">鏈上會發生的</div></div>
    <ul class="findings">${findings(view, options.openSource)}</ul>`;
}

/** 「原始資料」分頁 */
export function renderRaw(view: EvidencePanelView): string {
  if (view.changes.length === 0) {
    return `<div class="block"><p class="no-intent">模擬中止，沒有產生任何變動。</p></div>`;
  }

  const outcome =
    view.receipt !== null &&
    view.receipt.outcome !== null &&
    typeof view.receipt.outcome === "object" &&
    !Array.isArray(view.receipt.outcome)
      ? (view.receipt.outcome as Record<string, unknown>)
      : null;

  return `<div class="rawtable">
    <div class="block" style="padding:12px 0 2px;border:none">
      <div class="label">節點回傳的有序變動（${view.changes.length}）</div>
    </div>
    ${view.changes
      .map(
        (change, i) =>
          `<div class="rt"><div class="idx" style="margin-bottom:6px">#${i + 1}</div>${rowsHtml(change)}</div>`,
      )
      .join("")}
    ${
      outcome
        ? `<div class="block" style="padding:16px 0 2px;border:none">
             <div class="label">模擬後的數值</div>
           </div>
           <div class="rt">${Object.entries(outcome)
             .map(
               ([k, v]) =>
                 `<div><span class="k">${esc(k)}</span><span>${esc(String(v))}</span></div>`,
             )
             .join("")}</div>`
        : ""
    }
  </div>`;
}

export function renderBody(view: EvidencePanelView, options: RenderOptions): string {
  return options.tab === "summary" ? renderSummary(view, options) : renderRaw(view);
}

export function renderFooter(view: EvidencePanelView): string {
  // 機器驗不了「使用者說的話」對不對得上，這件事要講出來，不能讓人以為已經驗過。
  // 這一句留在預設層當 summary，展開才是完整說明。
  const checksLine =
    view.intent !== null ? "機器只驗了交易與這個操作相符" : "這筆沒有可對照的要求";

  // 上面每一句「你支出」「你自己」都是照這個地址算的，而它多半是 agent 給的。
  // 不講出來，使用者會以為那個「你」已經驗過了。
  const whoAmI =
    view.accountSource === "wallet"
      ? `<p class="handoff">上面的「你」指 <code>${esc(shortHex(view.account, 10, 8))}</code>，來自你連接的錢包。</p>`
      : `<p class="handoff">上面的「你」指 <code>${esc(shortHex(view.account, 10, 8))}</code>。這個地址是 agent 給的，我們沒驗過；簽名時錢包會比對，不是它就擋下來。</p>`;

  const whoChecks =
    view.intent !== null
      ? `<p class="handoff">你說的話對不對得上，要你自己看上面兩段。</p>`
      : "";

  // 指紋讓「被簽的是被模擬的那一筆」變成可查核。簽名頁會顯示同一串，
  // 所以它是要被人眼比對的東西 —— 留在預設層，不收進 disclosure。
  const fingerprint =
    view.signable && view.fingerprint
      ? `<div class="fp"><span class="k">交接指紋</span><span class="v">${esc(
          formatFingerprint(view.fingerprint),
        )}</span></div>`
      : "";

  return `
    ${fingerprint}
    <div class="actions">
      <button class="sign" ${view.signable ? "" : "disabled"}>${
        view.signable ? "在錢包裡簽名" : "不能簽名"
      }</button>
      <button class="cancel">取消</button>
    </div>
    <details class="notes">
      <summary>${esc(checksLine)}</summary>
      <div class="notes-body">
        ${whoChecks}
        ${whoAmI}
        <p class="handoff">簽名在你自己的錢包裡完成，這個面板碰不到你的私鑰。下一頁會顯示同一串指紋。</p>
      </div>
    </details>`;
}
