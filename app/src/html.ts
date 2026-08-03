/**
 * 面板與簽名頁共用的 HTML 小工具。
 *
 * 抽出來是因為跳脫邏輯有兩份會飄。兩個出口都把不可信字串（agent 傳來的意圖、
 * 錯誤訊息、鏈上回傳的資料）插進 innerHTML，跳脫錯一邊就是一個注入點。
 */

const ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
};

export function esc(value: unknown): string {
  return String(value).replace(/[&<>"]/g, (c) => ENTITIES[c] ?? c);
}

/** 長 hex 中間省略。預設值維持面板原本的行為（>20 才縮，前 10 後 6）。 */
export function shortHex(hex: string, head = 10, tail = 6): string {
  return hex.length > head + tail + 4 ? `${hex.slice(0, head)}…${hex.slice(-tail)}` : hex;
}
