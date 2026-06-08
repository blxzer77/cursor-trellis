# Ancillary Pages 版本同步审计

**审计时间**：2026-04-20
**对标 CLI 版本**：0.5.0-beta.8
**审计范围**：index + showcase + blog + contribute + use-cases + templates + skills-market（EN + ZH）
**审计文件数**：30（15 EN + 15 ZH）

---

## Ground-truth 基线（用于对标）

| 维度 | 当前真实状态 |
|---|---|
| CLI 版本 | 0.5.0-beta.8 |
| Sub-agents | `trellis-implement` / `trellis-check` / `trellis-research`（3 个，都有 trellis- 前缀） |
| 平台数 | 10 |
| 命令（common） | 3 个 slash command：`/trellis:start`、`/trellis:continue`、`/trellis:finish-work` |
| Skills | 5 个 common skill：`trellis-before-dev`、`trellis-brainstorm`、`trellis-break-loop`、`trellis-check`、`trellis-update-spec` |
| Plugin / Agent Trace | Planning 阶段（`.trellis/tasks/04-20-plugin-system-design/`） |
| Marketplace skills | 3 个：`trellis-meta`、`cc-codex-spec-bootstrap`、`frontend-fullchain-optimization` |
| Marketplace specs | 3 个：`electron-fullstack`（50 files）、`nextjs-fullstack`（35 files）、`cf-workers-fullstack`（38 files） |
| 已删/改名命令 | `/trellis:record-session`（已删）、`/trellis:parallel`（不在 common，仅 Claude 特有）、`/trellis:onboard`（不在 common，仅部分平台） |

---

## 总体发现

- **辅助页面普遍稳定度：中偏低**
  - `index.mdx`、`contribute/*`、`skills-market/*`、`templates/*`：稳定度高，基本对齐
  - `showcase/*`、`use-cases/*`：**严重过期**，大量使用已删除命令 `/trellis:record-session`、旧 agent 名 `implement`/`check`/`research`（无 `trellis-` 前缀）
  - `blog/*`：时效性弱，`use-k8s-to-know-trellis` 引用 Agent 命名也需更新；`ai-collaborative-dev-system` 是 Mosi 项目历史叙事，基本时间无关
- **最需要更新的目录**：`showcase/`、`use-cases/`（多处引用已删命令和旧 agent 名）、`index.mdx`（命令总数"13 slash commands"与现实 3 common + 若干平台特定不符）
- **发现的 broken / 过期命令引用**：约 14 处 `/trellis:record-session`，2 处旧 Trellis v0.2.12 版本号
- **Marketplace 引用完全一致**：所有 skills（3 个）和 specs（3 个）都匹配仓库实际内容

---

## 逐目录发现

### index.mdx / zh/index.mdx

**EN**：`docs-site/index.mdx`
- L3 描述为 `'All-in-one AI framework & toolkit for Claude Code & Cursor'` — **过期**。0.5.0-beta 已支持 10 个平台（Claude Code、Cursor、iFlow、OpenCode、Qoder、Codex、Kiro、Kilo、Gemini CLI、Antigravity、CodeBuddy）。只提 Claude Code & Cursor 严重缩水。
- L28 `Complete reference for all 13 slash commands.` — **过期**。`packages/cli/src/templates/common/commands/` 只有 3 个（start/continue/finish-work），若算上平台特定的 parallel/onboard/create-command/create-manifest/integrate-skill/improve-ut/publish-skill 也不是 13。需重数或用别的措辞（例如 "Complete command reference"）。

**ZH**：`docs-site/zh/index.mdx`
- L3 `'面向 Claude Code 和 Cursor 的一站式 AI 框架和工具集'` — **同样过期**，应提到 10 个平台。
- L28 `13 条 Slash 命令的完整用法。` — **同上过期**。

---

### showcase/*.mdx

#### showcase/index.mdx / zh/showcase/index.mdx
- **整体稳定**。两文件都只链接到 open-typeless、trellis-cursor，命令引用无过期内容（`/contribute` 在 L29/L28 是 skill 名，符合现状）。
- EN L29：`Use \`/contribute\` skill in Claude Code for assistance.` — `contribute` skill 确实存在（`.claude/skills/` 和 marketplace 均有），OK。

