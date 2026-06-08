# 实施计划

## 执行状态（2026-05-10）

- [x] 已实现 no-task triage + task-creation consent gate；简单 / 小任务不再默认创建 Trellis task，复杂任务也要先获得创建 task + planning 的许可。
- [x] 已落地 `prd.md` / `design.md` / `implement.md` artifact contract；`implement.jsonl` / `check.jsonl` 保持为 spec / research manifest，不替代 `implement.md`。
- [x] 已更新 `task.py create`：默认创建新的 `prd.md` 模板，不自动创建 `design.md` / `implement.md`；输出提示区分 lightweight PRD-only 与 complex 三 artifact。
- [x] 已同步 workflow、SessionStart、Codex UserPromptSubmit、OpenCode plugin、Pi extension、hook 注入、pull-based prelude、agent fallback、start / continue / brainstorm / before-dev / check skill 和 trellis-meta reference。
- [x] 已移除新 runtime / template / reference 对 `info.md` 的 task artifact 推荐；历史 archive / backup 不作为新 runtime contract。
- [x] SessionStart 注入已压缩为 compact context：当前实测 shared `additionalContext = 5,955 bytes`，Codex template `6,001 bytes`，Copilot template `5,578 bytes`，其中 `<trellis-workflow> ≈ 4,401 bytes`。
- [x] 已更新 regression / template tests 覆盖 task creation、artifact gates、Codex mode、SessionStart compact 注入、context fallback 和 template 同步。
- [x] `trellis-check` 发现并修复 Codex / Copilot 自有 SessionStart 模板仍使用 full `get_context.py`、guides inline 和 sub-agent notice 的漂移。
- [ ] docs-site 尚未更新；本轮只处理 CLI/runtime/template/spec/test。
- [ ] 尚未提交 git commit。

验证命令：

```bash
python3 -m py_compile .codex/hooks/inject-workflow-state.py .codex/hooks/session-start.py .claude/hooks/inject-workflow-state.py .claude/hooks/inject-subagent-context.py .claude/hooks/session-start.py .cursor/hooks/inject-workflow-state.py .cursor/hooks/inject-subagent-context.py .cursor/hooks/session-start.py .trellis/scripts/common/task_store.py .trellis/scripts/common/task_context.py .trellis/scripts/common/workflow_phase.py .trellis/scripts/task.py packages/cli/src/templates/shared-hooks/inject-workflow-state.py packages/cli/src/templates/shared-hooks/inject-subagent-context.py packages/cli/src/templates/shared-hooks/session-start.py packages/cli/src/templates/trellis/scripts/common/task_store.py packages/cli/src/templates/trellis/scripts/common/task_context.py packages/cli/src/templates/trellis/scripts/common/workflow_phase.py packages/cli/src/templates/trellis/scripts/task.py packages/cli/src/templates/codex/hooks/session-start.py packages/cli/src/templates/copilot/hooks/session-start.py
pnpm --filter @mindfoldhq/trellis test
pnpm --filter @mindfoldhq/trellis typecheck
pnpm --filter @mindfoldhq/trellis lint
git diff --check
```

## 阶段 0：Review gate

- [ ] 人工 review 本任务的 `prd.md`、`design.md`、`implement.md`。
- [ ] 确认文件命名使用 `implement.md`，不使用 `tasks.md`。
- [ ] 确认小任务 / 简单对话先询问用户本回合是否需要 task；用户确认不需要后才忽略 Trellis 流程。
- [ ] 确认复杂任务也先询问用户是否可以创建 Trellis task；用户确认后才进入完整流程。
- [ ] 确认 lightweight task 可以 PRD-only；缺少 `design.md` / `implement.md` 不报错。
- [ ] 确认新 runtime / hook / sub-agent fallback / workflow 不再读取或推荐 `info.md`。

## 阶段 1：更新 task artifact 模型

