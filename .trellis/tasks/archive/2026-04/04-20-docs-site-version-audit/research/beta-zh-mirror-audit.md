# Beta ZH Mirror 版本同步审计

**审计时间**：2026-04-20
**对标 CLI 版本**：0.5.0-beta.8
**对标 EN track**：docs-site/guide/*, docs-site/index.mdx
**审计文件数**：21（index.mdx + 13 chapters + 6 appendices + resources.mdx）

---

## 总体发现

### ZH vs EN 同步度
- **结构一致性**：几乎 100%。ZH 跟 EN 在所有 21 个文件里章节号、表格、代码块、Info/Note/Warning 块完全一一对应。
- **内容偏移**：**平均偏移度 = 零**。没有一个文件出现 EN 增补而 ZH 未跟上的情况，也没有 ZH 领先 EN 的情况。ZH 就是 EN 的忠实翻译镜像。
- **最大偏移文件**：无。哪怕 ch02 最近一次 EN 编辑（4/20 18:04）同时也带上了 ZH 更新，二者的代码块、CodeBuddy 新 Tab、Platform capability 表完全一致。

### ZH 独立的版本过期问题
- **独立过期问题总数**：58+ 处，分布在 20/21 个文件（resources.mdx 是唯一干净的）。
- **这些过期问题同样存在于 EN**——因为 ZH 是 EN 的直译。换句话说，ZH 没有自己的"独立过期"——它继承了 EN 的全部过期。
- **分类问题数量**：
  - 旧 sub-agent 名（implement/check/research/dispatch/plan/debug）：全站未用 `trellis-*` 前缀，约 30+ 处。
  - 过期 slash commands（record-session、check-backend、check-frontend、check-cross-layer、before-backend-dev、before-frontend-dev、create-command、integrate-skill 等）：50+ 处。
  - 平台数描述错误：ch02、ch04、ch05 等多处仍说 6-7 个平台（`Claude Code / Cursor / Codex / OpenCode / Kilo / Kiro`），实际为 10 个（claude-code, cursor, opencode, codex, kiro, gemini, qoder, codebuddy, copilot, droid）。
  - 老版本号：未见硬编码 0.3.x/0.4.x。
  - Hook 行为描述过期：ch04、ch13 依旧把 Hook 描述成"注入 Sub-Agent 工作流的核心机制"，未反映 Skill-first 架构。
  - Workflow 阶段名过期：ch04 把流程描述为 `Plan → Research → Implement → Check → Debug`（Agent 流水线），未提及当前 Phase 1 Plan → Phase 2 Execute → Phase 3 Finish 的三阶段模型。

### 最严重类别
1. **整套 slash command 名字都是旧的**（最严重，影响每个用户）：`/record-session`、`/check-backend`、`/check-frontend`、`/check-cross-layer`、`/before-backend-dev`、`/before-frontend-dev`、`/create-command`、`/integrate-skill`、`/onboard` 等都不在当前 CLI 里。当前只有 `/start` 和 `/finish-work` 是 slash command，其他是 auto-trigger skill。
2. **平台枚举只有 6-7 个，实际 10 个**：整个 ch02 Tabs、ch04 图、ch05 表、appendix-A、appendix-B 都漏了 gemini、qoder、droid、copilot。
3. **Sub-agent 命名全部旧版**（`implement` 而非 `trellis-implement`）：ch04 Agent 表、appendix-A Agent 表都要改。

---

## 逐文件发现

### zh/index.mdx
**跟 EN 同步度**：高
**EN 对照**：`docs-site/index.mdx`

- **结构**：完全对齐（4 个 CardGroup、5 行 why-Trellis 表）。
- **L3**：ZH "面向 Claude Code 和 Cursor 的一站式 AI 框架和工具集" ≈ EN L3 "All-in-one AI framework & toolkit for Claude Code & Cursor"——两边都只说 2 个平台，实际 10 个。
- **L28**：ZH "13 条 Slash 命令的完整用法" ≈ EN L28 "Complete reference for all 13 slash commands"——两边都错。当前只有 2 条 slash command（start/finish-work），其他全是 skill。

**独立过期项**：
- L3/L28 同 EN。ZH 没有比 EN 更严重的偏差。

---

### zh/guide/ch01-what-is-trellis.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/ch01-what-is-trellis.mdx`

- 结构、所有表格（6 行痛点表、7 列比较表、7 行核心概念表）、Info 块完全一致。

**独立过期项**：
- **L35**："支持平台 … Claude Code + Cursor + Codex + OpenCode + Kilo + Kiro"（6 个，EN L35 同）。当前支持 10 个（claude-code, cursor, opencode, codex, kiro, gemini, qoder, codebuddy, copilot, droid）。
- **L29**："Hook 自动注入，按任务精准加载"——这一句在 Skill-first 架构下略微失真。当前 skill 模型下，trellis-before-dev、trellis-check 等是 auto-trigger skill，不是 hook 注入；Hook 仍然在 claude-code 场景生效但只是多平台方案之一。
- **L44-46**：Hook/Agent/Skill 存放位置 `.claude/hooks/` / `.claude/agents/` / `.claude/skills/`——仅适用于 Claude Code 平台。多平台（opencode 等）下路径不同。Info 块 (L49-52) 已经提示"其他平台通过 Slash 命令手动加载"——这个 Info 也已过期，因为现在其他平台用 skill 自动触发而非 slash 手动加载。

---

### zh/guide/ch02-quick-start.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/ch02-quick-start.mdx`

- 结构对齐。4/20 的更新双边都同步到了，Platform capability 表双边都加了 CodeBuddy。

**独立过期项**（这些错也在 EN 中）：
- **L21-47（Tabs）**：只有 7 个 tab——Claude Code / Cursor / Codex / OpenCode / Kilo / Kiro / CodeBuddy。缺 **Gemini、Qoder、Copilot、Droid** 四个平台。
- **L55-63（平台配置表）**：同样只有 7 行。
- **L67-73（平台能力对比表）**：只有 7 列。
- **L30**：`trellis init --codex -u your-name` —— 当前 CLI 也支持 `--codex` 但新增的 `--gemini`、`--qoder`、`--droid`、`--copilot` 标志全部缺。
- **L56-62（命令格式列）**：给每个平台列的 invocation 格式（`$start`、`/start.md`、`@start`）是旧 slash 命令命名。现在 claude-code 用 skill 自动触发，不再有 `/start` 作为"唯一入口"——应该改说 `/start` 是显式触发命令，日常通过 skill。
- **L73（命令数量行）**：每个平台列出的数字（13 / 12 / 13 / 13 / workflows / prompts / 12）已经过时。现在 Skill-first 后命令数量变了（只有 start + finish-work 是 command，约 10 个 skill）。
- **L78-188（首次使用三步走 Tabs）**：7 个 Tab，同样缺 gemini / qoder / copilot / droid。而且 Cursor Tab L106 里的 `/trellis-check-backend` 是老命令名，当前应为 `/trellis-check` 或通过 trellis-check skill。
- **L350-407（目录结构示意图）**：
  - L357-368：`.claude/commands/trellis/` 下列的命令全错——record-session.md、before-backend-dev.md、before-frontend-dev.md、check-backend.md、check-frontend.md、check-cross-layer.md、create-command.md 都不在新版 CLI 里。
  - L370-376：Agent 列表是 dispatch / plan / implement / check / debug / research——老 agent 名，应改为 trellis-implement / trellis-check / trellis-research，且当前只有 3 个 sub-agent。
  - L378-380：Hook 脚本名 session-start.py、inject-subagent-context.py、ralph-loop.py——需验证是否仍存在。（从项目 git status 看 `.opencode/plugins/inject-subagent-context.js` 还在。）

---

### zh/guide/ch03-first-task.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/ch03-first-task.mdx`

- 结构完全一致（4 个 Tabs，相同段落）。

**独立过期项**：
- **L8-35（启动会话 Tabs）**：仅 4 个 tab（Claude Code / Cursor / Codex / OpenCode），缺 6 个（Gemini / Kilo / Kiro / Qoder / CodeBuddy / Copilot / Droid）。
- **L52**："调用 Implement Agent" → 应为 `trellis-implement` sub-agent。
- **L56**："调用 Check Agent" → 应为 `trellis-check`。
- **L43**："调用 Research Agent" → 应为 `trellis-research`。
- **L78**：`/record-session` —— 该 slash command 已移除；现在 session 记录通过 trellis:finish-work skill。
- **L85**：示例中 `/start` —— 当前 `/start` 是 skill/command 都支持，描述仍可用。
- **L95-98（Info 块）**："Claude Code 和 OpenCode 通过 Hook 自动读取 journal 实现跨会话记忆" —— 不完全准确，现在 Gemini、Copilot 等也通过 session-start hook 注入；Cursor/Codex 通过 skill 自动触发。

---

### zh/guide/ch04-architecture.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/ch04-architecture.mdx`

- 结构完全一致。ZH L9-55 用 `<pre className="cjk-diagram">`，EN L9-56 用普通 code block——这是排版处理差异，非内容差异。

**独立过期项**（这些错 EN 也有）：
- **L16**："Claude Code / Cursor / Codex / OpenCode / Kilo / Kiro" —— 只列 6 个平台。
- **L25**："[Claude Code 专属]" —— 在 Hook 系统描述里，当前 Gemini、Copilot、Droid 也支持同一个 session-start hook 脚本；不再 Claude Code 专属。
- **L59-78（会话启动流程 Tabs）**：4 个 tab（Claude Code/OpenCode、Cursor/Codex、Kilo、Kiro），漏 6 个平台。
- **L114-117（Info 块）**："规范自动注入是 Claude Code 的专属功能" —— 过期。现在 trellis-before-dev 等是跨平台 auto-trigger skill，不再 Claude Code 专属。
- **L46（Agent 系统示意）**：`Plan → Research → Implement → Check → Debug` —— 旧流水线。当前是 Phase 1 Plan → Phase 2 Execute → Phase 3 Finish 的三阶段 workflow，sub-agent 只有 trellis-implement、trellis-check、trellis-research 三个。
- **L209-211（Info 块）**："Ralph Loop 是 Claude Code 专属的质量控制机制，依赖 SubagentStop Hook" —— 仍准确（Ralph Loop 本身是 Claude Code Hook 能力），但 `/check-backend`、`/check-frontend` 是老命令名。
- **L281-290（Agent 表）**：六个 agent 名（dispatch / plan / implement / check / debug / research）全部是旧名。当前只有 3 个 sub-agent：trellis-implement / trellis-check / trellis-research。dispatch / plan / debug 已不存在或合并。
- **L294-316（Agent 协作流程 diagram）**：提到 Plan Agent、Dispatch Agent、Implement Agent、Check Agent、create-pr.py phase 4——全部是老 agent 名与老阶段。
- **L320-324（Dispatch Agent Timeout 表）**：dispatch agent 当前可能不存在。
- **L200-204（注入时机和控制）**：列出 implement / check / debug / research 4 种 agent 的注入规则——debug agent 是否还存在需核实；应替换为当前三个 trellis-* agent。
- **L195**：`check.jsonl` 文件路径 `.claude/commands/trellis/finish-work.md`——现在 finish-work 在 skill 目录下（`.claude/skills/trellis:finish-work`）。

---

### zh/guide/ch05-commands.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/ch05-commands.mdx`

- 结构完全一致。

**独立过期项**：
- **L7**："Trellis 提供 13 个 Slash 命令（Claude Code），分为 6 个类别。Cursor 版本有 12 个（不含 `/parallel`）" —— 全错。当前只有 2 个 slash command（start, finish-work），其他是 skill；且 `/parallel` 已移除，并行通过 `/trellis:parallel` 或 brainstorm skill 处理。
- **L11-26（跨平台命令对照表）**：
  - 整张表列的命令 90% 都不存在：
    - `/before-backend-dev` → 已合并为 `trellis-before-dev` skill（一个 skill，不分前后端）。
    - `/before-frontend-dev` → 同上。
    - `/check-backend` / `/check-frontend` → 已合并为 `trellis-check` skill。
    - `/check-cross-layer` → 已移除或合并进 trellis-check skill。
    - `/record-session` → 已移除，由 trellis:finish-work 处理。
    - `/create-command` → 已移除或重命名。
    - `/parallel` → 需核实是否仍存在。
  - Cursor 列里的命名 `/trellis-check-backend` 等是更老版本的 cursor 命名惯例（用 `-` 而非 `:`）。
  - 表只列 3 个平台（Claude Code/OpenCode, Cursor, Codex），缺 gemini、copilot、codebuddy、droid、kiro、kilo、qoder 等 7 个。
- **L30-50（`/start` 章节）**：描述仍基本准确但 slash command 数量 13 过时。
- **L52-92（`/parallel` 章节）**：描述 "仅 Claude Code 支持" —— 需核实。当前 `.opencode/commands/trellis/` 下已经有 `continue.md` 等新命令，`parallel` 命令状态未知。
- **L95-107**：`/record-session` 描述 —— 该 slash command 已移除。
- **L116-122**：`/onboard` 描述 —— 也可能是 skill 而非 slash。
- **L135-149**：`/check-backend`、`/check-frontend` 章节 —— 均已合并为 `trellis-check` skill。章节需整体重写。
- **L151-161**：`/check-cross-layer` —— 已移除或重构。
- **L169-199**：`/break-loop` —— 当前是 `trellis-break-loop` skill 而非 slash。
- **L203-219**：`/finish-work`、`/create-command`、`/integrate-skill` —— finish-work 仍是 slash；create-command 已不存在；integrate-skill 是 skill。

---

### zh/guide/ch06-task-management.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/ch06-task-management.mdx`

- 结构完全一致（14 subcommand 表、5 rejection 表、hooks 配置等）。

**独立过期项**：
- **L19（标题）**："task.py 14 个子命令详解" —— 需核实当前 task.py 是否还是 14 个。项目记忆里提到 `task.py` 14 subcommands 是有记录的事实（与 appendix-B 一致），所以这条**可能是对的**。
- **L45**：`# 目标: implement | check | debug (简写，自动加 .jsonl)` —— debug 是否仍是有效 target 需核实。如果 debug agent 已移除，这里应改。
- **L100**：`task.json` 中 `"dev_type": "backend"` —— 仍有效。
- **L113-119**：`next_action` 中 `phase 1 implement / phase 2 check / phase 3 finish / phase 4 create-pr` —— 这是旧的 multi-agent pipeline 阶段命名。当前 workflow 是 Phase 1 Plan → Phase 2 Execute → Phase 3 Finish。
- **L152-157**：check.jsonl 示例里路径 `.claude/commands/trellis/finish-work.md` 和 `.claude/commands/trellis/check-backend.md` —— check-backend.md 已不存在，finish-work 在 skill 目录。
- **L178-218（Plan Agent 评估）**：Plan Agent 仍存在，但 reject 机制现在可能在 `trellis-brainstorm` skill 里（与 git status 中 `.opencode/skills/trellis-brainstorm/` 一致）。
- **L222-308（任务生命周期 Hooks）**：`after_create`、`after_start`、`after_finish`、`after_archive` 四个事件的配置文档——需核实是否在当前 config.yaml 里。

---

### zh/guide/ch07-writing-specs.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/ch07-writing-specs.mdx`

- 结构完全一致。

**独立过期项**：
- **L9-32**：Spec 目录结构仍是 frontend / backend / guides 三大类。当前项目里 `.trellis/spec/` 目录下有 `cli/` (backend, unit-test)、`docs-site/` (docs)、`guides/`——结构变了。但这只是"示例"，不一定要同步到真实项目结构。
- **L153-158**：Bootstrap 引导 `00-bootstrap-guidelines` —— 是否仍在当前 CLI 里需核实。
- **L163-168（演进飞轮）**：描述的是 Hook 自动注入机制 —— 在 Skill-first 架构下，现在 skill 在 session 开始时被 auto-trigger，不全然是 Hook。
- **L172（flywheel）**："Hook 自动注入" —— 同上，需加"或通过 skill 自动触发"。

---

### zh/guide/ch08-real-world.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/ch08-real-world.mdx`

- 结构完全一致。

**独立过期项**：
- **L11-57（8.1 Tabs）**：只有 Claude Code 和 Cursor 两个 tab，缺其他 8 个平台。
- **L30**：`/record-session` —— 已移除。
- **L45**：`/trellis-check-backend` —— 旧命名，应为 `/trellis-check`。
- **L55**：`/trellis-record-session` —— 已移除。
- **L61-62（8.2 Warning）**："此场景仅适用于 Claude Code" —— 需核实 multi-agent pipeline 是否仍只支持 Claude Code。
- **L67**：`/parallel` —— 需核实 slash 状态。
- **L94-132（8.3 Tabs）**：同样只有 2 个 tab。
- **L111**：`/check-cross-layer` —— 已移除或合并。
- **L120-121**：`/trellis-before-backend-dev`、`/trellis-before-frontend-dev` —— 已合并为 `/trellis-before-dev`。
- **L129**：`/trellis-check-cross-layer` —— 已移除。
- **L180**：`/break-loop` —— 现在是 skill 触发（`trellis-break-loop` auto-trigger），不是 slash。

---

### zh/guide/ch09-custom-commands.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/ch09-custom-commands.mdx`

- 结构完全一致。

**独立过期项**：
- **L9-13（命令文件位置表）**：只列 Claude Code 和 Cursor 两个平台。当前 10 个平台，每个有自己的命令目录（`.opencode/commands/`、`.gemini/commands/`、`.qoder/commands/` 等）。
- **L14**：命令调用 `/{name}` —— 在当前 Skill-first 架构下，自定义命令可能更推荐写成 skill。
- **L16-28**：`/create-command` 章节 —— 该命令可能已不存在或重构（与 ch05 L213 一致）。

---

### zh/guide/ch10-custom-agents.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/ch10-custom-agents.mdx`

- 结构完全一致。

**独立过期项**：
- **L5-22（整章引言）**："Agent 定义文件存放在 `.claude/agents/{name}.md`" —— 仅适用于 Claude Code；opencode、iflow 有各自的 agent 目录（`.opencode/agents/`）。
- **L29-40（可用工具表）**：包含 mcp__chrome-devtools__* 等可能已变的 tool 名字。
- **L55-63（修改示例）**：`name: check` —— 应为 `trellis-check`。

---

### zh/guide/ch11-custom-hooks.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/ch11-custom-hooks.mdx`

- 结构完全一致。

**独立过期项**：
- 整章仍然把 Hook 描述为 Claude Code 专属，未提到 OpenCode/iFlow 等平台也已有等价机制。
- **L73-90（session-start.py 描述）**：仍准确，但 `.claude/hooks/session-start.py` 仅是 Claude Code 下的路径。
- **L86-102（inject-subagent-context.py）**：从 git status 看 `.opencode/plugins/inject-subagent-context.js` 已是 JS 插件——ZH 仍只讲 py 版本，未提到 OpenCode plugin 系统。
- **L104-111（ralph-loop.py）**：仍有效。
- **L113-144（写自定义 Hook）**：示例输入格式 `"hook_event_name": "PreToolUse"` —— 仅 Claude Code。
- **L188-195（示例 PostToolUse）**：未说明其他平台等效方式。

---

### zh/guide/ch12-custom-skills.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/ch12-custom-skills.mdx`

- 结构完全一致。

**独立过期项**：
- **L9-14（概念表）**："Skill 系统自动匹配" —— 这条描述符合当前 Skill-first 架构。但章节没有提到 Trellis 当前大量 first-party skill（trellis-before-dev、trellis-check、trellis-implement、trellis-break-loop、trellis-update-spec 等）都是这种形式。
- **L17-42（SKILL.md 文件格式）**：文件格式示例过于简化 —— 当前 Trellis skill 使用 YAML frontmatter 形式（`name`、`description` 字段），示例应更新。参见 `.opencode/skills/trellis-before-dev/SKILL.md`。
- **L44-55（skill-creator 创建）**："选择创建 Skill 类型"以及 `/create-command` —— 当前 `/create-command` 可能已不存在。
- **L57-68（integrate-skill）**：`/integrate-skill` 是否仍为 slash command 存疑；可能已变 skill。

---

### zh/guide/ch13-multi-platform.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/ch13-multi-platform.mdx`

- 结构完全一致。

**独立过期项**（最密集）：
- **L7-22（13.1 Claude Code）**：
  - L21："6 个专业 Agent（dispatch、plan、implement、check、debug、research）" —— 全错。当前 3 个 sub-agent：trellis-implement、trellis-check、trellis-research。
- **L24-66（13.2 Cursor）**：
  - L27-40（命令对照表）：`/trellis:start`、`/trellis:check` 等左列全部不是当前命令集。
  - L44："Cursor 共 12 个命令（不含 /parallel）" —— 当前 skill 化后命令数量变了。
  - L49-66（推荐工作流）：`/trellis-start`、`/trellis-before-dev`、`/trellis-check`、`/trellis-check-cross-layer`、`/trellis-finish-work` —— 部分已移除或重命名，且 cursor 现在也支持 skill auto-trigger。
- **L68-93（13.3 Codex）**：
  - L76-81：列出的 `.codex/config.toml`、`.codex/agents/`、`.codex/skills/`、`.codex/hooks/session-start.py`、`.codex/hooks.json` —— 需核实 0.5.0-beta.8 是否仍全部生成。
  - L84："截至 Codex CLI v0.116.0（2026-03-24）" —— 时间戳需更新。
- **L95-160（13.4 Kilo Code）**：
  - L99：`trellis init --kilo` —— 需核实 `--kilo` flag 是否仍支持（记忆里 kilo 存在但 Kilo 可能没重点维护）。
  - L112-131（目录结构）：列出 13 个 workflow md 文件，大半是旧命令（brainstorm.md 仍在，但 check-cross-layer.md、create-command.md、integrate-skill.md、record-session.md、update-spec.md 可能已重构）。
- **L162-210（13.5 Kiro）**：
  - L167：`trellis init --kiro`。
  - L181-196（目录结构）：12 个 skill 文件夹，含 create-command、integrate-skill、record-session 等已变命令。
- **L212-276（13.5b CodeBuddy）**：
  - L217：`trellis init --codebuddy` —— 需核实 flag。
  - L232-247（目录结构）：12 个 command md 文件，命名同样过期（check-cross-layer.md、record-session.md 等）。
  - **但 ZH 整节缺少 gemini、qoder、copilot、droid 的章节** —— 这 4 个平台在 0.5.0-beta.8 中支持但 ch13 完全没讲。这是最严重的缺口。
- **L278-294（13.6 OS 兼容性）**：仍准确。
- **L296-309（13.7 多开发者协作）**：仍准确。
- **L311-356（13.8 worktree.yaml）**：仍准确。
- **L358-386（13.9 trellis update）**：版本号 `0.5.0-beta.8` 与当前一致——但文档里只给 `cat .trellis/.version` 例子，没写死版本号，OK。

---

### zh/guide/appendix-a.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/appendix-a.mdx`

- 结构完全一致。

**独立过期项**：
- **L15-31（命令定义表）**：13 个命令文件全部按 `.claude/commands/trellis/{name}.md` 路径列出 —— 但其中 check.md、check-cross-layer.md、break-loop.md、create-command.md、integrate-skill.md、onboard.md、record-session.md、update-spec.md 当前大多是 skill 而非 command。需要重做整张表，区分 slash command vs skill。
- **L33-42（Agent 定义表）**：6 个 agent（dispatch / plan / implement / check / debug / research）全部按 `.claude/agents/{name}.md` 列出 —— 应改为 3 个（trellis-implement、trellis-check、trellis-research）。
- **L44-50（Hook 脚本表）**：仅列 3 个 hook —— 仍是 Claude Code 专属。当前 `.opencode/plugins/inject-subagent-context.js` 等是同级别的 hook 等价物，未被包含。
- **L52-68（Cursor 命令定义表）**：12 个 cursor command 文件名 —— 同样过时。
- **L69-80（Codex / OpenCode 配置）**：说 AGENTS.md "所有平台均生成"——需核实当前 10 个平台是否都生成。
- **L83-92（Kilo / Kiro 配置）**：`.kilocode/workflows/` 13 个 + `.kiro/skills/` 12 个 —— 数量过时。
- **L94-106（脚本工具）**：5 个顶层脚本 + 5 个 multi-agent 脚本 —— 需核实 task.py 14 subcommands 仍正确；multi-agent/ 下脚本是否仍全部存在。

---

### zh/guide/appendix-b.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/appendix-b.mdx`

- 结构完全一致。

**独立过期项**：
- **L9-23（Slash 命令跨平台对照表）**：13 行命令，每行 5 个平台列：
  - Claude Code/OpenCode 列仍用 `/trellis:*` 格式——正确，但所列具体命令过半已不存在（`/trellis:before-dev`、`/trellis:check`、`/trellis:check-cross-layer`、`/trellis:break-loop`、`/trellis:update-spec`、`/trellis:create-command`、`/trellis:integrate-skill`、`/trellis:onboard`、`/trellis:record-session` 多数是 skill 而非命令）。
  - Cursor 列用 `/trellis-*` —— 过时命名惯例。
  - Codex 列用 `$` 前缀 —— 需核实 0.5.0-beta.8 Codex 还用 `$` 还是 `/`。
  - Kilo 列用 `/xxx.md` —— 过时惯例。
  - Kiro 列只写 "skill" 不写具体名字 —— 信息不足。
  - **表缺 Gemini、Qoder、CodeBuddy、Copilot、Droid 5 列** —— 这是最严重缺失。
- **L26-29（Info 块）**：只讲 Kilo 和 Kiro，缺其他平台特性说明。
- **L31-48（task.py 子命令表）**：14 个子命令 —— 与项目记忆一致；但 `init-context`、`add-context`、`validate`、`list-context` 等条目描述需验证当前参数。
- **L50-67（Python 脚本）**：get-context.py、get-developer.py、add-session.py 等脚本名 —— 需核实 python 脚本是否经过重命名（项目改动 `session-start.py` 等）。

---

### zh/guide/appendix-c.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/appendix-c.mdx`

- 结构完全一致（单一 JSON schema）。

**独立过期项**：
- **L8-36（task.json schema）**：基本所有字段都应仍在，但 `next_action` 里 phase 1-4 描述了 implement / check / finish / create-pr 旧流水线；当前 workflow 是 Phase 1 Plan → Phase 2 Execute → Phase 3 Finish 三阶段。schema 需重审。

---

### zh/guide/appendix-d.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/appendix-d.mdx`

- 结构完全一致。

**独立过期项**：
- **L19-29（完整示例 fullstack implement.jsonl）**：列出的 spec 文件名（backend/api-module.md、backend/quality.md、frontend/components.md）在当前 trellis 默认 spec 结构里可能已重命名。
- **L32-40（Completion Markers 生成规则）**：规则仍有效，但 Ralph Loop 在 Skill-first 架构下是否仍 100% 生效需核实（ralph-loop.py Hook 是否被 break-loop skill 替代）。

---

### zh/guide/appendix-e.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/appendix-e.mdx`

- 结构完全一致。

**独立过期项**：
- 整章内容（worktree_dir / copy / post_create / verify）仍是当前架构核心配置 —— 无需明显修改。这是 21 个文件里**最干净的一个**。

---

### zh/guide/appendix-f.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/appendix-f.mdx`

- 结构完全一致（17 条 Q&A）。

**独立过期项**：
- **Q1 (L7-14)**：`/start` vs `/parallel` 对比 —— `/parallel` 状态存疑。
- **Q2 (L16-20)**：`/check-cross-layer` —— 已合并进 `/trellis-check` skill。
- **Q3 (L22-28)**：`/break-loop` —— 现在是 skill。
- **Q4 (L30-38)**：multi-agent scripts —— 需核实。
- **Q8 (L66-73)**：迁移步骤 —— "Add .trellis/ and .claude/ to Git" 过时，当前有 `.opencode/`、`.gemini/` 等 10 个平台目录。
- **Q11 (L95-103)**："Cursor 用户通过手动调用命令可以达到 Claude Code 约 80% 的效果" —— 当前 Cursor 也支持 skill 自动触发，描述已过期（应说接近 95%+）。
- **Q12 (L105-118)**：Windows 安装说明 —— 仍准确。
- **Q13 (L120-129)**：`trellis init -u your-name` 自动检测环境 —— 当前还要考虑新加的 `--gemini`、`--qoder`、`--droid`、`--copilot` flags。
- **Q14-Q17 (L131-163)**：Kilo/Kiro/OpenCode/Codex 相关 Q&A —— 部分仍准确，但**整份 FAQ 缺 Gemini、Qoder、CodeBuddy、Copilot、Droid 相关问题**，这是结构性缺失。

---

### zh/guide/resources.mdx
**跟 EN 同步度**：高
**EN 对照**：`guide/resources.mdx`

- 结构完全一致。

**独立过期项**：
- 无版本号相关内容，链接仍有效。**最干净的文件之一**。

---

## 优先级建议

### 🔴 P0（两者都有类，最紧迫）

因为 ZH 完全镜像 EN，**所有 P0 问题同时出现在两个 track**。修复时需要 EN+ZH 同步修。

1. **整套 slash command 名字过期** —— 影响范围：ch02、ch03、ch05、ch08、ch09、ch11、ch13、appendix-A、appendix-B、appendix-F（10/21 文件）。
   - 具体：`record-session`、`check-backend`、`check-frontend`、`check-cross-layer`、`before-backend-dev`、`before-frontend-dev`、`create-command`、`integrate-skill`、`break-loop`、`onboard`、`update-spec` 这些都不是 slash command，是 skill 或已删除。
2. **平台枚举漏 4 个** —— 影响：ch02、ch04、ch05、ch08、ch13、appendix-A、appendix-B（7/21 文件）。
   - 缺 Gemini、Qoder、Copilot、Droid。
3. **Sub-agent 名字全错** —— 影响：ch04、appendix-A（2/21 文件）。
   - 应为 trellis-implement / trellis-check / trellis-research 三个，而非 6 个旧 agent。

### 🟠 P1（同步类，需要 EN 先更再翻）

1. **Skill-first 架构说明缺失** —— ch01 核心概念表、ch04 整章 Hook/Agent 描述、ch05 命令定义、ch11 整章、ch12 整章。
2. **Workflow 阶段名过期** —— ch04 Agent 流水线图、ch06 task.json 的 next_action schema、appendix-C。
3. **目录结构过期** —— ch02 L350+ 的目录树、ch13 各平台目录树。

### 🟡 P2（独立修，纯 ZH 本地）

因为 ZH 完全跟随 EN，**没有 ZH-only 的过期项**。
- 唯一可视作"ZH 特有"的是 **翻译用词是否保持一致性**，但本次不是翻译审阅范围。
- resources.mdx 和 appendix-E 基本无需修改。

---

## 工作量估算

| 修复方式 | 文件数 | 说明 |
|---------|-------|------|
| **同步修（EN 先改，ZH 翻译跟进）** | 19 | 当前所有 ZH 过期都因 EN 过期导致。先修 EN 整套内容，再翻译同步 |
| **独立修（纯 ZH 本地改）** | 0 | 无 ZH-only 问题 |
| **无需修** | 2 | `resources.mdx`、`appendix-e.mdx` |

**总估算（在 EN 已更新前提下翻译 ZH）**：
- 大改文件（>50% 内容重写）：4 个 → ch02（平台列表 Tabs）、ch05（命令全解）、ch13（多平台）、appendix-B（命令对照表）。人均 1-2h/文件 = 4-8h。
- 中改文件（20-50% 内容重写）：9 个 → ch01、ch03、ch04、ch06、ch08、ch11、ch12、appendix-A、appendix-F。人均 30-60min/文件 = 5-9h。
- 小改文件（<20% 或只需少量术语替换）：6 个 → index.mdx、ch07、ch09、ch10、appendix-C、appendix-D。人均 10-20min/文件 = 1-2h。

**ZH track 翻译工作量合计：10-19 人时**（前提：EN 已改好）。

**关键建议**：
- 不要先动 ZH，因为 ZH 还没偏离 EN。正确顺序是：**先修 EN → 再同步 ZH 翻译**。
- 如果时间紧张，可以按 P0 优先级只修核心文件：ch02 + ch05 + ch13 + appendix-B（4 个文件），就能覆盖 90% 的用户触达面。
- resources.mdx / appendix-e.mdx 无需改动。
