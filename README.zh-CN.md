# cursor-trellis

[English](README.md) | 简体中文

**Trellis** 是面向 AI 编程 Agent 的渐进式上下文管理系统。它将 Agent 指令结构化为 `.trellis/`（workflow、spec、tasks、workspace）而非单一大文件，并生成平台特定的集成文件（Cursor 为 `.cursor/`）。

基于 [mindfold-ai 的 Trellis 框架](https://github.com/mindfold-ai/Trellis)，本版本针对 Cursor 适配，包含 rules、commands、agents、hooks。

## 功能

- 任务工件（PRD、设计、实现计划）持久化在 `.trellis/tasks/`
- 通过 `/trellis-continue` 跨会话恢复工作
- 根据正在编辑的文件渐进式加载规范
- 结构化工作流路由请求：triage → plan → gate → execute → verify

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `trellis init --cursor` | 在当前项目创建 `.trellis/` + `.cursor/` |
| `trellis update` | 按已安装 CLI 版本刷新模板 |
| `trellis uninstall` | 从项目中移除 Trellis 管理文件 |

完整 CLI 参考：[packages/cli/README.zh-CN.md](packages/cli/README.zh-CN.md)。

## 包信息

| | |
| --- | --- |
| **npm CLI** | `@blxzer/cursor-trellis`（`trellis`、`tl`） |
| **Core SDK** | `@blxzer/cursor-trellis-core` |
| **smart-search** | `@blxzer/smart-search`（自动安装的依赖） |
| **本仓库** | https://github.com/blxzer77/cursor-trellis |
| **原版 Trellis** | [mindfold-ai/Trellis](https://github.com/mindfold-ai/Trellis) |

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

实操指南：[workflow.zh-CN.md](docs/workflow.zh-CN.md) — Triage 决策树、Task Ladder、升降级规则、Parent/Child 任务树、Phase 1–3 生命周期。

## Cursor 支持

- **Rules** — 常驻策略（含 Triage 与检索路由）。
- **Commands** — 精简 `/` 面板（commands-only；默认不向 `.cursor/skills/` 写入内部 skills）。
- **Agents** — `trellis-research`、`trellis-implement`、`trellis-check`。
- **Hooks** — Python 脚本：会话、终端、子 Agent 上下文。

深入说明：[docs/cursor.zh-CN.md](docs/cursor.zh-CN.md) — Native vs Cursor++ BYOK 双环境、子 Agent 派发 Method 1–4、环境探测。检索层设计：[docs/retrieval.zh-CN.md](docs/retrieval.zh-CN.md)。

## 适用场景

- 需要架构一致性的多文件重构
- 跨多个会话的长周期功能开发
- 有自定义编码规范需要 Agent 遵守的项目
- 需要 研究 → 设计 → 实现 → 验证 工作流的任务

快速单文件编辑或探索性编码不需要使用。

## smart-search 集成

Trellis 集成了 [smart-search](https://github.com/blxzer77/smart-search)，这是一个供 Agent 从网络获取实时信息的 CLI 工具。安装 cursor-trellis 时，smart-search 会作为依赖自动安装。

**安装：**

安装 cursor-trellis 时，smart-search 自动安装：

```bash
npm install -g @blxzer/cursor-trellis
# smart-search 现已可用
smart-search --version
```

**链接：**
- npm 包：https://www.npmjs.com/package/@blxzer/smart-search
- GitHub 仓库：https://github.com/blxzer77/smart-search

工作流在可用时将外部事实查询路由到 smart-search。详见仓库了解配置和使用。

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
| [docs/retrieval.zh-CN.md](docs/retrieval.zh-CN.md) | 检索层设计 |
| [docs/architecture.zh-CN.md](docs/architecture.zh-CN.md) | 高层架构与 smart-search |
| [packages/cli/README.zh-CN.md](packages/cli/README.zh-CN.md) | CLI / npm 参考 |
| [CHANGELOG](packages/cli/CHANGELOG.md) | 包变更历史 |

## 许可证

AGPL-3.0-only — 见 `packages/cli/package.json`。