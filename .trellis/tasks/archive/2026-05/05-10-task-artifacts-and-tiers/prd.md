# Task Artifact 与任务路由设计

## 背景

当前 Trellis task 目录以 `prd.md` 为核心，复杂任务的技术方案、执行步骤、调研结论经常混在 `prd.md` 或旧的 `info.md` 表述里。近期在 Vine 项目的 Codex 讨论里已经验证过更清晰的结构：`prd.md` 承载需求，`design.md` 承载技术设计，`implement.md` 承载实施清单，`research/` 承载依据材料。

同时，当前 Trellis 的 no-task 流程过于激进：只要用户提出实现或代码改动，AI 就会创建 task 并进入完整 Trellis 流程。实际用户反馈是：简单对话、小修、很明确的单点修改也被迫走完整流程，体验过重。这里的问题不是让 AI 单方面跳过 Trellis，也不是让 AI 单方面创建 task；而是让 AI 先判断任务大小，再向用户确认是否要为本回合创建 Trellis task。简单场景里，用户确认没有必要后，本回合才忽略 Trellis 流程；复杂场景里，AI 也必须先确认是否可以进入 Trellis 创建 task 流程，用户同意后才创建 task。

本任务先用新的 `prd.md` + `design.md` + `implement.md` 结构设计这件事本身，停在规划阶段，等人工 review 后再进入实现。

## 目标

设计一套新的 task artifact 与任务路由机制：

- 复杂任务默认使用 `prd.md` + `design.md` + `implement.md` 三个核心文件。
- 简单但用户仍希望记录的任务允许使用 lightweight task：只要求 `prd.md`，不因为缺少 `design.md` / `implement.md` 报错。
- 新 runtime、workflow、hook、sub-agent fallback 与模板不再把 `info.md` 作为 task context artifact。
- 简单对话、小任务、低风险 inline 修改先进入 task 必要性确认；用户确认不需要 task 后，本回合忽略 Trellis 流程。
- 复杂任务先确认是否可以进入 Trellis 创建 task 流程；用户同意后才走完整 Trellis 流程，并保留 `implement.jsonl`、`check.jsonl`、`research/`、sub-agent context 注入。
- 复杂任务创建后，可以继续使用现有 parent / child task 表达拆分关系；这不是 no-task 判断里的一个额外分类。

## 范围

本设计覆盖：

- `.trellis/tasks/<task>/` 目录结构与文件职责。
- no-task 状态下的任务大小判断与用户确认 gate。
- task 创建、artifact presence、`task.py start`、`continue` next-action resolution 之间的跨层数据契约。
- `workflow.md` phase 与 workflow-state breadcrumb 的调整方向。
- `start` / `continue` skills、slash commands、platform prompt 模板的同步要求。
- task 创建脚本、hook、sub-agent、agent template、trellis-meta 文档需要同步的影响面。
- 当前 Trellis repo 本地文件和 `packages/cli/src/templates/**` 模板之间的同步要求。
- hook-inject、pull-based prelude、Pi extension、OpenCode plugin 的 task artifact 读取顺序。

## 非目标

- 本轮不直接实现代码改动。
- 本轮不修改 `task.py`、hook、agent template 或 workflow。
- 本轮不改变 `task.json.status` 状态机。
- 本轮不设计完整 UI。
- 本轮不把所有历史 task 迁移到新结构。

## 用户需求

- AI 遇到简单任务或简单问答时，先向用户确认本回合是否有必要创建 task。
- 用户确认不需要 task 后，本回合忽略 Trellis 流程并直接处理。
- 如果用户认为需要记录为 task，即使事情较小，也应创建 task。
- AI 判断任务相对复杂、需要 task 时，也要向用户确认是否可以走 Trellis 创建 task 的流程。
- 用户确认可以后，复杂任务才创建 task 并走完整 Trellis 流程。
- 用户不确认创建 task 时，AI 不应单方面创建 task；复杂实现请求应停在解释、范围澄清或拆分建议，不进入大范围修改。
- 复杂任务的核心 planning artifact 是 `prd.md`、`design.md`、`implement.md`。
- `implement.md` 不替代 `implement.jsonl`；前者是实施计划，后者是 spec / research manifest。
- 简单 task 只有 `prd.md` 时不报错；`design.md` / `implement.md` 缺失只作为 next-action 判断信号。
- sub-agent fallback 文案必须显式要求读取 `prd.md`、`design.md if present`、`implement.md if present` 和对应 jsonl manifest，避免 hook failure 或 `--continue` resume 漏读新 artifact。
- 相关联的 hook、workflow、phase、sub-agent context 注入都要纳入设计，不做只改文案的半成品。

## 验收标准

- [ ] `design.md` 明确三类核心 artifact 的职责边界。
- [ ] `design.md` 明确任务路由规则：哪些请求可在用户确认后 inline，哪些请求需要先征得用户同意再创建 task。
- [ ] `design.md` 明确跨层数据关联：task 创建时保存什么，恢复时读取什么，开始实现前确认什么。
- [ ] `design.md` 明确 lightweight task 的 PRD-only 行为，以及缺少 `design.md` / `implement.md` 时不报错。
- [ ] `design.md` 明确 hook-inject、pull-based prelude、Pi extension、OpenCode plugin 的统一读取顺序。
- [ ] `design.md` 明确 AI 从哪些 workflow、skill、command、agent、trellis-meta 入口学习每个 artifact 的职责。
- [ ] `design.md` 明确 parent / child task 如何表达复杂任务拆分，并说明它不是 no-task 判断里的额外分类。
- [ ] `design.md` 明确 `start` / `continue` skills 与 slash command 模板需要同步更新。
- [ ] `design.md` 列出实现时必须同步修改的真实文件类型和路径。
- [ ] `implement.md` 给出可执行的落地 checklist。
- [ ] `implement.jsonl` 与 `check.jsonl` 指向相关 spec / research 文件，方便后续实现和 review。
- [ ] 本任务保持 `planning` 状态，不进入代码实现。

## 关联上下文

- Vine Codex 讨论结论：复杂 task 目录应使用 `prd.md`、`design.md`、`implement.md`，旧 `info.md` 表述不再作为新 runtime context 入口。
- 本仓库历史任务：`.trellis/tasks/archive/2026-03/03-07-learn-openspec-prd/prd.md` 已经讨论过 OpenSpec 风格 artifact 拆分，但当时采用的是 `tasks.md`，本轮改为用户指定的 `implement.md`。
- 当前 `workflow.md` no-task breadcrumb 仍写死“任何 implementation / code change 都创建 task”，这是本轮要解决的核心体验问题。
