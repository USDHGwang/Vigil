# vendor/moss

Moss 的原始碼副本。上游是 [nishuzumi/moss](https://github.com/nishuzumi/moss)，MIT
授權，作者 BoxChen（Monad Foundation 的 DevRel 工程師）。上游 README 自己標明：

> Moss is unaudited alpha software. Do not use it with production funds.

## 釘在哪裡

| 來源 | commit | 日期 |
|---|---|---|
| `packages/{core,simulator,system,erc}`、`packages/protocols/kuru` | `97df9c1a43f2c592fbdebee267a250e6a21f341e` | 2026-08-02 |
| `packages/protocols/shmonad` | fork 分支 `feat/shmonad-adapter`（`12a7bab`）＋尚未提交的事件歸屬修復 | 2026-07-23 |

shMONAD adapter 還沒進上游（PR 進行中），所以那一包是從 fork 的工作目錄取的，
包含 `isSameAddress` / `assertShMonadEvent` 那組事件歸屬檢查。

## 為什麼收進來而不是用 npm 或 link

**npm 上的版本更舊。** `@themoss/core@0.1.0` 發布於 2026-07-10，比這裡釘的版本舊三週，
中間那批 simulator 加固（pin base block、freeze receipt evidence、coverage safety）
都不在裡面。而 `@themoss/protocol-shmonad` 根本沒發到 npm。

**原本的 `link:` 指向本機路徑**，別人 clone 這個 repo 之後 `pnpm install` 會直接失敗。

**上游動得很快。** 我們 checkout 之後十天內推了十幾個提交，其中一個把
`monadRuntime()` 移除、Runtime 從 `@themoss/system` 搬到 `@themoss/core`。
一個自標 alpha 又高速迭代的相依，要釘死才有可重現的 demo。

## 為什麼放原始碼不放編譯結果

這個專案的主張是「你可以自己查證發生了什麼」。相依裡塞一包讀不了的編譯產物，
跟那個主張衝突。原始碼在這裡，`pnpm build` 自己編。

## 怎麼更新

```bash
git -C <你的 moss checkout> fetch upstream
# 把 packages/{core,simulator,system,erc} 與 protocols/kuru 複製過來
# shmonad 等它進上游之後也一起換掉
pnpm install && pnpm build && pnpm check
```

更新前先看上游有沒有動 Runtime、Registry、Receipt 這幾個介面——我們對它們有直接相依。

## 我們改了什麼

**所有 `src/` 檔案跟上游 `97df9c1` 逐字相同**（shMONAD 那包除外，本來就是我們寫的）。
驗證方式：`diff -r <上游 checkout>/packages/*/src vendor/moss/packages/*/src`。

`package.json` 有兩處修剪，都是拿掉「我們沒有 vendor 到、留著會讓安裝失敗」的東西：

| 套件 | 移除 |
|---|---|
| `erc` | devDep `tsx`；script `gen:abis` |
| `protocols/kuru` | devDep `@themoss/abi-tools`、`tsx`；script `gen:abis`、`test:abi:online`、`update:abis` |

那些都是上游用來從瀏覽器抓 ABI 的工具鏈，我們只 vendor `src/`，沒有對應的 `scripts/`
目錄，也不跑那些指令。`core`、`simulator`、`system` 一個字都沒動。

## 沒有 vendor 的東西

上游還有 `protocols/apriori`（aPriori aprMON 流動性質押）、`protocols/pancakeswap`、
`protocols/monad-cards`、`mcp-server`、`abi-tools`。用不到就沒帶。

`apriori` 是 Monad 上第二個流動性質押協議，要多做一個示範協議的話那是最近的一個。
