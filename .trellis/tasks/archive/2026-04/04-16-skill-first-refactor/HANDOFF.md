# Session Handoff — Skill-First 重构 / v0.5.0-beta

**日期**：2026-04-17
**分支**：`feat/v0.5.0-beta`
**当前任务**：`.trellis/tasks/04-16-skill-first-refactor`（父）
**最新 commit**：`efccf6f` — feat: add hooks + agents for 7 platforms, remove iFlow/multi-agent/Ralph Loop（136 files, +2321 / -16256）

---

## 一、Trellis 项目快速背景

Trellis 是一个 AI 辅助开发的工作流框架。支持 13 个 AI coding 平台（Claude Code / Cursor / OpenCode / Codex / Kilo / Kiro / Gemini / Antigravity / Windsurf / Qoder / CodeBuddy / Copilot / Droid），通过 hooks + sub-agents + skills 让 AI 遵守编码规范。

### 核心机制

- **Spec 系统**：项目编码规范持久化到 `.trellis/spec/`，AI 通过 skill 或 hook 读取
- **Task 系统**：每个开发任务一个目录，存放 `prd.md` / `task.json` / `implement.jsonl` / `check.jsonl`
- **Workspace 系统**：跨 session 的开发者 journal
- **Hook 系统**：hook 自动注入上下文
- **Skill 系统**：按 description 语义匹配自动加载

### 架构术语速查

| 概念 | 说明 |
|------|------|
| 主 AI | 用户对话中的 AI（Claude Code / Cursor 等主窗口） |
| sub-agent | 主 AI 通过 Task tool spawn 的独立 context agent（implement/check/research） |
| skill | 自动触发的指令集，运行在主 AI 对话流（不独立 spawn） |
| Hook | 平台触发的 shell 命令，自动注入上下文（SessionStart / PreToolUse） |
| JSONL | task 内的 context 配置文件（`implement.jsonl` / `check.jsonl`） |

---

## 二、本 session 已完成工作

### 1. 模板引擎 + 统一架构
- ✅ Placeholder 引擎（`{{CMD_REF}}` / `{{#AGENT_CAPABLE}}` 条件块）
- ✅ Common 模板目录（**3 commands + 5 skills**，单一源）
  - commands: `start` / `finish-work` / `continue`
  - skills: `before-dev` / `brainstorm` / `check` / `break-loop` / `update-spec`
- ✅ `template-utils.ts` + `createTemplateReader()` 工厂消除重复
- ✅ `shared.ts` 的 `writeSkills/writeAgents/writeSharedHooks` helper

### 2. 共享 Hook 脚本（`templates/shared-hooks/`）
- ✅ `inject-subagent-context.py` 平台无关
  - `_parse_hook_input()` 支持 6 种 input 格式（Task/Agent/task 小写/toolName/agent_name）
  - `_build_hook_output()` 多格式 JSON（Claude + Cursor + Gemini 三合一）
  - 只读 `.trellis/` 路径的 JSONL，**去掉所有 hardcoded fallback**
  - 只认 3 个 agent：`implement` / `check` / `research`
- ✅ `session-start.py` 多平台 env var 检测
- ✅ `statusline.py` 共享

