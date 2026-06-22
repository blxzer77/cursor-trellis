# @blxzer/cursor-trellis

[English](README.md) | 简体中文

Trellis CLI 的 npm 包。项目总览：[../../README.zh-CN.md](../../README.zh-CN.md)。Cursor 工作流：[../../docs/workflow.zh-CN.md](../../docs/workflow.zh-CN.md)。

## 安装

```bash
npm install -g @blxzer/cursor-trellis
```

需要 **Node.js ≥ 18.17**。生成项目的钩子在运行 Cursor 的机器上需要 **Python ≥ 3.9**。

## 可执行文件

| Bin | 别名 | 作用 |
| --- | --- | --- |
| `trellis` | `tl` | 在项目中初始化、更新、管理 Trellis |
| `smart-search` | — | 随包分发的网页检索 CLI（见 [smart-search](#smart-search)） |

```bash
trellis --version
smart-search --version
```

## 命令一览（摘要）

| 命令 | 用途 |
| --- | --- |
| `init` | 创建 `.trellis/` 与所选平台目录 |
| `update` | 将模板同步到当前安装的 CLI 版本 |
| `uninstall` | 从项目中移除 Trellis 管理文件 |
| `upgrade` | 升级全局 CLI npm 包 |
| `rollout` | 对多个项目路径批量 `update` |
| `workflow` | 工作流模板工具（进阶） |

与 **channel** 相关的命令服务于进阶多 Agent 工作流，不属于 Cursor-first 公开文档范围。完整列表：`trellis --help`。

下文详述 **`init`**、**`update`**、**`uninstall`**。

---

## `trellis init`

在**目标项目根目录**执行：

```bash
trellis init --cursor
```

### 平台标志

| 标志 | 平台 |
| --- | --- |
| `--cursor` | Cursor（`.cursor/`）— 默认文档路径 |
| `--cursor2plus` | Cursor++ BYOK 本地包（须同时 `--cursor`） |

本 fork 的 init 与公开文档为 **Cursor-only**：[../../docs/cursor.zh-CN.md](../../docs/cursor.zh-CN.md)。

### 常用标志

| 标志 | 说明 |
| --- | --- |
| `-y, --yes` | 非交互默认项 |
| `-f, --force` | 覆盖已有受管文件 |
| `-s, --skip-existing` | 跳过已存在文件 |
| `--cursor2plus` | 物化 Cursor++ BYOK 包（须同时 `--cursor`） |
| `-u, --user <name>` | 开发者身份 |
| `--skip-readiness` | 跳过 smart-search / 能力项 readiness |
| `--capability <id>` | 启用可选能力（可重复；`all` 表示全部可选） |
| `--workflow <id>` | `.trellis/workflow.md` 工作流模板 |
| `-t, --template <name>` | 远程 spec 模板 |
| `-r, --registry <source>` | 自定义模板 registry |
| `--monorepo` / `--no-monorepo` | monorepo 检测覆盖 |

### 生成内容

- `.trellis/` — workflow、spec、tasks、workspace、scripts、模板哈希
- `AGENTS.md` — 受管说明块
- 平台目录 — Cursor 下为 `.cursor/commands`、`rules`、`agents`、`hooks`、`hooks.json`、`worktrees.json`

---

## `trellis update`

在已有 `.trellis/` 的项目根目录：

```bash
trellis update
trellis update --dry-run
```

### 标志

| 标志 | 说明 |
| --- | --- |
| `--dry-run` | 仅预览不写盘 |
| `-f, --force` | 覆盖所有有变更的受管文件 |
| `-s, --skip-all` | 跳过所有有变更文件 |
| `-n, --create-new` | 对有变更文件写 `.new` 副本 |
| `--migrate` | 执行待处理路径迁移（重命名/删除） |
| `--allow-downgrade` | 允许模板版本低于记录版本 |
| `--skip-readiness` | 跳过 readiness 复检 |
| `--json` | 单行 JSON rollout 证据 |
| `--skip-post-update-smoke` | 跳过应用后 Python 冒烟脚本 |

常见流程：升级全局 CLI → 进入项目 → `trellis update` → 若自定义过 workflow/rules 请审阅 diff。

---

## `trellis uninstall`

```bash
trellis uninstall
trellis uninstall --dry-run
trellis uninstall -y
```

### 标志

| 标志 | 说明 |
| --- | --- |
| `-y, --yes` | 跳过确认 |
| `--dry-run` | 仅列出将删除/_scrub_ 的内容 |

按哈希清单与结构化 scrubber 移除受管平台文件及 `.trellis/`。卸载前请**备份**自定义 workflow 或 rules。

---

## smart-search

内置于本包（`vendor/smart-search/`，bin 名 `smart-search`）。

| 主题 | 说明 |
| --- | --- |
| 是什么 | 用于 search、fetch、doctor、research 的 CLI，**不是** MCP 服务 |
| Agent 何时用 | 项目 `.trellis/workflow.md` 约定外部事实在健康时**优先**走 smart-search |
| 配置 | `smart-search setup`、`smart-search doctor`（见 [vendor README](vendor/smart-search/README.zh-CN.md)） |
| Readiness | `init`/`update` 默认检查，可用 `--skip-readiness` 跳过 |

```bash
smart-search search "查询" --format json
smart-search doctor --format markdown
```

更新 vendor 快照为维护者操作（本包内 `pnpm run sync:smart-search`）。见 [../../docs/maintainers.md](../../docs/maintainers.md)。

---

## 维护者脚本（本包）

面向**编辑本仓库**的贡献者，终端用户不必运行：

| 脚本 | 用途 |
| --- | --- |
| `pnpm build` | `tsc` + 拷贝模板 |
| `pnpm test` | Vitest |
| `pnpm run sync:smart-search` | 刷新 vendor |

Release 与 npm 发布流程**不在**公开 README 中；见内部维护文档。

---

## 延伸阅读

- [项目 README](../../README.zh-CN.md)
- [Cursor 集成](../../docs/cursor.zh-CN.md)
- [架构概览](../../docs/architecture.zh-CN.md)
- [CHANGELOG](./CHANGELOG.md)