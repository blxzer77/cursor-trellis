# Probe Findings (real CLI traces)

Captured 2026-05-12 against:
- `claude` 2.1.139 (Claude Code)
- `codex` 0.130.0 (codex-cli)

## Claude `--input-format stream-json --output-format stream-json`

Run: see [`probes/claude-probe.mjs`](probes/claude-probe.mjs)
Trace: [`probes/claude/hello.jsonl`](probes/claude/hello.jsonl), [`probes/claude/hello-no-hooks.jsonl`](probes/claude/hello-no-hooks.jsonl)

### Event types observed (12 lines for trivial prompt)

| `type` | `subtype` | 含义 | adapter 处理 |
|---|---|---|---|
| `system` | `hook_started` | 注册的某个 SessionStart hook 开始 | **忽略**（meta，不广播） |
| `system` | `hook_response` | 同上完成；`output` / `stdout` 字段含 hook 返回内容 | **忽略** |
| `system` | `init` | 会话初始化；含 `cwd`、`session_id` | **持久化 session_id**；不广播 |
| `assistant` | — | message.content[] 内嵌 `text` / `tool_use` / `thinking` 块 | text → `message`；tool_use → `progress`；thinking → 忽略 |
| `rate_limit_event` | — | 用量 / 配额信息 | **忽略**（不参与事件流） |
| `result` | `success` / `error` | 整个 turn 完成；`session_id` / `result` / `usage` / `total_cost_usd` | → `done` 或 `error` |

### 关键设计判断

1. **`system.hook_started` / `hook_response` 在 stream-json 默认就有**——不需要 `--include-hook-events`。它们包含 hook 运行过程，会让事件流变嘈杂；adapter 必须 silently skip。
2. **`rate_limit_event`**：在 wire 协议里独立一类事件；当前忽略。
3. **`session_id`** 在 `system.init` / `rate_limit_event` / `result` 三处都有；持久化时认 `system.init` 最早出现。

### `TRELLIS_HOOKS=0` 行为确认（无 bug）

- 所有 Trellis 自有 hook 早 return（`output`/`stdout` 字段为空字符串）
- 但 `hook_started` / `hook_response` 事件**本身**仍然出现在 stream-json——这是 Claude Code 内核行为，和 hook 内容无关
- 第三方 hook（如 `claude-code-warp` 插件、`treland-bridge` 全局 hook）不认 `TRELLIS_HOOKS` 这个变量，仍可能 emit 自己的 `systemMessage`——这不是 Trellis 的问题，是 host 环境的真实情况
- **适配 implication**：channel adapter 必须假定 worker session 启动时**仍然有 hook 噪声**——所有 `system.hook_*` 事件一律 silently skip。仅 `TRELLIS_HOOKS=0` 不够清场。

## Codex `app-server`

Run: see [`probes/codex-probe.mjs`](probes/codex-probe.mjs)
Trace: [`probes/codex/hello.jsonl`](probes/codex/hello.jsonl) （36 行）
Schema (full JSON Schema): [`codex-schema/`](codex-schema/) (生成自 `codex app-server generate-json-schema`)

### Protocol shape (v2)

JSON-RPC 2.0，**method 名用 `/` 分隔**（不是 `.`），一行一帧（line-delimited JSON over stdin/stdout）。

**请求 / 响应（channel runtime 主动发）**：

| Method | Params 关键字段 | Result 关键字段 |
|---|---|---|
| `initialize` | `clientInfo`、`capabilities` | `userAgent`、`codexHome`、`platformOs` |
| `thread/start` | `cwd` / `model` / `sandbox` / 等 | `thread.id`（**嵌套在 `thread` 对象里**）、`thread.sessionId`、`thread.path` |
| `turn/start` | `threadId`、`input: UserInput[]`（`{type:"text",text}` 或 `{type:"image",url}`） | `turn.id`、`turn.status="inProgress"` |
| `thread/resume` | `threadId` | 同 `thread/start` |
| `turn/interrupt` | `threadId`（待验证） | — |

**通知（codex 主动推）**——36 行 hello probe 的分布：

