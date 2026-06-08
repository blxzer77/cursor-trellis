# Research: Claude Code Hook API

- **Query**: Claude Code hook 事件机制与 payload schema（为 Trellis trace plugin 设计准备）
- **Scope**: external (官方文档) + internal (本仓库现有 hook 配置)
- **Date**: 2026-04-20
- **Primary sources**:
  - https://docs.anthropic.com/en/docs/claude-code/hooks（权威参考，已抓取完整 Markdown 保存到 /tmp/cc-hooks.md）
  - https://docs.anthropic.com/en/docs/claude-code/hooks-guide
  - https://docs.anthropic.com/en/docs/claude-code/plugins-reference
  - https://github.com/neilberkman/ccrider/blob/main/research/schema.md（transcript JSONL schema，社区整理）
- **Claude Code 版本观察点**：本次抓取的文档为 docs.anthropic.com 最新版（2026-04 快照）。本地 transcript 里实际观察到 `version: "2.1.97"`，其他社区报告也有 `2.0.22/2.0.29`。部分字段（如 `defer`）要求 `v2.1.89+`。

---

## 1. 完整 Hook 事件列表

来自 [Hooks reference · Hook lifecycle](https://docs.anthropic.com/en/docs/claude-code/hooks#hook-lifecycle)。Cadence 分三类：**session 级**、**turn 级**、**agentic loop 内的每次工具调用**。另有 MCP / worktree / instruction / config 异步事件。

| 事件 | 触发时机 | 能否阻断 |
|---|---|---|
| `SessionStart` | session 启动或恢复 | 否 |
| `UserPromptSubmit` | 用户提交 prompt 之前 | 是 |
| `PreToolUse` | 工具调用之前（已生成参数） | 是 |
| `PermissionRequest` | 即将向用户弹权限对话框 | 是 |
| `PermissionDenied` | auto-mode 分类器拒绝某 tool 时 | 否（可 `retry: true`） |
| `PostToolUse` | 工具成功返回之后 | 否（可 `decision: "block"` 给 Claude 反馈） |
| `PostToolUseFailure` | 工具执行失败 | 否 |
| `Notification` | 发出通知（权限 / 空闲 / 登录成功 / elicitation） | 否 |
| `SubagentStart` / `SubagentStop` | 子 agent 被 spawn / 结束 | 否 / 是 |
| `TaskCreated` / `TaskCompleted` | agent-team 任务生命周期 | 是 / 是 |
| `Stop` | 主 agent 结束响应（正常） | 是 |
| `StopFailure` | 因 API 错误结束 turn | 否 |
| `TeammateIdle` | agent-team 队友即将空闲 | 是 |
| `InstructionsLoaded` | `CLAUDE.md` / `.claude/rules/*.md` 被加载 | 否 |
| `ConfigChange` | settings 文件变化 | 是（policy_settings 除外） |
| `CwdChanged` | cwd 改变（如执行 `cd`） | 否 |
| `FileChanged` | watcher 监听的文件变化 | 否 |
| `WorktreeCreate` / `WorktreeRemove` | `--worktree` / subagent `isolation:"worktree"` | 是 / 否 |
| `PreCompact` / `PostCompact` | 上下文压缩前 / 后 | 是 / 否 |
| `Elicitation` / `ElicitationResult` | MCP 要求用户输入 | 是 / 是 |
| `SessionEnd` | session 终止 | 否 |

**cadence 结构（trace plugin 视角）**：
- `SessionStart` → `UserPromptSubmit`*（每个 turn） → `PreToolUse` / `PostToolUse` 循环（agentic loop） → `Stop` → `SessionEnd`。

---

## 2. 公共输入字段（每个 hook 都有）

所有 command hook 从 **stdin 读 JSON**；HTTP hook 接收 POST body。

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/-Users-.../<session_id>.jsonl",
  "cwd": "/Users/.../my-project",
  "permission_mode": "default",      // default|plan|acceptEdits|auto|dontAsk|bypassPermissions
  "hook_event_name": "PreToolUse"
}
```

在 subagent 内或 `--agent` 启动时额外带：
- `agent_id` — subagent 唯一 id
- `agent_type` — agent 名称（`Explore`、`Plan`、自定义 …）

> 注意：`permission_mode` **不是所有事件都有**（比如 `SessionStart` 的文档示例里就没有）。以每个事件的示例为准。

---

## 3. 关键事件的 Payload Schema（trace plugin 重点）

### 3.1 `PostToolUse`（最核心 —— 实时捕获每一次代码编辑 / 命令执行）

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-19fa-41d2-8238-13269b9b3ca0.jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "PostToolUse",
  "tool_name": "Write",
  "tool_input":  { "file_path": "/path/to/file.txt", "content": "file content" },
  "tool_response": { "filePath": "/path/to/file.txt", "success": true },
  "tool_use_id": "toolu_01ABC123..."
}
```

