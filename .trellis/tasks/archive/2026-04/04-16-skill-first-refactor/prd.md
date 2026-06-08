# Skill-First 重构 + v0.5.0-beta 架构收敛

## 目标

将 Trellis 重构为 **skill-first + 共享 hooks** 架构，降低用户心智负担，提升 AI 自主遵守工作流的能力。同时砍掉已死或跨平台不可移植的特性，让核心流程更稳。

---

## 已完成（本次 session）

### 1. 模板引擎 + 统一架构
- [x] Placeholder 引擎（`{{CMD_REF:x}}`、`{{#AGENT_CAPABLE}}` 条件块）
- [x] Common 模板目录（3 commands + 5 skills，单一源）
  - commands: `start` / `finish-work` / `continue`
  - skills: `before-dev` / `brainstorm` / `check` / `break-loop` / `update-spec`
- [x] 所有平台从 common/ 读取 + resolve + wrap
- [x] `template-utils.ts` + `createTemplateReader()` 工厂消除 6 个模板 index.ts 的重复
- [x] `shared.ts` 的 `writeSkills/writeAgents/writeSharedHooks` 辅助函数

### 2. 共享 Hook 脚本（`shared-hooks/`）
- [x] `inject-subagent-context.py` 平台无关（多平台 input 解析 + 多格式 output）
- [x] `session-start.py` 多平台 env var 检测
- [x] `statusline.py` 共享
- [x] Hook 只读 `.trellis/` 路径（JSONL），去掉所有 hardcoded command/skill fallback

