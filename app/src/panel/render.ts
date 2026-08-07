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
import { t, type Locale } from "./i18n.js";

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
function verdictText(locale: Locale, kind: string): [string, string] {
  switch (kind) {
    case "match":
      return ["✓", t(locale, "verdict_match")];
    case "partial":
      return ["!", t(locale, "verdict_partial")];
    case "mismatch":
      return ["✗", t(locale, "verdict_mismatch")];
    case "noIntent":
      return ["–", t(locale, "verdict_noIntent")];
    // blocked 現在有兩種來源：檢查沒跑完，以及跑完了但確定送不出去（餘額不夠）。
    // headline 要對兩者都成立，細節由下面的 warning 清單交代。
    case "blocked":
      return ["■", t(locale, "verdict_blocked")];
    default:
      return ["?", kind];
  }
}

function directionLabel(locale: Locale, direction: string): string {
  switch (direction) {
    case "out":
      return t(locale, "dir_out");
    case "in":
      return t(locale, "dir_in");
    case "approval":
      return t(locale, "dir_approval");
    case "pending":
      return t(locale, "dir_pending");
    default:
      return "";
  }
}

/** 沒有 direction 的條目，標籤從 Change 的種類推，不編造語意 */
function kindLabel(locale: Locale, kind: Change["kind"]): string {
  return kind === "nativeTransfer" ? t(locale, "kind_nativeTransfer") : t(locale, "kind_event");
}

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
  locale: Locale,
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
            `<dt>${esc(k)}</dt><dd title="${esc(v)}">${esc(displayParamValue(v, account, locale))}</dd>`,
        )
        .join("");

  const action = options.canResimulate
    ? `<button class="resim"${options.busy ? " disabled" : ""}>${
        options.busy ? t(locale, "resim_busy") : t(locale, "resim")
      }</button>
       <p class="resim-note">${t(locale, "resim_note")}</p>`
    : "";

  return `<details class="more"><summary>${t(locale, "params")}</summary><div class="more-body"><dl class="params">${rows}</dl>${action}</div></details>`;
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
  const locale = view.locale;
  if (view.receipt !== null) {
    const leaves = flattenReceipt(view.receipt);
    if (leaves.length === 0) {
      return `<li><span class="cat" data-d="raw">${esc(t(locale, "dir_none"))}</span><span class="body">${esc(t(locale, "zero_changes"))}</span></li>`;
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
          locale,
        );
        const label = directionLabel(locale, direction) || kindLabel(locale, leaf.change.kind);
        return `<li>
          <span class="cat" data-d="${esc(direction || "raw")}">${esc(label)}</span>
          <span class="body">${esc(text)}</span>
          <button class="srcbtn" data-src="${i}" aria-expanded="${openSource === i}" aria-label="${esc(t(locale, "src_label"))}">${esc(t(locale, "src_btn"))}</button>
          ${openSource === i ? evidenceBlock(leaf.change, t(locale, "src_caption")) : ""}
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
                locale,
              )
            : {
                direction: "" as const,
                text: t(locale, "no_readable", { addr: shortAddress(change.address) }),
              };
        const label = directionLabel(locale, direction) || kindLabel(locale, change.kind);
        return `<li>
          <span class="cat" data-d="${esc(direction || "raw")}">${esc(label)}</span>
          <span class="body">${esc(text)}</span>
          <button class="srcbtn" data-src="${i}" aria-expanded="${openSource === i}" aria-label="${esc(t(locale, "src_label"))}">${esc(t(locale, "src_btn"))}</button>
          ${openSource === i ? evidenceBlock(change, t(locale, "src_caption_plain")) : ""}
        </li>`;
      })
      .join("");
  }

  return `<li><span class="cat" data-d="raw">${esc(t(locale, "dir_none"))}</span><span class="body">${esc(t(locale, "no_changes"))}</span></li>`;
}

/** 「結論」分頁 */
export function renderSummary(view: EvidencePanelView, options: RenderOptions): string {
  const locale = view.locale;
  const [glyph, word] = verdictText(locale, view.verdict.kind);

  return `
    ${
      options.requestedBy
        ? `<div class="who"><span class="id"><span class="dot"></span>${esc(options.requestedBy)}</span></div>`
        : ""
    }

    <div class="block">
      <div class="label">${esc(t(locale, "section_intent"))}</div>
      ${
        view.intent
          ? `<p class="intent">${esc(view.intent.text)}</p>${paramList(view.intent.params, view.account, locale, options)}`
          : `<p class="no-intent">${esc(t(locale, "no_intent"))}</p>`
      }
    </div>

    <div class="verdict" data-kind="${esc(view.verdict.kind)}">
      <div class="v-head"><span class="v-glyph">${glyph}</span>${esc(word)}</div>
      ${verdictBody(view)}
    </div>

    ${
      view.receipt === null && view.changes.length > 0
        ? `<div class="degraded">${esc(t(locale, "degraded"))}</div>`
        : ""
    }

    <div class="block" style="padding-bottom:2px"><div class="label">${esc(t(locale, "section_evidence"))}</div></div>
    <ul class="findings">${findings(view, options.openSource)}</ul>`;
}

/** 「原始資料」分頁 */
export function renderRaw(view: EvidencePanelView): string {
  const locale = view.locale;
  if (view.changes.length === 0) {
    return `<div class="block"><p class="no-intent">${esc(t(locale, "no_changes"))}</p></div>`;
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
      <div class="label">${esc(t(locale, "raw_changes_title", { n: String(view.changes.length) }))}</div>
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
             <div class="label">${esc(t(locale, "raw_outcome_title"))}</div>
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
  const locale = view.locale;
  // 機器驗不了「使用者說的話」對不對得上，這件事要講出來，不能讓人以為已經驗過。
  // 這一句留在預設層當 summary，展開才是完整說明。
  const checksLine = view.intent !== null ? t(locale, "checks_line") : t(locale, "no_compare");

  // 上面每一句「你支出」「你自己」都是照這個地址算的，而它多半是 agent 給的。
  // 不講出來，使用者會以為那個「你」已經驗過了。
  const whoAmI =
    view.accountSource === "wallet"
      ? `<p class="handoff">${esc(t(locale, "account_wallet", { who: shortHex(view.account, 10, 8) }))}</p>`
      : `<p class="handoff">${esc(t(locale, "account_agent", { who: shortHex(view.account, 10, 8) }))}</p>`;

  const whoChecks =
    view.intent !== null ? `<p class="handoff">${esc(t(locale, "checks_body"))}</p>` : "";

  // 指紋讓「被簽的是被模擬的那一筆」變成可查核。簽名頁會顯示同一串，
  // 所以它是要被人眼比對的東西 —— 留在預設層，不收進 disclosure。
  const fingerprint =
    view.signable && view.fingerprint
      ? `<div class="fp"><span class="k">${esc(t(locale, "fingerprint_label"))}</span><span class="v">${esc(
          formatFingerprint(view.fingerprint),
        )}</span></div>`
      : "";

  return `
    ${fingerprint}
    <div class="actions">
      <button class="sign" ${view.signable ? "" : "disabled"}>${
        view.signable ? t(locale, "sign_btn") : t(locale, "sign_btn_disabled")
      }</button>
      <button class="cancel">${t(locale, "cancel_btn")}</button>
    </div>
    <details class="notes">
      <summary>${esc(checksLine)}</summary>
      <div class="notes-body">
        ${whoChecks}
        ${whoAmI}
        <p class="handoff">${esc(t(locale, "footer_handoff"))}</p>
      </div>
    </details>`;
}