`tool_input` / `tool_response` 的字段因 `tool_name` 而异（见下方 3.5）。`tool_use_id` 与 transcript 里 assistant 消息中对应 `tool_use` content block 的 `id` 相同，可作为 join key。

**决策控制**：可返回顶层 `decision: "block"` + `reason` 让 Claude 重新处理；也可返回 `hookSpecificOutput.additionalContext` 注入上下文；MCP 工具额外支持 `updatedMCPToolOutput` 覆盖工具输出。

### 3.2 `PreToolUse`

```json
{
  "session_id": "abc123",
  "transcript_path": "...",
  "cwd": "...",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": { "command": "npm test" },
  "tool_use_id": "toolu_01ABC..."   // 文档未在示例里展示，但 PostToolUse 有；实际观察下 PreToolUse 也会有（未100%确定：文档 PreToolUse 示例未列，需要实测）
}
```

**决策控制**（唯一使用 `hookSpecificOutput.permissionDecision` 的事件）：
- `permissionDecision`: `allow` / `deny` / `ask` / `defer`（defer 需 v2.1.89+，仅 headless `-p` 模式生效）
- `permissionDecisionReason`
- `updatedInput` — 在执行前**整体替换**工具参数（可用于参数改写）
- `additionalContext`

多 hook 冲突时优先级：`deny > defer > ask > allow`。

> 老文档里 PreToolUse 用顶层 `decision: "approve"|"block"` —— 已 **deprecated**，映射到 `allow`/`deny`。写新代码用 `hookSpecificOutput`。

