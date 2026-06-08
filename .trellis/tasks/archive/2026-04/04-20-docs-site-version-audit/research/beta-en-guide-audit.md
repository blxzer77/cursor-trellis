# Beta EN Guide 版本同步审计

**审计时间**：2026-04-20
**对标 CLI 版本**：0.5.0-beta.8
**审计范围**：`docs-site/guide/` (Beta track EN)
**审计文件数**：20

---

## 总体发现

- **需要更新的文件数**：20 / 20（全部）
- **最严重类别**：整个 EN guide 停留在 0.3.x / 0.4.x 的心智模型——"6 平台 + Claude Code 独占 + 13 slash commands + ralph-loop + dispatch/plan/implement/check/debug/research 6 agent"。**0.5.0-beta 的三大变化（skill-first、10 平台对称、trellis-* 重命名）完全没有体现**。
- **最严重的结构性问题**：
  1. **Agent 命名全部过期**：每个文件里 `implement` / `check` / `research` / `plan` / `dispatch` / `debug` 都还是旧名字；0.5.0-beta.5 已经把保留的三个统一改成 `trellis-implement` / `trellis-check` / `trellis-research`，并**删除**了 `dispatch` / `plan` / `debug` 三个 agent（0.5.0-beta.0 Legacy cleanup 部分）。
  2. **平台数量严重偏少**：文档最多列 7 个（Claude Code / Cursor / Codex / OpenCode / Kilo / Kiro / CodeBuddy），但真实模板目录有 **10 个**（claude / cursor / opencode / codex / kiro / gemini / qoder / codebuddy / copilot / droid），而且 `kilo` 并不在模板里（0.5.0-beta.0 删除 iflow，但 kilo 也已不在 `packages/cli/src/templates/` 下）。文档却还把 Kilo 当主力平台讲。
  3. **Command 大量被删除 / 被 skill 化**：`record-session` / `onboard` / `create-command` / `integrate-skill` / `parallel` / `check-cross-layer` **已移除或合并**（0.5.0-beta.0）；`before-dev` / `brainstorm` / `break-loop` / `check` / `update-spec` **已变为 skill**（不是 slash command 了），只剩 `start` + `finish-work` 是 command。文档里仍然把它们全当 command 写。
  4. **Ralph Loop 作为核心卖点**：appendix-e、ch04、ch11、ch13 都把 `ralph-loop.py` + SubagentStop + `.ralph-state.json` 当成核心能力；**0.5.0-beta.0 已删除 ralph-loop.py**，改由 check agent 自循环。
  5. **Multi-Agent Pipeline / worktree.yaml / `/parallel`**：**0.5.0-beta.0 整块移除**，但 ch04 / ch05 / ch08 / ch13 / appendix-a / appendix-b / appendix-e / appendix-f 都大量讲这套。
  6. **`.current-task` 文件名**：实际代码里目录下是 `.trellis/.current-task`（带点），跟文档一致——这个没问题。但 `current_phase` / `next_action` 字段文档还写，实际 0.5.0-beta.0 已从 `task.py create` 中**移除**。
- **相对稳定的文件**：没有一个真正"稳定"的文件。最接近稳定的是 **appendix-f (FAQ)** 里 Q5 / Q6 / Q7 / Q10 / Q12，这些是跟具体 agent/command 名无关的概念性 FAQ，但整体 appendix-f 还是有 ~60% 内容过期。

---

## 逐文件发现

### guide/ch01-what-is-trellis.mdx

- ❌ **需要重写**
- 具体问题：
  - L20 "Ralph Loop: think first, then act, then verify" → Ralph Loop **已删除**（0.5.0-beta.0）。
  - L21 "Plan Agent: rejects and splits oversized requirements" → Plan Agent **已删除**（0.5.0-beta.0 "dispatch / debug / plan agents (replaced by skill routing)"）。
  - L32 "Parallel development | Multi-Agent worktree parallelism" → Multi-Agent Pipeline **已整块移除**（0.5.0-beta.0）。
  - L33 "Ralph Loop automatic verification" → 同上，已删除。
  - L35 "Claude Code + Cursor + Codex + OpenCode + Kilo + Kiro" → 只列 6 个平台，实际 **10 个**（claude-code, cursor, opencode, codex, kiro, gemini, qoder, codebuddy, copilot, droid）；**kilo 已不再是官方支持平台**（不在 `packages/cli/src/templates/` 目录里）。
  - L44-45 "[Claude Code exclusive]" → Hook 和 Agent 系统在 0.5.0-beta.0 之后**扩展到 7+ 平台**（claude / cursor / opencode / kiro / codebuddy / droid 都有 class-1 hook；codex / copilot / gemini / qoder 走 class-2 pull-based prelude）。"Claude Code exclusive" 这个说法已彻底过期。
  - L49-52 `<Info>` 块 "Hook and Agent systems are Claude Code exclusive" → 整块信息过期。
