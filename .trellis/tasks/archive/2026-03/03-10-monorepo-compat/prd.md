# CLI 兼容 Monorepo + 单仓双模式

## Goal

让 `trellis init` / `trellis update` 以及生成的全部模板（命令、Hook、Python 脚本）同时支持 **单仓模式**（现状）和 **Monorepo 模式**，用户无需手动改文件即可在 monorepo 中使用 Trellis。

## Background

Trellis 主仓库自身已是 monorepo（`packages/cli` + `docs-site` submodule），`.trellis/config.yaml` 有 `packages:` 字段，spec 目录按 `spec/cli/backend/`、`spec/docs-site/docs/` 组织。但 **CLI 模板源码**（即用户 `trellis init` 后得到的文件）仍全部假设单仓结构，无任何 monorepo 逻辑。

PRD `03-09-monorepo-spec-adapt` 定义了 P1-P10 共 10 个阶段，仅 P1（命令合并）和 P5（内容迁移）部分完成，其余全部未落地到模板源码。本 task 将这些需求收敛为一个完整、独立、可分阶段实施的计划。

---

## 核心设计：Forward-Compatible 双模式

### 模式判定

```
config.yaml 有 packages: 字段 → Monorepo 模式
config.yaml 无 packages: 字段 → 单仓模式（默认，完全向后兼容）
```

### Spec 目录结构对比

```
单仓模式（现状）:                Monorepo 模式:
.trellis/spec/                   .trellis/spec/
├── frontend/                    ├── <package-a>/
│   └── index.md                 │   ├── backend/
├── backend/                     │   │   └── index.md
│   └── index.md                 │   └── frontend/
└── guides/                      │       └── index.md
    └── index.md                 ├── <package-b>/
                                 │   └── backend/
                                 │       └── index.md
                                 └── guides/          ← 共享
                                     └── index.md
```

---

## 改动清单

### Phase 1: 检测 + 配置基础设施

#### 1.1 Monorepo 检测 (`project-detector.ts`)

**现状**: `detectProjectType(cwd)` 只在 cwd 检查 indicator 文件，返回 `frontend | backend | fullstack`。不识别 monorepo。

**改动**:
- 新增 `detectMonorepo(cwd): MonorepoInfo | null`
- 检测指标：
  - `pnpm-workspace.yaml` → pnpm workspaces
  - `package.json` 内 `workspaces` 字段 → npm/yarn workspaces
  - `turbo.json` → Turborepo
  - `nx.json` → Nx
  - `lerna.json` → Lerna
  - `.gitmodules` → Git submodules
- 返回值：`{ tool: string, packages: PackageInfo[] }`
  - `PackageInfo = { name: string, path: string, type: ProjectType }`
  - 对每个 workspace/package 调用 `detectProjectType(packagePath)` 获取类型

#### 1.2 config.yaml 模板 + config.py 读取

**现状**: 模板 `config.yaml` 只有 `session_commit_message`、`max_journal_lines`、`hooks`。模板 `config.py` 只有对应读取函数。

**改动**:

`config.yaml` 模板新增（默认注释掉）:
```yaml
# packages:
#   frontend:
#     path: packages/frontend
#   backend:
#     path: packages/backend
#     type: submodule    # 可选，标记为 git submodule
# default_package: frontend
```

`config.py` 新增函数:
```python
def get_packages() -> dict | None:
    """返回 packages 字典，无 packages 字段返回 None"""

def get_default_package() -> str | None:
    """返回 default_package，未配置返回 None"""

def get_submodule_packages() -> list[str]:
    """返回 type=submodule 的 package name 列表"""

def is_monorepo() -> bool:
    """config.yaml 有 packages 字段则为 True"""

def get_spec_base(package: str | None = None) -> str:
    """
    单仓: 返回 'spec'
    Monorepo + package: 返回 'spec/<package>'
    Monorepo 无 package: 返回 'spec' (共享 guides 等)
    """
```

#### 1.3 paths.py 适配

**现状**: `get_repo_root()` 向上找 `.trellis/` 目录。所有路径函数返回单根路径。

**改动**:
- 新增 `get_spec_dir(package: str | None = None) -> Path`:
  - 单仓: 返回 `repo_root / .trellis / spec`
  - Monorepo: 返回 `repo_root / .trellis / spec / <package>`
