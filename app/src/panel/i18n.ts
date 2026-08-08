/**
 * 面板文案字典：en / zh-CN / zh-TW 三語系。
 *
 * locale 進 view（EvidencePanelView.locale）——它是證據面板的一部分，
 * 不是渲染選項。TUI（text.ts）與 MCP UI（render.ts）兩個出口讀同一份
 * view、同一個 locale，語言一致。preview_transaction 收 locale 參數，
 * 由 agent 從對話語言決定（預設 en：agent 知道使用者用什麼語言，是
 * 唯一能決定這件事的角色）。
 *
 * 佔位符用 {var} 形式，t() 帶 vars 取代。
 */

export type Locale = "en" | "zh-CN" | "zh-TW";

export interface MessageVars {
  [name: string]: string;
}

/** 佔位符 {name} → vars[name] */
function fmt(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => vars[name] ?? `{${name}}`);
}

/** 字典值：raw template 字串。t() 套 vars。 */
type Dict = Record<string, string>;

const en: Dict = {
  title:
    "Vigil · Pre-sign check · Evidence comes from simulating on Monad mainnet, not from whatever prepared this transaction",

  verdict_match: "No unexpected actions found",
  verdict_partial: "Something needs your review",
  verdict_mismatch: "Transaction does not match this operation",
  verdict_noIntent: "Nothing to compare against",
  verdict_blocked: "This cannot be signed",

  dir_out: "spend",
  dir_in: "receive",
  dir_approval: "approve",
  dir_pending: "pending",
  dir_none: "none",
  kind_nativeTransfer: "transfer",
  kind_event: "event",

  section_intent: "Requested",
  section_evidence: "On-chain",

  no_intent:
    "This transaction came in from outside; there is no request to compare it against, so it is shown as-is, without comparison.",
  you_self: "yourself",
  unlimited: "unlimited",
  token_unknown: "this token",
  degraded:
    "This part has no readable interpretation; showing raw changes, no guessing.",
  no_changes: "Simulation aborted; no changes were produced.",
  zero_changes: "No changes were produced.",
  no_readable: "{addr} emitted an event; no interpretation available here.",

  checks_line: "The machine only verified that the transaction matches this operation",
  checks_body:
    "Whether it matches what you actually said is for you to check against the two sections above.",
  checks_full:
    "The machine only verified that the transaction matches this operation. Whether it matches what you actually said is for you to check against the two sections above.",
  account_wallet: "The “you” above refers to {who}, from the wallet you connected.",
  account_agent:
    "The “you” above refers to {who}. This address was supplied by the agent and was not verified; at signing time the wallet compares it and refuses if it doesn't match.",
  sign_ok:
    "If you sign, the signing happens in your own wallet — this tool never touches your private key.",
  sign_no: "This cannot be signed.",
  raw_count:
    "The {n} raw on-chain changes are in the structured result; open that for line-by-line verification.",

  // render.ts（HTML 面板）
  params: "Parameters",
  resim: "Re-simulate after editing",
  resim_busy: "Re-simulating…",
  resim_note: "Editing parameters re-runs the simulation on mainnet. Nothing goes on-chain, nothing is spent.",
  src_btn: "Evidence",
  src_label: "Expand this item's evidence",
  src_caption: "Raw data from the simulated node trace, no interpretation",
  src_caption_plain: "Raw data, no interpretation",
  sign_btn: "Sign in wallet",
  sign_btn_disabled: "Cannot sign",
  cancel_btn: "Cancel",
  fingerprint_label: "Handoff fingerprint",
  raw_changes_title: "Ordered changes returned by the node ({n})",
  raw_outcome_title: "Post-simulation values",
  no_compare: "Nothing to compare this against",
  footer_handoff:
    "The signing happens in your own wallet; this panel never touches your private key. The next page shows the same fingerprint.",

  // humanize.ts（鏈上變動的人話描述）
  you_spend: "You spend {amount}",
  you_receive: "You receive {amount}",
  you_receive_minted: "You receive {amount} (newly minted)",
  your_burned: "Your {amount} was burned",
  addr_transfer: "{from} transferred {amount} to {to}",
  approve_unlimited: "Approve {spender} to move your {token}, with no limit",
  approve_amount: "Approve {spender} to move {amount}",
  min_units_unknown: "{n} minimal units (decimals unknown, can't convert)",
  sign_checking: "Checking wallet…",
  sign_connect: "Connect wallet & sign",
  sign_confirm: "Confirm in wallet…",
  sign_retry: "Try again",
  sign_no_wallet: "No wallet extension detected in this browser. Install one and come back.",
  sign_not_sent: "Not sent: {message}",
  sign_sent: "Sent.",
  sign_wrong_account: "The account that sends this transaction is not the one your wallet is connected to now. The balance and \"you spend\" figures in the panel are all based on the sending account — none of that applies to you. To sign, switch your wallet to the sending account first.",
  sign_no_value: "No MON attached",
  sign_from: "From",
  sign_to: "To",
  sign_value: "Value",
  sign_data: "Data",
  sign_tx_from: "Transaction from",
  sign_wallet_now: "Your wallet is",
  sign_none: "(none)",
  sign_title: "Last step before signing",
  sign_fingerprint: "Handoff fingerprint",
  sign_fp_hint: "Compare with the one shown in the panel. If they match, the transaction was not swapped on the way. If you did not arrive here from a Vigil panel, this fingerprint proves nothing — whoever wrote the link also wrote the fingerprint.",
  sign_batch_prefix: "This batch has {n} transactions; showing the 1st",
  sign_tx_content: "Transaction details",
  sign_many_warn: "Only one can be sent at a time. To send the whole batch, come back when multi-tx signing is ready.",
  sign_tx_hash: "Transaction hash:",
  sign_foot: "This page does not save or upload your transaction. It never touches your private key — signing happens in your wallet.",
  sign_fail_title: "Can't continue",
  sign_summary_untrusted: "Whoever opened this page described it as:",
  sign_risk_title: "What this calldata actually does",
  sign_risk_lead:
    "Decoded on this page from the bytes about to be sent. It does not come from the description above and does not depend on it.",
  sign_risk_unknown:
    "This page cannot decode this calldata, so it cannot tell you what it does. The description above is the sender's own words and nothing here has checked it.",
  sign_risk_unlimited:
    "Unlimited approval: {who} can move your {token} balance from now on, with no limit and no expiry.",
  sign_risk_approve: "Approval: {who} can move up to {amount} (raw units) of your {token}.",
  sign_risk_revoke: "Revokes {who}'s allowance on {token}.",
  sign_risk_all:
    "Collection-wide approval: {who} can move every token you hold in {token}, including ones you receive later.",
  sign_risk_all_off: "Revokes {who}'s rights over the {token} collection.",
  sign_risk_increase: "Raises {who}'s allowance on {token} by {amount} (raw units).",
  sign_risk_permit: "Permit: grants {who} an allowance of {amount} (raw units) on {token}.",
  sign_risk_permit2:
    "Permit2 approval: {who} can move up to {amount} (raw units) of your {token} through Permit2.",
  sign_risk_transfer_from: "Moves {amount} (raw units) of {token} from {from} to {to}.",
  tx_fallback: "this transaction",
  panel_name: "Vigil · Pre-sign check",
  panel_source: "Mainnet simulation",
  tab_summary: "Conclusion",
  tab_raw: "Raw data",
  loading: "Simulating this transaction against Monad mainnet…",
  warn_insufficient: "Insufficient balance. You have {have} MON, this needs {need} MON (about {fee} MON in gas), short by {short} MON. Sending it as-is will fail and the gas is still charged.",
  warn_fee_unknown: "Gas can't be estimated, so we can't confirm this is affordable. The principal is {value} MON and you have {balance} MON, but gas is on top. This check didn't complete — it's not that the transaction is bad.",
  warn_multi_tx: "This operation needs {n} transactions; the sign page can only send the first one, so what gets signed wouldn't match the whole batch this panel verified. Signing is disabled for now.",
  trace_failed: "Simulation halted",
  summary_blocked: "Simulation did not pass; cannot sign: {reasons}",
  conflict_nft_approval: "An extra NFT approval: {who} can move #{id} of yours in {token} — not an object of this operation",
  conflict_unlimited_approval: "An extra unlimited approval for {who} — not an object of this operation",
  conflict_approval: "An extra approval for {who} — not an object of this operation",
  conflict_batch_grant: "An extra collection-wide approval: {who} can move every token you own in {collection} — not an object of this operation",
  conflict_operation: "Actually executes {actual}, you asked for {requested}",
  reason_batch_grant: "This transaction lets {who} move every token you own in {what}, including ones you get later, with no quantity limit. Confirm you really want this.",
  reason_unlimited: "This transaction gives {who} unlimited access — not just this time; it can move this token's balance from now on. Confirm you really want this.",
  reason_approval_named:
    "This transaction lets {who} move your {what}. That address came from the parameters the agent supplied, so the machine cannot tell whether you named it. Check it against what you actually asked for.",
  reason_no_module: "This protocol has no adapter, so only raw unparsed changes can be shown and no structural comparison is possible",
  handoff_copy_lead: "Copy the full URL below and open it in your browser to sign in your own wallet.",
  handoff_open_lead: "If the browser didn't open, open this URL yourself.",
  handoff_note: "That page shows the same fingerprint — compare it with the one above.",
  handoff_copy_btn: "Copy URL",
  handoff_open_btn: "Open directly",
  handoff_note_tiny: "Open directly goes through a regular link, separate from the host's openLink mechanism — sometimes it works. If nothing happens, use the copy path.",
  err_no_signpage: "This server didn't tell the panel where the sign page is; can't hand off.",
  sign_opening: "Opening sign page…",
  handoff_blocked: "This host doesn't allow the panel to open links directly.",
  handoff_opened: "Asked this host to open the sign page.",
  handoff_open_failed: "Failed to open link: {error}",
  approval_for_all_on:
    "Let {operator} transfer every token you hold in {collection}, including ones you get later",
  approval_for_all_off:
    "Revoke {operator}'s transfer rights over the {collection} collection",
  deposit_recorded: "Protocol records this stake: {assets} → {shares}",
  withdraw_recorded:
    "Protocol records this redemption: {shares} → {assets}; the proceeds arrive outside this transaction",

  // server.ts 資料工具的文字輸出（discover / recent_previews / remember_account / panel_host_info / vigil）
  // locale 由 agent 從對話語言決定，default en——與 preview_transaction 同一套機制。
  tool_discover_title: "Operations this server can simulate on Monad ({n}):",
  tool_discover_native_hint: ' (token address, or the literal "native" for native MON)',
  tool_discover_receiver_hint: " (optional — defaults to the sending account)",
  tool_recent_empty: "No transactions have been previewed in this session yet.",
  tool_recent_agent_said: "What the agent said you asked: {request}",
  tool_recent_effect: "Effect: {summary}",
  tool_recent_fingerprint: "Fingerprint: {fp}",
  tool_recent_not_signable: " not signable",
  tool_remember_ok:
    "Remembered wallet address {short} for this conversation. Future previews simulate against this address (real balance and fees). It lives only in this session's memory — nothing is written anywhere.",
  tool_remember_stateless:
    "This deployment (stateless HTTP) cannot remember an address across requests. Keep the user's wallet address in the conversation and pass account to every preview_transaction call.",
  tool_recent_stateless:
    "This deployment (stateless HTTP) keeps no preview history. Requests here share one process with no session boundary, so a history would show one user what another user previewed. Scroll back through the conversation instead.",
  tool_host_unknown: "(not declared)",
  tool_host_declared: "Declared extensions: {list}",
  tool_host_none_ext: "(no extensions declared)",
  tool_host_supports_yes: "yes — the panel renders as a visual panel",
  tool_host_supports_no: "no — falls back to the text panel",
  tool_host_caps: "Full capabilities: {json}",
  tool_vigil_intro:
    "Vigil — check before you sign. When you ask the agent to do something on Monad, Vigil simulates what the transaction will actually do and shows it to you before you sign.",
  tool_vigil_trust:
    "Trust model in one sentence: the evidence comes from simulating on Monad mainnet — not from the agent that prepared the transaction. Everything you see before signing is what actually happens on-chain.",
  tool_vigil_cmd_header: "Command map (say these, the agent calls the tools):",
  tool_vigil_cmd_preview: "preview a transaction → preview_transaction",
  tool_vigil_cmd_discover: "see what operations exist on Monad → discover",
  tool_vigil_cmd_remember: "remember your wallet address (this conversation) → remember_account",
  tool_vigil_cmd_recent: "look up what this conversation has previewed → recent_previews",
  tool_vigil_first_use:
    "First time: tell the agent your wallet address (it calls vigil-remember), then say what you want to do (e.g. “stake 0.25 MON into shMON”). The agent will discover → prepare → vigil-preview the evidence, and you sign in your wallet after you confirm.",
  tool_vigil_no_memo:
    "You don't need to remember any commands — just say what you want, and the agent handles the tools.",
  raw_changes_short: "{n} unparsed changes",
  err_query_no_tx: "{protocol}.{method} is a query, not a capability — there is no transaction to simulate",
};