- **建议改动量**：大（需要重新组织 1.3 表格、重写 1.4 核心概念部分对 Hook/Agent 的描述，加 Skill 概念）。

---

### guide/ch02-quick-start.mdx

- ❌ **需要重写**
- 具体问题：
  - L24-52 `<Tabs>` 块只列 **7 个平台**（Claude Code / Cursor / Codex / OpenCode / Kilo / Kiro / CodeBuddy），**缺 gemini / qoder / copilot / droid**，同时 **kilo 应该移除**（已不在官方平台列表）。
  - L60-68 平台配置表格，同样平台数量对不上，且 "Codex `$start`" / "Kiro `@start`" 这些 invocation 格式不对（真实 codex 走 `/trellis:start` 或 shell `trellis` CLI，Kiro 现在是 skill）。
  - L72-78 "Platform Capability Comparison" 表格整块信息过期：
    - "Sub-Agent spec injection" 栏 Cursor / Codex / OpenCode 写 ❌ → 实际 0.5.0-beta.0 起 **Cursor / OpenCode / Codex / CodeBuddy / Droid 都支持 class-1 或 class-2 spec injection**。
    - "Ralph Loop quality gate" 栏 → Ralph Loop 已删除，整行应移除。
    - "Multi-Agent Pipeline" 栏 → 已删除。
    - "Number of commands | 13 | 12 | 13" → 实际 0.5.0-beta.0 后只剩 **2-3 个 command**（start + finish-work + 可选 continue），其余都是 skill。
  - L85-191 七个 `<Tab>` block 全部包含 "record session" 步骤 → `/record-session` **已合并进 `/finish-work`**（0.5.0-beta.0 "record-session (subsumed by /finish-work)"）。
  - L104-113 Cursor tab "you manually run /trellis-check-backend" → 实际命令格式是 `/trellis:check`（加了 skill 以后是 auto-trigger，不再需要手动喊）。同时 `check-backend` / `check-frontend` 旧名字已合并成单个 `check` skill。
  - L156 Kilo tab "Kilo Orchestrator Mode" → Kilo 平台已从官方支持中移除。
  - L289-355 `.trellis/` 目录树：
    - L295 `.version` + L294 `workflow.md` 还对。
    - L296 `worktree.yaml` → **已删除**（Multi-Agent cleanup）。
    - L336 `task.py (14 subcommands)` → 0.5.0-beta.0 明确说 **16 subcommands**。
    - L350-355 `multi-agent/` 目录 → **整个子目录已删除**。
  - L357-386 `.claude/` 目录树：
    - L363-373 13 commands 列表 → 实际剩 2-3 个 command + 5 个 skill；而且 `parallel`, `record-session`, `onboard`, `check-cross-layer`, `create-command`, `integrate-skill`, `check-backend`, `check-frontend`, `before-backend-dev`, `before-frontend-dev` **都已删除或改名**。
    - L374-380 agents 列表 `dispatch / plan / implement / check / debug / research` → 只剩 `trellis-implement / trellis-check / trellis-research`，其余 3 个 agent 已删除。
    - L383 `ralph-loop.py` → **已删除**。
  - L395-404 `.kilocode/` 块 → kilo 已不再官方支持。
  - L406-411 `.codebuddy/` 目录树里 commands 也是旧列表。
  - **完全缺失**：Gemini / Qoder / Copilot / Droid 四个平台的 init 说明；`common/` skill-first 架构；Skill 文件布局（`{platform}/skills/trellis-*/SKILL.md`）。
- **建议改动量**：大（几乎整页重写）。

---

### guide/ch03-first-task.mdx

- ❌ **需要重写**
- 具体问题：
  - L9-35 `<Tabs>` 只列 4 个平台（Claude / Cursor / Codex / OpenCode）。
  - L42 "Invoke Research Agent" → 应改为 `trellis-research` sub-agent。
  - L52 "Invoke Implement Agent" → 应改为 `trellis-implement`。
  - L56 "Invoke Check Agent" → 应改为 `trellis-check`。
  - L60 "Ralph Loop ensures lint/typecheck passes" → **Ralph Loop 已删除**；检查循环现在是 check agent 自己内部的 loop，不是独立 hook。
  - L77-81 "`/record-session`" → **已合并进 `/finish-work`**。
  - L85-92 "Coming back the next day" 流程里依赖 `/start`，但 0.5.0-beta.0 说 "start command 对大部分平台已删除，被 session-start hook 替代"（见 changelog "10 safe-file-delete for the old start command"）；所以 `/start` 不再是正确的示例。
  - L96-97 `<Info>` "Cursor and Codex users need to manually trigger" → Cursor 现在也有 class-1 hook（0.5.0-beta.0）。
