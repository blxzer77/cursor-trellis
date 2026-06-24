# Cursor 集成

[English](cursor.md) | 简体中文

本 fork 将 **Cursor** 作为一等平台。在项目根目录执行 `trellis init --cursor` 后,CLI 会写入受管 `.cursor/` 目录以及共享的 `.trellis/` 工作区。本文说明生成内容、上下文如何进入 Agent、检索计划如何注入,以及两种 Cursor 环境(Native API vs Cursor++ BYOK)在子 Agent 派发上的差异。

## `trellis init --cursor` 做什么

在**你的项目根目录**(正在开发的应用仓库,而非 Trellis 源码仓库):

```bash
npm install -g @blxzer/cursor-trellis
cd /path/to/your-project
trellis init --cursor
```

`init` 还会创建或更新:

- `.trellis/` — workflow、spec、tasks、workspace、scripts
- `AGENTS.md` — Agent 入口说明(Trellis 管理块)
- `.cursor/` 下的平台文件(见下文)

可用 `-y` 使用默认项、`-f` 覆盖已有文件、`-s` 跳过已有文件。完整 flag 见 [CLI README](../packages/cli/README.zh-CN.md)。

### Cursor 上的 commands-only 策略

在 Cursor 上,Trellis 默认采用 **仅 commands** 策略:

| 表面 | init 后的 Cursor |
| --- | --- |
| `.cursor/commands/` | 面向用户的斜杠命令(`/trellis-continue`、`/trellis-finish-work`、可选 Cursor++ 配置) |
| `.cursor/rules/*.mdc` | 常驻或 glob 规则(如 Request Triage 硬门禁、检索路由) |
| `.cursor/agents/` | 子 Agent 定义(`trellis-research`、`trellis-implement`、`trellis-check` 等) |
| `.cursor/hooks/` + `hooks.json` | Python 钩子脚本与配置 |
| `.cursor/worktrees.json` | Cursor 原生 worktree 辅助配置 |
| `.cursor/skills/` | **默认不写入** — 内部 workflow skills 不堆在调色板上 |

**理由。** 保持 `/` 命令面板精简、入口明确。工作流语义通过 **rules** 与 **AGENTS.md** / `.trellis/workflow.md` 传递,而非在 Cursor 上默认展开大量 skills。其他平台(Claude Code、Codex 等)可在各自配置目录下携带 skills;见文末附录简表。

## 生成目录结构

```text
your-project/
  .trellis/
    workflow.md          # 共享生命周期(plan、execute、finish、triage)
    spec/                # 分层编码规范
    tasks/               # PRD、design、implement、verify
    workspace/           # 日志与会话延续
    scripts/             # task.py、get_context.py、hooks 辅助、检索路由器
  AGENTS.md              # Agent 入口说明
  .cursor/
    commands/
      trellis-continue.md
      trellis-finish-work.md
      trellis-cursor2plus-setup.md   # 仅 Cursor(BYOK 路由)
    rules/
      trellis-triage.mdc             # alwaysApply: true
      retrieval-routing.mdc          # alwaysApply: true
    agents/
      trellis-research.md
      trellis-implement.md
      trellis-check.md
    hooks/
      *.py                           # sessionStart、preToolUse、beforeSubmitPrompt、shell、stop 等
    hooks.json
    worktrees.json
```

实现参考:`packages/cli/src/configurators/cursor.ts`、`packages/cli/src/templates/cursor/`。

## Rules

Cursor 的**用户规则**与项目 **`.cursor/rules`** 是常驻策略的可靠通道。Trellis 发布两个常驻规则:

- `trellis-triage.mdc`(`alwaysApply: true`)——在持久性工作前强制执行 **Request Triage**。
- `retrieval-routing.mdc`(`alwaysApply: true`)——对代码库问题强制执行[检索层](retrieval.zh-CN.md)路由。