### 3. 7 个新平台成为 agent-capable
- ✅ Qoder / CodeBuddy / Droid：settings.json + agents/*.md（Claude-like）
- ✅ Cursor：hooks.json（camelCase）+ agents/*.md
- ✅ Gemini CLI：settings.json（BeforeTool regex）+ agents/*.md
- ✅ Kiro：agents/*.json（hooks 嵌入 agent 内）
- ✅ Copilot：agents/*.agent.md（注意：hooks.json 还缺 preToolUse，见待做）

### 4. 大规模清理
- ✅ 移除 iFlow 平台
- ✅ 移除 debug / plan / dispatch agent
- ✅ 移除 Ralph Loop（SubagentStop 机制）
- ✅ 移除 parallel skill + multi_agent pipeline + worktree.yaml + phase.py + registry.py + worktree.py
- ✅ 移除 shell-archive 目录
- ✅ 移除所有 stale 引用（iFlow / spec.jsonl / research.jsonl / check-cross-layer）

### 5. SessionStart Next-Action 强化
5 个状态的 `<task-status>` 都明确点名下一步动作：
- `NO ACTIVE TASK` → 用户说需求后 load `trellis-brainstorm` + `task.py create`
- `STALE POINTER` → `task.py finish` 清理
- `COMPLETED` → load `trellis-update-spec` + archive
- `PLANNING` → load `trellis-brainstorm` 产出 prd.md
- `READY` → load `trellis-before-dev` + spawn `implement` / `check`

### 6. Spec 文档更新
- ✅ `platform-integration.md` 反映 13 平台架构
- ✅ `directory-structure.md` 更新目录树
- ✅ `script-conventions.md` 移除 multi_agent 引用

---

## 三、5 个 Active 子 Task（优先级已调整）

### 🔴 Task A: `04-17-subagent-injection-per-platform` — P1

**目标**：让全部 9 个 sub-agent 平台的 context 注入都能真正工作。

**4 个子目标**：

1. **Codex（P1）**：改 `templates/codex/agents/{implement,check}.toml` 的 `developer_instructions`，在开头加一段"pre-work context loading"（读 `.trellis/.current-task` → 读 JSONL → 逐个读文件 → 再开始干活）。✅ 接受"best-effort"（fresh sub-agent context 开头遵守率高，不加 pre-spawn prelude）

2. **Copilot（P1）**：改 `templates/copilot/hooks.json`，在现有 `sessionStart` 旁边加 `preToolUse`。Copilot 的 hooks.json 特点：
   - 事件名 camelCase（不是 PascalCase）
   - **无 matcher 字段**，所有工具调用都触发，需要 Python 脚本内判断 `toolName`
   - bash / powershell 双字段
   - shared-hooks 的 `_parse_hook_input()` 已经兼容

3. **OpenCode（P2）**：对照 shared Python 版检查 `opencode/plugins/inject-subagent-context.js`：
   - 清理对 research.jsonl / spec.jsonl 的 fallback（已删）
   - agent list 对齐（只有 implement/check/research）
   - 关键：OpenCode 的 JS 插件用 `tool.execute.before`，必须**原地修改 `args.prompt`**（而不是 return 新对象）

4. **Kiro（P2）**：真实环境验证 agentSpawn hook 的输出协议。调研方式：加 `sys.stderr.write` 打印 input，真实 Kiro 里 spawn 一个 agent 看注入是否生效。

### 🟡 Task B: `04-16-rewrite-workflow-full` — P2

**目标**：workflow.md 正式落盘 + 配套消费机制。

**已恢复的素材**：
- `04-16-rewrite-workflow-full/workflow-draft.md`（420 行，从 session transcript 恢复的最终版）
- 已清理过时的平台标签（iFlow 移除 / Ralph Loop 移除 / 平台分类更新）

**5 件事**：

1. **workflow.md 重写**：基于 draft 落盘到 `templates/trellis/workflow.md`，用**内联平台标记**实现多平台单一文件：
   ```
   [Claude Code, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid]
   Sub-agent 平台流程
   [/Claude Code, ...]

   [Kilo, Antigravity, Windsurf]
   Agent-less 流程
   [/Kilo, Antigravity, Windsurf]
   ```
2. **实现 `get_context.py --mode phase --step X.X --platform xxx`**：按 Phase/Step 切片 + 按平台过滤 `[...]` 块
3. **session-start.py 改为注入 workflow 概要**（当前注入全文，太大；改为注入 Phase Index，详情让 AI 调 `get_context.py`）
4. **/continue 命令完善**：基于新 workflow.md 更新，让 AI 读 `.current-task` + `task.json` 判断 Phase/Step，调 `get_context.py` 加载指引
5. **start.md / finish-work.md 对齐**：有 hook 的平台 start.md 精简（SessionStart 自动注入），无 hook 平台保留完整流程

**关键设计：Phase 1.5 填 JSONL 的触发点**

基于 Codex cross-review 决策：
- task.py create：只写骨架（目录 + task.json + 空 jsonl）
- brainstorm skill：产出 prd.md
- **brainstorm skill 结尾触发填 JSONL**（独立 phase，由主 AI 根据 prd.md 判断填哪些 spec / research 产出）
- Phase 2 Execute：spawn sub-agent

**JSONL 填什么**（在 skill 指引里写死）：
- ✅ spec 文件 / research 产出 / workflow 指引 / 跨层约束
- ❌ 代码文件（.ts/.py）/ prd.md / info.md / 大而全的 spec 顶层索引

### 🟡 Task C: `04-17-hook-path-robustness` — P2（原 P3 提升）

**提升原因**：Codex cross-review 指出这是真实故障，本 session 就遇到多次。

**最小修复**：保证 hook 在 CWD 漂移时（子目录、submodule）仍能启动。

**候选方案**（需要调研后选择）：
- 选项 1：shell 向上查找 `.trellis/` 目录
- 选项 2：Python bootstrap wrapper
- 选项 3：平台 env var 优先 + fallback
- 选项 4：统一到 `.trellis/hooks/`（脱离平台 config 目录）