### 3. 7 个新平台加入 agent-capable（Claude-like 格式）
- [x] Qoder / CodeBuddy / Droid：settings.json + agents/*.md
- [x] Cursor：hooks.json（camelCase）+ agents/*.md
- [x] Gemini CLI：settings.json（BeforeTool regex）+ agents/*.md
- [x] Kiro：agents/*.json（hooks 嵌入 agent 内）
- [x] Copilot：agents/*.agent.md

### 4. 大规模清理
- [x] 移除 iFlow 平台（CLI 已死）
- [x] 移除 debug / plan / dispatch agent（实际用不上）
- [x] 移除 Ralph Loop（SubagentStop 跨平台不可移植）
- [x] 移除 parallel skill + multi_agent pipeline + worktree.yaml
- [x] 移除 shell-archive 目录
- [x] 移除所有 stale 引用（iFlow / spec.jsonl / research.jsonl / check-cross-layer 等）
- [x] 命令/Skill 缩减为 5 skills + 3 commands

### 5. SessionStart Next-Action 强化
- [x] `<task-status>` 每个状态加上 `Next-Action:` 明确点名 skill / 命令 / sub-agent
- [x] 5 个状态覆盖：NO ACTIVE TASK / STALE POINTER / COMPLETED / PLANNING / READY

### 6. Spec 文档更新
- [x] `platform-integration.md` 反映 13-platform 架构
- [x] `directory-structure.md` 更新目录树
- [x] `script-conventions.md` 移除 multi_agent 引用

### 7. Workflow 重写 + Pull-based sub-agent context（commit `d2c6682`）
- [x] `workflow.md` 重写落盘，内联平台标记 `[Platform, ...]`
- [x] `get_context.py --mode phase [--step X.Y] [--platform <name>]` 实现
- [x] `start.md` / `continue.md` / `finish-work.md` 按平台分支重写
- [x] session-start hook 注入 Phase Index 概要（代替全文 workflow）
- [x] **Codex / Copilot / Gemini / Qoder 改为 pull-based prelude** —— sub-agent definition 顶部注入 `## Required: Load Trellis Context First`，由 sub-agent 自己 Read `.current-task` + prd + jsonl（替代原计划的 Codex TOML pre-work + Copilot preToolUse 方案）
- [x] `applyPullBasedPrelude{Markdown,Toml}` 在 configurator（init）+ collectPlatformTemplates（update hash 对比）两处生效，update 不回滚 prelude
- [x] Research agent 升级为 write-capable（所有平台），workflow step 1.2 要求持久化到 `{TASK_DIR}/research/`

---

## 待做

### 🔴 P1 — v0.5.0-beta 发布阻塞

#### Workflow Enforcement v2（强制状态机 + 每轮注入）

**背景**：当前工作流状态只在 session 开头注入一次，AI 长对话后会漂移。需改为 hook 每轮注入 + 显式状态机。

- [ ] `task.json` 加 `current_phase`（字符串）+ `phase_history` + `checkpoints`
- [ ] `task.py` 加 7 条命令：`create --type`（推断优先）+ `set-phase` / `next-phase` / `advance-phase` / `set-checkpoint` / `phase-history` / `check-consistency`
- [ ] 新 hook `inject-workflow-state.py` 响应 `UserPromptSubmit`，分 L1/L2/L3 三档面包屑
- [ ] 9 平台接 UserPromptSubmit hook + OpenCode plugin 等价
- [ ] 5 skills + continue/finish-work 加 `📍 Workflow State` 尾块
- [ ] Class-2 pull-based prelude 加 MANDATORY Step 0 `advance-phase`

**子 Task**：`04-17-workflow-enforcement-v2`（详细 ~680 行 PRD，已 Codex 两轮 review）

#### 升级清理最小集（Codex cross-review #6）

清理会**改变行为**的旧文件（放任会导致 0.4.x 升级后混合行为）：

- [ ] 旧 agent 文件：`dispatch.md` / `debug.md` / `plan.md` / `trellis-plan.md`
- [ ] 旧 hook 文件：`ralph-loop.py`
- [ ] 旧 command 文件：`parallel.md` / `check-cross-layer.md` / `record-session.md` / `onboard.md` / `create-command.md` / `integrate-skill.md`
- [ ] Trellis 内部：`.trellis/scripts/multi_agent/` / `worktree.yaml`
- [ ] iFlow 平台：`.iflow/` 整个目录

**子 Task**：`04-17-update-cleanup-deleted-templates`（最小集 P1 / 完整版 P3）

### 🟡 P2 — 重要

#### Sub-agent hook 可靠性实测

原计划测 5 平台，现 gemini / qoder 已改 pull-based，剩 cursor / codebuddy / droid（+ kiro agentSpawn 协议未验证）。

**子 Task**：`04-17-subagent-hook-reliability-audit` + `04-17-subagent-injection-per-platform`（Kiro 部分）

#### Hook 路径解析（Codex cross-review #2）

最小修复：让 hook 能在 CWD 不是项目根时也启动（monorepo 子目录、submodule）。

- [ ] 调研各平台 hook 实际 shell 和 CWD 行为
- [ ] 实现最小可用方案（向上查找 `.trellis/` / 平台 env var / Python bootstrap）
- [ ] 验证：CWD = 子目录 / CWD = submodule 内部

**子 Task**：`04-17-hook-path-robustness`

### 🟢 P3 — 技术债（非阻塞）

#### Claude 旧 hooks 迁移到 shared-hooks
- 删除 `templates/claude/hooks/` 约 1831 行旧代码
- 子 task `04-17-claude-hooks-migrate-to-shared`

#### Hook 路径完整跨平台
- Windows cmd / PowerShell 兼容
- 子 task `04-17-hook-path-robustness` 的完整版

#### `trellis update` 完整清理
- 所有 stale 模板（含 cosmetic 改动）
- 子 task `04-17-update-cleanup-deleted-templates` 的完整版

---

## Codex Cross-Review

**日期**：2026-04-17
**模型**：gpt-5.3-codex (reasoningEffort: high)
**结果**：6 findings，4 条采纳，2 条不采纳

| Level | 发现 | 处置 |
|-------|------|------|
| CRITICAL | Phase 1.5 JSONL 与 task.py create 双轨风险 | ✅ 采纳 — 改为独立 phase，create 写骨架 / brainstorm 后填 JSONL，由 brainstorm skill 结尾触发 |
| CRITICAL | Hook 路径漂移该提到 P1 | ✅ 采纳（降 P2）— 最小修复保证 hook 在 CWD 漂移时仍启动 |
| WARNING | JSONL 缺可执行校验 | ⏸️ 暂不做 — 靠 skill 文字指导 + AI 自律，不加 `task.py validate` |
| WARNING | Codex TOML 自读不可靠（应加 pre-spawn prelude） | ❌ 不采纳 — Codex sub-agent 是 fresh context，TOML 指令在系统级 prompt 开头遵守率高，接受 best-effort |
| WARNING | 删 debug agent 没迁移策略（debug.jsonl 孤立） | ❌ 不采纳 — 不需要自动迁移，让用户自行处理 |
| WARNING | 升级清理应提到发布门禁 | ✅ 采纳 — 最小集（会改变行为的文件）提到 P1，完整清理留 P3 |

---

## 子 Task 状态 + 实际工作量（2026-04-17 深度 research + FP 简化后）

| 子 Task | 优先级 | 工作量 | 状态 | 依据 |
|---------|-------|-------|------|------|
| `04-16-agents-hooks-test` | - | - | ✅ archived | — |
| `04-16-rewrite-workflow-full` | - | - | ✅ archived（`d2c6682`）| workflow.md + get_context 已落盘 |
| `04-17-cc-hook-inject-test` | - | - | ✅ archived | — |
| `04-17-pull-based-migration` | - | - | ✅ archived（`d2c6682`）| class-2 平台已迁 pull-based |
| `04-17-update-cleanup-deleted-templates` | 🔴 P1 | - | ✅ completed（`4476844`）| `0.5.0.json` 125 条 `safe-file-delete` 已落盘 |
| `04-17-claude-hooks-migrate-to-shared` | 🟡 P2 | - | ✅ completed（`4476844`）| 1435 行旧 hook 已删；configurator 改 3 行 |
| `04-17-workflow-enforcement-v2` | 🔴 P1 | **S-M** | planning | **FP 简化后**：仅新 `inject-workflow-state.py`（~90 行）+ 9 平台接 UserPromptSubmit + OpenCode JS 等价 + `task_store.py` 宽容 legacy。无 schema 改 / 无新命令 / 无 skill 尾块 / 无 class-2 prelude Step 0 |
| `04-17-hook-path-robustness` | 🟡 P2 → 🟢 P3 | - | 顺带解决 | 新 hook 用 `find_trellis_root()` 向上查找 `.trellis/`，CWD 漂移最小修复由 workflow-enforcement-v2 带走；完整跨平台（Windows）留 P3 |
| `04-17-subagent-injection-per-platform` | 🟡 P2 | **S** | 大部分完成 | 只剩 Kiro agentSpawn 真实环境验证 |
| `04-17-subagent-hook-reliability-audit` | 🟡 P2 | **M** | planning | cursor/codebuddy/droid 实测（gemini/qoder 已走 pull-based，无需测）|

### 建议执行顺序

**Sprint 1（完成）** ✅：
- ~~`update-cleanup-deleted-templates`~~（`4476844`）
- ~~`claude-hooks-migrate-to-shared`~~（`4476844`）

**Sprint 2（下一步）** 🔴：
- `workflow-enforcement-v2` — FP 简化后 S-M 工作量，1 个 session 可完成。顺带把 `hook-path-robustness` 最小修复（向上查找 `.trellis/`）带完

**可延到 v0.5.0-beta 发布后** 🟡：
- Kiro agentSpawn 真实环境验证（`subagent-injection-per-platform`）
- cursor/codebuddy/droid sub-agent hook 实测（`subagent-hook-reliability-audit`）

---

## 相关 commit

- `efccf6f` — feat: add hooks + agents for 7 platforms, remove iFlow/multi-agent/Ralph Loop
- `d2c6682` — feat: workflow rewrite + pull-based sub-agent context for class-2 platforms

## 分支

`feat/v0.5.0-beta`

---

## 决策记录

### 为什么删 Ralph Loop
跨平台不可移植（只 Claude Code 和 iFlow 真正支持 SubagentStop + exit 2 block），而且 check agent 的修复循环本身可以靠 agent 自己的工作流保证。

### 为什么删 multi_agent pipeline
各 CLI / IDE 现在都内置 worktree 支持（Claude Code、Cursor 都有），不需要 Trellis 自己造。

### 为什么保留 init-context 的 `task.py add-context` 命令
虽然不再是 workflow 里的独立步骤，但 sub-agent 平台需要填充 JSONL，这个命令还是填 JSONL 的标准工具。主 AI 根据 prd.md 决定填什么。

### 为什么 Codex / Copilot / Gemini / Qoder 走 pull-based
这些 class-2 平台的 hook 都**不能可靠修改 sub-agent prompt**：
- Qoder：没有 Task tool，SubagentStart 没 prompt 字段，Context Isolation
- Codex：PreToolUse 只对 Bash fire；CollabAgentSpawn 未实现
- Copilot：preToolUse 在 sub-agent 上不执行（#2392 / #2540）
- Gemini：BeforeTool 能用但 #18128 隐藏主 agent 上下文

改为 sub-agent definition 顶部注入 "Load Trellis Context First" prelude，sub-agent 启动后自己 Read `.current-task` + prd + jsonl。

### 为什么 OpenCode 不走 shared Python hooks
Bun 插件系统只支持 TS/JS，必须 JS 实现（现有 `opencode/plugins/inject-subagent-context.js` 已同功能）
