# Cursor 集成
> **⚠️ Cursor++ 已废弃（P23）：** Trellis 不再提供 Cursor++ 产品面（`cstl-cursor2plus-setup`、`--cursor2plus`、`.cstl/local/cursor2plus/`）。**勿**安装 Cursor++、运行 `patch_wpelc8.py`，或把 Method 2.5 当操作指南。**产品路径 = Native Cursor** — `cstl init --cursor`。`cursorEnv` / `TRELLIS_CURSOR_BYOK` / `~/.ccursor/routes.json` 仅作**检索环境探测**。


[English](cursor.md) | 简体中文

本 fork 将 **Cursor** 作为一等平台。在项目根目录执行 `cstl init --cursor` 后,CLI 会写入受管 `.cursor/` 目录以及共享的 `.cstl/` 工作区。本文说明生成内容、上下文如何进入 Agent、检索计划如何注入,以及两种 Cursor 环境(Native API vs Cursor++ BYOK)在子 Agent 派发上的差异。

## `cstl init --cursor` 做什么

在**你的项目根目录**(正在开发的应用仓库,而非 Trellis 源码仓库):

```bash
npm install -g @blxzer/cursor-trellis
cd /path/to/your-project
cstl init --cursor
```

`init` 还会创建或更新:

- `.cstl/` — workflow、spec、tasks、workspace、scripts
- `AGENTS.md` — Agent 入口说明(Trellis 管理块)
- `.cursor/` 下的平台文件(见下文)

可用 `-y` 使用默认项、`-f` 覆盖已有文件、`-s` 跳过已有文件。完整 flag 见 [CLI README](../packages/cli/README.zh-CN.md)。

### Cursor 上的 commands-only 策略

在 Cursor 上,Trellis 默认采用 **仅 commands** 策略:

| 表面 | init 后的 Cursor |
| --- | --- |
| `.cursor/commands/` | 面向用户的斜杠命令(`/cstl-continue`、`/cstl-finish-work`、`/cstl-handoff`) |
| `.cursor/rules/*.mdc` | 默认常驻仅 `cstl-bootstrap.mdc`（薄 Adapter 指针） |
| `.cursor/agents/` | 子 Agent 定义(`cstl-research`、`cstl-implement`、`cstl-check` 等) |
| `.cursor/hooks/` + `hooks.json` | Python 钩子脚本与配置 |
| `.cursor/worktrees.json` | Cursor 原生 worktree 辅助配置 |
| `.cursor/skills/` | **默认不写入** — 内部 workflow skills 不堆在调色板上 |

**理由。** 保持 `/` 命令面板精简、入口明确。工作流语义通过 **rules** 与 **AGENTS.md** / `.cstl/workflow.md` 传递,而非在 Cursor 上默认展开大量 skills。其他平台(Claude Code、Codex 等)可在各自配置目录下携带 skills;见文末附录简表。

## 生成目录结构

```text
your-project/
  .cstl/
    workflow.md          # 共享生命周期(plan、execute、finish、triage)
    spec/                # 分层编码规范
    tasks/               # PRD、design、implement、verify
    workspace/           # 日志与会话延续
    scripts/             # task.py、get_context.py、hooks 辅助、检索路由器
  AGENTS.md              # Agent 入口说明
  .cursor/
    commands/
      cstl-continue.md
      cstl-finish-work.md
    rules/
      cstl-bootstrap.mdc             # alwaysApply: true（默认唯一常驻）
    agents/
      cstl-research.md
      cstl-implement.md
      cstl-check.md
    hooks/
      *.py                           # sessionStart、preToolUse、beforeSubmitPrompt、shell、stop 等
    hooks.json
    worktrees.json
```

实现参考:`packages/cli/src/configurators/cursor.ts`、`packages/cli/src/templates/cursor/`。

## Rules

Cursor 的**用户规则**与项目 **`.cursor/rules`** 是常驻策略的可靠通道。默认安装只发布**一条**常驻规则：

- `cstl-bootstrap.mdc`（`alwaysApply: true`）——薄 Adapter：Event Bridge、四种检索意图（`exact` / `semantic` / `structural` / `external`）、独立 smart-search Provider、可选代码智能、Native SSOT、用户 overlay `.cstl/middleware/`。它**只指向**，不承载完整 Triage、门禁或检索方法。

