/**
 * 文字版面板。給 Claude Code、Codex 這類不能渲染 HTML 的 host 用。
 *
 * 官方 client-matrix 只列 Claude web 與 Claude Desktop 支援 MCP Apps 的 UI
 * resource，CLI agent 一律不在內。而那些正是使用者叫 agent 上鏈做事的地方，
 * 所以文字版是主要形態之一，不是備案。
 */

import { describe, expect, it } from "vitest";
import { allFixtures } from "../src/fixtures.js";
import { clean, displayWidth, renderText, wrap } from "../src/panel/text.js";

const names = Object.keys(allFixtures) as (keyof typeof allFixtures)[];

describe("顯示寬度", () => {
  it("全形字算兩格", () => {
    expect(displayWidth("你好")).toBe(4);
    expect(displayWidth("abc")).toBe(3);
    expect(displayWidth("你好abc")).toBe(7);
  });

  it("全形標點也算兩格", () => {
    expect(displayWidth("（）")).toBe(4);
  });
});

describe("斷行", () => {
  it("按顯示寬度斷，不是字元數", () => {
    const lines = wrap("你好你好你好", 4, "");
    expect(lines).toEqual(["你好", "你好", "你好"]);
  });

  it("續行加上縮排", () => {
    const lines = wrap("你好你好", 4, "__");
    expect(lines[0]).toBe("你好");
    expect(lines[1]).toBe("__你好");
  });

  it("每一行都不超過指定寬度", () => {
    const text = "這是一段很長的中文字混 English words 的內容用來測試斷行是否正確";
    for (const line of wrap(text, 20, "")) {
      expect(displayWidth(line)).toBeLessThanOrEqual(20);
    }
  });

  it("數字不會被切成兩半：切開會變成另一個數字", () => {
    const text = "這筆需要 ~10.015862 MON，其中約 ~0.015862 MON 是手續費，差 ~0.928222 MON";
    const lines = wrap(text, 24, "");
    // 每個完整數字都要原封不動出現在某一行裡
    for (const amount of ["~10.015862", "~0.015862", "~0.928222"]) {
      expect(lines.some((l) => l.includes(amount))).toBe(true);
    }
    for (const line of lines) expect(displayWidth(line)).toBeLessThanOrEqual(24);
  });

  it("英文單字不會被切開", () => {
    const lines = wrap("質押 shMONAD 需要 approve 這個 contract", 12, "");
    for (const word of ["shMONAD", "approve", "contract"]) {
      expect(lines.some((l) => l.includes(word))).toBe(true);
    }
  });

  it("換行之後不留行首空白", () => {
    for (const line of wrap("aaaa bbbb cccc dddd eeee", 9, "")) {
      expect(line).not.toMatch(/^\s/);
    }
  });

  it("單一字串寬過整行時還是切得開，不會爆版", () => {
    const lines = wrap("0.123456789012345678901234567890", 10, "");
    for (const line of lines) expect(displayWidth(line)).toBeLessThanOrEqual(10);
    expect(lines.join("")).toContain("0.123456789");
  });
});

describe("每個情境都渲染得出來", () => {
  it.each(names)("%s 有內容且有結論", (name) => {
    const text = renderText(allFixtures[name]);
    expect(text.length).toBeGreaterThan(120);
    expect(text).toContain("鏈上行為");
    expect(text).toContain("簽名前檢查");
  });

  it.each(names)("%s 沒有完整地址", (name) => {
    expect(renderText(allFixtures[name])).not.toMatch(/0x[0-9a-fA-F]{40}/);
  });

  it.each(names)("%s 沒有未格式化的長整數", (name) => {
    expect(renderText(allFixtures[name])).not.toMatch(/\d{15,}/);
  });
});