- [ ] 更新 `.trellis/workflow.md` 的 Task System 和 Phase 1 描述。
- [ ] 在 `.trellis/workflow.md` 的 `## Phase Index` 范围内、靠近 `### Phase 1: Plan` summary / completion criteria 的位置加短 artifact contract，确保 SessionStart 和 `/trellis:continue` 能读到。
- [ ] 更新 `[workflow-state:planning]` 和 `[workflow-state:planning-inline]`，加入短提醒：lightweight 可 PRD-only；complex 在 `task.py start` 前需要 `prd.md` + `design.md` + `implement.md`。
- [ ] 更新 `packages/cli/src/templates/trellis/workflow.md`。
- [ ] 更新 `task.py create` 的默认 `prd.md` 模板：PRD 只承载用户目标、范围、验收标准、非目标、需求约束和已知上下文，不放技术设计或执行 checklist。
- [ ] 更新 `task.py create` 的输出提示：默认已创建 `prd.md`；lightweight task 可 PRD-only；complex task 在 `task.py start` 前还要补 `design.md` + `implement.md`。
- [ ] `task.py create` 输出提示保持短：说明 lightweight PRD-only、complex 三 artifact、jsonl 是 manifest，并提示用 `/trellis:continue` / phase context 判断下一步。
- [ ] 不引入新的 persistent artifact metadata；继续通过 `task.json.status`、artifact presence 和当前对话判断 route。
- [ ] 不自动创建空的 `design.md` / `implement.md` 来满足检查；lightweight task 允许只有 `prd.md`。
- [ ] 找到并同步所有 PRD skeleton：`task.py create` 默认模板、`trellis-brainstorm`、start skill/prompt、parallel prompt、migration task generator 等，把技术设计和执行 checklist 从 PRD 模板里移出。
- [ ] 更新 `task.py validate` 或相关文案，确保缺少 `design.md` / `implement.md` 不成为全局错误。
- [ ] 更新 `trellis-brainstorm` Step 0：task creation 只在用户已确认或已有 active task 时执行；读取并更新 `task.py create` 生成的 `prd.md`，不覆盖已有内容。
- [ ] 更新 `trellis-brainstorm` PRD skeleton：只保留 Goal、Background / Known Context、Requirements、Acceptance Criteria、Non-goals、Constraints、Open Questions、Research References。
- [ ] 在 `trellis-brainstorm` 增加 `design.md` authoring template：Overview、Architecture / Module Boundaries、Data Flow / Control Flow、Contracts、Alternatives、Risks、Decision Notes。
- [ ] 在 `trellis-brainstorm` 增加 `implement.md` authoring template：Checklist、Files / Surfaces To Update、Validation、Rollback / Safety、Completion Notes。
- [ ] 更新 `trellis-brainstorm` research-first 输出：PRD 只引用 `research/*.md`，技术结论进入 `design.md`。
- [ ] 更新 `trellis-brainstorm` Step 7：复杂任务的方案、数据流、contract、ADR-lite、风险写入 `design.md`，PRD 只保留需求层摘要或链接。
- [ ] 更新 `trellis-brainstorm` Step 8：最终确认对象拆成 `prd.md` + `design.md` + `implement.md`；实施顺序、checklist、验证命令写入 `implement.md`。
- [ ] 更新 `trellis-brainstorm` 完成语义：复杂任务确认 planning artifact 后停在 planning，由 `continue` / workflow 决定何时 `task.py start`，不直接进入 implementation。
- [ ] 更新 `trellis-before-dev` / `trellis-check` skill，让 inline 主会话实现和检查前读取同一组 artifact。
- [ ] 更新 `trellis-start` skill 的 routing 说明，让 no-task 先做 triage；简单场景先问用户是否需要 task，复杂场景先问用户是否可以创建 Trellis task。
- [ ] 更新 `trellis-continue` skill：保持它作为 workflow navigator / next-action resolver，替用户告诉 AI 完整流程并让 AI 判断下一步；缺少 `design.md` / `implement.md` 时不报错，lightweight task 加载对应 step，complex / 不明确 task 回到 Phase 1 planning step，而不是只凭 `prd.md` + curated jsonl 就 `task.py start`。
- [ ] 更新本地 `.claude/commands/trellis/continue.md` 与 `.cursor/commands/trellis-continue.md`，保持与 `trellis-continue` skill 一致。
- [ ] 更新 `packages/cli/src/templates/common/commands/start.md` 与 `packages/cli/src/templates/common/commands/continue.md`。
- [ ] 更新 `packages/cli/src/templates/codex/skills/start/SKILL.md` 与 `packages/cli/src/templates/copilot/prompts/start.prompt.md`，移除旧的自动 task workflow 文案。

## 阶段 2：更新 context 注入

