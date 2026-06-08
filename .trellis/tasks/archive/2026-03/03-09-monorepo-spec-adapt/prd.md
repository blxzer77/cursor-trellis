# Monorepo Workflow 全面适配

## Goal

将 Trellis 的整个 workflow 体系（spec、commands/skills、hooks、tasks、sessions、parallel）适配 monorepo 结构，同时保持对单仓库项目的向前兼容。

## Background

monorepo 重构后（父任务 03-09-monorepo-submodule），`src/` 移到了 `packages/cli/src/`。Trellis workflow 体系中大量路径引用、context 注入、session 记录都假定单仓库结构，需要全面适配。

用户反馈的完整范围：
> "不只是spec，这个是很多东西的情况，比如说从slash command的引导，默认hook的注入，ai知道monorepo的基础情况，以及后续的task 实施，parallel worktree的支持，record-session的时候能标记记录的是哪个repo，以及对单仓库的向前兼容，这些都需要考虑"

---

## Phase 1: 路径替换（已完成 ✅）

### Part A: Spec 目录重组 ✅

将 `.trellis/spec/` 从扁平的 `backend/`、`frontend/` 改为按 package 组织：

```
.trellis/spec/
├── cli/                         # 对应 packages/cli/
│   ├── backend/
│   ├── unit-test/
│   └── frontend/
├── guides/                      # 跨 package 共享（不动）
```

### Part B: Commands/Skills 路径更新 ✅

所有 4 平台 commands + agents + skills 中的 spec 路径已更新（~55 文件）：
- `.claude/` (18 文件)、`.cursor/` (10 文件)、`.agents/` (12 文件)、`.opencode/` (14 文件)
- `.trellis/workflow.md`、`scripts/task.py`、`scripts/create_bootstrap.py`

### Part D-partial: init-context 路径 ✅

`task.py` 中 `get_implement_backend()` 和 `get_implement_frontend()` 已更新为 `spec/cli/backend/`、`spec/cli/frontend/`。

---

## Phase 2: 泛化 + 动态感知

### Part 1: 合并 Type-Specific 命令（P1）

**问题**：每个 spec 类型一个命令，N 个 package × M 个类型 = N×M 个命令，不 scale。

**现在**（每增加一个 package 就要新建命令）：
| 命令 | 数量 | 平台副本 |
|------|------|----------|
| `before-backend-dev` | 1 | ×4 |
| `before-frontend-dev` | 1 | ×4 |
| `before-docs-dev` (docs-site) | 1 | ×4 |
| `check-backend` | 1 | ×4 |
| `check-frontend` | 1 | ×4 |
| `check-docs` (docs-site) | 1 | ×4 |
| `improve-ut` (隐含绑定单测试套件) | 1 | ×4 |
| **合计** | 7 | 28 文件 |

**合并为**（package 数量无关）：
| 命令 | 逻辑 | 平台副本 |
|------|------|----------|
| `before-dev` | 自动发现 `spec/*/index.md`，按任务选择对应 spec 读取 | ×4 |
| `check` | 根据 git diff 检测改了哪个 package，加载对应 spec | ×4 |
| `improve-ut` | 泛化：检测 `spec/*/unit-test/` | ×4 |
| **合计** | 3 | 12 文件 |

**Spec 自动发现规则**：
```
.trellis/spec/
├── cli/backend/index.md      → 自动发现 "cli/backend"
├── cli/unit-test/index.md    → 自动发现 "cli/unit-test"
├── docs-site/index.md        → 自动发现 "docs-site"
└── guides/index.md           → 跨 package 共享，始终加载
```

新增 package 只需建 `spec/<package>/` 目录，命令零改动。

#### P1 脚本改动明细（CLI 模板复用参考）

> 以下改动发生在 `.trellis/scripts/`，后续同步到 `packages/cli/src/templates/trellis/scripts/` 时可直接复用。

**`task.py` — `get_check_context()` 和 `get_debug_context()`**

