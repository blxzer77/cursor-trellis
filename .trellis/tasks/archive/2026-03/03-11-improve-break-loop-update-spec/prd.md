# 改进 break-loop 和 update-spec 命令

## Goal

更新两个 Trellis slash command（`break-loop.md` 和 `update-spec.md`），修正过时内容并增强分析能力。

## Background

两个命令目前存在：
- Spec 结构引用过时（写死 `backend/` / `frontend/`，实际已迁移为 `<package>/<layer>/` 结构）
- break-loop 只分析 bug 本身，缺少对「对话过程效率」的反思
- update-spec 的 quality checklist 不分场景，简单更新也要求 7-section 完整模板
- update-spec 模板区过长，可外置

## Requirements

### P0 — 修正过时结构引用（两个文件）

- [ ] `break-loop.md`: 第 58-68 行 spec 结构改为 `<package>/<layer>/` 格式
- [ ] `update-spec.md`: 第 57-68 行 spec 结构改为 `<package>/<layer>/` 格式
- [ ] `update-spec.md`: Decision Rule 不再写死 `backend/` / `frontend/`，改为引导动态发现
- [ ] 引导使用 `python3 ./.trellis/scripts/get_context.py --mode packages` 发现可用 spec 位置

### P1 — update-spec checklist 分场景

- [ ] 拆成「基础检查」（所有场景适用）和「深度检查」（infra/cross-layer 场景）
- [ ] 基础检查：内容具体可执行、有代码示例、解释了 why、放对了文件、无重复
- [ ] 深度检查：签名/契约、校验错误矩阵、Good/Base/Bad cases、测试断言点

### P1 — break-loop 加「对话效率」维度

- [ ] 在现有维度 2（Why Fixes Failed）之后新增维度 2.5 或调整为维度 3
- [ ] 分析：对话中走了哪些弯路？AI 在哪个方向浪费了最多时间？
- [ ] 分析：有没有更好的工具/命令/prompt 本可以更快定位？
- [ ] 分析：人类的指令哪里不够精确导致 AI 误解？

### P2 — update-spec 加 diff-driven 建议

- [ ] 新增步骤：运行 `git diff --name-only` 自动列出改动文件
- [ ] 基于文件路径映射建议可能需要更新的 spec 目录
- [ ] 作为可选的 Step 0 放在 "Identify What You Learned" 之前

### P2 — update-spec 模板区外置（可选）

- [ ] 评估是否将 6 个模板移到 references 文件
- [ ] 如果外置，SKILL.md 保留模板名称 + 指针

## Acceptance Criteria

- [ ] 两个文件的 spec 结构引用与实际项目一致
- [ ] update-spec 的 checklist 区分简单更新和深度更新
- [ ] break-loop 包含对话效率分析维度
- [ ] 所有改动保持向后兼容（不破坏现有使用习惯）

## Technical Notes

- 文件位置：`.claude/commands/trellis/break-loop.md` 和 `.claude/commands/trellis/update-spec.md`
- 这些是 Claude Code slash command，不是代码文件，不需要 lint/typecheck
- break-loop 中第 121-122 行的 template sync 提醒是 Trellis 内部细节，保留但明确标注仅限 Trellis 项目
