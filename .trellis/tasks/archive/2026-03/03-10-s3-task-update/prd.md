# S3: Task package 字段 + Update 兼容

> Parent: `03-10-v040-beta1` | Depends on: S1, S2

## Goal

Task 系统感知 package，Update 命令安全兼容 monorepo spec 目录结构。

## Scope

### 3.1 task.py `--package` 参数

- `task.py create --package <name>` — task.json 新增 `"package"` 可选字段
- `task.py init-context --package <name>` — 用 package 解析 spec 路径
- `task.py list` — 显示 package 列（`@cli` 形式）
- 无 `--package` 时 fallback: `get_default_package()` → 硬编码 fallback

**Spec 路径解析规则**（Codex CR #1）：
- **Monorepo**（config.yaml 有 `packages:`）：`spec/<package>/<layer>/index.md`
- **单仓库**（无 `packages:`）：`spec/<layer>/index.md`（保持现有行为）
- 判定走 `is_monorepo()` / `get_packages()`，不硬编码

**Per-command Package 解析优先级**（Codex CR #2 + CR3 #7）：

| 优先级 | `create` | `init-context` | `start.md` / `before-dev.md` |
|--------|----------|----------------|------------------------------|
| 1 (最高) | `--package` CLI | `--package` CLI | `spec_scope` 配置（3.5） |
| 2 | `get_default_package()` | `task.json.package` | `task.json.package` |
| 3 | 单仓 fallback | `get_default_package()` | `get_default_package()` |
| 4 | — | 单仓 fallback | 全量扫描 |

注：`create` 无 `task.json`（尚未创建），故不含该级别。

**Monorepo fallback 限制**（Codex CR5 #2）：在 monorepo 模式下（`is_monorepo()` 为 true），**禁止 fallback 到单仓路径**（`spec/<layer>/`）。若所有来源均无法解析出有效 package，`init-context` 应报错 `"monorepo project requires --package (or set default_package in config.yaml)"`，不生成无 package 前缀的路径。

**Package 校验**（Codex CR #3 + CR4 #3）：
- `create` / `init-context` / `add_session` 对 package 值做校验
- 若 config.yaml 有 `packages:` 列表，检查传入的 package 是否存在
- **CLI 来源**（`--package` 参数）：非法时打印可选包列表并 fail-fast
- **推断来源**（`task.json.package`、`default_package`）：非法时打印警告并 fallthrough 到下一级 fallback，不阻断执行

### 3.2 add_session.py `--package` 标记

可选 `--package` 参数，记录到 journal session 元数据。

**Package 解析优先级**（Codex CR2 #5）：
1. `--package` CLI 参数
2. active task 的 `task.json.package`
3. `get_default_package()`
4. 单仓库留空

### 3.3 update.ts PROTECTED_PATHS 验证

确保 `PROTECTED_PATHS` 中的 `.trellis/spec` 在 monorepo 目录结构下仍正确保护，不误删 `spec/<package>/` 子目录。

**Enforce in execution paths**（Codex CR2 #6）：当前 `PROTECTED_PATHS` 仅在报告中展示，不在迁移执行路径中 enforce。需要在 migration apply 逻辑中加入 protected-path 检查，防止 manifest 误删 spec/ 下内容。

### 3.4 Migration 支持

**a) Monorepo spec 迁移提示**：

触发点（Codex CR #5）：放在 session-start hook 中（Claude + iFlow 的 `session-start.py` + OpenCode 的 `session-start.js`，共三个平台），用明确谓词检测：
- `is_monorepo()` 为 true（config.yaml 有 `packages:`）
- 且存在 legacy 目录 `spec/backend/` 或 `spec/frontend/`（非 package 子目录）
- 且 `get_packages()` 返回的**任意** package 无对应 `spec/<pkg>/` 目录（Codex CR3 #4：部分迁移也触发，提示 "partial migration detected — packages X, Y still missing `spec/<pkg>/`"）
- 满足条件时输出一次性警告，提示用户手动重组 spec 目录

**b) S2 旧命令清理 manifest**：

新增 migration manifest 删除 S2 中废弃的 type-specific 命令文件。来源：S2 Codex cross-review P1 finding。

**执行策略**（Codex CR #4 + CR2 #1）：