| Before | After |
|--------|-------|
| `get_check_context(dev_type: str, repo_root: Path)` | `get_check_context(repo_root: Path)` |
| `get_debug_context(dev_type: str, repo_root: Path)` | `get_debug_context(repo_root: Path)` |
| 按 `dev_type` 分别注入 `check-backend`/`check-frontend` | 统一注入泛型 `check` 命令 |
| 调用处传 `(dev_type, repo_root)` | 调用处传 `(repo_root)` |

改动原因：`check` 命令自身已包含 spec 自动发现逻辑，不再需要 `dev_type` 来决定注入哪个 check 文件。`dev_type` 参数仍在 `get_implement_*()` 系列函数中使用（决定注入 backend/frontend spec），暂不移除。

**`inject-subagent-context.py`（`.claude/hooks/`）和 `inject-subagent-context.js`（`.opencode/plugin/`）**

| Before | After |
|--------|-------|
| check fallback: `[finish-work, check-cross-layer, check-backend, check-frontend]` | `[finish-work, check-cross-layer, check]` |
| debug fallback: `[check-backend, check-frontend, check-cross-layer]` | `[check, check-cross-layer]` |

改动原因：fallback 路径（当 `check.jsonl` 不存在时使用）需匹配新的泛型命令文件名。

**`cli_adapter.py`（`.trellis/scripts/common/`）**

仅 docstring 示例更新：`check-backend` → `check`。无逻辑变更。

---

### Part 2: Task 系统 package 字段（P2）✅

**task.json 新增 `package` 字段**：
```json
{
  "id": "add-auth",
  "package": "cli",
  "dev_type": "backend",
  ...
}
```

**影响的脚本**：
- `task.py create --package <name>` — 创建时指定 package
- `task.py init-context` — 用 package 解析 spec 路径：`spec/<package>/<layer>/`
- `task.py list` — 显示 package 列（`@cli` 形式）
- 无 `--package` 时 fallback 到 `cli`（兼容单仓库）

#### P2 脚本改动明细（CLI 模板复用参考）

> 以下改动发生在 `.trellis/scripts/task.py`，后续同步到 `packages/cli/src/templates/trellis/scripts/` 时可直接复用。

**`task.py` — argparse**

| 命令 | 新增参数 |
|------|----------|
| `create` | `--package` — 可选，写入 `task.json` 的 `package` 字段 |
| `init-context` | `--package` — 默认 `cli`，用于解析 spec 路径 |

**`task.py` — `get_implement_backend()` / `get_implement_frontend()`**

| Before | After |
|--------|-------|
| `get_implement_backend()` | `get_implement_backend(package="cli")` |
| `get_implement_frontend()` | `get_implement_frontend(package="cli")` |
| 硬编码 `spec/cli/backend/index.md` | `spec/{package}/backend/index.md` |

**`task.py` — `cmd_init_context()`**

读取 `args.package`（默认 `cli`），传递给 `get_implement_backend(package)` / `get_implement_frontend(package)`。

**`task.py` — `cmd_create()`**

`task_data` 新增 `"package": args.package or None`。

**`task.py` — `cmd_list()` 显示**

收集 `data.get("package")`，输出时追加 `@{pkg}` 标签（仅当 package 非空时显示）。

### Part 3: config.yaml packages 配置 + get_context.py 增强（P3）

#### 架构决策：config → scripts → md 单向数据流

```
config.yaml (source of truth)
    ↓
config.py 读取函数 (get_packages / get_default_package)
    ↓
脚本输出 (get_context.py --packages)
    ↓
md 文档引导 AI 调脚本（取代 ls -d spec/*/）
```

**设计原则**：md 文件不直接读 filesystem，而是引导 AI 调脚本；脚本从 config.yaml 读权威配置。单一数据源，避免各处各自检测。

#### P3a: config.yaml 新增 `packages` 配置

```yaml
# Monorepo / Package 配置
packages:
  cli:
    path: packages/cli
  docs-site:
    path: docs-site
    type: submodule

default_package: cli
```