### 3.3 `UserPromptSubmit`

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-....jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "UserPromptSubmit",
  "prompt": "Write a function to calculate the factorial of a number"
}
```

**决策控制**：
- `decision: "block"` → prompt 被丢弃 + `reason` 给用户看
- `hookSpecificOutput.additionalContext` → 注入上下文
- `hookSpecificOutput.sessionTitle` → 自动命名 session（等效 `/rename`）
- 纯文本 stdout 也会作为 context（非 JSON 也行）

### 3.4 `SessionStart`

```json
{
  "session_id": "abc123",
  "transcript_path": "/Users/.../.claude/projects/.../00893aaf-....jsonl",
  "cwd": "/Users/...",
  "hook_event_name": "SessionStart",
  "source": "startup",
  "model": "claude-sonnet-4-6",
  "agent_type": "..."    // 仅在 claude --agent <name> 启动时
}
```

`source` 值**完整集合**：
| matcher | 触发条件 |
|---|---|
| `startup` | 新 session |
| `resume` | `--resume` / `--continue` / `/resume` |
| `clear` | `/clear` |
| `compact` | 自动或手动 compaction 结束后 |

**注意**：只支持 `type: "command"` hook，不支持 prompt / agent / http。只读到 `CLAUDE_ENV_FILE`（附加 env vars 的特殊写入文件）。stdout 原样作为 context 注入（SessionStart 和 UserPromptSubmit 是两个特殊事件，stdout → Claude context）。

### 3.5 `SessionEnd`

```json
{
  "session_id": "abc123",
  "transcript_path": "...",
  "cwd": "/Users/...",
  "hook_event_name": "SessionEnd",
  "reason": "other"
}
```

`reason` 值集合：`clear` / `resume` / `logout` / `prompt_input_exit` / `bypass_permissions_disabled` / `other`。

**默认 timeout 1.5s**（与其他 hook 不同）。可通过 per-hook `timeout` 提升，或环境变量 `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS`（单位 ms）。最多 60s。

### 3.6 `Stop` / `SubagentStop`

```json
{
  "session_id": "abc123",
  "transcript_path": "~/.claude/projects/.../00893aaf-....jsonl",
  "cwd": "/Users/...",
  "permission_mode": "default",
  "hook_event_name": "Stop",
  "stop_hook_active": true,
  "last_assistant_message": "I've completed the refactoring. Here's a summary..."
}
```

`SubagentStop` 额外带 `agent_id`、`agent_type`、`agent_transcript_path`（subagent 自己的 transcript，存在 `subagents/` 子目录下）。

- `last_assistant_message` —— **trace plugin 可直接拿到最后一条 assistant 文本**，无需解析 transcript。
- `stop_hook_active: true` 表示已经因上一个 Stop hook 被 block 过一次；避免无限循环的标志。

### 3.7 `PreCompact` / `PostCompact`

- `PreCompact`: `{trigger: "manual"|"auto", custom_instructions: "..."}`（manual 时 = `/compact <text>` 里的 text）
- `PostCompact`: `{trigger, compact_summary: "..."}` —— **PostCompact 带压缩后的 summary 文本**，trace plugin 可直接存下来。

### 3.8 PreToolUse 的 `tool_input` 按工具分类

（摘自 reference，每个工具的字段表）

| tool_name | 关键字段 |
|---|---|
| `Bash` | `command`, `description?`, `timeout?`, `run_in_background?` |
| `Write` | `file_path`, `content` |
| `Edit` | `file_path`, `old_string`, `new_string`, `replace_all?` |
| `Read` | `file_path`, `offset?`, `limit?` |
| `Glob` | `pattern`, `path?` |
| `Grep` | `pattern`, `path?`, `glob?`, `output_mode?`, `-i?`, `multiline?` |
| `WebFetch` | `url`, `prompt` |
| `WebSearch` | `query`, `allowed_domains?`, `blocked_domains?` |
| `Agent`（启动 subagent） | `prompt`, `description`, `subagent_type`, `model?` |
| `AskUserQuestion` | `questions[]`, `answers?` |
| MCP tools | `mcp__<server>__<tool>`，字段由 server 自己定义 |

`tool_response` 字段**文档没有给全部工具的完整表**（NOT 100% enumerated in the hooks doc）。已知：
- `Write` → `{filePath, success}`（示例）
- `Bash` 等其他工具的 `tool_response` schema **未确定**，trace plugin 里建议整体透传不做强类型。

---

## 4. Hook 配置格式（`settings.json`）

三层嵌套：**事件 → matcher group → handler 列表**。

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "\"$CLAUDE_PROJECT_DIR\"/.claude/hooks/trace.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### Matcher 语法（关键）

| matcher 内容 | 语义 |
|---|---|
| `"*"`, `""`, 省略 | 匹配所有 |
| 只有字母/数字/`_`/`\|` | **精确字符串** 或 `\|` 分隔列表（`Edit\|Write`） |
| 含任何其他字符 | **JavaScript 正则**（`^Notebook`, `mcp__memory__.*`） |

不同事件的 matcher 字段不同（摘要）：

| 事件 | matcher 过滤 | 允许值 |
|---|---|---|
| `PreToolUse` / `PostToolUse` / `PostToolUseFailure` / `PermissionRequest` / `PermissionDenied` | `tool_name` | `Bash`, `Edit\|Write`, `mcp__.*` |
| `SessionStart` | 启动原因 | `startup` / `resume` / `clear` / `compact` |
| `SessionEnd` | 结束原因 | `clear` / `resume` / `logout` / `prompt_input_exit` / `bypass_permissions_disabled` / `other` |
| `Notification` | 通知类型 | `permission_prompt` / `idle_prompt` / `auth_success` / `elicitation_dialog` |
| `SubagentStart/Stop` | agent 类型 | `Bash`, `Explore`, `Plan`, 自定义 |
| `PreCompact` / `PostCompact` | 触发来源 | `manual` / `auto` |
| `ConfigChange` | 配置源 | `user_settings` / `project_settings` / `local_settings` / `policy_settings` / `skills` |
| `InstructionsLoaded` | 加载原因 | `session_start` / `nested_traversal` / `path_glob_match` / `include` / `compact` |
| `StopFailure` | 错误类型 | `rate_limit` / `authentication_failed` / `billing_error` / `invalid_request` / `server_error` / `max_output_tokens` / `unknown` |
| `FileChanged` | **字面文件名列表**（`.envrc\|.env`，非正则） | — |
| `UserPromptSubmit`, `Stop`, `TeammateIdle`, `TaskCreated`, `TaskCompleted`, `WorktreeCreate/Remove`, `CwdChanged` | **不支持 matcher** | — |

### Handler 类型

| type | 说明 |
|---|---|
| `command` | 本地 shell 命令（stdin JSON → exit code + stdout） |
| `http` | POST JSON 到 URL，响应里的 JSON 作决策 |
| `prompt` | 单轮 LLM 评估（`$ARGUMENTS` 占位符） |
| `agent` | 多轮 subagent 评估（可用 Read/Grep/Glob） |

`SessionStart` **只支持 `command`**。`ConfigChange` / `CwdChanged` / `Elicitation*` / `FileChanged` / `InstructionsLoaded` / `Notification` / `PermissionDenied` / `PreCompact` / `PostCompact` / `SessionEnd` / `StopFailure` / `SubagentStart` / `TeammateIdle` / `WorktreeCreate/Remove` 只支持 `command` + `http`。

### Handler 公共字段

| 字段 | 说明 |
|---|---|
| `type` | 必填 |
| `if` | 可选：permission rule 语法，如 `"Bash(git *)"`, `"Edit(*.ts)"`。只对 tool 事件生效。 |
| `timeout` | 秒。默认：command 600s / prompt 30s / agent 60s |
| `statusMessage` | 运行时 spinner 自定义文本 |
| `once` | 只在 skill frontmatter 里生效 |

### command hook 特殊字段

| 字段 | 说明 |
|---|---|
| `command` | 必填 |
| `async` | 后台运行，不阻塞 Claude；response 字段（decision/continue）无效 |
| `asyncRewake` | 后台运行 + exit 2 会唤醒 Claude（stderr/stdout → system reminder） |
| `shell` | `bash` (默认) / `powershell` (Windows) |

### Hook 位置层级（用于 plugin 设计）

| 位置 | 作用域 | 可共享 |
|---|---|---|
| `~/.claude/settings.json` | 所有项目（用户级） | 否（本机） |
| `.claude/settings.json` | 单项目 | 是（入 git） |
| `.claude/settings.local.json` | 单项目 | 否（gitignored） |
| Managed policy settings | 组织级 | 是（管理员） |
| **Plugin `hooks/hooks.json`** | **插件启用时** | **是（随插件分发）** |
| Skill / subagent frontmatter | 组件生效期间 | 是 |

Plugin 的 hooks 和用户/项目 hooks **合并执行**（不是替换）。

---

## 5. Hook 输出怎么影响 Claude

### 通过 exit code

- **exit 0** → 成功。Claude Code 解析 stdout 看是否是 JSON；`UserPromptSubmit` / `SessionStart` 的 stdout 会直接作为 **Claude 可见的 context** 注入。其他事件的 stdout 只进 debug log。
- **exit 2** → **blocking error**。stderr 被送回 Claude 作为错误信息。不同事件的 block 效果（节选）：

| 事件 | exit 2 效果 |
|---|---|
| `PreToolUse` | 阻止工具执行 |
| `PermissionRequest` | 拒绝权限 |
| `UserPromptSubmit` | 丢弃 prompt |
| `Stop` / `SubagentStop` | 强制继续工作 |
| `PreCompact` | 阻止压缩 |
| `TaskCreated` | 回滚任务创建 |
| `PostToolUse` | **不能 block**（工具已执行），但 stderr 给 Claude |
| `SessionStart` / `SessionEnd` / `Notification` / `CwdChanged` / `FileChanged` / `PostCompact` / `InstructionsLoaded` / `StopFailure` / `SubagentStart` / `WorktreeRemove` / `PermissionDenied` | **不能 block**，stderr 仅对用户可见 |
| `WorktreeCreate` | 非零 exit 即失败 |

- **其他非零 exit** → non-blocking 错误，transcript 显示 `<hook name> hook error` + stderr 首行，执行继续。

### 通过 exit 0 + JSON stdout（更细粒度）

JSON 字段三种：
1. **通用字段**：`continue` / `stopReason` / `suppressOutput` / `systemMessage`。`continue: false` 会**彻底停止 Claude**（覆盖所有事件决策）。
2. **顶层 `decision` + `reason`**：用于 `UserPromptSubmit` / `PostToolUse` / `PostToolUseFailure` / `Stop` / `SubagentStop` / `ConfigChange` / `PreCompact`。唯一值 `"block"`。
3. **`hookSpecificOutput`**：`PreToolUse`（permissionDecision）、`PermissionRequest`（decision.behavior）、`PermissionDenied`（retry）、`Elicitation*`（action/content）、`WorktreeCreate`（worktreePath via HTTP）等。

### `additionalContext` 注入

事件支持度：
- `SessionStart` — `hookSpecificOutput.additionalContext` 或纯 stdout
- `UserPromptSubmit` — `hookSpecificOutput.additionalContext` 或纯 stdout（+ `sessionTitle`）
- `PreToolUse` — `hookSpecificOutput.additionalContext`（工具执行前注入）
- `PostToolUse` / `PostToolUseFailure` — `hookSpecificOutput.additionalContext`
- `SubagentStart` — `hookSpecificOutput.additionalContext`（注入到 subagent 的 context）
- `Notification` — `hookSpecificOutput.additionalContext`

Context 注入有 **10,000 字符上限**。超过会保存为文件并替换为 preview + 文件路径（与 tool result 处理一致）。

### 改写工具调用

- `PreToolUse` + `permissionDecision: "allow"` + `updatedInput: {...}` → 在执行前**整体替换**工具参数。
- `PermissionRequest` + `decision.behavior: "allow"` + `updatedInput` → 同上，但需经过 allow/deny rules 再评估一次。
- `PostToolUse` + `updatedMCPToolOutput`（仅 MCP 工具）→ 替换工具输出。

---

## 6. Transcript 文件存储位置与格式

### 6.1 路径规则（经本地实测验证）

- 主 session：`~/.claude/projects/<normalized-project-path>/<session_id>.jsonl`
- 子 agent：`~/.claude/projects/<normalized-project-path>/<session_id>/subagents/agent-<shortId>.jsonl`（老文档写 `agent-<shortId>.jsonl` 在项目根下，**新版已观察到是嵌套 `<sessionId>/subagents/` 下**；以 SubagentStop hook 提供的 `agent_transcript_path` 为准）
- 全局命令历史：`~/.claude/history.jsonl`

**路径归一化规则**：绝对路径的 `/` 全替换为 `-`。例：`/Users/taosu/workspace/foo` → `-Users-taosu-workspace-foo`。

实测样本（本机 `find ~/.claude/projects`）：
```
/Users/taosu/.claude/projects/-Users-taosu-workspace-nb-project-reddit/384b70f8-1e2b-448e-a009-3d263693d4aa.jsonl
/Users/taosu/.claude/projects/-Users-taosu-services-SillyTavern/35772820-a562-4dd6-850c-5f4d0dd14b3f/subagents/agent-a5515764093d5a572.jsonl
```

**特殊情况（未完全确定）**：若 cwd 以多个 `/` 开头（如 macOS `/private/var/...`），归一化后会出现形如 `-Users-taosu` / `-Users-taosu--claude-skills-syla-project`（双 `-`，对应原路径的 `.` 开头目录如 `.claude`）。具体规则未在官方文档声明，需**以 hook 传入的 `transcript_path` 为准**，不要自己重新拼接。

### 6.2 JSONL 行级 Schema（来源：ccrider schema 研究 + 本地实测第一手数据）

**第一行通常是 summary**（可能有多种 meta 行混在前面；本机实测观察到 `permission-mode` 和 `file-history-snapshot` 行出现在 summary 之前）。

#### (a) Summary
```json
{ "type": "summary", "summary": "Human-readable title", "leafUuid": "<last-message-uuid>" }
```

#### (b) User message
```json
{
  "type": "user",
  "parentUuid": null,
  "isSidechain": false,
  "promptId": "3c8ee3de-...",
  "message": { "role": "user", "content": "..." },
  "uuid": "7acd2613-...",
  "timestamp": "2026-04-09T12:27:32.763Z",
  "permissionMode": "bypassPermissions",
  "userType": "external",
  "entrypoint": "cli",
  "cwd": "/Users/taosu/workspace/...",
  "sessionId": "384b70f8-...",
  "version": "2.1.97",
  "gitBranch": "HEAD"
}
```

可选字段：
- `thinkingMetadata: { level: "high"|"medium"|"low", disabled: bool, triggers: [] }`
- `toolUseResult` —— 当 user message 其实是工具结果时出现：
  - 通用：`{stdout, stderr, interrupted, isImage}`
  - WebFetch：`{bytes, code, codeText, result, durationMs, url}`
  - TodoWrite：`{oldTodos, newTodos}`
  - （其他工具的结构未在文档里全部枚举）

#### (c) Assistant message
```json
{
  "type": "assistant",
  "parentUuid": "...",
  "uuid": "...",
  "requestId": "req_01...",
  "timestamp": "...",
  "sessionId": "...",
  "cwd": "...",
  "version": "...",
  "gitBranch": "...",
  "message": {
    "model": "claude-sonnet-4-5-20250929",
    "id": "msg_01...",
    "type": "message",
    "role": "assistant",
    "content": [
      { "type": "text", "text": "..." },
      { "type": "tool_use", "id": "toolu_01...", "name": "Bash", "input": { "command": "ls", "description": "List files" } }
    ],
    "stop_reason": "end_turn",
    "stop_sequence": null,
    "usage": {
      "input_tokens": 617,
      "cache_creation_input_tokens": 0,
      "cache_read_input_tokens": 0,
      "cache_creation": { "ephemeral_5m_input_tokens": 0, "ephemeral_1h_input_tokens": 0 },
      "output_tokens": 118,
      "service_tier": "standard"
    }
  }
}
```

**Tool-use id 贯穿**：`message.content[].id`（`tool_use` block）== PostToolUse hook 的 `tool_use_id` == user message 里 `tool_result` block 的 `tool_use_id`。这是 trace plugin 把 hook 事件和 transcript 条目 join 的主键。

#### (d) System message
```json
{ "type": "system", "subtype": "local_command", "content": "<command-name>/resume</command-name>...", "level": "info", "isMeta": false, ... }
```

#### (e) File history snapshot
```json
{ "type": "file-history-snapshot", "messageId": "...", "isSnapshotUpdate": false,
  "snapshot": { "messageId": "...", "trackedFileBackups": { ".bash_profile": { "backupFileName": "d3729f6a94c1f530@v1", "version": 1, "backupTime": "..." } }, "timestamp": "..." } }
