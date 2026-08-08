/**
 * 預覽頁的進入點。跟 MCP App 用同一個 render.ts，差別只在資料來源：
 * 這裡的情境是建置時就備好的（真實主網模擬 + 補幾個現場產不出來的 fixture），
 * MCP App 那邊是 host 即時推過來的 tool 結果。
 *
 * 用途：設計檢視、給 v0 當輸入、以及在沒有 MCP host 的環境下看面板長什麼樣。
 */

import type { EvidencePanelView } from "../contract.js";
import { renderBody, renderFooter, type Tab } from "./render.js";
import { t } from "./i18n.js";
import { LOGOMARK_SVG } from "./brand.js";

interface Scenario {
  label: string;
  /** 這筆資料是真的對主網跑出來的，還是備好的 fixture */
  live: boolean;
  view: EvidencePanelView;
}

declare global {
  interface Window {
    __SCENARIOS__?: Record<string, Scenario>;
  }
}

const scenarios = window.__SCENARIOS__ ?? {};
const names = Object.keys(scenarios);

const state = {
  current: names[0] ?? "",
  tab: "summary" as Tab,
  openSource: null as number | null,
};

const root = document.getElementById("root");
if (root === null) throw new Error("找不到 #root");

function paint(): void {
  if (root === null) return;
  const scenario = scenarios[state.current];
  if (scenario === undefined) {
    root.innerHTML = `<p class="failed">沒有可以顯示的情境。跑過 pnpm build:mock 了嗎？</p>`;
    return;
  }
  const view = scenario.view;

  // mock 是設計檢視工具：一律用 en 渲染（demo 畫面），不照各情境的 locale。
  // zh 渲染效果由 fixtures.test / i18n keyset assert 把關。
  const demoView: EvidencePanelView = { ...view, locale: "en" };

  root.innerHTML = `
    <div class="harness">
      <span class="tag">Scenarios</span>
      ${names
        .map(
          (name) =>
            `<button data-scenario="${name}" aria-pressed="${name === state.current}">${
              scenarios[name]?.label ?? name
            }</button>`,
        )
        .join("")}
    </div>

    <p class="provenance">${
      scenario.live
        ? "This view is from a real Monad mainnet simulation."
        : "Prepared data for states a live demo can't produce."
    }</p>

    <div class="panel">
      <div class="p-head">
        <span class="mark">${LOGOMARK_SVG}</span>
        <span class="name">${t(demoView.locale, "panel_name")}</span>
        <span class="src"><span class="live"></span>${t(demoView.locale, "panel_source")}</span>
      </div>
      <div class="tabs" role="tablist">
        <button role="tab" data-tab="summary" aria-selected="${state.tab === "summary"}">${t(demoView.locale, "tab_summary")}</button>
        <button role="tab" data-tab="raw" aria-selected="${state.tab === "raw"}">${t(demoView.locale, "tab_raw")}</button>
      </div>
      <div class="p-body">${renderBody(demoView, { tab: state.tab, openSource: state.openSource })}</div>
      <div class="p-foot">${renderFooter(demoView)}</div>
    </div>`;

  for (const button of root.querySelectorAll<HTMLButtonElement>("[data-scenario]")) {
    button.addEventListener("click", () => {
      state.current = button.dataset.scenario ?? state.current;
      state.openSource = null;
      paint();
    });
  }
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
}

paint();