- `packages` — 声明项目中的 package 及其源码路径
- `type: submodule` — 可选标记，区分普通目录与 git submodule
- `default_package` — `--package` 缺省时的默认值
- 单仓库项目：不配 `packages` 字段，脚本 fallback 到 `spec/backend/` 直接路径（向前兼容）

#### P3b: config.py 新增读取函数

```python
def get_packages(repo_root=None) -> dict[str, dict]:
    """读取 packages 配置。无配置时返回空 dict。"""

def get_default_package(repo_root=None) -> str | None:
    """读取 default_package。无配置时返回 None。"""
```

#### P3c: get_context.py 新增 `--packages` 输出

```bash
python3 ./.trellis/scripts/get_context.py --packages
```

输出示例：
```
Available packages:
  cli          packages/cli        [backend, frontend, unit-test]
  docs-site    docs-site           [docs]  (submodule)

Default package: cli
```

- `spec_layers` 从 `spec/<package>/` 目录自动扫描（不需要在 config 声明）
- 无 `packages` 配置时输出 `(single-repo mode)` 并列出 `spec/` 下的直接子目录

`get_context.py` 默认模式（无 `--packages`）也在输出中追加一段 monorepo 概览，供 `/trellis:start` 消费。

#### P3d: 追溯优化 — task.py `--package` 默认值从 config 读取

P2 中 `--package` 默认硬编码为 `cli`。P3 完成后改为：
```python
package = args.package or get_default_package(repo_root) or "cli"
```

优先级：命令行参数 > config.yaml > 硬编码 fallback

#### P3e: 追溯优化 — md 文件从 `ls` 改为脚本调用

P4 中 md 文件用 `ls -d .trellis/spec/*/` 做发现。P3 完成后替换为：
```bash
python3 ./.trellis/scripts/get_context.py --packages
```

受影响文件（×4 平台）：`start.md`、`before-dev.md`、`workflow.md`

**好处**：AI 获得结构化信息（包名、路径、spec 层级、submodule 标记），比原始 `ls` 输出丰富得多。

#### P3 脚本改动明细（CLI 模板复用参考）

> 以下改动后续同步到 `packages/cli/src/templates/` 时可直接复用。

| 文件 | 改动 | 可泛用 |
|------|------|--------|
| `config.yaml` | 新增 `packages` + `default_package` 字段 | ✅ 模板中加空配置 + 注释 |
| `config.py` | 新增 `get_packages()` + `get_default_package()` | ✅ |
| `get_context.py` | 新增 `--packages` flag + monorepo 概览输出 | ✅ |
| `task.py` | `--package` 默认值改为从 config 读取 | ✅ |
| `start.md` (×4) | `ls -d spec/*/` → `get_context.py --packages` | ✅ |
| `before-dev.md` (×4) | 同上 | ✅ |
| `workflow.md` | 同上 | ✅ |

### Part 4: start.md + workflow.md 动态发现（P4）✅

> 已完成初版（使用 `ls -d spec/*/`）。P3e 完成后会升级为脚本调用。

**start.md 改为指令式**（不硬编码路径）：
```
1. 列出 spec 模块: ls -d .trellis/spec/*/
2. 读取你要工作的 package 对应的 index.md
3. 始终读取 .trellis/spec/guides/index.md（跨 package 共享）
```

**workflow.md 更新**：
- 说明 spec 目录约定：`spec/<package>/<layer>/`
- `guides/` 是跨 package 共享的特殊目录
- Quick Reference / Code Quality Checklist 引导到 `/trellis:check` 和 spec `index.md` 的 Quality Check 节
- File System 树形图改为泛化写法（`<package>/<layer>/`）

#### P4 改动文件清单（CLI 模板复用参考）

> 纯文档改动，无脚本逻辑变更。后续同步到 `packages/cli/src/templates/` 即可。