const zhCN: Dict = {
  title:
    "Vigil · 签名前检查 · 证据来自 Monad 主网模拟，不是来自准备这笔交易的程序",

  verdict_match: "没有发现意料外的动作",
  verdict_partial: "需要你确认",
  verdict_mismatch: "交易内容跟这个操作对不上",
  verdict_noIntent: "没有可以对照的东西",
  verdict_blocked: "这笔不能签",

  dir_out: "支出",
  dir_in: "取得",
  dir_approval: "授权",
  dir_pending: "待处理",
  dir_none: "无",
  kind_nativeTransfer: "转账",
  kind_event: "事件",

  section_intent: "要求",
  section_evidence: "链上行为",

  no_intent: "这笔交易从外部来，没有可以对照的要求，只呈现结果、不做对照。",
  you_self: "你自己",
  unlimited: "无上限",
  token_unknown: "这个代币",
  degraded: "这部分没有可用的解读，只显示原始变动，不做猜测。",
  no_changes: "模拟中止，没有产生任何变动。",
  zero_changes: "没有产生任何变动。",
  no_readable: "{addr} 发出一个事件，这里没有对它的解读。",

  checks_line: "机器只验证了交易与这个操作相符",
  checks_body: "你说的话对不对得上，要你自己看上面两段。",
  checks_full: "机器只验证了交易与这个操作相符。你说的话对不对得上，要你自己看上面两段。",
  account_wallet: "上面的「你」指 {who}，来自你连接的钱包。",
  account_agent:
    "上面的「你」指 {who}。这个地址是 agent 给的，我们没验证过；签名时钱包会比较，不是它就挡下来。",
  sign_ok: "要签的话，签名在你自己的钱包里完成，这个工具碰不到你的私钥。",
  sign_no: "这笔不能签。",
  raw_count: "原始的 {n} 笔链上变动在结构化结果里，需要逐条核对就去看那份。",

  params: "参数",
  resim: "改完重新模拟",
  resim_busy: "重新模拟中…",
  resim_note: "改了参数会对主网重跑一次模拟。不上链、不花钱。",
  src_btn: "依据",
  src_label: "展开这条的依据",
  src_caption: "节点模拟跑出来的原始数据，不经任何解读",
  src_caption_plain: "未经解读的原始数据",
  sign_btn: "在钱包里签名",
  sign_btn_disabled: "不能签名",
  cancel_btn: "取消",
  fingerprint_label: "交接指纹",
  raw_changes_title: "节点返回的有序变动（{n}）",
  raw_outcome_title: "模拟后的数值",
  no_compare: "这笔没有可对照的要求",
  footer_handoff:
    "签名在你自己的钱包里完成，这个面板碰不到你的私钥。下一页会显示同一串指纹。",

  you_spend: "你支出 {amount}",
  you_receive: "你收到 {amount}",
  you_receive_minted: "你取得 {amount}（新铸造的）",
  your_burned: "你的 {amount} 被销毁",
  addr_transfer: "{from} 转 {amount} 给 {to}",
  approve_unlimited: "授权 {spender} 动用你的 {token}，没有上限",
  approve_amount: "授权 {spender} 动用 {amount}",
  min_units_unknown: "{n} 个最小单位（查不到小数位，换算不了）",
  sign_checking: "检查钱包…",
  sign_connect: "连接钱包并签名",
  sign_confirm: "在钱包里确认…",
  sign_retry: "再试一次",
  sign_no_wallet: "这个浏览器没有侦测到钱包扩展。装一个再回来。",
  sign_not_sent: "没有送出：{message}",
  sign_sent: "已送出。",
  sign_wrong_account: "这笔交易的发起账户，不是你钱包现在连着的那个。面板上算的余额与「你支出多少」都是照发起账户算的，跟你无关。要签的话，先在钱包里切到发起账户。",
  sign_no_value: "不附带 MON",
  sign_from: "从",
  sign_to: "送到",
  sign_value: "附带金额",
  sign_data: "数据",
  sign_tx_from: "交易的发起账户",
  sign_wallet_now: "你钱包现在是",
  sign_none: "（没有）",
  sign_title: "签名前最后一步",
  sign_fingerprint: "交接指纹",
  sign_fp_hint: "跟面板上显示的核对一下。一样，代表这笔交易中间没有被换过。如果你不是从 Vigil 面板过来的，这串指纹证明不了任何事——写这个链接的人也写了这串指纹。",
  sign_batch_prefix: "这批有 {n} 笔，以下是第 1 笔",
  sign_tx_content: "交易内容",
  sign_many_warn: "目前一次只送得出一笔。要送完整批，等多笔签名做好再来。",
  sign_tx_hash: "交易哈希：",
  sign_foot: "这一页不会保存也不会上传你的交易。它碰不到你的私钥，签名在你的钱包里完成。",
  sign_fail_title: "没办法继续",
  sign_summary_untrusted: "打开这一页的人是这样描述它的：",
  sign_risk_title: "这段 calldata 实际做什么",
  sign_risk_lead: "这一页从要送出去的字节自己解出来的。它不来自上面那句描述，也不依赖它。",
  sign_risk_unknown:
    "这一页解不开这段 calldata，讲不出它做什么。上面那句是发送方自己写的，这一页没有核过。",
  sign_risk_unlimited: "无上限授权：{who} 从现在起可以动你 {token} 的余额，没有额度上限也没有期限。",
  sign_risk_approve: "授权：{who} 可以动你 {token} 最多 {amount}（原始单位）。",
  sign_risk_revoke: "撤销 {who} 在 {token} 上的额度。",
  sign_risk_all: "整批授权：{who} 可以转移你在 {token} 里持有的每一个代币，包含你以后才拿到的。",
  sign_risk_all_off: "撤销 {who} 对 {token} 系列的权限。",
  sign_risk_increase: "把 {who} 在 {token} 上的额度调高 {amount}（原始单位）。",
  sign_risk_permit: "Permit：给 {who} 在 {token} 上 {amount}（原始单位）的额度。",
  sign_risk_permit2: "Permit2 授权：{who} 可以透过 Permit2 动你 {token} 最多 {amount}（原始单位）。",
  sign_risk_transfer_from: "把 {amount}（原始单位）的 {token} 从 {from} 转到 {to}。",
  tx_fallback: "这笔交易",
  panel_name: "Vigil · 签名前检查",
  panel_source: "主网模拟",
  tab_summary: "结论",
  tab_raw: "原始数据",
  loading: "正在对 Monad 主网模拟这笔交易…",
  warn_insufficient: "余额不够。你有 {have} MON，这笔需要 {need} MON（其中约 {fee} MON 是手续费），差 {short} MON。照这样送出去会失败，手续费照扣。",
  warn_fee_unknown: "手续费估不出来，所以没办法确认这笔付不付得起。本金是 {value} MON，你有 {balance} MON，但手续费要另外加。这是检查没做完，不是这笔交易有问题。",
  warn_multi_tx: "这个操作要 {n} 笔交易才完成，目前签名页一次只送得出第一笔，签出去的会跟面板验证过的整包不一致，所以这批先不开放签名。",
  trace_failed: "模拟中止",
  summary_blocked: "模拟未通过，不可签名：{reasons}",
  conflict_nft_approval: "多出一笔 NFT 授权：{who} 可以转走你在 {token} 的编号 {id} 这一颗，它不是这个操作指定的对象",
  conflict_unlimited_approval: "多出一笔无上限授权给 {who}，它不是这个操作指定的对象",
  conflict_approval: "多出一笔授权给 {who}，它不是这个操作指定的对象",
  conflict_batch_grant: "多出一笔整批授权：{who} 可以转走你在 {collection} 这个系列里的每一个，它不是这个操作指定的对象",
  conflict_operation: "实际执行的是 {actual}，你要求的是 {requested}",
  reason_batch_grant: "这笔交易让 {who} 可以转走你在 {what} 这个系列里的每一个，包含你以后才拿到的，而且没有数量上限。确认你真的要这样做。",
  reason_unlimited: "这笔交易给 {who} 无上限的动用权，不只这一次，往后你这个代币的余额它都动得了。确认你真的要这样做。",
  reason_approval_named:
    "这笔交易让 {who} 可以动你的 {what}。那个地址是 agent 传进来的参数，机器判断不了你有没有指定过它。请自己对照一下你实际要求的是什么。",
  reason_no_module: "这个协议没有解读模块，只能显示未经解读的原始变动，无法做结构比对",
  handoff_copy_lead: "复制下面整串网址，贴到浏览器打开，在你自己的钱包里完成签名。",
  handoff_open_lead: "浏览器没跳出来的话，用下面这串网址自己开。",
  handoff_note: "那一页会显示同一串指纹，跟上面核对一下。",
  handoff_copy_btn: "复制网址",
  handoff_open_btn: "直接打开",
  handoff_note_tiny: "「直接打开」走的是普通链接，跟 host 的 openLink 是两套机制，有时候这条通得了。没反应就用复制那条。",
  err_no_signpage: "这个 server 没有告诉面板签名页在哪里，交接不出去。",
  sign_opening: "打开签名页…",
  handoff_blocked: "这个 host 不允许面板直接打开链接。",
  handoff_opened: "已请这个 host 打开签名页。",
  handoff_open_failed: "打开链接失败：{error}",
  approval_for_all_on:
    "让 {operator} 可以转走你在 {collection} 这个系列里的每一个，包含你以后才拿到的",
  approval_for_all_off: "收回 {operator} 对 {collection} 这个系列的转移权",
  deposit_recorded: "协议记录这笔质押：{assets} 换 {shares}",
  withdraw_recorded:
    "协议记录这笔赎回：{shares} 换回 {assets}，款项不在这笔交易里到账",

  tool_discover_title: "这个服务器可以在 Monad 上模拟的操作（{n}）：",
  tool_discover_native_hint: '（代币地址，或字面量 "native" 表示原生 MON）',
  tool_discover_receiver_hint: "（可省略，默认为发送账户）",
  tool_recent_empty: "这个会话还没有预览过任何交易。",
  tool_recent_agent_said: "agent 说你要求的：{request}",
  tool_recent_effect: "效果：{summary}",
  tool_recent_fingerprint: "指纹：{fp}",
  tool_recent_not_signable: " 不可签名",
  tool_remember_ok:
    "已记住这个对话的钱包地址 {short}。之后的预览都会用这个地址模拟（真实余额与手续费）。只存在这个会话的内存里，不会写入任何地方。",
  tool_remember_stateless:
    "这个部署模式（无状态 HTTP）不支持跨请求记住地址。请在对话中记住用户的钱包地址，每笔 preview_transaction 都带 account 参数。",
  tool_recent_stateless:
    "这个部署模式（无状态 HTTP）不保存预览记录。这里所有请求共用一个 process、没有 session 边界，留记录等于把 A 预览过什么给 B 看到。请改成往回翻对话。",
  tool_host_unknown: "（未声明）",
  tool_host_declared: "声明的 extensions：{list}",
  tool_host_none_ext: "（没有声明任何 extension）",
  tool_host_supports_yes: "是，面板会渲染成画面",
  tool_host_supports_no: "否，会使用文字版面板",
  tool_host_caps: "完整 capabilities：{json}",
  tool_vigil_intro:
    "Vigil — 签名前检查。你叫 agent 在 Monad 上做事之前，先用 Vigil 把交易实际会做什么模拟出来给你看。",
  tool_vigil_trust:
    "信任模型一句话：证据来自 Monad 主网模拟，不是来自准备这笔交易的 agent；你签名之前，看到的每一项都是链上真的会发生的。",
  tool_vigil_cmd_header: "指令对照（说这些话，agent 会对应去调用工具）：",
  tool_vigil_cmd_preview: "预览一笔交易 → preview_transaction",
  tool_vigil_cmd_discover: "看 Monad 上能做什么操作 → discover",
  tool_vigil_cmd_remember: "记住你的钱包地址（这个对话）→ remember_account",
  tool_vigil_cmd_recent: "回查这个对话预览过什么 → recent_previews",
  tool_vigil_first_use:
    "第一次使用：告诉 agent 你的钱包地址（agent 会调用 vigil-remember），然后说你想做什么（例如「帮我质押 0.25 MON 成 shMONAD」），agent 会 discover → 准备交易 → vigil-preview 给你看证据，你确认后在钱包里签名。",
  tool_vigil_no_memo: "你不需要记任何指令——直接说你想做什么，agent 会用这些工具完成。",
  raw_changes_short: "{n} 笔未解读的变动",
  err_query_no_tx: "{protocol}.{method} 是 Query 不是 Capability，没有交易可以模拟",
};

