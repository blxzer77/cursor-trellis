# 模板硬编码 spec 路径动态化

> Depends on: S3 (`03-10-s3-task-update`)

## Goal

将 41 个模板文件中硬编码的 `spec/backend/` 和 `spec/frontend/` 路径替换为动态 `spec/<package>/<layer>/` 格式，使 monorepo 用户看到正确的 spec 路径指引。

## Background

S2 已让 `start.md` 和 `before-dev.md` 使用 `get_context.py --mode packages` 做动态发现。但其他命令模板中仍有大量硬编码的单仓路径作为指导文本。

这些不是可执行代码（不会导致 crash），但在 monorepo 项目中会误导 AI agent 去读不存在的路径。

## Scope

### 受影响命令（5 个命令 × 9-10 平台 = 41 个文件）

| 命令 | 平台数 | 硬编码内容 |
|------|--------|-----------|
| `finish-work` | 10 | checklist "Does `.trellis/spec/backend/` need updates?" |
| `break-loop` | 10 | checklist "Update `.trellis/spec/backend/` or `frontend/` docs" |
| `integrate-skill` | 10 | 映射表 `spec/frontend/`, `spec/backend/` |
| `onboard` | 10 | grep 命令 `spec/backend/*.md` |
| `create-command` | 6 | 示例 "Reference `.trellis/spec/frontend/index.md`" |

### 不在 scope（S3 已处理）

- `task.py` `get_implement_backend/frontend()` — S3 scope
- `create_bootstrap.py` — S3 scope
- `session-start.py/js` — S3 scope
- `start.md` / `before-dev.md` — S2 已完成

### 替换策略

**Option A: 用 `<package>/<layer>` 占位符**（推荐）
- 与 `workflow.md` 保持一致（已用 `<package>/<layer>` 风格）
- 示例：`spec/backend/` → `spec/<package>/backend/`（monorepo）或 `spec/backend/`（单仓）
- 在示例文本前加注释说明两种模式

**Option B: 用 `get_context.py --mode packages` 动态发现**
- 和 start.md/before-dev.md 一样，引导 AI 先跑脚本
- 但对 checklist 类文本不太合适（checklist 应是静态的）

建议：主要用 Option A，只在需要列举实际路径时用 Option B。

## Acceptance Criteria

- [ ] 41 个文件中不再有硬编码 `spec/backend/` 或 `spec/frontend/` 路径
- [ ] monorepo 用户看到的路径指引包含 `<package>` 占位符或动态发现说明
- [ ] 单仓用户看到的路径指引仍然正确
- [ ] 各平台同一命令的文本保持一致
