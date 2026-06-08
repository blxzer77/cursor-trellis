# S1: Monorepo 检测 + config 基础设施

> Parent: `03-10-v040-beta1`

## Goal

建立 monorepo 支持的底层基础设施，包括检测、配置读写、路径工具、init 流程适配，使后续 Sprint 可以基于这些基础构建。

## What I already know

### 代码现状

- `detectProjectType(cwd)` 在 `project-detector.ts` — 检查 indicator 文件 + package.json deps，返回 `frontend | backend | fullstack | unknown`
- `init.ts` — 调用 `detectProjectType()` 后传给 `createWorkflowStructure()`，再传给 `createSpecTemplates()`
- `createSpecTemplates()` 在 `workflow.ts` — 硬编码创建 `spec/guides/`、`spec/backend/`、`spec/frontend/` 目录 + markdown 文件
- Bootstrap task 也硬编码了 `spec/backend/`、`spec/frontend/` 路径
- `config.yaml` 模板 — 目前只有 `session_commit_message`、`max_journal_lines`、`hooks`
- `config.py` 模板 — `_load_config()` 用 `parse_simple_yaml()` 解析；只有 3 个读取函数
- `paths.py` 模板 — 有 `DIR_SPEC = "spec"` 常量但没有组合路径的函数
- `get_context.py` 模板 — 只是 `from common.git_context import main` 的薄封装
- `parse_simple_yaml()` 在 `worktree.py` — 支持嵌套 dict + list，注释行不会被误读
- init.ts 已有完整的远程模板下载流程（marketplace 模式 + 直接下载模式 + 交互选择）
- `update.ts` 的 `PROTECTED_PATHS` 包含 `spec/`，update 时整个 spec 目录被保护不会被触碰，monorepo 下 `spec/<package>/` 自动受保护
- 现有模板下载 API 只往全局 `spec/` 写，`createWorkflowStructure` 只有全局 `skipSpecTemplates` 布尔值

### 约束

- `parse_simple_yaml()` 是无依赖 YAML 解析器，新增 packages 配置需确保它能正确解析嵌套结构
- init.ts 已有 `inquirer` 做交互式问答，可复用
- 所有 Python 脚本无外部依赖（no pyyaml），新增函数必须用 `parse_simple_yaml()`
- Trellis 本体是 pnpm workspaces + git submodules 双重叠加的 monorepo

---

## Decision (ADR-lite)

### D1: detectMonorepo 返回值设计

**Context**: 需要决定检测函数返回什么信息。市面上 monorepo 方案分为 workspace manager（声明 packages）和 orchestrator（构建编排）。

**Decision**: 只返回 Trellis 实际消费的信息 — `{ name, path, type, isSubmodule }`。不保留 manager/orchestrator 类型，因为没有下游消费者（parallel 流程只需要 path + isSubmodule，运行时可从 git 获取 remote URL 等信息）。各种 workspace 格式只是提取 package 列表的不同解析器。

**Consequences**: 简洁；如果未来需要 manager 信息可以加回来，但目前无此需求。

### D2: 检测范围

**Context**: 需要决定支持哪些 monorepo 方案的检测。

**Decision**: 覆盖以下方案，按优先级检测，结果合并去重（按规范化后的 path 去重）：

| 优先级 | 配置文件 | Package 提取方式 |
|--------|----------|-----------------|
| 1 | `pnpm-workspace.yaml` | 解析 `packages:` glob |
| 2 | `package.json` → `workspaces` | 解析数组或对象形式 glob（含排除 `!pattern`） |
| 3 | `Cargo.toml` → `[workspace]` | 解析 `members` glob（含 `exclude`） |
| 4 | `go.work` | 解析 `use` 指令 |
| 5 | `pyproject.toml` → `[tool.uv.workspace]` | 解析 `members` glob |
| 6 | `.gitmodules` | 解析 `path = xxx` |

Turbo/Nx/Lerna 不检测（无下游消费方）。多个 manager 的结果合并（如 pnpm + submodules）。只有 1 个 package 也算 monorepo（用户选了就尊重）。

### D3: Monorepo init 的模板选择

**Context**: monorepo 下每个 package 可能需要不同的 spec 模板。

**Decision**: 检测到 monorepo 后，逐个 package 询问 spec 来源：空白 spec（Trellis 自带）或下载远程 template。模板下载到 `spec/<package>/` 而非 `spec/`。

### D4: 单仓迁移 monorepo

**Context**: 已有单仓 `.trellis/` 的项目后来改成 monorepo，re-init 时如何处理。

