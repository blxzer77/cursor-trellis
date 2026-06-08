# S1-S4 代码变更后全量 Spec 更新

## Background

v0.4.0-beta 的 S1-S4 实现了大量新功能（monorepo 检测、命令合并、safe-file-delete、worktree submodule），
但对应的 spec 文档未同步更新。Spec 是 AI agent 的开发指南，过时的 spec 会导致后续开发偏离实际代码。

## Goal

审查 S1-S4 全部代码变更，将新增/变更的 API、行为、约定更新到对应的 spec 文件中。

## Scope

### S1: Monorepo Init + Detection (`project-detector.ts`, `init.ts`)
- [ ] `detectMonorepo()` 的检测逻辑和支持的 workspace manager 列表
- [ ] `expandWorkspaceGlobs()` 的 glob 支持范围和已知限制
- [ ] monorepo init 流程：config.yaml 生成、包级 spec 目录创建
- [ ] `readPackageName()` 各语言的 fallback 链

### S2: 命令合并 (before-backend-dev + before-frontend-dev → before-dev, etc.)
- [ ] 合并后的命令列表（各平台 EXPECTED_COMMAND_NAMES / EXPECTED_SKILL_NAMES）
- [ ] `platform-integration.md` 中的命令注册清单更新

### S3: Safe-File-Delete (`update.ts`)
- [ ] `safe-file-delete` migration 类型的工作机制
- [ ] `collectSafeFileDeletes` 分类逻辑（delete / skip-missing / skip-modified / skip-protected / skip-update-skip）
- [ ] `PROTECTED_PATHS` 列表和 `isProtectedPath()` 行为
- [ ] `loadUpdateSkipPaths()` 的 config.yaml 格式
- [ ] `migrations.md` 更新 safe-file-delete 类型说明

### S4: Worktree + Submodule (`multi_agent/`)
- [ ] worktree 创建/清理流程
- [ ] submodule 检测和初始化
- [ ] `create_pr.py` 的 PR 创建流程

### Templates Sync
- [ ] `.trellis/spec/` 变更同步到 `src/templates/markdown/spec/`

## Acceptance Criteria

- [ ] 每个 S1-S4 的新功能在 spec 中都有对应说明
- [ ] `migrations.md` 包含 safe-file-delete 类型文档
- [ ] `platform-integration.md` 的命令列表与实际代码一致
- [ ] Templates 中的 spec 文件与 `.trellis/spec/` 同步
