/**
 * 交接：面板 → 簽名頁 → 使用者的錢包。
 *
 * 這一層的核心保證是「被簽的位元組 = 被模擬的位元組」。指紋讓這件事從宣稱
 * 變成可查核：面板顯示一串，簽名頁顯示同一串，中間被動過就對不上。
 */

import type { UnsignedTx } from "@themoss/core";
import { describe, expect, it } from "vitest";
import {
  decodeHandoff,
  encodeHandoff,
  fingerprintOf,
  formatFingerprint,
  handoffUrl,
  MONAD_CHAIN_ID,
} from "../src/handoff.js";

const tx: UnsignedTx = {
  from: "0xcccccccccccccccccccccccccccccccccccccccc",
  to: "0x1B68626dCa36c7fE922fD2d55E4f631d962dE19c",
  data: "0x6e553f650000000000000000000000000000000000000000000000000003782dace9d90000",
  value: "0x3782dace9d90000",
};

/** 測試裡不重打全參數 */
const fp = (txs: readonly UnsignedTx[]): string => fingerprintOf(txs, MONAD_CHAIN_ID);

const payload = {
  chainId: MONAD_CHAIN_ID,
  transactions: [tx],
  summary: "幫我質押 0.25 MON",
  fingerprint: fp([tx]),
};

describe("指紋", () => {
  it("同一批交易永遠得到同一串", () => {
    expect(fp([tx])).toBe(fp([tx]));
  });

  it("改一個位元組就不同", () => {
    const tampered: UnsignedTx = { ...tx, data: `${tx.data.slice(0, -1)}1` as UnsignedTx["data"] };
    expect(fp([tampered])).not.toBe(fp([tx]));
  });

  it("換收款地址就不同", () => {
    const tampered: UnsignedTx = { ...tx, to: "0x9f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b" };
    expect(fp([tampered])).not.toBe(fp([tx]));
  });

  it("改金額就不同", () => {
    expect(fp([{ ...tx, value: "0x0" }])).not.toBe(fp([tx]));
  });

  // 簽名頁的帳戶比對與 eth_sendTransaction 用的是 from。它不在指紋裡的話，
  // 「只改 from」的竄改指紋不變：錢包會以另一個帳戶送出用原帳戶模擬的 calldata。
  it("換發起帳戶就不同", () => {
    const tampered: UnsignedTx = { ...tx, from: "0x9f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b" };
    expect(fp([tampered])).not.toBe(fp([tx]));
  });

  it("換鏈就不同", () => {
    expect(fingerprintOf([tx], 1)).not.toBe(fingerprintOf([tx], MONAD_CHAIN_ID));
  });

  it("大小寫不影響，同一筆交易就是同一串", () => {
    const upper: UnsignedTx = { ...tx, to: tx.to.toUpperCase() as UnsignedTx["to"] };
    expect(fp([upper])).toBe(fp([tx]));
  });

  it("長度固定，人對得完", () => {
    expect(fp([tx])).toHaveLength(16);
    expect(formatFingerprint(fp([tx]))).toMatch(/^\w{4} \w{4} \w{4} \w{4}$/);
  });
});

describe("編碼與解碼", () => {
  it("原樣還原", () => {
    const decoded = decodeHandoff(encodeHandoff(payload));
    expect(decoded.transactions[0]).toEqual(tx);
    expect(decoded.summary).toBe(payload.summary);
    expect(decoded.chainId).toBe(MONAD_CHAIN_ID);
  });

  it("中文摘要不會壞掉", () => {
    const decoded = decodeHandoff(encodeHandoff({ ...payload, summary: "幫我質押 0.25 MON，收到我自己" }));
    expect(decoded.summary).toBe("幫我質押 0.25 MON，收到我自己");
  });

  it("編碼結果可以直接放進網址，不需要再轉義", () => {
    const encoded = encodeHandoff(payload);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(encoded)).toBe(encoded);
  });

  it("網址把交易放在 # 後面，不會送到伺服器", () => {
    const url = handoffUrl("https://example.com/sign", payload);
    const [base, fragment] = url.split("#");
    expect(base).toBe("https://example.com/sign");
    expect(fragment).toBeTruthy();
    // 交易內容完全在 fragment 裡，路徑與查詢字串是乾淨的
    expect(base).not.toContain(tx.data.slice(2, 20));
  });
});

describe("竄改偵測", () => {
  it("交易被換掉但指紋沒改，解碼要擋下來", () => {
    const forged = {
      ...payload,
      transactions: [{ ...tx, to: "0x9f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b" as UnsignedTx["to"] }],
    };
    // 攻擊者換了交易卻沿用原本的指紋
    expect(() => decodeHandoff(encodeHandoff({ ...forged, fingerprint: payload.fingerprint }))).toThrow(
      /指紋對不上/,
    );
  });

  it("金額被調高也擋得下來", () => {
    const forged = { ...payload, transactions: [{ ...tx, value: "0xde0b6b3a7640000" as UnsignedTx["value"] }] };
    expect(() => decodeHandoff(encodeHandoff({ ...forged, fingerprint: payload.fingerprint }))).toThrow(
      /指紋對不上/,
    );
  });

  it("沒有交易的資料要擋下來", () => {
    expect(() => decodeHandoff(encodeHandoff({ ...payload, transactions: [] }))).toThrow(/沒有交易/);
  });

  it("鏈不對就擋，即使指紋跟著那條鏈重算過", () => {
    const other = { ...payload, chainId: 1, fingerprint: fingerprintOf([tx], 1) };
    expect(() => decodeHandoff(encodeHandoff(other))).toThrow(/鏈不對/);
  });

  // 這條是設計邊界的存證，不是防線：指紋是 hash 不是 MAC（面板與簽名頁沒有
  // 共享祕密），攻擊者換了交易並重算指紋，自動檢查一定通過。擋這種攻擊者的
  // 是人工比對——簽名頁顯示的指紋跟面板顯示的不一樣，而面板那串它改不到。
  // 對外文件不可以宣稱「網址被改過會自動擋」，宣稱範圍以這條測試為準。
  it("換交易並重算指紋，自動檢查會通過——防線是人工比對，兩串指紋必然不同", () => {
    const forgedTxs = [
      { ...tx, to: "0x9f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b" as UnsignedTx["to"] },
    ];
    const forged = { ...payload, transactions: forgedTxs, fingerprint: fp(forgedTxs) };
    const decoded = decodeHandoff(encodeHandoff(forged));
    expect(decoded.transactions[0]?.to).toBe(forgedTxs[0]?.to);
    // 人工比對抓得到：跟面板顯示的那串不同
    expect(decoded.fingerprint).not.toBe(payload.fingerprint);
  });

  it("亂七八糟的字串不會讓它當掉成別的樣子", () => {
    expect(() => decodeHandoff("not-valid-base64url!!")).toThrow();
  });

  it("網址被截斷時給人話，不是漏出 atob 的原生錯誤", () => {
    const truncated = encodeHandoff(payload).slice(0, 40);
    expect(() => decodeHandoff(truncated)).toThrow(/讀不出來/);
    expect(() => decodeHandoff(truncated)).not.toThrow(/atob/);
  });
});

describe("鏈", () => {
  it("固定是 Monad 主網", () => {
    expect(MONAD_CHAIN_ID).toBe(143);
    expect(`0x${MONAD_CHAIN_ID.toString(16)}`).toBe("0x8f");
  });
});
