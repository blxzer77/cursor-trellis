# Sub Task: 更新 agents/hooks + 测试 + 文档

## 当前状态

### 已完成
- [x] ai-tools.ts 的 agentCapable/hasHooks flags 已更新（11 个 agent-capable，3 个 agent-less）
- [x] 各平台 hook + agent 格式调研完成（结果见下方）
- [x] Qoder 的 hooks/agents/settings.json 模板文件已创建（matcher 已修正为 `Task`）
- [x] **全部 7 个新平台的 sub agent 工具名已确认**（见下方速查表）

### 进行中
- [ ] 7 个新平台的 hooks + agents 模板创建
- [ ] configurator 更新（让 init 写入 hooks + agents）
- [ ] workflow-draft.md 平台标记更新（从 4 个 → 11 个 agent-capable）

### 阻塞项
~~各平台 sub agent 工具名未确认~~ → **全部已确认，无阻塞**

## 平台分组

### Agent-capable（11 个）
Claude Code, iFlow, OpenCode, Codex, **Cursor, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid**（后 7 个新增）

### Agent-less（3 个）
Kilo, Antigravity, Windsurf

## 各平台 Hook + Agent 格式速查

### Group A — 和 Claude Code 格式几乎一样（改路径前缀就行）

**Qoder** ✅ 已确认
- Hooks: `.qoder/settings.json`，PascalCase 事件名，`command` handler
- Agents: `.qoder/agents/{name}.md`，MD + YAML frontmatter
- 环境变量前缀: `QODER_`
- **Sub agent 工具名: `Task`**（没有做 Claude Code 的 Task→Agent 重命名）
- 差异: 多了 `PostToolUseFailure`、`SubagentStart`、`PreCompact`、`Notification`、`PermissionRequest` 事件
- SubagentStart/SubagentStop matcher 用 agent 文件名（如 `"check"`）
- 来源: https://docs.qoder.com/extensions/hooks, https://docs.qoder.com/cli/hooks

**CodeBuddy** ✅ 已确认
- Hooks: `.codebuddy/settings.json`，PascalCase 事件名
- Agents: plugin 内 `agents/{name}.md`，MD + YAML frontmatter
- 环境变量前缀: `CODEBUDDY_`
- **Sub agent 工具名: `Task`**
- 事件: PreToolUse, PostToolUse, Notification, UserPromptSubmit, Stop, SubagentStop, PreCompact, SessionStart, SessionEnd
- **没有 SubagentStart 事件**（仅 SDK 层有）
- Sub-agent 不能嵌套 spawn
- 有 Fork 模式（省略 `subagent_type` 创建继承上下文的后台 agent）
- 来源: https://www.codebuddy.ai/docs/cli/sub-agents, https://www.codebuddy.ai/docs/cli/hooks

**Factory Droid** ✅ 已确认
- Hooks: `.factory/settings.json`，PascalCase 事件名
- Agents: `.factory/droids/{name}.md`，MD + YAML frontmatter（注意叫 "droids" 不叫 "agents"）
- 环境变量前缀: `FACTORY_`/`DROID_`
- **Sub agent 工具名: `Task`**
- 事件: PreToolUse, PostToolUse, Notification, UserPromptSubmit, Stop, SubagentStop, PreCompact, SessionStart, SessionEnd
- **已知 bug: PreToolUse exit code 2 无法 block Task 工具调用**——sub-agent 会无视 block 照常启动
- 工具名映射: `Execute` (非 Bash), `Create` (非 Write), `FetchUrl` (非 WebFetch), 其余相同
- 来源: https://docs.factory.ai/reference/hooks-reference, https://docs.factory.ai/cli/configuration/custom-droids

### Group B — 结构相似但细节不同