| Method | 数量 | 含义 | adapter 处理 |
|---|---|---|---|
| `remoteControl/status/changed` | 1 | startup 之初 | 忽略 |
| `thread/started` | 1 | thread/start 确认 | 记 session_id（其实 thread/start 的 result 已经有）|
| `mcpServer/startupStatus/updated` | 16 | MCP server 启动状态（用户配了 8 个 MCP server） | 忽略 |
| `thread/status/changed` | 2 | idle ↔ active | 忽略 |
| `turn/started` | 1 | 一轮开始 | 忽略 |
| `warning` | 1 | 警告（待样本验证内容） | log + 忽略广播 |
| `item/started` | 3 | 一个新 item 开始（user/reasoning/agentMessage 各一） | 见下 |
| `item/completed` | 3 | item 完成 | 见下 |
| `item/agentMessage/delta` | 1+ | agent message 流式 token | → `progress` (text_delta) |
| `account/rateLimits/updated` | 2 | 用量 | 忽略 |
| `thread/tokenUsage/updated` | 1 | token 计费 | 忽略 |
| `turn/completed` | 1 | turn 结束 | → **`done`** |

### Item types observed

`params.item.type` 取值（每个 item 走 started → optional delta → completed）：

从 `ItemCompletedNotification.json` 的 `ThreadItem` oneOf 拿到的**全部 17 种** item type：

| `item.type` | 关键字段 | 实测? | adapter 处理 |
|---|---|---|---|
| `userMessage` | `content` | ✅ | 忽略（自己输入回显） |
| `agentMessage` | `text`, `phase`, `memoryCitation` | ✅ | `item/completed` → channel **`message`**（一 turn 多个 item 各发一条）|
| `reasoning` | `summary`, `content` | ✅ | 忽略（verbose mode 下可广播） |
| `commandExecution` | `command`, `exitCode`, `aggregatedOutput`, `cwd`, `status` | ✅ | `item/started` → `progress(tool=shell, cmd=command)`；completed 时如失败可 `error` |
| `mcpToolCall` ⭐ | `server`, `tool`, `arguments`, `result`, `error`, `status` | ⏳ | `item/started` → `progress(kind=mcp, server, tool, args_summary)` |
| `dynamicToolCall` | `namespace`, `tool`, `arguments`, `contentItems` | ⏳ | 同 mcpToolCall 风格 |
| `webSearch` | `query`, `action` | ⏳ | `progress(kind=web_search, query)` |
| `fileChange` | `changes`, `status` | ⏳ | `progress(kind=file_change, summary)` |
| `imageView` / `imageGeneration` | path / result | ⏳ | `progress(kind=image_*)` |
| `plan` | `text` | ⏳ | 可选广播为 `say(phase=plan)` 或忽略 |
| `hookPrompt` | `fragments` | ⏳ | 忽略（host hook 注入） |
| `enteredReviewMode` / `exitedReviewMode` | `review` | ⏳ | 忽略 |
| `contextCompaction` | — | ⏳ | log + 忽略 |
| **`collabAgentToolCall`** ⚠️ | `senderThreadId`, `receiverThreadIds`, `prompt`, `model` | ⏳ | **危险**：codex 原生 multi-agent；这正是我们想关掉的。MVP 看到此 item 要 `error`，并在 `thread/start` 时配 `-c features.multi_agent=false -c features.multi_agent_v2.enabled=false` 主动关闭 |

⭐ 实测剩余 item 类型还没 probe，但 schema 已给出完整字段，**adapter 可以直接按 schema 写**——遇到新 type 默认走 `progress(kind=<type>, ...)` 透传字段名，不会崩。

### MCP 相关 notification（除 item 外的辅助流）

| Method | 含义 | adapter |
|---|---|---|
| `mcpServer/startupStatus/updated` | MCP server 启动状态 | 忽略 |
| `mcpServer/oauth/loginCompleted` | OAuth 完成 | 忽略 |
| **`mcp/toolCall/progress`** | **MCP 工具调用中间进度**（`itemId`, `message`） | 关联到对应 `mcpToolCall` item → channel `progress(text_delta=message)` |
| `account/rateLimits/updated` | 额度 | 忽略 |
| `thread/tokenUsage/updated` | token 用量 | 忽略 |

list-files probe trace 表明 **一个 codex turn 可以有多个 agentMessage item**——line 31 先 `item/completed agentMessage text='先按你的要求执行 ls...'`，line 34 `item/started commandExecution cmd='/bin/zsh -lc ls -1 | wc -l'`，line 40 最终 `agentMessage text='当前目录中有 4 个可见条目'`。这和 Claude 不同（Claude 一条 assistant message 可以含多个 content block 但只发一次）。

**Adapter implication**：每个 `item/completed{type:agentMessage}` 都发一条独立的 channel `message` 事件，不要聚合。

### Codex app-server 0.130 协议变更（vs 旧版本）

1. **方法名变了**：
   - 旧版本：`thread/new`、`thread/sendMessage`
   - 新（0.130）：`thread/start`、`turn/start`
