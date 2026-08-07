/**
 * MCP App 進入點。接 App Bridge 拿 tool 結果，用 render.ts 畫出來。
 *
 * 這個檔案會被打包成單一 JS 內嵌進 panel/index.html，因為 sandbox 的
 * connect-src 預設是 none，不能載外部資源。
 */

import {
  App,
  applyDocumentTheme,
  applyHostFonts,
  applyHostStyleVariables,
  type McpUiHostContext,
} from "@modelcontextprotocol/ext-apps";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { EvidencePanelView } from "../contract.js";
import { handoffUrl, MONAD_CHAIN_ID } from "../handoff.js";
import { esc, renderBody, renderFooter, type Tab } from "./render.js";
import { t, type Locale } from "./i18n.js";
import { LOGOMARK_SVG } from "./brand.js";

/**
 * 建置時的後備網址。**正常情況不該用到它。**
 *
 * 簽名頁的位置由 MCP server 在執行時決定並隨結果送過來，因為它跟部署方式有關：
 * stdio 是本機起的 127.0.0.1 某個 port，HTTP 模式是那台 server 的 `/sign`。
 * 打包時寫死等於把建置那台機器的路徑烤進去，只有那一台能用。
 *
 * 留這個後備只為了 mock 頁那種沒有 server 的情境。
 */
declare const __SIGN_PAGE_URL__: string;

interface PanelState {
  view: EvidencePanelView | null;
  /** server 送來的簽名頁位置。null 代表這次沒給，交接鍵要說清楚而不是開個壞連結。 */
  signPageUrl: string | null;
  tab: Tab;
  openSource: number | null;
  error: string | null;
  /**
   * host 不肯幫我們開連結時的退路：把交接網址攤出來讓使用者自己開。
   *
   * `openLink` 被拒絕（host 擋 localhost、使用者取消）時回的是 `isError: true`
   * 而不是丟例外。原本這裡把回傳值整個丟掉，結果是按了簽名什麼都不會發生，
   * 使用者不知道是自己按錯還是壞了。
   */
  handoffUrl: string | null;
  /** 開連結的結果說明 */
  handoffNote: string | null;
  /** blocked 要搶眼（那是唯一的路），opened 只是備援，不搶版面 */
  handoffKind: "blocked" | "opened" | null;
  /**
   * 進場動畫只跑一次。
   *
   * 每次切分頁、展開依據都會整段重畫，而 CSS animation 對新節點一定會重跑 ——
   * 不擋的話使用者每按一次就看整個面板重新飛進來一次。進場是為了把視線帶到
   * 證據上，看第二次就只剩干擾。
   */
  entered: boolean;
  /** host 允不允許面板回呼 tool。connect 之後才知道。 */
  canResimulate: boolean;
  /** 正在重新模擬 */
  busy: boolean;
}

const state: PanelState = {
  view: null,
  signPageUrl: null,
  tab: "summary",
  openSource: null,
  error: null,
  handoffUrl: null,
  handoffNote: null,
  handoffKind: null,
  entered: false,
  canResimulate: false,
  busy: false,
};

const root = document.getElementById("root");
if (root === null) throw new Error("找不到 #root");

interface Structured {
  view?: EvidencePanelView;
  /** 核准之後往哪裡交接。跟證據分開，不混進資料契約。 */
  signPageUrl?: string | null;
}

function structuredOf(result: CallToolResult): Structured {
  return (result.structuredContent as Structured | undefined) ?? {};
}

/**
 * host 開不了連結時顯示的退路。
 *
 * 交易在網址的 `#` 後面，所以整串複製過去、貼進瀏覽器，跟面板自己開是同一件事。
 * 指紋照樣可以對，安全性不因為換了開啟方式而改變。
 */
function renderHandoffFallback(): string {
  const url = state.handoffUrl;
  if (url === null) return "";
  const locale: Locale = state.view?.locale ?? "en";
  const blocked = state.handoffKind === "blocked";
  const lead = blocked ? t(locale, "handoff_copy_lead") : t(locale, "handoff_open_lead");
  return `
    <div class="handoff-fallback" data-kind="${esc(state.handoffKind ?? "")}">
      <p class="note">${esc(state.handoffNote ?? "")}${blocked ? "" : ""}</p>
      <p class="note">${lead}${t(locale, "handoff_note")}</p>
      <textarea class="handoff-url" readonly rows="3">${esc(url)}</textarea>
      <div class="handoff-actions">
        <button class="copy-handoff">${t(locale, "handoff_copy_btn")}</button>
        <a class="open-handoff" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${t(locale, "handoff_open_btn")}</a>
      </div>
      <p class="note tiny">${t(locale, "handoff_note_tiny")}</p>
    </div>`;
}