- 新增 `get_package_path(package: str) -> Path`:
  - 读 config.yaml packages[name].path，返回绝对路径
- `get_repo_root()` 不变（.trellis/ 始终在 repo root）

---

### Phase 2: Init 流程适配

#### 2.1 `init.ts` 改动

**现状**: `detectProjectType(cwd)` → 创建 `spec/frontend/`、`spec/backend/` 扁平结构。

**改动**:
- 调用 `detectMonorepo(cwd)`:
  - **检测到 monorepo**: 询问用户是否启用 monorepo 模式
    - 是 → 将检测到的 packages 写入 `config.yaml` 的 `packages:` 字段
    - 为每个 package 创建 `spec/<package-name>/<layer>/index.md`
    - 共享 `spec/guides/` 不在 package 下
  - **未检测到**: 走现有单仓逻辑，不变
- 新增 `--monorepo` flag: 强制进入 monorepo 模式（手动指定 packages）
- 新增 `--no-monorepo` flag: 强制跳过 monorepo 检测

#### 2.2 `workflow.ts` 改动

**现状**: `createSpecTemplates()` 硬编码创建 `spec/frontend/`、`spec/backend/`。

**改动**:
- 接收 `MonorepoInfo | null` 参数
- Monorepo: 为每个 package 创建 `spec/<name>/<layer>/index.md`
- 单仓: 不变

#### 2.3 远程模板适配

**现状**: 远程模板下载到 `PATHS.SPEC`（即 `.trellis/spec/`），假设模板即为完整 spec 内容。

**改动**:
- Monorepo 模式: 提示用户选择模板应用到哪个 package
  - 下载到 `spec/<package>/` 而非 `spec/`
- 或整体下载到 `spec/` 并提示用户手动分发

---

### Phase 3: 命令 + Hook 动态化

#### 3.1 合并 type-specific 命令为 generic

**现状**: 每个平台有 6+ 个 type-specific 命令:
- `before-backend-dev.md` / `before-frontend-dev.md`
- `check-backend.md` / `check-frontend.md` / `check-cross-layer.md`

**改动**: 合并为 generic 命令（保持向后兼容的过渡期）:
- `before-dev.md` — 运行时动态发现 `spec/*/index.md`（单仓）或 `spec/<package>/*/index.md`（monorepo），加载匹配当前任务类型的 spec
- `check.md` — 同上，动态加载 check 规则

**重要**: 命令描述必须明确说明 **index 不是目的**——AI 读 index 是为了从中找出本次任务涉及的具体 guideline 文件（如 `error-handling.md`、`conventions.md`、`mock-strategies.md`），然后去读那些文件获取开发规范。已在 v0.3.7 中修复了项目 dotfiles 的描述（`7de2916`），模板在 monorepo-compat 中统一。

**迁移策略**: 新增 generic 命令，旧 type-specific 命令标记 deprecated 但保留一个版本周期后再删

#### 3.2 `start.md` 动态 spec 发现

**现状**: 硬编码 `cat .trellis/spec/frontend/index.md` 等。

**改动**:
```markdown
# 动态发现 spec 索引
python3 ./.trellis/scripts/get_context.py --spec-indexes
# 输出所有可用的 spec/*/index.md 或 spec/<package>/*/index.md 路径
```

或直接在 start.md 中用 `ls .trellis/spec/*/index.md` 动态列举。

#### 3.3 `session-start.py` Hook 动态化

**现状** (lines 72-74):
```python
# 硬编码读取 spec/frontend/index.md、spec/backend/index.md、spec/guides/index.md
```

**改动**:
- 调用 `config.is_monorepo()` 判断模式
- 单仓: `glob("spec/*/index.md")` 发现所有 layer
- Monorepo: `glob("spec/*/index.md")` + `glob("spec/*/*/index.md")` 发现 guides + package specs
- 当有 `.current-task` 且 `task.json` 有 `package` 字段时，只注入对应 package 的 specs

#### 3.4 `inject-subagent-context.py` Hook 动态化

**现状**: 硬编码 spec 树结构:
```python
spec_path/
├── shared/
├── frontend/
├── backend/
└── guides/
```

**改动**:
- 运行时读取实际 spec 目录结构（`os.walk` 或 `glob`）
- 根据 task.json 的 package 字段过滤注入范围

