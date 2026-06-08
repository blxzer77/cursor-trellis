# Platform Hook Audit — Sub-agent Injection Reliability

**Date**: 2026-04-17
**Scope**: cursor, gemini, qoder, codebuddy, droid（B 类：Trellis 已配置但可靠性未确认的 5 个平台）
**Method**: 官方文档 + GitHub issues + 官方论坛 + 源码验证

---

## Summary Table

| Platform | Trellis 现有配置 | 官方 subagent hook | 能改 sub-agent prompt? | 判定 |
|---|---|---|---|---|
| **Cursor** | `preToolUse` + matcher `Task` | `subagentStart`（只能 allow/deny） | ✅（2026-04-07 staff 确认修复） | **保持现状** |
| **Gemini CLI** | `BeforeTool` + matcher `^(check\|implement\|research)$` | 无（sub-agent = tool，走 `BeforeTool`） | ⚠️ 机制可行但 #18128 限 context 可见性 | **降级为 Pull-based**（稳定性优先） |
| **Qoder** | `PreToolUse` + matcher `Task` | `SubagentStart/Stop`（无 prompt 字段） | ❌（文档上任何 hook 都不行） | **改为静态注入 / UserPromptSubmit** |
| **CodeBuddy** | `PreToolUse` + matcher `Task` | `SubagentStop` only | ✅（假定可用，基于 Claude Code 实测推断） | **保持现状** |
| **Factory Droid** | `PreToolUse` + matcher `Task` | `SubagentStop` only | ✅（文档明确支持 `updatedInput.prompt`） | **保持现状** |

### 意外发现 + 实测验证：Claude Code hook 注入仍然工作