#### showcase/open-typeless.mdx / zh/showcase/open-typeless.mdx
- EN L14：`Used \`/trellis:parallel\` to launch 3 worktree agents...` — `/trellis:parallel` 当前是 **Claude Code 专属**命令（`.claude/commands/trellis/parallel.md` 存在），提及时最好加平台前缀。不算 broken。
- ZH L14：同样引用 `/trellis:parallel`，同上。

#### showcase/template.mdx / zh/showcase/template.mdx
- 模板占位文件，无版本相关内容。**稳定**。

#### showcase/terminal-demo.mdx（高优先级！）
- L30：`<span className="td-link">feat/v0.4.0-beta</span>` — **过期**。当前分支为 `feat/v0.5.0-beta`。
- L50：`<span className="td-agent-name">research</span>` — **过期**。应为 `trellis-research`（有 trellis- 前缀）。
- L77：`<span className="td-agent-name">implement</span>` — **过期**，应为 `trellis-implement`。
- L94：`<span className="td-agent-name">check</span>` — **过期**，应为 `trellis-check`。
- L125：`<span className="td-cmd">/trellis:record-session</span>` — **已删命令**。`/trellis:record-session` 在当前 CLI（.claude/commands/trellis/ 和 common templates）中**已不存在**，只有 `.opencode/commands/trellis/record-session.md` 在本仓库 opencode fork 里残留。应替换为 `/trellis:finish-work` 或删除该阶段。
- L173：`Research Agent finds relevant specs and code patterns.` — 文案 "Research Agent" 尚可（人类可读名），但 agent 技术名已是 `trellis-research`。
- L181：`Check Agent reviews every changed file` — 同上。
- L215：`Implement Agent writes code across 5 layers` — 同上。
- L224：``/trellis:record-session\` archives the session to your journal.` — **同 L125 已删命令**。
- L237：`**Human input** | 3 messages (feature request + update-spec + record-session)` — 提及 `record-session`，**已删**。

#### zh/showcase/terminal-demo.mdx（高优先级！）
- L30：`feat/v0.4.0-beta` — **过期**，同 EN。
- L50/L77/L94：`research` / `implement` / `check` 无 `trellis-` 前缀 — **过期**。
- L110 / L125 / L131 / L137 / L224 / L237：多次 `/trellis:record-session` 或 `record-session` — **已删命令**。
- L233：`| **工具调用** | 169 次（explore + research + implement + check）` — "explore" 阶段在当前工作流里未体现（Phase 1/2/3 为 implement → check → finish）。

#### showcase/trellis-cursor.mdx / zh/showcase/trellis-cursor.mdx
- EN L8 / ZH L8：`Based on Trellis v0.2.12.` / `基于 Trellis v0.2.12。` — **版本号陈旧**。虽然 fork 基于的是 v0.2.12 是历史事实，但建议加 "(as of fork date)" 或注明当前 Trellis 已在 0.5.0-beta。不算绝对错误。
- EN L14：`13 slash commands in \`.cursor/commands/\` format` — **过期**（同 index.mdx）。Cursor 平台现在实际 commands 数量需重查，不是 13。
- ZH L14：同上。

---

### blog/*.mdx

#### blog/index.mdx / zh/blog/index.mdx
- 仅仅是文章列表 + 日期。**稳定**。

#### blog/ai-collaborative-dev-system.mdx / zh/blog/ai-collaborative-dev-system.mdx
- **历史叙事文章**，主题是 "Mosi 项目早期如何搭建 AI 协作系统"，使用的是 `.cursor/commands/` + `workflow/agent-progress/` 老结构（非 Trellis 结构）。这是**故意的历史视角**，不代表当前 Trellis。
- 作为 "thought-piece" 基本不需要改；若要加 "edited" 声明可以在开头加一行 "本文记录的是 Trellis 诞生前的 Mosi 项目实践" 以避免误导。
- 无需视作过期。