- **建议改动量**：中到大（概念仍然对，但每一步的 agent/command 名都要改）。

---

### guide/ch04-architecture.mdx

- ❌ **需要重写**
- 具体问题：
  - L15-18 顶部图 "Claude Code / Cursor / Codex / OpenCode / Kilo / Kiro" → 6 平台，应 10 平台，去 Kilo。
  - L26-30 图中 "`[Claude Code only]`" 和 `ralph-loop.py` → 两处都已过期。
  - L47 "Plan → Research → Implement → Check → Debug" → Plan / Debug agent 已删除。
  - L85-115 "`/start` 流程图" → `/start` 对大多数平台已被 session-start hook 取代，不再是必须/存在的 command。
  - L117 "session-start.py is a SessionStart Hook" → 还对，但现在 `shared-hooks/session-start.py` 是跨平台的单一实现。
  - L121-125 `<Info>` "Automatic spec injection is a Claude Code exclusive feature" → **彻底过期**。0.5.0-beta.0 详细分层描述了 class-1 hook (Claude / Cursor / OpenCode / Kiro / CodeBuddy / Droid) vs class-2 pull-based prelude (Codex / Copilot / Gemini / Qoder)。
  - L132 `Task(subagent_type="implement", prompt="...")` → 应为 `"trellis-implement"`。
  - L135-168 整个图描述 `inject-subagent-context.py` 行为基本对，但仍用旧 agent 名。
  - L153 "Update current_phase in task.json" → **已删除**，0.5.0-beta.0 "`update_current_phase()` function deleted; `task.py create` stops writing legacy `current_phase` / `next_action` fields"。
  - L175 JSONL 示例 field `reason` → 还在用，但 **0.5.0 已加入 `type: "directory"` 支持**（这点倒是文档里 L179 写了，OK）。
  - L190-196 "Three types of JSONL files | implement.jsonl | check.jsonl | debug.jsonl" → `debug.jsonl` 对应的 `debug` agent 已删除。
  - L209-214 injection timing 列表 里 `debug agent` / `research agent` → debug 不存在了；research 名字应为 `trellis-research`。
  - L212 "check Agent ([finish] marker): lightweight injection of finish-work.md" → 不确定这个 `[finish]` marker 机制在 0.5.0 是否还存在（需要交叉验证代码）。
  - L216-290 整个 4.4 Ralph Loop 章节 → **整块已废弃**。`ralph-loop.py`、`.ralph-state.json`、`worktree.yaml` verify 都已移除。
  - L292-340 整个 4.5 Agent System：
    - L294 "6 built-in Agents" → 实际只剩 3 个。
    - L298-303 表格里 dispatch / plan / debug 三行应删除。
    - L298 "model: opus" → 0.5.0-beta.5 **已从所有 agent frontmatter 中移除**（money bug fix）。
    - L307-331 "Multi-Agent Pipeline" 图 → 整块已不适用（Multi-Agent 模块已删除）。
    - L335-339 "Dispatch Agent Timeout Configuration" → Dispatch Agent 已不存在。
- **建议改动量**：大（4.1 图要重画、4.2 多平台流程要改写、4.3 部分保留但要更新、4.4 整块删除或改成 "Check Agent Self-Loop"、4.5 Agent 表格精简到 3 个）。

---

### guide/ch05-commands.mdx

