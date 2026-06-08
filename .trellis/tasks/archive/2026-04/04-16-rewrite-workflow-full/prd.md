# 重写 workflow + 调整 continue / start / finish-work

## 目标

把 Trellis 的核心流程文档 `workflow.md` 从"混合大纲 + 详细步骤"重构为 **Phase Index + Phase Detail 两级结构**，并把 `continue / start / finish-work` 三个命令按"有 hook / 无 hook 平台"差异化输出。最终实现：

- AI 每一步按 phase 粒度获取指引（`get_context.py --mode phase --step X.X`）
- 平台差异通过 `[平台列表]` 标记在同一份 workflow.md 内表达
- 命令瘦身：有 hook 平台只保留 `finish-work`；无 hook 平台保留 `start + finish-work`

## 范围

仅限于以下文件：

- `packages/cli/src/templates/trellis/workflow.md` — 模板源
- `.trellis/workflow.md` — 项目自用（跟模板源同步）
- `packages/cli/src/templates/common/commands/start.md`
- `packages/cli/src/templates/common/commands/finish-work.md`
- `packages/cli/src/templates/common/commands/continue.md`（新增）
- `packages/cli/src/templates/shared-hooks/session-start.py`
- `.trellis/scripts/get_context.py` — 新增 `--mode phase`
- `packages/cli/src/configurators/` — 平台配置是否需要调整（按命令变化传导）
- 测试：`test/templates/*.test.ts`、`test/configurators/*.test.ts`

## 前置信息

### 已完成（复用）

- `workflow-draft.md`（393 行）已写好 Phase 1/2/3 结构、平台标记语法、routing 表、反合理化表
- 注意：draft 里的平台标记基于旧状态，**需要按下述真实分类重写**
- 5 个 skill 模板：brainstorm / before-dev / check / break-loop / update-spec

### 平台分类（真实数据，iFlow 已删，共 13 个平台）

从 `src/types/ai-tools.ts` 的 `AI_TOOLS` registry 直接读出。两个正交维度：

| 维度 | `agentCapable=true` (10) | `agentCapable=false` (3) |
|:---:|---|---|
| **`hasHooks=true` (8)** | claude-code, cursor, kiro, gemini, qoder, codebuddy, copilot, droid | ——（无） |
| **`hasHooks=false` (5)** | opencode, codex | kilo, antigravity, windsurf |

关键推论：
- **"调 sub-agent 走 agent-capable 分支"**：10 个平台
- **"session-start 可自动注入 workflow 概要"**：8 个平台（hasHooks=true）
- **"需要生成 start 命令"**：5 个 hasHooks=false 平台（opencode/codex/kilo/antigravity/windsurf）
- 这两条规则**正交**：opencode/codex 虽然 agent-capable，但无 hook，仍需 start 命令

### 平台标记语法（已定稿）

```markdown
[Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid]
agent-capable 内容
[/Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid]

[Kilo, Antigravity, Windsurf]
agent-less 内容
[/Kilo, Antigravity, Windsurf]
```

**原则**：平台标记只按 `agentCapable` 维度区分。`hasHooks` 差异不在 workflow.md 表达，而在 configurator 层决定"生成哪些命令文件"。

---

## 执行清单

### Step 1 — 定稿 workflow.md [必做]

**动作**：核对并落地 workflow-draft.md

1. Diff `workflow-draft.md` 与当前 `.trellis/workflow.md`，确认 draft 覆盖所有必需内容
2. **核对 draft 里的平台标记**：所有 agent-capable 块应为 10 个平台（claude-code, cursor, opencode, codex, kiro, gemini, qoder, codebuddy, copilot, droid）。经 grep 验证 draft 已无 iFlow 残留。如发现旧残留再清理
3. 核对 routing 表、反合理化表是否完整
4. 把 draft 写入两处：
   - `packages/cli/src/templates/trellis/workflow.md`（目前有 1 处 iFlow 残留在第 42 行附近，需清理）
   - `.trellis/workflow.md`（目前有 1 处 iFlow 残留在第 42 行，需清理）