Request Triage、门禁与检索做法在 `.cstl/workflow.md` 与按需 `.cstl/framework/` 指南。`cstl-triage.mdc`、`retrieval-routing.mdc`、`cstl-session-rename.mdc` 是**已退役**的常驻文件；`cstl update` 会迁走未改动的副本。不要把它们当成当前安装产物。

用于弥补已知限制:`sessionStart` 钩子的 `additional_context` 可能无法进入 Agent(#158452)。因此硬策略不能仅依赖钩子注入的 workflow 文本。

### 会话重命名(鼓励一任务一主会话)

Trellis **鼓励**一个 cstl 任务对应一个主 Agent 会话,便于管理;**不**在 `task.py create` 时改名(create 不绑定会话)。Subagent 子窗口不在范围内。

| 触发 | 会话标题 |
| --- | --- |
| `task.py select <task-dir>` | 任务目录名(如 `07-04-my-task`) |
| `task.py start-execution <task-dir> --approved` | 同上 |

机制:`afterShellExecution` 钩子（`rename-session-for-task.py`）尽力下发 `agent_message`，让 Agent 调用 **`cursor-app-control` → `rename_chat`**。该 MCP 属于 **Cursor 平台能力**(`cstl init` 不会写入 `.cursor/mcp.json`)。MCP 不可用时静默跳过。

| 环境 | 说明 |
| --- | --- |
| Native Cursor API | `rename_chat` 在工具列表中时预期可用 |
| BYOK env（探测） | 同一套实现；MCP 不可用时静默跳过 |

去重状态:`.cstl/.runtime/session-rename/`(按会话 context key)。

日常以 `.cstl/workflow.md` 为规范来源;bootstrap 规则是指针,不是完整方法。

**平台问题、Native/BYOK 分叉、逐步操作与外部证据链接**见：[Cursor 平台限制与 cursor-trellis 适配说明](cursor-platform-limitations-and-trellis-adaptation.zh-CN.md)。

## 斜杠命令

| 命令文件 | 典型调用 | 用途 |
| --- | --- | --- |
| `cstl-continue.md` | `/cstl-continue` | 带 Trellis 上下文继续当前任务 |
| `cstl-finish-work.md` | `/cstl-finish-work` | 验证、学习回写、任务收尾 |
| `cstl-handoff.md` | `/cstl-handoff` | 将会话交接文档写到 OS 临时目录 |

Cursor 上命令引用前缀为 `/cstl-`（见 `packages/cli/src/types/ai-tools.ts` 中 `AI_TOOLS.cursor`）。Cursor 上 **没有** `/cstl-start` 斜杠项（agent-capable 平台会过滤 `start.md`）。

## Agents(子 Agent)

`.cursor/agents/` 定义 **Task** 子 Agent(独立上下文),用于调研、实现、检查等阶段。`hooks.json` 可在拉起子 Agent 时注入上下文(`preToolUse`,matcher `Task|Subagent`)。

每个 `trellis-*` Agent 模板自 0.2.8 起以两个标准段开头:

- **Entry points** —— 该 Agent 可被触达的三种方式(Agent 会话、Task 派发、Skill 形态)及各自隐含的模型路由路径。
- **Context source** —— 声明 **CLI Layer 2 派发**(`generate_dispatch_prompt.py` → `Task` 工具 `prompt`)为**主**且**有保障**的上下文通道。`sessionStart.additional_context` 与 `preToolUse` 钩子仅为**尽力而为**(Cursor issue #158452 使 `additional_context` 不可靠;Agent 定义体并不保证进入子 Agent system prompt)。当仅靠钩子注入是唯一上下文来源时,视为 Agent 上下文不足,应请求 Layer 2 派发 prompt。

需要干净上下文窗口时,优先使用命名 Trellis Agent。环境特定的模型路由见下文[子 Agent 派发策略](#子-agent-派发策略)。

## Hooks

`hooks.json` 注册 Python 脚本(init/update 时解析 `{{PYTHON_CMD}}`):

| Hook | 作用 |
| --- | --- |
| `sessionStart` | 会话启动(workflow 上下文;受 Cursor 注入能力限制——#158452) |
| `preToolUse` | 子 Agent 上下文注入(Cursor 上尽力而为) |
| `beforeSubmitPrompt` | 每查询检索计划注入(`inject-retrieval-plan.py` → `## 代码库检索计划` 块) |
| `beforeShellExecution` | 终端/Shell 会话上下文 |
| `afterShellExecution` | `task.py select` / `start-execution --approved` 成功后,尽力提示将主会话改名为任务目录名 |
| `stop` | 回合结束检索包(调研流) |

本地覆盖可放在 `.cstl/hooks.local.json`。运行钩子需要本机 **Python ≥ 3.9**。

检索注入通道见 [检索层设计](retrieval.zh-CN.md#cursor-双通道注入)。

## 产品路径：Native Cursor

每个项目执行 `cstl init --cursor`。多仓 harness 仍按 **仓库** 初始化。**没有** `--cursor2plus`，也 **没有** Cursor++ local bundle 安装面。

### 环境探测（仅检索）

`cursorEnv`（`native` | `byok` | `unknown`）可能来自：

1. `TRELLIS_CURSOR_BYOK=0|1`
2. `~/.ccursor/routes.json` 的 `byokMode`
3. 是否存在 `~/.ccursor/providers.json`（遗留信号）

仅用于选择检索后端（Native 内置语义 vs `fast_context_search` MCP）。**不是** Cursor++ 安装或 Method 2.5 操作信号。

### 可选能力

init/update 可勾选 `codebase-retrieval`、`github-mcp`、`playwright-mcp`。MCP 写入为 **merge**：Trellis 托管的 server 名按当前选择 upsert/删除；用户自有 server 保留。

`cursor-sdk` 与 `campaign-mcp` **已拆除**。日常执行走 IDE Agent / Task 与 BYOK。不要再为 Trellis SDK 桥配置 `CURSOR_API_KEY`。历史见 harness spec 退役短页（`rpc-full-core.md`、`campaign-ui-mix.md`）。

## 子 Agent 派发策略（Native）

抽象策略：`model_policy: cursor-configured` — 已提交默认值中不要硬编码厂商模型 ID。

| Method | 机制 | 何时用 |
| --- | --- | --- |
| **1. Inherit**（默认） | Task 子 Agent 继承父会话模型 | 父模型合适 |
| **2. Explore** | 内置 Explore + Native 模型选择器 | 只读代码探索 |
| **3. 手动派发** | 新对话选模型，粘贴 CLI dispatch prompt | 需要不同模型且不用 frontmatter |
| **4. 临时 overlay** | 临时改 frontmatter `model:`，派发后还原 | Native 单次换模型 |

仅在 **即将派发** Trellis 子 Agent 且方法依赖用户选择时提问。规划 / PRD Grill / 无子 Agent 回合不要问。

```text
需要派发子 Agent
├─ 父模型合适？ → Method 1（继承）
├─ 仅只读探索？ → Method 2（Explore）
├─ Native 临时换模型？ → Method 4
└─ 其他 → Method 3（手动派发）
```

## 历史附录（已废弃；非 SOP）

> **不可操作。** Cursor++ / Method 2.5 / `--cursor2plus` / `cstl-cursor2plus-setup` / `patch_wpelc8.py` **已废弃**。勿 patch `extension.js`，勿为 Trellis 安装 Reload Window，勿把编辑 `trellis-task-models.json5` 当产品步骤。遗留 `.cstl/local/cursor2plus/` 为残渣——`cstl update` 对未改动的托管文件做哈希安全清理。证据仅见于 changelog / migration 历史。

## 保持 Cursor 文件最新

```bash
cstl update
```

按模板哈希比对更新,可选 `--migrate` 做路径迁移。看摘要并**确认一次**——拒绝则项目保持原状。五步路径见 [项目 README](../README.zh-CN.md#升级已有项目)。敏感仓库建议先 `--dry-run`。详见 [CLI README](../packages/cli/README.zh-CN.md#trellis-update)。

移除 Trellis 管理的 Cursor 文件:

```bash
cstl uninstall
```

## 延伸阅读

- [Cursor 中的工作流](workflow.zh-CN.md)
- [检索层设计](retrieval.zh-CN.md)
- [架构概览](architecture.zh-CN.md)
- [CLI 包参考](../packages/cli/README.zh-CN.md)
- [项目 README](../README.zh-CN.md)