**Cursor** ✅ 已确认
- Hooks: `.cursor/hooks.json`（独立文件，不在 settings.json 里），**camelCase** 事件名
- Agents: `.cursor/agents/{name}.md`，MD + YAML frontmatter（`model`/`readonly`/`is_background` 字段）
- **Sub agent 工具名: `Task`**（和 Qoder 一样，没做 Task→Agent 重命名）
- 事件列表: `preToolUse`, `postToolUse`, `postToolUseFailure`, `subagentStart`, `subagentStop`, `beforeSubmitPrompt`, `stop`, `stopFailure`, `sessionStart`, `sessionEnd` 等 18+ 事件
- Hook 工具名用 Claude Code 风格（`Shell`/`Read`/`Write`/`Grep`/`Delete`/`Task`），不是 Cursor 内部名
- MCP 工具 matcher 支持 regex：`mcp__memory__.*`
- 内置 subagent: `explore`, `bash`, `browser`
- 来源: https://cursor.com/docs/hooks, Cursor Forum

**GitHub Copilot** ✅ 已确认（CLI 和 VS Code 有差异！）
- **Copilot CLI**:
  - Hooks: `.github/hooks/hooks.json`，camelCase 事件名
  - **Sub agent 工具名: `task`**（小写！）
  - 事件: sessionStart, sessionEnd, userPromptSubmitted, preToolUse, postToolUse, errorOccurred
  - **无 matcher 支持**——所有 preToolUse hooks 对每个工具调用都触发，需在脚本内解析 `toolName` 过滤
  - 区分 `bash`/`powershell` 双平台命令
  - **无 subagentStart/subagentStop 事件**
- **Copilot VS Code**:
  - Sub agent 工具名: `agent` / `runSubagent`
  - 事件 PascalCase: SessionStart, PreToolUse, SubagentStart, SubagentStop 等
  - **当前忽略 matcher 值**——hooks 对所有工具调用触发
- Agents: `.github/agents/{name}.agent.md`（注意 `.agent.md` 后缀！）
- 来源: https://docs.github.com/en/copilot/reference/hooks-configuration, https://code.visualstudio.com/docs/copilot/agents/subagents

**Gemini CLI** ✅ 已确认
- Hooks: `.gemini/settings.json`，事件名 `BeforeTool`/`AfterTool`（不是 PreToolUse/PostToolUse）
- Agents: `.gemini/agents/{name}.md`，MD + YAML frontmatter
- **Sub agent 工具名: 无统一 "Agent" 工具——每个 agent 注册为独立工具，工具名 = agent 的 `name` 字段**
- Matcher: **正则表达式**（不是精确匹配）
- 没有 `SubagentStop` 事件，需用 `AfterTool` + agent name regex 拦截
- 内置 agent: `codebase_investigator`, `cli_help`, `generalist`, `browser_agent`
- 还有 `activate_skill` 工具（Agent Skills 概念，和 sub-agent 不同）
- timeout 单位：毫秒（默认 60000）
- 完整事件列表: SessionStart, SessionEnd, BeforeAgent, AfterAgent, BeforeModel, AfterModel, BeforeToolSelection, BeforeTool, AfterTool, PreCompress, Notification
- 来源: https://geminicli.com/docs/hooks/, https://geminicli.com/docs/core/subagents/

### Group C — 架构不同

**Kiro CLI** ✅ 已确认
- Hooks: **嵌入 agent JSON 内**（不是全局配置）
- Agents: `.kiro/agents/{name}.json`，**纯 JSON**（不是 Markdown）
- **Sub agent 工具名: `subagent`**（别名 `use_subagent`）
- 还有异步版: `delegate`（后台运行）
- ~~不支持 sub-agent 嵌套 spawn~~ → v1.23.0 已支持 sub-agent（2025-12-18 更新）
- 工具名用内部名（`read`/`shell`/`write`/`glob`/`grep` 等）
- Sub-agent 访问控制: agent JSON 里 `toolsSettings.subagent` 配 `availableAgents`/`trustedAgents`
- 来源: https://kiro.dev/docs/cli/chat/subagents/, https://kiro.dev/docs/cli/reference/built-in-tools/

