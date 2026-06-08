# 本地上下文调研

## 读取的本地材料

- `.trellis/workflow.md`
- `.trellis/spec/guides/index.md`
- `.trellis/spec/guides/cross-layer-thinking-guide.md`
- `.trellis/spec/guides/code-reuse-thinking-guide.md`
- `.trellis/spec/guides/cross-platform-thinking-guide.md`
- `.trellis/spec/cli/backend/platform-integration.md`
- `.trellis/spec/cli/backend/configurator-shared.md`
- `.trellis/scripts/common/task_store.py`
- `.trellis/scripts/task.py`
- `.codex/hooks/session-start.py`
- `.codex/hooks/inject-workflow-state.py`
- `.codex/agents/trellis-implement.toml`
- `.codex/agents/trellis-check.toml`
- `.claude/hooks/inject-subagent-context.py`
- `.trellis/spec/cli/backend/workflow-state-contract.md`
- `.trellis/spec/cli/backend/script-conventions.md`
- `.agents/skills/trellis-meta/references/local-architecture/task-system.md`
- `.agents/skills/trellis-meta/references/local-architecture/context-injection.md`
- `.agents/skills/trellis-start/SKILL.md`
- `.agents/skills/trellis-continue/SKILL.md`
- `.claude/commands/trellis/continue.md`
- `.cursor/commands/trellis-continue.md`
- `packages/cli/src/templates/common/commands/start.md`
- `packages/cli/src/templates/common/commands/continue.md`
- `packages/cli/src/templates/codex/skills/start/SKILL.md`
- `packages/cli/src/templates/copilot/prompts/start.prompt.md`
- `.trellis/tasks/archive/2026-03/03-07-learn-openspec-prd/prd.md`

## 关键发现

### 当前 task create 行为

`task.py create` 当前需要重新确认实际 PRD 生成点。它至少创建：

```text
task.json
implement.jsonl
check.jsonl
```

如果检测到 sub-agent 平台，会 seed `implement.jsonl` 和 `check.jsonl`。目标设计里，create 默认也应生成 `prd.md`，但不生成 `design.md` / `implement.md`；lightweight task 可以 PRD-only，complex task 后续补齐两个 planning artifact。

创建后 stderr 当前只打印粗粒度 next steps：

```text
1. Create prd.md with requirements
2. Curate implement.jsonl / check.jsonl
3. Run task.py start
```

这条输出是需要改的，因为新模型里 lightweight task 可以 PRD-only，而 complex task 要在 start 前补齐 `design.md` / `implement.md`。输出不应承载完整 workflow，但应提醒 AI 不确定下一步时用 `/trellis:continue` 或 `get_context.py --mode phase`。

### PRD 模板形态

需要找到并统一所有 PRD skeleton。已知 PRD skeleton 分散在 skill / prompt / generator 里：

- `packages/cli/src/templates/common/skills/brainstorm.md`
- `packages/cli/src/templates/codex/skills/brainstorm/SKILL.md`
- `packages/cli/src/templates/copilot/prompts/brainstorm.prompt.md`
- `packages/cli/src/templates/codex/skills/start/SKILL.md`
- `packages/cli/src/templates/copilot/prompts/start.prompt.md`
- `packages/cli/src/templates/copilot/prompts/parallel.prompt.md`
- `packages/cli/src/commands/update.ts` 的 migration task PRD generator

所以“修改默认 PRD 模板”不是只改一个入口。`task.py create` 的默认 PRD 模板要改；这些 skill / prompt / generator 里的 PRD skeleton 也要同步，确保 PRD 不再承载技术设计或执行 checklist。

### 当前 brainstorm skill 的问题

`trellis-brainstorm` 当前把复杂任务的多个 artifact 混在 PRD 里：

- Step 0 让 AI 创建并 seed `prd.md`，模板包含 `Technical Notes`。
- Step 7 把 `Decision (ADR-lite)` 记录到 PRD。
- Step 8 的 final confirmation 包含 `Technical Approach` 和 `Implementation Plan (small PRs)`。
- PRD target structure 也包含 `Technical Approach`、`Decision (ADR-lite)`、`Technical Notes`。

新设计里这些需要拆分：

- PRD 只保留需求、范围、验收、非目标、约束、research references。
- 方案、ADR-lite、数据流、contract、风险进入 `design.md`。
- 实施顺序、小 PR 拆分、验证命令进入 `implement.md`。
- brainstorm 完成复杂 planning artifact 后不直接进入 implementation；下一步由 `continue` / workflow 判断。

### 当前 no-task breadcrumb

当前 `[workflow-state:no_task]` 明确写着：

```text
any implementation / code change / build / refactor work -> Create a task
```

这是“小事情也会强制走完整流程”的直接来源。

### 当前 context 注入

Claude hook 的 implement context 当前读取：

```text
implement.jsonl entries
prd.md
info.md
```

