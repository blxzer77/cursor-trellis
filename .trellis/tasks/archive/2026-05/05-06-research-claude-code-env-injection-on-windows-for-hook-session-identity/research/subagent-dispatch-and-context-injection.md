# Research: Sub-agent dispatch and context injection across platforms

- **Query**: 弄清 Trellis class-1 push-hook sub-agent context 注入在 Windows 上是否同样脆弱；评估 pull-prelude 扩到 class-1 作为 fallback 的可行性
- **Scope**: mixed (Anthropic / Cursor 官方文档 + claude-code GitHub issues + Trellis 仓库本地代码)
- **Date**: 2026-05-06
- **Active task**: `.trellis/tasks/05-06-research-claude-code-env-injection-on-windows-for-hook-session-identity`
- **互补对象**: 同目录下 `claude-code-windows-env-injection.md`（main session env 注入）

---

## 一句话结论（给主 agent）

**class-1 push-hook 的 sub-agent context 注入在 Windows 上和 main-session env 注入是**两条独立失败链**——但根因同源：Windows hook stdin/PTY 缺陷（issue #36156, #25981, #53254）。**Anthropic 自己 2026-04 仍在 v2.1.119 上 repro PreToolUse 不触发的 bug。Trellis 当前所有 class-1 平台（claude / cursor / codebuddy / droid / kiro）的 sub-agent 启动**默认信任 hook 一定触发**——hook 失败时 sub-agent 收到的就是 main agent dispatch prompt 原文，没有任何 fallback。

**强烈推荐**：把 `injectPullBasedPreludeMarkdown` 也应用到 class-1 sub-agent 定义文件，作为 hook-failure 的 belt-and-suspenders fallback。`buildPullBasedPrelude()` 当前文本已经天然兼容"hook 注入了就忽略 prelude"——只要 hook 注入的 prompt 里没有 `Active task:` 这条 anchor，sub-agent 就走 prelude 自救路径。开销是每个 class-1 sub-agent 定义 +~25 行 markdown，没有破坏面，没有新代码路径。

---

## Q1 — Claude Code 的 sub-agent dispatch 机制

### 1.1 Sub-agent spawn 的入口

Claude Code 用两种工具 spawn sub-agent（来自 https://code.claude.com/docs/en/tools-reference）：

| Tool | 用途 |
|---|---|
| `Agent` | 主入口；spawn 一个带独立 context window 的 sub-agent |
| `Task` | 历史名（Task 工具同时还做 task list 管理）；很多 fork（CodeBuddy / Droid / Cursor）保留这个名字作为 sub-agent matcher |

Trellis class-1 hook 配置同时 match 这两个 matcher（见 `templates/claude/settings.json:38-58`，PreToolUse 同时绑定 `Task` 和 `Agent`）。

### 1.2 Sub-agent 是独立 session

Hooks reference 明确写道：

> `agent_id` and `agent_type` are populated when the hook fires inside a subagent. ... Subagent identifier. Present only when the hook fires from within a subagent. Use this field to distinguish subagent calls from main-thread calls.

含义：sub-agent 有自己的 conversation / context window，不继承 main agent 的 in-memory state。Hook 触发时如果落在 sub-agent 内部，`agent_id` 字段非空。

> All hook events are supported. For subagents, `Stop` hooks are automatically converted to `SubagentStop` since that is the event that fires when a subagent completes.

### 1.3 完整 hook event list（2026-05 docs.anthropic.com / code.claude.com）

按发生频次分三类：

**Per-session：**
- `SessionStart` / `SessionEnd`
- `Setup` (--init-only / --init / --maintenance)

**Per-turn：**
- `UserPromptSubmit` / `UserPromptExpansion`
- `Stop` / `StopFailure`

**Per-tool-call：**
- `PreToolUse` / `PostToolUse` / `PostToolUseFailure` / `PostToolBatch`
- `PermissionRequest` / `PermissionDenied`

**Sub-agent / agent team specific：**
- **`SubagentStart`** — sub-agent spawn 时触发。matcher 按 `agent_type` 匹配（`general-purpose`, `Explore`, `Plan`, `code-reviewer`, 或 custom agent 名）
- **`SubagentStop`** — sub-agent 完成时触发。Stop 在 sub-agent 内部自动 mapped 为 SubagentStop
- `TaskCreated` / `TaskCompleted` — TaskCreate/TaskUpdate tool 触发，**不是** sub-agent 生命周期事件（task list 管理）
- `TeammateIdle` — 仅 `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` 启用

**与 sub-agent 相关但独立：**
- `PreCompact` / `PostCompact`、`Notification`、`ConfigChange`、`InstructionsLoaded`、`Elicitation` / `ElicitationResult`、`FileChanged`

### 1.4 关键事实：Trellis 现在用 PreToolUse(Task|Agent) 而不是 SubagentStart

Trellis class-1 平台都用 **`PreToolUse` + matcher `Task` 和 `Agent`** 做 sub-agent prompt 注入（见 `templates/claude/settings.json:38-58`、`templates/codebuddy/settings.json:35-46`、`templates/droid/settings.json:35-46`、`templates/cursor/hooks.json:4-10`）。**没有用 SubagentStart**。

为什么用 PreToolUse 不用 SubagentStart：SubagentStart 是 sub-agent 已经被创建之后触发，而 hook 的目标是**改 sub-agent 的初始 prompt**。PreToolUse 在 Task/Agent 工具执行**之前**触发，input 里有 `tool_input.prompt`，hook 可以通过 `updatedInput` 覆盖它（issue #44412 / #39814 反复确认这是唯一通道）。SubagentStart input 里没有 prompt 字段——它是 lifecycle 事件，不是 prompt 改写点。

