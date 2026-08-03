# 設計 brief

給做介面的兩位。設計決定歸你們，這份寫的是要達到什麼、什麼不能違反、以及我解不掉的問題。

## 這是什麼

**一個渲染在 AI 對話裡的面板**（Claude Desktop、claude.ai、ChatGPT 都支援這個機制）。

使用者叫 agent 幫他在區塊鏈上做事。agent 準備好一筆交易後，這個面板直接出現在對話中，顯示「這筆交易實際會造成什麼」。

> 2026-07-31 更新：原本規劃是瀏覽器插件側邊欄，已經砍掉。查證後三個同類插件產品兩個被錢包收購後關站、一個做不下去收攤，那條路不打。現在的形態是 MCP App。

## 使用者在哪個時刻

他剛跟 agent 講完一句話，現在畫面上要他簽名。簽下去不能反悔，錢會動。

他讀不懂那筆交易本身，那是一段編碼過的資料。而且畫面上沒有任何 dapp 網頁可以參照——agent 講的話是他唯一的線索，而 agent 就是準備那筆交易的一方。

## 要達到什麼（依重要性排序）

1. **他按下簽名之前，知道這筆交易會造成什麼。**
2. **實際效果跟他要的不一樣時，他不會漏看。**
3. **一樣的時候，不要讓他養成「看到綠色就按」的反射。** 這個習慣一旦養成，這個產品就失去意義了。
4. **想查證的人查得到底層，不想查的人不被技術細節干擾。** 底層是一堆十六進位字串，多數人不需要，但需要的人一定要拿得到。
5. **在側邊欄的寬度裡讀得完。** 不要滾很久才看到結論。

## 五種狀態

同一個面板有五種結果，視覺上怎麼分層是你們決定的。各自要傳達的意思：

| 狀態 | 要讓使用者感覺到 |
|---|---|
| 一致 | 檢查過了，可以往下走。但不要誘導他直接按 |
| 部分不符 | 沒有人騙他，但實際結果跟他理解的不同。要看，不是要怕 |
| 不一致 | 停。這一頁他該做的只有一件事：不要簽 |
| 檢查沒完成 | 我們沒能驗證。不是通過，也不是有危險 |
| 沒有可對照的 | 這筆交易從外部來的，我們不知道他原本要什麼，只能呈現結果 |

第三種是這個產品存在的理由。第二種最容易被誤讀成安全。

## 不能違反的（這些是產品邏輯，不是設計偏好）

1. **簽名按鈕能不能按，只看資料裡的 `signable`。** 不要從狀態自己推。有些情況看起來沒問題但系統不允許簽。
2. **「一致 / 不一致」的判斷是外面算好傳進來的。** 介面不要自己算。
3. **每一條結論都要能追到它的原始資料。** 結論那層是解讀，原始那層是節點跑出來的。想查的人一定要能穿到底。
4. **沒有的資料不要補。** 只用下面型別裡有的欄位。

第 3 條是我們跟同類產品的差別，所以它不能只是一個「進階選項」。至於它長什麼樣、藏多深，你們決定。

## 工程限制（不是美學問題）

- 純 React 元件 + Tailwind。不要 Next.js 的 server component。
- 資料全部從 props 進來。不要 fetch、不要 `useEffect` 抓資料。**沙箱預設禁止對外連線**，載不到任何外部資源，字體與圖示都要內嵌或用系統的。
- **寬度由 host 決定，不是我們定的。** 做成能在窄到寬都自然的版面，不要假設某個固定寬度。
- 主題也由 host 推過來（淺色深色、字體、安全區域）。用 CSS 變數，不要寫死顏色。
- 一個元件一個檔案，可以單獨複製走。

## 你們決定的

版面順序、視覺層級、顏色、字體、間距、狀態的視覺語言、原始資料要怎麼安放、要不要動畫、進場方式、元件怎麼拆。

我沒有意見，有意見的地方寫在上面了。

## 資料

型別定義在 `src/contract.ts`，貼給 v0 或 Bolt 的版本在本檔最後。

開 `mock/index.html` 看五個情境（兩個是對主網真實模擬跑出來的）。截圖貼給工具比文字描述有效。

## 現有的模擬

**https://claude.ai/code/artifact/70828257-3564-4e5b-8841-1aeb9d4ac5f7**

**這是功能參考，不是設計參考。** 做它是為了確認資料齊不齊、五種狀態都接得起來。版面可以整個推翻。

