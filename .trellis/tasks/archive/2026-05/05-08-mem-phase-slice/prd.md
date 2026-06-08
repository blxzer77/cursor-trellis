# tl mem extract: --phase flag for brainstorm/implement slicing

## Goal

让 `tl mem` 能切出"讨论阶段"（brainstorm 到 implement 之前）的对话内容。讨论阶段含大量用户思考、AI 提议被否决的过程、决策权衡——这些都是高密度信号，但现在被埋在长 session 里没办法独立提取出来复用。

MVP scope：仅做"提取这一步"——能可靠地切出 phase boundary 之前的部分。复用 / 索引化 / 跨 session 模式提取等下游能力先不做。

## What I already know

- `tl mem extract <session-id>` 已存在（`commands/mem.ts:cmdExtract`），输出整段 cleaned dialogue
- `claudeExtractDialogue` 当前实现把 `tool_use` block 整段丢弃 —— phase 边界信号在 tool_use 里，所以**不能**在 cleaned turns 之后过滤；需要另起一遍 raw jsonl 扫描定位 boundary index/timestamp，再让 extract 截断
- Claude Code 的 sub-agent dispatch 信号：`message.content[].type === "tool_use"` + `name === "Agent"` + `input.subagent_type` 匹配 `trellis-implement` / `trellis-check`
- Inline 编辑信号：`tool_use.name in ("Edit","Write","MultiEdit")` + `file_path` 在源代码区
- Trellis 显式状态翻转信号：Bash `tool_use` 含 `task.py start` —— 这是"planning → in_progress"的硬信号
- Codex 在 `payload` 字段下有等价信号，但 MVP 不必同步覆盖
- 现有 flag 模式：`--grep`、`--json`、`--cwd`、`--platform` 等（mem.ts:cmdExtract）

## Assumptions

- MVP 用 Claude 优先；Codex / OpenCode 次轮跟进
- Session 含多个 brainstorm→implement 循环时，MVP 只切 **第一个** boundary 之前的内容（复杂多 cycle 拆分留给后续）
- 输出形态：扩展 `extract` 现有命令加 `--phase` flag（不新增 subcommand）

## Open Questions

- **[blocking]** Phase boundary 怎么定义？三选一（见下方）
- 多 cycle session 是切第一个 boundary 还是所有 brainstorm windows 拼在一起？
- 平台覆盖：Claude-only MVP 还是三平台同步？

## Requirements (evolving)

- 在 `tl mem extract <session>` 加 `--phase <brainstorm|implement|all>` flag，default `all`（保持现有行为）
- `--phase brainstorm`：从 session 开始到 phase boundary 之前的所有 cleaned turns
- `--phase implement`：从 phase boundary 到 session 末尾
- Boundary 检测：raw jsonl pass 找到第一个匹配信号事件的 timestamp / event index
- `--json` 输出附带 `boundary` 元信息（matched signal type + timestamp / turn index）
- 找不到 boundary 的 session：`--phase brainstorm` 返回整段（说明全是讨论或没用 Trellis 流程）；`--phase implement` 返回空 + warning

## Acceptance Criteria (evolving)

- [ ] `--phase brainstorm` / `implement` / `all` 三档语义生效
- [ ] Claude 平台 boundary 检测覆盖三种信号至少一种（最终方案待 boundary 决策）
- [ ] 多 cycle session 行为符合决策（first boundary or all windows）
- [ ] 找不到 boundary 时 `--phase brainstorm` 返回完整 session、不报错
- [ ] 找不到 boundary 时 `--phase implement` 返回空 + stderr 一行说明
- [ ] `--json` 输出含 `boundary: { type, at, turn_index }` 字段
- [ ] 单元测试覆盖：合成 jsonl fixture 含 / 不含 boundary 信号、含多 cycle、含 compaction
- [ ] `--phase` 与现有 `--grep` 组合可用（先 phase 切，再 grep 过滤 turns）

## Definition of Done

- 不动 `claudeExtractDialogue` 的清洗语义
- 新加一个 boundary detector（独立 pass / pure function）
- `pnpm test` / `lint` / `typecheck` 全绿
- 帮助文本（`cmdHelp`）补 `--phase` 行 + 1 个例子
- `commands-mem.md` spec 加 `--phase` 子节

## Out of Scope (explicit)

- 跨 session brainstorm pattern aggregation / 索引化 / "用户思维模式"提取
- Codex / OpenCode 的 boundary 检测（先记 known limitation）
- 多 cycle session 拆成 N 个 brainstorm window（MVP 只切第一个）
- 把 brainstorm 输出结构化成"问题 / 选项 / 决策 / rationale"（NLP 任务，留给下游）
- 反向提取"被否决的提议"（信号更弱，单独 task）

## Technical Notes

