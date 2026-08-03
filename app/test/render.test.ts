/**
 * 渲染層是純函式，直接測輸出的 HTML 字串。
 *
 * 這裡驗的是產品規則有沒有被渲染出來，不是視覺好不好看：
 *   不一致時衝突要列出來、不可簽名時按鈕要停用、
 *   沒有解讀模組時要說明、原始資料要藏在「依據」後面。
 */

import { describe, expect, it } from "vitest";
import type { EvidencePanelView } from "../src/contract.js";
import { allFixtures } from "../src/fixtures.js";
import { esc, flattenReceipt, renderBody, renderFooter, shortHex } from "../src/panel/render.js";

const opts = { tab: "summary" as const, openSource: null };

describe("跳脫與縮寫", () => {
  it("跳脫 HTML 特殊字元", () => {
    expect(esc('<script>"x"&y')).toBe("&lt;script&gt;&quot;x&quot;&amp;y");
  });

  it("長 hex 縮寫，短的不動", () => {
    expect(shortHex("0x1234")).toBe("0x1234");
    const long = `0x${"a".repeat(60)}`;
    expect(shortHex(long)).toContain("…");
    expect(shortHex(long).length).toBeLessThan(long.length);
  });
});

describe("每個 fixture 都渲染得出來", () => {
  const names = Object.keys(allFixtures) as (keyof typeof allFixtures)[];

  it.each(names)("%s 的結論分頁不是空的", (name) => {
    const html = renderBody(allFixtures[name], opts);
    expect(html.length).toBeGreaterThan(100);
    expect(html).toContain("鏈上會發生的");
  });

  it.each(names)("%s 的原始資料分頁不是空的", (name) => {
    const html = renderBody(allFixtures[name], { ...opts, tab: "raw" });
    expect(html.length).toBeGreaterThan(40);
  });
});

describe("產品規則有被渲染出來", () => {
  it("不可簽名時按鈕停用", () => {
    const html = renderFooter(allFixtures.approveMismatch);
    expect(html).toContain("disabled");
    expect(html).toContain("不能簽名");
  });

  it("可簽名時按鈕可用，並說明簽名在自己的錢包完成", () => {
    const html = renderFooter(allFixtures.stakeMatch);
    expect(html).not.toContain("disabled");
    expect(html).toContain("你自己的錢包");
  });

  // account 決定了面板上每一句「你支出」「你自己」。它是 agent 給的，
  // 不講出來使用者會以為那個「你」已經被驗過。
  it("account 來自 agent 時要說出來，且說明沒驗過", () => {
    const html = renderFooter(allFixtures.stakeMatch);
    expect(html).toContain("上面的「你」指");
    expect(html).toContain("agent 給的");
    expect(html).toContain("沒驗過");
    // 補救措施也要講，否則只是嚇人
    expect(html).toContain("錢包會比對");
  });

  it("account 來自錢包時不再說沒驗過", () => {
    const html = renderFooter({ ...allFixtures.stakeMatch, accountSource: "wallet" });
    expect(html).toContain("你連接的錢包");
    expect(html).not.toContain("沒驗過");
  });

  it("顯示的地址是縮寫，不是完整 42 字元", () => {
    const html = renderFooter(allFixtures.stakeMatch);
    expect(html).toContain(allFixtures.stakeMatch.account.slice(0, 10));
    expect(html).not.toContain(allFixtures.stakeMatch.account);
  });

  it("不一致時把每條衝突列出來", () => {
    const html = renderBody(allFixtures.approveMismatch, opts);
    const verdict = allFixtures.approveMismatch.verdict;
    if (verdict.kind !== "mismatch") throw new Error("fixture 壞了");
    for (const conflict of verdict.conflicts) {
      expect(html).toContain(esc(conflict));
    }
  });

  it("部分不符時顯示原因", () => {
    const html = renderBody(allFixtures.unstakePartial, opts);
    const verdict = allFixtures.unstakePartial.verdict;
    if (verdict.kind !== "partial") throw new Error("fixture 壞了");
    expect(html).toContain(esc(verdict.reason));
  });

  it("blocked 時把 warning 訊息列出來", () => {
    const html = renderBody(allFixtures.blockedByWarning, opts);
    for (const w of allFixtures.blockedByWarning.warnings) {
      expect(html).toContain(esc(w.message));
    }
  });

  it("沒有意圖時不假裝有對照對象", () => {
    const html = renderBody(allFixtures.noAdapterModeB, opts);
    expect(html).toContain("沒有可以對照的要求");
  });

  it("沒有解讀模組時說明不做猜測", () => {
    const html = renderBody(allFixtures.noAdapterModeB, opts);
    expect(html).toContain("不做猜測");
  });
});