值得看的只有一件事：切換那五個情境，看每種情況下有哪些資料、哪些沒有。標「真實模擬」的兩個是對 Monad 主網跑出來的，不是編的。

## 一個踩過的坑，你們會遇到

底層框架回傳的文字是寫給程式看的，金額是 wei（`250000000000000000`）、地址是完整 42 字元。我們已經加了一層轉換把它變成人話（`0.25 MON`、`0x9f2c…a41b`），所以 `text` 欄位拿到就能直接顯示。

但這代表一件事：**不要自己再去解析 `data` 或 `change` 裡的原始值來顯示**，那些是給「展開看依據」用的。要顯示就用 `text`。

## 我解不掉的問題

這幾個我想聽你們的判斷：

1. 「部分不符」怎麼做到既明顯又不讓人誤以為危險。這兩個要求會互相拉扯。
2. 「一致」怎麼讓人相信檢查真的做了，同時不誘導他直接按。
3. 那些十六進位的原始資料要怎麼安放。預設藏起來、每條可展開、另開一個分頁、還是別的做法。
4. 側邊欄出現的時候要不要有進場動作，還是直接出現比較好。
5. 使用者怎麼把它叫出來。Monica 用 Ctrl+M，我們該用什麼。

## 交付

一個元件一個資料夾，裡面放 `.tsx`、用到的樣式、一句話說明它吃什麼 props。

不用整理、不用寫測試、不用接資料。整合不歸你們。

## 有疑問直接問

型別欄位的意思、某個狀態什麼時候會出現、某個資料是不是一定有，這些問我。不要照字面猜，猜錯的成本是整個元件重做。

---

## 附錄：貼給 v0 / Bolt 的型別

開新對話，第一則訊息貼這段，先讓它確認理解，不要急著要它產程式。

````
我要做一個瀏覽器插件側邊欄，顯示區塊鏈交易在簽名前的檢查結果。
以下是專案已經定好的 TypeScript 型別。你產出的元件必須使用這些型別，
不要改欄位名稱、不要新增欄位、不要刪欄位。

```ts
/** 意圖從哪裡來 */
type IntentSource = "panel" | "agent";

/** 使用者原本要什麼。沒有意圖時整個是 null */
interface StatedIntent {
  source: IntentSource;
  protocol: string;
  method: string;
  params: Readonly<Record<string, string>>;
  text: string;
}

/** 鏈上的原始變動，只有兩種 */
type Change =
  | { kind: "event"; address: string; topics: readonly string[]; data: string }
  | { kind: "nativeTransfer"; from: string; to: string; value: string };

/** 一條證據。text 是給人看的一句話，已經處理成人話（金額換算好、地址縮短） */
interface ReceiptChange {
  kind: "change";
  change: Change;
  data: Record<string, unknown>;
  text: string;
}

/** 報告。changes 可以巢狀，代表這個操作內部又呼叫了別的協議 */
interface Receipt {
  kind: "receipt";
  protocol: string;
  outcome: Record<string, string>;
  text: string;
  changes: readonly (ReceiptChange | Receipt)[];
}

interface Warning { code: string; message: string; }

/** 檢查結論，五種 */
type Verdict =
  | { kind: "match" }
  | { kind: "partial"; reason: string }
  | { kind: "mismatch"; conflicts: readonly string[] }
  | { kind: "noIntent" }
  | { kind: "blocked"; warnings: readonly Warning[] };

/** 元件的 props 就是這個 */
interface EvidencePanelView {
  intent: StatedIntent | null;
  receipt: Receipt | null;
  changes: readonly Change[];
  warnings: readonly Warning[];
  verdict: Verdict;
  signable: boolean;
  account: string;                                  // 誰在送這筆交易
  tokens: Record<string, { symbol: string; decimals: number }>;  // 金額格式化用
}
```

先不要產程式，跟我確認你理解了這些型別。
````

貼完型別再貼 `fixtures.json`（專案根目錄，`pnpm build:mock` 產生，裡面有兩筆是對
主網真實模擬跑出來的），然後才描述你們要它做的畫面。

## 三個工具的坑

1. **它會自己加欄位**（`severity`、`riskLevel`、`timestamp` 之類）。直接說「只能用我給你的欄位」。
2. **它會把判斷邏輯寫進元件**，自己算一致不一致、自己決定簽名鍵開關。不要。
3. **它會產整個 Next.js 專案骨架。** 要純元件。