### 1.5 Windows 上的 hook 行为

跨平台一致性：**docs 上所有 hook event 在所有平台都"应该工作"**。但实际：

| 行为 | Mac/Linux | Windows | 来源 |
|---|---|---|---|
| `UserPromptSubmit` 触发 | ✅ | ✅ | issue #25981 confirmed |
| `SessionStart` 触发 | ✅ | ⚠️ 历史脆弱（已大幅改善） | issue #37024, #23105 |
| **`PreToolUse(Task)` 触发** | ✅ | **❌ silent skip on win32-x64** | **issue #25981 (closed-completed) + #53254 (open, 2026-04-25, v2.1.119)** |
| `PreToolUse` stdin 是 PTY 而非 pipe | n/a | **❌ stdin TTY，read 永不 yield** | issue #36156 (open) |
| `updatedInput` for Agent tool | ✅（Trellis 实测） | ❓未知 | issue #39814 / #44412 已知 macOS 上 silent ignore，Windows 未单独测 |

`#53254` 的 repro **完全和 Trellis 配置同款**：`.claude/settings.json` PreToolUse + matcher Bash + Git Bash 启动 + v2.1.119 + win32-x64。**hook 完全不被 invoke**——日志文件永远不被创建。这意味着 v12 报告的 Trellis 0.5.0/0.5.1 在 Windows 上 sub-agent context 注入失败，**很可能根源就是 #53254**——hook 根本没 fire。

---

## Q2 — Trellis inject-subagent-context.py 实际机制

读 `packages/cli/src/templates/shared-hooks/inject-subagent-context.py` 全文，关键路径如下。

### 2.1 触发时机

注释 line 14：

> Trigger: PreToolUse (before Task tool call)

各平台 hook 配置确认：所有 class-1 平台都把这个脚本绑到 `PreToolUse` + matcher `Task`/`Agent`（Cursor 还多绑 `Subagent`）。

### 2.2 输入 / 输出 contract

**输入（stdin JSON）**：
```json
{
  "tool_name": "Task",
  "tool_input": {
    "subagent_type": "trellis-implement",
    "prompt": "<original dispatch prompt>"
  },
  "cwd": "/path/to/project"
}
```

`_parse_hook_input` 函数（line 622-659）兼容 5 种平台 schema：
- Claude / CodeBuddy / Qoder / Droid: `tool_name=Task|Agent`, `tool_input.subagent_type`
- Cursor: `tool_name=Task|Subagent` + protobuf-shaped subagent_type（直接 string / `{custom: {name}}` / `{type: {case: "custom", value: {name}}}`）
- Copilot: `toolName` (camelCase)，value 可能直接是 agent name
- Gemini: `tool_name` 本身就是 agent name
- Kiro: `agentSpawn` event 把 `agent_name` 放在 top level

**输出（stdout JSON）**：
```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "updatedInput": {"subagent_type": "...", "prompt": "<NEW PROMPT WITH CONTEXT INJECTED>"}
  },
  "permission": "allow",
  "updated_input": {...},
  "updatedInput": {...}
}
```

注意（line 723-739）：脚本同时输出三种 schema 字段（`hookSpecificOutput.updatedInput` / `updated_input` / `updatedInput`），靠各平台忽略不认识的字段做 multi-format 兼容。

### 2.3 怎么识别 sub-agent

Line 671-676：如果 `subagent_type` 不在 `AGENTS_ALL = (trellis-implement, trellis-check, trellis-research)` 里就 `sys.exit(0)`（不注入，让 tool 原样跑）。Hook 永远在 PreToolUse 触发，但只对 Trellis 自己的 sub-agent 生效。

### 2.4 怎么读 jsonl 文件

`read_jsonl_entries` (line 189-255)：
- 跳过没有 `file` 字段的行（seed row `{"_example": ...}`）
- `type: "directory"` 时调 `read_directory_contents` 读目录里所有 `.md`
- 其他时候 `read_file_content` 读单文件
- 如果 jsonl 不存在或全是 seed，stderr 警告但仍 `sys.exit(0)`（不阻塞 spawn）

### 2.5 怎么把内容塞进 sub-agent prompt

`build_implement_prompt` / `build_check_prompt` / `build_research_prompt` / `build_finish_prompt` (line 330-435, 485-542) 把 context 包成形如：

```
# Implement Agent Task

You are the Implement Agent in the Multi-Agent Pipeline.

## Your Context

All the information you need has been prepared for you:

=== <task-path>/<spec-file> ===
<spec content>

=== <task-path>/prd.md (Requirements) ===
<prd content>

=== <task-path>/info.md (Technical Design) ===
<info content>

---

## Your Task

<original_prompt>

---

## Workflow
...
```

然后塞进 `updated.prompt`，`updated = {**tool_input, "prompt": new_prompt}`（line 726）——保留所有原 input 字段（`subagent_type`, `description`, `model` 等），只覆盖 `prompt`。这是为了避开 issue #27034（updatedInput 替换整个 tool_input 时丢字段）。

### 2.6 Windows 上的特殊处理

只有一处（line 36-41）：

```python
if sys.platform.startswith("win"):
    import io as _io
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    elif hasattr(sys.stdout, "detach"):
        sys.stdout = _io.TextIOWrapper(sys.stdout.detach(), encoding="utf-8", errors="replace")
```