- 实现入口：`commands/mem.ts:cmdExtract` 接 `--phase`；新加 `detectPhaseBoundary(filePath, platform): { type, at, turnIndex } | null`
- Boundary detector 需要再扫一遍 jsonl（因为 `claudeExtractDialogue` 已经丢了 tool_use）
- 可优化：单 pass 同时跑 cleaning + boundary 检测，但 MVP 先两 pass 简单为主
- Codex / OpenCode boundary 检测：MVP `--phase brainstorm` on non-Claude platforms 退化成 "整段 dialogue + stderr warning"

## Decision (ADR-lite)

**Context**: `tl mem extract` 输出整段会话；brainstorm 阶段（讨论 / 决策 / 否决）信号无法独立提取出来复用。

**Decisions**:
1. **Boundary signal** = `task.py create` (start of window) → `task.py start` (end of window)。Bash tool_use 中正则匹配，兼容 `python` / `python3` / `py -3` / 无前缀 + 路径分隔符 `/` / `\` / `\\`。
2. **Multi-task session** = 所有 `[create, start)` windows 拼接输出，用 `--- task: <slug-or-label> ---` 分隔。
3. **Slug 提取**：`--slug <name>` arg 优先；无则从配对的 `start <task-dir>` path 解析；都没有用 `window-N`。
4. **配对策略**：按出现顺序，slug 匹配优先；slug 拿不到时按 nth-create ↔ nth-start 配对。
5. **Compaction**：brainstorm window 包含 `[compact summary]` 合成 turn 时保留。
6. **`--phase` scope**：MVP 仅扩展 `extract`；`context` / `search` 加 `--phase` 留 follow-up。
7. **平台**：Claude MVP；Codex / OpenCode 上 `--phase brainstorm` 退化为 "整段输出 + stderr warning"（提示用户该平台 boundary 检测未实现）。
8. **Fallback** when 找不到 create / start：见 PRD 上面"Fallback 行为"段。

**Consequences**:
- ✓ 切出 brainstorm 内容跟实际 task 生命周期对齐（ create → start 是硬信号）
- ✓ 多 task session 的所有 brainstorm 都能拿到
- × 不走 Trellis 流程的 session（e.g., `--skip-trellis` inline）查不到 boundary，降级返回整段 + warning
- × 仅 `extract` 命令支持，`search`/`context` 暂不支持 `--phase` 过滤

## Implementation Plan

PR1（本 task 全包，单 PR）：
- `commands/mem.ts` 加 `detectBrainstormWindows(filePath, platform): { task, start_at, end_at, turn_range }[]` —— 独立 raw jsonl pass
- 加 helper `parseTaskPyCommand(bashCmd: string): { action: "create"|"start", slug?: string, taskDir?: string } | null`
- `cmdExtract` 接 `--phase` flag；按 windows 切 dialogue turns（用 turn_range index）
- `cmdHelp` 补 `--phase` 行
- 测试：合成 jsonl fixture 6+ python invoker 变体 + 单 / 多 / 嵌套 cycle + 缺 create / 缺 start / compaction
- spec：`commands-mem.md` 新加 `--phase` 子节

---

## Boundary definition (decided)

Brainstorm window = `[task.py create, task.py start)` —— 用 Trellis 自己的状态翻转作硬信号，把"无关 chat"和"implement 部分"都裁掉。

### Signal source

扫 raw jsonl 找 `tool_use.name === "Bash"` 事件：

- **start of brainstorm**：`input.command` 匹配 `task.py create`（regex 见下）
- **end of brainstorm**：同 session 内**之后**第一个 `task.py start`

### Regex 兼容性（关键 — 不容错就漏检）

```
\b(?:python3?|py(?:\s+-3)?)?\s*\S*[/\\]?task\.py\s+(create|start)\b
```

需要覆盖：
- `python ./.trellis/scripts/task.py create "..."`
- `python3 ./.trellis/scripts/task.py create ...`
- `py -3 .trellis/scripts/task.py create ...`（Windows 启动器）
- `python3 .trellis\\scripts\\task.py start ...`（Windows 反斜杠 escape 后变 `\\\\`）
- `python3 .trellis\scripts\task.py start ...`（jsonl 单层 escape）
- `task.py create` 无 invoker 前缀（PATH + chmod +x 情况）
- 相对 / 绝对路径都覆盖

测试 fixture 必须含这 6 种变体。

### 多 task / 多 cycle session

一个 session 内可能有 N 对 `[create, start)`（本 session 就有 mem-since-cross-day → spec-audit-drift → spec-batch-e → mem-phase-slice 多个 task）。处理策略**待决策**（下一个 open question）。

### Fallback 行为

- 找到 create 但未找到 start：window = `[create, session_end)`（brainstorm 中断 / 没走完）
- 找到 start 但没 create：window = `[session_start, start)`（task 在更早 session 创建）
- 都找不到：`--phase brainstorm` 返回整段 + stderr warning；`--phase implement` 返回空 + stderr warning
- 找到 create 又找到 start，但 start 在 create 之前（罕见，可能多 task 交错）：单独处理，见 multi-cycle 决策