**完成标志**：两个文件 md5 一致；`grep -i iflow` 两处都无结果；平台标记块的平台列表跟 registry 的 `agentCapable=true` 完全一致。

---

### Step 2 — 实现 `get_context.py --mode phase` [必做]

**动作**：扩展 `.trellis/scripts/get_context.py`

**参数设计**：
- `--mode phase --step <X.X>` — 从 workflow.md 提取对应步骤
- `--mode phase --step <X.X> --platform <name>` — 过滤只保留包含该平台名的 `[...]` 块，或通用块（无标记块）
- 不加 `--step`：返回 Phase Index（用于概览）

**提取规则**：
- `--step 1.1`：匹配 `^#### 1\.1 ` 到下一个 `^#### ` 之间
- `--platform cursor`：保留不在任何 `[...]` 块内的行 + 保留 `[...]` 块标题包含 `Cursor` 的块；丢弃不包含的块

**完成标志**：
- CLI 示例：`python3 ./.trellis/scripts/get_context.py --mode phase --step 1.1 --platform cursor` 输出正确
- 单元测试覆盖：步骤提取、平台过滤、无标记块保留、不存在的 step 返回错误

---

### Step 3 — 新建 `continue.md` 命令模板 [必做]

**动作**：创建 `packages/cli/src/templates/common/commands/continue.md`

**内容骨架**：
```markdown
# Continue Current Task

调用 `get_context.py` 获取当前 phase 索引：
\`\`\`
python3 ./.trellis/scripts/get_context.py --mode phase
\`\`\`

判断当前处于哪个 phase（参考 `.trellis/workflow.md` 的 Phase Index），
然后用 `--step X.X --platform {{PLATFORM}}` 加载具体步骤详情。

详细流程见 `.trellis/workflow.md`。
```

**要点**：
- 不把 workflow 内容复制进来（避免双源）
- 只当"索引 + 入口"
- 用 placeholder `{{PLATFORM}}` 让 configurator 注入平台名

**完成标志**：模板存在，配合 configurator 能为每个平台生成正确的 continue 命令文件。

---

### Step 4 — 调整 `start.md` 命令模板 [必做]

**动作**：改写 `packages/cli/src/templates/common/commands/start.md`

**目标**：
- **3 个 `agentCapable=false` 平台**（kilo, antigravity, windsurf）生成此命令：提示读 workflow.md、加载当前 task 状态、调用 `get_context.py --mode phase`
- **10 个 `agentCapable=true` 平台**：不生成此命令文件（都有 session-start 机制——9 个 Python hook + 1 个 OpenCode JS plugin——会自动注入 workflow 概要）

**判据说明**：
- `agentCapable` 恰好等价于"有 session-start 机制"（10 个 vs 3 个）
- 不用 `hasHooks`：其语义当前混乱（codex 标 false 但有 session-start.py；opencode 标 false 但有 plugin）。本 step 用 `agentCapable` 清晰简单
- `hasHooks` 字段的真实可靠性由 subtask `04-17-subagent-hook-reliability-audit` 实测后校正

**关键设计**：
- 模板只需写一份（通用内容），agent-capable / agent-less 差异用现有 `{{#AGENT_CAPABLE}}` 条件块
- configurator 层通过 `tool.templateContext.agentCapable` 决定是否生成 start 文件

**完成标志**：
- 10 个 agentCapable=true 平台的产出目录不再有 start 命令
- 3 个 agentCapable=false 平台产出的 start 命令内容简洁（指向 workflow.md）
- 新增/调整测试覆盖这 13 个平台的 start 生成/跳过

---

### Step 5 — 调整 `finish-work.md` 命令模板 [必做]

**动作**：精简 `packages/cli/src/templates/common/commands/finish-work.md`