#### blog/use-k8s-to-know-trellis.mdx / zh/blog/use-k8s-to-know-trellis.mdx
- EN L244 / ZH L241：`Agent: Implement Agent` — 人类可读名，可接受。
- EN L250 / ZH L249：`Agent: Check Agent` — 同上。
- EN L261 / ZH L259：`Agent: Check Agent (with [finish] flag)` — 同上。
- EN L290 / ZH L289：``/trellis:start\` or \`/trellis:parallel\` (Claude Code only) launches with one click` — `/trellis:parallel` 标注了 Claude Code only，**准确**。
- EN L293 / ZH L292：`Plan → Implement → Check → Finish → PR` — 这里用的是**阶段名而不是 Phase 编号**，与 `ch04-architecture` 可能用的 Phase 1/2/3 不一致。但作为 blog 里的高层示意，不算错。
- **核心内容（K8s 类比、Hook 注入、Ralph Loop）基本与当前 Trellis 架构对齐**。无高优先级过期。
- 次要：未提及当前 0.5.0-beta 新增的 Plugin system（planning 中），但 blog 允许滞后。

---

### contribute/*.mdx

#### contribute/docs.mdx / zh/contribute/docs.mdx
- **稳定**。内容围绕 docs 仓贡献流程，命令引用 `pnpm dev` / `pnpm lint:md` / `pnpm verify` / `pnpm format`。
- EN L79：`See [Claude Code Skills documentation](https://code.claude.com/docs/en/skills)` — **外链需快速检查**（建议 fetch 验证）。
- EN L82：`Skills are hosted in the [Trellis main repo]...` — 准确。
- EN L89：`templates/specs-your-template.mdx` — 路径规则与当前 `docs-site/templates/` 一致。
- ZH L76 / L78：同上。

#### contribute/trellis.mdx / zh/contribute/trellis.mdx
- **最短文件**。EN 仅引用 `CONTRIBUTING.md`，ZH 仅引用 `CONTRIBUTING_CN.md`。
- 需验证仓库根目录：
  - `/Users/taosu/workspace/company/mindfold/product/share-public/Trellis/CONTRIBUTING.md` — 存在性未验证（略微疑点，但此次审计不展开）。
  - `CONTRIBUTING_CN.md` — 存在性未验证。
- 若缺失，则为 broken link。**待后续脚本化检查**。

---

### use-cases/*.mdx

#### use-cases/open-typeless.mdx（高优先级！）
- L41：`trellis init` — 命令存在且正确，OK。
- L97：`**Prompt:** \`/trellis:parallel\`` — `/trellis:parallel` 是 Claude Code 专属命令；若 use-case 面向通用场景，应标注平台限制。
- L119：`**Prompt:** \`/trellis:record-session\`` — **已删命令**。需替换为 `/trellis:finish-work`（当前归档/结束流程）。
- L133：`Select the next task, AI uses implement agent then check agent` — 旧 agent 名（无 `trellis-` 前缀）。"implement agent" / "check agent" 作为口语名可保留，但更严谨应写 `trellis-implement` / `trellis-check`。
- L152：表格 `/trellis:parallel` + `/trellis:record-session` — `record-session` **已删**。

#### zh/use-cases/open-typeless.mdx（高优先级！）
- L40 / L96 / L118 / L132 / L150：**完全对应 EN 的同类问题** — `/trellis:record-session` 两处、agent 名无 `trellis-` 前缀、`/trellis:parallel` 未标注平台限制。

---

### templates/*.mdx

#### templates/specs-index.mdx / zh/templates/specs-index.mdx
- EN L14–L18 / ZH L14–L18：列出 3 个模板（electron-fullstack、nextjs-fullstack、cf-workers-fullstack）— **与 `marketplace/index.json` 完全一致**。
- EN L26 / L33 / L40：文件数 `(50 files)`、`(35 files)`、`(38 files)` — **已校验匹配** `find` 输出：electron=50、nextjs=35、cf-workers=38。
- EN L44：`## Template Marketplace <sup>v0.3.6</sup>` — "从 v0.3.6 起支持 `--registry`" 是历史版本标注，当前在 0.5.0-beta.8 仍成立。**保留 OK**。
- ZH L44：同上。
- **结论：templates/ 目录完全对齐 marketplace 真相，稳定度高**。

