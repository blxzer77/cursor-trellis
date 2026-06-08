# Task Artifact 与任务路由技术设计

## 1. 设计结论

本次设计解决两个问题：

1. Trellis 不应该在所有实现请求前自动创建 task。没有 active task 时，AI 先判断请求大小，再向用户确认是否创建 Trellis task。
2. 复杂任务的 planning artifact 从单一 PRD 扩展为 `prd.md`、`design.md`、`implement.md`；轻量任务仍允许只有 `prd.md`。

最终约定：

- 简单对话和小任务：只询问“本回合是否需要创建 Trellis task”。用户说不需要后，本回合跳过 Trellis 流程。
- 复杂任务：询问“是否可以创建 Trellis task 并进入 planning”。用户同意后才创建 task。
- 用户拒绝复杂任务建 task 时，AI 不进行大范围 inline 实现，只做解释、范围澄清或拆分建议。
- `task.py create` 仍默认创建 `prd.md`，但模板改成需求文档，不承载技术设计和执行 checklist。
- `design.md` / `implement.md` 是复杂任务的 planning gate，不是所有 task 的必备文件。
- `implement.md` 不替代 `implement.jsonl`。前者是实施计划，后者是 spec / research manifest。
- 新 runtime、hook、workflow、sub-agent fallback、trellis-meta reference 不再把 `info.md` 作为 task context 文件。
- 不引入新的 persistent artifact metadata。通过 `task.json.status`、artifact presence 和当前对话判断下一步。

## 2. Task Artifact 模型

### 2.1 目录形态

轻量 task 的合法结构：

```text
.trellis/tasks/<task>/
|-- task.json
`-- prd.md
```

复杂 task 的目标结构：

```text
.trellis/tasks/<task>/
|-- task.json
|-- prd.md
|-- design.md
|-- implement.md
|-- research/
|-- implement.jsonl
`-- check.jsonl
```

缺少 `design.md` / `implement.md` 不等于 task 损坏。它可能是合法 lightweight task，也可能是 complex task planning 未完成；具体由 workflow step、artifact presence 和当前对话判断。

### 2.2 文件职责

| 文件 | 负责内容 | 不负责内容 |
| --- | --- | --- |
| `prd.md` | 用户目标、需求、范围、验收标准、非目标、约束、已知上下文 | 技术架构、文件级实现计划、执行 checklist |
| `design.md` | 技术设计、模块边界、数据流、hook / agent / CLI contract、关键取舍、风险 | 用户 story、逐步实施 checklist |
| `implement.md` | 实施顺序、待改 surface、验证命令、回滚点、提交前检查 | 大段方案论证、外部调研原文 |
| `research/` | 外部资料、本地代码考证、历史会话摘要、官方文档依据 | 最终设计结论的唯一来源 |
| `implement.jsonl` | implement sub-agent 必读的 spec / research manifest | 将要修改的代码文件清单 |
| `check.jsonl` | check sub-agent 必读的质量规范 / research manifest | 技术设计正文 |

### 2.3 读取顺序

不同消费者读取的顺序必须一致，optional artifact 不存在时跳过：

```text
implement agent: implement.jsonl entries -> prd.md -> design.md if present -> implement.md if present
check agent: check.jsonl entries -> prd.md -> design.md if present -> implement.md if present
main-session planning or continue: task.json -> prd.md -> design.md if present -> implement.md if present
inline implementation: prd.md -> design.md if present -> implement.md if present -> relevant spec or research loaded by skills
```

这套顺序要在 hook-inject、pull-based prelude、Pi extension、OpenCode plugin、agent fallback 文案中保持一致。否则 hook failure、平台不支持 hook、或 `--continue` resume 后会漏读新 artifact。

## 3. Task 路由与生命周期

### 3.1 no-task consent gate

没有 active task 时，AI 先分类，再询问是否创建 Trellis task。确认问题只关于 task creation，不是询问是否继续执行实现。

| 类型 | 判定条件 | 用户确认 | 用户拒绝时 |
| --- | --- | --- | --- |
| 简单对话 | 解释、状态、概念、命令输出、少量只读 repo 查询 | “本回合是否需要创建 Trellis task？” | 跳过 Trellis，直接回答 |
| 小任务 | 目标明确、低风险、通常 1-2 个文件、不涉及 workflow / hook / agent / template / schema / release / security | “本回合是否需要创建 Trellis task？” | 跳过 Trellis，inline 修改并验证 |
| 复杂任务 | 多模块、多层、架构、workflow、hook、agent、平台模板、migration、安全、发布、需要 durable review 或 research | “是否可以创建 Trellis task 并进入 planning？” | 不做大范围 inline 实现，只做解释、澄清或拆分建议 |