const zhTW: Dict = {
  title:
    "Vigil · 簽名前檢查 · 證據來自 Monad 主網模擬，不是來自準備這筆交易的程式",

  verdict_match: "沒有發現意料外的動作",
  verdict_partial: "需要你確認",
  verdict_mismatch: "交易內容跟這個操作對不上",
  verdict_noIntent: "沒有可以對照的東西",
  verdict_blocked: "這筆不能簽",

  dir_out: "支出",
  dir_in: "取得",
  dir_approval: "授權",
  dir_pending: "待處理",
  dir_none: "無",
  kind_nativeTransfer: "轉帳",
  kind_event: "事件",

  section_intent: "要求",
  section_evidence: "鏈上行為",

  no_intent: "這筆交易從外部來，沒有可以對照的要求，只呈現結果、不做對照。",
  you_self: "你自己",
  unlimited: "無上限",
  token_unknown: "這個代幣",
  degraded: "這部分沒有可用的解讀，只顯示原始變動，不做猜測。",
  no_changes: "模擬中止，沒有產生任何變動。",
  zero_changes: "沒有產生任何變動。",
  no_readable: "{addr} 發出一個事件，這裡沒有對它的解讀。",

  checks_line: "機器只驗了交易與這個操作相符",
  checks_body: "你說的話對不對得上，要你自己看上面兩段。",
  checks_full: "機器只驗了交易與這個操作相符。你說的話對不對得上，要你自己看上面兩段。",
  account_wallet: "上面的「你」指 {who}，來自你連接的錢包。",
  account_agent:
    "上面的「你」指 {who}。這個地址是 agent 給的，我們沒驗過；簽名時錢包會比對，不是它就擋下來。",
  sign_ok: "要簽的話，簽名在你自己的錢包裡完成，這個工具碰不到你的私鑰。",
  sign_no: "這筆不能簽。",
  raw_count: "原始的 {n} 筆鏈上變動在結構化結果裡，需要逐條核對就去看那份。",

  params: "參數",
  resim: "改完重新模擬",
  resim_busy: "重新模擬中…",
  resim_note: "改了參數會對主網重跑一次模擬。不上鏈、不花錢。",
  src_btn: "依據",
  src_label: "展開這條的依據",
  src_caption: "節點模擬跑出來的原始資料，不經任何解讀",
  src_caption_plain: "未經解讀的原始資料",
  sign_btn: "在錢包裡簽名",
  sign_btn_disabled: "不能簽名",
  cancel_btn: "取消",
  fingerprint_label: "交接指紋",
  raw_changes_title: "節點回傳的有序變動（{n}）",
  raw_outcome_title: "模擬後的數值",
  no_compare: "這筆沒有可對照的要求",
  footer_handoff:
    "簽名在你自己的錢包裡完成，這個面板碰不到你的私鑰。下一頁會顯示同一串指紋。",

  you_spend: "你支出 {amount}",
  you_receive: "你收到 {amount}",
  you_receive_minted: "你取得 {amount}（新鑄出的）",
  your_burned: "你的 {amount} 被銷毀",
  addr_transfer: "{from} 轉 {amount} 給 {to}",
  approve_unlimited: "授權 {spender} 動用你的 {token}，沒有上限",
  approve_amount: "授權 {spender} 動用 {amount}",
  min_units_unknown: "{n} 個最小單位（查不到小數位，換算不了）",
  sign_checking: "檢查錢包…",
  sign_connect: "連接錢包並簽名",
  sign_confirm: "在錢包裡確認…",
  sign_retry: "再試一次",
  sign_no_wallet: "這個瀏覽器沒有偵測到錢包擴充。裝一個再回來。",
  sign_not_sent: "沒有送出：{message}",
  sign_sent: "已送出。",
  sign_wrong_account: "這筆交易的發起帳戶，不是你錢包現在連著的那個。面板上算的餘額與「你支出多少」都是照發起帳戶算的，跟你無關。要簽的話，先在錢包裡切到發起帳戶。",
  sign_no_value: "不附帶 MON",
  sign_from: "從",
  sign_to: "送到",
  sign_value: "附帶金額",
  sign_data: "資料",
  sign_tx_from: "交易的發起帳戶",
  sign_wallet_now: "你錢包現在是",
  sign_none: "（沒有）",
  sign_title: "簽名前最後一步",
  sign_fingerprint: "交接指紋",
  sign_fp_hint: "跟面板上顯示的對一下。一樣，代表這筆交易中間沒有被換過。如果你不是從 Vigil 面板過來的，這串指紋證明不了任何事——寫這個連結的人也寫了這串指紋。",
  sign_batch_prefix: "這批有 {n} 筆，以下是第 1 筆",
  sign_tx_content: "交易內容",
  sign_many_warn: "目前一次只送得出一筆。要送完整批，等多筆簽名做好再來。",
  sign_tx_hash: "交易雜湊：",
  sign_foot: "這一頁不會保存也不會上傳你的交易。它碰不到你的私鑰，簽名在你的錢包裡完成。",
  sign_fail_title: "沒辦法繼續",
  sign_summary_untrusted: "打開這一頁的人是這樣描述它的：",
  sign_risk_title: "這段 calldata 實際做什麼",
  sign_risk_lead: "這一頁從要送出去的位元組自己解出來的。它不來自上面那句描述，也不依賴它。",
  sign_risk_unknown:
    "這一頁解不開這段 calldata，講不出它做什麼。上面那句是發送方自己寫的，這一頁沒有核過。",
  sign_risk_unlimited: "無上限授權：{who} 從現在起可以動你 {token} 的餘額，沒有額度上限也沒有期限。",
  sign_risk_approve: "授權：{who} 可以動你 {token} 最多 {amount}（原始單位）。",
  sign_risk_revoke: "撤銷 {who} 在 {token} 上的額度。",
  sign_risk_all: "整批授權：{who} 可以轉移你在 {token} 裡持有的每一個代幣，包含你以後才拿到的。",
  sign_risk_all_off: "撤銷 {who} 對 {token} 系列的權限。",
  sign_risk_increase: "把 {who} 在 {token} 上的額度調高 {amount}（原始單位）。",
  sign_risk_permit: "Permit：給 {who} 在 {token} 上 {amount}（原始單位）的額度。",
  sign_risk_permit2: "Permit2 授權：{who} 可以透過 Permit2 動你 {token} 最多 {amount}（原始單位）。",
  sign_risk_transfer_from: "把 {amount}（原始單位）的 {token} 從 {from} 轉到 {to}。",
  tx_fallback: "這筆交易",
  panel_name: "Vigil · 簽名前檢查",
  panel_source: "主網模擬",
  tab_summary: "結論",
  tab_raw: "原始資料",
  loading: "正在對 Monad 主網模擬這筆交易…",
  warn_insufficient: "餘額不夠。你有 {have} MON，這筆需要 {need} MON（其中約 {fee} MON 是手續費），差 {short} MON。照這樣送出去會失敗，手續費照樣扣。",
  warn_fee_unknown: "手續費估不出來，所以沒辦法確認這筆付不付得起。本金是 {value} MON，你有 {balance} MON，但手續費要另外加。這是檢查沒做完，不是這筆交易有問題。",
  warn_multi_tx: "這個操作要 {n} 筆交易才完成，目前簽名頁一次只送得出第一筆，簽出去的會跟面板驗過的整包不一致，所以這批先不開放簽名。",
  trace_failed: "模擬中止",
  summary_blocked: "模擬未通過，不可簽名：{reasons}",
  conflict_nft_approval: "多出一筆 NFT 授權：{who} 可以轉走你在 {token} 的編號 {id} 這一顆，它不是這個操作指定的對象",
  conflict_unlimited_approval: "多出一筆無上限授權給 {who}，它不是這個操作指定的對象",
  conflict_approval: "多出一筆授權給 {who}，它不是這個操作指定的對象",
  conflict_batch_grant: "多出一筆整批授權：{who} 可以轉走你在 {collection} 這個系列裡的每一個，它不是這個操作指定的對象",
  conflict_operation: "實際執行的是 {actual}，你要求的是 {requested}",
  reason_batch_grant: "這筆交易讓 {who} 可以轉走你在 {what} 這個系列裡的每一個，包含你以後才拿到的，而且沒有數量上限。確認你真的要這樣做。",
  reason_unlimited: "這筆交易給 {who} 無上限的動用權，不只這一次，往後你這個代幣的餘額它都動得了。確認你真的要這樣做。",
  reason_approval_named:
    "這筆交易讓 {who} 可以動你的 {what}。那個地址是 agent 傳進來的參數，機器判斷不了你有沒有指定過它。請自己對照一下你實際要求的是什麼。",
  reason_no_module: "這個協議沒有解讀模組，只能顯示未經解讀的原始變動，無法做結構比對",
  handoff_copy_lead: "複製下面整串網址，貼到瀏覽器開啟，在你自己的錢包裡完成簽名。",
  handoff_open_lead: "瀏覽器沒跳出來的話，用下面這串網址自己開。",
  handoff_note: "那一頁會顯示同一串指紋，跟上面對一下。",
  handoff_copy_btn: "複製網址",
  handoff_open_btn: "直接開啟",
  handoff_note_tiny: "「直接開啟」走的是一般連結，跟 host 的 openLink 是兩套機制，有時候這條通得了。沒反應就用複製那條。",
  err_no_signpage: "這個 server 沒有告訴面板簽名頁在哪裡，交接不出去。",
  sign_opening: "開啟簽名頁…",
  handoff_blocked: "這個 host 不允許面板直接開連結。",
  handoff_opened: "已請這個 host 開啟簽名頁。",
  handoff_open_failed: "開連結失敗：{error}",
  approval_for_all_on:
    "讓 {operator} 可以轉走你在 {collection} 這個系列裡的每一個，包含你以後才拿到的",
  approval_for_all_off: "收回 {operator} 對 {collection} 這個系列的轉移權",
  deposit_recorded: "協議記錄這筆質押：{assets} 換 {shares}",
  withdraw_recorded:
    "協議記錄這筆贖回：{shares} 換回 {assets}，款項不在這筆交易裡到帳",

  tool_discover_title: "這個伺服器可以在 Monad 上模擬的操作（{n}）：",
  tool_discover_native_hint: '（代幣地址，或字面量 "native" 表示原生 MON）',
  tool_discover_receiver_hint: "（可省略，預設為發送帳戶）",
  tool_recent_empty: "這個 session 還沒有預覽過任何交易。",
  tool_recent_agent_said: "agent 說你要求的：{request}",
  tool_recent_effect: "效果：{summary}",
  tool_recent_fingerprint: "指紋：{fp}",
  tool_recent_not_signable: " 不可簽名",
  tool_remember_ok:
    "已記住這個對話的錢包地址 {short}。之後的預覽都會用這個地址模擬（真實餘額與手續費）。只存在這個 session 的記憶體，不會寫入任何地方。",
  tool_remember_stateless:
    "這個部署模式（無狀態 HTTP）不支援跨請求記住地址。請在對話中記住使用者的錢包地址，每筆 preview_transaction 都帶 account 參數。",
  tool_recent_stateless:
    "這個部署模式（無狀態 HTTP）不保存預覽紀錄。這裡所有請求共用一個 process、沒有 session 邊界，留紀錄等於把 A 預覽過什麼給 B 看到。請改成往回翻對話。",
  tool_host_unknown: "（未宣告）",
  tool_host_declared: "宣告的 extensions：{list}",
  tool_host_none_ext: "（沒有宣告任何 extension）",
  tool_host_supports_yes: "是，面板會渲染成畫面",
  tool_host_supports_no: "否，會用文字版面板",
  tool_host_caps: "完整 capabilities：{json}",
  tool_vigil_intro:
    "Vigil — 簽名前檢查。你叫 agent 在 Monad 上做事之前，先用 Vigil 把交易實際會做什麼模擬出來給你看。",
  tool_vigil_trust:
    "信任模型一句話：證據來自 Monad 主網模擬，不是來自準備這筆交易的 agent；你簽名之前，看到的每一項都是鏈上真的會發生的。",
  tool_vigil_cmd_header: "指令對照（說這些話，agent 會對應去呼叫工具）：",
  tool_vigil_cmd_preview: "預覽一筆交易 → preview_transaction",
  tool_vigil_cmd_discover: "看 Monad 上能做什麼操作 → discover",
  tool_vigil_cmd_remember: "記住你的錢包地址（這個對話）→ remember_account",
  tool_vigil_cmd_recent: "回查這個對話預覽過什麼 → recent_previews",
  tool_vigil_first_use:
    "第一次使用：告訴 agent 你的錢包地址（agent 會呼叫 vigil-remember），然後說你想做什麼（例如「幫我質押 0.25 MON 成 shMONAD」），agent 會 discover → 準備交易 → vigil-preview 給你看證據，你確認後在錢包裡簽名。",
  tool_vigil_no_memo: "你不需要記任何指令——直接說你想做什麼，agent 會用這些工具完成。",
  raw_changes_short: "{n} 筆未解讀的變動",
  err_query_no_tx: "{protocol}.{method} 是 Query 不是 Capability，沒有交易可以模擬",
};

