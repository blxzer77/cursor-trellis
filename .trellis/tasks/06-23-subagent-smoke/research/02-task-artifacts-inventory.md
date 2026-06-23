# 任务工件清单研究 (06-23) — 重写版

> 重写说明：原版基于子代理 cwd 错位看到的**空目录**下结论，断言"任务目录当前为空，无 task.json / prd.md" —— 这是错的。本版以**真实任务目录** `.trellis/tasks/06-23-subagent-smoke/`（位于 `d:\MyHarness\Trellis\` 子项目内）实际存在的 5 个工件为准重写。
>
> 重写日期：2026-06-23

## 现状（真实任务目录）

任务目录 `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\`（对应 git repo `d:\MyHarness\Trellis\`），实际包含 5 个工件 + 1 个 `research/` 子目录：

| 工件 | 大小 | 状态 | 作用 |
|---|---|---|---|
| `task.json` | 669B | ✅ 存在 | 任务元数据（标题、status=planning、创建时间、assignee 等） |
| `prd.md` | 2838B | ✅ 存在 | 需求文档（R1 真实代码改动 + R2/R3 subagent 派发验证清单 + 验收标准） |
| `implement.jsonl` | 254B | ⚠️ 仅 seed 行 | implement agent 上下文引用列表，目前只有 `_example` 注释行，无真实条目 |
| `check.jsonl` | 254B | ⚠️ 仅 seed 行 | check agent 上下文引用列表，同上 |
| `dispatch-prompts.md` | 8439B | ✅ 存在 | 派发提示词包（research/implement/check 三段 + 观察清单 + 已知坑） |
| `research/` | - | ✅ 存在 | 子目录，含 01/02/03 三个研究文件（02 即本文件，已重写） |

**未存在**：`design.md`、`implement.md`、`verify.md`（草稿版本） —— 均为 prd.md 里标注的"可选"或"验证阶段才产出"工件，缺失符合预期。

## 标准工件作用

### task.json

任务元数据文件，由 `task.py create` 自动生成。实际字段结构（与原版描述的 `task_id` / `phase` 字段不同，原版描述不准）：

```json
{
  "id": "subagent-smoke",
  "name": "subagent-smoke",
  "title": "Subagent dispatch smoke test",
  "status": "planning",
  "dev_type": null,
  "scope": null,
  "package": null,
  "priority": "P2",
  "creator": "blxzer77",
  "assignee": "blxzer77",
  "createdAt": "2026-06-23",
  "base_branch": "main",
  "subtasks": [],
  "children": [],
  "parent": null
}
```

用途：
- `get_context.py` / `task.py dashboard` 读取并返回任务状态
- `resolve_selected_task` 通过 `.trellis/.runtime/sessions/` 下的 context_key 指针间接引用任务目录路径

### prd.md

需求文档，本任务实际定义了：
- **R1** — 真实代码改动（新增 `Trellis/scripts/smoke_echo.py`，导出 `echo_msg(msg: str) -> str` 返回 `"[smoke] <msg>"` + CLI 入口）
- **R2** — Subagent 派发验证（research/implement/check 三角色）
- **R3** — Hook 上下文注入验证
- 验收标准 5 项
- Out of Scope 5 项

用途：
- **implement / check / finish agents** 自动注入（作为需求基线）
- 通过 `inject-subagent-context.py` 的 `get_implement_context` / `get_check_context` 自动拼到 subagent prompt

### implement.md / design.md

可选工件，本任务均未创建（Lite 任务允许 PRD-only）。`design.md` 用于复杂任务的技术设计，`implement.md` 用于执行计划。`inject-subagent-context.py` 在 `get_implement_context` / `get_check_context` 里会 `read_file_content` 并附加，文件不存在时静默跳过。

### implement.jsonl / check.jsonl

JSONL 格式的文件引用列表，由 `task.py create` 自动 seed 一行 `_example` 注释。每行格式：

```jsonl
{"file": "<path>", "reason": "<why>"}
{"file": "<dir>/", "type": "directory", "reason": "<why>"}
```

用途：
- **`subagent_dispatch.py` 的 `read_jsonl_entries`** 读取并注入实际文件内容到 agent prompt
- `type: "directory"` 会读取该目录下所有 `.md` 文件（最多 20 个）
- 仅含 seed 行（无 `file` 字段）时，`read_jsonl_entries` 会跳过并打 stderr WARN：`has no curated entries (only seed / empty) — sub-agent will receive only task artifacts`

**当前状态**：本任务的 `implement.jsonl` / `check.jsonl` 都仅含 seed 行，未 curate 真实 spec/research 条目。这意味着即便 hook 成功注入，implement/check subagent 也只会收到 `prd.md` + design.md（不存在）+ implement.md（不存在），收不到 spec 文件 —— 这是 smoke test 故意保留的极简配置（PRD 里 Out of Scope 已声明"不改动 Trellis CLI 源码"，所以无对应 spec 需要 curate）。

## 派发链路实际表现

按本次 research subagent 派发的观察：

1. **hook 未注入** —— 主会话 Task 工具 `subagent_type` enum 不接受 `trellis-research`（只暴露 `generalPurpose | explore | shell | best-of-n-runner`），退化派发 `generalPurpose` → `inject-subagent-context.py` 的 `subagent_type in AGENTS_ALL` 检查失败 → `sys.exit(0)` 跳过注入。
2. **子代理走 fallback** —— 从 prompt 首行 `Selected task: .trellis/tasks/06-23-subagent-smoke` 提取路径并自行 Read 工件。
3. **路径错位** —— 子代理继承 cwd = `d:\MyHarness`（workspace 根），按相对路径解析落到 workspace 级 `.trellis/`（已存在框架目录），而非 Trellis 子项目内的真实任务目录。子代理因此看到空目录，下错误结论（本文件原版即此错误的产物）。

详细根因见 `verify.md`「关键故障分析」。

## 工件文件生命周期（修正版）

原版描述的 `trellis start` / `trellis continue` / `trellis finish-work` 命令在本仓库的 `task.py` 里不存在 —— 本仓库实际命令是：

```
python ./.trellis/scripts/task.py create "<title>" --slug <name>
python ./.trellis/scripts/task.py select <name>
python ./.trellis/scripts/task.py start-execution <name> --approved   # planning → in_progress
python ./.trellis/scripts/task.py record-gate <task> --transition <t> --gate <g> --result PASS --reviewer cursor --evidence verify.md
python ./.trellis/scripts/task.py archive <name>                       # in_progress → completed (移到 archive/)
```

`design.md` / `implement.md` 在 planning 阶段手动创建（非命令产物）；`implement.jsonl` / `check.jsonl` 在 `task.py create` 时自动 seed，planning 阶段由 AI curate 真实条目；`verify.md` 在 check 阶段产出。

## 相关文件

- `.trellis/scripts/task.py` —— 任务 CLI 主入口
- `.trellis/scripts/common/task_store.py` —— `cmd_generate_dispatch_prompt`（**注意：本机部署版本不含此子命令**，落后于 `packages/cli/src/templates/` 源码）
- `.trellis/scripts/common/subagent_dispatch.py`（模板源码路径 `packages/cli/src/templates/trellis/scripts/common/`）—— `read_jsonl_entries` / `build_implement_prompt` / `build_check_prompt`
- `.cursor/hooks/inject-subagent-context.py` —— PreToolUse hook，调用 `subagent_dispatch.build_dispatch_prompt`
- `.cursor/agents/trellis-{implement,check,research}.md` —— 三个 subagent 的定义文件（含 `name:` frontmatter，理论上应被 Cursor Task 工具识别为自定义 subagent_type，但本环境未识别 —— 见 verify.md 故障 1）