| 文件 | 改动 |
|------|------|
| `start.md` (×4 平台) | Step 3 从硬编码 `spec/cli/{frontend,backend}/index.md` → `ls -d .trellis/spec/*/` + `cat spec/<package>/<layer>/index.md` |
| `workflow.md` | Step 2 + Step 3 动态发现；File System 树泛化；Code Quality Checklist 指向 `/check` 和 spec Quality Check 节；Quick Reference 改为发现步骤 |

### Part 5: docs-site 迁移（P5）

**迁移到根目录的独有内容**：
| 来源 | 目标 |
|------|------|
| `docs-site/.claude/commands/trellis/before-docs-dev.md` | `.claude/commands/trellis/before-docs-dev.md`（Phase 2 Part 1 后会被合并进 `before-dev.md`）|
| `docs-site/.claude/commands/trellis/check-docs.md` | 同上 → 合并进 `check.md` |
| `docs-site/.claude/commands/trellis/commit.md` | `.claude/commands/trellis/commit.md` |
| `docs-site/.claude/skills/contribute/SKILL.md` | `.claude/skills/contribute/SKILL.md` |
| `docs-site/.trellis/spec/docs/` (7 文件) | `.trellis/spec/docs-site/` |

**从 submodule 删除的冗余配置**：
- `docs-site/.claude/` 整个目录
- `docs-site/.cursor/` 整个目录
- `docs-site/.trellis/scripts/`、`workflow.md`、`.template-hashes.json`、`.version`、`.gitignore`、`worktree.yaml`、`spec/guides/`

**保留**：`docs-site/.trellis/tasks/`（历史记录）、`docs-site/.trellis/workspace/`（journal）

**需要两次 commit**：submodule 内部 + 父仓库

### Part 6: Session 记录 package 标记（P6）

`add_session.py --package cli` → journal 里标注涉及的 package，方便按 package 过滤历史。

### Part 7: 向前兼容（P7）

**检测逻辑**（基于 config.yaml）：
- 有 `packages` 字段 → monorepo 模式，从配置读取 package 列表
- 无 `packages` 字段 → 单仓库模式（legacy），`spec/` 下直接是 `backend/`、`frontend/`
- 所有脚本和命令都需支持两种模式

**兼容规则**：
- `get_default_package()` 返回 None → 单仓库，spec 路径为 `spec/backend/`
- `get_default_package()` 返回值 → monorepo，spec 路径为 `spec/<package>/backend/`
- `get_context.py --packages` 无配置时输出 `(single-repo mode)` + 直接列出 `spec/` 子目录
- 模板源文件（`packages/cli/src/templates/`）**不改**——面向用户单仓库项目
- 模板中 `config.yaml` 加空 `packages` 注释块 + 说明，用户按需启用

### Part 8: Parallel / Agent / Hook 硬编码路径清理（P8）

Phase 1-3 更新了 commands 和 scripts，但遗留了一批 agent 定义、hook 脚本、parallel 命令中的硬编码 `spec/cli/` 路径。

#### P8a: parallel.md 动态发现（×3 平台）

| 文件 | 问题 |
|------|------|
| `.claude/commands/trellis/parallel.md` | 硬编码 `cat .trellis/spec/cli/frontend/index.md` 和 `spec/cli/backend/index.md` |
| `.agents/skills/parallel/SKILL.md` | 同上 |
| `.opencode/commands/trellis/parallel.md` | 同上 |

**改法**：同 P3e 模式，替换为 `python3 ./.trellis/scripts/get_context.py --mode packages` + `cat .trellis/spec/<package>/<layer>/index.md`。

#### P8b: Agent 定义文件泛化（×4 文件）

| 文件 | 问题 |
|------|------|
| `.claude/agents/implement.md` | 硬编码 `spec/cli/backend/`、`spec/cli/frontend/` |
| `.claude/agents/check.md` | 硬编码 `spec/cli/backend/index.md` |
| `.opencode/agents/implement.md` | 同上 |
| `.opencode/agents/research.md` | 硬编码 `spec/cli/frontend/`、`spec/cli/backend/` |