- ❌ **整章需要重写为 "Commands & Skills Reference"**
- 具体问题：
  - L7 "Trellis provides 13 Slash commands (Claude Code)" → 实际 0.5.0-beta.0 只剩 **2-3 个 slash commands**（start + finish-work，加可选 continue.md），其余 5 个变成 skill。
  - L11-26 跨平台 command 参考表 → 整表过期：
    - L13 "before-backend-dev" / L14 "before-frontend-dev" → **已合并成 skill `trellis-before-dev`**。
    - L15-16 "check-backend" / "check-frontend" → **合并成 skill `trellis-check`**。
    - L17 "check-cross-layer" → **合并进 `check` skill**（0.5.0-beta.0 "check-cross-layer (merged into check)"）。
    - L20 "/parallel" → 已删除。
    - L21 "/record-session" → 合并进 `/finish-work`。
    - L22 "/brainstorm" → 已变成 skill。
    - L23 "/break-loop" → 已变成 skill。
    - L24 "/onboard" → 已删除（0.5.0-beta.0 "low usage"）。
    - L25 "/create-command" → 已删除（low usage）。
    - L26 "/integrate-skill" → 已删除（low usage）。
  - L52-92 "`/parallel` 多 Agent 并行编排" 整节 → **已删除**。
  - L94-112 "`/record-session`" 整节 → 已合并进 `finish-work` Step 3。
  - L114-121 "`/onboard`" 整节 → 已删除。
  - L125-148 "5.2 Development Preparation / 5.3 Quality Checks" 里 before-backend-dev / before-frontend-dev / check-backend / check-frontend → 均已合并成 skill。
  - L152-160 "`/check-cross-layer`" → 已合并进 check skill。
  - L162-166 "5.4 Parallel Development" → 已删除。
  - L202-211 "`/finish-work`" 保留，但应更新为 3-step（Quality Gate + Commit Reminder + Session Journal，对应 0.5.0-beta.0 changelog "Its single job ... is now Step 3 of /trellis:finish-work, which also covers Quality Gate and Commit Reminders"）。
  - L213-219 "`/create-command`" / "`/integrate-skill`" → 已删除。
  - **完全缺失**：`trellis-before-dev` / `trellis-brainstorm` / `trellis-check` / `trellis-break-loop` / `trellis-update-spec` 作为 **skill** 而非 command 的讲法；`session-start` / `inject-subagent-context` / `inject-workflow-state` 三个 shared-hooks 的角色。
- **建议改动量**：大（整章基本重写，并改名 "Commands & Skills"）。

---

### guide/ch06-task-management.mdx

- ⚠️ **中等过期**，概念仍对
- 具体问题：
  - L19 "task.py 14 Subcommands" → 0.5.0-beta.0 明确说 **16 subcommands**（grouping by lifecycle / context / metadata / hierarchy / PR）。
  - L91-93 "`task.py create-pr` (delegates to multi-agent/create-pr.py)" → multi-agent 目录已删除，create-pr 需确认是否还保留或改为走 CLI 自己的实现。
  - L97-127 task.json schema：
    - L114 `"current_phase": 1` → **已删除字段**（0.5.0-beta.0 "task.py create stops writing legacy current_phase"）。
    - L115-120 `"next_action": [...]` → 已删除字段。
  - L131-134 "Status transitions: planning → in_progress → review → completed / rejected" → 基本还对，但 Workflow 概念现在是 Phase 1 Plan / Phase 2 Execute / Phase 3 Finish（由 `.trellis/workflow.md` 驱动），跟 status 不完全对应。
  - L152-158 "backend type default check.jsonl (Claude Code platform)" 里引用 `finish-work.md` / `check-backend.md` 路径 → `check-backend.md` **已删除**（合并成 `check`）。
  - L178-220 "Plan Agent and Requirements Assessment" 整节 → **Plan Agent 已删除**。需求评估的角色现在由 `trellis-brainstorm` skill 承担（见 changelog "dispatch / debug / plan agents (replaced by skill routing)"）。
  - L222-309 "6.6 Task Lifecycle Hooks" + Linear 集成 → 内容看起来还对（这些 hook 在 `config.yaml` 里），没看到 changelog 说删。✅ 保留。
- **建议改动量**：中（6.2 subcommand 数量修正、6.3 schema 删字段、6.5 Plan Agent 整节重写成 brainstorm skill）。

---

### guide/ch07-writing-specs.mdx

- ✅ **基本还对**
- 具体问题：
  - L9-32 目录结构还对（frontend / backend / guides）。
  - L154 "Bootstrap Guided Initial Fill - 00-bootstrap-guidelines" → 需要验证该 bootstrap task 是否仍然在 init 时自动生成；大体上概念仍适用。
  - L175 "Hook auto-injects" → 在 0.5.0 下，对 10 平台里 class-1 平台还对，class-2 是 pull-based。可以保留但加一句 "depending on platform"。
- **建议改动量**：小（只有文风/语义微调）。

---

### guide/ch08-real-world.mdx