## 待写的模板文件清单

每个平台需要：
1. hooks 目录（Python 脚本——直接复制 Claude Code 的，内容一致）
2. agents 目录（需要适配格式）
3. settings/hooks 配置文件（平台特定格式）
4. configurator 更新（让 init 写入这些文件）
5. index.ts 更新（collectTemplates 包含 hooks + agents）

### 建议实施顺序
1. Group A（Qoder → CodeBuddy → Droid）——格式最接近，改前缀即可
2. Group B（Cursor → Copilot → Gemini）——需要适配事件名和配置格式
3. Group C（Kiro）——架构完全不同，最后做

## 文件位置

### 已创建（需要验证）
```
packages/cli/src/templates/qoder-new/
├── hooks/
│   ├── session-start.py
│   ├── inject-subagent-context.py
│   ├── ralph-loop.py
│   └── statusline.py
├── agents/
│   ├── check.md
│   ├── debug.md
│   ├── dispatch.md
│   ├── implement.md
│   ├── plan.md
│   └── research.md
└── settings.json
```

注意：`qoder-new/` 是临时目录名，最终需要和现有 qoder configurator 合并。

### Git 分支
`feat/v0.5.0-beta`

### 相关文件
- `packages/cli/src/types/ai-tools.ts` — flags 已更新
- `packages/cli/src/configurators/qoder.ts` — 需要更新，加入 hooks + agents 写入逻辑
- `.trellis/tasks/04-16-skill-first-refactor/prd.md` — 主 task PRD（已被 archive，需要重建或从 git 恢复）

## Sub Agent 工具名速查表（已确认）

| 平台 | Sub Agent 工具名 | PreToolUse 事件名 | Matcher 类型 | SubagentStop | 备注 |
|------|-----------------|-------------------|-------------|-------------|------|
| Claude Code | `Agent` (旧 `Task`) | `PreToolUse` | 精确匹配 | `SubagentStop` | 基准参考 |
| iFlow | `Agent` / `Task` | `PreToolUse` | 精确匹配 | `SubagentStop` | 同 Claude Code |
| Cursor | **`Task`** | `preToolUse` (camelCase) | 精确匹配 | `subagentStop` | 事件名全 camelCase |
| Qoder | **`Task`** | `PreToolUse` | 精确匹配 | `SubagentStop` | 格式几乎同 Claude Code |
| CodeBuddy | **`Task`** | `PreToolUse` | 精确匹配 | `SubagentStop` | 无 SubagentStart |
| Droid | **`Task`** | `PreToolUse` | 精确匹配 | `SubagentStop` | 工具名: Execute/Create/FetchUrl；**PreToolUse 无法 block Task（已知 bug）** |
| Copilot CLI | **`task`** (小写) | `preToolUse` (camelCase) | **无 matcher** | 无 | 需在脚本内解析 toolName 过滤 |
| Copilot VS Code | `agent`/`runSubagent` | `PreToolUse` | 当前忽略 matcher | `SubagentStop` | CLI 和 VS Code 行为不同 |
| Gemini CLI | **每个 agent 独立工具** | `BeforeTool` | **正则匹配** | 无（用 `AfterTool` + regex） | 工具名 = agent `name` 字段 |
| Kiro | **`subagent`** | 嵌入 agent JSON | 精确匹配 | 嵌入 agent JSON | 还有异步版 `delegate` |

## Qoder settings.json 修正

当前 `qoder-new/settings.json` 里同时有 `"Task"` 和 `"Agent"` 两个 PreToolUse matcher。
根据调研结果，Qoder 只有 `Task` 工具，**`"Agent"` matcher 应删除**。（已修正）

## Hook 执行方式与语言限制速查表

