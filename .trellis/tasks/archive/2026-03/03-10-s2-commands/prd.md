# S2: 命令合并 + Hook/Start 动态化

> Parent: `03-10-v040-beta1` | Depends on: S1

## Goal

将 type-specific 命令合并为 generic 命令，所有命令和 Hook 改为动态发现 spec 路径，使 monorepo 下命令正常工作且新增 package 无需改命令文件。

## Scope

### 2.1 合并 type-specific 命令为 generic（9 平台）

**现状**: 每个平台有 `before-backend-dev` / `before-frontend-dev` / `check-backend` / `check-frontend` 等 type-specific 命令/SKILL。

**平台分布**:
| 平台类型 | 平台 | 命令格式 | 有 before-*/check-* |
|----------|------|----------|-------------------|
| Commands (md) | Claude, Cursor, iFlow, Kilo, OpenCode | `commands/trellis/*.md` | Yes (各 4 个) |
| Commands (toml) | Gemini | `commands/trellis/*.toml` | Yes (各 4 个) |
| Skills (SKILL.md) | Codex, Kiro, Qoder | `skills/*/SKILL.md` | Yes (各 4 个) |

共 ~36 个 type-specific 文件需要处理。

**合并为**:
| 新命令 | 替代 | 逻辑 |
|--------|------|------|
| `before-dev` | `before-backend-dev` + `before-frontend-dev` | 运行时自动发现 `spec/*/index.md` 或 `spec/<pkg>/*/index.md`，按任务类型加载 |
| `check` | `check-backend` + `check-frontend` | 根据 `git diff` 检测改了哪个 package，加载对应 spec |

**迁移策略**: 新增 generic 命令，直接删除旧 type-specific 命令。理由：v0.4.0-beta 允许 breaking changes，且旧命令在 monorepo 下本来就不工作（硬编码 `spec/backend/` 路径）。在 changelog 中注明迁移。

### 2.2 start.md 模板动态化（9 平台）

从硬编码 `cat .trellis/spec/frontend/index.md` 改为：
```bash
python3 ./.trellis/scripts/get_context.py --mode packages
# 然后读取对应 package 的 spec index
```

### 2.3 session-start.py 模板动态化

**现状**: 已部分动态化（S1 改为 filesystem-driven 扫描 spec 目录），但仍有改进空间。

**改为**:
- 保持 filesystem-driven 扫描（不依赖 `is_monorepo()`）
- 扫描 `spec/*/index.md`（flat）+ `spec/*/*/index.md`（nested）
- 有 `.current-task` 且 task.json 有 `package` 字段时，只注入对应 package 的 spec

### 2.4 inject-subagent-context.py 模板动态化

**现状**: 硬编码 spec 目录树 + check/debug fallback 引用 `check-backend`/`check-frontend`。

**改为**: 运行时读取实际 spec 结构 + 按 task.json package 过滤注入范围。

- check/debug fallback 从 `[check-backend, check-frontend]` 改为 `[check]`
- research context 从静态目录描述改为动态生成（扫描实际 spec 目录结构）

### 2.5 task.py init-context 默认上下文更新

**现状**: `task.py` 的 `init-context` 命令在生成 check.jsonl / debug.jsonl 时硬编码引用 `check-backend` 和 `check-frontend` 命令路径（4 处）。

**改为**: 默认上下文改用 generic `check` 命令路径。

### 2.6 parallel.md / agent 定义文件（4 平台）

清理以下文件中的硬编码 `spec/frontend/` `spec/backend/` 路径：
- `parallel.md`（claude, iflow, kilo, opencode）
- `agents/implement.md`（claude, iflow, opencode）
- `agents/check.md`（claude, iflow, opencode）
- `agents/research.md`（claude, iflow, opencode）
- `agents/dispatch.md`（iflow — 引用了 `check-backend.md` / `check-frontend.md`）

### 2.7 其他引用旧命令的文档

检查并更新以下模板中对旧命令的引用：
- `workflow.md` 模板
- `onboard.md` 模板（如有）
- `create-command.md` 模板（如有）

---

## Generic `check` 命令的 Package 检测策略