如果分类本身不确定，只问一个最小澄清问题。不能因为“看起来是实现请求”就直接 `task.py create`。

### 3.2 planning 到 implementation

Task 一旦创建，就进入 `planning`。Phase 1 只处理已经存在的 task，不再负责 no-task 场景的请求分类。

```text
No active task:
- classify request size
- simple conversation or small task: ask whether this turn should create a Trellis task
- complex task: ask whether task creation and planning are allowed
- if the user agrees: task.py create -> task.json(status=planning)

Planning task:
- requirements -> prd.md
- lightweight task: prd.md can be enough
- complex task: technical design -> design.md
- complex task: implementation plan -> implement.md
- sub-agent platforms: curate implement.jsonl and check.jsonl when needed
- human review gate for complex task
- user confirms implementation should start
- task.py start -> task.json(status=in_progress)
```

`status=in_progress` 之前不执行实现、不派发 implement/check agent。复杂设计任务应停在 `planning` 等待 review。

### 3.3 复杂任务拆分

parent / child task 是复杂任务创建后的拆分结构，不是 no-task 分类里的额外类型。父任务承载 umbrella `prd.md` / `design.md` / `implement.md`，子任务是可实现单元；workflow status 仍沿用 `planning`、`in_progress`、`completed`。

现有 `task.py list` 的 children progress 可以继续使用，不需要新增层级 status。

## 4. Workflow 与 Hook 注入

### 4.1 Workflow phase 边界

用户可见 workflow phase 保持三段：

```text
Phase 1: Plan
Phase 2: Execute
Phase 3: Finish
```

`no_task` 是 Phase 1 之前的入口状态。`planning-inline` / `in_progress-inline` 是平台模式变体，不是新增 phase。

`workflow.md` 的职责分两层：

- `## Phase Index` 到第一个 `## Phase 1: Plan` 之前：短摘要，供 SessionStart、`get_context.py --mode phase`、`/trellis:continue` 先判断下一步。
- `## Phase 1: Plan` / `## Phase 2: Execute` / `## Phase 3: Finish` 的 step detail：按需通过 `get_context.py --mode phase --step <X.Y>` 读取。

SessionStart 的 `<trellis-workflow>` 只注入 compact Phase Index，不注入完整 walkthrough，也不注入 `[workflow-state:*]` blocks。

```text
.trellis/workflow.md
  -> Body start: ## Phase Index
  -> Body end: before ## Phase 1: Plan
  -> Strip: [workflow-state:*] blocks
  -> Keep: compact phase summary, task routing, artifact contract, skill routing, step-detail loading instruction
  -> Inject into: <trellis-workflow>...</trellis-workflow>
```

### 4.2 workflow-state block 选择

Hook 仍只根据 active task、`task.json.status`、平台 inline mode 选择一个 workflow-state block。lightweight / complex 是 planning 路径判断，不是 runtime status。

`workflow-state:*` 是每回合 guardrail，不是完整操作手册。它只保留当前状态、下一步、关键禁令和 artifact 读取顺序；详细解释放到 Phase step、skill、command、agent definition。

| Hook state | 选择条件 | 注入重点 |
| --- | --- | --- |
| `[workflow-state:no_task]` | 没有 active task | classify + task-creation consent |
| `[workflow-state:planning]` | active task status 是 `planning`，sub-agent dispatch mode | brainstorm、三 artifact gate、jsonl manifest |
| `[workflow-state:planning-inline]` | active task status 是 `planning`，inline dispatch mode | brainstorm、三 artifact gate、跳过 jsonl manifest |
| `[workflow-state:in_progress]` | active task status 是 `in_progress`，sub-agent dispatch mode | implement/check flow、artifact read order |
| `[workflow-state:in_progress-inline]` | active task status 是 `in_progress`，inline dispatch mode | before-dev/check flow、artifact read order |
| `[workflow-state:completed]` | active task status 是 `completed` | finish-work |