**改法**：将 `spec/cli/<layer>/` 替换为 `spec/<package>/<layer>/`，或引导 agent 先调 `get_context.py --mode packages` 获取实际结构。

#### P8c: Hook `get_research_context()` 动态 spec 树

| 文件 | 问题 |
|------|------|
| `.claude/hooks/inject-subagent-context.py` | `get_research_context()` 硬编码静态 spec 目录描述（`shared/`、`frontend/`、`backend/`），不匹配实际结构 |

**改法**：将静态目录树替换为动态生成（读 `get_packages()` + 扫描 `spec/` 目录），或简化为引导 research agent 自行运行 `get_context.py --mode packages`。

#### P8d: OpenCode session-start 插件

| 文件 | 问题 |
|------|------|
| `.opencode/plugin/session-start.js` | 硬编码 `spec/cli/frontend/index.md`、`spec/cli/backend/index.md` |

**改法**：同 P8a，替换为动态发现。

#### P8 脚本改动明细（CLI 模板复用参考）

| 文件 | 改动 | 可泛用 |
|------|------|--------|
| `parallel.md` (×3) | 硬编码 spec 路径 → 动态发现 | ✅ |
| `agents/implement.md` (×2) | `spec/cli/` → `spec/<package>/` | ✅ |
| `agents/check.md` | 同上 | ✅ |
| `agents/research.md` | 同上 | ✅ |
| `inject-subagent-context.py` | 静态 spec 树 → 动态生成 | ✅ |
| `session-start.js` | 硬编码 spec 路径 → 动态发现 | ✅ |

> 注：模板源（`packages/cli/src/templates/`）中 hook 还有 `check-backend.md`/`check-frontend.md` 过时引用，但模板源改动属于 Out of Scope。

### Part 9: Worktree Submodule 按需初始化（P9）

#### 问题

`git worktree add` 不会初始化 submodule（Git 官方限制："support for submodules is incomplete"）。Monorepo 中如果有 submodule 类型的 package，worktree 里对应目录为空。

**全量 init 不可行**：用户可能有几十上百个 submodule，每个 worktree 都 `git submodule update --init --recursive` 会浪费大量时间和磁盘。

#### 方案：按 task 目标 package 选择性初始化

核心逻辑：task 知道要改哪个 package → config.yaml 知道哪些 package 是 submodule → 只 init 需要的。

```
# 100 个 submodule 的仓库，task 只改 docs-site
git worktree add ../worktree feature/xxx
cd ../worktree
git submodule update --init docs-site   # 只初始化 1 个
```

#### P9 脚本改动明细

**`start.py`（`.trellis/scripts/multi_agent/`）**

在 `git worktree add` 之后、`post_create` hooks 之前，新增 submodule 初始化步骤：

```python
# 1. 从 task.json 读取目标 package（可能多个）
# 2. 从 config.yaml 查询哪些目标 package 是 submodule
# 3. 对每个 submodule 类型的 package 执行：
#    git -C <worktree> submodule update --init <package_path>
# 4. 非 submodule 类型的 package → 跳过
# 5. 无 packages 配置 → 跳过（单仓库模式）
```

| 场景 | 行为 |
|------|------|
| task.package = "cli"（非 submodule） | 不 init 任何 submodule |
| task.package = "docs-site"（submodule） | `git submodule update --init docs-site` |
| task 涉及多个 package | 逐个检查，只 init submodule 类型的 |
| task 无 package 字段 | 用 default_package，按上述规则处理 |
| 无 packages 配置（单仓库） | 完全跳过 |

**`config.py`（`.trellis/scripts/common/`）**

新增辅助函数：

```python
def get_submodule_packages(repo_root=None) -> dict[str, str]:
    """返回所有 type=submodule 的 package: {name: path}"""
```

#### 调研背景

业界常见的 worktree + submodule 方案：