⚠️ 现有 migration executor 的 `delete` 用 `fs.unlinkSync`（仅文件），但历史 manifest 含目录删除（如 0.3.4 的 `.kilocode/commands`），直接 auto-run 可能 crash。

安全方案：新增 `safe-file-delete` 迁移子类型，仅在确认目标是文件时自动执行。或在执行前加 `fs.statSync` 判断，文件用 `unlinkSync`，目录用 `rmSync({ recursive: true })`。

`safe-file-delete` 在 `trellis update` 默认流程中自动执行（无需 `--migrate`）。rename/move/目录删除等有风险操作仍需 `--migrate` 显式触发。

**自动删除安全条件**（Codex CR3 #1 + CR6 #1）：`safe-file-delete` 自动执行前必须校验文件内容 hash 与已知旧模板 hash 匹配。若用户已自定义（hash 不匹配），跳过删除并在 dry-run 报告中提示 "modified, skipped"。

hash 基准来源：manifest 文件中 `safe-file-delete` 条目需包含 `allowed_hashes` 字段（数组），记录该文件在各历史版本中的已知 hash 值。生成 manifest 时从 git history 或当前 template hash tracking 提取。示例：
```json
{ "type": "safe-file-delete", "from": ".claude/commands/trellis/check-backend.md", "allowed_hashes": ["a1b2c3d4", "e5f6g7h8"] }
```

**与 `update.skip` 交互**（Codex CR6 #2）：`safe-file-delete` 尊重 `config.yaml` 中的 `update.skip` 配置。若待删文件路径匹配 `update.skip` 条目，跳过删除并在报告中标记 "skipped (update.skip)"。

**无版本项目策略**（Codex CR4 #2）：若 `.trellis/.version` 不存在或无法解析，`safe-file-delete` 仍然执行（基于文件存在 + hash 匹配的安全条件已足够）。其他迁移类型（rename/delete/rename-dir）跳过并输出警告 `"unknown installed version, skipping migrations — run trellis init to fix"`。

**执行顺序**（Codex CR5 #1）：`safe-file-delete` 在 `update.ts` 中的执行位置：
1. 计算 `safeFileDeletes` 列表（扫描 manifest + 检查文件存在 + hash 匹配）
2. 将 `safeFileDeletes` 纳入 "是否有变更" 判定（非空则不 early-return "up to date"）
3. 在 dry-run summary 中展示待删除文件列表
4. 在 backup 创建之后、template 写入之前执行删除
5. 执行后更新 hash tracking

**精确路径矩阵**（Codex CR #6）：

| 平台 | 格式 | 删除文件 |
|------|------|----------|
| Claude | md | `.claude/commands/trellis/before-backend-dev.md`, `before-frontend-dev.md`, `check-backend.md`, `check-frontend.md` |
| Cursor | md (prefix) | `.cursor/commands/trellis-before-backend-dev.md`, `trellis-before-frontend-dev.md`, `trellis-check-backend.md`, `trellis-check-frontend.md` |
| iFlow | md | `.iflow/commands/trellis/before-backend-dev.md`, `before-frontend-dev.md`, `check-backend.md`, `check-frontend.md` |
| OpenCode | md | `.opencode/commands/trellis/before-backend-dev.md`, `before-frontend-dev.md`, `check-backend.md`, `check-frontend.md` |
| Kilo | md (workflows) | `.kilocode/workflows/before-backend-dev.md`, `before-frontend-dev.md`, `check-backend.md`, `check-frontend.md` |
| Gemini | toml | `.gemini/commands/trellis/before-backend-dev.toml`, `before-frontend-dev.toml`, `check-backend.toml`, `check-frontend.toml` |
| Codex | SKILL.md | `.agents/skills/before-backend-dev/SKILL.md`, `before-frontend-dev/SKILL.md`, `check-backend/SKILL.md`, `check-frontend/SKILL.md` |
| Kiro | SKILL.md | `.kiro/skills/before-backend-dev/SKILL.md`, `before-frontend-dev/SKILL.md`, `check-backend/SKILL.md`, `check-frontend/SKILL.md` |
| Qoder | SKILL.md | `.qoder/skills/before-backend-dev/SKILL.md`, `before-frontend-dev/SKILL.md`, `check-backend/SKILL.md`, `check-frontend/SKILL.md` |

