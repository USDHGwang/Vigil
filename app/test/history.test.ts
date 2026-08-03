/**
 * 預覽紀錄的邏輯層。UI 之後再做，這裡先把「記什麼、不記什麼」釘住。
 */

import { describe, expect, it } from "vitest";
import { allFixtures } from "../src/fixtures.js";
import { append, MAX_RECORDS, toRecord } from "../src/history.js";

const at = 1_770_000_000_000;

describe("toRecord", () => {
  it("記下比對結論、可否簽名與指紋", () => {
    const r = toRecord(allFixtures.stakeMatch, at);
    expect(r.verdict).toBe("match");
    expect(r.signable).toBe(true);
    expect(r.fingerprint).toBe(allFixtures.stakeMatch.fingerprint);
    expect(r.statedRequest).toBe(allFixtures.stakeMatch.intent?.text);
  });

  // 存 calldata 與完整參數回頭看用不到，留著只是風險
  it("不存 calldata、不存完整參數", () => {
    const json = JSON.stringify(toRecord(allFixtures.stakeMatch, at));
    expect(json).not.toContain("0x6e553f65");
    expect(json).not.toMatch(/0x[0-9a-fA-F]{40}/);
  });

  it("沒有意圖時不編一個出來", () => {
    const r = toRecord(allFixtures.noAdapterModeB, at);
    expect(r.statedRequest).toContain("沒有可對照");
  });

  it("沒有 receipt 時摘要講變動筆數，不留白", () => {
    const r = toRecord(allFixtures.noAdapterModeB, at);
    expect(r.summary).toMatch(/\d+ 筆/);
  });
});

describe("append", () => {
  const base = toRecord(allFixtures.stakeMatch, at);

  it("最新的在最前面", () => {
    const other = { ...base, fingerprint: "AAAA", at: at + 1 };
    expect(append([base], other)[0]?.fingerprint).toBe("AAAA");
  });

  it("不改動傳進來的陣列", () => {
    const list = [base];
    append(list, { ...base, fingerprint: "BBBB" });
    expect(list).toHaveLength(1);
  });

  // 在面板裡改參數重新模擬時，改到一半的中間狀態沒有回頭看的價值
  it("同一個指紋只留最新那筆", () => {
    const again = { ...base, at: at + 5, statedRequest: "改過的" };
    const out = append([base], again);
    expect(out).toHaveLength(1);
    expect(out[0]?.statedRequest).toBe("改過的");
  });

  it("超過上限就丟掉最舊的", () => {
    let list = [] as ReturnType<typeof toRecord>[];
    for (let i = 0; i < MAX_RECORDS + 10; i++) {
      list = append(list, { ...base, fingerprint: `F${i}`, at: at + i });
    }
    expect(list).toHaveLength(MAX_RECORDS);
    expect(list[0]?.fingerprint).toBe(`F${MAX_RECORDS + 9}`);
  });
});