/**
 * 主動把內容高度回報給 host。
 *
 * SDK 預設有 autoResize（ResizeObserver），但它抓不抓得到我們這種
 * 「整段 innerHTML 換掉」的變化不保證，而且漏一次的代價是使用者看不到
 * 唯一那條可以走的路。多送一次的成本是零。
 */
function reportSize(): void {
  if (root === null) return;
  const height = Math.ceil(root.getBoundingClientRect().height);
  if (height <= 0) return;
  try {
    app.sendSizeChanged({ width: Math.ceil(root.getBoundingClientRect().width), height });
  } catch {
    // 還沒 connect 或 host 不收，都不該讓面板壞掉
  }
}

function showHandoffFallback(
  url: string,
  note: string,
  kind: "blocked" | "opened",
): void {
  state.handoffUrl = url;
  state.handoffNote = note;
  state.handoffKind = kind;
  paint();
}

function paint(): void {
  if (root === null) return;

  if (state.error !== null) {
    // 這裡的字串有一條非靜態來源（bridge 丟出來的 error），照全專案的規矩跳脫
    root.innerHTML = `<div class="panel"><p class="failed">${esc(state.error)}</p></div>`;
    return;
  }
  if (state.view === null) {
    root.innerHTML = `<div class="panel"><p class="loading">${t("en", "loading")}</p></div>`;
    return;
  }

  const view = state.view;
  const locale: Locale = view.locale;
  root.innerHTML = `
    <div class="panel">
      <div class="p-head">
        <span class="mark">${LOGOMARK_SVG}</span>
        <span class="name">${t(locale, "panel_name")}</span>
        <span class="src"><span class="live"></span>${t(locale, "panel_source")}</span>
      </div>
      <div class="tabs" role="tablist">
        <button role="tab" data-tab="summary" aria-selected="${state.tab === "summary"}">${t(locale, "tab_summary")}</button>
        <button role="tab" data-tab="raw" aria-selected="${state.tab === "raw"}">${t(locale, "tab_raw")}</button>
      </div>
      <div class="p-body" data-enter="${state.entered ? "0" : "1"}">${renderBody(view, {
        tab: state.tab,
        openSource: state.openSource,
        canResimulate: state.canResimulate,
        busy: state.busy,
      })}</div>
      <div class="p-foot">${renderHandoffFallback()}${renderFooter(view)}</div>
    </div>`;

  // host 會夾面板高度（SDK 的 maxHeight），而 .panel 是 overflow:hidden。
  // 退路框原本加在最底下，被夾掉就整塊看不到也捲不到 —— 08-04 實機就是這樣
  // 「沒看到黃框」。現在框放在按鈕上方，並且主動回報一次高度。
  reportSize();
  state.entered = true;

  for (const button of root.querySelectorAll<HTMLButtonElement>(".tabs button")) {
    button.addEventListener("click", () => {
      state.tab = button.dataset.tab === "raw" ? "raw" : "summary";
      state.openSource = null;
      paint();
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>(".srcbtn")) {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.src);
      state.openSource = state.openSource === index ? null : index;
      paint();
    });
  }

  const sign = root.querySelector<HTMLButtonElement>(".sign");
  sign?.addEventListener("click", () => {
    if (!view.signable) return;
    const locale: Locale = view.locale;
    const base = state.signPageUrl;
    if (base === null || base === "") {
      // 開一個壞掉的連結比講清楚更糟：使用者會以為自己做錯了
      state.error = t(locale, "err_no_signpage");
      paint();
      return;
    }
    // sandbox 碰不到 window.ethereum，所以開一個頁面讓使用者用自己的錢包簽。
    //
    // 交易由面板直接交出去，**不繞回 agent**。agent 是我們假設不可信的那一方，
    // 讓它在人核准之後再碰一次交易，前面的驗證就白做了。
    const url = handoffUrl(base, {
      chainId: MONAD_CHAIN_ID,
      transactions: view.transactions,
      summary: view.intent?.text ?? t(locale, "tx_fallback"),
      fingerprint: view.fingerprint,
      locale,
    });

    // 按鍵一定要當場有反應。沒有的話使用者分不出是自己沒按到、還是壞了、
    // 還是正在處理 —— 這正是 08-04 實機測到的那個「按了沒反應」。
    sign.disabled = true;
    sign.textContent = t(locale, "sign_opening");

    // openLink 被拒絕時回 isError 而不是丟例外，只有 timeout / 斷線才 throw。
    // 兩種都要接。
    //
    // 而且**成功也要給退路**：host 可以回報成功卻沒有真的開起來（擋 localhost
    // 但不報錯），那種情況 isError 分支永遠不會觸發，使用者又回到「沒反應」。
    // 網址攤出來的成本很低，省掉的是一整類講不清楚的失敗。
    void (async () => {
      try {
        const result = await app.openLink({ url });
        if (result.isError === true) {
          const message = typeof result.message === "string" ? result.message : null;
          showHandoffFallback(url, message ?? t(locale, "handoff_blocked"), "blocked");
        } else {
          showHandoffFallback(url, t(locale, "handoff_opened"), "opened");
        }
      } catch (error) {
        showHandoffFallback(url, t(locale, "handoff_open_failed", { error: String(error) }), "blocked");
      }
    })();
  });

  root.querySelector<HTMLButtonElement>(".resim")?.addEventListener("click", () => {
    if (state.busy) return;
    const intent = view.intent;
    if (intent === null) return;

    // 只送畫面上這幾格，不從舊 view 補值——使用者清空一格就是想清空它，
    // 悄悄塞回原值等於改了他沒同意的東西。
    const params: Record<string, string> = {};
    for (const input of root.querySelectorAll<HTMLInputElement>(".pedit")) {
      const key = input.dataset.k;
      if (key !== undefined) params[key] = input.value.trim();
    }

    state.busy = true;
    state.openSource = null;
    paint();

    void (async () => {
      try {
        const result = await app.callServerTool({
          name: "preview_transaction",
          arguments: {
            // 原話原樣帶著。改的是參數不是使用者說過的話，
            // 竄改它等於偽造比對的錨點。
            statedRequest: intent.text,
            protocol: intent.protocol,
            method: intent.method,
            params,
            account: view.account,
          },
        });
        const structured = structuredOf(result as CallToolResult);
        if (structured.view === undefined) {
          state.error = "重新模擬沒有回傳可以顯示的結果。";
        } else {
          state.view = structured.view;
          if (structured.signPageUrl != null) state.signPageUrl = structured.signPageUrl;
          // 參數改了，前一次的交接網址就不是這一筆的了
          state.handoffUrl = null;
          state.handoffNote = null;
          state.handoffKind = null;
        }
      } catch (error) {
        state.error = `重新模擬失敗：${String(error)}`;
      } finally {
        state.busy = false;
        paint();
      }
    })();
  });

  root.querySelector<HTMLButtonElement>(".copy-handoff")?.addEventListener("click", () => {
    const url = state.handoffUrl;
    if (url === null) return;
    // clipboard 權限沒給也不能讓按鈕看起來壞掉，選取起來讓使用者自己按 Ctrl+C
    void navigator.clipboard?.writeText(url).catch(() => {
      const field = root.querySelector<HTMLTextAreaElement>(".handoff-url");
      field?.select();
    });
  });

  root.querySelector<HTMLButtonElement>(".cancel")?.addEventListener("click", () => {
    void app.sendMessage({
      role: "user",
      content: [{ type: "text", text: "不要簽這筆交易。" }],
    });
  });
}