注意：skills 平台（Codex/Kiro/Qoder）删除的是文件（`SKILL.md`），删除后需检查并清理空的父目录（如 `.agents/skills/before-backend-dev/`）。

**Manifest 生成策略**（Codex CR2 #2 + CR3 #5）：路径矩阵在**发布时**从当前 platform registry 快照生成为静态 JSON manifest 文件（`src/migrations/manifests/0.4.0-beta.1.json`），提交到仓库。运行时 executor 直接读取静态 manifest，不再动态计算。新增 regression test 验证 manifest 路径矩阵与当前 registry + template 一致。

### 3.5 大 monorepo spec 注入限制

**现状**：`session-start.py` 扫描 `spec/` 下所有 `index.md` 全量注入 prompt；`start.md` 的 `get_context.py --mode packages` 也列出所有 package。对于几百个 package 的大 monorepo，会导致 prompt 过大。

**config.yaml 新增 `session` 配置**：

```yaml
session:
  # 限制 session-start 自动注入的 spec scope
  # 不配置时默认全量扫描（向后兼容）
  spec_scope:
    - cli          # 只注入这些 package 的 spec index
    - docs-site
  # 或用 "active_task" 表示仅注入当前 task 对应的 package
  # spec_scope: active_task
```

**行为规则**：
- **无 `session.spec_scope`**：全量扫描（现有行为，向后兼容）
- **`spec_scope` 为列表**：仅扫描指定 package 的 `spec/<pkg>/*/index.md`
- **`spec_scope: active_task`**：读取 `.current-task` → task.json `package` 字段，仅注入对应 package 的 spec；无 active task 时 fallback 到 `default_package`，再 fallback 到全量
- **单仓库**（无 `packages:`）：忽略此配置，全量扫描
- **`spec/guides/` 始终注入**（Codex CR3 #3）：无论 scope 如何配置，`spec/guides/` 共享目录始终被扫描和注入，scope 仅限制 package-specific layers

**scope 校验**（Codex CR3 #2 + CR5 #3）：
- `spec_scope` 列表中的 package name 对照 `get_packages()` 校验
- 无效条目打印警告（`"spec_scope contains unknown package: X, ignoring"`）并跳过
- **有效 scope 为空时**（所有条目无效）：fallback 到 `task.json.package` → `default_package` → 全量扫描，并输出强警告
- `active_task` 模式下 `task.json.package` 引用已删除 package 时，fallback 到 `default_package`，再 fallback 到全量
- 当 active task package 不在 `spec_scope` 列表中时，输出警告 `"active task package 'X' is out of configured spec_scope"`

**影响范围**：
- `session-start.py`（Claude + iFlow）+ `session-start.js`（OpenCode）：扫描逻辑加 scope 过滤
- `get_context.py --mode packages`：输出加标注哪些 package 在 scope 内（scope 外标 `(out of scope)`）
- `before-dev.md`：同理，只读 scope 内的 spec

---

## 受影响文件

| 文件 | 改动 |
|------|------|
| `packages/cli/src/templates/trellis/scripts/task.py` | `--package` 参数 + `get_implement_backend/frontend()` 改为接收 package 参数，输出 `spec/<pkg>/<layer>/index.md` |
| `packages/cli/src/templates/trellis/scripts/add_session.py` | `--package` 可选参数 |
| `packages/cli/src/templates/trellis/scripts/common/config.py` | 新增 `validate_package()` + `get_spec_scope()` + `resolve_package()` |
| `packages/cli/src/templates/trellis/scripts/create_bootstrap.py` | monorepo 下 `related_files` 路径使用 `spec/<pkg>/backend/` 而非 `spec/backend/` |
| `packages/cli/src/templates/claude/hooks/session-start.py` | monorepo spec 迁移提示 + spec_scope 过滤 |
| `packages/cli/src/templates/iflow/hooks/session-start.py` | monorepo spec 迁移提示 + spec_scope 过滤（同 Claude） |
| `packages/cli/src/templates/opencode/plugin/session-start.js` | monorepo spec 迁移提示 + spec_scope 过滤（JS 版，需独立实现 config.yaml 读取，无法复用 Python config.py） |
| `packages/cli/src/templates/opencode/lib/trellis-context.js` | 可能需扩展以支持 config.yaml 读取 |
| `packages/cli/src/templates/trellis/scripts/get_context.py` | `--mode packages` 输出标注 scope 内/外 |
| `packages/cli/src/commands/update.ts` | 验证 PROTECTED_PATHS + safe-file-delete 执行 |
| `packages/cli/src/types/migration.ts` | `MigrationItem.type` 新增 `"safe-file-delete"` + `allowed_hashes` 字段 |
| `packages/cli/src/migrations/manifests/` | 新增 S2 旧命令清理 manifest |