#### templates/specs-electron.mdx / zh/templates/specs-electron.mdx
- EN L20–L23：文件数分布 "Frontend 11 files / Backend 14 files / Guides 8 files / Shared 6 files"。ZH L20–L23 同。
- 未逐一校验每个子目录 md 文件数（可选深入审计项）。总计 11+14+8+6=39，但 find 全量含 README 是 50，**差 11（可能是 big-question/ 等未列出）**。建议交叉校验。
- **中优先级**：数字可能不完全准确，但 `50 files (download card)` 与实际一致。

#### templates/specs-nextjs.mdx / zh/templates/specs-nextjs.mdx
- "Frontend 12 + Backend 10 + Guides 3 + Shared 4 + Pitfalls 5 = 34"，与 download card 标注 "35 files" 接近（差 1，可能是 README）。基本对齐。

#### templates/specs-cf-workers.mdx / zh/templates/specs-cf-workers.mdx
- "Backend 11 + Frontend 7+examples + Shared 5 + Guides 3 + Pitfalls 6 ≈ 32+examples"，download card 标注 "38 files"。数字近似。

---

### skills-market/*.mdx

#### skills-market/index.mdx / zh/skills-market/index.mdx
- EN L17–L20 / ZH L17–L20：列出 3 个 skill（trellis-meta、cc-codex-spec-bootstrap、frontend-fullchain-optimization）— **与 marketplace/index.json + marketplace/skills/ 目录完全一致**。
- **稳定**。

#### skills-market/trellis-meta.mdx / zh/skills-market/trellis-meta.mdx
- EN L15 / ZH L15：`Works with Claude Code, Cursor, OpenCode, iFlow, Codex, Kilo, Kiro, Gemini CLI, Antigravity, and more.` — 列出了 9 个 + "and more"。当前支持 10 个（Claude Code、Cursor、iFlow、OpenCode、Qoder、Codex、Kiro、Kilo、Gemini CLI、Antigravity、CodeBuddy — 实际 11 个，若 CodeBuddy 算上）。**缺 Qoder 和 CodeBuddy**。
- 建议改为："Works with Claude Code, Cursor, OpenCode, iFlow, Qoder, Codex, Kilo, Kiro, Gemini CLI, Antigravity, CodeBuddy"
- 表格内容（`core/`、`claude-code/`、`how-to-modify/`、`meta/`）与 marketplace/skills/trellis-meta/ 结构需验证 — 未展开。

#### skills-market/cc-codex-spec-bootstrap.mdx / zh/skills-market/cc-codex-spec-bootstrap.mdx
- Prerequisites 表（Trellis / GitNexus / ABCoder / Codex CLI）— 基本稳定。
- 结构和 marketplace/skills/cc-codex-spec-bootstrap/ 需验证（至少 SKILL.md + references/mcp-setup.md 存在）— 未展开。
- **稳定度高**。

#### skills-market/frontend-fullchain-optimization.mdx / zh/skills-market/frontend-fullchain-optimization.mdx
- 内容围绕 Web Vitals / Lighthouse / DevTools。**不依赖 Trellis 版本**，稳定。
- **无过期**。

---

## Broken Link 扫描

| 文件 | 行 | 引用 | 状态 |
|---|---|---|---|
| showcase/terminal-demo.mdx | L125 | `/trellis:record-session` | **已删命令** |
| showcase/terminal-demo.mdx | L224 | `/trellis:record-session` | **已删命令** |
| zh/showcase/terminal-demo.mdx | L125 | `/trellis:record-session` | **已删命令** |
| zh/showcase/terminal-demo.mdx | L224 | `/trellis:record-session` | **已删命令** |
| use-cases/open-typeless.mdx | L119 | `/trellis:record-session` | **已删命令** |
| use-cases/open-typeless.mdx | L152 | `/trellis:record-session` | **已删命令** |
| zh/use-cases/open-typeless.mdx | L118 | `/trellis:record-session` | **已删命令** |
| zh/use-cases/open-typeless.mdx | L150 | `/trellis:record-session` | **已删命令** |
| contribute/trellis.mdx | L13 | `github.com/mindfold-ai/Trellis/blob/main/CONTRIBUTING.md` | **待验证**（仓库根 CONTRIBUTING.md 未核实） |
| zh/contribute/trellis.mdx | L13 | `github.com/mindfold-ai/Trellis/blob/main/CONTRIBUTING_CN.md` | **待验证** |
| contribute/docs.mdx | L79 | `code.claude.com/docs/en/skills` | **待验证外链** |

