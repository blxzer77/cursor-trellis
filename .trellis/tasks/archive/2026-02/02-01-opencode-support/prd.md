# OpenCode 平台集成支持

## 背景

Trellis 目前深度绑定 Claude Code，高级功能（Hooks、Multi-Session）仅在 Claude Code 下可用。为扩大用户群，需要支持 OpenCode（开源 AI Coding CLI，45k+ GitHub stars）。

## 目标

让 Trellis 的核心功能在 OpenCode 环境下可用，实现"一套 Trellis，多平台运行"。

## 实现进度（2026-02-02 更新）

| Phase | 状态 | 描述 |
|-------|------|------|
| Phase 1 | ✅ 完成 | CLI Adapter - `.trellis/scripts/common/cli_adapter.py` |
| Phase 2 | ⏳ 待开始 | Multi-Session 脚本适配 (start.py, plan.py, status.py) |
| Phase 3 | ✅ 完成 | Plugins - session-start.js, inject-subagent-context.js |
| Phase 4 | ✅ 完成 | Agent 定义 - `.opencode/agents/*.md` |
| Phase 5 | ✅ 完成 | Commands 迁移 - `.opencode/commands/trellis/` |
| Phase 6 | ⏳ 待开始 | Init 流程适配 |
| Phase 7 | ⏳ 待开始 | 日志解析适配 |

**当前支持矩阵**：

| 场景 | Session Start | Subagent 上下文 |
|------|--------------|----------------|
| OpenCode + omo | ✅ 自动注入 | ✅ 自动注入 |
| 纯 OpenCode | ✅ plugin 处理 | ⚠️ Self-Loading 降级 |

## 研究结论

### 已确认兼容

| Trellis 功能 | OpenCode 对应 | 状态 |
|-------------|--------------|------|
| `.trellis/scripts/` 核心脚本 | 直接可用 | ✅ 无需改动 |
| `.trellis/workspace/`, `tasks/`, `spec/` | 纯文件系统 | ✅ 无需改动 |
| 非交互式 CLI | `opencode run` | ✅ 完全对应 |
| Agent 加载 | `--agent` flag | ✅ 完全对应 |
| 会话管理 | `--session` / `--continue` | ✅ 完全对应 |
| 跳过权限 | `--yolo` / `--dangerously-skip-permissions` | ✅ 完全对应 |
| JSON 输出 | `--format json` | ✅ 完全对应 |
| **Task 工具 (Subagent)** | Task tool + `mode: "subagent"` | ✅ 完全对应 |
| **Verbose 日志** | `--log-level DEBUG --print-logs` | ✅ 完全对应 |

### 需要适配

| 功能 | 工作量 | 优先级 |
|-----|-------|-------|
| CLI adapter（参数映射） | 低 | P0 |
| Hooks → Plugins（Python → JS） | 中 | P1 |
| Agent 定义格式转换 | 中 | P1 |
| Agent 命名冲突（plan → trellis-plan） | 低 | P1 |
| Dispatch Agent 两个版本 | 中 | P1 |
| status.py 恢复命令适配 | 低 | P1 |
| Multi-Session 脚本适配 | 低 | P2 |

## 实现方案

### Phase 1: CLI Adapter (P0)

创建 `.trellis/scripts/common/cli_adapter.py`：

```python
def get_ai_cli_command(platform: str, agent: str, session_id: str, prompt: str) -> list:
    if platform == "claude":
        return ["claude", "-p", "--agent", agent, "--session-id", session_id, ...]
    elif platform == "opencode":
        return ["opencode", "run", "--agent", agent, "--session", session_id, ...]
```

修改 `multi_agent/start.py` 和 `plan.py` 使用 adapter。

### Phase 2: Session Start Plugin (P1) ✅ 已完成

创建 `.opencode/plugin/session-start.js`（注意是 `plugin` 单数）：

**关键发现**：OpenCode 的 `event` hook 无法注入上下文（没有 `output` 参数）。
必须使用 `experimental.chat.system.transform` hook：

```javascript
export const TrellisSession = async ({ $, directory }) => {
  let contextInjected = false

  return {
    "experimental.chat.system.transform": async ({ system }) => {
      if (contextInjected) return { system }

      // 检测 multi-agent 模式，跳过注入
      const nonInteractive = await $`echo $OPENCODE_NON_INTERACTIVE`.text()
      if (nonInteractive.trim() === "1") {
        contextInjected = true
        return { system }
      }

      // 构建并注入上下文
      const context = buildContext(directory)
      contextInjected = true
      return { system: system + "\n\n" + context }
    }
  }
}
```

**OpenCode Plugin 注册机制**：
- 插件自动从 `.opencode/plugin/` 目录加载
- **不需要**在 `opencode.json` 中配置 `plugins` 键（会报错）
- 参考：https://github.com/frap129/opencode-rules

### Phase 3: Context Injection Plugin (P1) ✅ 已完成

创建 `.opencode/plugin/inject-subagent-context.js`：

```javascript
export const TrellisInjectSubagentContext = async ({ $, directory }) => ({
  "tool.execute.before": async ({ tool, input }) => {
    if (tool !== "Task") return { input }

    // 读取 .current-task，获取 JSONL 路径
    const currentTask = readFile(`${directory}/.trellis/.current-task`)
    const jsonlPath = /* 从 current-task 构建路径 */

    // 读取 JSONL 最后 N 条消息
    const context = extractRecentMessages(jsonlPath)

    // 更新 phase 追踪
    updateCurrentPhase(input.args.subagent_type, directory)

    // 注入上下文到 prompt
    return {
      input: {
        ...input,
        args: {
          ...input.args,
          prompt: input.args.prompt + "\n\n" + context
        }
      }
    }
  }
})
```