**Decision**: 推到后续。可作为一个独立 skill 从 Trellis 自身的实际迁移经验中总结。

### D5: update.ts 兼容性

**Context**: update 时 monorepo spec 目录是否安全。

**Decision**: 无需改动。`PROTECTED_PATHS` 已包含 `spec/`，monorepo 下 `spec/<package>/` 自动受保护。从 S3 中移除此项。

### D6: CLI flag 优先级（Codex review 补充）

**Context**: `-y`、`--monorepo`、`--template` 等 flag 可能共存，需要明确优先级。

**Decision**: 优先级链：`--no-monorepo` / `--monorepo` > `--template` > `-y` 默认行为。
- `--no-monorepo` 强制跳过检测，即使检测到 monorepo 也走单仓
- `--monorepo` 强制启用，检测失败时报错（不静默降级）
- `--template` 在 monorepo 模式下作为所有 package 的默认模板选择（可被 per-package 交互覆盖）
- `-y` 仅在无显式 flag 时生效：自动启用检测到的 monorepo，所有 package 使用空白 spec

### D7: config.yaml 写入策略（Codex review 补充）

**Context**: init 写入 `packages:` 字段时可能覆盖已有配置（hooks 等）。

**Decision**: 非破坏性 patch — 只追加/更新 `packages:` 和 `default_package:` 字段，保留已有的其他配置项不动。

---

## Requirements

### 1.1 Monorepo 检测 (`project-detector.ts`)

**新增 `detectMonorepo(cwd): DetectedPackage[] | null`**:

```ts
interface DetectedPackage {
  name: string          // package 名称（从 package.json/Cargo.toml/go.mod 等读取）
  path: string          // 相对于 cwd 的规范化路径（去掉 ./ 和尾部 /）
  type: ProjectType     // detectProjectType() 的结果
  isSubmodule: boolean  // 来自 .gitmodules 检测
}
```

- 返回 `null` = 不是 monorepo
- 返回 `[]` = 检测到 monorepo 配置但没找到实际 package
- 多个 manager 的结果合并，按规范化 path 去重，submodule 标记优先

**各格式解析逻辑**:

| 格式 | 解析 | name 来源 |
|------|------|----------|
| pnpm-workspace.yaml | `packages:` glob 列表 → 展开 | 子目录 `package.json` → `name`，fallback 目录名 |
| package.json workspaces | `workspaces` 数组 glob 或对象形式 `workspaces.packages` → 展开；支持 `!pattern` 排除 | 同上 |
| Cargo.toml [workspace] | `members` glob → 展开；支持 `exclude` 字段 | 子目录 `Cargo.toml` → `[package] name` |
| go.work | `use` 指令 → 路径列表 | 子目录 `go.mod` → `module` 行 |
| pyproject.toml [tool.uv.workspace] | `members` glob → 展开 | 子目录 `pyproject.toml` → `[project] name` |
| .gitmodules | `path = xxx` 解析 | submodule name（`[submodule "name"]`） |

**路径规范化**:
- 所有 path 去掉前导 `./` 和尾部 `/`
- 统一使用 `/` 分隔符（跨平台）
- 去重时按规范化后的 path 比较

**Edge case 处理**:
- glob 展开匹配不到实际目录 → 跳过，不报错
- package.json / Cargo.toml 没有 name 字段 → fallback 到目录名
- 配置文件解析失败 → 隐式模式（无 `--monorepo`）graceful 返回 null；显式 `--monorepo` 模式下报错退出
- 只有 1 个 package → 仍算 monorepo
- workspace 条目解析到 repo root（`.` 或空）→ 默认排除，不作为 package
- `.gitmodules` 中声明但未 init 的 submodule（路径不存在）→ 仍保留为 package（`type: unknown`, `isSubmodule: true`），init 时提示用户
- `workspaces` 对象形式（yarn v1: `{ packages: [...], nohoist: [...] }`）→ 从 `packages` 字段提取 glob

### 1.2 config.yaml 模板 + config.py 读取

**config.yaml 模板新增**（默认注释掉）:
```yaml
# packages:
#   frontend:
#     path: packages/frontend
#   backend:
#     path: packages/backend
#     type: submodule
# default_package: frontend
```

**config.yaml 写入策略**: 非破坏性 patch — 只追加/更新 `packages:` 和 `default_package:` 字段，保留已有配置项。