function applyHostContext(ctx: McpUiHostContext): void {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
  if (ctx.styles?.variables) applyHostStyleVariables(ctx.styles.variables);
  if (ctx.styles?.css?.fonts) applyHostFonts(ctx.styles.css.fonts);
  if (ctx.safeAreaInsets && root !== null) {
    root.style.paddingTop = `${ctx.safeAreaInsets.top}px`;
    root.style.paddingRight = `${ctx.safeAreaInsets.right}px`;
    root.style.paddingBottom = `${ctx.safeAreaInsets.bottom}px`;
    root.style.paddingLeft = `${ctx.safeAreaInsets.left}px`;
  }
}

// autoResize 明講出來不靠預設值：面板高度會變（展開依據、退路框），
// host 沒收到新高度就會把內容夾掉，而被夾掉的往往正是使用者要按的那個東西。
const app = new App({ name: "Vigil", version: "0.2.0" }, undefined, { autoResize: true });

// handler 必須在 connect 之前註冊
app.ontoolresult = (result) => {
  const structured = structuredOf(result);
  // 沒給就退回建置時的後備（mock 頁那種沒有 server 的情境）
  state.signPageUrl = structured.signPageUrl ?? __SIGN_PAGE_URL__ ?? null;
  if (structured.view === undefined) {
    state.error = "這次模擬沒有回傳可以顯示的結果。";
  } else {
    state.view = structured.view;
    state.error = null;
  }
  state.openSource = null;
  paint();
};

app.ontoolinput = () => {
  state.view = null;
  state.error = null;
  paint();
};

app.ontoolcancelled = () => {
  state.error = "模擬被取消了。";
  paint();
};

app.onerror = (error) => {
  state.error = `面板出錯：${String(error)}`;
  paint();
};

app.onhostcontextchanged = applyHostContext;

paint();

void app.connect().then(() => {
  const ctx = app.getHostContext();
  if (ctx) applyHostContext(ctx);
  // host 沒宣告 serverTools 就不給可編輯的參數：一顆按了沒反應的鍵
  // 比沒有那顆鍵更糟（08-04 的 openLink 就是這樣）。
  state.canResimulate = Boolean(app.getHostCapabilities()?.serverTools);
  paint();
});