- [anthropics/claude-code #15897](https://github.com/anthropics/claude-code/issues/15897) — "updatedInput PreToolUse response does not work" for Task tool
- [anthropics/claude-code #40580](https://github.com/anthropics/claude-code/issues/40580) — "PreToolUse hook exit code ignored for subagent tool calls"

**Trellis 的 hook 用的正是 `updatedInput.prompt`**（见 `.claude/hooks/inject-subagent-context.py:790-795`）。理论上受上述 bug 影响。

**✅ 实测结果（2026-04-17，本 audit task 的 sub-task `04-17-cc-hook-inject-test`）**：注入**完全工作**。

- 测试方式：创建带 3 个唯一 canary 的 prd.md + 通过 implement.jsonl 引用的 test-spec.md，spawn `implement` sub-agent，让它在**不调用任何工具**的前提下 quote canary
- sub-agent 准确 quote 了：
  - `PRD_MOON_TURTLE_91F3C2`（来自 prd.md）
  - `SPEC_ZEBRA_COMET_48D7E5` + `RULE_PINEAPPLE_EIGHT`（来自 test-spec.md）
- 4 个 `=== ... ===` 框架块（workflow.md / spec index / test-spec.md / prd.md）全部可见

**结论**：上述两个 issue 要么已静默修复，要么只影响特定场景（Trellis 不踩）。Claude Code 归为 A 类"确认能注入"**成立**，无需调整。

---

## Per-platform Detail

### 1. Cursor

- **官方 subagent hook**：两个 event
  - `subagentStart` — Input: `subagent_id, subagent_type, task, parent_conversation_id, tool_call_id, subagent_model, is_parallel_worker, git_branch`；Output 仅 `{permission: "allow"|"deny", user_message?}`。**不支持修改 `task`/prompt**
  - `subagentStop` — 只能返回 `followup_message`（sub-agent 跑完之后）
- **Trellis 现有配置**：`preToolUse` + matcher `Task` → `inject-subagent-context.py`，返回 `updated_input` 改写 Task 的 prompt
- **实际能改 sub-agent prompt 吗**：✅ **可以**（2026-04-07 staff 确认修复）
- **关键证据**：
  - [Forum bug report (151985)](https://forum.cursor.com/t/pretooluse-hook-updated-input-is-silently-ignored-for-the-task-tool/151985) — Dean Rie (Cursor staff, 2026-02-16): *"updated_input works for other tools, but it doesn't get applied when the Task tool spawns a sub-agent."*
  - 同帖 Mohit (Cursor staff, 2026-04-07): *"the issue has been fixed in a recent update"*
  - [Cursor Hooks docs](https://cursor.com/docs/agent/hooks) — `subagentStart` Output schema 明确只有 `permission` + `user_message`
- **Bug / 限制**：
  - Fix 未标注具体版本号（官方 changelog 2026-02 ~ 2026-04 无相关条目），需用户升级到最新版
  - `subagentStart` 结构上无法改 prompt，只能 allow/deny
- **建议**：**保持 `preToolUse + Task + updated_input`**。切到 `subagentStart` 没用（只能 allow/deny）。在 README 标注 Cursor 最低版本要求（2026-04-07 之后）
- **Cursor 版本**：3.x（最近 changelog Cursor 3.0 / 2026-04-02）；修复版本号未公开

---

### 2. Gemini CLI

- **官方 subagent hook**：
  - Sub-agent 作为**工具**暴露给主 agent（`codebase_investigator`、自定义 agent 同名 tool）。sub-agent 启动走 **`BeforeTool`**，不是 `BeforeAgent`
  - `BeforeTool` input: `{ tool_name, tool_input, mcp_context?, original_request_name? }`；output 支持 `hookSpecificOutput.tool_input`（**合并/覆盖 model 生成的参数**）、`decision: allow|deny|block|ask`、`systemMessage`
  - `BeforeAgent` input: `{ prompt }`；output 只支持 `additionalContext`——只在**主 agent turn 开始**时 fire，不为 sub-agent fire
- **Trellis 现有配置**：`BeforeTool` + matcher `^(check|implement|research)$`（regex 对 tool name 匹配，sub-agent 名 = tool name，能 match 上）
- **实际能改 sub-agent prompt 吗**：⚠️ **机制上可以**（通过 `hookSpecificOutput.tool_input` 覆盖），但 transcript/context 可见性有已知 bug（#18128）未修
- **关键证据**：
  - [docs/core/subagents.md](https://github.com/google-gemini/gemini-cli/blob/main/docs/core/subagents.md) — *"Subagents are exposed to the main agent as a tool of the same name."*
  - [Hooks Reference](https://geminicli.com/docs/hooks/reference/) — BeforeTool output: *"hookSpecificOutput.tool_input: Object merging with/overriding model arguments"*
  - [Issue #18128](https://github.com/google-gemini/gemini-cli/issues/18128) (OPEN, 2026-02-02) — *"the transcript is never updated to contain information about the codebase_investigator sub-agent... sub-agents still cannot access chain-of-thought or content"*
  - [PR #19749](https://github.com/google-gemini/gemini-cli/pull/19749) — "feat: add command context to BeforeAgent hooks" **CLOSED 2026-03-15 未合并**
- **Bug / 限制**：
  - #18128 未修：BeforeTool hook 在 sub-agent 场景下收不到主 agent 的 chain-of-thought/content（可以改 input，但判断依据受限）
  - `BeforeAgent` 不为 sub-agent fire
- **建议**：**降级为 Pull-based**（2026-04-17 决定）。理由：#18128 的 context 可见性限制让 hook 难以稳定推断要注入什么；改用 sub-agent definition 里的 system prompt 指示启动时 Read `.trellis/.current-task` + `prd.md` + jsonl 引用的 spec，跟 Qoder/Codex/Copilot 统一，实现更简单，可靠性更高
- **版本**：main 分支 (2026-04-17)，关键 PR: #17996 merged, #21146 merged 2026-03-21, #19749 closed unmerged

---

### 3. Qoder

- **官方 subagent hook**：`SubagentStart` / `SubagentStop`
  - Input（文档列出字段）：`session_id, cwd, hook_event_name, agent_id, agent_type`。**无 `prompt`、无 `parent_id`、无 `tool_input`**
  - Output：文档**未定义**任何 SubagentStart 专属输出字段。只有 `UserPromptSubmit` 和 `SessionStart` 被列为"支持 plain-text context injection"的事件
- **Trellis 现有配置**：`PreToolUse` + matcher `Task` → `inject-subagent-context.py`
- **实际能改 sub-agent prompt 吗**：❌ **文档证据上都不行**
  - **PreToolUse 路径**：Qoder 的 PreToolUse matcher 示例只列 `Bash|Write|Edit|Read|Glob|Grep|mcp__.*`，**未列 Task**；而且 Qoder sub-agent **不通过 Task tool 触发**，是通过 `/agents` 面板 + 自然语言委派。PreToolUse output 只支持 exit 2 阻断，无 `updated_input` 字段
  - **SubagentStart 路径**：input 无 prompt，output 无 `additionalContext` —— 能感知 sub-agent 启动，但无法注入内容
- **关键证据**：
  - [Hooks — SubagentStart](https://docs.qoder.com/cli/hooks.md) — *"matcher field: Agent type name. Additional input fields: { agent_id, agent_type }"*（无其他字段）
  - [Hooks — Output](https://docs.qoder.com/cli/hooks.md) — *"some events (such as UserPromptSubmit, SessionStart) support plain-text context injection or fine-grained JSON control"*（SubagentStart 未被列入）
  - [Hooks — PreToolUse](https://docs.qoder.com/cli/hooks.md) — matcher 示例无 Task；*"Blocking tool execution: exit code 2"*（只能阻断）
  - [Subagent docs](https://docs.qoder.com/en/cli/user-guide/subagent.md) — sub-agent 通过 `/agents` + 自然语言触发，**未提及 Task 工具**
- **Bug / 限制**：
  - Qoder 没有公开的"创建 sub-agent 的 tool"名，Trellis 的 `matcher: "Task"` 在 Qoder 上**很可能根本不 fire**
  - 官方无公开 issue 仓，无法源码验证
- **建议**：**在 Qoder 上放弃 hook-based sub-agent prompt 注入**。Trellis 当前 `PreToolUse + Task` 在 Qoder 上**无文档依据**，应在 Qoder 配置中移除或替换。三条路径评估：

  | 方案 | 可行性 | 原因 |
  |---|---|---|
  | A. `UserPromptSubmit` 的 `additionalContext` 直达 sub-agent | ❌ | Qoder sub-agent 明文 "Context Isolation, independent context window"，additionalContext 只进主 agent context |
  | B. 主 agent 当"传话筒"转述给 sub-agent | ⚠️ | 依赖主 agent 把注入内容总结进 delegation 描述，可能摘要/遗漏/忽略 spec 细节，不稳定 |
  | C. **sub-agent definition 里让它启动时 Read 文件**（Pull-based dynamic）| ✅ | sub-agent 有 `Read/Grep/Glob` 工具（默认 `*`），在 `.qoder/agents/<name>.md` 的 system prompt 里写 "Before starting: read `.trellis/.current-task`, then its `prd.md` + spec files in `implement.jsonl`/`check.jsonl`" — 每次启动拉到最新内容 |

  **C 为什么算"动态"**：内容是动态的（`prd.md` / `jsonl` 随 task 阶段变），行为是静态的（pull 规则固化在 agent definition 里）。Trellis 的 `implement.jsonl` / `check.jsonl` 本来就是为这种 pull 场景设计的。
- **关键证据**（动态方案确认）：
  - [Subagent docs](https://docs.qoder.com/en/cli/user-guide/subagent.md) — *"Context Isolation: Each Subagent runs in an independent context, preventing pollution of the main conversation"*
  - 同页 — *"Each subagent has its own context window, system prompt, and tool permissions"*
  - 同页 tools 字段 — *"When omitted, inherits all tools from the main Agent. Default is `*`"* → Read/Grep/Glob 默认可用
- **版本**：`docs.qoder.com/cli/hooks.md`（Mintlify 托管，2026-04-17 最新版，无版本号）

---

### 4. CodeBuddy

- **官方 subagent hook**：`PreToolUse, PostToolUse, UserPromptSubmit, Notification, Stop, SubagentStop, PreCompact, SessionStart, SessionEnd`（9 个，与 Claude Code 完全一致，**无 `SubagentStart`**）
  - PreToolUse output 支持 `hookSpecificOutput.permissionDecision` (allow/deny/ask) 和 `modifiedInput: { field: "new value" }`（partial field override）
  - Matcher 列表含 *"Task – Sub-agent tasks"*
- **Trellis 现有配置**：`PreToolUse` + matcher `Task` → `inject-subagent-context.py`
- **实际能改 sub-agent prompt 吗**：✅ **假定可用**。CodeBuddy 是 Claude Code 协议深度派生，Claude Code 自己实测注入工作（2026-04-17，见顶部 Summary），CodeBuddy 大概率同机制同行为
- **关键证据**：
  - [CodeBuddy Hooks](https://www.codebuddy.ai/docs/cli/hooks) — *"modifiedInput – Mutate tool arguments before execution (partial field override)"*；matcher 含 *"Task – Sub-agent tasks"*
  - [CodeBuddy Sub-Agents](https://www.codebuddy.ai/docs/cli/sub-agents) — Task tool input: `{ description, prompt, subagent_type, resume, run_in_background }`
  - [claude-code #15897](https://github.com/anthropics/claude-code/issues/15897) — "updatedInput PreToolUse response does not work" for Task tool
  - [claude-code #40580](https://github.com/anthropics/claude-code/issues/40580) — "PreToolUse hook exit code ignored for subagent tool calls"
  - [Cursor forum 151985](https://forum.cursor.com/t/pretooluse-hook-updated-input-is-silently-ignored-for-the-task-tool/151985) — 同类 bug（Cursor 2026-04-07 修复；CodeBuddy/Claude Code 未见修复声明）
- **Bug / 限制**：
  - 无 SubagentStart
  - `modifiedInput` 对 `Task.tool_input.prompt` 被静默丢弃（继承 Claude Code bug）
  - PreToolUse 的 block/exit-code 在 subagent 调用路径也被观察到忽略
  - CodeBuddy release notes 到 v2.83.x 未提此修复
- **架构溯源**：CodeBuddy 是 Claude Code 协议的深度派生——hook 事件命名、input/output schema、matcher 语法、`SubagentStop` 命名、`tool_input.{description, prompt, subagent_type, resume}` 字段全部一一对应。官方文档亦自述 *"full support for all nine Claude Code hook events"*。基本继承了 Claude Code 当前所有 Task hook 相关 bug
- **建议**：**标为"不可靠 + 需实测"**。具体动作：
  - (1) 实测：hook 里注入哨兵字符串，sub-agent 里检查能否看到
  - (2) 若确认失效：改用 subagent 定义文件内置上下文 / `SessionStart` 写公共 context 文件
- **版本**：v2.83.x（最新可见 v2.83.0、v2.82.0）

---

### 5. Factory Droid

- **Droid 有 sub-agent spawn 工具吗**：是，工具名为 `Task`（spawn custom droid / sub-droid），input schema 含 `subagent_type, description, prompt`
- **官方 subagent hook**：`SubagentStop`（sub-droid 完成时 fire，无法在启动前注入）；**无 SubagentStart**；启动阶段靠 `PreToolUse` + matcher `Task` 拦截
- **Trellis 现有配置**：`PreToolUse` + matcher `Task` → `inject-subagent-context.py`
- **实际能改 sub-agent prompt 吗**：✅ **文档明确支持**。`Task` 是 PreToolUse 合法 matcher，hook 可返回 `updatedInput.prompt` 修改 sub-droid 初始指令
- **关键证据**：
  - [Hooks reference](https://docs.factory.ai/cli/configuration/hooks-reference) — *"Task - Sub-droid tasks (see subagents documentation)"* 列在 PreToolUse Common matchers
  - 同页 — *"updatedInput allows you to modify the tool's input parameters before the tool executes. This is a `Record<string, unknown>` object"*，返回 JSON: `{ "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "allow", "updatedInput": { "field_to_modify": "new value" } } }`
  - [Custom Droids](https://docs.factory.ai/cli/configuration/custom-droids) — `Task({ subagent_type, description, prompt })`
  - [Hooks reference](https://docs.factory.ai/cli/configuration/hooks-reference) — SubagentStop: *"Runs when a sub-droid (Task tool call) has finished responding"* → sub-droid = Task tool call
- **Bug / 限制**：
  - 文档未给针对 Task 的 `updatedInput` 具体示例（只示范 Create/Edit/Read），但 schema 为通用 `Record<string, unknown>`
  - 无 SubagentStart，只能靠 PreToolUse
  - hooks-cookbooks URL 已 404
- **建议**：**保持现状**。matcher `Task` 与 Claude Code 同名同语义，Trellis 脚本若兼容 Claude Code 的 `hookSpecificOutput.updatedInput` 结构即可（大概率兼容）
- **版本**：最近 changelog 到 Release 1.10

---

## Recommendations for Trellis

### 优先级 P0（破坏性，需立即处理）

| 平台 | 问题 | 动作 |
|---|---|---|
| **Qoder** | `PreToolUse + Task` 在 Qoder 上无文档依据，很可能 hook 根本不 fire；UserPromptSubmit 因 Context Isolation 也到不了 sub-agent | 改 configurator：Qoder 上不再安装 `inject-subagent-context.py` hook。改为 **Pull-based**：在 `.qoder/agents/<name>.md` 的 system prompt 里指示 sub-agent 启动时 Read `.trellis/.current-task` → `prd.md` + `implement.jsonl` 引用的 spec。CodeBuddy 若实测失效可套用同方案 |

### 优先级 P1（已验证/假定可用，保持现状）

| 平台 | 状态 | 动作 |
|---|---|---|
| **Claude Code** | ✅ 实测通过（2026-04-17，3 canary + 4 frame 全部正确） | 无动作 |
| **CodeBuddy** | ✅ 假定可用（同源 Claude Code，推断工作） | 无动作；用户反馈失效再实测 |
| **Cursor** | ✅ 2026-04-07 staff 确认修复 | 无动作；README 标注最低版本（2026-04-07 之后） |
| **Factory Droid** | ✅ 文档明确支持 | 无动作 |
| **Kiro** | ✅ per-agent `agentSpawn` hook | 无动作 |
| **OpenCode** | ✅ JS plugin `tool.execute.before` | 无动作 |

### Registry 字段修正建议

当前 `src/types/ai-tools.ts` 里 `templateContext.hasHooks` 字段语义混乱（codex 标 false 但有 session-start.py；opencode 标 false 但有 plugin）。基于本次 audit 建议：

1. **拆分字段语义**：区分 `hasSessionStart`（是否有 session 启动注入机制）和 `subagentInjection`（sub-agent prompt 注入是否可靠）
2. **`subagentInjection` 的枚举值**：
   - `"hook-inject"` — claude-code (✅ 实测), codebuddy (同源推断), cursor (2026-04-07 修复), droid, kiro (agentSpawn), opencode (plugin 同效)
   - `"pull-based"` — gemini-cli (#18128 降级), qoder, codex, copilot (hook 机制不支持/失效)
   - `"none"` — kilo, antigravity, windsurf (没有 sub-agent 概念)

### 后续独立任务

- ~~实测 Claude Code 的 Task tool 注入~~ ✅ **已完成 2026-04-17**，注入工作正常
- **实测 CodeBuddy**：继承 bug 理论在，但不排除腾讯自己修了（Claude Code 都能工作，CodeBuddy 大概率也能）
- **Qoder 切换到 Pull-based sub-agent definition**：设计 `.qoder/agents/<name>.md` 的 system prompt 模板 + configurator 调整 + 测试
- **Pull-based 方案可作为所有 hook-unreliable 平台的通用 fallback**：Qoder（确认）、CodeBuddy（若实测失效）