---

### Phase 4: Task 系统扩展

#### 4.1 task.json `package` 字段

**现状**: task.json 无 `package` 字段。

**改动**:
- `task.py create` 新增 `--package <name>` 参数
- task.json 增加 `"package": "cli"` 可选字段
- 单仓模式不使用此字段（向后兼容）

#### 4.2 `task.py init-context` 适配

**现状**: `init-context` 接收 `backend | frontend | fullstack`，硬编码 `spec/backend/index.md` 等。

**改动**:
- Monorepo + `--package`: 使用 `spec/<package>/backend/index.md`
- 单仓: 不变

#### 4.3 `add_session.py` `--package` 标记

**现状**: 无 package 概念。

**改动**:
- 新增可选 `--package` 参数
- 记录到 journal 的 session 元数据中

---

### Phase 5: Worktree + 多 Agent 适配

#### 5.1 `start.py` Submodule 初始化

**现状**: `git worktree add` 后不初始化 submodule，worktree 中 submodule 目录为空。

**改动**:
- 创建 worktree 后，读取 `config.yaml` 的 `packages` 字段
- 对 `type: submodule` 的 package 执行:
  ```bash
  git submodule update --init <package_path>
  ```
- 可选：只初始化当前 task 涉及的 package（按 task.json `package` 字段过滤）

#### 5.2 `create_pr.py` Submodule 感知

**现状**: `git add -A` 一把梭。

**改动**:
- 检测工作区中是否有 submodule 变更（`git diff --cached --name-only` 检查 submodule 路径）
- 如有 submodule 变更:
  1. 先进 submodule 目录 commit
  2. 主仓库 commit submodule pointer 变更
  3. 或提示用户手动处理

#### 5.3 `cleanup.py` Submodule 清理

**现状**: 直接 `git worktree remove`。

**改动**: 无需特殊处理（worktree remove 会清理整个目录包括 submodule），但增加日志提示。

---

### Phase 6: Update 流程适配

#### 6.1 `update.ts` PROTECTED_PATHS

**现状**: `PROTECTED_PATHS` 包含 `.trellis/spec` 作为整体保护。

**改动**:
- Monorepo: 同样保护 `.trellis/spec`，无需改（spec/ 下的子目录结构变了但保护粒度不变）
- 需确保 update 不会因 spec 目录结构变化而报错

#### 6.2 Migration 支持

- 新增 migration: 当用户从单仓升级到 monorepo 时
  - 检测到 config.yaml 新增 `packages:` 字段
  - 提示用户手动重组 spec 目录（不自动移动，太危险）

---

## 实施优先级

| Phase | 描述 | 优先级 | 依赖 | 预估复杂度 |
|-------|------|--------|------|-----------|
| **P1** | 检测 + 配置基础设施 | **高** | 无 | 中 |
| **P2** | Init 流程适配 | **高** | P1 | 中 |
| **P3** | 命令 + Hook 动态化 | **高** | P1 | 高 |
| **P4** | Task 系统扩展 | **中** | P1 | 低 |
| **P5** | Worktree + 多 Agent | **低** | P1, P4 | 中 |
| **P6** | Update 流程适配 | **低** | P1 | 低 |

**建议顺序**: P1 → P2 → P3 → P4 → P5 → P6

P1-P3 完成后，monorepo 用户即可正常使用 Trellis；P4-P6 是增强。

---

## 受影响的文件清单

### TypeScript 源码 (`packages/cli/src/`)

| 文件 | 改动 |
|------|------|
| `utils/project-detector.ts` | 新增 `detectMonorepo()` |
| `commands/init.ts` | monorepo 检测 + `--monorepo` flag + spec 目录创建 |
| `commands/update.ts` | PROTECTED_PATHS 无需改，但要验证 monorepo spec 不被误删 |
| `configurators/workflow.ts` | `createSpecTemplates()` 支持 monorepo 目录结构 |
| `constants/paths.ts` | 可能新增 monorepo 相关常量 |

### Python 模板 (`packages/cli/src/templates/trellis/scripts/`)