### Phase 4: Agent 定义转换 (P1) ✅ 已完成

**更正**：OpenCode 使用 `.opencode/agents/*.md` 格式（与 Claude Code 相同），**不是** `opencode.json` 配置。

```bash
# 直接复制 agent 定义
cp -r .claude/agents/ .opencode/agents/

# 重命名有冲突的 agent
mv .opencode/agents/plan.md .opencode/agents/trellis-plan.md
```

已完成复制，但需要注意 `plan` → `trellis-plan` 的命名差异。

### Phase 5: Ralph Loop 替代方案 (P2)

OpenCode 没有 SubagentStop hook，需要用 `session.idle` 或其他机制实现质量验证循环。

## 验收标准

- [ ] `opencode run --agent implement` 能正确注入上下文
- [ ] `opencode run --agent check` 能正确执行检查
- [ ] Multi-Session 脚本能在 OpenCode 下启动 agent
- [ ] Session Start 能注入 workflow 和 guidelines

## 技术约束

1. OpenCode 原生 Plugins 只支持 JavaScript/TypeScript，不支持 Python
2. Plugin 可以通过 shell 调用 Python 脚本（`$\`python3 ...\``）
3. OpenCode 没有 SubagentStop hook，Ralph Loop 需要变通
4. **oh-my-opencode 提供 Claude Code 兼容层**（见下方重大发现）

---

## 🔥 重大发现：oh-my-opencode 兼容层

**发现时间**：2026-02-01

### 发现过程

测试 `OPENCODE_NON_INTERACTIVE=1` 环境变量时，发现即使 `.opencode/plugin/session-start.js` 正确跳过注入（debug 显示 `willInject: false`），上下文仍然被注入。

经排查发现：
1. 禁用 `.opencode/plugin/session-start.js` → 上下文仍被注入
2. 禁用 `AGENTS.md` → 上下文仍被注入
3. 禁用 `oh-my-opencode` → 上下文仍被注入
4. **禁用 `.claude/hooks/` → 上下文消失！**

### 结论

**oh-my-opencode** 插件会自动加载并执行 `.claude/hooks/` 目录下的 Python hooks：

```
Hook Loader: src/hooks/claude-code-hooks/
支持的 hook 类型: PreToolUse, PostToolUse, UserPromptSubmit, Stop, SessionStart
```

来源：https://deepwiki.com/fractalmind-ai/oh-my-opencode/8.1-claude-code-compatibility

### 对 Trellis 的影响

| 场景 | 方案 |
|------|------|
| 用户有 oh-my-opencode | `.claude/hooks/` 自动生效，无需额外配置 |
| 用户没有 oh-my-opencode | 需要 `.opencode/plugin/*.js` 或建议安装 oh-my-opencode |

### 已完成的适配

```python
# .claude/hooks/session-start.py
def should_skip_injection() -> bool:
    return (
        os.environ.get("CLAUDE_NON_INTERACTIVE") == "1"
        or os.environ.get("OPENCODE_NON_INTERACTIVE") == "1"  # 新增
    )
```

这使得同一个 hook 文件同时支持 Claude Code 和 OpenCode（通过 oh-my-opencode）。

---

## 设计决策

### 1. 平台检测机制

**决策**：调用时通过 flag 显式指定平台

```bash
python3 .trellis/scripts/multi_agent/start.py .trellis/tasks/xxx --platform opencode
```

**理由**：最清晰，避免自动检测的复杂性和误判

### 2. Agent 定义处理

**更正**：OpenCode 也使用 `.md` 文件格式，可以直接复制

- Claude Code: `.claude/agents/*.md`
- OpenCode: `.opencode/agents/*.md`（格式相同）

**决策**：直接复制 agent 文件，只需处理命名冲突（`plan` → `trellis-plan`）

### 2.1 Agent 命名冲突

**研究结论**：OpenCode 有内置 agent，**无法被同名自定义 agent 覆盖**

**OpenCode 内置 agent 完整列表**：

| 类型 | Agent | 用途 | Trellis 冲突 |
|------|-------|------|-------------|
| Primary | `build` | 默认，完整权限开发 | ✓ 无冲突 |
| Primary | `plan` | 只读，分析和规划 | ⚠️ **冲突** |
| Subagent | `general` | 复杂搜索和多步任务 | ✓ 无冲突 |
| Subagent | `explore` | 代码库探索 | ✓ 无冲突 |
| Internal | `title` | 自动生成会话标题 | ✓ 无冲突 |
| Internal | `summary` | 生成消息摘要 | ✓ 无冲突 |
| Internal | `compaction` | 压缩上下文 | ✓ 无冲突 |

**OpenCode 内置命令**（可以被覆盖）：
- `/init`, `/undo`, `/redo`, `/share`, `/help`
- Trellis 命令使用 `/trellis:` 或 `/project:trellis:` 前缀，无冲突

**OpenCode 内置工具**（14 个，与 Trellis 无关）：
- `bash`, `edit`, `write`, `read`, `grep`, `glob`, `list`, `lsp`, `patch`, `skill`, `todowrite`, `todoread`, `webfetch`, `question`

