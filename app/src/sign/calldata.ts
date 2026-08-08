/**
 * 簽名頁自己解 calldata。
 *
 * 為什麼這一層必須存在：簽名頁只信任網址 fragment，而 fragment 裡的 `summary`
 * 是**產生那串網址的人自己填的字**。從面板來的時候它是使用者的原話；不是從面板
 * 來的時候，它就是攻擊者填的一句「Stake 0.25 MON for me」，底下配一段
 * `approve(攻擊者, uint256.max)`。指紋自洽（攻擊者自己算得出來），交易明細只
 * 顯示截斷的 hex，所以整頁沒有一個欄位會拆穿它。
 *
 * 這裡解出來的東西是這一頁唯一**不經任何人轉述**的資訊：它直接來自要送出去的
 * 那 4 個位元組與參數。跟 summary 對不上的時候，該被相信的是這一邊。
 *
 * 邊界要講清楚：
 *   - 純本機解碼，不打 RPC。這一頁是靜態託管、沒有後端，也不該為了看一眼就
 *     把使用者的交易送到任何伺服器。
 *   - 只認得下面這幾個 selector。認不得就明說認不得，不猜、不沉默。
 *     「沉默」在這裡等於「看起來安全」，那正是要避免的。
 *   - 代幣顯示的是合約地址不是 symbol。查 symbol 要 RPC，見上一條。
 */

import { decodeFunctionData, parseAbi, toFunctionSelector } from "viem";
import { EFFECTIVELY_UNLIMITED } from "../panel/humanize.js";

/** 一條解出來的事實。key 是 i18n 鍵，由呼叫端翻譯。 */
export interface CalldataFinding {
  /** danger 會讓整塊變紅並擋掉自動觸發錢包；notice 只是說明 */
  severity: "danger" | "notice";
  key: string;
  vars: Record<string, string>;
}

const ABI = parseAbi([
  "function approve(address spender, uint256 amount)",
  "function setApprovalForAll(address operator, bool approved)",
  "function increaseAllowance(address spender, uint256 added)",
  "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
  // Permit2 的額度型授權。額度型別是 uint160，所以 ERC-20 的無上限門檻對它不適用，
  // 但它一樣是把餘額交出去，而且 findApprovals 那條事件路徑完全看不到它。
  "function approve(address token, address spender, uint160 amount, uint48 expiration)",
  "function transferFrom(address from, address to, uint256 amount)",
]);

/** selector 用簽章現算，不手抄 hex。抄錯的話這一整層會靜默失效。 */
const SELECTORS = {
  approve: toFunctionSelector("approve(address,uint256)"),
  setApprovalForAll: toFunctionSelector("setApprovalForAll(address,bool)"),
  increaseAllowance: toFunctionSelector("increaseAllowance(address,uint256)"),
  permit: toFunctionSelector(
    "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)",
  ),
  permit2Approve: toFunctionSelector("approve(address,address,uint160,uint48)"),
  transferFrom: toFunctionSelector("transferFrom(address,address,uint256)"),
} as const;

function short(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

/**
 * 這段 calldata 做什麼。認不得回空陣列，由呼叫端顯示「解不出來」。
 *
 * `to` 是被呼叫的合約，對 approve 類來說就是代幣／系列本身，所以要帶進來——
 * 「誰的餘額被交出去」跟「交給誰」一樣重要。
 */
export function inspectCalldata(data: string, to: string): CalldataFinding[] {
  if (typeof data !== "string" || !data.startsWith("0x") || data.length < 10) return [];
  const selector = data.slice(0, 10).toLowerCase();
  const token = short(to);

  try {
    switch (selector) {
      case SELECTORS.approve: {
        const { args } = decodeFunctionData({ abi: ABI, data: data as `0x${string}` });
        const [spender, amount] = args as unknown as [string, bigint];
        if (amount === 0n) {
          return [{ severity: "notice", key: "sign_risk_revoke", vars: { who: short(spender), token } }];
        }
        return [
          amount >= EFFECTIVELY_UNLIMITED
            ? { severity: "danger", key: "sign_risk_unlimited", vars: { who: short(spender), token } }
            : {
                severity: "danger",
                key: "sign_risk_approve",
                vars: { who: short(spender), token, amount: amount.toString() },
              },
        ];
      }
      case SELECTORS.permit2Approve: {
        const { args } = decodeFunctionData({ abi: ABI, data: data as `0x${string}` });
        const [permitToken, spender, amount] = args as unknown as [string, string, bigint, number];
        return [
          {
            severity: "danger",
            key: "sign_risk_permit2",
            vars: { who: short(spender), token: short(permitToken), amount: amount.toString() },
          },
        ];
      }
      case SELECTORS.setApprovalForAll: {
        const { args } = decodeFunctionData({ abi: ABI, data: data as `0x${string}` });
        const [operator, approved] = args as unknown as [string, boolean];
        return [
          approved
            ? { severity: "danger", key: "sign_risk_all", vars: { who: short(operator), token } }
            : { severity: "notice", key: "sign_risk_all_off", vars: { who: short(operator), token } },
        ];
      }
      case SELECTORS.increaseAllowance: {
        const { args } = decodeFunctionData({ abi: ABI, data: data as `0x${string}` });
        const [spender, added] = args as unknown as [string, bigint];
        return [
          {
            severity: "danger",
            key: "sign_risk_increase",
            vars: { who: short(spender), token, amount: added.toString() },
          },
        ];
      }
      case SELECTORS.permit: {
        const { args } = decodeFunctionData({ abi: ABI, data: data as `0x${string}` });
        const [, spender, value] = args as unknown as [string, string, bigint];
        return [
          {
            severity: "danger",
            key: "sign_risk_permit",
            vars: { who: short(spender), token, amount: value.toString() },
          },
        ];
      }
      case SELECTORS.transferFrom: {
        const { args } = decodeFunctionData({ abi: ABI, data: data as `0x${string}` });
        const [from, recipient, amount] = args as unknown as [string, string, bigint];
        return [
          {
            severity: "notice",
            key: "sign_risk_transfer_from",
            vars: { from: short(from), to: short(recipient), token, amount: amount.toString() },
          },
        ];
      }
      default:
        return [];
    }
  } catch {
    // 參數解不開就當認不得。寧可說「解不出來」，也不要吐一個半對的解讀。
    return [];
  }
}

/** 有沒有需要人停下來的東西。用來決定要不要擋掉自動觸發錢包。 */
export function hasDanger(findings: readonly CalldataFinding[]): boolean {
  return findings.some((f) => f.severity === "danger");
}