/**
 * 使用者實際看得到的文字。屬性（例如 title）裡的完整地址不算可見，
 * 那是 hover 才出現的補充資訊。
 */
function visibleText(html: string): string {
  return html.replace(/<[^>]*>/g, " ");
}

describe("原始資料預設藏起來", () => {
  it("結論分頁沒展開時看不到 hex", () => {
    const html = renderBody(allFixtures.stakeMatch, opts);
    expect(visibleText(html)).not.toMatch(/0x[0-9a-fA-F]{20,}/);
    expect(html).toContain("依據");
  });

  it("展開指定那一條才看得到它的原始資料", () => {
    const html = renderBody(allFixtures.stakeMatch, { ...opts, openSource: 0 });
    expect(html).toContain("節點模擬跑出來的原始資料");
    expect(html).toMatch(/0x[0-9a-fA-F]{20,}/);
  });

  it("原始資料分頁直接顯示全部變動", () => {
    const html = renderBody(allFixtures.stakeMatch, { ...opts, tab: "raw" });
    expect(html).toContain("節點回傳的有序變動");
    expect(html).toMatch(/0x[0-9a-fA-F]{20,}/);
  });
});

describe("回歸：結論分頁不能出現完整地址或 wei", () => {
  // 2026-08-01 凌晨用面板時發現的問題：手寫 fixture 全綠，真資料整個退化成
  // 開發者文字。這條掃全部情境，包含 verdict 的衝突訊息在內。
  const names = Object.keys(allFixtures) as (keyof typeof allFixtures)[];

  it.each(names)("%s 沒有完整 42 字元地址", (name) => {
    const text = visibleText(renderBody(allFixtures[name], opts));
    expect(text).not.toMatch(/0x[0-9a-fA-F]{40}/);
  });

  it.each(names)("%s 沒有長串未格式化的整數", (name) => {
    const text = visibleText(renderBody(allFixtures[name], opts));
    expect(text).not.toMatch(/\d{15,}/);
  });
});

describe("flattenReceipt", () => {
  it("葉節點數量與順序跟 changes 對得上", () => {
    const view: EvidencePanelView = allFixtures.stakeMatch;
    if (view.receipt === null) throw new Error("fixture 壞了");
    const leaves = flattenReceipt(view.receipt);
    expect(leaves).toHaveLength(view.changes.length);
    leaves.forEach((leaf, i) => {
      expect(leaf.change).toBe(view.changes[i]);
    });
  });
});

describe("注入防護", () => {
  it("意圖文字裡的 HTML 被跳脫，不會變成標籤", () => {
    const evil: EvidencePanelView = {
      ...allFixtures.stakeMatch,
      intent: {
        source: "agent",
        protocol: "shmonad",
        method: "stake",
        params: {},
        text: '<img src=x onerror="alert(1)">',
      },
    };
    const html = renderBody(evil, opts);
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });
});

/**
 * 改參數重新模擬（product-brief §5 步驟 4）。
 *
 * host 沒宣告 serverTools 時必須退回唯讀——給一顆按了沒反應的鍵，
 * 比沒有那顆鍵更糟（08-04 的 openLink 就是這個形狀）。
 */
describe("可編輯的參數", () => {
  it("host 不支援時是唯讀，沒有輸入框也沒有重新模擬鍵", () => {
    const html = renderBody(allFixtures.stakeMatch, opts);
    expect(html).not.toContain("pedit");
    expect(html).not.toContain("重新模擬");
  });

  it("host 支援時每個參數給一個輸入框，並附重新模擬鍵", () => {
    const html = renderBody(allFixtures.stakeMatch, { ...opts, canResimulate: true });
    const params = allFixtures.stakeMatch.intent?.params ?? {};
    for (const key of Object.keys(params)) {
      expect(html).toContain(`data-k="${key}"`);
    }
    expect(html).toContain("重新模擬");
  });

  // displayParamValue 會把自己的地址顯示成「你自己」。那是給人看的代稱，
  // 送回 tool 會變成一個不存在的地址，所以可編輯時必須給原始值。
  it("輸入框帶的是原始值，不是「你自己」這種顯示用代稱", () => {
    const view = allFixtures.stakeMatch;
    const html = renderBody(view, { ...opts, canResimulate: true });
    const receiver = view.intent?.params.receiver;
    if (receiver !== undefined) {
      expect(html).toContain(`value="${receiver}"`);
    }
    expect(html).not.toMatch(/value="你自己"/);
  });

  it("重新模擬中時輸入框與按鍵都鎖住", () => {
    const html = renderBody(allFixtures.stakeMatch, { ...opts, canResimulate: true, busy: true });
    expect(html).toContain("重新模擬中…");
    expect(html.match(/<input[^>]*disabled/g) ?? []).not.toHaveLength(0);
  });
});