目标正文如下。实际 active-task hook 只追加必要动态头部，不注入 `Source: session:...`。

```text
Task: <task-name> (<task.json.status>)
```

`[workflow-state:no_task]`：

```text
No active task. Classify this turn before creating any Trellis task.
Simple conversation / small task: ask only whether this turn should create a Trellis task. If no, skip Trellis for this session.
Complex task: ask whether you may create a Trellis task and enter planning. If no, explain, clarify scope, or suggest a smaller split.
```

`[workflow-state:planning]`：

```text
Load `trellis-brainstorm`; stay in planning.
Lightweight: `prd.md` can be enough. Complex: finish `prd.md`, `design.md`, and `implement.md`; ask for review before `task.py start`.
Sub-agent mode: curate `implement.jsonl` and `check.jsonl` as spec/research manifests before start.
```

`[workflow-state:planning-inline]`：

```text
Load `trellis-brainstorm`; stay in planning.
Lightweight: `prd.md` can be enough. Complex: finish `prd.md`, `design.md`, and `implement.md`; ask for review before `task.py start`.
Inline mode: skip jsonl curation; Phase 2 reads artifacts/specs via `trellis-before-dev`.
```

`[workflow-state:in_progress]`：

```text
Flow: `trellis-implement` -> `trellis-check` -> `trellis-update-spec` -> commit -> `/trellis:finish-work`.
Main session dispatches implement/check sub-agents by default. If you are already a Trellis sub-agent, execute your assigned role directly.
Read context: jsonl entries -> `prd.md` -> `design.md if present` -> `implement.md if present`.
```

`[workflow-state:in_progress-inline]`：

```text
Flow: `trellis-before-dev` -> edit -> `trellis-check` -> validation -> `trellis-update-spec` -> commit -> `/trellis:finish-work`.
Do not dispatch implement/check sub-agents in inline mode.
Read context: `prd.md` -> `design.md if present` -> `implement.md if present`, plus relevant spec/research loaded by skills.
```

`[workflow-state:completed]`：

```text
Code committed. Run `/trellis:finish-work`; if dirty, return to Phase 3.4 first.
```

### 4.3 SessionStart 注入

SessionStart 是 session 级 preamble。它不负责按当前 task status 注入 `[workflow-state:*]` 正文，也不内联 `prd.md`、`design.md`、`implement.md` 全文。

目标结构：

```text
<session-context>
Trellis compact SessionStart context. Use it to orient the session; load details on demand.
</session-context>

<first-reply-notice>
First visible reply: say once in Chinese that Trellis SessionStart context is loaded, then answer directly.
</first-reply-notice>

<current-state>
<compact session state: developer, git branch and dirty summary, current task, active task count, journal, spec layers>
</current-state>

<trellis-workflow>
<compact Phase Index summary with workflow-state blocks stripped>
</trellis-workflow>

<guidelines>
<path-only spec and guides index list, plus concise artifact/context read order>
</guidelines>

<task-status>
<computed active-task state, artifact presence, and next action>
</task-status>

<ready>
Context loaded. Follow <task-status>. Load workflow/spec/task details only when needed.
</ready>
```

当前 active task 的 compact 注入示例：

