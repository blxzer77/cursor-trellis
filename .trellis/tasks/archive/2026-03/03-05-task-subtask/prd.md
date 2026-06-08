# Task Sub-task - 增加 task 的 sub task 功能

## Goal

为 task 系统增加父子关系管理能力。Subtask 就是普通 task（完整 task 目录 + task.json），通过 `children`/`parent` 字段建立层级关系。这样 parallel / multi-agent 等流程可以直接使用子 task 的所有字段（branch, worktree_path, assignee 等）。

## Requirements

### CLI 命令
- `task.py add-subtask <parent-dir> <child-dir>` — 建立父子关系（在 parent 加 children、在 child 加 parent）
- `task.py remove-subtask <parent-dir> <child-dir>` — 解除父子关系
- `task.py create "<title>" --parent <parent-dir>` — 创建 task 时直接指定 parent（可选快捷方式）

### Schema 变更
- task.json 新增 `children: string[]`（子 task 目录名列表，默认 `[]`）
- task.json 新增 `parent: string | null`（父 task 目录名，默认 `null`）
- 废弃旧的 `subtasks: {name, status}[]` 字段（保留兼容读取，不再写入）

### 展示增强
- `task.py list` — 子 task 缩进显示在父 task 下方，展示子 task 进度（如 `[2/3 done]`）
- `get_context.py` — text/JSON/record 三种模式展示父子关系
- `task_queue.py` — task info dict 增加 children 信息

### Prompt 引导
- `brainstorm.md` — 复杂任务收敛后引导 AI 拆成子 task
- `start.md` — 复杂任务分类时提示拆子 task

## Acceptance Criteria

- [ ] `add-subtask` 建立双向关系（parent.children + child.parent）
- [ ] `remove-subtask` 清除双向关系
- [ ] `create --parent` 创建 task 时直接关联
- [ ] 子 task 已有 parent 时，`add-subtask` 报错拒绝
- [ ] `task.py list` 层级展示（子 task 缩进）
- [ ] `task.py list` 显示子 task 进度摘要
- [ ] `get_context.py` 三种模式展示层级信息
- [ ] `archive` 子 task 时自动从 parent.children 移除
- [ ] 现有 task 功能不受影响（无 parent/children 的 task 行为不变）

## Definition of Done

- Lint / typecheck pass
- 模板副本同步（src/templates/trellis/scripts/ <-> .trellis/scripts/）
- trellis-meta 文档更新
- 多平台 prompt 同步（claude/iflow/opencode/kilo）

## Technical Approach

Subtask = 普通 task + 父子引用。通过 `children`/`parent` 两个字段双向链接，不改变 task 目录结构。旧的 `subtasks` 字段标记为 deprecated，bootstrap task 仍可用旧格式但新代码不再写入。

### 改动文件清单

**核心逻辑（6 个文件 = 3 对模板+live）：**
1. `src/templates/trellis/scripts/task.py` — +2 子命令（add/remove-subtask）、create 加 --parent、list 层级展示、archive 清理引用
2. `.trellis/scripts/task.py` — live copy 同步
3. `src/templates/trellis/scripts/common/git_context.py` — 层级展示
4. `.trellis/scripts/common/git_context.py` — live copy 同步
5. `src/templates/trellis/scripts/common/task_queue.py` — children 信息
6. `.trellis/scripts/common/task_queue.py` — live copy 同步

**Schema 变更（需同步）：**
7. `src/commands/init.ts` — TaskJson 接口加 children/parent、bootstrap task 兼容
8. `src/commands/update.ts` — migration task 创建加默认值
9. `src/templates/trellis/scripts/create_bootstrap.py` + live copy — bootstrap 兼容

**Prompt 引导（10 个文件）：**
10-13. `brainstorm.md` x4 平台模板
14-17. `start.md` x4 平台模板
18-19. `.claude/commands/trellis/{start,brainstorm}.md` live copy

**文档（1 个文件）：**
20. `.claude/skills/trellis-meta/references/core/tasks.md`

## Decision (ADR-lite)

**Context**: subtask 需要与 task 完全一致的字段，以支持 parallel/multi-agent 流程
**Decision**: subtask = 普通 task + parent/children 双向引用，不发明新 schema
**Consequences**: 设计简洁，所有现有 task 工具链天然兼容子 task；改动文件较多但每个文件改动量小

## Out of Scope

- 多层嵌套（sub-sub-task，当前只支持一层）
- 自动推进父 task 状态（所有子 task done → 父 auto done）
- 子 task 的自动创建（AI 拆解只是 prompt 引导，不是自动行为）

## Technical Notes

- 旧 `subtasks: {name, status}[]` 字段 deprecated，bootstrap task 保留兼容
- `children` 存目录名（如 `"03-05-tmux-support"`），不存绝对路径
- `parent` 存目录名或 null
- 双向引用需要在 add/remove/archive 时保持一致性
- `list` 展示：有 parent 的 task 不在顶层显示，缩进在父 task 下