| 文件 | 改动 |
|------|------|
| `common/config.py` | 新增 `get_packages()`, `is_monorepo()`, `get_spec_base()` 等 |
| `common/paths.py` | 新增 `get_spec_dir(package)`, `get_package_path(package)` |
| `task.py` | `--package` 参数, `init-context` monorepo spec 路径 |
| `add_session.py` | 可选 `--package` 参数 |
| `multi_agent/start.py` | submodule 初始化 |
| `multi_agent/create_pr.py` | submodule 感知 commit |

### 平台命令模板 (所有平台)

| 平台 | 文件 | 改动 |
|------|------|------|
| Claude | `commands/trellis/start.md` | 动态 spec 发现替代硬编码路径 |
| Claude | `commands/trellis/before-dev.md` | **新增** generic 命令 |
| Claude | `commands/trellis/check.md` | **新增** generic 命令 |
| Claude | `commands/trellis/before-backend-dev.md` | 标记 deprecated |
| Claude | `commands/trellis/before-frontend-dev.md` | 标记 deprecated |
| Claude | `commands/trellis/check-backend.md` | 标记 deprecated |
| Claude | `commands/trellis/check-frontend.md` | 标记 deprecated |
| Claude | `commands/trellis/parallel.md` | 动态 spec 路径 |
| Claude | `commands/trellis/finish-work.md` | 动态 spec 路径 |
| Claude | `commands/trellis/break-loop.md` | 动态 spec 路径 |
| Claude | `commands/trellis/onboard.md` | 动态 spec 路径 |
| Claude | `hooks/session-start.py` | 动态 spec 发现 |
| Claude | `hooks/inject-subagent-context.py` | 动态 spec 树 + task package 过滤 |
| iFlow | 同 Claude 对应文件 | 同上 |
| Cursor | `commands/trellis-*.md` | 动态 spec 路径 |
| Codex | `skills/*/SKILL.md` | 动态 spec 路径 |
| OpenCode | `skills/*/SKILL.md` | 动态 spec 路径 |
| Kiro | `skills/*/SKILL.md` | 动态 spec 路径 |
| Kilo | `workflows/*.md`, `rules/*.md` | 动态 spec 路径 |
| Gemini | `commands/*.md` | 动态 spec 路径 |
| Antigravity | `workflows/*.md` | 动态 spec 路径 |
| Qoder | `skills/*/SKILL.md` | 动态 spec 路径 |

### 配置模板

| 文件 | 改动 |
|------|------|
| `templates/trellis/config.yaml` | 新增注释掉的 `packages:` 示例 |
| `templates/trellis/workflow.md` | 动态 spec 路径说明 |

---

## 向后兼容性保证

1. **单仓用户零感知**: 不触碰 config.yaml `packages:` → 一切行为不变
2. **命令过渡期**: 旧 type-specific 命令保留至少 1 个 minor 版本
3. **config.yaml 无破坏**: 新字段默认注释掉
4. **task.json 兼容**: `package` 字段可选，不存在时所有逻辑走旧路径
5. **Python 脚本兼容**: 所有新函数都有 fallback（`is_monorepo()` 返回 False → 旧行为）

---

## Acceptance Criteria

- [ ] `trellis init` 在 pnpm workspace / npm workspace / nx 项目中自动检测并询问 monorepo 模式
- [ ] Monorepo 模式下 `config.yaml` 自动生成 `packages:` 字段
- [ ] Monorepo 模式下 spec 目录按 `spec/<package>/<layer>/` 创建
- [ ] 所有命令和 Hook 动态发现 spec 路径，不再硬编码 `spec/frontend/` 等
- [ ] `task.py create --package cli` 正确创建带 package 的 task
- [ ] `task.py init-context` 在 monorepo 模式下注入 `spec/<package>/backend/index.md`
- [ ] 单仓项目（无 `packages:` 字段）的 init/update/命令行为完全不变
- [ ] `trellis update` 从旧版升级时不损坏 monorepo spec 目录
- [ ] Worktree start 自动初始化 submodule（当 config.yaml 标记 `type: submodule`）
- [ ] 所有改动有对应单测覆盖

---

## 不在范围内

- 跨 package 依赖管理（Trellis 不管构建系统）
- Per-package 独立 `.trellis/`（始终一个 `.trellis/` 在 repo root）
- GUI / Electron app 的 monorepo 支持
- `trellis init` 在子 package 目录运行（始终要求在 repo root 运行）