**config.py 模板新增函数**:
- `get_packages(repo_root=None) -> dict | None` — 返回 packages 字典，无配置返回 None
- `get_default_package(repo_root=None) -> str | None` — 返回 default_package
- `get_submodule_packages(repo_root=None) -> dict[str, str]` — 返回 type=submodule 的 package `{name: path}` 映射
- `is_monorepo(repo_root=None) -> bool` — config.yaml 有 packages 字段则 True
- `get_spec_base(package=None, repo_root=None) -> str` — 单仓返回 `spec`，monorepo 返回 `spec/<package>`

### 1.3 paths.py 适配

新增：
- `get_spec_dir(package=None, repo_root=None) -> Path` — 组合 repo_root + .trellis + spec_base
- `get_package_path(package, repo_root=None) -> Path` — 读 config 返回 package 的源码绝对路径

### 1.4 init.ts 适配

**CLI flag 优先级**: `--no-monorepo` / `--monorepo` > `--template` > `-y` 默认行为

**monorepo 检测流程**:
1. 调用 `detectMonorepo(cwd)`
2. `--monorepo` 且检测失败 → 报错退出（不静默降级）
3. `--no-monorepo` → 跳过检测，走单仓逻辑
4. 检测到 monorepo → 展示检测结果，询问用户是否启用
5. 启用 → 将 packages 写入 `config.yaml`（非破坏性 patch）

**per-package 模板选择**（monorepo 模式）:
- 对每个检测到的 package 逐个询问 spec 来源：
  - 空白 spec（Trellis 自带，基于 detectProjectType 结果）
  - 下载远程 template（复用现有 marketplace / direct-download 流程）
- 模板下载 API 需改造：支持目标路径参数，下载到 `spec/<package>/` 而非全局 `spec/`
- `--template` 在 monorepo 模式下作为所有 package 的默认模板选择
- `-y` 模式: 自动启用检测到的 monorepo，所有 package 使用空白 spec

**`skipSpecTemplates` 改造**: 从全局布尔值改为 per-package 计划（哪些 package 用空白 spec，哪些用远程模板）

### 1.5 workflow.ts 适配

- `createSpecTemplates()` 新增 monorepo 路径：接收 `DetectedPackage[] | null`
- Monorepo: 为每个 package 按 `detectProjectType()` 结果生成完整 spec 文件集
  - backend package → `spec/<name>/backend/` 下 6 个文件（index.md、directory-structure.md 等）
  - frontend package → `spec/<name>/frontend/` 下 7 个文件
  - fullstack package → backend + frontend 两套
  - unknown → fallback fullstack
  - 逻辑与单仓 `createSpecTemplates()` 一致，只是路径前缀变为 `spec/<name>/`
- 单仓: 不变
- `spec/guides/` 始终创建（与模式无关）

### 1.6 Bootstrap task 适配

- monorepo 模式: `getBootstrapPrdContent()` 按 package 列表生成引导内容（`spec/<name>/backend/` 形式）
- `getBootstrapTaskJson()` 的 relatedFiles 改为 `spec/<name>/` 列表

### 1.7 get_context.py 模板增强

新增 `--mode packages` 输出：
```
Available packages:
  cli          packages/cli        [backend, unit-test]
  docs-site    docs-site           [docs]  (submodule)
Default package: cli
```

- spec layers 从 `spec/<package>/` 目录自动扫描
- 无 `packages` 配置时输出 `(single-repo mode)` 并列出 `spec/` 下的直接子目录
- 默认模式（无 `--mode`）也在输出末尾追加 packages 概览

---

## Acceptance Criteria

- [ ] `detectMonorepo()` 正确检测 pnpm workspace
- [ ] `detectMonorepo()` 正确检测 npm/yarn/bun workspace（含对象形式 + `!` 排除）
- [ ] `detectMonorepo()` 正确检测 Cargo workspace（含 `exclude`）
- [ ] `detectMonorepo()` 正确检测 go.work
- [ ] `detectMonorepo()` 正确检测 uv workspace
- [ ] `detectMonorepo()` 正确检测 .gitmodules（含未 init 的 submodule）
- [ ] 路径规范化：`./packages/a`、`packages/a/`、`packages/a` 去重为同一个
- [ ] workspace 条目为 `.`（repo root）时自动排除
- [ ] 多 manager 合并去重（pnpm + submodules 共存场景）
- [ ] `--monorepo` 且检测失败 → 报错退出
- [ ] Edge cases 不 crash（空 glob、无 name、解析失败）
- [ ] `trellis init` 在 monorepo 项目中询问并创建正确的 spec 目录结构
- [ ] monorepo 模式下逐 package 选择 spec 来源（空白/远程模板）
- [ ] 远程模板下载到 `spec/<package>/` 而非 `spec/`（下载 API 支持目标路径）
- [ ] `--monorepo` / `--no-monorepo` / `--template` / `-y` 优先级正确
- [ ] config.yaml 写入为非破坏性 patch（不覆盖已有 hooks 等配置）
- [ ] config.yaml 正确生成 `packages:` 字段
- [ ] `config.py` 函数在 monorepo 和单仓模式下都返回正确值
- [ ] `get_submodule_packages()` 返回 `dict[str, str]`（name → path）
- [ ] `get_context.py --mode packages` 输出结构化包信息
- [ ] 单仓项目 `trellis init` 行为完全不变
- [ ] Bootstrap task 在 monorepo 模式下引导正确的 spec 路径
- [ ] 新增单测覆盖 detectMonorepo 各格式 + config.py 函数