**只处理 stdout 编码**，没有处理：
- stdin 是 TTY/pipe（issue #36156：Windows PreToolUse hook 的 stdin 是 PTY，`json.load(sys.stdin)` 在 line 667 会 hang 或返回空）
- bash 路径解析（issue #37634：native installer + WSL 时 `bash` 解析到 WSL stub）
- PowerShell hook fallback

如果上游 hook 根本不被 invoke（#53254 / #25981），脚本里的代码无关紧要——根本没运行。

---

## Q3 — 各 class-1 平台 sub-agent hook 配置对比

| 平台 | 配置文件 | event 名 | matcher | 注入字段 | 同 hook script |
|---|---|---|---|---|---|
| **Claude Code** | `.claude/settings.json` | `PreToolUse` | `Task` + `Agent` | `hookSpecificOutput.updatedInput.prompt` | shared `inject-subagent-context.py` |
| **CodeBuddy** | `.codebuddy/settings.json` | `PreToolUse` | `Task` | 同 Claude (`modifiedInput`/`updatedInput`) | shared `inject-subagent-context.py` |
| **Factory Droid** | `.factory/settings.json` | `PreToolUse` | `Task` | `updatedInput.prompt` | shared `inject-subagent-context.py` |
| **Cursor** | `.cursor/hooks.json` | `preToolUse` (lowercase) | `Task\|Subagent` | `updated_input.prompt` | shared `inject-subagent-context.py` |
| **Kiro** | `.kiro/agents/<name>.json` (per-agent JSON) | `agentSpawn` (per-agent hook) | n/a (绑在每个 agent 上) | direct stdout context | shared `inject-subagent-context.py` |
| **OpenCode** | `.opencode/plugins/inject-subagent-context.js` | `tool.execute.before` | tool name=task | `args.prompt` mutation in-place | **OpenCode 专用 JS plugin** (not Python) |

参考代码：
- `packages/cli/src/templates/claude/settings.json:38-58`
- `packages/cli/src/templates/codebuddy/settings.json:35-46`
- `packages/cli/src/templates/droid/settings.json:35-46`
- `packages/cli/src/templates/cursor/hooks.json:4-10`
- `packages/cli/src/templates/kiro/agents/trellis-implement.json:7-12`
- `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:318-411`
- `packages/cli/src/templates/shared-hooks/index.ts:66-96` (SHARED_HOOKS_BY_PLATFORM table)

### 3.1 关键差异

**Claude Code / CodeBuddy / Droid / Cursor**：都依赖 `PreToolUse(Task)` 配 `updatedInput.prompt`。这条路径在 Windows 上直接撞 #25981 / #53254 / #36156。

**Kiro**：完全不同——它**没有** PreToolUse 概念，每个 agent 定义文件（JSON）里有 `hooks` 字段，sub-agent spawn 时会跑 `agentSpawn` 命令。机制是 direct stdout context（不是 stdin 改写 prompt），更接近"sub-agent 启动前 prepend 一段文本"。Windows 上这条路径**没有公开 issue**——可能更稳，但也可能没人测过。

**OpenCode**：用 JS plugin 而非 Python hook。机制是 `tool.execute.before` 拦截 + `args.prompt` 直接 mutate。这绕开了所有 stdin/PTY 坑——OpenCode 直接把对象传 JS 回调，不走子进程。**Windows 行为不依赖 PreToolUse hook 机制**，是这 6 个 class-1 平台里 Windows 最可靠的（这点和 main session env 注入一致——OpenCode 的 `inject-subagent-context.js:267-274` 已经实现 win32 PowerShell-aware prefix 注入）。

### 3.2 Windows 失败矩阵