## Acceptance Criteria

- [ ] `task.py create --package cli` 正确写入 task.json
- [ ] `task.py init-context` 在 monorepo 模式下注入 `spec/<package>/backend/index.md`
- [ ] `task.py init-context` 在单仓模式下保持 `spec/backend/index.md`（不引入 package 前缀）
- [ ] `task.py list` 显示 package 标签
- [ ] `--package` 传入非法值时 fail-fast 并提示可选包
- [ ] `trellis update` 不损坏 monorepo spec 目录
- [ ] 无 `--package` 时行为完全兼容现有单仓逻辑
- [ ] `trellis update` 自动清理用户项目中残留的 S2 旧命令文件（无需 `--migrate`）
- [ ] skills 平台旧命令删除后空目录被清理
- [ ] session-start 检测到 legacy spec 目录时输出迁移提示（Claude + iFlow + OpenCode 三平台）
- [ ] migration manifest 路径从 platform registry 派生，非硬编码
- [ ] migration executor 安全处理文件/目录删除（不因目录 crash）
- [ ] `PROTECTED_PATHS` 在 migration 执行路径中 enforce
- [ ] `safe-file-delete` 仅删除 hash 匹配旧模板的文件，自定义文件跳过
- [ ] `spec_scope` 列表模式：仅注入指定 package 的 spec index
- [ ] `spec_scope: active_task` 模式：注入当前 task package 的 spec
- [ ] `spec_scope` 无效 package name 打印警告并跳过
- [ ] `spec/guides/` 在任何 scope 配置下始终注入
- [ ] 单仓库忽略 `spec_scope` 配置，全量扫描
- [ ] legacy spec 部分迁移（部分 package 有 `spec/<pkg>/`）也触发警告
- [ ] 推断来源的非法 package（stale task.json）warn + fallthrough 而非 fail-fast
- [ ] 无 `.trellis/.version` 时 `safe-file-delete` 仍执行，其他迁移跳过并警告
- [ ] monorepo 模式下无有效 package 时 `init-context` 报错而非 fallback 到单仓路径
- [ ] `safe-file-delete` 在 backup 之后、template 写入之前执行
- [ ] `spec_scope` 有效列表为空时 fallback 到 task→default→full 并输出强警告
- [ ] `safe-file-delete` manifest 包含 `allowed_hashes` 字段
- [ ] `safe-file-delete` 尊重 `update.skip` 配置
- [ ] `create_bootstrap.py` monorepo 下生成正确的 `spec/<pkg>/` 路径
- [ ] OpenCode `session-start.js` 的 spec_scope 过滤逻辑与 Python 版行为一致

## Codex Cross-Review

### Round 1

**Date**: 2026-03-11
**Model**: gpt-5.3-codex, reasoning: high
**Result**: 6 findings, all incorporated

| Level | Issue | Action |
|-------|-------|--------|
| CRITICAL | 单仓 `init-context` 会错误使用 `spec/cli/backend/` 路径 | 新增 spec 路径解析规则（3.1） |
| WARNING | 未定义 package 解析优先级 | 新增优先级链（3.1） |
| WARNING | package 非法值未校验 | 新增 fail-fast 校验（3.1） |
| CRITICAL | delete 迁移需 `--migrate` 才执行 | 改为 delete 类型自动执行（3.4b） |
| WARNING | monorepo spec 迁移提示触发点不明确 | 放到 session-start.py（3.4a） |
| NITPICK | 缺少精确路径矩阵 + skills 目录清理 | 新增完整路径表 + 空目录清理（3.4b） |

### Round 2 (full review with code context)

**Date**: 2026-03-11
**Model**: gpt-5.3-codex, reasoning: xhigh, full-auto
**Result**: 6 findings, all incorporated

