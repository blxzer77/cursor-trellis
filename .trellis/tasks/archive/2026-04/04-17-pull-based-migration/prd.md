# Pull-based 迁移：4 个类 2 平台

## 目标

把 4 个类 2 平台（Gemini / Qoder / Codex / Copilot）的 sub-agent 上下文注入从 hook-based 改为 pull-based：sub-agent 启动时自己 Read `.trellis/.current-task` + `prd.md` + jsonl 引用的 spec，不再依赖平台 hook 注入 prompt（因为这些平台的 hook 要么不 fire、要么收不到 prompt 字段、要么受 bug 影响）。

## 范围

**只动**：
- 4 平台的 sub-agent definition 模板（`packages/cli/src/templates/{qoder,codex,copilot,gemini}/agents/*.md|*.toml` 或 `prompts/*.prompt.md`）
- 4 平台的 hook 配置（删除 inject-subagent-context.py 相关条目）
- 4 平台的 configurator（不再把 inject-subagent-context.py 写到 hook 目录）
- shared-hooks/inject-subagent-context.py：**保留**（类 1 还在用）
- 测试更新

**不动**：
- workflow.md（用户/AI 视角的工作流不变，平台标记保持二分）
- get_context.py（平台过滤逻辑跟 3 类无关）
- 类 1 的 6 个平台（claude/codebuddy/cursor/droid/kiro/opencode）
- 类 3 的 3 个平台（kilo/antigravity/windsurf）
- session-start.py（4 平台都还要它注入主会话 workflow 概要）
- task.py init-context / add-context（jsonl 文件还是 sub-agent 要 Read 的）

## 4 平台现状对照