const DICTS: Record<Locale, Dict> = { en, "zh-CN": zhCN, "zh-TW": zhTW };

/** 三語系必須有相同 keyset，缺漏是 bug。建立時就驗。 */
function assertKeysetConsistent(): void {
  const keys = Object.keys(en).sort();
  for (const locale of Object.keys(DICTS) as Locale[]) {
    const other = Object.keys(DICTS[locale]).sort();
    const missing = keys.filter((k) => !other.includes(k));
    const extra = other.filter((k) => !keys.includes(k));
    if (missing.length > 0 || extra.length > 0) {
      throw new Error(
        `i18n keyset mismatch for ${locale}: missing=[${missing.join(",")}] extra=[${extra.join(",")}]`,
      );
    }
  }
}
assertKeysetConsistent();

export function t(locale: Locale, key: string, vars?: MessageVars): string {
  // 防護：缺 locale（舊資料/邊界）時退回 en。renderText/render 都吃
  // view.locale，這條守住「某個 view 沒帶 locale」不會讓整個面板掛掉。
  const dict = DICTS[locale] ?? DICTS.en;
  return fmt(dict[key] ?? key, vars);
}

export const LOCALES: readonly Locale[] = ["en", "zh-CN", "zh-TW"] as const;

export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "zh-CN" || value === "zh-TW";
}
