/**
 * 預覽頁的進入點。跟 MCP App 用同一個 render.ts，差別只在資料來源：
 * 這裡的情境是建置時就備好的（真實主網模擬 + 補幾個現場產不出來的 fixture），
 * MCP App 那邊是 host 即時推過來的 tool 結果。
 *
 * 用途：設計檢視、給 v0 當輸入、以及在沒有 MCP host 的環境下看面板長什麼樣。
 */

import type { EvidencePanelView } from "../contract.js";
import { renderBody, renderFooter, type Tab } from "./render.js";

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

  root.innerHTML = `
    <div class="harness">
      <span class="tag">情境</span>
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
        ? "這一筆是對 Monad 主網真實模擬跑出來的資料。"
        : "這一筆是備好的資料，用來呈現現場產不出來的情況。"
    }</p>

    <div class="panel">
      <div class="p-head">
        <span class="mark">證</span>
        <span class="name">Vigil · 簽名前檢查</span>
        <span class="src"><span class="live"></span>Monad 主網模擬</span>
      </div>
      <div class="tabs" role="tablist">
        <button role="tab" data-tab="summary" aria-selected="${state.tab === "summary"}">結論</button>
        <button role="tab" data-tab="raw" aria-selected="${state.tab === "raw"}">原始資料</button>
      </div>
      <div class="p-body">${renderBody(view, { tab: state.tab, openSource: state.openSource })}</div>
      <div class="p-foot">${renderFooter(view)}</div>
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