```text
<session-context>
Trellis compact SessionStart context. Use it to orient the session; load details on demand.
</session-context>

<first-reply-notice>
First visible reply: say once in Chinese that Trellis SessionStart context is loaded, then answer directly.
</first-reply-notice>

<current-state>
Developer: taosu
Git: branch feat/v0.6.0-beta; dirty 2 paths.
Current task: .trellis/tasks/05-10-task-artifacts-and-tiers; status=planning.
Active tasks: 23 total. Use `python3 ./.trellis/scripts/task.py list --mine` only if needed.
Journal: .trellis/workspace/taosu/journal-5.md, 684 / 2000 lines.
Spec layers: cli, docs-site.
</current-state>

<trellis-workflow>
# Development Workflow - Session Summary
Full guide: .trellis/workflow.md. Step detail: `python3 ./.trellis/scripts/get_context.py --mode phase --step <X.Y>`.

Phases: Phase 1 Plan -> Phase 2 Execute -> Phase 3 Finish.

No active task: classify first. Simple conversation / small task asks only whether this turn should create a Trellis task. Complex task asks whether Trellis task creation and planning are allowed.

Planning artifacts: lightweight task may be PRD-only. Complex task must have `prd.md`, `design.md`, and `implement.md` before `task.py start`.

Execution: status must be `in_progress` before implementation. Sub-agent platforms dispatch `trellis-implement` then `trellis-check`; inline platforms use `trellis-before-dev` then `trellis-check`. Finish path: `trellis-update-spec` -> commit -> `/trellis:finish-work`.
</trellis-workflow>

<guidelines>
Task context order for implementation/check: jsonl entries -> `prd.md` -> `design.md if present` -> `implement.md if present`. Missing optional artifacts are skipped for lightweight tasks.

Available indexes:
- .trellis/spec/cli/index.md
- .trellis/spec/docs-site/index.md
- .trellis/spec/guides/index.md
</guidelines>

<task-status>
Status: PLANNING
Task: Task artifact and task routing design
Present: prd.md, design.md, implement.md, implement.jsonl, check.jsonl
Next-Action: Continue planning review. Do not run `task.py start` or dispatch implementation until the user confirms this task should enter implementation.
</task-status>

<ready>
Context loaded. Follow <task-status>. Load workflow/spec/task details only when needed.
</ready>
```

体积目标：SessionStart 总注入量保持在约 6 KiB 以内，其中 `<trellis-workflow>` 约 4.4 KiB。旧逻辑约 31.41 KiB，主要来自完整 workflow walkthrough、full task list、recent commits、guides 正文和 task artifact 正文；新逻辑只保留 compact current state、compact Phase Index、artifact 读取顺序、spec index 路径和 task-status。

### 4.4 Codex UserPromptSubmit 注入

Codex 当前没有真实 SessionStart hook，`.codex/hooks.json` 只注册 `UserPromptSubmit`。Codex per-turn hook 只注入最小状态提醒：

- `<codex-mode>` 每回合都出现，值来自 `.trellis/config.yaml` 的 `codex.dispatch_mode`；缺失或非法时默认 `inline`。tag 内容同时包含一行 mode 解释。
- `<workflow-state>` 保持作为 per-turn 状态标签，不改名为 `<trellis-workflow>`。
- `<trellis-bootstrap>` 只在 Codex no-task 状态出现。
- 正常注入不带 `Source: session:...`。
- 默认不注入 `<sub-agent-notice>`；sub-agent 自我约束应写在 agent definition 或 spawn prompt 中。

Codex mode 的语义：

| Mode | 含义 | planning 差异 | in_progress 差异 |
| --- | --- | --- | --- |
| `inline` | 主会话自己实现和检查，不派发 `trellis-implement` / `trellis-check` sub-agent | 使用 `[workflow-state:planning-inline]`；跳过 jsonl curation，因为 Phase 2 会用 `trellis-before-dev` 读取 artifact / spec | 使用 `[workflow-state:in_progress-inline]`；主会话按 before-dev -> edit -> check 执行 |
| `sub-agent` | 主会话仍负责判断下一步、澄清、规划、spec update、提交和收尾；实现 / 检查默认派给 `trellis-implement` / `trellis-check` sub-agent | 使用 `[workflow-state:planning]`；start 前 curate `implement.jsonl` / `check.jsonl` 作为 sub-agent manifest | 使用 `[workflow-state:in_progress]`；默认 dispatch implement/check，dispatch prompt 带 active task fallback |

`<codex-mode>` 内容使用 `mode: one-line meaning`，给 Codex 自解释当前执行模式。更长的 mode 背景说明放在 `trellis-start` / `trellis-before-dev` / agent definition，不放进每回合 hook。

通用结构：

```text
<trellis-bootstrap>
If you have not already loaded Trellis context this session, read the `trellis-start` skill once.
</trellis-bootstrap>

<codex-mode>inline: the main session implements/checks directly; do not dispatch implement/check sub-agents.</codex-mode>

<workflow-state>
...
</workflow-state>
```

状态选择矩阵：

| Trellis state | `codex.dispatch_mode=inline` | `codex.dispatch_mode=sub-agent` | 额外 block |
| --- | --- | --- | --- |
| no active task | `[workflow-state:no_task]` | `[workflow-state:no_task]` | `<trellis-bootstrap>`, `<codex-mode>` |
| `planning` | `[workflow-state:planning-inline]` | `[workflow-state:planning]` | `<codex-mode>` |
| `in_progress` | `[workflow-state:in_progress-inline]` | `[workflow-state:in_progress]` | `<codex-mode>` |
| `completed` | `[workflow-state:completed]` | `[workflow-state:completed]` | `<codex-mode>` |