| 平台 | hook 配置文件 | 现在配的 sub-agent hook | inject-subagent-context.py 装在哪 | sub-agent definition |
|---|---|---|---|---|
| **Qoder** | `qoder/settings.json` | `PreToolUse + matcher Task` | `.qoder/hooks/`（通过 `writeSharedHooks`） | `qoder/agents/{implement,check,research}.md` |
| **Gemini** | `gemini/settings.json` | `BeforeTool + matcher ^(check\|implement\|research)$` | `.gemini/hooks/`（通过 `writeSharedHooks`） | `gemini/agents/{implement,check,research}.md` |
| **Copilot** | `copilot/hooks.json` | 无（只 SessionStart） | `.github/copilot/hooks/`（通过 `getSharedHookScripts`） | `copilot/prompts/*.prompt.md`（**注意：是 prompts/ 不是 agents/**） |
| **Codex** | `codex/hooks.json` | 无（只 SessionStart） | **未装**（不走 shared-hooks，自己只有 session-start.py） | `codex/agents/{implement,check,research}.toml` |

## 执行清单

### Step 1 — 设计 sub-agent Read 指令模板片段 [必做]

**动作**：写一段标准的 system prompt 片段，放在 sub-agent definition 顶部，指示启动时 Read 关键文件。

**模板内容**（Implement agent 版，Check agent 类似）：

```markdown
## Required: Load Trellis Context First

Before starting any work, you MUST load task context (Trellis hook does not auto-inject on this platform):

1. Read `.trellis/.current-task` to find current task path (e.g. `.trellis/tasks/04-17-foo/`)
2. Read `<task-path>/prd.md` — requirements
3. Read `<task-path>/info.md` if it exists — technical design
4. Read `<task-path>/implement.jsonl` (or `check.jsonl` for check agent) — list of spec files
5. For each entry in the jsonl, Read the file path it references — these are dev specs

If `.current-task` does not exist or task has no `prd.md`, ask the user what to work on; do NOT proceed.
```

**完成标志**：写到 `packages/cli/src/templates/common/skills/_pull-load-snippet.md`（命名加下划线避免被当成 skill 收录），所有 4 平台 sub-agent definition 引用同一份。或者直接复制粘贴（4 份相同内容也能接受）。

### Step 2 — 改 4 平台的 sub-agent definition [必做]

**动作**：把 Step 1 的片段加进每个平台的 implement/check sub-agent definition 顶部。Research agent 也加（让它知道在哪里搜 spec）。

文件清单：
- `packages/cli/src/templates/qoder/agents/{implement,check,research}.md`
- `packages/cli/src/templates/gemini/agents/{implement,check,research}.md`
- `packages/cli/src/templates/copilot/prompts/{implement,check,research}.prompt.md`（如有）
- `packages/cli/src/templates/codex/agents/{implement,check,research}.toml`

**完成标志**：每个文件顶部都有 "Load Trellis Context First" 段，未注释、未隐藏。

### Step 3 — 卸 4 平台 hook 配置中的 inject-subagent block [必做]

**动作**：从 hook 配置 JSON 删除 `inject-subagent-context.py` 相关条目。

- `qoder/settings.json` — 整个 `PreToolUse` 数组删掉（或移除 Task matcher 那个 block）
- `gemini/settings.json` — 整个 `BeforeTool` 数组删掉
- `copilot/hooks.json` — 不需要改（已经没配）
- `codex/hooks.json` — 不需要改（已经没配）

**完成标志**：4 个文件再无对 `inject-subagent-context.py` 的引用。

### Step 4 — 改 configurator 不写 inject-subagent-context.py 脚本 [必做]

**动作**：让 4 平台的 configurator 在写 hook 脚本时跳过 `inject-subagent-context.py`。

- `qoder.ts` — 调用 `writeSharedHooks` 时过滤掉 inject-subagent-context.py（或新写一个 `writeSessionStartHookOnly` 工具）
- `gemini.ts` — 同上
- `copilot.ts` — 现有代码用 `getSharedHookScripts()` 循环，加 `if (hook.name === "inject-subagent-context.py") continue;`
- `codex.ts` — 不需要改（本来就只装自己的 session-start.py）

**实现方式选择**：
- **A**：在 `shared.ts` 加一个 `writeSessionStartOnly(hooksDir)` helper（只装 session-start.py + statusline.py）
- **B**：在 `writeSharedHooks` 加可选参数 `{ excludeSubagentInject?: boolean }`
- **C**：每个 configurator 内联过滤

**完成标志**：跑 `init` 到 /tmp，4 平台的 hook 目录里**不再有** `inject-subagent-context.py`。

### Step 5 — 测试更新 [必做]

**动作**：

- `test/configurators/platforms.test.ts` — 4 平台测 hook 目录不含 inject-subagent-context.py
- `test/commands/init.integration.test.ts` — 4 平台 init 后 hook 目录验证
- `test/templates/{qoder,codex,copilot,gemini}.test.ts` — 验证 sub-agent definition 顶部含 "Load Trellis Context First" 标记
- `test/regression.test.ts` — 加一条："类 2 平台不装 inject-subagent-context.py"

**完成标志**：`pnpm lint && pnpm test` 全绿。

### Step 6 — Spec 更新 [必做]

**动作**：更新 `.trellis/spec/cli/backend/platform-integration.md`，加一节 "Subagent Context Injection: Hook-based vs Pull-based"，说明：
- 哪些平台是 hook-based（类 1：6 个）
- 哪些平台是 pull-based（类 2：4 个）
- pull-based 的实现：sub-agent definition 里 Read 文件
- 类 3 平台不涉及（无 sub-agent）

**完成标志**：spec 文档 + audit 文件交叉引用。

---

## 完成标志（整体）

- [x] 4 平台 sub-agent definition 顶部有 "Load Trellis Context First" 段（通过 configurator transform，不污染 template 源文件）
- [x] 4 平台 hook 配置不再引用 inject-subagent-context.py（qoder/gemini settings.json 删了 inject block；codex/copilot 本来就没配）
- [x] 4 平台 hook 目录不再有 inject-subagent-context.py 文件（writeSharedHooks 用 exclude 选项）
- [x] `pnpm test` 全绿（539/539，新增 12 个 regression case）
- [x] platform-integration.md spec 更新（新增 "Subagent Context Injection: Hook-based vs Pull-based" 一节）
- [x] 与 audit 文件交叉引用（spec 末尾列了 audit 路径）

## 非目标

- **不实测**：Pull-based 的实际效果实测（需要 4 平台 CLI 都跑起来）放到 audit task 的后续 step
- **不改 workflow.md / get_context.py**：3 类是实现细节，不进工作流文档
- **不动类 1 / 类 3 平台**
- **不删 shared-hooks/inject-subagent-context.py**：类 1 还在用
- **不重构 registry 字段**（`subagentStrategy` 枚举值）：留作后续独立 refactor