| 平台 | Mac/Linux | Windows + Git Bash | Windows + PowerShell tool only |
|---|:---:|:---:|:---:|
| Claude Code | ✅ | **❌** (#25981, #53254) | **❌** |
| CodeBuddy | ✅（继承 Claude 协议） | **❌**（同根） | **❌** |
| Factory Droid | ✅（文档明确） | **❌**（同根，未单独 issue 但同协议） | **❌** |
| Cursor | ✅（2026-04-07 staff 修复） | **⚠️**（forum.cursor.com #145016, #154608 两条 active 报告 Windows 2.1.25+ regression） | **❌**（hooks.json 路径在 Windows 是 `C:\ProgramData\Cursor\hooks.json` 但 hook 不 fire） |
| Kiro | ✅ | ❓ 未公开测试 | ❓ |
| OpenCode | ✅ | **✅**（JS plugin 路径，无 stdin/PTY 坑） | **✅** |

**结论**：除 OpenCode 外的 5 个 class-1 平台在 Windows 上 sub-agent context 注入都**已知或推断不可靠**。

---

## Q4 — Windows 上 sub-agent context 注入的失败模式

### 4.1 三层失败链（按从底到顶排）

**Layer 1 — Hook 根本不 fire**（最致命）：
- `#25981`（closed-completed 2026-02-16，但是被 chrislloyd 关掉的，没有明确 fix 提交）
- `#53254`（open，v2.1.119，2026-04-25）：完全相同的 repro，"hook-debug.log was never created"
- 含义：Trellis 配的 PreToolUse(Task) 根本没运行，sub-agent 收到 main agent 写的 dispatch prompt 原文

**Layer 2 — Hook 触发但 stdin 是 TTY**：
- `#36156`（open）：`process.stdin.isTTY === true`，`process.stdin.on('data', ...)` 永不 fire
- 在 Trellis 脚本里：line 667 `input_data = json.load(sys.stdin)` 会**阻塞或抛 JSONDecodeError**，line 668-669 `except json.JSONDecodeError: sys.exit(0)`——**静默跳过**，sub-agent 收到原 prompt
- workaround：用户在 settings.json 里设 `CLAUDE_CODE_GIT_BASH_PATH` 指向 `bin\bash.exe`（非 mintty）有时能恢复

**Layer 3 — Hook 触发但 updatedInput 被丢**：
- `#39814`（open）/ `#44412`（open）/ `#15897`（开发者反编译 root cause）/ `#22940`：`updatedInput` 对 Task/Agent tool 在某些场景 silent ignore；多个 PreToolUse hook 时最后一个会覆盖前面的
- 在 Trellis 实测路径上：04-17-cc-hook-inject-test 在 Mac 上确认能注入。Windows 上没单独测，但**如果 Layer 1/2 已经挂了，根本到不了这里**

### 4.2 Trellis 现在的行为

- Layer 1 失败 → sub-agent 拿到 main agent dispatch prompt 原文（通常长得像 "请按 prd.md 实现 X"）
- Layer 2 失败 → 同上（hook exit 0，no output，PreToolUse 自动 fallback 到 allow + 原 input）
- Layer 3 失败 → 同上

**所有失败模式的最终结果都一样**：sub-agent 收到的 prompt 不带 prd / spec / jsonl 注入，sub-agent 不知道 task 上下文。Trellis 的 sub-agent 定义文件（`.claude/agents/trellis-implement.md` 等）现在的 instruction body 里**没有**任何 fallback 指引——只说"All the information you need has been prepared for you" 或者 "Read .trellis/workflow.md / spec / prd.md"——**等于把信息架构假设了 hook 一定成功**。

### 4.3 直接结论

class-1 push hook 在 Windows 上**和 main-session `CLAUDE_ENV_FILE` 失败链是两条独立的 bug 链**：
- main session: windows guard / sourcing / Git Bash 路径解析（`claude-code-windows-env-injection.md` Q1-Q3）
- sub-agent: hook 不 fire / stdin TTY / updatedInput 丢字段（本文 Q4）

**两条链共用一个根本观察**：Windows 上 Claude Code 的 hook subsystem 整体不成熟。Anthropic 自己的 windows guard 已经修了一部分（v2.1.111），但 PreToolUse 在 Windows 上 silent skip 仍然 active（v2.1.119 上 #53254 open）。Trellis 不能假设这条路径稳。

---

## Q5 — pull-prelude 扩到 class-1 的可行性

### 5.1 当前状态

`packages/cli/src/configurators/shared.ts:493-524` 的 `buildPullBasedPrelude(agentType)` 已经写好；只对 `SubAgentType = "implement" | "check"` 生效；`research` 是 orthogonal，不带 prelude（因为 research 不需要 task 上下文，spec tree 由 hook 注入或 sub-agent 自己探索）。

`shared.ts:597-608` 的 `applyPullBasedPreludeMarkdown(agents)` 是已封装好的批量 transform：
- 调 `detectSubAgentType(name)` 识别 `trellis-implement` / `trellis-check`
- 对识别出的两个 agent 文件，把 prelude 插入到 frontmatter 后、原 body 前
- 对 research / 其他文件 pass-through

### 5.2 现在哪些平台用了，哪些没用

调 `applyPullBasedPreludeMarkdown` 的：
- gemini.ts
- qoder.ts
- copilot.ts
- pi.ts
（class-2 平台 + 1 extension-backed）

`applyPullBasedPreludeToml`：
- codex.ts

**没调任何 prelude 注入的（class-1）**：
- claude.ts
- cursor.ts
- codebuddy.ts
- droid.ts
- kiro.ts
- opencode.ts

含义：当前 5 个 class-1 Python-hook 平台 + opencode 的 sub-agent 定义文件**完全不带 fallback 指令**。一旦 hook fail，sub-agent 没有任何线索去自己拉 context。

### 5.3 prelude 文本兼容性分析

`buildPullBasedPrelude("implement")` 现在的文本（shared.ts:498-523）：

```markdown
## Required: Load Trellis Context First

This platform does NOT auto-inject task context via hook. Before doing anything else, you MUST load context yourself.

### Step 1: Find the active task path

Try in order — stop at the first one that yields a task path:

1. **Look at the dispatch prompt** you received from the main agent. If its first line is `Active task: <path>` (e.g. `Active task: .trellis/tasks/04-17-foo`), use that path. The main agent is required to include this line on class-2 platforms.
2. **Run** `python3 ./.trellis/scripts/task.py current --source` and read the `Current task:` line.
3. **If both fail** ... ask the user; do NOT guess.

### Step 2: Load task context from the resolved path

1. Read the task's `prd.md` and `info.md` if it exists.
2. Read `<task-path>/implement.jsonl` — JSONL list of dev spec files relevant to this agent.
3. For each entry in the JSONL, Read its `file` path.
   **Skip rows without a `"file"` field** ...

If `implement.jsonl` has no curated entries ..., fall back to: read `prd.md`, list available specs ..., and pick the specs that match the task domain yourself.
```

**两个文本兼容性事实**：
1. Prelude 第一句话是 *"This platform does NOT auto-inject task context via hook"* —— 这句话在 class-1 hook 成功的场景下**事实错误**。但下游 instruction 都是"先尝试 dispatch prompt，再尝试 task.py"，**不会和 hook 注入冲突**——hook 注入的 prompt 已经把 prd/spec 内容塞在 `=== ... ===` block 里，sub-agent 看到 prelude 后会按指令找 `Active task:` line（找不到）→ 找 `task.py current`（可能成功）→ 但这只是给它 "active task path"，不是新读 spec。
2. 真正的"已经被 hook 注入了 spec 内容" anchor 应该是 build_implement_prompt 里的 `## Your Context` block（`### get_implement_context` 输出的 `=== <path> ===` 块）。如果 sub-agent 看到那些 block，就该理解 spec 已 ready，prelude 的"go read the jsonl"步骤是冗余但无害的。

### 5.4 改进版 prelude 文本（推荐）

为了让 prelude 在"hook 成功 + hook 失败"两个场景都正确工作，可以在 prelude 顶端加一个 short circuit：

```markdown
## Required: Load Trellis Context First

If the prompt above already contains `=== ... ===` block markers with prd / spec content
(injected by your platform's sub-agent context hook), context is already loaded — skip
the rest of this section.

Otherwise, the hook failed (commonly: Windows + Claude Code PreToolUse silent skip,
issue #53254). Load context yourself:

### Step 1: Find the active task path
...
```

这个 marker（`=== ... ===`）正是 `inject-subagent-context.py` 里 `get_*_context` 函数的输出格式（line 268, 293, 299, 311, 314）。检查这个 marker 是 deterministic 的，不依赖 sub-agent 推理。

### 5.5 Class-1 也带 prelude 的副作用评估

**冗余开销（hook 成功路径）**：
- prelude ~25 行 markdown，永远在 sub-agent prompt 顶部
- sub-agent 多读一遍 fallback 指令；short-circuit 让它立即跳过
- 不会产生重复 file read，因为 short-circuit 在"已经看到注入内容"时立刻退出
- token 开销：~150 token / sub-agent dispatch，可忽略

**冲突（hook 成功路径）**：
- prelude 出现在 build_implement_prompt 的 `# Implement Agent Task` 顶之前（取决于 inject 顺序）。当前 inject-subagent-context.py 用 build_implement_prompt 整体替换 prompt——**会覆盖 prelude**？
- **要点**：prelude 是写到 **agent definition 文件**（`.claude/agents/trellis-implement.md`）的 system prompt 里，不是写到 dispatch prompt 里。Claude Code 的 sub-agent 启动协议是「system prompt = agent definition file body + hook-injected prompt = user message」。**两者并存，不互相覆盖**
- 验证方式：读 `.claude/agents/trellis-implement.md` 当前内容（line 7 之后是 system prompt body），prelude 进 system prompt；inject-subagent-context.py 改的是 user message（`tool_input.prompt`），两者并行
- **结论**：不冲突

**workflow.md 改动面（让 main agent 在 class-1 也加 `Active task: <path>` 第一行）**：
- 当前 `[workflow-state:in_progress]` breadcrumb 只对 class-2 强制要求 `Active task: <path>`（platform-integration.md:816）
- 如果让 class-1 也带上这一行，main agent 就能在 hook 失败时给 sub-agent 提供 fallback path
- 改动点：`packages/cli/src/templates/trellis/workflow.md` 里 `[workflow-state:in_progress]` block —— 把 class-1/class-2 的区分去掉，统一要求"dispatch sub-agent 时 prompt 第一行必须是 `Active task: <path>`"
- 影响：每次 sub-agent dispatch 多 1 行 prompt 文本，无副作用；hook 成功时 sub-agent 看到那行 + `=== ... ===` block → 直接走 short-circuit；hook 失败时 sub-agent 看到那行 → 按 prelude Step 1 直接拿到 task path
- 风险：低，但需要 main agent 真的执行——breadcrumb 是 reminder，不是强制。OK because `in_progress` breadcrumb 每个 turn 都重新注入，main agent 看到的概率高

### 5.6 Implementation cost（如果做）

最小改动：
1. `claude.ts` / `cursor.ts` / `codebuddy.ts` / `droid.ts` / `opencode.ts`（OpenCode 也要因为它读 `.opencode/agents/*.md`）调用 `applyPullBasedPreludeMarkdown` 在写 agents 之前
2. `kiro.ts` 因为 agent 是 JSON、`instructions` 字段是 string，需要类似 `injectPullBasedPreludeJson`（新函数）
3. `buildPullBasedPrelude` 文本头加 short-circuit 段落
4. `workflow.md` `[workflow-state:in_progress]` 把 class-1/class-2 区分去掉

总改动：~5 个 configurator 各加一行 `applyPullBasedPreludeMarkdown` + 1 个新 helper（kiro JSON）+ prelude 文本调整 + workflow.md 一段 + 配套 regression 测试。复杂度低。

---

## Q6 — sub-agent 怎么感知 hook 是否已注入

### 6.1 注入成功时 sub-agent 看到的 prompt

来自 `inject-subagent-context.py:330-361`（`build_implement_prompt`）：

```
# Implement Agent Task

You are the Implement Agent in the Multi-Agent Pipeline.

## Your Context

All the information you need has been prepared for you:

=== <task-dir>/<spec-file>.md ===
<spec content>

=== <task-dir>/prd.md (Requirements) ===
<prd content>

=== <task-dir>/info.md (Technical Design) ===
<info content>

---

## Your Task

<original_prompt>

---

## Workflow
...
```

**deterministic markers**：
- `=== <path> ===` block 头（多个）
- `# Implement Agent Task` / `# Check Agent Task` / `# Research Agent Task` / `# Finish Agent Task` 标题
- `## Your Context` section 标题
- `All the information you need has been prepared for you:` 字面文案

只要 prompt 里**任何一个 `=== ` block 出现**，就可以判定 hook 注入成功。最 robust 的 anchor 是 `=== ` 前缀（grep `^=== `）。

### 6.2 注入失败时 sub-agent 看到的 prompt

main agent 写的 dispatch prompt 原文，比如：

```
Implement the feature described in prd.md. The active task is .trellis/tasks/05-06-foo.
Use the implement.jsonl spec list. When done report files modified.
```

或者更短/更乱的，取决于 main agent 自己的发挥。**不会带 `=== ` block**，**不会带 `## Your Context` 标题**——因为这两个都是 build_implement_prompt 的 wrapper text，main agent 写不出来。

### 6.3 Pull-prelude 的判断逻辑

最简单可靠：

```markdown
## Required: Load Trellis Context First

If the prompt you received contains lines starting with `=== ` (triple-equals), the
sub-agent context hook already injected your task context above. Skip this section.

Otherwise, the hook did NOT fire (common on Windows + Claude Code, see issues #25981 /
#53254). Follow the steps below to load context yourself.

### Step 1: ...
```

`=== ` triple-equals 是非常 distinctive 的——既不是 markdown 标题（那是 `# / ## / ### `），也不是常见的代码 block——只在 Trellis 的注入模板里出现。误判概率接近 0。

### 6.4 备选 anchor

如果 `=== ` 不够 robust，备选：
- `# Implement Agent Task` / `# Check Agent Task`（标题 anchor），但 main agent 也可能巧合写出
- 加一个魔法 string 比如 `<!-- TRELLIS_CONTEXT_INJECTED -->` 到 build_*_prompt 顶部，prelude 检测这个 string——最 unambiguous 但要改 inject-subagent-context.py
- 检测 jsonl 里第一个 file path 是否出现在 prompt 里——更精确但 prelude 要 read jsonl，多一步 IO

**推荐**：先用 `=== ` 简单 anchor。日后如果出现假阴性，再加 magic comment。

---

## 推荐 0.5.3 修法

基于以上事实，按治本程度排序。

### 步骤 1（治本，必做）— class-1 sub-agent 定义文件加 pull-prelude

**改动**：

1. `packages/cli/src/configurators/claude.ts` / `cursor.ts` / `codebuddy.ts` / `droid.ts`：
   - 在写 `agents/` 之前调 `applyPullBasedPreludeMarkdown(getAllAgents())`
   - claude.ts 现在用 `copyDirFiltered`，需要稍微重构成"先 read agents → applyPrelude → write agents"

2. `packages/cli/src/configurators/opencode.ts`：
   - 同样加 prelude 到 `.opencode/agents/*.md`
   - OpenCode 的 plugin 路径 Windows 上是 OK 的，但 prelude 是 belt-and-suspenders fallback，**对所有 class-1 平台一视同仁**最一致

3. `packages/cli/src/configurators/kiro.ts`：
   - Kiro agents 是 JSON，`instructions` 是 string；需要新写 `injectPullBasedPreludeJson(content, agentType)` 在 JSON 解析后 prepend prelude 到 instructions 字段
   - 或者更简单：把 prelude 文本直接在 `agents/*.json` 模板里硬编码（Kiro 模板少，3 个文件）

4. `packages/cli/src/configurators/shared.ts:498-523` 的 `buildPullBasedPrelude` 文本：
   - 顶部加 short-circuit 段落（见 Q6.3）
   - 把 *"This platform does NOT auto-inject"* 改成 *"If the hook didn't fire (common on Windows + Claude Code, see issue #53254), load context yourself:"* —— 准确反映"也可能 hook 失败，不一定是平台不支持"

5. `packages/cli/src/templates/trellis/workflow.md` `[workflow-state:in_progress]` block：
   - 把 "class-2 platforms only" 限定去掉，要求所有 sub-agent dispatch 第一行都是 `Active task: <path>`
   - 这给 prelude Step 1 提供稳定 fallback path

6. 配套测试：
   - `test/configurators/*.test.ts` 验证每个 class-1 platform 写出的 `agents/trellis-implement.{md,json}` 包含 prelude 文本
   - `test/regression.test.ts` 测 short-circuit 文本存在 + workflow.md 含统一 `Active task:` 要求

**为什么这是治本**：把 sub-agent context loading 从"hook 成功才有"变成"hook 是优化路径，prelude 是兜底"——任何 Windows hook bug 都不再 fatal。

**为什么不破坏现有 hook 成功路径**：
- prelude 在 system prompt（agent definition 文件），hook 注入在 user message（`tool_input.prompt`），两者并存
- short-circuit 检测 `=== ` block，hook 注入时 sub-agent 立即跳过 prelude steps
- 唯一 overhead：每个 class-1 sub-agent dispatch 多 ~150 token prelude

### 步骤 2（保险，建议）— inject-subagent-context.py 加 explicit marker

在 build_implement_prompt 顶部加魔法 comment：

```python
new_prompt = f"""<!-- TRELLIS_CONTEXT_INJECTED -->
# Implement Agent Task
...
"""
```

让 prelude 用 magic comment 而不是 `=== ` 做判断。`=== ` 误判概率虽然低但非 0；magic comment 是 0。

如果不做这一步，步骤 1 的 prelude 用 `=== ` anchor 也 OK——这是 nice-to-have。

### 步骤 3（紧急绕过 — 0.5.2 hotfix 备选）— 文档化

在 docs-site 加一篇 "Sub-agent context not loaded on Windows" troubleshooting 页：
- 引用 #25981 / #53254 / #36156
- 教用户 `CLAUDE_CODE_GIT_BASH_PATH` workaround
- 教用户 manual workaround：在 sub-agent 启动后第一句话告诉它 `Read .trellis/tasks/<task>/prd.md and implement.jsonl`

短期 hotfix；长期靠步骤 1。

### 不做（明确范围外）

- **不**改 `inject-subagent-context.py` 的核心逻辑（`json.load(sys.stdin)` 卡住的问题是 #36156，不是 Trellis 的 bug，无法在脚本端修；Trellis 已经做了 `JSONDecodeError → exit 0` 的 graceful skip）
- **不**改 `task.py` 现有 `TRELLIS_CONTEXT_ID` 解析（属于 main session env 注入，前一份 research 处理）
- **不**对 OpenCode 用不同处理（class-1 vs OpenCode 一视同仁更一致；OpenCode JS plugin 路径稳就让 prelude 当 redundant safeguard，不冲突）

---

## 引用来源

### Anthropic 官方一手

1. **Claude Code Hooks Reference** — https://code.claude.com/docs/en/hooks，https://docs.anthropic.com/en/docs/claude-code/hooks —— 完整 hook event list（含 SubagentStart / SubagentStop / PreToolUse / PostToolUse 全表）；hook output schema；matcher 规则；agent_id / agent_type 在 sub-agent 内部存在。
2. **Claude Code Tools Reference** — https://code.claude.com/docs/en/tools-reference —— `Agent` / `Task` 工具定义；sub-agent 有独立 context window。
3. **Claude Code Agent SDK Hooks** — https://code.claude.com/docs/en/agent-sdk/hooks —— Subagent hook 跨 SDK 一致性；提到 "Hooks may not fire when the agent hits the max_turns limit"，但没有提 Windows 限制（说明 Anthropic 文档**没有**披露 Windows hook 不稳定，#53254 是真实但未文档化的 bug）。

### claude-code GitHub issues（一手，本次重点）

4. **#53254 [Bug] PreToolUse and PostToolUse hooks not invoked on Windows (win32-x64)** — https://github.com/anthropics/claude-code/issues/53254 —— **OPEN，2026-04-25，v2.1.119**：完全和 Trellis 配置同款（.claude/settings.json + Git Bash + valid hooks schema），hook-debug.log 永不创建。**这是 Trellis Windows sub-agent context 注入失败的最可能根因。**
5. **#25981 PreToolUse and PostToolUse hooks loaded but never fire on Windows** — https://github.com/anthropics/claude-code/issues/25981 —— closed 2026-02-16 by chrislloyd 但没明确 fix commit；UserPromptSubmit 工作而 PreToolUse 不工作的 asymmetry。
6. **#36156 [Windows] Hooks receive stdin as TTY instead of pipe** — https://github.com/anthropics/claude-code/issues/36156 —— OPEN，PreToolUse fire 了但 stdin 是 PTY，`json.load(sys.stdin)` 永不返回；workaround `CLAUDE_CODE_GIT_BASH_PATH` 指向 non-mintty bash 有时能恢复。
7. **#39814 PreToolUse hook `updatedInput` silently ignored for Agent tool** — https://github.com/anthropics/claude-code/issues/39814 —— OPEN 2026-03-27 macOS：`hookSpecificOutput.updatedInput` 对 Agent tool silent ignore；workaround 用 `SubagentStart` + `additionalContext`（但没 prompt 字段无法 mutate）。
8. **#44412 bug: PreToolUse hook updatedInput is ignored for the Agent tool** — https://github.com/anthropics/claude-code/issues/44412 —— OPEN 2026-04-06：另一个 macOS repro，证明这是泛 Agent tool bug 不限 Windows；与 #44385 一起意味着没办法程序化设 sub-agent model。
9. **#15897 [BUG] updatedInput PreToolUse response does not work when multiple PreToolUse hooks are executed** — https://github.com/anthropics/claude-code/issues/15897 —— 反编译 root cause（"last hook wins, undefined updatedInput overwrites"）。
10. **#27034 PreToolUse hook updatedInput replaces entire tool_input** — https://github.com/anthropics/claude-code/issues/27034 —— closed dup of #22940；说明为什么 Trellis 必须用 `{**tool_input, "prompt": new_prompt}` 而不是只塞 `{"prompt": ...}`。
11. **#22009 PreToolUse hook "block" response ignored on Windows** — https://github.com/anthropics/claude-code/issues/22009 —— closed dup；Windows hook 类问题历史长。
12. **#16564 Windows: Hook system missing TOOL_NAME and EXIT_CODE env vars** — https://github.com/anthropics/claude-code/issues/16564 —— Windows hook 触发但 env 不全；进一步证明 Windows hook subsystem 完整性差。
13. **#21460 [SECURITY] PreToolUse hooks not enforced on subagent tool calls** — https://github.com/anthropics/claude-code/issues/21460 —— project-level settings 不被 sub-agent 继承；user-level (`~/.claude/settings.json`) 工作。**Trellis 全部用 project-level，不受这个影响**（Trellis 配的是 sub-agent SPAWN 时的 hook 不是 sub-agent INTERNAL tool calls 的 hook，这是不同 layer）。
14. **#18392 [BUG] Hooks in agent frontmatter are not executed for subagents** — https://github.com/anthropics/claude-code/issues/18392 —— 证据：agent frontmatter 里的 hooks 不会被 Task tool spawn 的 sub-agent 执行；和 Trellis 没关系（Trellis 不在 frontmatter 里写 hooks）。

### Cursor 官方文档 + 论坛

15. **Cursor Hooks Docs** — https://cursor.com/docs/hooks —— 完整 hook event list（`preToolUse` / `subagentStart` / `subagentStop` / `beforeShellExecution` 等 18 个）；matcher 规则；platform-specific config dir（Windows: `C:\ProgramData\Cursor\hooks.json`）。
16. **Cursor forum #145016 Hooks are not working anymore** — https://forum.cursor.com/t/hooks-are-not-working-anymore/145016 —— Cursor 2.1.25+ 起 Windows hooks regression，"update with the fix is already in progress" 但 forum thread 至 2026-03 仍在抱怨。
17. **Cursor forum #154608 preToolUse worked then stopped after hooks.json edit** — https://forum.cursor.com/t/hooks-intermittently-non-functional-on-windows-pretooluse-worked-then-stopped-after-hooks-json-edit/154608 —— 2026-03-12 follow-up，Cursor 2.2.x Windows 上 hooks 偶发失效。

### 社区 / blog

18. **netnerds.net "Fixing Claude Code's PowerShell Problem with Hooks"** — https://blog.netnerds.net/2026/02/claude-code-powershell-hooks/ —— 用 Bash 写的 PreToolUse hook 用来阻止 Claude Code 错用 powershell.exe，证明 Mac/Linux 上 Bash hook 是 working pattern，但同时 confirmed Windows 用户无 PowerShell-native hook 替代。

### Trellis 仓库本地

19. `packages/cli/src/templates/shared-hooks/inject-subagent-context.py` —— class-1 hook 主体；line 36-41 Windows stdout UTF-8 修复（仅这一处 OS 分支）；line 622-659 五种平台 schema 解析。
20. `packages/cli/src/templates/shared-hooks/index.ts:66-96` —— `SHARED_HOOKS_BY_PLATFORM` 表；class-1 push 平台清单。
21. `packages/cli/src/configurators/shared.ts:493-608` —— `buildPullBasedPrelude`、`injectPullBasedPreludeMarkdown`、`applyPullBasedPreludeMarkdown` 已封装好。
22. `packages/cli/src/configurators/{claude,cursor,codebuddy,droid,kiro,opencode}.ts` —— 6 个 class-1 平台 configurator 当前**都没调** prelude 注入。
23. `packages/cli/src/templates/{claude,cursor,codebuddy,droid}/settings.json` / `cursor/hooks.json` —— PreToolUse(Task)/(Agent) hook 注册。
24. `packages/cli/src/templates/kiro/agents/trellis-implement.json` —— Kiro 的 per-agent JSON `hooks: [{on: agentSpawn, command: ...}]` 格式。
25. `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:267-274` —— OpenCode 已实现 win32 PowerShell-aware shell prefix 注入，证明 Trellis 团队已有"Windows 需要不同处理"意识。
26. `.trellis/spec/cli/backend/platform-integration.md:784-846` —— Subagent Context Injection: Hook-based vs Pull-based vs Extension-backed 完整 spec。
27. `.trellis/spec/cli/backend/workflow-state-contract.md:204-219` —— Hook reachability matrix；class-1 / class-2 定义。
28. `.trellis/tasks/archive/2026-04/04-17-subagent-hook-reliability-audit/research/platform-hook-audit.md` —— 历史 audit；Claude Code 在 Mac 实测注入工作（带 canary verification）；Cursor 2026-04-07 staff fix；Gemini 已降级 pull-based。

### 缺口（未找到 / 需要进一步验证）

- **没找到** Cursor / CodeBuddy / Droid / Kiro 在 Windows 上 sub-agent hook 的明确 issue（除 Cursor #145016 / #154608 较泛的 hooks regression）。class-1 失败矩阵里这几个平台标 ❌ 是基于"Claude 协议派生 + 共享 #53254 根因"的推断，不是直接 issue 证据。
- **没找到** Anthropic 关于 #53254 的 root cause 分析或 fix ETA。issue 至 2026-05 仍 open。
- **未实测** 步骤 1 的 prelude `=== ` short-circuit anchor 在真实 Claude Code sub-agent 场景的可靠度。建议主 agent 在实施步骤 1 后用 04-17-cc-hook-inject-test 同款 canary 方法做一次 e2e（hook 成功路径 + 模拟 hook 失败路径）。

---

## 给主 agent 的最简版决策清单

1. **结论**：class-1 push hook 在 Windows 上和 main-session env 注入是两条独立失败链，根因是 Anthropic 自己的 PreToolUse hook 在 Windows 上 silent skip（#53254 OPEN at v2.1.119）。Trellis 没办法在脚本端修这个 upstream bug。
2. **必做（步骤 1）**：把 `applyPullBasedPreludeMarkdown` 也用到 5 个 class-1 platform 的 sub-agent 定义文件，加 `=== ` block short-circuit，让 hook 失败时 sub-agent 自己拉 context。改动量小，无副作用。
3. **可选（步骤 2）**：build_*_prompt 顶部加 `<!-- TRELLIS_CONTEXT_INJECTED -->` magic marker 让 short-circuit 0 误判。
4. **0.5.2 hotfix（步骤 3）**：docs-site 加 troubleshooting 页 + `CLAUDE_CODE_GIT_BASH_PATH` workaround 引用 #36156。
5. **0.5.3 PR 范围**：步骤 1 + 步骤 2 + workflow.md `[workflow-state:in_progress]` 把 class-1/class-2 区分去掉统一要求 `Active task: <path>` 第一行。