Codex no-task 状态的目标注入：

```text
<trellis-bootstrap>
If you have not already loaded Trellis context this session, read the `trellis-start` skill once.
</trellis-bootstrap>

<codex-mode>inline: the main session implements/checks directly; do not dispatch implement/check sub-agents.</codex-mode>

<workflow-state>
Status: no_task
No active task. First classify the current turn and ask for task-creation consent before creating any Trellis task.
Simple conversation / small task: ask only whether this turn should create a Trellis task. If the user says no, skip Trellis for this session.
Complex task: Ask the user if you(codex) can create a Trellis task and enter the planning phase.
</workflow-state>
```

Codex active planning task 的 inline mode 目标注入：

```text
<codex-mode>inline: the main session implements/checks directly; do not dispatch implement/check sub-agents.</codex-mode>

<workflow-state>
Task: task-artifacts-and-tiers (planning)
Load `trellis-brainstorm`; stay in planning.
Lightweight: `prd.md` can be enough. Complex: finish `prd.md`, `design.md`, and `implement.md`; ask for review before `task.py start`.
Inline mode: skip jsonl curation; Phase 2 reads artifacts/specs via `trellis-before-dev`.
</workflow-state>
```

Codex active planning task 的 sub-agent mode 目标注入：

```text
<codex-mode>sub-agent: implement/check work defaults to Trellis sub-agents; the main session still coordinates, clarifies, updates specs, commits, and finishes.</codex-mode>

<workflow-state>
Task: task-artifacts-and-tiers (planning)
Load `trellis-brainstorm`; stay in planning.
Lightweight: `prd.md` can be enough. Complex: finish `prd.md`, `design.md`, and `implement.md`; ask for review before `task.py start`.
Sub-agent mode: curate `implement.jsonl` and `check.jsonl` as spec/research manifests before start.
</workflow-state>
```

Codex active in-progress task 的目标注入：

```text
<codex-mode>inline: the main session implements/checks directly; do not dispatch implement/check sub-agents.</codex-mode>

<workflow-state>
Task: <task-id> (in_progress)
Flow: `trellis-before-dev` -> edit -> `trellis-check` -> validation -> `trellis-update-spec` -> commit -> `/trellis:finish-work`.
Read context: `prd.md` -> `design.md if present` -> `implement.md if present`, plus relevant spec/research loaded by skills.
</workflow-state>
```

```text
<codex-mode>sub-agent: implement/check work defaults to Trellis sub-agents; the main session still coordinates, clarifies, updates specs, commits, and finishes.</codex-mode>

<workflow-state>
Task: <task-id> (in_progress)
Flow: `trellis-implement` -> `trellis-check` -> `trellis-update-spec` -> commit -> `/trellis:finish-work`.
Dispatch prompt starts with `Active task: <task path from task.py current>`.
Read context: jsonl entries -> `prd.md` -> `design.md if present` -> `implement.md if present`.
</workflow-state>
```

## 5. AI 入口与写作指导

### 5.1 语义中心与入口分工

文件职责需要进入 AI 实际会读到的入口，不能只写在本任务的 `design.md`。

| 入口 | 放什么 | 消费场景 |
| --- | --- | --- |
| `.trellis/workflow.md` | artifact contract、lightweight / complex planning gate、Phase 1 completion criteria | SessionStart、workflow-state、`get_context.py --mode phase`、`/trellis:continue` |
| `trellis-brainstorm` skill | `prd.md`、`design.md`、`implement.md` 的完整写作模板和流程 | 需求探索和复杂 planning |
| `task.py create` | 短输出提示和默认 `prd.md` 模板 | task 刚创建后 |
| `trellis-start` / start command | no-task consent gate | 用户显式开始 Trellis |
| `trellis-continue` / continue command | workflow navigator / next-action resolver | 用户恢复任务，不想手动记流程 |
| `trellis-before-dev` / `trellis-check` | inline 实现 / 检查前读取哪些 artifact | 主会话执行或无 sub-agent 平台 |
| `trellis-implement` / `trellis-check` agent definitions | fallback 读取顺序 | hook 不可用、agent pull、resume |
| `trellis-meta` references | 长期架构解释和定制说明 | AI 被要求理解或修改 Trellis 架构 |