check context 当前读取：

```text
check.jsonl entries
prd.md
```

Codex agent prelude 当前要求读取：

```text
prd.md
info.md if exists
implement.jsonl / check.jsonl
```

因此改为 `design.md` + `implement.md` 时，hook push、agent pull、Pi extension、OpenCode plugin 四类路径都要同步。最终设计不保留 `info.md` 作为新 runtime context artifact；上面的 `info.md` 只描述当前旧实现。

统一读取顺序应是：

```text
implement: implement.jsonl entries -> prd.md -> design.md if present -> implement.md if present
check: check.jsonl entries -> prd.md -> design.md if present -> implement.md if present
```

缺少 `design.md` / `implement.md` 时 context 注入应跳过，不报错。是否需要补齐由 workflow step 和 `continue` 的 next-action resolution 共同表达，而不是由 hook 或 sub-agent 启动阶段直接失败。

### 历史 OpenSpec 任务

归档任务 `03-07-learn-openspec-prd` 已经提出过：

```text
prd.md
design.md
tasks.md
```

本轮设计沿用拆分思路，但按用户当前决策将 `tasks.md` 改为 `implement.md`，并额外加入任务路由机制。

### task 层级已有基础

`task.json` 已有：

```json
"children": [],
"parent": null
```

`task.py` 已有：

```text
create --parent
add-subtask
remove-subtask
```

`task.py list` 已经显示 children progress。因此 parent / child task 不需要从零设计数据结构，重点是 workflow 和文档约定。

### start / continue 入口仍是旧模型

`trellis-start` 和 `packages/cli/src/templates/common/commands/start.md` 当前在 no active task 时仍表达为：多步工作加载 brainstorm，然后创建 task；简单一次性问题或 trivial edits 可跳过。这不包含用户确认是否创建 Trellis task 的 consent gate。

`trellis-continue`、`.claude/commands/trellis/continue.md`、`.cursor/commands/trellis-continue.md` 和 `packages/cli/src/templates/common/commands/continue.md` 是 workflow navigator / next-action resolver。它们替用户告诉 AI 完整 Trellis 流程，让 AI 自行判断下一步，然后通过 `get_context.py --mode phase --step <X.X>` 获取下一步详情。当前下一步判断仍以 `prd.md` 和 `implement.jsonl` 为核心：

```text
status=planning + prd.md + curated implement.jsonl -> task.py start
```

在新 artifact 模型里，复杂 planning task 还必须检查 `design.md` 和 `implement.md`，否则 `/trellis:continue` 这个下一步导航入口可能选择 activation step，绕过技术设计与实施计划直接进入实现。它不应该成为第二套 workflow；它应该继续把完整流程放进上下文，让 AI 判断下一步，并把复杂或不明确的 planning task 指回 workflow 的 planning step。

### spec guide 对本设计的约束

`cross-layer-thinking-guide.md` 要求先画清数据流和边界。本任务的数据源不是单个文档，而是：

```text
User prompt -> no-task breadcrumb / start command -> task.py create -> task.json + artifacts -> continue next-action resolution -> task.py start -> sub-agent context injection
```

所以实现不能只改文案。必须定义 task 创建、artifact presence、`continue` next-action resolution、sub-agent context 注入之间的关系，否则 `/trellis:continue` 仍可能只看 `prd.md` 和 jsonl 就进入实现，绕过复杂任务需要的 `design.md` / `implement.md`。

`code-reuse-thinking-guide.md` 要求避免多处手写同一逻辑。对本任务的直接含义是：`trellis-continue`、slash command、start skill、workflow breadcrumb 的语义必须一致，但 `continue` 应尽量保持导航入口：读取完整 workflow，让 AI 判断下一步，再获取 step detail，不维护独立的完整 policy。

`cross-platform-thinking-guide.md` 和 `configurator-shared.md` 要求命令 / skill / prompt 修改走 common template 与 shared render helper。不能只改 `.claude/commands` 或 `.agents/skills` 的 dogfood 副本；fresh init 与 update collectTemplates 必须生成同样内容。

### artifact presence 最终路由

轻量 task 可以只保留 `prd.md`，这是合法状态，不应该报错，也不应该为了通过检查创建空的 `design.md` / `implement.md`。复杂 task 在 planning 阶段产出 `prd.md`、`design.md`、`implement.md`。

`continue` 遇到只有 `prd.md` 的 planning task 时：

- 当前 workflow / task context 明确是 lightweight task：加载 lightweight 对应 step。
- 当前 workflow / task context 明确是 complex task：加载 Phase 1 planning step，补 `design.md` / `implement.md`。
- 当前上下文无法判断：保持 planning，加载 workflow step，由 workflow 指导 AI 做最小澄清。

不能只因为 `prd.md` 和 jsonl 存在就直接进入实现，也不能把缺少 `design.md` / `implement.md` 当作全局错误。