describe("產品規則", () => {
  it("可簽名時說得出簽名在自己的錢包完成", () => {
    const text = renderText(allFixtures.stakeMatch);
    // 不寫「可以簽名」：機器判斷不了該不該簽，只說按鈕做什麼
    expect(text).toContain("要簽的話");
    expect(text).not.toContain("可以簽名");
    expect(text).toContain("你自己的錢包");
  });

  it("不一致時明說不能簽名，並列出每條衝突", () => {
    const text = renderText(allFixtures.approveMismatch);
    expect(text).toContain("這筆不能簽");
    const verdict = allFixtures.approveMismatch.verdict;
    if (verdict.kind !== "mismatch") throw new Error("fixture 壞了");
    for (const conflict of verdict.conflicts) {
      // 衝突訊息可能被斷行，比對開頭足夠
      expect(text).toContain(conflict.slice(0, 10));
    }
  });

  it("不一致用雙線框起來，在終端機裡跳得出來", () => {
    const text = renderText(allFixtures.approveMismatch);
    expect(text).toContain("═");
    // 其他情境不該有雙線
    expect(renderText(allFixtures.stakeMatch)).not.toContain("═");
  });

  it("blocked 時列出 warning 且不能簽名", () => {
    const text = renderText(allFixtures.blockedByWarning);
    expect(text).toContain("這筆不能簽");
    const verdict = allFixtures.blockedByWarning.verdict;
    if (verdict.kind !== "blocked") throw new Error("fixture 壞了");
    // 結論只說不能簽，為什麼不能簽要由 warning 自己講出來
    for (const w of verdict.warnings) expect(text).toContain(w.message.slice(0, 10));
  });

  it("部分不符顯示原因", () => {
    const text = renderText(allFixtures.unstakePartial);
    expect(text).toContain("需要你確認");
    expect(text).toContain("解鎖流程");
  });

  it("沒有意圖時不假裝有對照對象", () => {
    const text = renderText(allFixtures.noAdapterModeB);
    expect(text).toContain("沒有可以對照");
  });

  it("開頭就說明證據來源不是準備交易的那一方", () => {
    const text = renderText(allFixtures.stakeMatch);
    expect(text.split("\n")[0]).toContain("不是來自準備這筆交易的程式");
  });

  it("說出「你」指的是哪個帳戶，以及那個地址是誰給的", () => {
    const text = renderText(allFixtures.stakeMatch);
    expect(text).toContain("上面的「你」指");
    expect(text).toContain("agent 給的");
    expect(text).toContain("錢包會比對");
  });

  it("account 來自錢包時不再說沒驗過", () => {
    const text = renderText({ ...allFixtures.stakeMatch, accountSource: "wallet" });
    expect(text).toContain("你連接的錢包");
    expect(text).not.toContain("沒驗過");
  });
});

describe("排版", () => {
  it.each(names)("%s 每一行都在終端機寬度內", (name) => {
    for (const line of renderText(allFixtures[name]).split("\n")) {
      expect(displayWidth(line)).toBeLessThanOrEqual(80);
    }
  });

  it("標籤欄對齊：待處理三個字也不會推歪內容", () => {
    const text = renderText(allFixtures.unstakePartial);
    const evidence = text
      .split("\n")
      .filter((l) => l.startsWith("  支出") || l.startsWith("  待處理"));
    expect(evidence.length).toBeGreaterThanOrEqual(2);
    const contentStarts = evidence.map((l) => displayWidth(l.slice(0, l.indexOf("你") >= 0 ? l.indexOf("你") : l.indexOf("協"))));
    expect(new Set(contentStarts).size).toBe(1);
  });
});