`check` 命令需要根据 git diff 确定检查哪个 package 的 spec。定义确定性策略：

| 场景 | 检测方式 | 行为 |
|------|---------|------|
| 单 package 变更 | `git diff --name-only` 路径映射到 `config.yaml packages` | 加载该 package 的 spec |
| 多 package 变更 | 同上，收集所有命中的 package | 加载所有命中 package 的 spec |
| 仅 root/shared 变更 | 路径不属于任何 package | 加载所有 spec（或仅 shared/guides） |
| 无 diff（clean） | 无变更文件 | 加载所有 spec，提示无变更 |
| 有 `.current-task` + `package` 字段 | task.json 指定的 package 优先 | 加载指定 package 的 spec |
| 非 monorepo 项目 | 无 packages 配置 | 加载所有 `spec/*/index.md`（现有行为） |

路径映射规则：
1. 读取 `config.yaml` 的 `packages` 列表，取每个 package 的 `path`
2. `git diff --name-only` 的每个文件路径，检查是否以某个 package path 为前缀
3. 收集所有命中的 package name

---

## 受影响文件

### 新增
- `before-dev.md` / `before-dev` SKILL（9 平台各 1 个）
- `check.md` / `check` SKILL（9 平台各 1 个）

### 修改
- `start.md` / `start` SKILL（9 平台）
- `session-start.py` / `session-start.js`（claude, iflow, opencode）
- `inject-subagent-context.py` / `.js`（claude, iflow, opencode）
- `task.py`（init-context 默认上下文）
- `parallel.md`（claude, iflow, kilo, opencode）
- `agents/*.md`（claude, iflow, opencode）
- `agents/dispatch.md`（iflow）
- `workflow.md` 模板

### 删除
- `before-backend-dev` / `before-frontend-dev`（9 平台，含 Codex/Kiro/Qoder 的 SKILL，共 ~18 文件）
- `check-backend` / `check-frontend`（9 平台，含 Codex/Kiro/Qoder 的 SKILL，共 ~18 文件）

同时需要从 CLI 的模板注册表中移除对应条目（configurators 里的 `getAllCommands()` / `getAllSkills()` 等）。

## Acceptance Criteria

- [ ] Generic `before-dev` 命令在单仓和 monorepo 下都正确发现 spec
- [ ] Generic `check` 命令根据变更文件自动定位 package（按检测策略表）
- [ ] `check` 命令处理多 package 变更、无 diff、root-only 变更等边界情况
- [ ] `session-start.py` 动态注入 spec，不再硬编码
- [ ] `inject-subagent-context` 按 task package 过滤
- [ ] `task.py init-context` 默认上下文使用 generic `check`（不再引用 `check-backend`/`check-frontend`）
- [ ] 旧 type-specific 命令已从模板和注册表中删除
- [ ] CLI `trellis update` 能清理用户项目中残留的旧命令文件
- [ ] 无 packages 配置的单仓项目一切行为不变
- [ ] iFlow dispatch.md 中旧命令引用已更新

## Known Limitations

- **大 monorepo payload**: 当无 active task 时，`session-start` / `before-dev` 会加载所有 package 的 spec index，在 package 数量较多时可能导致 prompt 过大。v0.4.0-beta 作为已知限制，后续可通过摘要 + 按需加载优化。

## Codex Cross-Review

**Date**: 2026-03-10
**Model**: gpt-5.3-codex
**Result**: 6 findings, 4 incorporated

| Level | Issue | Action |
|-------|-------|--------|
| CRITICAL | `task.py` init-context 硬编码 check-backend/check-frontend | 新增 2.5 纳入 scope |
| WARNING | Codex/Kiro/Qoder 平台矩阵错误 | 修正平台分布表 |
| WARNING | 其他文档引用旧命令 | 新增 2.7 + dispatch.md 加入 2.6 |
| WARNING | check 命令 package 检测策略未定义 | 新增检测策略表 |
| WARNING | session-start 用 is_monorepo() 门控有风险 | 已在 S1 解决（filesystem-driven），PRD 描述已修正 |
| WARNING | 大 monorepo payload 过大 | 记录为 Known Limitations |
