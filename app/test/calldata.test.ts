/**
 * 簽名頁自己解 calldata。
 *
 * 這一組測的是「網址裡的說明跟位元組不一致時，頁面站在哪一邊」。
 * 情境取自實際可構造的釣魚 payload：任何人都做得出一個指向公開簽名頁的網址，
 * `summary` 填「Stake 0.25 MON for me」，calldata 是 approve(攻擊者, uint256.max)，
 * 指紋自己算得出來所以自洽。頁面必須自己講出那段位元組做什麼。
 */

import { describe, expect, it } from "vitest";
import { encodeFunctionData, parseAbi } from "viem";
import { hasDanger, inspectCalldata } from "../src/sign/calldata.js";
import { canAutoStart, renderCard } from "../src/sign/view.js";
import { fingerprintOf, type HandoffPayload } from "../src/handoff.js";

const VICTIM = "0x08299d244c21bee544808c911fd3dea59051ecc0";
const TOKEN = "0x754704bc059f8c67012fed69bc8a327a5aafb603";
const ATTACKER = "0x9f2ca7b1d0e84f3a62b5c7d18e0a4f93bc61a41b";
const MAX = 2n ** 256n - 1n;

const abi = parseAbi([
  "function approve(address spender, uint256 amount)",
  "function setApprovalForAll(address operator, bool approved)",
  "function increaseAllowance(address spender, uint256 added)",
  "function transfer(address to, uint256 amount)",
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
]);

const call = (functionName: string, args: readonly unknown[]): string =>
  encodeFunctionData({ abi, functionName, args } as never);

function payloadFor(data: string, summary: string): HandoffPayload {
  const transactions = [{ from: VICTIM, to: TOKEN, value: "0x0", data }] as never;
  return {
    chainId: 143,
    transactions,
    summary,
    fingerprint: fingerprintOf(transactions, 143),
    locale: "en",
  };
}

describe("inspectCalldata", () => {
  it("無上限授權判 danger 並指名對象", () => {
    const findings = inspectCalldata(call("approve", [ATTACKER, MAX]), TOKEN);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.severity).toBe("danger");
    expect(findings[0]?.key).toBe("sign_risk_unlimited");
    expect(String(findings[0]?.vars.who).toLowerCase()).toContain("0x9f2ca7");
  });

  it("有上限的授權一樣是 danger——額度大小是人要判斷的，不是我們替他判斷的", () => {
    const findings = inspectCalldata(call("approve", [ATTACKER, 1000n]), TOKEN);
    expect(findings[0]?.severity).toBe("danger");
    expect(findings[0]?.key).toBe("sign_risk_approve");
    expect(findings[0]?.vars.amount).toBe("1000");
  });

  it("額度歸零是撤銷，不是 danger", () => {
    const findings = inspectCalldata(call("approve", [ATTACKER, 0n]), TOKEN);
    expect(findings[0]?.severity).toBe("notice");
    expect(findings[0]?.key).toBe("sign_risk_revoke");
  });

  it("setApprovalForAll(true) 是 danger，(false) 是撤銷", () => {
    expect(inspectCalldata(call("setApprovalForAll", [ATTACKER, true]), TOKEN)[0]?.severity).toBe(
      "danger",
    );
    expect(inspectCalldata(call("setApprovalForAll", [ATTACKER, false]), TOKEN)[0]?.key).toBe(
      "sign_risk_all_off",
    );
  });

  it("increaseAllowance 與 ERC-2612 permit 都認得", () => {
    expect(inspectCalldata(call("increaseAllowance", [ATTACKER, 500n]), TOKEN)[0]?.key).toBe(
      "sign_risk_increase",
    );
    const permit = call("permit", [VICTIM, ATTACKER, 700n, 0n, 27, `0x${"11".repeat(32)}`, `0x${"22".repeat(32)}`]);
    expect(inspectCalldata(permit, TOKEN)[0]?.key).toBe("sign_risk_permit");
  });

  it("認不得的 selector 回空陣列，不猜", () => {
    expect(inspectCalldata(call("transfer", [ATTACKER, 1n]), TOKEN)).toEqual([]);
    expect(inspectCalldata("0x", TOKEN)).toEqual([]);
    expect(inspectCalldata("not-hex", TOKEN)).toEqual([]);
  });

  it("selector 對但參數截斷 → 當認不得，不吐半個解讀", () => {
    const truncated = call("approve", [ATTACKER, MAX]).slice(0, 40);
    expect(inspectCalldata(truncated, TOKEN)).toEqual([]);
  });
});

describe("釣魚 payload：說明與位元組對不上", () => {
  const data = call("approve", [ATTACKER, MAX]);
  const payload = payloadFor(data, "Stake 0.25 MON for me");

  it("頁面自己講出那是無上限授權，不採信 summary", () => {
    const html = renderCard(payload, { kind: "connect" }, "en");
    expect(html).toContain("Unlimited approval");
    expect(html.toLowerCase()).toContain("0x9f2ca7");
    // summary 照樣顯示，但要標明是誰講的
    expect(html).toContain("Stake 0.25 MON for me");
    expect(html).toContain("Whoever opened this page described it as");
  });

  it("不掛「主網模擬」徽章——這一頁什麼都沒模擬過", () => {
    const html = renderCard(payload, { kind: "connect" }, "en");
    expect(html).not.toContain("Mainnet simulation");
  });

  it("指紋提示要講明「不是從面板來的話它證明不了任何事」", () => {
    const html = renderCard(payload, { kind: "connect" }, "en");
    expect(html).toContain("proves nothing");
  });

  it("有 danger 就不自動觸發錢包，即使已經連過", () => {
    expect(canAutoStart(payload, true)).toBe(false);
  });

  it("解不出來時明說解不出來，不留白", () => {
    const html = renderCard(payloadFor(call("transfer", [ATTACKER, 1n]), "send"), { kind: "connect" }, "en");
    expect(html).toContain("cannot decode this calldata");
  });
});

describe("正常路徑不被誤傷", () => {
  it("沒有 danger 的單筆交易照樣自動觸發", () => {
    const stake = payloadFor("0x3a4b66f1", "Stake 0.25 MON for me");
    expect(hasDanger(inspectCalldata(stake.transactions[0]!.data, TOKEN))).toBe(false);
    expect(canAutoStart(stake, true)).toBe(true);
  });

  it("沒連過錢包一律不自動觸發", () => {
    const stake = payloadFor("0x3a4b66f1", "Stake 0.25 MON for me");
    expect(canAutoStart(stake, false)).toBe(false);
  });
});