## Definition of Done

- Tests added/updated (unit/integration where appropriate)
- Lint / typecheck / CI green
- Docs/notes updated if behavior changes

## Out of Scope

- 命令合并（S2）
- Task --package 参数（S3）
- Worktree submodule（S4）
- 跨 package 依赖管理
- 在子 package 目录运行 `trellis init`
- Orchestrator 检测（turbo/nx/lerna）— 无下游消费方
- 单仓 → monorepo 迁移（后续独立 skill）

## Technical Notes

- `parse_simple_yaml()` 已支持嵌套 dict，packages 配置可以被正确解析
- `init.ts` 已有 inquirer 依赖，新增 monorepo 交互可复用
- Bootstrap task 的 `getBootstrapPrdContent()` 和 `getBootstrapTaskJson()` 需要适配 monorepo spec 路径
- `git_context.py` 是 `get_context.py` 的实际逻辑所在，需在那里加 `--mode packages`
- glob 展开需要在 TS 侧实现（Node.js `fs.readdirSync` + pattern matching），不引入额外依赖
- `update.ts` PROTECTED_PATHS 已覆盖 `spec/`，monorepo spec 目录自动受保护，无需改动
- 模板下载 API 需改造以支持目标路径参数（当前只往全局 `spec/` 写）
- `skipSpecTemplates` 需从全局布尔值改为 per-package 计划

## Codex Cross-Review

**审查时间**: 2026-03-10
**模型**: gpt-5.4
**结果**: 9 条反馈，全部已纳入 PRD

| 级别 | 问题 | 处理 |
|------|------|------|
| CRITICAL | `-y` 与 `--template` 优先级未定义 | → D6: 明确优先级链 |
| CRITICAL | 模板下载 API 不支持 per-package 目标路径 | → 1.4: 标记 API 需改造 |
| CRITICAL | 路径规范化缺失导致去重不稳定 | → 1.1: 规范化规则 |
| WARNING | `workspaces` 对象形式 + 排除 pattern 未覆盖 | → 1.1: 补充对象形式 + `!pattern` |
| WARNING | Root workspace（`.`）未处理 | → 1.1: 默认排除 |
| WARNING | `--monorepo` 下解析失败不应静默降级 | → 1.1 + D6: 显式模式报错 |
| WARNING | `.gitmodules` 未 init 的 submodule 路径缺失 | → 1.1: 保留为 unknown |
| WARNING | config.yaml 写入可能覆盖已有配置 | → D7: 非破坏性 patch |
| NITPICK | `get_submodule_packages()` 返回值丢失 path | → 1.2: 改为 dict[str, str] |

## 受影响文件

| 文件 | 改动类型 |
|------|----------|
| `packages/cli/src/utils/project-detector.ts` | 新增 `detectMonorepo()` + 各格式解析器 |
| `packages/cli/src/commands/init.ts` | monorepo 检测 + flag + config 写入 + per-package 模板选择 + bootstrap 适配 |
| `packages/cli/src/configurators/workflow.ts` | `createSpecTemplates()` 支持 monorepo |
| `packages/cli/src/utils/template-fetcher.ts` | 下载 API 支持目标路径参数 |
| `packages/cli/src/templates/trellis/config.yaml` | 新增 packages 注释块 |
| `packages/cli/src/templates/trellis/scripts/common/config.py` | 新增 5 个函数 |
| `packages/cli/src/templates/trellis/scripts/common/paths.py` | 新增 2 个函数 |
| `packages/cli/src/templates/trellis/scripts/common/git_context.py` | `--mode packages` |
