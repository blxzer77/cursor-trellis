# Cursor 集成

[English](cursor.md) | 简体中文

本 fork 将 **Cursor** 作为一等平台。在项目根目录执行 `trellis init --cursor` 后，CLI 会写入受管 `.cursor/` 目录以及共享的 `.trellis/` 工作区。本文说明生成内容、上下文如何进入 Agent，以及 Cursor 与其他平台的差异。

## `trellis init --cursor` 做什么

在**你的项目根目录**（正在开发的应用仓库，而非 Trellis 源码仓库）：

```bash
npm install -g @blxzer/cursor-trellis
cd /path/to/your-project
trellis init --cursor
```

`init` 还会创建或更新：

- `.trellis/` — workflow、spec、tasks、workspace、scripts
- `AGENTS.md` — Agent 入口说明（Trellis 管理块）
- `.cursor/` 下的平台文件（见下文）

可用 `-y` 使用默认项、`-f` 覆盖已有文件、`-s` 跳过已有文件。完整 flag 见 [CLI README](../packages/cli/README.zh-CN.md)。

### Cursor 上的 commands-only 策略

在 Cursor 上，Trellis 默认采用 **仅 commands** 策略：

| 表面 | init 后的 Cursor |
| --- | --- |
| `.cursor/commands/` | 面向用户的斜杠命令（`/trellis-continue`、`/trellis-finish-work`、可选 Cursor++ 配置） |
| `.cursor/rules/*.mdc` | 常驻或 glob 规则（如 Request Triage 硬门禁） |
| `.cursor/agents/` | 子 Agent 定义（`trellis-research`、`trellis-implement`、`trellis-check` 等） |
| `.cursor/hooks/` + `hooks.json` | Python 钩子脚本与配置 |
| `.cursor/worktrees.json` | Cursor 原生 worktree 辅助配置 |
| `.cursor/skills/` | **默认不写入** — 内部 workflow skills 不堆在调色板上 |

目的：保持 `/` 命令面板精简、入口明确。工作流语义通过 **rules** 与 **AGENTS.md** / `.trellis/workflow.md` 传递，而不是在 Cursor 上默认展开大量 skills。

其他平台（Claude Code、Codex 等）可在各自配置目录下携带 skills；见文末附录简表。

## 生成目录结构

```text
your-project/
  .trellis/
    workflow.md
    spec/
    tasks/
    workspace/
    scripts/
  AGENTS.md
  .cursor/
    commands/
    rules/
    agents/
    hooks/
    hooks.json
    worktrees.json
```

实现参考：`packages/cli/src/configurators/cursor.ts`、`packages/cli/src/templates/cursor/`。

## Rules

Cursor 的**用户规则**与项目 **`.cursor/rules`** 是常驻策略的可靠通道。

Trellis 提供 `trellis-triage.mdc`（`alwaysApply: true`），在持久性工作前强制执行 **Request Triage**。用于弥补已知限制：`sessionStart` 钩子的 `additional_context` 可能无法进入 Agent（#158452），因此 Triage 不能仅依赖钩子注入的 workflow 文本。

日常以 `.trellis/workflow.md` 为规范来源；rules 概括聊天中必须遵守的硬门禁。

## 斜杠命令

| 命令文件 | 典型调用 | 用途 |
| --- | --- | --- |
| `trellis-continue.md` | `/trellis-continue` | 带 Trellis 上下文继续当前任务 |
| `trellis-finish-work.md` | `/trellis-finish-work` | 验证、学习回写、任务收尾 |
| `trellis-cursor2plus-setup.md` | `/trellis-cursor2plus-setup` | Cursor++ BYOK 子 Agent 模型路由（可选） |

Cursor 上命令引用前缀为 `/trellis-`（见 `packages/cli/src/types/ai-tools.ts` 中 `AI_TOOLS.cursor`）。

## Agents（子 Agent）

`.cursor/agents/` 定义 **Task** 子 Agent（独立上下文），用于调研、实现、检查等阶段。`hooks.json` 可在拉起子 Agent 时注入上下文（`preToolUse`，matcher `Task|Subagent`）。

需要干净上下文窗口时，优先使用命名 Trellis Agent，而非临时长提示。

## Hooks

`hooks.json` 注册 Python 脚本（init/update 时解析 `{{PYTHON_CMD}}`）：

| Hook | 作用 |
| --- | --- |
| `sessionStart` | 会话启动（受 Cursor 注入能力限制） |
| `preToolUse` | 子 Agent 上下文注入 |
| `beforeShellExecution` | 终端/Shell 会话上下文 |
| `stop` | 回合结束检索包（调研流） |

本地覆盖可放在 `.trellis/hooks.local.json`。运行钩子需要本机 **Python ≥ 3.9**。

## Cursor++（可选附录）

同时传入 **`--cursor2plus`** 与 **`--cursor`** 时，init 可在 `.trellis/local/cursor2plus/` 物化 BYOK 本地包。斜杠命令 **`/trellis-cursor2plus-setup`** 用于把子 Agent 角色映射到模型。

- 仅在使用 **Cursor++（BYOK）** 时有意义；纯原生 Cursor API 可忽略。
- 提供商安装细节以生成命令文档为准，公开文档不展开。

## 保持 Cursor 文件最新

```bash
trellis update
```

按模板哈希比对更新，可选 `--migrate` 做路径迁移。敏感仓库建议先 `--dry-run`。详见 [CLI README](../packages/cli/README.zh-CN.md#trellis-update)。

移除 Trellis 管理的 Cursor 文件：

```bash
trellis uninstall
```

## 其他平台（附录）

公开文档以 **Cursor-first** 为主线。其他工具仍可通过 `trellis init --<flag>` 启用。下表仅供对照，不在公开文档中逐平台展开。

| CLI flag | 平台 | 层级 | 配置根目录 |
| --- | --- | --- | --- |
| `--claude` | Claude Code | first-class | `.claude/` |
| `--cursor` | Cursor | first-class | `.cursor/` |
| `--codex` | Codex | first-class | `.codex/` |
| `--opencode` | OpenCode | legacy | `.opencode/` |
| `--gemini` | Gemini CLI | legacy | `.gemini/` |
| `--kiro` | Kiro Code | legacy | `.kiro/` |
| `--kilo` | Kilo CLI | legacy | `.kilocode/` |
| `--antigravity` | Antigravity | legacy | `.agent/workflows/` |
| `--windsurf` | Windsurf | legacy | `.windsurf/workflows/` |
| `--qoder` | Qoder | legacy | `.qoder/` |
| `--codebuddy` | CodeBuddy | legacy | `.codebuddy/` |
| `--copilot` | GitHub Copilot | legacy | `.github/copilot/` |
| `--droid` | Factory Droid | legacy | 见 `ai-tools.ts` |
| `--pi` | Pi Agent | legacy | 见 `ai-tools.ts` |

权威数据：`packages/cli/src/types/ai-tools.ts`。

## 延伸阅读

- [Cursor 中的工作流](workflow.zh-CN.md)
- [架构概览](architecture.zh-CN.md)
- [CLI 包参考](../packages/cli/README.zh-CN.md)
- [项目 README](../README.zh-CN.md)