2. **threadId 路径变了**：旧返回 `{threadId: "..."}`，新返回 `{thread: {id: "...", sessionId: "..."}}`
3. **输入结构**：新协议要求 `input: UserInput[]`（数组 + 每项带 type），不是单个字符串
4. **MCP server 启动很吵**：用户配了 N 个 MCP server 就有 N 行 `mcpServer/startupStatus/updated`——adapter 必须 skip
5. **`item/*` 是核心事件层**：用户消息 / 模型思考 / 模型回复 / 工具调用都包成 `item`，通过 `item.type` 区分；这是新协议的核心抽象，比"agent_message_delta + tool_call"那套老 schema 更统一

## Adapter 设计回路（基于真实 probe）

### Claude
1. **明确 skip 列表**：所有 `system.hook_*`、`rate_limit_event` 不翻译成 channel 事件
2. **assistant 块按 type 分流**（list-files probe 实测）：
   - `text` → channel `message`
   - `tool_use{name, id, input}` → channel `progress`（input_summary 截短）
   - `thinking` → ignore (或 verbose mode 下广播)
3. **`user.content[].tool_result`** → silently skip（噪声大）
4. **session_id 持久化时机**：见 `system.init`（最早可用），写 `<worker>.session-id`
5. **`result` 行**：→ `done` 或 `error`，含 `total_cost_usd` / `duration_ms` 可记入 detail

### Codex
1. **明确 skip 列表**：`remoteControl/*`、`mcpServer/*`、`account/rateLimits/*`、`thread/tokenUsage/*`、`thread/status/*`、`thread/started`、`turn/started`
2. **`item/completed` 是主分流点**：按 `params.item.type` 分流：
   - `userMessage` → 忽略
   - `reasoning` → 忽略（或 verbose 下广播）
   - `agentMessage` → channel `message`（text 在 `params.item.text`）
   - `commandExecution` / `fileChange` / 等（未验证）→ channel `progress`
3. **`item/agentMessage/delta`** → channel `progress` (text_delta)，可选地节流（每 N ms / N chars 广播一次，避免炸 events.jsonl）
4. **`turn/completed`** → channel `done`
5. **threadId 持久化**：`thread/start` result 拿 `result.thread.id`，写 `<worker>.thread-id`
6. **`warning`** 通知：记 log，可选广播为 `error{level:"warn"}`

## 磁盘 session 历史扫描结果 (~/.codex/sessions/, 739 files, ~535k 行)

**注意**：磁盘 jsonl format ≠ app-server wire protocol。磁盘是 codex 内部表示，wire 是封装后的对外协议。grid adapter 关心 wire，但磁盘扫描能补全 wire probe 缺失的 type。

### Disk payload type distribution（前 20）

```
function_call          81006
function_call_output   80915
token_count            65098
reasoning              46829
message                34205
agent_message          24364
exec_command_end       18909
turn_context           12461
custom_tool_call        7668   (only ever name='apply_patch')
custom_tool_call_output 7668
agent_reasoning         7288
user_message            5532
task_started            4860
task_complete           4411
web_search_call         3337
patch_apply_end         3130
mcp_tool_call_end       1171   ⭐ MCP 真实存在
session_meta             848
web_search_end           643
compacted/context_comp.  462+462
turn_aborted             344   ⭐ 中断也是事件
collab_*_end       (426+ 跨多 sub-type)   ⚠️ codex 原生 sub-agent
ghost_snapshot           153   ❓ 未文档化
view_image_tool_call      54
tool_search_call          76
entered/exited_review     74+64
thread_rolled_back         2
error                      6
```

### Tool name distribution（function_call.name top 20，跨全部历史）

```
exec_command                                   67020
apply_patch  (custom_tool_call)                 7668
write_stdin                                     5703
shell_command                                   1473
mcp__gitnexus__impact                           1259   ⭐ MCP
spawn_agent                                      881   ⚠️ 原生 collab
wait_agent                                       641   ⚠️
update_plan                                      535
mcp__codex_apps__exa_get_code_context_exa        434   ⭐ MCP
mcp__gitnexus__context                           411   ⭐ MCP
mcp__gitnexus__detect_changes                    390   ⭐ MCP
mcp__gitnexus__query                             367   ⭐ MCP
close_agent                                      322   ⚠️
mcp__exa__web_search_exa                         171   ⭐ MCP
mcp__ref__ref_read_url                           117   ⭐ MCP
mcp__ref__ref_search_documentation               115   ⭐ MCP
mcp__exa__get_code_context_exa                   101   ⭐ MCP
mcp__codex_apps__github_search                    76   ⭐ MCP
list_agents                                       75   ⚠️
view_image                                        73
send_input                                        59   ⚠️
```