用于弥补已知限制:`sessionStart` 钩子的 `additional_context` 可能无法进入 Agent(#158452)。因此 Triage 与检索策略不能仅依赖钩子注入的 workflow 文本。

日常以 `.trellis/workflow.md` 为规范来源;rules 概括聊天中必须遵守的硬门禁。

## 斜杠命令

| 命令文件 | 典型调用 | 用途 |
| --- | --- | --- |
| `trellis-continue.md` | `/trellis-continue` | 带 Trellis 上下文继续当前任务 |
| `trellis-finish-work.md` | `/trellis-finish-work` | 验证、学习回写、任务收尾 |
| `trellis-cursor2plus-setup.md` | `/trellis-cursor2plus-setup` | 把子 Agent 角色映射到 Cursor++ BYOK 模型(可选,仅 BYOK) |

Cursor 上命令引用前缀为 `/trellis-`(见 `packages/cli/src/types/ai-tools.ts` 中 `AI_TOOLS.cursor`)。

## Agents(子 Agent)

`.cursor/agents/` 定义 **Task** 子 Agent(独立上下文),用于调研、实现、检查等阶段。`hooks.json` 可在拉起子 Agent 时注入上下文(`preToolUse`,matcher `Task|Subagent`)。

需要干净上下文窗口时,优先使用命名 Trellis Agent。环境特定的模型路由见下文[子 Agent 派发策略](#子-agent-派发策略)。

## Hooks

`hooks.json` 注册 Python 脚本(init/update 时解析 `{{PYTHON_CMD}}`):

| Hook | 作用 |
| --- | --- |
| `sessionStart` | 会话启动(workflow 上下文;受 Cursor 注入能力限制——#158452) |
| `preToolUse` | 子 Agent 上下文注入(Cursor 上尽力而为) |
| `beforeSubmitPrompt` | 每查询检索计划注入(`inject-retrieval-plan.py` → `## 代码库检索计划` 块) |
| `beforeShellExecution` | 终端/Shell 会话上下文 |
| `stop` | 回合结束检索包(调研流) |

本地覆盖可放在 `.trellis/hooks.local.json`。运行钩子需要本机 **Python ≥ 3.9**。

检索注入通道见 [检索层设计](retrieval.zh-CN.md#cursor-双通道注入)。

## Cursor 环境(Native vs BYOK)

Trellis 支持两种 Cursor 环境。**同一个** `trellis-*` 子 Agent 名可通过三个入口(Agent 会话、Task 派发、Skill 形态)到达,但**模型路由不同**。动模型配置前先确认你的入口。

### 环境对照

| 能力 | Native Cursor API | Cursor++ BYOK |
| --- | --- | --- |
| Agent frontmatter `model:` | ✅ 有效(服务端路由) | ❌ 对 `trellis-*` 不生效;frontmatter 被忽略 |
| Cursor Settings 每 Agent 模型 UI | ✅ 有效 | ❌ 不为 `trellis-*` 填充 `subagentModelOverrides` |
| Explore 子 Agent 模型 | ✅ 原生模型选择器 | ✅ Cursor++ 面板独立模型(v0.0.11+) |
| Task 子 Agent(`trellis-*`)模型 | ✅ Frontmatter / Settings | ❌ 无 Method 2.5 时**继承**父会话 BYOK 模型 |
| 内置 `@codebase` 语义检索 | ✅ `platformNative: true` | ❌ 不在 Agent 工具列表 |
| `fast_context_search` MCP | 非 Primary | ✅ 概念检索必须用 |

### 环境探测

`cursorEnv` 从以下解析(首条匹配为准):

1. `TRELLIS_CURSOR_BYOK=0|1` 环境变量
2. `~/.ccursor/routes.json` `byokMode` 字段
3. 存在 `~/.ccursor/providers.json`(Cursor++ 数据目录)

路由信封(`route_codebase_retrieval.py`)始终包含 `cursorEnv`,Agent 据此知道调用哪个语义后端。见 [语义路由](retrieval.zh-CN.md#语义路由cursor)。

## 子 Agent 派发策略

当子 Agent 派发临近时,派发方法取决于环境与用户选择。抽象策略为 `model_policy: cursor-configured`——Trellis workflow、agents、skills、hooks **不得**在提交的默认值中硬编码厂商模型 ID。

### 派发方法

| 方法 | 环境 | 机制 | 适用 |
| --- | --- | --- | --- |
| **1. Inherit**(默认) | 两者 | 自定义 Task 子 Agent 继承父会话模型。不改 frontmatter。 | 父模型合适;用户说"继承"/"用当前模型派发" |
| **2. Explore + 自定义模型** | BYOK | 派发内置 **Explore** 子 Agent(只读),通过 Cursor++ 面板独立模型 | 纯代码库探索;不写文件、不外部检索 |
| **2.5. BYOK 代理映射** | 仅 BYOK | 对 Cursor++ `extension.js` 解析器 `WPeLc8` 做可逆 patch;映射 `subagentType` → `~/.ccursor/trellis-task-models.json5` 中的 BYOK slug;在继承分支**之前**求值 | BYOK 下需要 `trellis-research`/`trellis-implement`/`trellis-check` 固定每角色模型 |
| **2.6. 临时 Task 类型** | BYOK | 加 `.cursor/agents/trellis-worker-<id>.md` + 项目 `subagent-models.json` 键;重跑 patch;派发;完成后移除 | 罕见的每次派发模型,不改全局槽 |
| **3. 手动派发** | 两者 | 主会话准备完整派发 prompt;用户开新对话、选模型、粘贴 prompt、返回结果 | 子 Agent 工作显著受益于不同模型,且 Method 2.5 不可用 |
| **4. 临时覆盖** | 仅 Native | 派发前编辑 frontmatter `model: <id>`;派发后恢复 frontmatter | Native API,需临时每次派发模型。**BYOK 下不生效** |

### Method 2.5 详情(BYOK json5 patch)

**是什么:** 对 Cursor++ `extension.js` 解析器 `WPeLc8` 的可逆 patch,映射 `subagentType` → BYOK 目录 slug(`model-xxxxx`),在继承父分支之前求值。针对 Cursor++ v0.0.11+ 验证。

**Trellis 发布**(每次 `trellis init`/`trellis update`,传 `--cursor2plus` 时):`.trellis/local/cursor2plus/` 含 `patch_wpelc8.py`、`README.md`、`config.local.json.example`。Native Cursor API 用户可忽略此目录。

**操作流程(仅 BYOK):**

1. 填 `~/.ccursor/trellis-task-models.json5`,`subagent_type` → `~/.ccursor/providers.json` `id` 字段的 slug。
2. 可选每仓库覆盖:`.trellis/local/subagent-models.json`(项目同键优先)。
3. 从 `.trellis/local/cursor2plus/`:`python patch_wpelc8.py --print-map` → `python patch_wpelc8.py` → **Developer: Reload Window**。
4. 验证:`taskToolCall dispatching` → `resolvedModelId` 匹配 slug。
5. **还原:** `python patch_wpelc8.py --revert`;Reload Window。Cursor/Cursor++ 升级后重跑 patch。

Native Cursor API:**停止**——frontmatter `model:` 有效;Method 2.5 不适用。

### `--cursor2plus` 初始化

同时传 `--cursor` 与 `--cursor2plus` 给 `trellis init` 可在 `.trellis/local/cursor2plus/` 物化 BYOK 本地包。这会加 `/trellis-cursor2plus-setup` 斜杠命令,启动 agent 引导流程写 json5 模型映射。不传 `--cursor2plus` 时,此目录不存在,BYOK 用户若想用 Method 2.5 须手动管理 patch。

### 何时问用户模型选择

**问** 的时机:子 Agent 派发临近**且**派发方法依赖用户选择(如 Method 2 vs 2.5 vs 3)。

**不问**:仅规划回合、PRD Grill/micro-grill、主会话内联编辑、不 spawn check agent 的 `trellis-check` skill、或本轮无 Trellis 子 Agent 运行的回合。

任务模式(Lite/Full/Parent)本身**不**触发提问——只有**临近子 Agent 派发**才触发。

### 派发决策流

```text
需要子 Agent 派发
├─ Cursor++ BYOK + trellis-* 需固定每角色模型?
│  └─ 本机已应用 Method 2.5? → 正常派发 Task(映射处理路由)
├─ 父模型适合 trellis-*? → Method 1(继承)
├─ 仅只读代码库探索? → Method 2(Explore + Cursor++ 面板)
├─ Native Cursor API(非 BYOK)? → Method 1(继承)或 Method 4(临时 frontmatter)
└─ 需不同模型,Method 2.5 不可用? → Method 3(手动派发)
```

## 保持 Cursor 文件最新

```bash
trellis update
```

按模板哈希比对更新,可选 `--migrate` 做路径迁移。敏感仓库建议先 `--dry-run`。详见 [CLI README](../packages/cli/README.zh-CN.md#trellis-update)。

移除 Trellis 管理的 Cursor 文件:

```bash
trellis uninstall
```

## 延伸阅读

- [Cursor 中的工作流](workflow.zh-CN.md)
- [检索层设计](retrieval.zh-CN.md)
- [架构概览](architecture.zh-CN.md)
- [CLI 包参考](../packages/cli/README.zh-CN.md)
- [项目 README](../README.zh-CN.md)
