# cursor-trellis

[English](README.md) | 简体中文

**Trellis** 是面向 AI 编程 Agent 的团队工作流 harness：用可渐进加载的 `.trellis/` 知识库（workflow、spec、tasks、workspace）替代单文件巨型 `AGENTS.md` / `.cursorrules`，并生成 **Cursor** 集成（rules、commands、agents、hooks）。

本仓库是强调 **Cursor-first** 的公开 fork。上游参考：[mindfold-ai/Trellis](https://github.com/mindfold-ai/Trellis)。

| | |
| --- | --- |
| **npm CLI** | `@blxzer/cursor-trellis`（`trellis`、`tl`、`smart-search`） |
| **Core SDK** | `@blxzer/cursor-trellis-core` |
| **本仓库** | https://github.com/blxzer77/cursor-trellis |

## 解决什么问题

- **上下文腐烂**：规则堆在一个文件里，Agent 容易漏读。
- **任务不连续**：PRD、设计、验证散落在对话中。
- **平台形态不一**：Cursor 的 rules、commands、hooks、agents 需要正确生成。

Trellis 为你的栈生成 **Cursor 适配层**（`.cursor/`）。本 fork 的 init 与公开文档为 **Cursor-only**（见 [docs/cursor.zh-CN.md](docs/cursor.zh-CN.md)）。

## 快速开始（Cursor）

**1. 安装 CLI**（全局或项目内）：

```bash
npm install -g @blxzer/cursor-trellis
trellis --version
```

**2. 在你的应用仓库根目录初始化**（不是 Trellis 源码目录）：

```bash
cd /path/to/your-app
trellis init --cursor
```

**3. 用 Cursor 打开项目**，使用 Agent 模式。用户可见斜杠命令包括 `/trellis-continue`、`/trellis-finish-work`。Request Triage 由 `.cursor/rules/trellis-triage.mdc` 强制执行。

可选：`trellis init --cursor --cursor2plus` 物化 Cursor++ BYOK 本地包；见 [docs/cursor.zh-CN.md](docs/cursor.zh-CN.md#cursor可选附录)。

## 初始化后会出现什么

```text
your-app/
  .trellis/          workflow、spec、tasks、workspace、scripts
  AGENTS.md          Trellis 管理的 Agent 入口
  .cursor/           commands、rules、agents、hooks（Cursor）
```

详见 [Cursor 集成](docs/cursor.zh-CN.md)。

## 核心概念

| 路径 | 作用 |
| --- | --- |
| `.trellis/workflow.md` | 生命周期：triage、规划、执行、收尾、学习 |
| `.trellis/spec/` | 分层/分包编码规范 |
| `.trellis/tasks/` | PRD、design、implement、verify 工件 |
| `.trellis/workspace/` | 开发者日志与会话延续 |

## 工作流（摘要）

1. 每轮请求 **Triage**（`No Task` → `Parent Task`）。
2. 持久性工作 **规划** 任务工件（尤其 Full Task）。
3. **门禁**：`task.py validate` + `start-execution --check`。
4. 用户 **明确批准** 后 `start-execution --approved`。
5. **验证** 并收尾（`/trellis-finish-work`）。

实操指南：[docs/workflow.zh-CN.md](docs/workflow.zh-CN.md)。

## Cursor 支持

- **Rules** — 常驻策略（含 Triage）。
- **Commands** — 精简 `/` 面板（commands-only；默认不向 `.cursor/skills/` 写入内部 skills）。
- **Agents** — `trellis-research`、`trellis-implement`、`trellis-check`。
- **Hooks** — Python 脚本：会话、终端、子 Agent 上下文。

深入说明：[docs/cursor.zh-CN.md](docs/cursor.zh-CN.md)。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `trellis init --cursor` | 在当前项目创建 `.trellis/` + `.cursor/` |
| `trellis update` | 按已安装 CLI 版本刷新模板 |
| `trellis uninstall` | 从项目中移除 Trellis 管理文件 |

参数与行为：[packages/cli/README.zh-CN.md](packages/cli/README.zh-CN.md)。

其他 CLI 命令（`rollout`、`upgrade` 等）仅在 CLI README 简表中列出。

## 架构（摘要）

Monorepo：`packages/core`（SDK）+ `packages/cli`（模板、configurator、可执行文件）。`init` 经 `configureCursor()` 写入 `.cursor/`。**smart-search** 以 vendored CLI 形式随包分发，用于网页检索。

图示与数据流：[docs/architecture.zh-CN.md](docs/architecture.zh-CN.md)。

## 开发与验证

在**本仓库**贡献代码时：

```bash
pnpm install
pnpm build
pnpm test
```

包级说明：[packages/cli/README.zh-CN.md](packages/cli/README.zh-CN.md)。面向 Agent 的代码库导览：[AGENTS.md](AGENTS.md)。

## 维护者说明

`D:\MyHarness` harness 布局、Git remote 策略、release/publish 与深层实现见**内部**文档 [docs/maintainers.md](docs/maintainers.md)。公开文档故意不写 npm 发布与私有 remote 操作步骤。

## 延伸阅读

| 文档 | 主题 |
| --- | --- |
| [docs/workflow.zh-CN.md](docs/workflow.zh-CN.md) | Cursor 中的任务生命周期 |
| [docs/cursor.zh-CN.md](docs/cursor.zh-CN.md) | Cursor 生成文件 |
| [docs/architecture.zh-CN.md](docs/architecture.zh-CN.md) | 高层架构与 smart-search |
| [packages/cli/README.zh-CN.md](packages/cli/README.zh-CN.md) | CLI / npm 参考 |
| [CHANGELOG](packages/cli/CHANGELOG.md) | 包变更历史 |

## 许可证

AGPL-3.0-only — 见 `packages/cli/package.json`。