| 方案 | 做法 | 适用场景 |
|------|------|----------|
| 全量 init | worktree 创建后 `git submodule update --init --recursive` | submodule 少、体积小 |
| alternates 共享 | 用 git alternates 机制共享 object store | submodule 大、追求省空间 |
| symlink | 从主仓 symlink submodule 目录到 worktree | 只读场景 |
| 按需 init | 只 init task 需要的 submodule（**本方案**） | monorepo + CI/agent 场景 |

选择**按需 init** 的理由：
- 配置简单（利用已有的 task.package + config.yaml type 信息）
- 扩展性好（submodule 数量增长时开销不变）
- 无 alternates/symlink 的边缘 case 风险

### Part 10: create_pr.py Submodule 感知（P10）

#### 问题

`create_pr.py` 当前只处理主仓变更。如果 agent 在 worktree 中修改了 submodule 内部的文件，`git add -A` 只会记录 submodule ref 的变化（一个指针），实际代码变更不会被提交。

#### 方案：检测 submodule 变更，分别提交 + 创建 PR

```
# 完整流程
1. 检测改动是否在 submodule 目录内
2. 对每个有变更的 submodule:
   ├── cd <submodule>
   ├── git checkout -b <branch>
   ├── git add -A && git commit
   ├── git push origin <branch>
   └── gh pr create (在 submodule 的远端仓库)
3. 回到主仓:
   ├── git add <submodule> (更新指针)
   ├── 如果主仓也有其他改动 → commit + push + PR
   └── 如果只有 submodule 指针更新 → 可选跳过或创建 ref-update PR
```

#### 关键逻辑

| 场景 | 行为 |
|------|------|
| 只改主仓代码 | 原有逻辑不变 |
| 只改 submodule | submodule 内 commit+PR，主仓 ref-update commit+PR |
| 两者都改 | submodule PR + 主仓 PR（含 ref 更新 + 主仓改动）|
| 无 packages 配置 | 完全跳过检测（单仓库兼容）|

#### P10 脚本改动明细（CLI 模板复用参考）

**`create_pr.py`（`.trellis/scripts/multi_agent/`）**

| Before | After |
|--------|-------|
| 直接 `git add -A` + commit + push + PR | 先检测所有 submodule 变更，逐个 commit/push/PR，再处理主仓 |

新增函数：

```python
def _has_submodule_changes(submodule_path: Path) -> bool:
    """检测 submodule 是否有未提交变更"""

def _commit_and_push_submodule(submodule_path, branch, commit_msg, dry_run) -> (bool, pr_url):
    """在 submodule 内部 checkout branch、add、commit、push、gh pr create"""
```

主流程变更：
1. 在主仓 staging 前，遍历 `get_submodule_packages()` 检测变更
2. 有变更的 submodule → `_commit_and_push_submodule()`
3. 主仓 `git add -A` 自动包含更新后的 submodule ref
4. task.json 新增 `submodule_pr_urls` 列表字段

**`config.py`（`.trellis/scripts/common/`）**

P9 已新增 `get_submodule_packages()`，P10 复用。

| 文件 | 改动 | 可泛用 |
|------|------|--------|
| `create_pr.py` | submodule 感知的 commit/push/PR 流程 | ✅ |
| `config.py` | `get_submodule_packages()`（P9 已加） | ✅ |

---

## 已知风险

1. **`trellis update` 覆盖定制**：在 Trellis 仓库自身跑 `trellis update` 可能从模板覆盖已定制的 dotfiles（`spec/cli/` 路径）。需确保冲突检测机制正常工作。
2. **Cross-platform 4 份副本维护成本**：合并命令后从 ~60 文件降到 ~40 文件，但本质问题未解决。长期可考虑从模板源生成 dotfiles（独立问题）。

---

## 泛用性分析：项目特化 vs 产品复用

后续 Trellis CLI 产品支持 monorepo（如 `trellis init --monorepo`）时，下面标注 **可泛用** 的改动可以直接复用到模板源（`packages/cli/src/templates/`）。

### 项目特化（仅 Trellis 仓库自身）