**已知限制**：[GitHub Issue #4271](https://github.com/sst/opencode/issues/4271) - 无法覆盖内置 "build" 和 "plan" agent

**解决方案**：Trellis 在 OpenCode 下使用不同的 agent 名称

| Trellis Agent | Claude Code | OpenCode |
|---------------|-------------|----------|
| plan | `plan` | `trellis-plan` |
| dispatch | `dispatch` | `dispatch` |
| implement | `implement` | `implement` |
| check | `check` | `check` |
| research | `research` | `research` |
| debug | `debug` | `debug` |

**适配方案**：CLI adapter 根据平台自动映射 agent 名称

```python
def get_agent_name(agent: str, platform: str) -> str:
    if platform == "opencode" and agent == "plan":
        return "trellis-plan"
    return agent
```

### 3. Commands 迁移

**研究结论**：OpenCode 有类似的 commands 机制，格式高度兼容

| 特性 | Claude Code | OpenCode |
|-----|-------------|----------|
| 文件位置 | `.claude/commands/` | `.opencode/commands/` |
| 文件格式 | Markdown + YAML frontmatter | Markdown + YAML frontmatter |
| 命名规则 | `trellis/start.md` → `/trellis:start` | `start.md` → `/start` |
| 参数支持 | `$ARGUMENTS` | `$ARGUMENTS`, `$1`, `$2` (更强) |
| 指定 Agent | 不支持 | `agent: xxx` (更强) |
| 子任务模式 | 不支持 | `subtask: true` (更强) |

**迁移方案**：使用子目录结构

```
.claude/commands/trellis/start.md      →  /trellis:start
    ↓
.opencode/commands/trellis/start.md    →  /project:trellis:start
```

**注意**：OpenCode 命令会多 `project:` 前缀

### 4. Python 环境依赖

**决策**：假设目标用户都有 Python 环境

**理由**：开发者机器基本都有 Python，文档说明即可，无需纯 JS 版本

### 5. MCP Server 配置

**决策**：各平台各自配置，Trellis 不做统一处理

- Claude Code → `.claude/settings.json` 的 `mcpServers`
- OpenCode → `opencode.json` 的 `mcp`

**理由**：与 Agent 定义同理，各管各的

### 6. 平台信息记录

**决策**：在 `registry.json` 的 agent 记录中添加 `platform` 字段

```json
{
  "agents": [
    {
      "id": "feature-add-login",
      "platform": "opencode",
      "pid": 12345,
      "worktree_path": "...",
      ...
    }
  ]
}
```

**理由**：
- Registry 本来就是记录 agent 运行状态的
- `status.py` 已经在读 registry，顺手读 platform
- 不同 agent 可以用不同平台（灵活）

### 7. 日志格式适配

**研究结论**：两平台 JSON 输出格式不同，需要适配

**Claude Code** (`--output-format stream-json`):
```json
{
  "type": "assistant",
  "message": {
    "content": [
      {"type": "text", "text": "..."},
      {"type": "tool_use", "name": "Read"}
    ]
  }
}
```

**OpenCode** (`--format json`):
```json
// tool_use 事件
{"type": "tool_use", "tool": "bash", "state": {"status": "completed"}, ...}

// text 事件
{"type": "text", "text": "actual content", ...}
```

**适配方案**：`status.py` 的解析函数根据 `registry.json` 中的 `platform` 字段判断格式

```python
def get_last_tool(log_file: Path, platform: str) -> str | None:
    if platform == "opencode":
        # 找 type: "tool_use", 读 data["tool"]
    else:  # claude (默认)
        # 找 type: "assistant", 读 data["message"]["content"][*]["name"]
```

### 8. 错误处理与会话恢复

**研究结论**：两平台在错误处理上差异较大

| 场景 | Claude Code | OpenCode | 差异 |
|-----|-------------|----------|------|
| Rate limit | 中断，需手动 resume | 中断，需手动 resume | 类似 |
| 会话恢复 | `--resume <id>` | `--session <id>` 或 `--continue` | 类似 |
| 内置 retry | 有 | **没有** | ⚠️ OpenCode 弱 |
| API 错误退出 | 正常退出 | **可能挂住不退出** | ⚠️ 已知 bug |

**已知问题**：
- [OpenCode Issue #8203](https://github.com/anomalyco/opencode/issues/8203) - `opencode run` 遇到 API 错误可能挂住不退出
- [OpenCode Issue #3011](https://github.com/sst/opencode/issues/3011) - 没有内置 retry 机制

**应对方案**：
1. `start.py` 启动 OpenCode 时加超时检测，防止进程挂住
2. 错误恢复流程与 Claude Code 类似，都用 session 恢复
3. 文档说明 OpenCode 的已知限制

### 9. Model 配置

**决策**：使用 OpenCode 默认配置，脚本不传 `--model`

**OpenCode Model 配置机制**：
- 全局默认：`opencode.json` 的 `"model": "provider/model-id"`
- Agent 级别：agent 配置里的 `"model"` 可覆盖全局
- Subagent 继承：未指定时继承 primary agent 的 model

**配置示例**：
```json
// opencode.json
{
  "model": "anthropic/claude-sonnet-4-5",
  "agent": {
    "implement": {
      "model": "anthropic/claude-sonnet-4-5"  // 可选覆盖
    }
  }
}
```

**理由**：用户自己配好 model，脚本无需关心，保持简单

### 10. Tool 权限控制

**决策**：保持与 Claude Code 一致，靠 prompt 约束，不用配置级别限制

**现状分析**：
- Claude Code agent 定义用 `tools` 字段做白名单
- 但 `Bash` 在白名单里，理论上能跑 `git commit`
- 禁止 git commit 纯靠 prompt 里的 "Forbidden Operations"

**OpenCode 方案**：
- Agent 配置里不做 tool 限制
- 在 agent prompt 里写明禁止操作（与 Claude Code 一致）

**理由**：两平台行为一致，维护简单

### 11. 安装和初始化流程

**决策**：在现有 `trellis init` 流程中增加 OpenCode 平台选项

**现状**：`trellis init` 已支持选择平台（Cursor / Claude Code）

**改动**：
- 增加 OpenCode 选项
- 选择 OpenCode 时自动生成：
  - `.opencode/plugins/` 下的 Trellis plugin 文件
  - `.opencode/commands/` 下的 command 文件
  - `opencode.json` 基础配置模板

**理由**：复用现有流程，用户体验一致

### 12. 环境变量传递

**研究结论**：

| 环境变量 | Claude Code | OpenCode | 处理方式 |
|---------|-------------|----------|---------|
| 代理 | `https_proxy` | `HTTPS_PROXY` | 通用，直接传 |
| 非交互标识 | `CLAUDE_NON_INTERACTIVE=1` | `OPENCODE_NON_INTERACTIVE=1` | 各平台各自设置 |
| 配置文件 | `CLAUDE_PROJECT_DIR` | `OPENCODE_CONFIG` | 平台各自处理 |

**⚠️ 重要：Non-Interactive 环境变量**

Multi-Agent Pipeline 脚本（start.py, plan.py）需要设置非交互标识，防止 session-start hook 重复注入上下文：

```python
# start.py / plan.py
if platform == "claude":
    env["CLAUDE_NON_INTERACTIVE"] = "1"
elif platform == "opencode":
    env["OPENCODE_NON_INTERACTIVE"] = "1"
```

**所有 session-start 相关代码必须检测两个变量**：

| 文件 | 检测逻辑 |
|------|---------|
| `.claude/hooks/session-start.py` | `CLAUDE_NON_INTERACTIVE` 或 `OPENCODE_NON_INTERACTIVE` |
| `.opencode/plugin/session-start.js` | `OPENCODE_NON_INTERACTIVE` |

**inject-subagent-context 不需要检测**：subagent 始终需要上下文注入，即使在非交互模式下。

**适配方案**：
- 代理变量通用，直接传递
- 非交互标识：各平台设置对应的环境变量
- OpenCode 的 `opencode run` 本身就是非交互模式，但仍需设置环境变量让 hook 知道

### 13. Working Directory 处理

**研究结论**：`opencode run` 没有 `--cwd` 或 `--dir` 参数

**处理方式**：通过 subprocess 的 `cwd` 参数设置工作目录

```python
subprocess.Popen(opencode_cmd, cwd=worktree_path, ...)
```

**结论**：当前 `start.py` 的实现方式对 OpenCode 同样有效，无需额外处理

### 14. Session ID 处理

**研究结论**：两平台机制不同

| 平台 | 创建时指定 ID | 恢复会话 | ID 格式 |
|-----|-------------|---------|--------|
| Claude Code | `--session-id <uuid>` | `--resume <id>` | UUID |
| OpenCode | 可能不支持 | `--session <id>` | `ses_xxx` |

**问题**：OpenCode 可能不支持在创建时指定自定义 session ID（[Issue #2159](https://github.com/sst/opencode/issues/2159)）

**适配方案**：
1. OpenCode 分支不传 `--session-id`，让 OpenCode 自动生成
2. 启动后从日志或 API 获取实际的 session ID
3. 保存到 `.session-id` 文件供后续恢复使用

**待验证**：需要实际测试确认 OpenCode 行为

### 15. 测试验证

**决策**：手动测试

**验证方式**：在真实项目里跑一遍 Multi-Agent Pipeline，验证各环节正常工作

### 16. Ralph Loop 状态文件

**研究结论**：Ralph Loop 使用 `.trellis/.ralph-state.json` 追踪迭代状态

```json
{
  "task": ".trellis/tasks/01-31-add-login",
  "iteration": 2,
  "started_at": "2026-01-31T10:30:00"
}
```

**常量**：
- `MAX_ITERATIONS = 5` - 最大循环次数
- `STATE_TIMEOUT_MINUTES = 30` - 状态文件超时
- `COMMAND_TIMEOUT = 120s` - 单个验证命令超时

**OpenCode 适配**：
- 状态文件是纯文件系统操作，无需改动
- OpenCode plugin 需要读取 `worktree.yaml` 的 `verify` 配置
- ✅ OpenCode 有 `stop` hook 可以拦截 agent 停止（见决策 #27）

### 17. Subagent 上下文注入 (PreToolUse:Task)

**研究结论**：这是最关键的 hook，负责向 subagent 注入 JSONL 上下文

**Claude Code 流程**：
```
Task(subagent_type="implement") 调用
    ↓
PreToolUse:Task hook 触发
    ↓
inject-subagent-context.py 执行
    ↓
读取 .trellis/.current-task → 找到任务目录
    ↓
加载 implement.jsonl → 读取每个文件内容
    ↓
构建增强 prompt → 返回 updatedInput
```

**✅ 已验证**：OpenCode 有完全相同的 Task 工具机制！

**OpenCode Subagent 机制**：
- OpenCode 有 Task tool，用于 primary agent 调用 subagent
- Subagent 配置在 `opencode.json` 的 `agent` 字段，设置 `mode: "subagent"`
- 调用方式：Task tool 或 `@agent-name` 提及
- 每个 subagent 有独立的 context window，可用不同 model

**Subagent 配置示例**：
```json
{
  "agent": {
    "implement": {
      "mode": "subagent",
      "description": "Writes code following specs",
      "tools": ["read", "write", "edit", "bash", "glob", "grep"],
      "model": "anthropic/claude-sonnet-4-5"
    }
  }
}
```

**权限控制 (permission.task)**：
```json
{
  "permission": {
    "task": {
      "*": "deny",
      "implement": "allow",
      "check": "allow"
    }
  }
}
```

**OpenCode 适配方案**：
1. 使用 `tool.execute.before` 事件，匹配 `Task` 工具
2. 从 input 读取 subagent 类型
3. 读取对应的 JSONL 文件
4. 修改 input.prompt 注入上下文

### 18. Plugin 可用的环境变量

**研究结论**：Claude Code hooks 有特定环境变量

| 变量 | Claude Code | 用途 |
|-----|-------------|------|
| `CLAUDE_PROJECT_DIR` | ✅ | 项目根目录 |
| `HOOK_EVENT` | ✅ | 事件类型 |
| `TOOL_NAME` | ✅ | 被调用的工具名 |
| `TOOL_INPUT` | ✅ | 工具输入 JSON |
| `SUBAGENT_TYPE` | ✅ | subagent 类型 |

**OpenCode 适配**：
- Plugin 函数参数 `{ $, directory }` 提供基础信息
- `directory` 对应项目目录
- 需要从事件 `input` 参数获取工具信息

### 19. Verbose 输出

**✅ 已验证**：

| 平台 | 参数 | 用途 |
|-----|------|-----|
| Claude Code | `--verbose` | 输出详细日志 |
| OpenCode | `--log-level DEBUG` | 设置日志级别 |
| OpenCode | `--print-logs` | 输出日志到 stderr |

**OpenCode 日志级别**：`DEBUG`, `INFO`, `WARN`, `ERROR`

**适配方案**：
```python
if platform == "opencode":
    cmd.extend(["--log-level", "DEBUG", "--print-logs"])
else:  # claude
    cmd.append("--verbose")
```

### 20. 完成标记 (Completion Markers)

**研究结论**：Ralph Loop 的 fallback 机制使用完成标记

```
TYPECHECK_FINISH
LINT_FINISH
CODEREVIEW_FINISH
```

**工作原理**：
1. 如果 `worktree.yaml` 没有 `verify` 配置
2. Ralph Loop 从 `check.jsonl` 读取 reason 字段
3. 生成预期标记：`{REASON}_FINISH`
4. 检查 agent 输出是否包含所有标记

**OpenCode 适配**：纯文本检测，agent prompt 里写明要输出标记即可，无平台依赖

### 21. Session 恢复命令差异

**详细对比**：

| 操作 | Claude Code | OpenCode |
|-----|-------------|----------|
| 新建会话 | `claude -p --session-id <uuid>` | `opencode run` (自动生成) |
| 恢复会话 | `claude --resume <id>` | `opencode run --session <id>` 或 `--continue` |
| 查看会话 | N/A | `opencode sessions` |

**`--continue` vs `--session`**：
- `--continue` 恢复最近的会话
- `--session <id>` 恢复指定会话

**适配方案**：
- 新建时保存 OpenCode 返回的 session ID 到 `.session-id`
- 恢复时使用 `--session <id>`
- 避免使用 `--continue`（可能恢复错误的会话）

### 22. worktree.yaml 在 Plugin 中的使用

**研究结论**：`worktree.yaml` 包含重要配置

```yaml
worktree_dir: ../worktrees
copy:
  - .trellis/.developer
  - .env
post_create:
  - npm install
verify:
  - pnpm lint
  - pnpm typecheck
```

**OpenCode Plugin 需要**：
1. 读取 `verify` 配置执行验证（Ralph Loop 替代方案）
2. 可能需要读取其他配置

**实现方式**：Plugin 里用 `$` 调用 Python 脚本解析 YAML

### 23. status.py 恢复命令输出

**问题**：`status.py` 硬编码了 Claude Code 的恢复命令：

```python
print(f"cd {worktree} && claude --resume {session_id}")
```

**需要适配**：根据 `registry.json` 中的 `platform` 字段输出不同命令

```python
if platform == "opencode":
    print(f"cd {worktree} && opencode run --session {session_id}")
else:
    print(f"cd {worktree} && claude --resume {session_id}")
```

### 24. Agent 定义路径

**问题**：`plan.py` 和 `start.py` 硬编码了 agent 路径：

```python
PLAN_MD_PATH = ".claude/agents/plan.md"
DISPATCH_MD_PATH = ".claude/agents/dispatch.md"
```

**OpenCode 适配**：
- OpenCode agent 定义在 `opencode.json` 或 `.opencode/agent/*.md`
- 需要根据平台检查不同路径

**决策**：各平台各自验证 agent 存在，不做统一处理

### 25. 环境变量传递给 Agent

**问题**：`plan.py` 通过环境变量传递参数：

```python
env["PLAN_TASK_NAME"] = task_name
env["PLAN_DEV_TYPE"] = dev_type
env["PLAN_TASK_DIR"] = task_dir
env["PLAN_REQUIREMENT"] = requirement
```

**研究结论**：OpenCode plugin 可以通过 `$` 调用 shell 访问环境变量

**适配方案**：
- 环境变量传递方式两平台通用
- Agent prompt 中可以引导 agent 读取环境变量
- 或者直接在 prompt 中包含参数（更可靠）

### 26. 跳过权限确认

**✅ 已验证**：OpenCode 已支持 `--yolo` / `--dangerously-skip-permissions`

| 平台 | 方式 |
|-----|------|
| Claude Code | `--dangerously-skip-permissions` |
| OpenCode | `--yolo` 或 `--dangerously-skip-permissions` |
| OpenCode | 环境变量 `OPENCODE_YOLO=true` |
| OpenCode | 配置 `"yolo": true` |

**参考**：[GitHub Issue #8463](https://github.com/anomalyco/opencode/issues/8463) - 已在 PR #9073 中实现

**适配方案**：
```python
if platform == "opencode":
    cmd.append("--yolo")
else:
    cmd.append("--dangerously-skip-permissions")
```

### 27. Ralph Loop 的 Stop Hook

**✅ 已验证**：OpenCode 有 `stop` hook 可以拦截 agent 停止

**Claude Code**：`SubagentStop` hook
**OpenCode**：`stop` hook

**OpenCode stop hook 示例**：
```javascript
export const RalphLoop = async ({ $, directory }) => ({
  "stop": async (input, output) => {
    // 运行 verify 命令
    const result = await $`python3 ${directory}/.trellis/scripts/verify.py`
    if (result.exitCode !== 0) {
      output.block = true
      output.message = "Verification failed, please fix issues"
    }
  }
})
```

**注意**：需要确认 `stop` hook 是否能区分不同的 subagent 类型

### 28. Dispatch Agent 需要两个版本

**问题**：`dispatch.md` 中使用了 Claude Code 特有的 Task 调用语法

**决策**：维护两个版本
- Claude Code: `.claude/agents/dispatch.md`
- OpenCode: `.opencode/agent/dispatch.md` 或 `opencode.json` 中配置

**差异点**：
- Task 工具参数格式可能不同
- TaskOutput 轮询机制需要验证
- model 参数指定方式不同

### 29. Agent Mode 分类（Primary vs Subagent）

**研究结论**：根据 agent 的启动方式决定 OpenCode 中的 `mode` 配置

**分析过程**：

1. **入口 Agents（通过 `claude -p --agent` 启动）**
   - `dispatch` — 由 `start.py` 启动，是 Multi-Agent Pipeline 的入口
   - `plan` — 由 `plan.py` 启动，是规划阶段的入口

2. **真正的 Subagents（通过 Task() 工具调用）**
   - `research` — 被 plan agent 和 /trellis:start 调用
   - `implement` — 被 dispatch agent 和 /trellis:start 调用
   - `check` — 被 dispatch agent 和 /trellis:start 调用
   - `debug` — 被 dispatch agent 调用

**调用关系图**：
```
plan.py → plan/trellis-plan (primary)
    └── Task(research)

start.py → dispatch (primary)
    ├── Task(implement)
    ├── Task(check)
    ├── Task(debug)
    └── Bash(create_pr.py)
```

**OpenCode 配置决策**：

| Agent | Claude Code | OpenCode mode | 理由 |
|-------|-------------|---------------|------|
| dispatch | agent | **primary** | 被 CLI 直接启动 |
| plan | agent | **primary** (名为 `trellis-plan`) | 被 CLI 直接启动 |
| implement | agent | subagent | 被 Task() 调用 |
| check | agent | subagent | 被 Task() 调用 |
| research | agent | subagent | 被 Task() 调用 |
| debug | agent | subagent | 被 Task() 调用 |

**使用方式差异**：

| Mode | 启动方式 | 适用场景 |
|------|---------|---------|
| primary | `opencode --agent xxx` / Tab 切换 | 用户直接交互的入口 |
| subagent | `@xxx` 提及 / Task() 调用 | 被其他 agent 调用 |

**配置示例**（`.opencode/agents/dispatch.md`）：
```yaml
---
description: Multi-Agent Pipeline main dispatcher
mode: primary
model: claude-max/claude-opus-4
tools:
  read: true
  bash: true
  task: true
---
```

### 30. Plugin 中的 Phase 追踪

**问题**：Python hook `inject-subagent-context.py` 有 `update_current_phase()` 函数（93-147行），在调用 subagent 时自动更新 `task.json` 的 `current_phase` 字段。

**✅ 已完成**：已在 `inject-subagent-context.js` 中添加 `updateCurrentPhase()` 函数，逻辑与 Python 版本一致：
- 读取 `task.json` 的 `next_action` 数组
- 找到下一个匹配 subagent 类型的 phase
- 只向前移动，不后退
- debug/research 不更新 phase

### 31. Session ID 提取（OpenCode 特有）

**问题**：`start.py` 在启动前生成 UUID 并传给 Claude Code：
```python
session_id = str(uuid.uuid4()).lower()
claude_cmd.extend(["--session-id", session_id])
```

OpenCode 不支持创建时指定 session ID。

**解决方案**：
1. OpenCode 分支不传 `--session-id`
2. 启动后从日志解析 session ID（格式如 `ses_xxx`）
3. 保存到 `.session-id` 文件

**实现方式**：
```python
if platform == "opencode":
    # 启动后等待几秒，从日志提取 session ID
    time.sleep(2)
    session_id = extract_session_id_from_log(log_file)
```

### 32. Non-Interactive 检测（Plugin 层）

**问题**：Python hook 检查 `CLAUDE_NON_INTERACTIVE` 环境变量来跳过上下文注入。

**✅ 已完成**：已在 `session-start.js` 中添加检测：
```javascript
if (process.env.CLAUDE_NON_INTERACTIVE === "1" ||
    process.env.OPENCODE_NON_INTERACTIVE === "1") {
  return
}
```

同时支持两个环境变量，保持兼容性。

### 33. Plugins 注册配置

**问题**：创建的 OpenCode plugins 需要在 `opencode.json` 中注册才能生效。

**✅ 已完成**：已在本项目 `opencode.json` 中配置：
```json
{
  "plugins": [
    ".opencode/plugins/session-start.js",
    ".opencode/plugins/inject-subagent-context.js",
    ".opencode/plugins/ralph-loop.js"
  ]
}
```

### 34. Fallback 路径一致性

**问题**：Python hook 的 fallback 路径使用 `.claude/commands/trellis/`：
```python
check_files = [
    (".claude/commands/trellis/finish-work.md", "..."),
    ...
]
```

JS plugin 使用 `.opencode/commands/trellis/`。

**当前状态**：两边路径已分离，但需确保内容同步。

**验证点**：确保 `.opencode/commands/trellis/` 和 `.claude/commands/trellis/` 内容一致。

### 35. TaskOutput API 兼容性

**问题**：Dispatch agent 使用 TaskOutput 轮询 subagent 完成状态：
```
TaskOutput(task_id, block=true, timeout=300000)
```

**待验证**：OpenCode 的 TaskOutput 是否有相同的参数和行为。

### 36. Worktree 复制文件（平台感知）

**问题**：`worktree.yaml` 的 `copy` 列表可能需要区分平台：
```yaml
copy:
  - .claude/  # Claude Code only
  - .opencode/  # OpenCode only
  - .env  # 通用
```

**当前状态**：未区分。

**解决方案**：
1. 方案 A：添加平台前缀 `copy_claude:` / `copy_opencode:`
2. 方案 B：维持现状，两个目录都复制（简单，但浪费）

**决策**：暂用方案 B，两个目录都复制，不增加复杂度。

## ⚠️ 模板化注意事项

### Provider 配置

**当前本地配置**：使用 Claude Max 反代（localhost:3456）
```json
{
  "provider": {
    "claude-max": {
      "npm": "@ai-sdk/openai-compatible",
      "options": { "baseURL": "http://localhost:3456/v1" }
    }
  }
}
```

**模板化时需要**：
1. Research OpenCode 标准 provider 配置方式
2. 提供多种 provider 选项：
   - Anthropic API（官方）
   - OpenAI Compatible（自部署）
   - 本地模型（Ollama 等）
3. 模板中不能硬编码 localhost 地址
4. 考虑使用环境变量或 init 时交互配置

### Plugins 配置

模板需要包含：
```json
{
  "plugins": [
    ".opencode/plugins/session-start.js",
    ".opencode/plugins/inject-subagent-context.js",
    ".opencode/plugins/ralph-loop.js"
  ]
}
```

## 待讨论问题

（暂无）

---

## 🔴 已知限制：项目级 Plugin 无法拦截 Subagent（2026-02-02 验证）

### 问题描述

OpenCode 项目级 plugin (`.opencode/plugin/*.js`) **无法拦截 subagent 的任何操作**：

| Hook | 主 Session | Subagent |
|------|-----------|----------|
| `chat.message` | ✅ 触发 | ❌ 不触发 |
| `experimental.chat.messages.transform` | ✅ 触发 | ❌ 不触发 |
| `experimental.chat.system.transform` | ✅ 触发 | ❌ 不触发 |
| `tool.execute.before` | ❌ 不触发 | ❌ 不触发 |

### 根本原因

这是 OpenCode 的**架构限制**，已有多个相关 Issue：

| Issue | 标题 | 状态 |
|-------|------|------|
| [#5894](https://github.com/sst/opencode/issues/5894) | Plugin hooks (tool.execute.before) don't intercept subagent tool calls | ⚠️ 已知 bug |
| [#7474](https://github.com/anomalyco/opencode/issues/7474) | Subagent permissions not enforced | 安全 bug |
| [#2588](https://github.com/sst/opencode/issues/2588) | Feature request: let subagents inherit context | Feature request |
| [#3808](https://github.com/anomalyco/opencode/issues/3808) | Task should inherit current agent permissions/tools | Feature request |
| [#6396](https://github.com/sst/opencode/issues/6396) | Custom agent 'deny' permissions ignored via SDK | Bug |

### 全局 vs 项目级 Plugin

| 类型 | 安装方式 | tool.execute.before | subagent hooks |
|------|---------|---------------------|----------------|
| 全局 plugin | `npm install -g xxx` | ✅ 支持 | ✅ 支持 |
| 项目级 plugin | `.opencode/plugin/*.js` | ❌ 不支持 | ❌ 不支持 |

**oh-my-opencode** 作为全局 plugin，能够：
1. 注册 `tool.execute.before` hook
2. 拦截 Task 工具调用
3. 读取 `.claude/settings.json` 执行 Python hooks
4. 将修改后的 prompt 传递给 subagent

### 解决方案

| 方案 | 描述 | 状态 |
|------|------|------|
| **依赖 omo** | 要求用户安装 oh-my-opencode，利用其全局 plugin 权限 | ✅ 主要方案 |
| **Context Self-Loading** | Agent prompt 包含自检逻辑，无上下文时自己读取文件 | ✅ 降级方案（已实现） |
| **打包 npm** | 将 Trellis 打包成 `trellis-opencode-plugin` npm 包 | 💡 未来选项 |

### Context Self-Loading 降级方案（2026-02-02 实现）

在 `.opencode/agents/*.md` 中添加自检逻辑：

```markdown
## Context Self-Loading

**If you see "# Implement Agent Task" header with pre-loaded context above, skip this section.**

Otherwise, load context yourself:

1. Read `.trellis/.current-task` → get task directory
2. Read `{task_dir}/implement.jsonl` (or `spec.jsonl` as fallback)
3. For each entry in JSONL, read the referenced file
4. Read `{task_dir}/prd.md` for requirements
5. Read `{task_dir}/info.md` for technical design
```

**工作原理**：
- 有 omo → 上下文已注入，agent 看到 header 直接跳过自检
- 无 omo → agent 自己读取文件，功能完整

**代价**：
- 无 omo 时多几轮工具调用（读文件）
- 稍微增加 token 消耗

### 对 Trellis 的影响

1. **session-start.js** - 项目级 plugin 可用，能注入主 session 上下文 ✅
2. **inject-subagent-context.js** - 项目级 plugin 无法工作，必须依赖 omo ❌

**结论**：Trellis + OpenCode 用户**必须安装 oh-my-opencode** 才能使用完整的 subagent 上下文注入功能。

---

## 参考资料

- [OpenCode 官网](https://opencode.ai/)
- [OpenCode Plugins 文档](https://opencode.ai/docs/plugins/)
- [OpenCode CLI 文档](https://opencode.ai/docs/cli/)
- [OpenCode Permissions 文档](https://opencode.ai/docs/permissions/)
- [OpenCode Agents 文档](https://opencode.ai/docs/agents/) - Subagent 配置和 Task tool
- [OpenCode 内部实现分析](https://cefboud.com/posts/coding-agents-internals-opencode-deepdive/) - Task tool 工作原理
- [GitHub Issue #4267](https://github.com/sst/opencode/issues/4267) - Subagent 权限控制
- [GitHub Issue #4271](https://github.com/sst/opencode/issues/4271) - 无法覆盖内置 agent (plan/build)
- [OpenCode Agent System (DeepWiki)](https://deepwiki.com/sst/opencode/3.2-agent-system) - 内置 agent 完整列表
- [OpenCode Tools 文档](https://opencode.ai/docs/tools/) - 内置工具列表
- [OpenCode Plugins Guide (Gist)](https://gist.github.com/johnlindquist/0adf1032b4e84942f3e1050aba3c5e4a) - Plugin 事件和数据结构
- [GitHub Issue #8463](https://github.com/anomalyco/opencode/issues/8463) - --dangerously-skip-permissions (已实现)

---

## Commit 记录

### 2026-02-02 Session（模板同步 & 验证）

| Commit | Message | 改动 |
|--------|---------|------|
| `f077a20` | refactor(opencode): update agent permission format | `.opencode/agents/*.md` - 改用 permission 格式，移除 model 字段 |
| `bd9a631` | docs(opencode): add --platform flag to parallel.md | `.opencode/commands/trellis/parallel.md` - 加 --platform opencode |
| `e1bc6a8` | feat(scripts): add --platform flag for OpenCode support | `cli_adapter.py`, `registry.py`, `plan.py`, `start.py`, `status.py` |
| `2aa151a` | chore(templates): sync OpenCode platform support | `src/templates/` - 同步 opencode/, trellis/scripts/, claude/hooks/ |
| `50bf65e` | feat(init): add OpenCode platform support to trellis init | `src/cli/`, `src/commands/init.ts`, `src/configurators/opencode.ts` |
| `54268ab` | docs(tasks): update OpenCode support task progress | `.trellis/tasks/02-01-opencode-support/` |
| `a612deb` | fix(opencode): update model description in parallel.md | parallel.md - "opus model" → "globally configured model" |
| `2827dd3` | docs(tasks): update OpenCode task with verification results | task.md - 添加验证结果和技术参考 |

### 关键文件变更

**新增文件：**
- `src/templates/opencode/` - 完整 OpenCode 模板目录（agents, commands, plugin, lib）
- `src/templates/trellis/scripts/common/cli_adapter.py` - CLI 平台适配器

**修改文件：**
- `.trellis/scripts/common/cli_adapter.py` - 添加 verbose 支持
- `.trellis/scripts/common/registry.py` - 添加 platform 字段
- `.trellis/scripts/multi_agent/plan.py` - 使用 CLIAdapter，支持 --platform
- `.trellis/scripts/multi_agent/start.py` - 使用 CLIAdapter，OpenCode session ID 提取
- `.trellis/scripts/multi_agent/status.py` - 双平台日志解析，平台特定恢复命令
- `.claude/hooks/session-start.py` - 检测 OPENCODE_NON_INTERACTIVE
- `.opencode/agents/*.md` - permission 格式，移除 model，添加 Self-Loading
- `.opencode/commands/trellis/parallel.md` - --platform opencode

### 验证结果

| 测试项 | 状态 | 备注 |
|--------|------|------|
| Session ID 格式 | ✅ | `ses_[a-zA-Z0-9]+` |
| Session Resume | ✅ | `opencode run --session <id>` 能恢复上下文 |
| status.py 恢复命令 | ✅ | 根据 platform 输出不同命令 |
| plan.py + research subagent | ✅ | 之前 Kimi CLI 任务已验证 |

### 未完整测试

- `start.py --platform opencode` → Dispatch → Implement → Check 全流程
- create_pr.py 在 worktree 中执行
