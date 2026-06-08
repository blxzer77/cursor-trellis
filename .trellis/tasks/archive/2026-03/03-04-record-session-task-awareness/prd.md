# Task: record-session-task-awareness

## Overview

record-session 流程中 AI 经常忘记归档已完成的 task，用户手动归档后又没有 auto-commit，导致 task 文件散落在工作区。根因是 record-session 流程缺少 task 感知能力。

本 task 合并了三个原始需求：
- `archive-auto-commit` — task 归档脚本支持自动 commit
- `session-commit-task` — add_session 时把 task 也一起 commit
- `optimize-context-task-display` — 优化 get_context 对活跃 task 的展示

## Requirements

### R1: `get_context.py --mode record` 特供输出

新增 `--mode record` 参数，输出专为 record-session 场景设计的精简信息：

```
========================================
SESSION CONTEXT (RECORD MODE)
========================================

## [!!!] MY ACTIVE TASKS (Assigned to taosu)
[!] Review whether any should be archived before recording this session.

- [P2] task 归档脚本支持自动 commit (planning) — 03-04-archive-auto-commit
- [P2] 优化 get_context.py 展示逻辑 (completed) — 03-04-optimize-context-task-display

## GIT STATUS
Branch: main
Working directory: Clean

## RECENT COMMITS
be56cba feat(platform): add Qoder support (#71)
c72f7c2 docs(readme): update EN/ZH slogans (#70)

## CURRENT TASK
(none)

========================================
```

与默认模式的区别：
- MY ACTIVE TASKS 放在最前面，用 `[!!!]` 醒目标记
- 砍掉 DEVELOPER、ACTIVE TASKS（跟 MY TASKS 重复）、JOURNAL、PATHS
- AI 看到后自行判断是否需要先归档再记录

实现：
- `git_context.py` 新增 `get_context_text_record()` 函数
- `main()` 解析 `--mode` 参数，`record` 调用新函数，默认走原逻辑
- MY ACTIVE TASKS 数据来源：遍历 tasks/，读 task.json，筛选 `assignee == current_developer`

### R2: `task.py archive` 自动 commit

归档成功后自动 `git add + git commit`：

- `git add -A .trellis/tasks/` — stage 旧路径删除 + 新归档路径
- `git diff --cached --quiet -- .trellis/tasks/` — 检查有无变更
- `git commit -m "chore(task): archive <task-name>"`
- 新增 `--no-commit` flag 跳过自动提交
- git 失败时打印 warning 到 stderr，archive 仍视为成功（return 0）
- 使用已有的 `_run_git_command` 保证 Windows 兼容

### R3: `add_session.py` commit scope 扩大到 tasks/

`_auto_commit_workspace()` 的 `git add` 和 `git diff` 命令同时覆盖 `.trellis/workspace` 和 `.trellis/tasks`。

### R4: `record-session.md` prompt 更新

Step 1 改为 `get_context.py --mode record`，删除末尾的可选 archive 段落（因为 AI 现在会在 Step 1 就看到 task 列表并自行判断）。

## Files to Modify

| File | Change |
|------|--------|
| `src/templates/trellis/scripts/common/git_context.py` | 新增 `get_context_text_record()`，`main()` 加 `--mode` 参数 |
| `src/templates/trellis/scripts/task.py` | `cmd_archive()` 末尾加 auto-commit，argparse 加 `--no-commit` |
| `src/templates/trellis/scripts/add_session.py` | `_auto_commit_workspace()` 扩大 git add scope |
| `src/templates/claude/commands/trellis/record-session.md` | Step 1 改为 `--mode record`，移除可选 archive 段落 |

### 同步要求

以下文件必须同步修改（template + installed copy）：
- `src/templates/trellis/scripts/common/git_context.py` ↔ `.trellis/scripts/common/git_context.py`
- `src/templates/trellis/scripts/task.py` ↔ `.trellis/scripts/task.py`
- `src/templates/trellis/scripts/add_session.py` ↔ `.trellis/scripts/add_session.py`
- `src/templates/claude/commands/trellis/record-session.md` ↔ `.claude/commands/trellis/record-session.md`

## Acceptance Criteria

- [ ] `python3 get_context.py --mode record` 输出 MY ACTIVE TASKS 在最前面，带 `[!!!]` 标记
- [ ] `python3 get_context.py` 默认输出不变
- [ ] `python3 task.py archive <name>` 归档后自动 git commit
- [ ] `python3 task.py archive <name> --no-commit` 跳过 auto-commit
- [ ] `_auto_commit_workspace()` 的 git add 覆盖 `.trellis/workspace` 和 `.trellis/tasks`
- [ ] record-session.md 使用 `--mode record`
- [ ] template 和 installed copy 内容一致
- [ ] 所有脚本遵循 script-conventions.md（Python 3.10+、type hints、pathlib、_run_git_command）

## Technical Notes

1. `_run_git_command` 已在 `task.py` 中 import（line 44），直接使用
2. `get_developer()` 已有，用于获取当前 developer name 筛选 MY TASKS
3. `add_session.py` 的 `_auto_commit_workspace()` 约在 274-299 行，改 git add 和 git diff 的路径参数即可
4. `--mode` 参数用 argparse choices=["default", "record"]，default="default"

## Out of Scope

- get_context.py 默认模式的优化（保持不变）
- 单元测试（这些脚本目前无测试覆盖）
- config.yaml 可配置 commit message
- 其他平台的 record-session 命令更新（仅改 claude 版本，其他平台通过 trellis update 同步）