| 改动 | 原因 |
|------|------|
| **Phase 1 Part A**: `spec/backend/` → `spec/cli/backend/` 目录移动 | Trellis 仓库手动重组自己的 spec 目录 |
| **Phase 1 Part B**: ~55 文件路径替换 | 仅影响 Trellis 仓库的 dotfiles，模板源不改 |
| **Phase 1 Part D-partial**: `init-context` 硬编码 `spec/cli/` | 过渡方案，后续被 Part 2 的 `--package` 参数取代 |
| **Phase 2 Part 5**: docs-site submodule 迁移 | Trellis 仓库特有的 submodule 清理 |

### 可泛用（后续改 CLI 模板时复用）

| 改动 | 复用方式 | 模板影响 |
|------|----------|----------|
| **Part 1**: 合并 type-specific 命令 → 泛型 `before-dev`/`check` | 设计直接用：spec 自动发现（`ls spec/*/index.md`）不假定目录名，单仓库和 monorepo 都能工作 | 更新模板中的 command/skill 文件，删除 `before-backend-dev`/`before-frontend-dev`/`check-backend`/`check-frontend`，新增 `before-dev`/`check` |
| **Part 2**: task.json `package` 字段 + `--package` 参数 | 脚本逻辑改动，直接体现在模板 `task.py` 中。单仓库时 package 为空，行为不变 | 更新模板 `scripts/task.py` |
| **Part 3**: `config.yaml` packages + `get_context.py --packages` | config.yaml 声明 packages，config.py 提供读取函数，get_context.py 输出结构化信息。无配置时 fallback 单仓库模式 | 更新模板 `config.yaml`（加注释块）+ `config.py` + `get_context.py` |
| **Part 4**: `start.md`/`workflow.md` 动态发现 | md 文件引导 AI 调 `get_context.py --packages` 获取结构化包信息，不直接 `ls` | 更新模板中的 `start.md` 和 `workflow.md` |
| **Part 6**: `add_session.py --package` 标记 | 可选参数，不传时行为不变 | 更新模板 `scripts/add_session.py` |
| **Part 7**: 向前兼容检测逻辑 | `spec/` 下有 package 子目录 → monorepo 模式；直接有 `backend/` → 单仓库模式。写在脚本里 | 贯穿所有模板脚本 |
| **Part 8**: parallel/agent/hook 硬编码清理 | `parallel.md`、agent 定义、hook spec 树、session-start 插件中的 `spec/cli/` → 动态发现 | 更新模板对应文件 |
| **Part 9**: worktree submodule 按需初始化 | `start.py` 根据 task.package + config.yaml type 选择性 init submodule。无配置时跳过（单仓库兼容） | 更新模板 `scripts/multi_agent/start.py` + `config.py` |
| **Part 10**: create_pr.py submodule 感知 | 检测 submodule 变更 → 内部 commit/push/PR → 主仓更新 ref。无 submodule 时原有逻辑不变 | 更新模板 `scripts/multi_agent/create_pr.py` |

### 产品化路径

当 Trellis CLI 要正式支持 monorepo 时，工作量大致为：
1. 把上述 **可泛用** 改动同步到 `packages/cli/src/templates/` 中的对应文件
2. `trellis init` 新增 `--monorepo` 或自动检测 workspace 配置
   - 检测 `pnpm-workspace.yaml` / `lerna.json` / `nx.json` 等
   - 自动生成 `config.yaml` 的 `packages` 字段
   - 为每个 package 创建 `spec/<package>/` 目录
3. `trellis update` 处理 monorepo spec 目录结构（不覆盖 `spec/<package>/`）
4. 文档更新（docs-site 新增 monorepo 章节）

---

## Out of Scope

- Trellis 产品级 monorepo 支持（`trellis init --monorepo`）— 独立 feature
- 模板源文件变更（`packages/cli/src/templates/`）
- Cross-platform 命令去重（从模板生成 dotfiles）— 独立优化