### MCP 处理结论

MCP 工具在 codex 磁盘 format 里就是 `function_call` with `name = "mcp__<server>__<tool>"`——和 Claude 的命名前缀**完全一致**。

**adapter 规则**：
- Claude: `assistant.tool_use{name: "mcp__..."}` → channel `progress(tool=name, kind=mcp, server=name.split("__")[1], tool_name=name.split("__")[2])`
- Codex wire: `item.type=mcpToolCall{server, tool}` 已经预解构 → channel `progress(kind=mcp, server, tool)`
- 兜底：任何 `name.startsWith("mcp__")` 的 function_call / dynamicToolCall 也按 MCP 处理（防御）

### MCP 真实 wire 流程（probe 实测 [`codex/mcp-call.jsonl`](probes/codex/mcp-call.jsonl)）

每个 MCP 工具调用走 5 步：

```
1. item/started        type=mcpToolCall server=abcoder tool=list_repos status=inProgress
                       arguments={} result=null error=null durationMs=null
2. mcpServer/elicitation/request   ⭐ server-to-client REQUEST (method + id 都有)
                       params: {threadId, turnId, serverName, mode="form",
                                _meta.codex_approval_kind="mcp_tool_call",
                                _meta.tool_description, message, requestedSchema}
3. client → server     {jsonrpc:"2.0", id:<same>, result:{action:"accept", content:{}}}
4. notification        serverRequest/resolved   (确认我们 reply 被收到)
5. item/completed      type=mcpToolCall status=completed
                       result.content=[{type:"text", text:"<MCP server output>"}]
                       durationMs=956
```

### 关键新发现：wire 协议是双向 JSON-RPC

我的第一版 probe 假定"有 `method` 字段 = notification"，**错**。codex 也会向 client 发 **request**（有 `method` AND `id`）。区分规则：

| inbound msg | shape | 处理 |
|---|---|---|
| Response to our request | `id` 匹配 pending，无 `method` | resolve pending promise |
| Server-to-client request | `method` 和 `id` 都有 | 必须用 same `id` 回 `{jsonrpc, id, result}` |
| Notification | `method` 有，无 `id` | 解析 + 翻译成 channel 事件 |

### MCP elicitation 处理策略（MVP）

MVP channel runtime spawn worker 时，elicitation 一律自动 `accept` with empty content。两条等价路径：

1. **Config level**（推荐）：`thread/start` 时设 `approvalPolicy: { granular: { mcp_elicitations: true, rules: [...], sandbox_approval: ... } }`——让 codex 内核绕过 elicitation
2. **Adapter level**：carry the server-request loop，handle `mcpServer/elicitation/request` 自动回 accept（已实测可行，见 codex-probe.mjs `handleServerRequest`）

实现简单度看，第 2 条更稳（不依赖 granular policy 字段全填对），MVP 走这条。

### Codex 原生 collab 工具 = 必须拦住

`spawn_agent` (881)、`wait_agent` (641)、`close_agent` (322)、`list_agents` (75)、`send_input` (59) + `collab_*_end` 事件系列——这是 codex 的内置多 agent 机制，**和 channel 协作层在同一职能层**，必须关闭以避免：
1. recursion / 死锁（issue #234 #237 等的根因）
2. 状态分裂（grid 不知道 codex 自己又派了 agent）

**关闭路径**：channel `thread/start` 调用必须带：

```
config: {
  features: {
    multi_agent: false,
    multi_agent_v2: { enabled: false }
  }
}
```

或 `-c features.multi_agent=false -c features.multi_agent_v2.enabled=false` CLI flag。**adapter 还要做 defense-in-depth**：检测到 `item.type=collabAgentToolCall` 或 disk 形式 `spawn_agent` function_call → 直接 channel `error(reason=collab_recursion_blocked)` + 杀 worker。

### 其他未文档化事件

| Disk type | 计数 | adapter 处理 |
|---|---|---|
| `ghost_snapshot` | 153 | 未知，**透传到 raw events.jsonl，不广播** |
| `thread_rolled_back` | 2 | log + channel `error(reason=rolled_back)` |
| `entered_review_mode` / `exited_review_mode` | 138 | 忽略（review 模式不影响 channel worker） |
| `tool_search_call` / `tool_search_output` | 152 | `progress(kind=tool_search)` |
| `view_image_tool_call` | 54 | `progress(kind=image_view, path)` |
| `turn_aborted` | 344 | channel `error(reason=aborted)` |
| `task_started` / `task_complete` | 4860/4411 | disk-level turn wrapper；wire 用 `turn/started` `turn/completed` 替代 |