- [ ] 更新 Claude `inject-subagent-context.py`，implement/check context 加载 `design.md` 和 `implement.md`。
- [ ] 更新 OpenCode plugin 的 sub-agent context 注入逻辑。
- [ ] 更新 Codex / Gemini / Qoder / Copilot pull-based prelude，让 sub-agent 自行读取 `design.md if present` 和 `implement.md if present`。
- [ ] 更新 Pi extension context 读取逻辑。
- [ ] 更新本地 `.codex/agents/*`、`.claude/agents/*` 和模板平台 agent 文案。
- [ ] 确保 hook-inject、pull-based prelude、Pi extension、OpenCode plugin 使用同一顺序：jsonl entries -> `prd.md` -> `design.md if present` -> `implement.md if present`。
- [ ] 更新 sub-agent fallback 文案，避免 hook failure 或 `--continue` resume 时只读 `prd.md`。
- [ ] 更新 `.agents/skills/trellis-meta/references/local-architecture/task-system.md` 与 `context-injection.md`，作为 AI 理解 task artifact 职责的架构说明。
- [ ] 同步 bundled `trellis-meta` references，确保新项目安装后也能教 AI 正确文件职责。
- [ ] 移除 runtime / template / trellis-meta reference 里把 `info.md` 当 task context 的表述。

## 阶段 3：更新任务路由 / no-task workflow

- [ ] 修改 `[workflow-state:no_task]`，从“任何实现都建 task”改为 triage + task-creation consent gate。
- [ ] 更新 SessionStart `<task-status>`：no active task 不再提示直接 load brainstorm / create task，而是先 classify 并请求 task-creation consent。
- [ ] 更新 SessionStart planning 判断：PRD-only 不等于自动 READY；要根据 artifact presence 和当前上下文区分 lightweight ready-to-start 与 complex artifacts incomplete。
- [ ] 更新 SessionStart ready 语义：planning task 只进入 start review gate；用户确认进入实现后才运行 `task.py start`，只有 `status=in_progress` 后才进入 implementation / check flow。
- [ ] 将 SessionStart overview 标签从 `<workflow>` 改成 `<trellis-workflow>`，避免和通用 workflow 词混淆；per-turn `<workflow-state>` 保持不变。
- [ ] 将 SessionStart `<trellis-workflow>` 改为 compact summary：只注入从 `## Phase Index` 到第一个 `## Phase 1: Plan` 之前的短正文，并继续剥离 `[workflow-state:*]` blocks；artifact contract 必须落在该正文抽取范围内。
- [ ] 压缩 `## Phase Index` 本身：移除/迁移 verbose routing 表、DO NOT skip 表和长解释；保留 phase summary、task routing、artifact contract、summary routing、step-detail command。
- [ ] 同步 `workflow_phase.get_phase_index()` 语义：`--mode phase` 不带 `--step` 只返回 slim phase index；详细 walkthrough 只能通过 `--step <X.Y>` 按需获取。
- [ ] 保持 SessionStart 不内联 `prd.md`、`design.md`、`implement.md` 全文，只注入 artifact presence / next action；实际内容由 skills、continue、sub-agent context 或 prelude 读取。
- [ ] 为 SessionStart 增加 compact current-state 输出：不注入 full active task list、my task list、recent commits、paths，只注入 developer、git dirty summary、current task、active task count、journal、spec layers。
- [ ] 修改 `<guidelines>`：不再内联 `.trellis/spec/guides/index.md`，只列出 guides/spec index 路径和 context read order。
- [ ] 缩短 `<first-reply-notice>`，避免固定提示占用多余上下文。
- [ ] 更新 Codex `UserPromptSubmit` hook：保留带一行 mode 解释的 `<codex-mode>` + `<workflow-state>`；默认不注入 `<sub-agent-notice>`；no-task 时只注入短 `<trellis-bootstrap>` 指向 `$trellis-start`，不注入 SessionStart overview。
- [ ] 明确 Codex `UserPromptSubmit` status / mode matrix：no_task 共用；planning/in_progress 在 inline 模式读取 `*-inline` block，在 sub-agent 模式读取 plain block；completed 共用。
- [ ] 明确 Codex mode 语义：`inline` 表示主会话默认直接实现 / 检查；`sub-agent` 表示实现 / 检查默认派给 implement/check sub-agent，但主会话仍负责判断下一步、澄清、规划、spec update、提交和收尾。`<codex-mode>` 使用 `mode: one-line meaning` 自解释，详细说明放到 workflow-state、skills 和 agent definitions。
- [ ] 为 Codex `UserPromptSubmit` 添加 size check：active-task per-turn 注入控制在约 1 KiB；no-task 注入约 1 KiB 以内。
- [ ] 精简所有 `[workflow-state:*]` block：每个状态只保留当前状态、下一步、关键禁令和 artifact 读取顺序；长解释放到 phase step、skill、command、agent definition。
- [ ] 修改 `[workflow-state:planning]` / `[workflow-state:planning-inline]`，要求复杂 task 在 `task.py start` 前完成 `prd.md`、`design.md`、`implement.md`，并说明轻量 task 只需要 `prd.md`。
- [ ] 保持 hook 状态集合为 `no_task`、`planning` / `planning-inline`、`in_progress` / `in_progress-inline`、`completed`；不新增 lightweight / complex / epic status。
- [ ] 修改 `[workflow-state:in_progress]` / `[workflow-state:in_progress-inline]`，只补 artifact 读取顺序和 fallback 语义，保持现有 implement → check → update-spec → commit → finish-work 流程。
- [ ] 明确简单对话 / 小任务 / 复杂任务的判定条件和用户确认规则。
- [ ] 明确简单场景的确认问题只问“本回合是否需要创建 Trellis task”，不是询问是否继续执行实现。
- [ ] 明确复杂场景的确认问题是“是否可以创建 Trellis task 并进入 planning”，不是由 AI 判断复杂后直接创建。
- [ ] 明确用户拒绝复杂任务建 task 时，AI 不进行大范围 inline 实现，只做解释、范围澄清或拆分建议。
- [ ] 修改 `.trellis/spec/cli/backend/workflow-state-contract.md`，记录 no-task policy 改动和 invariant。
- [ ] 检查 session-start 文案，避免仍提示“任何 implementation 都建 task”。
- [ ] 检查 `start` / `continue` slash command、skill、prompt 文案，避免绕过 task-creation consent gate。
- [ ] 检查 bundled `trellis-meta` reference，避免旧文档继续把 `info.md` 当主设计文件。
- [ ] 检查 `get_context.py --mode phase` 输出，确认 phase step 与 breadcrumb required-once 不变量同步。