| 平台 | Hook 语言 | 执行方式 | I/O 格式 | 默认 Timeout | Python 可用 | 配置文件 |
|------|----------|---------|---------|-------------|------------|---------|
| Claude Code | 任意（shell cmd） | 子进程 | stdin JSON / stdout JSON / exit code | 10-30s | ✅ | `.claude/settings.json` |
| iFlow | 任意（shell cmd） | 子进程 | 同 Claude Code | 10-30s | ✅ | `.iflow/settings.json` |
| Cursor | 任意（shell cmd） | 子进程 | stdin JSON / stdout JSON | 30s | ✅ | `.cursor/hooks.json` |
| Qoder | 任意（shell cmd） | 子进程 | 同 Claude Code | 10-30s | ✅ | `.qoder/settings.json` |
| CodeBuddy | 任意（shell cmd） | 子进程 | 同 Claude Code | 10-30s | ✅ | `.codebuddy/settings.json` |
| Droid | 任意（shell cmd） | 子进程 | 同 Claude Code | 10-30s | ✅ | `.factory/settings.json` |
| Copilot CLI | **bash / powershell** | 子进程 | stdin JSON / stdout JSON | 30s | ✅ (via bash) | `.github/hooks/hooks.json` |
| Gemini CLI | 任意（shell cmd） | 子进程 | stdin JSON / stdout JSON | **60s (ms)** | ✅ | `.gemini/settings.json` |
| Kiro | 任意（shell cmd） | 子进程 | stdin JSON / exit code | **30s** | ✅ | 嵌入 agent JSON |
| Codex | 任意（shell cmd） | 子进程 | stdin JSON / stdout JSON | 600s | ✅ | `.codex/hooks.json` |
| **OpenCode** | **TypeScript/JS only** | **Bun 插件系统** | 函数调用（非子进程） | N/A | **❌ 不可用** | `.opencode/plugin/*.ts` |

### 关键发现

1. **OpenCode 是唯一不能用 Python hooks 的平台**
   - OpenCode 用的是 Bun 插件系统，hooks 必须是 TypeScript/JavaScript
   - 有第三方桥接插件 (`opencode-hooks-plugin`, `opencode-claude-hooks`) 可以读取 `.claude/settings.json` 并执行 shell commands
   - 但这不是 OpenCode 原生支持的，需要用户额外安装插件
   - 当前 `ai-tools.ts` 已标记 `hasHooks: false`，符合现状

2. **Codex hooks 默认关闭**
   - 需要在 `~/.codex/config.toml` 设置 `codex_hooks = true` 才能启用
   - 当前 `ai-tools.ts` 已标记 `hasHooks: false`，但实际支持（只是默认关）
   - PreToolUse/PostToolUse 目前仅支持 Bash 工具的 matcher

3. **Copilot CLI 无 matcher**
   - hooks.json 不支持 matcher 字段，所有 preToolUse hooks 对每个工具调用都触发
   - 需要在 hook 脚本内部解析 stdin JSON 的 `toolName` 字段来过滤
   - 配置用 `bash`/`powershell` 两个字段区分平台

4. **Gemini CLI timeout 单位是毫秒**
   - 默认 60000ms = 60s，比其他平台长
   - 所有 stdout 必须是纯 JSON，不能输出任何非 JSON 文本

5. **Kiro hooks 嵌入 agent JSON**
   - 不是全局配置，每个 agent 可以有不同的 hooks
   - 支持 `cache_ttl_seconds` 缓存（避免重复执行）
   - 支持 `max_output_size` 限制输出大小

### 对 Trellis 的影响

- **可以直接复用 Python hooks 的平台**: Claude Code, iFlow, Cursor, Qoder, CodeBuddy, Droid, Copilot, Gemini, Kiro, Codex（10 个）
- **不能用 Python hooks 的平台**: OpenCode（需要 TS 插件或第三方桥接）
- **不需要 hooks 的平台**: Kilo, Antigravity, Windsurf（agent-less，无 hook 系统）