**目标内容**：
- 记录 session（调用 `add_session.py`）
- 提醒归档 task / 提交代码
- 不再承担 record-session 的详细采集逻辑（已合并进 skill）

**完成标志**：`finish-work.md` ≤ 30 行，只做收尾动作。

---

### Step 6 — 更新 `session-start.py` hook [必做]

**动作**：改写 `packages/cli/src/templates/shared-hooks/session-start.py`（Python hook，9 个平台共用）和 `packages/cli/src/templates/opencode/plugins/session-start.js`（OpenCode JS plugin）

**目标**：
- 10 个 agentCapable 平台的 session 启动时注入**简短 workflow 概要**（Phase Index + routing 表），而不是 start.md 全文
- 核心信息来源：`get_context.py --mode phase`（不带 step）
- Python 版本和 JS 版本输出内容保持一致

**完成标志**：hook 输出简洁，能引导 AI 调用 `get_context.py --mode phase --step X.X` 加载详情。

---

### Step 7 — Configurator 传导 [必做]

**动作**：检查并调整 `packages/cli/src/configurators/`

**检查点**：
- 所有 13 个平台的 configurator 是否引用 `continue.md` / `finish-work.md`（两者对所有平台都生成）
- `agentCapable=true` 的 10 个平台的 configurator 是否跳过 `start.md`
- 统一通过 `tool.templateContext.agentCapable` 判断，不要硬编码 if/else 列平台名
- registry **不增删平台条目，也不加新字段**（`agentCapable` 已存在）

**完成标志**：`pnpm build` + `pnpm test` 通过；对每个平台跑一次 `init` 到 /tmp 能看到正确的命令列表。

---

### Step 8 — 测试更新 [必做]

**动作**：

- `test/templates/extract.test.ts` — 新增 continue.md 的路径和 reader
- `test/templates/common.test.ts`（如存在）— 验证 continue.md 内容
- `test/configurators/*.test.ts` — 对每个平台核对生成的命令列表（有 hook 不含 start，无 hook 包含）
- `test/scripts/get_context.test.ts`（或 python 测试）— `--mode phase` 的各种参数组合
- 如有回归测试套件，跑一遍确认没破坏现有逻辑

**完成标志**：`pnpm test` 全绿，新增 ≥ 10 个测试。

---

### Step 9 — Spec 更新 [必做·一次]

**动作**：更新 `.trellis/spec/cli/` 下的 platform-integration.md（如存在）

**要点**：
- 记录"有 hook / 无 hook 平台"的差异化命令输出
- 记录 `get_context.py --mode phase` 的契约
- 记录平台标记语法和平台分类

---

## 完成标志（整体）

- [x] 两处 workflow.md 同步且平台标记完整
- [x] `get_context.py --mode phase` 支持 `--step` 和 `--platform`
- [x] `continue.md` 新增
- [x] `start.md` 只在 agentCapable=false 平台（kilo/antigravity/windsurf）生成
- [x] `finish-work.md` 精简（32 行）
- [x] `session-start.py` + `session-start.js` 注入 workflow 概要（TOC + Phase Index）
- [x] 所有平台的 configurator 行为正确（通过 `ctx.agentCapable` 过滤）
- [x] `pnpm test` 全绿（527/527）
- [x] spec 更新（`.trellis/spec/cli/backend/platform-integration.md`）

---

## 非目标

- **不扩张 workflow 生命周期**：不新增 phase（如 "Phase 0: Setup"、"Phase 4: Release"），只重构现有 Phase 1/2/3 的表达
- **不新增 skill**：只用现有 5 个 skill（brainstorm/before-dev/check/break-loop/update-spec）
- **不改 `.trellis/scripts/task.py`**：task 生命周期管理保持现状，本 task 只扩 `get_context.py`
- **不增删 registry 平台条目**：`AI_TOOLS` 13 个平台保持不变；也不给 registry 加新字段（`hasHooks` / `agentCapable` 已存在，直接用）
- **不更新文档站点**（docs-site）——另起 task
