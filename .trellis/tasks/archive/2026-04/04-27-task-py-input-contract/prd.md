# task.py 子命令输入契约对齐

## Goal

`task.py archive` 是唯一一个不接受相对路径/绝对路径的子命令（所有其他 `dir` 类子命令都走 `resolve_task_dir`，唯独 `archive` 用 `find_task_by_name` 只认 slug）。把 `cmd_archive` 也切到 `resolve_task_dir`，消除这个 UX 不一致。

触发场景：`/trellis:finish-work` skill 文档示例就是 `python3 ./.trellis/scripts/task.py archive <task-name>`，但很多调用现场（含 LLM 生成的命令）会习惯性传完整路径，导致首次失败需要重试。

## What I already know

* 输入契约审计（grep + 阅读源码）：

| 命令 | 实现 | Resolver | 输入契约 |
|---|---|---|---|
| `start` | task.py:80 | `resolve_task_dir` | name + relative + absolute |
| `add-context` / `validate` / `list-context` | task_context.py:36/90/175 | `resolve_task_dir` | name + relative + absolute |
| `set-branch` / `set-base-branch` / `set-scope` | task_store.py:509/540/575 | `resolve_task_dir` | name + relative + absolute |
| `add-subtask` / `remove-subtask` | task_store.py:410-411/463-464 | `resolve_task_dir` | name + relative + absolute |
| `create --parent` | task_store.py:244 | `resolve_task_dir` | name + relative + absolute |
| **`archive`** | **task_store.py:302** | **`find_task_by_name`** | **❌ slug only** |

* `resolve_task_dir`（task_utils.py:174）已经在内部对"裸 slug"分支调用 `find_task_by_name`，suffix-match 行为完全保留。一行替换无副作用。
* `cmd_archive` 内部 line 331、346 还有两处 `find_task_by_name` 调用，是用 task.json 里读到的 dir name 做 parent/child 关系查找，**不是用户输入**，保持不动。
* 现有测试：`packages/cli/test/regression.test.ts:1095` 和 `init.integration.test.ts:752` / `init-joiner.integration.test.ts:134` 都用 slug 形式调用 archive，本变更对它们零影响。

## Requirements

* `cmd_archive` (`common/task_store.py:302`) 用 `resolve_task_dir(task_input, repo_root)` 替换 `find_task_by_name(task_name, tasks_dir)`。仅这一行核心改动。
* argparse `p_archive.add_argument("name", ...)` 的 help 文案从 `"Task name"` 改为 `"Task directory or name"`（不改 arg name 本身，避免无关变更）。
* `task.py` docstring（line 17）和 `show_usage()`（line 300）里的 `archive <task-name>` 文案改为 `archive <task-dir>`，与同文件中其他 `<task-dir>` 风格一致。
* 错误提示保持原有 "Task not found: <input>" + active tasks 列表行为不变。
* 测试：在 `packages/cli/test/regression.test.ts` 已有的 archive 测试附近加 1 个新 it block，覆盖相对路径 + 绝对路径两种输入形式（slug 形式已被现有测试覆盖）。沿用现有 `setupTaskRepo` + `execSync(...task.py archive ...)` + `--no-commit` 的模式。`.trellis/scripts/` 暂无 Python 测试框架，沿用项目现有 TS shell-out 模式更一致。

## Acceptance Criteria

* [ ] `python3 .trellis/scripts/task.py archive 04-XX-foo` 正常工作（slug，行为不回归）
* [ ] `python3 .trellis/scripts/task.py archive .trellis/tasks/04-XX-foo` 正常工作（相对路径，bug 修复）
* [ ] `python3 .trellis/scripts/task.py archive /abs/path/.trellis/tasks/04-XX-foo` 正常工作（绝对路径，bug 修复）
* [ ] 找不到任务时仍打印 "Task not found" + active tasks 列表
* [ ] 现有 regression.test.ts:1095 和 init integration 测试不回归
* [ ] task.py docstring + show_usage 更新

## Definition of Done

* 改动落盘：`common/task_store.py:cmd_archive` + `task.py` argparse 段 + docstring/show_usage
* 现有测试全绿（`pnpm test`）
* 三种输入形式手动验证通过
* 无新增 lint / typecheck 错误

## Out of Scope

* `find_task_by_name` 函数本身不动（被 cmd_archive 内部 parent/child 查找复用，保持现状）
* `resolve_task_dir` 不动
* 其他子命令的 arg 命名（`add-context` 用 `dir`，`add-subtask` 用 `parent_dir`/`child_dir`，`archive` 改 `dir` 已与多数对齐；不强行统一所有命名）

## Technical Notes

* 关键文件：
  - `.trellis/scripts/common/task_store.py:290-311`（cmd_archive）
  - `.trellis/scripts/task.py:425-428`（argparse 注册）
  - `.trellis/scripts/task.py:13-20, 296-323`（usage 文档）
* 单测候选位置：暂无 Python pytest 框架，考虑加到 `packages/cli/test/regression.test.ts` 或新建一个简单 shell-based smoke。