**已失败方案**：`${CLAUDE_PROJECT_DIR:-.}`（Windows 不兼容）、`git rev-parse --show-toplevel`（submodule 错）。

完整跨平台（Windows / 所有场景）留 P3。

### 🟡 Task D: `04-17-update-cleanup-deleted-templates` — P1 最小集 / P3 完整

**最小集（P1，发布门禁）**：清理**会改变行为**的旧文件：
- 旧 agent：`dispatch.md` / `debug.md` / `plan.md` / `trellis-plan.md`（各平台）
- 旧 hook：`ralph-loop.py`（各平台）
- 旧 command：`parallel.md` / `check-cross-layer.md` / `record-session.md` / `onboard.md` / `create-command.md` / `integrate-skill.md`
- Trellis 内部：`.trellis/scripts/multi_agent/` / `worktree.yaml`
- iFlow：`.iflow/` 整个目录

**实现方向**：扩展 migration manifest 加 `deletions` / `path-glob` 字段，带 hash 保护（用户改过的文件不删，警告跳过）。0.5.0 manifest 列出具体条目。

完整清理（cosmetic / 全清单）留 P3。

### 🟢 Task E: `04-17-claude-hooks-migrate-to-shared` — P3

**原因**：Claude Code 平台还在用自己的 1831 行旧 hook（`templates/claude/hooks/`），其它 7 个新平台都用 `shared-hooks/`。两份在分歧。

**迁移**：改 `configureClaude()` 的 `copyDirFiltered` 排除 `hooks/` → 调 `writeSharedHooks()` → 删 `templates/claude/hooks/` 目录。

---

## 四、Codex Cross-Review 结果（2026-04-17）

**模型**：gpt-5.3-codex (high reasoning)
**6 个 findings，处置**：

| # | Level | Issue | 处置 |
|---|-------|-------|------|
| 1 | CRITICAL | Phase 1.5 与 task.py create 双轨风险 | ✅ 采纳 — 改为独立 phase，brainstorm skill 结尾触发填 JSONL |
| 2 | CRITICAL | Hook 路径漂移应提 P1 | ✅ 降 P2 采纳 — 最小修复提升优先级 |
| 3 | WARNING | JSONL 缺可执行校验 | ⏸️ 不做 — 靠 skill 文字指导 + AI 自律 |
| 4 | WARNING | Codex TOML 自读不可靠（应加 pre-spawn prelude） | ❌ 不采纳 — fresh sub-agent 遵守率足够 |
| 5 | WARNING | debug agent 删除没迁移 debug.jsonl | ❌ 不采纳 — 用户自行处理 |
| 6 | WARNING | 升级清理应提到发布门禁 | ✅ 采纳 — 最小集提 P1，完整留 P3 |

---

## 五、关键文件速查

### 新增/修改的核心文件

```
packages/cli/src/
├── configurators/
│   ├── shared.ts                    ← resolvePlaceholders + writeSkills/writeAgents/writeSharedHooks
│   ├── index.ts                     ← PLATFORM_FUNCTIONS + collectSharedHooks helper
│   ├── qoder.ts / codebuddy.ts / droid.ts / cursor.ts / gemini.ts / kiro.ts / copilot.ts
│   └── claude.ts                    ← 未迁移到 shared-hooks（P3 task）
├── templates/
│   ├── shared-hooks/                ← 新增：平台无关 Python hook
│   │   ├── inject-subagent-context.py (~700 行)
│   │   ├── session-start.py
│   │   ├── statusline.py
│   │   └── index.ts
│   ├── template-utils.ts            ← createTemplateReader 工厂
│   ├── common/                      ← 3 commands + 5 skills
│   │   ├── commands/{start,finish-work,continue}.md
│   │   └── skills/{before-dev,brainstorm,check,break-loop,update-spec}.md
│   ├── qoder/ codebuddy/ droid/ cursor/ gemini/ kiro/ + 对应 agents/*
│   ├── claude/hooks/                ← 旧版 1831 行（待迁移到 shared-hooks）
│   ├── codex/agents/                ← TOML，待加 pre-work 指令
│   └── copilot/hooks.json           ← 待加 preToolUse
└── types/ai-tools.ts                ← AI_TOOLS registry（13 平台）
```

### 任务目录

