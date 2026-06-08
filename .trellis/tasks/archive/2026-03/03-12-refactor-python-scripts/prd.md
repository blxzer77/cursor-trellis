# 重构 .trellis/scripts Python 代码

## Background

基于代码分析和 python-design skill 中的原则，当前 `.trellis/scripts/` 存在显著的设计问题：
- 工具函数大量重复（`_read_json_file` 8 处、`Colors` 6 处、task 迭代 9 处）
- 零类型安全（135 个 `.get()` 调用，仅 1 个 dataclass）
- 神模块（`task.py` 1452 行、`git_context.py` 861 行）
- 信息泄漏（task.json schema 知识散布各处）

## Goal

按 python-design skill 的原则重构，消除重复、引入类型安全、拆分过大模块，同时保持所有现有功能不变。

## Constraints

- **零行为变化**：所有 CLI 入口的 stdout、stderr、exit code、ANSI color 必须完全一致
- **增量可测**：每个阶段可独立验证（`python3 task.py list` 等命令仍然工作）
- **不引入新依赖**：保持零 pip 依赖（标准库 only）
- **同步模板**：`.trellis/scripts/` 改动必须同步到 `packages/cli/src/templates/trellis/scripts/`
- **入口路径稳定**：`python3 .trellis/scripts/task.py` 等路径被 .md 模板大量引用，不能变
- **Lossless round-trip**：类型化读取后写回 task.json 必须保留未知字段（不能因为 TypedDict 定义不全而丢字段）

## Phases

### Phase 1: 共享基础设施提取 (P0)

消除最高频的重复。

- [ ] **`common/io.py`** — 提取 `read_json` / `write_json`，替换 8 处 `_read_json_file` 和 5 处 `_write_json_file`
- [ ] **`common/log.py`** — 提取 `Colors` 类 + `log_info/log_error/log_warn/log_success`，替换 6+3 处重复
- [ ] **`common/git.py`** — 将 `_run_git_command` 从 `git_context.py` 提取为公共 API `run_git()`，在 `git_context.py` 保留 `_run_git_command = run_git` 兼容别名
- [ ] **`sys.path.insert` 替代方案**：multi_agent/ 脚本改为在文件顶部使用 bootstrap shim（与 task.py 现有模式一致：`from common.xxx import yyy`），保持 `python3 path/to/script.py` 的调用方式不变

### Phase 2: 类型安全引入 (P1)

为核心数据结构引入类型定义。

- [ ] **`common/types.py`** — 定义核心类型：
  - `TaskData(TypedDict)` — task.json 的**已知字段**形状（仅用于读取路径的类型提示）
  - `TaskInfo(dataclass, frozen)` — 加载后的任务对象（只读视图）
  - `AgentRecord(TypedDict)` — registry.json 中的 agent 条目
  - `SessionContext(dataclass)` — get_context 的输出结构
- [ ] **`common/tasks.py`** — 提取任务数据访问层：
  - `load_task(dir) -> TaskInfo | None`
  - `iter_active_tasks(tasks_dir) -> Iterator[TaskInfo]` — 保持 `sorted()` 排序行为
  - `iter_tasks_by_status(tasks_dir, status) -> Iterator[TaskInfo]`
  - 替换 9 处任务迭代重复
- [ ] 逐步替换 `data.get("title")` 为类型化的属性访问
- [ ] **写回路径保持原始 dict**：修改 task.json 时直接操作原始 dict，不经过 dataclass 序列化，避免丢失未知字段

### Phase 3: 模块拆分 (P2)

拆分过大的模块，**保留原文件名作为兼容 shim**。

- [ ] **`task.py` 拆分**：
  - `task.py` — 保留为入口 shim（argparse + dispatch），实际逻辑迁移到：
  - `common/task_store.py` — task CRUD（create, archive, update status）
  - `common/task_context.py` — init-context, add-context, JSONL 管理
- [ ] **`git_context.py` 拆分**：
  - `git_context.py` — 保留为入口 + 公共 API shim
  - `common/session_context.py` — session context 生成（text/json/record 模式）
  - `common/packages_context.py` — packages 模式输出
- [ ] **`multi_agent/status.py` 拆分**：
  - `status.py` — 保留为入口 shim
  - `multi_agent/status_display.py` — 格式化输出
  - `multi_agent/status_monitor.py` — 进程检查、日志解析

### Phase 4: 清理和一致性 (P2)

- [ ] `phase.py` — 消除每次调用重复读取 JSON（改为传入已读取的 data dict）。注：当前无真实并发写入场景，选择 snapshot 语义
- [ ] `registry.py` — 同样消除重复读取
- [ ] `common/__init__.py` 和 `task.py` 的 Windows encoding 重复 — 统一为 `common/__init__.py` 一处
- [ ] `cli_adapter.py` 中 `detect_platform()` 的 3 个重复元组 — 提取为常量

## Acceptance Criteria

- [ ] `grep -r "_read_json_file" .trellis/scripts/` 只有 `common/io.py` 一处定义
- [ ] `grep -r "class Colors" .trellis/scripts/` 只有 `common/log.py` 一处定义
- [ ] `grep -r "sys.path.insert" .trellis/scripts/` 返回 0 结果
- [ ] **Golden test**：重构前后对比 `task.py list`、`get_context.py`、`add_session.py --help` 的 stdout/stderr/exit code
- [ ] **Round-trip test**：读取 → 修改已知字段 → 写回 task.json，未知字段不丢失
- [ ] **排序一致性**：`iter_active_tasks()` 使用 `sorted()` 与原有行为一致
- [ ] `packages/cli/src/templates/trellis/scripts/` 同步更新
- [ ] pyright/mypy 无新增类型错误
- [ ] 所有 .md 模板中的 `python3 .trellis/scripts/task.py` 等路径无需修改

## Technical Notes

- 遵循 `.claude/skills/python-design/SKILL.md` 中的设计原则
- 每个 Phase 可独立提交
- Phase 1 是后续所有 Phase 的前置条件
- Phase 2 和 Phase 3 可并行（但建议 Phase 2 先做，因为类型定义会指导拆分边界）
- `phase.py` 选择 snapshot 语义（单次读取），因为所有使用场景都是单进程 CLI
- TypedDict 仅作为读取路径的类型注解，写回路径保持原始 dict 操作

## Codex Cross-Review

**Date**: 2026-03-12
**Model**: gpt-5.3-codex
**Result**: 8 findings, 7 incorporated

| # | Level | Issue | Valid? | Action |
|---|-------|-------|--------|--------|
| 1 | CRITICAL | sys.path.insert 删除后直接调用会失败 | Yes | Phase 1 改为 bootstrap shim 方案 |
| 2 | CRITICAL | Phase 3 拆分断掉 .md 模板中的文件路径引用 | Yes | 原文件名保留为 compatibility shim |
| 3 | WARNING | "输出一致" 未定义 stdout/stderr/exit code | Yes | AC 加入 golden-test |
| 4 | WARNING | TypedDict 写回可能丢失未知字段 | Yes | 写回路径保持原始 dict |
| 5 | WARNING | phase.py 单读改变并发语义 | Partial | 注明 snapshot 语义，无真实并发 |
| 6 | WARNING | _run_git_command 重命名断导入 | Yes | 保留兼容别名 |
| 7 | WARNING | 模板同步无自动化 | Yes | 已有问题，加入 AC 建议 |
| 8 | NITPICK | 任务迭代排序可能改变 | Yes | 冻结 sorted() 行为 |