Hooks、plugins、extensions 只实现读取顺序和缺失处理，不复制完整写作模板。

### 5.2 task.py create 与默认 PRD

`task.py create` 仍默认创建 `prd.md`。需要改的是模板和输出指引：

- 默认 PRD 只包含 Goal、Background / Known Context、Requirements、Acceptance Criteria、Non-goals、Constraints、Open Questions、Research References。
- 不在默认 PRD 中放 `Technical Approach`、`Decision`、`Implementation Plan`。
- 输出提示要说明 lightweight task 可以 PRD-only。
- 输出提示要说明 complex task 在 `task.py start` 前需要 `prd.md`、`design.md`、`implement.md`。
- 输出提示要说明 `implement.jsonl` / `check.jsonl` 是 manifest，不是 implementation plan。
- 不确定下一步时提示使用 `/trellis:continue` 或 phase context，而不是让 create 输出承载完整 workflow。

目标 PRD 结构：

```markdown
# <Task Title>

## Goal

<why and what>

## Background / Known Context

* <facts from user message>
* <facts discovered from repo or docs>

## Requirements

* ...

## Acceptance Criteria

* [ ] ...

## Non-goals

* ...

## Constraints

* ...

## Open Questions

* <only unresolved blocking or preference questions>

## Research References

* [`research/<topic>.md`](research/<topic>.md) - <one-line takeaway>
```

### 5.3 trellis-brainstorm

`trellis-brainstorm` 的职责从“把需求、技术方案、实施计划都收敛到 PRD”改成“帮助复杂任务完成 planning artifact 分流”。

改动点：

- no-task consent gate 不放在 brainstorm 里做；它由 `[workflow-state:no_task]`、`trellis-start`、start command / prompt 负责。
- Step 0 读取 `task.py create` 生成的 `prd.md`，不覆盖已有内容。
- 如果任务是 lightweight，可以停在 PRD-only planning，不创建空 `design.md` / `implement.md`。
- repo / docs / research 事实进入 `prd.md` 的 Known Context / Constraints，或写入 `research/*.md` 后在 PRD 引用。
- 技术方案、数据流、contract、ADR-lite、风险和替代方案进入 `design.md`。
- 实施顺序、文件 surface、验证命令、回滚点进入 `implement.md`。
- 复杂任务确认 planning artifact 后停在 `planning`，由 workflow / continue 决定是否进入 `task.py start`。

`design.md` 目标模板：

```markdown
# Technical Design

## Overview

<chosen technical approach and why>

## Architecture / Module Boundaries

<affected components and ownership boundaries>

## Data Flow / Control Flow

<how information moves through scripts, hooks, agents, commands, and templates>

## Contracts

<CLI flags, file formats, hook payloads, agent context contracts, API contracts>

## Alternatives Considered

<2-3 options and trade-offs>

## Risks / Edge Cases

<compatibility, migration, failure modes, rollback concerns>

## Decision Notes

<ADR-lite: context, decision, consequences>
```

`implement.md` 目标模板：

```markdown
# Implementation Plan

## Checklist

- [ ] <ordered implementation step>

## Files / Surfaces To Update

- `<path>` - <why>

## Validation

- [ ] <lint/typecheck/test/manual check>

## Rollback / Safety

- <how to back out or detect problems>

## Completion Notes

- <what to report or update before finish-work>
```

### 5.4 start 与 continue

`start` 是 no-task 状态最容易触发自动建 task 的入口，必须同步 consent gate：

- 有 active task：按 `continue` 规则判断恢复位置。
- 无 active task + 简单对话 / 小任务：先问“本回合是否需要创建 Trellis task”。
- 无 active task + 复杂任务：先问“是否可以创建 Trellis task 并进入 planning”。
- 用户同意后才运行 `task.py create`。

`continue` 是 workflow navigator / next-action resolver。它替用户把完整 Trellis 流程重新告诉 AI，让 AI 根据 current task、status、artifact presence、git state 和当前对话判断下一步；它不是 no-task 路由器，也不维护第二套完整 workflow。

`continue` 的判断规则：