| Level | Issue | Action |
|-------|-------|--------|
| CRITICAL | delete 自动执行 + `unlinkSync` 无法删目录，历史 manifest 含目录删除会 crash | 新增 safe-file-delete 子类型 + `statSync` 判断（3.4b） |
| WARNING | 路径矩阵 Codex 用 `.agents/skills`、Kilo 用 `.kilocode/workflows`，PRD 写错 | 修正路径，要求从 registry 派生（3.4b） |
| WARNING | legacy spec 检测依赖 `default_package`（optional），未设置时检测失效 | 改用 `get_packages()` keys 判定（3.4a） |
| WARNING | 迁移提示仅 Claude hook，iFlow 也有 session-start.py 会遗漏 | 两个平台都加（3.4a） |
| WARNING | `add_session` 缺 package 解析优先级 | 补充优先级链（3.2） |
| WARNING | `PROTECTED_PATHS` 仅在报告中展示，未在迁移执行中 enforce | 新增执行路径 enforce（3.3） |

### Round 3 (full review with code context + 3.5)

**Date**: 2026-03-11
**Model**: gpt-5.3-codex, reasoning: xhigh, full-auto
**Result**: 7 findings, all incorporated

| Level | Issue | Action |
|-------|-------|--------|
| CRITICAL | `safe-file-delete` 自动删除可能误删用户自定义旧命令文件 | 新增 hash 匹配条件，仅删已知模板内容（3.4b） |
| WARNING | `spec_scope` 校验行为未定义（无效 package、stale task） | 补充校验 + fallback 规则（3.5） |
| WARNING | scope 限制可能漏掉 `spec/guides/` 共享目录 | 明确 guides 始终注入（3.5） |
| WARNING | legacy spec 警告仅全部缺失触发，部分迁移不报警 | 改为任意 package 缺失即警告（3.4a） |
| WARNING | "从 registry 派生路径"在 registry 变更后历史 manifest 不一致 | 改为发布时生成静态 manifest + regression test（3.4b） |
| WARNING | 3.5 缺少 acceptance criteria | 补充 7 条 AC（AC） |
| NITPICK | 3.1 fallback 描述与优先级链有歧义 | 改为 per-command 解析表格（3.1） |

### Round 4 (verification review)

**Date**: 2026-03-11
**Model**: gpt-5.3-codex, reasoning: xhigh, full-auto
**Result**: 3 findings, 2 valid + 1 false positive (Antigravity 从未有旧命令)

| Level | Issue | Action |
|-------|-------|--------|
| WARNING | Antigravity 缺失于删除矩阵 | 忽略（false positive：AG 在 S2 废弃后才加入） |
| WARNING | 无 `.trellis/.version` 时 migration 行为未定义 | 新增无版本项目策略（3.4b） |
| WARNING | `add_session` fallback 与 fail-fast 校验冲突 | 拆分：CLI 来源 fail-fast，推断来源 warn + fallthrough（3.1） |

### Round 5 (final verification)

**Date**: 2026-03-11
**Model**: gpt-5.3-codex, reasoning: xhigh, full-auto
**Result**: 3 findings, all incorporated

| Level | Issue | Action |
|-------|-------|--------|
| WARNING | `safe-file-delete` 在 update.ts 执行流中位置未定义 | 新增执行顺序 5 步（3.4b） |
| WARNING | monorepo fallthrough 到单仓路径生成错误 spec 路径 | monorepo 禁止 fallback 到单仓，改为报错（3.1） |
| WARNING | `spec_scope` 有效列表为空时仅注入 guides | 空 scope fallback 到 task→default→full + 强警告（3.5） |

### Round 6 (final confirmation)

**Date**: 2026-03-11
**Model**: gpt-5.3-codex, reasoning: xhigh, full-auto
**Result**: 2 findings, all incorporated

| Level | Issue | Action |
|-------|-------|--------|
| WARNING | `safe-file-delete` hash 基准来源不明（旧模板已删除） | manifest 内嵌 `allowed_hashes` 字段 + 示例（3.4b） |
| WARNING | `safe-file-delete` 与 `update.skip` 优先级未定义 | 尊重 `update.skip`，匹配时跳过（3.4b） |