describe("ANSI 上色（VIGIL_COLOR）", () => {
  it("預設（不開）完全沒有 escape code", () => {
    expect(renderText(allFixtures.stakeMatch)).not.toContain("\u001b[");
    expect(renderText(allFixtures.approveMismatch)).not.toContain("\u001b[");
  });

  it("開 color 時 verdict 有語義色：match 綠、mismatch 紅", () => {
    const match = renderText(allFixtures.stakeMatch, { color: true });
    expect(match).toContain("\u001b[32m✓  沒有發現意料外的動作\u001b[0m");
    const mismatch = renderText(allFixtures.approveMismatch, { color: true });
    expect(mismatch).toContain("\u001b[31m✗  交易內容跟這個操作對不上\u001b[0m");
    // mismatch 的 ═ 框也是紅的
    expect(mismatch).toContain("\u001b[31m" + "═".repeat(74) + "\u001b[0m");
  });

  it("開 color 時免責段是灰的，標題是 bold", () => {
    const text = renderText(allFixtures.stakeMatch, { color: true });
    expect(text).toContain("\u001b[1mVigil · 簽名前檢查");
    expect(text).toContain("\u001b[90m機器只驗了交易與這個操作相符");
  });

  it("開 color 時每一行的顯示寬度仍然不超過終端機寬度（escape 零寬，剝離後量）", () => {
    const strip = (s: string): string => s.replace(/\u001b\[[0-9;]*m/g, "");
    for (const line of renderText(allFixtures.stakeMatch, { color: true }).split("\n")) {
      expect(displayWidth(strip(line))).toBeLessThanOrEqual(80);
    }
  });
});

describe("控制字元防護", () => {
  // intent.text 是 agent 轉述使用者原話，未驗證：\x1b[2J 能清掉 CLI host 的
  // 整個畫面、\x1b[31m 能讓假 verdict 看起來像真的。輸出前必須剝掉。
  it("intent.text 的 ESC 序列全部剝掉", () => {
    const text = renderText({
      ...allFixtures.stakeMatch,
      intent: {
        ...allFixtures.stakeMatch.intent!,
        text: "幫我質押 10 MON\u001b[2J\u001b[31mFAKE\u001b[0m",
      },
    });
    expect(text).not.toContain("\u001b");
    // 內容本身還在，只是控制字元沒了
    expect(text).toContain("幫我質押 10 MON");
  });

  it("params 顯示值、conflicts、reason、warning message 的 ESC 也剝掉", () => {
    const partial = renderText({
      ...allFixtures.unstakePartial,
      intent: {
        ...allFixtures.unstakePartial.intent!,
        params: { amount: "10\u001b[31m", receiver: "0x1234\u001b[2J" },
      },
      verdict: { kind: "partial", reason: "贖回要等解鎖流程\u001b[2J\u001b[31m" },
    });
    expect(partial).not.toContain("\u001b");

    const mismatch = renderText({
      ...allFixtures.approveMismatch,
      verdict: {
        kind: "mismatch",
        conflicts: ["沒有任何 MON 被質押", "多出一筆授權\u001b[31mFAKE\u001b[0m"],
      },
    });
    expect(mismatch).not.toContain("\u001b");

    const blocked = renderText({
      ...allFixtures.blockedByWarning,
      verdict: {
        kind: "blocked",
        warnings: [{ code: "INSUFFICIENT_BALANCE", message: "餘額不夠\u001b[2J" }],
      },
    });
    expect(blocked).not.toContain("\u001b");
  });

  it("沒有可解讀事件的地址有控制字元也剝掉", () => {
    const [first, second] = allFixtures.noAdapterModeB.changes;
    if (first === undefined || second === undefined || second.kind !== "event") {
      throw new Error("fixture 壞了");
    }
    const text = renderText({
      ...allFixtures.noAdapterModeB,
      changes: [first, { ...second, address: `0x1234\u001b[2J` }],
    });
    expect(text).not.toContain("\u001b");
  });

  it("\\t 與 \\n 是合法排版字元，clean 保留它們", () => {
    expect(clean("a\tb\nc")).toBe("a\tb\nc");
    // CR（U+000D）也保留
    expect(clean("a\tb\nc" + String.fromCharCode(13) + "d")).toBe("a\tb\nc" + String.fromCharCode(13) + "d");
  });

  it("renderText 保留內容裡的 tab 與換行", () => {
    const text = renderText({
      ...allFixtures.stakeMatch,
      intent: {
        ...allFixtures.stakeMatch.intent!,
        text: "幫我質押\t10 MON\n順便查一下餘額",
      },
    });
    expect(text).toContain("\t");
    expect(text).toContain("MON\n順便查一下餘額");
  });

  it("開 color 時 verdict 的 ANSI 色碼仍在（只剝內容，不碰 tint）", () => {
    const text = renderText(
      {
        ...allFixtures.stakeMatch,
        intent: {
          ...allFixtures.stakeMatch.intent!,
          text: "幫我質押 10 MON\u001b[2J\u001b[31mFAKE\u001b[0m",
        },
      },
      { color: true },
    );
    // 注入的序列沒了
    expect(text).not.toContain("\u001b[2J");
    expect(text).not.toContain("\u001b[31mFAKE");
    // 程式自己的 verdict 綠還在
    expect(text).toContain("\u001b[32m✓  沒有發現意料外的動作\u001b[0m");
  });
});
