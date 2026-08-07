/**
 * 簽名頁的純邏輯。錢包互動測不了（沒有 window.ethereum），
 * 但「什麼狀態顯示什麼」「什麼時候可以自動觸發」是純函式，這裡守住。
 */

import type { UnsignedTx } from "@themoss/core";
import { describe, expect, it } from "vitest";
import { fingerprintOf, type HandoffPayload } from "../src/handoff.js";
import {
  accountMatches,
  actionFor,
  canAutoStart,
  formatValue,
  noticeFor,
  renderCard,
  renderFailure,
} from "../src/sign/view.js";

const tx: UnsignedTx = {
  from: "0xcccccccccccccccccccccccccccccccccccccccc",
  to: "0x1B68626dCa36c7fE922fD2d55E4f631d962dE19c",
  data: "0x6e553f650000000000000000000000000000000000000000000000000003782dace9d90000",
  value: "0x3782dace9d90000",
};

const one = (txs: readonly UnsignedTx[] = [tx]): HandoffPayload => ({
  chainId: 143,
  transactions: txs,
  summary: "幫我質押 0.25 MON",
  fingerprint: fingerprintOf(txs, 143),
});

describe("自動觸發的條件", () => {
  it("已連過且只有一筆，才自動觸發", () => {
    expect(canAutoStart(one(), true)).toBe(true);
  });

  it("沒連過就不自動觸發：eth_requestAccounts 需要 user gesture", () => {
    expect(canAutoStart(one(), false)).toBe(false);
  });

  it("多筆時不自動觸發，不能在沒人按的情況下悄悄送出其中一筆", () => {
    expect(canAutoStart(one([tx, { ...tx, value: "0x0" }]), true)).toBe(false);
  });
});

/**
 * account 是 agent 傳來的未驗證參數，面板上每一句「你支出」都建立在它上面。
 * 錢包是唯一知道「你是誰」的地方，所以最後這一關要比對。
 */
describe("帳戶比對", () => {
  it("錢包連著的就是發起人，放行", () => {
    expect(accountMatches(one(), [tx.from])).toBe(true);
  });

  it("大小寫不影響比對：EIP-55 checksum 不該讓同一個地址被判成兩個", () => {
    expect(accountMatches(one(), [tx.from.toUpperCase()])).toBe(true);
    expect(accountMatches(one(), [tx.from.toLowerCase()])).toBe(true);
  });

  it("連著多個帳戶時，只要其中一個是發起人就算數", () => {
    expect(accountMatches(one(), ["0x9f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b", tx.from])).toBe(
      true,
    );
  });

  it("完全不同的帳戶要擋下來", () => {
    expect(accountMatches(one(), ["0x9f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b"])).toBe(false);
  });

  it("沒有連任何帳戶時不算相符", () => {
    expect(accountMatches(one(), [])).toBe(false);
  });

  it("不相符時不給按鈕：要能簽得先去錢包切帳戶，給鈕只會讓人以為是我們壞掉", () => {
    expect(actionFor({ kind: "wrongAccount", connected: "0xa", expected: "0xb" })).toBeNull();
  });

  it("兩個地址都完整顯示出來，讓人自己比", () => {
    const html = renderCard(one(), {
      kind: "wrongAccount",
      connected: "0x9f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b",
      expected: tx.from,
    });
    expect(html).toContain("0x9f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b");
    expect(html).toContain(tx.from);
    expect(html).toContain("你錢包現在是");
  });

  it("講清楚面板上的數字跟這個使用者無關", () => {
    const text = noticeFor({ kind: "wrongAccount", connected: "0xa", expected: "0xb" })?.text ?? "";
    expect(text).toContain("跟你無關");
    expect(text).toContain("切到發起帳戶");
  });

  it("locale 傳 en 時整頁是英文（面板語言跟到簽名頁）", () => {
    const html = renderCard(one(), { kind: "connect" }, "en");
    expect(html).toContain("Last step before signing");
    expect(html).toContain("Handoff fingerprint");
    expect(html).toContain("Connect wallet &amp; sign");
    expect(html).toContain("Pre-sign check");
    expect(html).not.toContain("簽名前最後一步");
    expect(html).not.toContain("交接指紋");
  });
});

describe("按鈕", () => {
  it("檢查中與等待中，按鈕停用免得重複送", () => {
    expect(actionFor({ kind: "checking" })?.disabled).toBe(true);
    expect(actionFor({ kind: "waiting" })?.disabled).toBe(true);
  });

  it("沒連過時按鈕說清楚會連錢包也會簽名", () => {
    expect(actionFor({ kind: "connect" })).toEqual({ label: "連接錢包並簽名", disabled: false });
  });

  it("失敗可以重試", () => {
    expect(actionFor({ kind: "failed", message: "使用者取消" })?.disabled).toBe(false);
  });

  it("送出後與沒錢包時不給按鈕", () => {
    expect(actionFor({ kind: "sent", hash: "0xabc" })).toBeNull();
    expect(actionFor({ kind: "noWallet" })).toBeNull();
  });
});

describe("金額", () => {
  it("用 MON 不用 wei", () => {
    expect(formatValue("0x3782dace9d90000")).toBe("0.25 MON");
  });

  it("零值講人話", () => {
    expect(formatValue("0x0")).toBe("不附帶 MON");
  });
});

describe("卡片", () => {
  it("顯示分組後的指紋讓人對得完", () => {
    const html = renderCard(one(), { kind: "checking" });
    expect(html).toContain("交接指紋");
    expect(html).toMatch(/\w{4} \w{4} \w{4} \w{4}/);
  });

  it("不出現未格式化的 wei", () => {
    const html = renderCard(one(), { kind: "connect" });
    expect(html).not.toContain("250000000000000000");
    expect(html).toContain("0.25 MON");
  });

  it("收款地址完整顯示，這是使用者要核對的東西", () => {
    expect(renderCard(one(), { kind: "connect" })).toContain(tx.to);
  });

  it("多筆時明講只送得出第一筆", () => {
    const html = renderCard(one([tx, tx]), { kind: "connect" });
    expect(html).toContain("這批有 2 筆");
    expect(html).toContain("只送得出一筆");
  });

  it("送出後給雜湊、不再給按鈕", () => {
    const html = renderCard(one(), { kind: "sent", hash: "0xdeadbeef" });
    expect(html).toContain("0xdeadbeef");
    expect(html).not.toContain("<button");
  });

  it("摘要來自 agent，是不可信輸入，必須跳脫", () => {
    const evil = { ...one(), summary: '<img src=x onerror="alert(1)">' };
    const html = renderCard(evil, { kind: "connect" });
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
  });

  it("錢包回傳的錯誤訊息也要跳脫", () => {
    const html = renderCard(one(), { kind: "failed", message: "<script>x</script>" });
    expect(html).not.toContain("<script>");
  });
});

describe("失敗頁", () => {
  it("指紋對不上的訊息顯示得出來且有跳脫", () => {
    expect(renderFailure("交接資料的指紋對不上，這串網址被改過")).toContain("指紋對不上");
    expect(renderFailure("<b>x</b>")).not.toContain("<b>");
  });
});

describe("提示", () => {
  it("沒錢包時講清楚要裝什麼", () => {
    expect(noticeFor({ kind: "noWallet" })?.tone).toBe("bad");
  });

  it("檢查中不顯示提示，避免閃一下嚇到人", () => {
    expect(noticeFor({ kind: "checking" })).toBeNull();
  });
});