```
（文件备份存在 `~/.claude/file-history/` 下。）

#### (f) Permission-mode（实测观察到，ccrider schema 未列）
```json
{ "type": "permission-mode", "permissionMode": "bypassPermissions", "sessionId": "384b70f8-..." }
```

### 6.3 Threading 规则

- `parentUuid` 形成树：null = 根，其他 = 上一条。
- `isSidechain: true` = 分支会话（通常是 subagent）。
- `/resume` 时 **追加到同一 JSONL**，`sessionId` 不变。
- `cwd` 在一个 session 里可能变化（对应 `CwdChanged` hook）。

### 6.4 global command history `~/.claude/history.jsonl`
```json
{ "display": "用户输入的命令文本", "pastedContents": {}, "timestamp": 1759022024295, "project": "/Users/neil/personal/mommail" }
```

---

## 7. Hook 可用的环境变量

### Claude Code 注入的 env vars

| 变量 | 说明 | 可用范围 |
|---|---|---|
| `CLAUDE_PROJECT_DIR` | 项目根目录。用于引用 hook 脚本：`"$CLAUDE_PROJECT_DIR"/.claude/hooks/foo.sh`。**需要用双引号包裹**以处理路径空格。 | 所有 hook |
| `CLAUDE_PLUGIN_ROOT` | 插件安装目录。每次插件更新后变化。 | plugin hook |
| `CLAUDE_PLUGIN_DATA` | 插件持久化数据目录（升级保留）。 | plugin hook |
| `CLAUDE_ENV_FILE` | 一个文件路径，写入 `export VAR=...` 可以让后续 Bash 调用看到这些 env。 | **仅 `SessionStart` / `CwdChanged` / `FileChanged`** |
| `CLAUDE_CODE_REMOTE` | `"true"` when 运行在远端 web 环境；本地 CLI 里不设置。 | 所有 hook |

### 其他相关配置变量

- `CLAUDE_CODE_SESSIONEND_HOOKS_TIMEOUT_MS` — 覆盖 SessionEnd 总预算（默认 1.5s，上限 60s）
- `CLAUDE_CODE_DEBUG_LOG_LEVEL=verbose` — 输出 hook matcher 细节
- `CLAUDE_CODE_USE_POWERSHELL_TOOL` — Windows 下使用 PowerShell（hook 层可直接用 `shell: "powershell"` 字段，不依赖这个）

### 用户环境变量注入到 hook

`http` hook 的 `headers` 支持 `$VAR` / `${VAR}` 插值，但**必须**在 `allowedEnvVars` 里白名单，否则替换为空字符串。

---

## 8. Trellis trace plugin 设计要点速查

### Trace 所需的最小 hook 集（建议）

| Hook | 为什么需要 | 能拿到什么 |
|---|---|---|
| `SessionStart` (matcher: `startup\|resume\|clear\|compact`) | 创建 / 复用 trace 文件；记录 source | `session_id`, `transcript_path`, `cwd`, `source`, `model` |
| `UserPromptSubmit` | 捕获用户 prompt | `prompt`, `session_id`, `transcript_path` |
| `PostToolUse` (matcher: `Edit\|Write\|MultiEdit\|Bash\|.*`) | 捕获每次代码编辑 / 命令 | `tool_name`, `tool_input`, `tool_response`, `tool_use_id` |
| `Stop` | 捕获最后一条 assistant 响应 + turn 结束信号 | `last_assistant_message`, `stop_hook_active` |
| `SubagentStop` | 捕获 subagent turn 结束 | `agent_id`, `agent_type`, `agent_transcript_path`, `last_assistant_message` |
| `PostCompact` | 拿到压缩 summary（trace 里显式保留） | `compact_summary`, `trigger` |
| `SessionEnd` | 收尾 / flush | `reason` |

### 与 Cursor `agent-trace` 的直接对齐

- Cursor `afterFileEdit` / `afterTabFileEdit` ≈ Claude Code `PostToolUse` (matcher `Write\|Edit`)
- Cursor `afterShellExecution` ≈ Claude Code `PostToolUse` (matcher `Bash`)
- Cursor `sessionStart/End` ≈ Claude Code `SessionStart`/`SessionEnd`
- Cursor 云端对话 URL 对应的本地等价物：`transcript_path` 字段（file://... 形式）

### 重要陷阱

1. **`SessionStart` 只支持 command hook**，不能用 prompt/agent/http。trace plugin 如果跨平台，Claude 侧一定是 shell script。
2. **`PreToolUse` 示例里未显式列出 `tool_use_id`**，但 `PostToolUse` / `PermissionDenied` 都有 —— trace plugin 不要硬依赖 PreToolUse 的 `tool_use_id`（未完全确定，需要实测）。
3. **`SessionEnd` 默认 timeout 只有 1.5s** —— trace plugin 的 flush 逻辑要快，或显式设 `timeout` 字段。
4. **Hook context 注入有 10KB 上限** —— 如果 trace plugin 要用 `additionalContext` 反向注入（例如提醒之前的对话），超过就会被替换成文件路径。
5. **`continue: false` 具有最高优先级** —— trace plugin 的 JSON 输出里**绝对不要**误返回这个字段，会停掉 Claude。
6. **Plugin hooks 与用户/项目 hooks 并行执行**（不是替换），不会互相覆盖。Trellis plugin 的 hooks 可以和用户自己配置的 hooks 共存。

---

## Caveats / 未确定项

- **`tool_response` 的完整字段表**：官方文档只在 `Write` 的示例里给了 `{filePath, success}`。其他工具（Bash / Edit / Read / Grep / WebFetch / MCP）的 response schema 没有在 Hooks reference 里全部枚举。建议：trace plugin 整体透传 `tool_response`，不做强类型校验。
- **PreToolUse 的 `tool_use_id`**：官方文档在 PreToolUse 部分未显式列出此字段，但 PostToolUse / PermissionDenied 都列出了。实际是否传入 PreToolUse 未验证；若 trace 需要在 pre 阶段记录一个占位，应实际起一次 hook 采样 stdin。
- **Transcript 文件 rotation**：Claude Code 对 JSONL 是**追加**模式。没有文档说明的 rotation / cleanup 行为；issue #20612（anthropics/claude-code）曾报告过 transcript 未写入的 bug。Trellis trace plugin 如果依赖 transcript，应对"文件可能暂时缺失"容错。
- **`subagents/` 目录路径**：ccrider 的 schema 文档写的是 `agent-<shortId>.jsonl` 在项目根下，但本机实测是 `<sessionId>/subagents/agent-....jsonl` 嵌套。**以 SubagentStop hook 传入的 `agent_transcript_path` 为准**，不要手动拼接。
- **`permission-mode` 行**：ccrider schema 文档没有列，但实测日志里存在（`{type: "permission-mode", permissionMode, sessionId}`）。trace plugin 解析 transcript 时要对未知 `type` 值**宽松处理**（跳过而非报错）。
- **项目路径归一化的边界情况**：`.claude` / `.cache` 这类 dot 开头的路径段看起来会产生连续 `-`。官方文档没有声明归一化算法，以 hook 传入的 `transcript_path` 为准，不要自己算。
- **版本演进**：hook 事件表本身正在扩张（agent-team 相关如 `TaskCreated` / `TeammateIdle` 是较新加入）。`defer` 需 v2.1.89+。trace plugin 应对未知 hook event **忽略而非 fail**。

---

## 本仓库现有 hook 配置参考

`.claude/settings.json`（项目级）目前配置了：

- `SessionStart` (matcher `startup`/`clear`/`compact`) → `python3 .claude/hooks/session-start.py`
- `PreToolUse` (matcher `Task`/`Agent`) → `python3 .claude/hooks/inject-subagent-context.py`
- `UserPromptSubmit` → `python3 .claude/hooks/inject-workflow-state.py`

这些脚本对应源文件（作为 plugin 设计的参考实现）：
- `.opencode/plugins/inject-subagent-context.js`
- `.opencode/plugins/inject-workflow-state.js`（OpenCode 侧）
- `.opencode/plugins/session-start.js`

Trellis trace plugin 要做的是 **新增一个 hook 链**（不是替换以上），因此需要和现有 hooks 并存（Claude Code 会按配置顺序执行所有匹配的 hook）。
