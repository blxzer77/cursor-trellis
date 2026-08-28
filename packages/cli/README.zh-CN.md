# @blxzer/cursor-trellis

[English](README.md) | 简体中文

Trellis CLI 的 npm 包。项目总览：[../../README.zh-CN.md](../../README.zh-CN.md)。Cursor 工作流：[../../docs/workflow.zh-CN.md](../../docs/workflow.zh-CN.md)。

**为何 `cstl` 与 `.cstl/`？** CLI 为 `cstl`（非 `trellis`），运行时目录为 `.cstl/`（非 `.trellis/`），以便与上游 Trellis 在同一仓库共存。详见[仓库 README](../../README.zh-CN.md#为何使用-cstl-与-cstl)。

## 安装

```bash
npm install -g @blxzer/cursor-trellis
```

需要 **Node.js ≥ 18.17**。生成项目的钩子在运行 Cursor 的机器上需要 **Python ≥ 3.9**。

## 从 0.3.0 升级（v0.3.1）

v0.3.1 将 cursor-trellis **运行时目录**从 `.trellis/` 迁至 **`.cstl/`**。

```bash
npm install -g @blxzer/cursor-trellis@latest
cd /path/to/your-app
cstl update --migrate
```

`--migrate` **必须**带上；历史通过目录 rename 保留。脚本路径为 `python ./.cstl/scripts/...`。

## 从 0.2.x 升级（v0.3.0）

v0.3.0 为**硬切更名**：CLI 仅保留 **`cstl`**，`trellis` 与 `tl` 两个 bin 别名已移除。

| 变了 | 没变 |
| --- | --- |
| CLI：`trellis` / `tl` → `cstl` | （0.3.1+）运行时目录为 `.cstl/` |
| skill / command / agent / rule：`trellis-*` → `cstl-*` | `trellis-task-models.json5` 文件名 |

**迁移步骤**（每个项目执行一次）：

```bash
npm install -g @blxzer/cursor-trellis@latest
cd /path/to/your-app
cstl update --migrate
```

`--migrate` **必须**带上，才会重命名 `.cursor/` 下的 `trellis-*` → `cstl-*`。重命名经哈希校验；若你本地改过文件，会保留旧路径并警告——请手动改名或把自定义内容迁到新的 `cstl-*` 路径。

0.3.0 之后日常 CLI 小版本可用 `cstl upgrade`。升级到 0.3.0 后，旧的 `trellis upgrade` 命令已不存在。

**Cursor++ 已废弃：** 勿运行 setup/patch。遗留 `.cstl/local/cursor2plus/` 或历史 `trellis-task-models.json5` 视为残渣——`cstl update` 清理未改动托管副本。

详见 [CHANGELOG](./CHANGELOG.md#030---2026-07-01)。

## 可执行文件

| Bin | 作用 |
| --- | --- |
| `cstl` | 在项目中初始化、更新、管理 Trellis |
| `smart-search` | 独立 Middleware 探测包装；缺失时降级，不作为同包自动安装契约（见 [smart-search](#smart-search)） |

```bash
cstl --version
smart-search --version
```

## 命令一览（摘要）

| 命令 | 用途 |
| --- | --- |
| `init` | 创建 `.cstl/` 与所选平台目录 |
| `update` | 将模板同步到当前安装的 CLI 版本 |
| `uninstall` | 从项目中移除 Trellis 管理文件 |
| `upgrade` | 升级全局 CLI npm 包 |
| `rollout` | 对多个项目路径批量 `update` |
| `workflow` | 工作流模板工具（进阶） |

与 **channel** 相关的命令服务于进阶多 Agent 工作流，不属于 Cursor-first 公开文档范围。完整列表：`cstl --help`。

下文详述 **`init`**、**`update`**、**`uninstall`**。

---

## `cstl init`

在**目标项目根目录**执行：

```bash
cstl init --cursor
```

### 平台标志

| 标志 | 平台 |
| --- | --- |
| `--cursor` | Cursor（`.cursor/`）— 默认文档路径 |

本 fork 的 init 与公开文档为 **Cursor-only**：[../../docs/cursor.zh-CN.md](../../docs/cursor.zh-CN.md)。默认分发为 Native Cursor；CSTL **不内嵌 BYOK**。

### 常用标志

| 标志 | 说明 |
| --- | --- |
| `-y, --yes` | 非交互默认项 |
| `-f, --force` | 覆盖已有受管文件 |
| `-s, --skip-existing` | 跳过已存在文件 |
| `-u, --user <name>` | 开发者身份 |
| `--skip-readiness` | 跳过 smart-search / 能力项 readiness |
| `--capability <id>` | 启用可选能力（可重复；`all` 表示全部可选） |
| `--workflow <id>` | `.cstl/workflow.md` 工作流模板 |
| `-t, --template <name>` | 远程 spec 模板 |
| `-r, --registry <source>` | 自定义模板 registry |
| `--monorepo` / `--no-monorepo` | monorepo 检测覆盖 |

### 生成内容

- `.cstl/` — workflow、spec、tasks、workspace、scripts、模板哈希
- `AGENTS.md` — 受管说明块
- 平台目录 — Cursor 下为 `.cursor/commands`、`rules`、`agents`、`hooks`、`hooks.json`、`worktrees.json`

---

## `cstl update`

在已有 `.cstl/` 的项目根目录：

```bash
cstl update
cstl update --dry-run
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

常见流程：升级全局 CLI → 进入项目 → `cstl update`（从 0.2.x 首次升到 0.3.0 须加 `--migrate`）→ 若自定义过 workflow/rules 请审阅 diff。

---

## `cstl uninstall`

```bash
cstl uninstall
cstl uninstall --dry-run
cstl uninstall -y
```

### 标志

| 标志 | 说明 |
| --- | --- |
| `-y, --yes` | 跳过确认 |
| `--dry-run` | 仅列出将删除/_scrub_ 的内容 |

按哈希清单与结构化 scrubber 移除受管平台文件及 `.cstl/`。卸载前请**备份**自定义 workflow 或 rules。

---

## smart-search 集成

Trellis 把 [smart-search](https://github.com/blxzer77/smart-search) 当作独立的 `external-knowledge` **Middleware Provider**。CSTL 只做运行时探测。安装 cursor-trellis **并不**契约式地自动安装 smart-search；smart-search 发版也不得迫使 CSTL Core 发版。

**安装：**

请单独安装该 Provider（或在包管理器提供可选安装时接受）：

```bash
npm install -g @blxzer/smart-search
smart-search --version
```

Provider 缺失时 Profile 为 `degraded`。不需要外部知识的 Task 仍可 Close。真正需要的 Task 会阻塞，或按 Policy 降级。平台原生 Web 是降级，不是等价物。

**链接：**
- npm 包：https://www.npmjs.com/package/@blxzer/smart-search
- GitHub 仓库：https://github.com/blxzer77/smart-search

工作流在 Provider 就绪时把外部事实查询路由到 smart-search。配置与用法见其仓库。

---

## 维护者脚本（本包）

面向**编辑本仓库**的贡献者，终端用户不必运行：

| 脚本 | 用途 |
| --- | --- |
| `pnpm build` | `tsc` + 拷贝模板 |
| `pnpm test` | Vitest |
| `pnpm mirror-check` | Dogfood `.cursor` / `.agents` vs templates |
| `pnpm run sync:smart-search` | 刷新 bundled `smart-search-cli` skill（从 smart-search 仓库拷贝；非 vendor 源码） |

Release 与 npm 发布流程**不在**公开 README 中；见内部维护文档。

---

## 延伸阅读

- [项目 README](../../README.zh-CN.md)
- [Cursor 集成](../../docs/cursor.zh-CN.md)
- [架构概览](../../docs/architecture.zh-CN.md)

> **Cursor++ 已废弃：** Trellis 不再提供 Cursor++ 安装面（`cstl-cursor2plus-setup`、`.cstl/local/cursor2plus/`）。产品路径 = **Native Cursor**。CSTL **不内嵌 BYOK**。**勿**运行 `patch_wpelc8.py`。遗留 local 包视为残渣（`cstl update` 对未改动的托管文件做哈希安全清理）。`cursorEnv` / `TRELLIS_CURSOR_BYOK` / `~/.ccursor/routes.json` 仅作检索环境探测。

- [CHANGELOG](./CHANGELOG.md)