- `status=planning` 且缺 `prd.md`：回到 requirements discovery / repair path。
- `status=planning` 且只有 `prd.md`：不报错；如果明确是 lightweight，可进入 start review；如果是 complex 或无法判断，留在 planning 补 artifact 或澄清。
- `status=planning` 且 complex artifact 完整：进入 review gate，用户确认后再 `task.py start`。
- 旧逻辑里 “`prd.md` + curated jsonl -> start” 不再足够，因为 complex task 不能绕过 `design.md` / `implement.md`。

## 6. Runtime 影响面

### 6.1 组件边界

| 组件 | 职责 | 本次变化 |
| --- | --- | --- |
| `.trellis/workflow.md` | phase、workflow-state、routing source of truth | 增加 artifact contract 和 consent gate；压缩 Phase Index |
| `task.py` / task store | task 创建、状态、active pointer、jsonl seed | 默认 PRD 模板和 create 输出更新；validate 允许 PRD-only |
| session context | SessionStart preamble | 改为 compact `<trellis-workflow>`、path-only guidelines、artifact presence next action |
| workflow-state hook | per-turn breadcrumb | no-task 改为 triage + consent；planning/in-progress 加 artifact contract |
| sub-agent context injection | implement/check context | 按统一顺序读取 `design.md if present` / `implement.md if present` |
| start / continue commands | 显式入口 | start 同步 consent gate；continue 保持 next-action resolver 语义 |
| skills / agents | AI 操作入口 | brainstorm 分流 artifact；before-dev/check/agents 同步读取顺序 |
| templates / configurators | 新项目生成和 update | common template、platform template、bundled trellis-meta 同步 |

### 6.2 需要同步的 surface

实现时不能只改 `.trellis/workflow.md`。至少要覆盖这些类别：

- 本地 `.trellis/scripts/**`：`task.py`、task context、session context、workflow phase 解析。
- 本地 `.agents/skills/**`：`trellis-start`、`trellis-continue`、`trellis-brainstorm`、`trellis-before-dev`、`trellis-check`、`trellis-meta`。
- 本地 agent / hook：Codex、Claude、Cursor 等平台的 workflow-state、session-start、sub-agent context、agent fallback 文案。
- CLI templates：`packages/cli/src/templates/trellis/**`、`common/commands/**`、shared hooks、platform agents、OpenCode plugin、Pi extension、Copilot prompt、bundled `trellis-meta` references。
- Tests：workflow-state invariant、SessionStart size/snapshot、task creation output、continue next-action、context injection、generated template regression。

详细执行清单放在本 task 的 `implement.md`，这里不复制所有文件列表，避免 design 文档变成 checklist。

### 6.3 兼容策略

- `prd.md` 继续 required，避免破坏旧任务和旧 hook。
- `design.md` 与 `implement.md` 在 complex task 中 required，在 lightweight task 中 optional。
- 不迁移历史 task。
- 历史 task 里存在的 `info.md` 不删除，但新 runtime 不再读取或推荐它。
- `tasks.md` 不作为新名字使用。历史 OpenSpec 语境中的 `tasks.md` 映射为本设计的 `implement.md`。
- Optional artifact 缺失时跳过，不抛错。

## 7. 验证标准

实现完成后需要满足这些不变量：

- no-task 状态不会自动创建 task；简单 / 小任务和复杂任务都先走 task-creation consent gate。
- 简单场景的确认问题只问是否创建 Trellis task，不问是否继续执行实现。
- 复杂场景的确认问题是是否可以创建 Trellis task 并进入 planning。
- lightweight task 可以只有 `prd.md`；`task.py validate`、continue、hook、agent fallback 都不把它当成损坏 task。
- complex task 在 `task.py start` 前有 `prd.md`、`design.md`、`implement.md`。
- SessionStart 不注入完整 workflow walkthrough、full task list、recent commits、guides 正文或 task artifact 正文，目标总体积约 6 KiB 以内。
- Codex UserPromptSubmit 默认只注入带一行 mode 解释的 `<codex-mode>` 和 `<workflow-state>`；no-task 时额外注入短 `<trellis-bootstrap>`。
- 正常 hook 输出不注入 `Source: session:...`。
- sub-agent fallback、hook-inject、pull-based prelude、Pi extension、OpenCode plugin 使用同一 artifact 读取顺序。
- runtime、templates、trellis-meta reference 不再把 `info.md` 当主设计文件。