```
.trellis/tasks/
├── 04-16-skill-first-refactor/           ← 父 task（当前）
│   ├── prd.md                             ← 详细待做清单 + Codex review
│   ├── HANDOFF.md                         ← 本文件
│   └── task.json
├── 04-16-rewrite-workflow-full/           ← 🟡 P2 — workflow.md 重写
│   ├── prd.md
│   └── workflow-draft.md                  ← 420 行最终版（transcript 恢复）
├── 04-17-subagent-injection-per-platform/ ← 🔴 P1 — Codex/Copilot/OpenCode/Kiro 注入
│   └── prd.md (~200 行详细说明)
├── 04-17-claude-hooks-migrate-to-shared/  ← 🟢 P3 — Claude 迁移共享 hook
│   └── prd.md
├── 04-17-hook-path-robustness/            ← 🟡 P2（已升）— CWD 漂移修复
│   └── prd.md
└── 04-17-update-cleanup-deleted-templates/← 🔴 P1 最小集 / 🟢 P3 完整
    └── prd.md
```

---

## 六、下个 session 开工建议

### 顺序

1. **并行做 P1 的 3 个 task**（可独立）：
   - `04-17-subagent-injection-per-platform` —— 具体到 Codex + Copilot 这两条（OpenCode + Kiro 可晚一点）
   - `04-17-update-cleanup-deleted-templates` —— 做最小集部分
   - `04-16-rewrite-workflow-full` —— workflow.md 落盘 + Phase 1.5 设计 + `get_context.py --mode phase`

2. **然后 P2**：
   - `04-17-hook-path-robustness` 最小修复
   - `04-16-rewrite-workflow-full` 剩余（/continue / session-start 重构）

3. **最后 P3**（v0.5.0 stable 前）：
   - `04-17-claude-hooks-migrate-to-shared`
   - 上述 3 个 task 的"完整版"部分

### 验收标准

**v0.5.0-beta 可发布的最小门槛**（合并 P1 结果后）：
- ✅ 9 个 sub-agent 平台的 context 注入都能正常工作（Codex / Copilot 是 P1）
- ✅ workflow.md 是新版，反映 Phase 1/2/3 + Phase 1.5 填 JSONL
- ✅ 升级老项目不会留 stale 废弃文件（最小集清理）
- ✅ hook 不会因为 CWD 漂移失效（最小修复）

---

## 七、已知限制 / 技术债

1. **Claude 用旧 hooks**：行为和其它 9 个平台不完全一致（虽然 Claude 用户最多），等 Task E
2. **OpenCode 只有 JS 插件版**：无法走 Python shared-hooks（Bun 插件系统）
3. **Codex hooks 默认关闭**：`codex_hooks = true` 是实验性，sub-agent 注入走 TOML 指令方案
4. **Kiro agentSpawn 协议未验证**：理论上能工作，实际效果待实测
5. **Windows 兼容**：hook 路径、shell 语法未全部测试

---

## 八、一些决策说明

### 为什么删 Ralph Loop
跨平台不可移植（只 Claude Code 和 iFlow 真正支持 SubagentStop + exit 2 block）。check agent 的修复循环靠 agent 自己的工作流保证。

### 为什么删 multi_agent pipeline
各 CLI / IDE 内置 worktree 支持，不需要 Trellis 自己造。

### 为什么 Phase 1.5 不用 init-context 脚本
init-context 是旧版 "一键填预设模板" 的思路，但每个 task 真正相关的 spec 不同，预设填不对。改为由 AI 在 brainstorm 后根据 prd.md 判断填什么。

### 为什么 JSONL 不加机器校验
（Codex review #3 不采纳）规则比较模糊（"代码文件" 的边界——generated 文件算不算？），机器强制校验反而可能误伤。靠 skill 指引 + AI 理解足够，出错时用户能看得出来。

### 为什么 Codex 走 "best-effort"
（Codex review #4 不采纳）Codex sub-agent 是 fresh context，TOML 指令在系统级 prompt 开头，遵守率高，不需要 pre-spawn prelude 这种强制机制。

---

## 九、测试状态

- 21 test files / 527 tests passed
- TypeCheck clean
- Lint clean
- 已 commit：`efccf6f`

---

## 十、如需查阅更多细节

- **各子 task 详细 PRD**：`.trellis/tasks/04-17-*/prd.md`
- **workflow.md draft**：`.trellis/tasks/04-16-rewrite-workflow-full/workflow-draft.md`（420 行）
- **Trellis spec**：`.trellis/spec/cli/backend/platform-integration.md`（已更新反映新架构）
- **上 session transcript**：`~/.claude/projects/-Users-taosu-.../06eed46c-48c9-45ed-bdf0-4fbcc619decb.jsonl`（本 session）