- ❌ **需要大改**
- 具体问题：
  - L12-57 八个 Tab 里全部使用 `/record-session` / `/trellis-record-session` → 已合并进 finish-work。
  - L45-47 "`/trellis-check-backend`" → 应改为 `/trellis:check` 或 auto-trigger。
  - L60-88 整节 "8.2 Complex Parallel Development (Multi-Agent Worktree)" → **已删除**。
  - L111-112 `/check-cross-layer` → 已合并进 check。
  - L119-120 `/trellis-before-backend-dev` + `/trellis-before-frontend-dev` → 已合并成 `trellis-before-dev` skill。
  - L128 `/trellis-check-cross-layer` → 已合并。
  - L180 `/break-loop` → 现在是 skill 而非 command。
- **建议改动量**：大（删 8.2，改所有 tab 里的 command 名）。

---

### guide/ch09-custom-commands.mdx

- ⚠️ **结构性过期**
- 具体问题：
  - L11-12 "Platform | Location" 表格只列 Claude Code + Cursor → 应扩展到 10 平台（或者讲 `common/` + 平台 adapter 模式）。
  - L16-28 "9.2 `/create-command`" → **`/create-command` 已删除**（0.5.0-beta.0）。整节应删除或改写成 "手写 command 文件"。
  - L71-101 例子还 OK，但示例路径只给了 `.claude/commands/`。
- **建议改动量**：中（删 9.2 小节，补全 10 平台路径）。

---

### guide/ch10-custom-agents.mdx

- ❌ **结构性过期**
- 具体问题：
  - L9 "Agent definition files are stored at `.claude/agents/{name}.md`" → 应说 10 个平台各有各的目录（`.claude/agents/`, `.cursor/agents/`, `.opencode/agents/`, 等）。
  - L17 `model: opus` → **必须删除**。0.5.0-beta.5 明确指出这是 money bug，所有 agent frontmatter 中的 `model: opus` 都被移除了。ch10 里所有示例（L17, L57, L62, L74）都在重复这个 bug。
  - L42-48 "Model selection 表格" → 建议删除（让 agent 继承用户的 platform session model）。
  - L51-63 "Modifying Existing Agents" 用 `name: check` 做例子 → 应改为 `name: trellis-check`。
  - L65-107 "Creating a New Agent" 例子 `name: test`，`model: opus` → 同样去掉 model 字段。
- **建议改动量**：中（主要是把 `model: opus` 从所有示例里移除，统一用 `trellis-*` 前缀）。

---

### guide/ch11-custom-hooks.mdx

- ❌ **需要重写**
- 具体问题：
  - L9-14 "Hook Types" 表 → 缺 `UserPromptSubmit`（0.5.0-beta.0 新引入的 per-turn breadcrumb）。
  - L17-60 `settings.json` 例子 → 缺 `UserPromptSubmit` 条目，并且 `SubagentStop` 匹配 `check` 里 `ralph-loop.py` **整块已废弃**。
  - L47-58 "`ralph-loop.py`" SubagentStop 条目 → 应删除。
  - L73-84 "session-start.py" 描述 → 基本还对，但现在是 `shared-hooks/session-start.py` 跨平台共用。
  - L86-102 "inject-subagent-context.py" 描述 → 基本对，但 L100 "Update current_phase in task.json" 已删除（0.5.0-beta.0 "update_current_phase() function deleted"）。
  - L104-112 "ralph-loop.py — Quality Loop" → **整节应删除**。
  - L115-144 "Writing Custom Hooks" → 概念还对。
  - L146-211 "Example: Adding an Auto-Test Hook" → 示例可保留。
  - **完全缺失**：`inject-workflow-state.py`（0.5.0-beta.0 per-turn breadcrumb hook，核心新增功能）；`shared-hooks/` 跨平台架构说明；class-1 (hook-based push) vs class-2 (pull-based prelude) 的分类。
- **建议改动量**：大（删 ralph-loop、加 inject-workflow-state + UserPromptSubmit、讲跨平台 shared-hooks 架构）。

---

### guide/ch12-custom-skills.mdx