## 阶段 4：更新复杂任务拆分文档

- [ ] 文档化 parent / child task 用法。
- [ ] 明确 parent / child task 是复杂任务创建后的拆分结构，不是 no-task 判断里的额外分类。
- [ ] 确认 `task.py list` 的 children progress 能继续工作。
- [ ] 若需要新增 CLI helper，优先设计为薄命令调用现有 `add-subtask` / `remove-subtask`，不要重复维护层级逻辑。

## 阶段 5：测试与验证

- [ ] 添加或更新 regression tests：workflow-state parser / required-step invariant。
- [ ] 添加或更新 SessionStart size check / snapshot：改完后总注入量应保持在约 6 KiB 以内，不注入完整 Phase 1/2/3 walkthrough、full task list、guides 正文或 task artifact 正文。
- [ ] 添加或更新 task creation tests：新提示、lightweight PRD-only 约定、jsonl seed 不回退。
- [ ] 添加或更新 continue entry tests：PRD-only lightweight task 不报错；复杂或不明确任务缺 `design.md` / `implement.md` 时继续加载 planning step，不能直接 start。
- [ ] 添加或更新 context injection tests：implement/check agent 能看到 `prd.md`、`design.md if present`、`implement.md if present`，缺失 optional artifact 时跳过。
- [ ] 添加或更新 command / prompt generation tests：`start` 入口包含 consent gate；`continue` 入口保持 workflow navigator / next-action resolver 语义，并能按 artifact presence 获取正确 workflow step。
- [ ] 添加或更新 generated template tests：各平台 agent / hook 模板同步。
- [ ] 运行 `pnpm lint`。
- [ ] 运行 `pnpm typecheck`。
- [ ] 运行相关 CLI regression tests。

## 阶段 6：收尾

- [ ] 更新相关 `.trellis/spec/cli/backend/*`。
- [ ] 更新 docs-site，如用户可见 workflow 发生变化。
- [ ] 复查 `rg "info.md|tasks.md|design.md|implement.md"`，确认 runtime、模板、fallback 文案没有继续推荐旧 artifact。
- [ ] 复查 `git diff --check`。
- [ ] 提交前说明 commit plan。
