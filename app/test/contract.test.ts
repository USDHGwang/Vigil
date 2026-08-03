import { verifyReceiptCoverage } from "@themoss/core";
import { describe, expect, it } from "vitest";
import {
  assertViewInvariants,
  ContractViolation,
  type EvidencePanelView,
  receiptLeaves,
} from "../src/contract.js";
import { allFixtures, type FixtureName } from "../src/fixtures.js";

const names = Object.keys(allFixtures) as FixtureName[];

describe("每個 fixture 都要滿足契約", () => {
  it.each(names)("%s 通過不變式", (name) => {
    expect(() => assertViewInvariants(allFixtures[name])).not.toThrow();
  });

  it.each(names)("%s 有 receipt 時通過 Moss 的覆蓋檢查", (name) => {
    const view = allFixtures[name];
    if (view.receipt === null) return;
    expect(() => verifyReceiptCoverage(view.changes, view.receipt!)).not.toThrow();
  });

  it.each(names)("%s 的 receipt 葉節點握的是原始 Change 物件", (name) => {
    const view = allFixtures[name];
    if (view.receipt === null) return;
    const leaves = receiptLeaves(view.receipt);
    expect(leaves).toHaveLength(view.changes.length);
    leaves.forEach((leafItem, index) => {
      // 用 toBe 比物件身分，不是內容。內容相同但物件不同就是捏造的證據。
      expect(leafItem.change).toBe(view.changes[index]);
    });
  });

  it("每一種 verdict 都有 fixture 覆蓋", () => {
    const kinds = new Set(names.map((name) => allFixtures[name].verdict.kind));
    expect(kinds).toEqual(new Set(["match", "partial", "mismatch", "blocked", "noIntent"]));
  });

  it("blocked 的兩種形狀都要有：有 receipt 的跟沒 receipt 的", () => {
    // 餘額不夠時模擬是成功的，receipt 還在；trace 中止時才沒有。
    // 這兩條分支的渲染路徑不一樣，fixture 少一個就會有一條沒被測到。
    expect(allFixtures.blockedByBalance.receipt).not.toBeNull();
    expect(allFixtures.blockedByWarning.receipt).toBeNull();
  });
});

describe("不變式真的會擋錯誤的 view", () => {
  const base = allFixtures.stakeMatch;

  it("有 warning 卻可簽名，要被擋", () => {
    const bad: EvidencePanelView = {
      ...base,
      warnings: [{ code: "REVERTED", message: "x" }],
      verdict: { kind: "blocked", warnings: [{ code: "REVERTED", message: "x" }] },
      signable: true,
    };
    expect(() => assertViewInvariants(bad)).toThrow(ContractViolation);
  });

  it("有 warning 卻不是 blocked，要被擋", () => {
    const bad: EvidencePanelView = {
      ...base,
      warnings: [{ code: "TRACE_FAILED", message: "x" }],
      signable: false,
    };
    expect(() => assertViewInvariants(bad)).toThrow(ContractViolation);
  });

  it("沒有意圖卻給出比對結論，要被擋", () => {
    const bad: EvidencePanelView = { ...base, intent: null };
    expect(() => assertViewInvariants(bad)).toThrow(ContractViolation);
  });

  it("有意圖卻回報 noIntent，要被擋", () => {
    const bad: EvidencePanelView = { ...base, verdict: { kind: "noIntent" } };
    expect(() => assertViewInvariants(bad)).toThrow(ContractViolation);
  });

  it("沒有 warning 也沒有任何原始證據，要被擋", () => {
    const bad: EvidencePanelView = {
      ...base,
      receipt: null,
      changes: [],
      verdict: { kind: "match" },
    };
    expect(() => assertViewInvariants(bad)).toThrow(ContractViolation);
  });

  it("receipt 葉節點換成內容相同的複製品，覆蓋檢查要抓到", () => {
    const original = base.changes[0];
    if (original === undefined) throw new Error("fixture 壞了");
    const forged = structuredClone(original);
    const bad: EvidencePanelView = {
      ...base,
      receipt: {
        ...base.receipt!,
        changes: [
          { kind: "change", change: forged, data: {}, text: "看起來一樣的假證據" },
          ...base.receipt!.changes.slice(1),
        ],
      },
    };
    expect(() => assertViewInvariants(bad)).toThrow();
  });
});