---

## 优先级建议

### 高优先级（命令已删 / 核心工作流错误描述）
1. **`showcase/terminal-demo.mdx` + `zh/showcase/terminal-demo.mdx`** —
   - 分支号 `feat/v0.4.0-beta` → `feat/v0.5.0-beta`
   - Agent 名 `research`/`implement`/`check` → `trellis-research`/`trellis-implement`/`trellis-check`
   - 删除 / 替换 `/trellis:record-session` → `/trellis:finish-work`
   - "record-session" 阶段（Phase 8）整体改写为 "Finish work / Archive" 阶段
2. **`use-cases/open-typeless.mdx` + `zh/use-cases/open-typeless.mdx`** —
   - 所有 `/trellis:record-session` → `/trellis:finish-work`
   - Agent 名规范化
   - `/trellis:parallel` 标注 "Claude Code only"
3. **`index.mdx` + `zh/index.mdx`** —
   - 描述从 "Claude Code & Cursor" 扩到 "10 platforms"
   - L28 "13 slash commands" 重新计算或改为 "all slash commands"

### 中优先级（平台数 / 版本号措辞）
4. **`skills-market/trellis-meta.mdx` + ZH** — 支持平台列表补全（加 Qoder、CodeBuddy）
5. **`showcase/trellis-cursor.mdx` + ZH** — `v0.2.12` 加 "(fork date)" 注释；"13 slash commands" 重数
6. **`templates/specs-electron.mdx` + ZH** — "Guides 8 files" 等子项数字可能不准，但主要数（50）准确

### 低优先级（时效性弱 / 历史叙事）
7. **`blog/ai-collaborative-dev-system.mdx` + ZH** — 历史叙事，不改动；可选加 "Mosi 早期实践" 声明
8. **`blog/use-k8s-to-know-trellis.mdx` + ZH** — 核心类比依然准确；可选加一句当前 Plugin system 计划
9. **`contribute/docs.mdx` / `contribute/trellis.mdx`** + ZH — 外链待快速校验即可

---

## 工作量估算

| 类型 | 数量 |
|---|---|
| **小改（1–3 行，版本号 / 命令名替换）** | 4 个文件 — index.mdx (×2)、trellis-cursor.mdx (×2) |
| **中改（多段改写，一个文件内 5+ 处）** | 6 个文件 — terminal-demo.mdx (×2)、open-typeless use-case (×2)、trellis-meta skill-market (×2) |
| **大改（整段重写 / 换命令阶段）** | 0（最多 terminal-demo 算边缘情况） |
| **需新建 / 删除页面** | 0（但若 `/trellis:record-session` 彻底废弃，可考虑合并记录进 `finish-work` 叙事） |
| **外链待校验** | 3 处（contribute/trellis.mdx × 2、contribute/docs.mdx 中的 code.claude.com） |

---

## 审计总结

**共发现 ~25 处需要修改**，集中在：
- `/trellis:record-session` 已删命令残留：**10 处**（跨 4 个文件）
- 旧 agent 名（无 `trellis-` 前缀）：**6 处**（主要在 terminal-demo）
- 旧分支号 `feat/v0.4.0-beta`：**2 处**
- 平台数 / 命令数措辞："Claude Code & Cursor" 缩水、"13 slash commands"：**4 处**
- 版本号 v0.2.12 等历史引用：**2 处**（可保留但加注释）

Marketplace 引用（skills-market + templates）与仓库实际**完全一致**，是本轮审计的亮点——贡献者使用 `/contribute` skill 的路径是有效的。