- ⚠️ **部分过期**
- 具体问题：
  - L17 "Skill files are stored in the `.claude/skills/` or `.agents/skills/` directory" → 应扩展到 10 平台各自的 skills 目录（`.cursor/skills/`, `.opencode/skills/`, etc.），并且强调 0.5.0-beta.0 起 **common/skills/** 是 single source。
  - L44-52 "`/create-command`" → 已删除。
  - L58-64 "`/integrate-skill`" → 已删除。
  - **完全缺失**：Trellis 自带 5 个 skill（trellis-before-dev, trellis-brainstorm, trellis-break-loop, trellis-check, trellis-update-spec）的讨论——它们是 0.5.0 的核心概念。
- **建议改动量**：中（删 12.3 / 12.4，补 Trellis 5 个 auto-trigger skill 讲解）。

---

### guide/ch13-multi-platform.mdx

- ❌ **整章需要重写**
- 具体问题：
  - L9-23 "13.1 Claude Code Full Experience" → 整节依赖 `ralph-loop.py` / `/parallel` / 6 agents → 全部过期。应改写成 "Claude Code: class-1 hook 的参考实现"。
  - L16 表格里 `ralph-loop.py SubagentStop (check)` → 已删除。
  - L21 "Multi-Agent Pipeline — /parallel" → 已删除。
  - L22 "Ralph Loop — automatic quality gate" → 已删除。
  - L23 "Agent system — 6 specialized Agents (dispatch, plan, implement, check, debug, research)" → 现在只有 3 个 trellis-*。
  - L29-47 Cursor 表格里列 12 个 command → 应改为 "2 commands + 5 skills"。
  - L42-47 "Differences from Claude Code" 里 "No Hook support" → **错**：Cursor 是 class-1 平台，0.5.0-beta.0 起有 hook 支持。
  - L68-93 "13.3 Codex Integration" → 部分对，但强调 Codex 是 class-2（pull-based prelude）这个关键事实没有。
  - L84-90 `features.multi_agent = true` → `multi_agent` 键不确定仍需要；`codex_hooks = true` 需要（0.5.0-beta.0 "enable features.codex_hooks = true"）。
  - L95-160 "13.4 Kilo Code Integration" → **整节应删除**（kilo 不再在官方平台列表）。
  - L162-210 "13.5 Kiro Integration" → 基本还对，Kiro 仍支持；但 L176 "12 skills with YAML frontmatter" 列表过期（里面有已删除的 onboard / create-command / integrate-skill / record-session / check-cross-layer）。
  - L212-276 "13.5b CodeBuddy Integration" → 基本还对，但同样 command 列表过期。
  - L275 "No Agent system integration" → 0.5.0-beta.0 起 CodeBuddy 是 class-1 hook 平台，有 agent 支持。
  - L293 "Git worktree — Multi-Agent Pipeline relies on git worktree, supported on all platforms" → Multi-Agent 已移除。
  - L311-356 "13.8 Complete worktree.yaml Configuration" → **整节应删除**（worktree.yaml 已随 Multi-Agent 一起移除）。
  - L358-386 "13.9 `trellis update` and Version Management" → 基本还对，但缺 `--migrate` 标志（0.5.0-beta.0 "--migrate is now required for breaking releases"）。
  - **完全缺失**：Gemini / Qoder / Copilot / Droid 四个平台的讲解；class-1 vs class-2 架构分类说明；`--migrate` 新语义。
- **建议改动量**：大（至少删 13.4、删 13.8、加 4 新平台、重写 13.1 / 13.2 / 13.9）。

---

### guide/appendix-a.mdx

- ❌ **整表过期**
- 具体问题：
  - L13 "worktree.yaml" → 已删除。
  - L17-31 "Command Definitions" 13 个文件 → 真实只剩 start.md + finish-work.md（commands），其余 5 个是 skills；而且 parallel / record-session / onboard / create-command / integrate-skill / check-cross-layer **文件已不存在**。
  - L33-42 "Agent Definitions" 6 个 → 只剩 trellis-implement / trellis-check / trellis-research。
  - L44-50 "Hook Scripts" → `ralph-loop.py` 已删除；缺 `inject-workflow-state.py`；应注明 `.claude/hooks/` 下的 `shared-hooks/` 是共享源。
  - L52-67 "Cursor Command Definitions" 12 条 → 同样过期。
  - L71-79 "Codex / OpenCode Configuration" → `.agents/skills/*/SKILL.md (13 skills)` 不对；`.codex/skills/parallel/SKILL.md` 已删除。
  - L82-85 "Kilo Code Configuration" → Kilo 已移除。
  - L88-91 "Kiro Configuration" → "12 skills" 数字过期。
  - L95-106 "Script Tools" 里 `task.py (14 subcommands)` → 应为 16；`multi-agent/*` 整个子目录已删除。
- **建议改动量**：大（整表重做）。

---

### guide/appendix-b.mdx

- ❌ **整表过期**
- 具体问题：
  - L9-23 "Slash Commands" 大表整个跨 4 平台（5 列）→ 整表过期，13 行里至少 6 行对应的 command 已删除（parallel / record-session / onboard / check-cross-layer / create-command / integrate-skill），5 行已变成 skill（brainstorm / break-loop / before-dev / check / update-spec），只剩 start + finish-work 真正还是 command。
  - L25-29 `<Info>` 里 Kilo 说法 → Kilo 不再支持。
  - L31 "task.py Subcommands (14)" → 应为 16。
  - L52-67 "Python Scripts" multi-agent 块 → 整块已删除。
- **建议改动量**：大（整表重做）。

---

### guide/appendix-c.mdx

- ⚠️ **部分过期**
- 具体问题：
  - L24 `"current_phase": "number"` → **已删除字段**（0.5.0-beta.0 "task.py create stops writing legacy current_phase / next_action"）。
  - L25-30 `"next_action": [...]` → **已删除字段**。
  - L23 `"worktree_path": "string"` → 不确定是否保留。Multi-Agent pipeline 删除后，这个字段可能也删了（需要核对 `task.py create` 源码），但 task.py 里的 `set-worktree` subcommand 是否保留也要查。
  - 其他字段 id / name / title / status / dev_type / scope / priority / creator / assignee 仍适用。
- **建议改动量**：小（删 2-3 个字段）。

---

### guide/appendix-d.mdx

- ✅ **基本还对**
- 具体问题：
  - L10-28 JSONL 例子均使用 `implement.jsonl` → 概念仍对（虽然 sub-agent 改名成 trellis-implement，但 jsonl 文件名是否跟着改还要核实代码；根据 `shared-hooks/inject-subagent-context.py`，jsonl 文件名仍是 `implement.jsonl` / `check.jsonl`，和 subagent_type 不直接耦合，所以可能还对）。
  - L37 "Completion Marker Generation Rules" → 这个机制属于 Ralph Loop 的 fallback，Ralph Loop 已删除，但 completion marker 可能还在 check agent 自循环中使用（需要代码验证）。
- **建议改动量**：小（微调措辞，确认 marker 机制）。

---

### guide/appendix-e.mdx

- ❌ **整文件已过期**
- 具体问题：
  - 整个 appendix 描述 `worktree.yaml` 配置 → **worktree.yaml 文件本身已在 0.5.0-beta.0 删除**（随 Multi-Agent Pipeline 一起）。
  - L23-26 `verify: - pnpm lint ...` → Ralph Loop 已删除，verify 字段不再有消费者。
- **建议改动量**：大（整文件删除，或重写成 `.trellis/config.yaml` reference，那是当前还存在的配置文件）。

---

### guide/appendix-f.mdx

- ⚠️ **部分过期但概念 FAQ 尚可**
- 具体问题：
  - L7-14 "Q1: /start vs /parallel" → **`/parallel` 已删除**，整个 Q1 过期。
  - L16-19 "Q2: /check-cross-layer" → 已合并进 check。
  - L21-28 "Q3: break-loop" → break-loop 现在是 skill 而非 command，但回答概念仍对。
  - L30-38 "Q4: monitor multi-Agent parallel tasks" → multi-agent 整块已删除。
  - L40-48 "Q5: session history" → ✅ 还对。
  - L50-59 "Q6: spec detail" → ✅ 还对。
  - L61-64 "Q7: team conflicts" → ✅ 还对。
  - L66-74 "Q8: migrate existing project" → 基本对，但需要加 `--migrate` 标志。
  - L76-80 "Q9: Ralph Loop verification fails" → Ralph Loop 已删除，整个 Q9 过期。
  - L82-93 "Q10: trellis update" → 基本对，缺 `--migrate`。
  - L95-103 "Q11: Cursor users" → "Cursor doesn't support Hook" **错了**；Cursor 在 0.5.0-beta.0 已成为 class-1 hook 平台。
  - L105-118 "Q12: Windows users" → ✅ 还对。
  - L120-129 "Q13: switch Cursor → Claude Code" → 概念还对。
  - L131-141 "Q14: Kilo vs Claude Code" → Kilo 已移除，整个 Q14 删除。
  - L143-152 "Q15: Kiro Spec mode" → 概念还对。
  - L154-158 "Q16: Kilo Skills vs Trellis Skills" → Kilo 已移除，整个 Q16 删除。
  - L160-162 "Q17: OpenCode + Codex" → 概念还对，但 OpenCode 的 "session hook" 现在是跨平台 shared-hook，不再专属。
- **建议改动量**：中（删 Q1 / Q9 / Q14 / Q16、改 Q2 / Q4 / Q11、补 Q 讲 `--migrate` + 新平台）。

---

### guide/resources.mdx

- ✅ **基本还对**
- 具体问题：无重大过期；链接和致谢部分没有版本依赖内容。
- **建议改动量**：零或极小（可选加新贡献者）。

---

## 优先级建议

### 高优先级（影响用户第一印象 + 首次上手）

1. **ch01-what-is-trellis.mdx** — 第一章就把 Ralph Loop / Plan Agent / Multi-Agent / 6 平台这些**已删除概念**当核心卖点讲，严重误导新用户。
2. **ch02-quick-start.mdx** — 用户按章节二的命令跑会遇到：`/record-session` 不存在、`/trellis-check-backend` 不存在、`.kilocode/` 配不出来、Gemini / Qoder / Copilot / Droid 用户找不到自己的 init 命令。
3. **ch04-architecture.mdx** — 架构图和 Agent 系统讲解跟实际代码完全脱节（ralph-loop / dispatch / plan / debug 均不存在）。
4. **ch05-commands.mdx** — 13 个 slash commands 里实际只有 2 个仍是 command；用户按此索引会发现大部分命令不存在。
5. **ch13-multi-platform.mdx** — 整章讲平台集成，但 Kilo 已废弃、worktree.yaml 已删除、"Cursor 无 hook" 已失实。

### 中优先级（用户深入使用时会踩坑）

6. **appendix-a.mdx** — 快速索引表大面积失效。
7. **appendix-b.mdx** — 命令速查大表失效。
8. **ch03-first-task.mdx** — 首个 task 流程里 agent 名和 record-session 过期。
9. **ch08-real-world.mdx** — 真实场景 demo 里 8.2 Multi-Agent 整节应删除；每个 Tab 里的命令名要改。
10. **ch11-custom-hooks.mdx** — Ralph Loop 整节过期，且缺 `inject-workflow-state` 讲解。
11. **ch10-custom-agents.mdx** — 所有示例都在重复 0.5.0-beta.5 修掉的 `model: opus` money bug，有反教学风险。
12. **appendix-f.mdx** — Q1 / Q9 / Q14 / Q16 整题应删；Q11 有事实错误。

### 低优先级（内容基本还对或改动量小）

13. **ch06-task-management.mdx** — 主要 subcommand 计数和 schema 字段过期，概念架构仍对。
14. **appendix-c.mdx** — 只需删 `current_phase` / `next_action`。
15. **ch07-writing-specs.mdx** — 基本还对，只需加 "class-1/class-2 injection" 小注脚。
16. **ch09-custom-commands.mdx** — 删 `/create-command` 小节、补 10 平台路径即可。
17. **ch12-custom-skills.mdx** — 删 `/create-command` / `/integrate-skill` 小节，加 Trellis 自带 5 skill 介绍。
18. **appendix-d.mdx** — 基本还对，微调。

### 几乎不需要动 / 已删除

19. **appendix-e.mdx** — **整文件应删除**（worktree.yaml 不存在了）；或重写为 `.trellis/config.yaml` reference。
20. **resources.mdx** — ✅ 保留不动。

---

## 工作量估算

| 改动量 | 文件数 | 文件 |
|---|---|---|
| **小改（1-5 行）** | 2 | resources.mdx, appendix-d.mdx |
| **中改（5-30 行）** | 5 | ch06, ch07, ch09, ch10, appendix-c.mdx |
| **大改（30-100 行）** | 5 | ch03, ch08, ch11, ch12, appendix-f.mdx |
| **重写 / 整章改（>100 行）** | 7 | ch01, ch02, ch04, ch05, ch13, appendix-a.mdx, appendix-b.mdx |
| **删除或整文件重写** | 1 | appendix-e.mdx |

**总体工作量**：相当于**接近全书重写**（20 个文件里至少 13 个需要大改以上）。EN guide 停留在 0.3.x 末期 / 0.4.x 早期的心智模型，没有经过 0.5.0-beta.0 的架构剧变（skill-first / 10 平台 / Ralph Loop 删除 / Multi-Agent 删除）和 0.5.0-beta.5 的 agent 重命名。

一个可行的分阶段策略：

1. **第一阶段**（紧急修正 - 约 2-3 天）：更新 ch01 / ch02 / ch04 / ch05 / ch13 和 appendix-a / appendix-b，修掉"用户第一次打开就会迷惑"的问题。
2. **第二阶段**（架构对齐 - 约 2 天）：重写 ch11（加 `inject-workflow-state` + shared-hooks 架构）+ ch10（去 `model: opus`）+ ch12（加 5 skill 讲解）。
3. **第三阶段**（细节清理 - 约 1 天）：ch03 / ch06 / ch07 / ch08 / ch09、appendix-c / appendix-d / appendix-f 的逐项清理。
4. **单独处理**：appendix-e 决定是整文件删除还是重写成 `config.yaml` reference。