## 复杂度对比

| 维度 | Claude stream-json | Codex app-server |
|---|---|---|
| Framing | 一行一 JSON | 一行一 JSON-RPC 2.0 帧 |
| 请求 → 应答 | 单向写 stdin（无 id） | 必须维护 pending(id)→resolver map |
| Notification 种类 | ~5-6 种 type/subtype | ~13+ 种 method（含 mcpServer 等噪声） |
| 流式 text | `assistant.message.content[].text` 累积块 | `item/agentMessage/delta` + 最终 `item/completed` 含完整 text |
| Session 标识 | `session_id`（UUID） | `thread.id` + `thread.sessionId`（同一 UUIDv7） |
| Resume | `--resume <session-id>` CLI flag | `thread/resume` RPC method |
| Tool call 表达 | `assistant.content[].tool_use` 块 | `item.type=commandExecution`（待验证） |
| 噪声等级 | 中（4 个 hook events 总在） | **高**（用户 N 个 MCP 就 N 行噪声 + 多种状态通知）|

实现复杂度 codex > claude，预估 codex adapter ~600 行 TS（含 RPC client），claude ~400 行。

## Claude `control_request:interrupt` — SDK 暴露但不可靠

逆向 claude SDK 二进制（`@anthropic-ai/claude-agent-sdk/cli.js`）发现 client→server control_request 支持多个 subtype：

```
initialize / interrupt / set_permission_mode / set_model /
set_max_thinking_tokens / mcp_message / mcp_status / rewind_code
```

`interrupt` 对应代码路径 `subtype==="interrupt"){if(D)D.abort();u(y)`——SDK 调用 `AbortController.abort()`。

**实测两组 probe（[`probes/claude/interrupt.jsonl`](probes/claude/interrupt.jsonl)、[`interrupt2.jsonl`](probes/claude/interrupt2.jsonl)）显示**：
- ✅ 写入 `{type:"control_request", subtype:"interrupt"}` 后，Claude 返回 `control_response.subtype=success`
- ❌ **但不实际抢占文本生成**：1-100 计数 prompt 完整跑完（291 字符）；2000-word essay 完整跑完（12884 字符）。turn 1 跑完后才把后续 user message 作为 turn 2 处理。

推测 `D.abort()` 只 abort 工具调用 / partial-messages 流，不抢占主 LLM 响应生成；这是 SDK 当前一处已知限制，不依赖即可。

**Adapter 决策**：
- `say --kind interrupt` 时仍写 control_request（成本低、对短任务可能有效、未来 SDK 修复可直接生效）
- **不依赖**它抢占行为——同时把新 user message 写入 stdin 作为后续 turn
- 文档明确说明：Claude 上的 "cooperative interrupt" 实际语义是"当前 turn 完成后立即开新 turn"
- 用户需要"硬抢占"必须用 `channel kill`

## Adapter 安全清单（基于真实历史）

1. **关闭 codex 原生 collab**：`thread/start` 必须 pass `-c features.multi_agent=false -c features.multi_agent_v2.enabled=false`，并在 adapter 内 defensively reject 任何看到的 `spawn_agent` / `wait_agent` / `close_agent` function call。
2. **MCP 工具按 prefix 识别**：Claude 和 Codex 都用 `mcp__<server>__<tool>` 命名约定，adapter 统一处理。
3. **`turn_aborted` / `error` 不要静默**：转 channel `error` 事件并 done。
4. **未知 item / disk type 透传到 raw**：events.jsonl 始终写完整原始数据，grid 语义层只关心 say/progress/done/error，其余不广播但保留 forensic。
5. **`compacted` / `context_compacted`**：会改变 session 上下文；session_id 不变但模型可见历史变了，grid 不需要特殊处理，只记 log。

## Adapter 设计回路

基于上述，adapter 实现要点：
1. **明确 skip 列表**：所有 `system.hook_*`、`rate_limit_event` 不翻译成 channel 事件
2. **assistant 块按 type 分流**：text → say；tool_use → progress；thinking → ignore (或 verbose mode 下广播)
3. **session_id 持久化时机**：见 `system.init`（最早可用），写 `<worker>.session-id`
4. **Probe-driven schema**：每次发现新 type / subtype 都补这张表
