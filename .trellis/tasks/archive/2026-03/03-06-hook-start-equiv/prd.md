# Hook 注入后 AI 主动执行 start 流程

## Goal

让 SessionStart hook 注入上下文后，AI 的行为与用户手动执行 `/trellis:start` 等效——主动汇报上下文、询问用户要做什么、按任务分类走完整流程。

## Background

当前 hook 会把 workflow.md、spec indexes、get_context.py 输出和 start.md 全部注入 context，但 `<ready>` 标签告诉 AI "等用户消息"，导致 AI 被动等待而不是主动执行 start 流程。用户反馈显示 hook 注入后 AI 经常跳过任务创建、PRD 等步骤直接写代码。

### 外部反馈（用户 js，2026-03-06）

问题已被外部用户定位：

1. **`start.md` 模板指令强度不够** — Simple Task 流程是说明性文字，不是强制可执行入口
   - "Quick confirm → Task Workflow" 只是文字说明，没有绑定可执行的后续流程
   - Step 2-9 仍然是说明书式描述，不是强制连续执行的脚本或单一入口
   - `start.md:103` 的 "Ready to proceed?" 是天然停止点，很多模型在创建 task 后就停了

2. **对比 `plan.md` 的稳定性** — `plan.md:150` 明确负责 init-context、research、写 prd.md、更新 task.json
   - 但 `start.md` 没有把简单任务直接收口到 `plan.py` 或 plan agent
   - `start.md` 只是"让 AI 自己照着说明继续做"，容易停在 "task 已创建" 就不往下走

3. **iFlow 平台适配层错误** — `plan/start` 后台 agent 对 iFlow 有至少 4 个错误假设（CLI 命令、非交互环境变量、cli_name、supports_cli_agents），导致 agent 根本跑不起来

## Root Cause（两层问题）

### 问题 A: Session 内模型中途停住

`start.md` 的 Simple Task 流程是描述性文字，模型执行完 "创建 task + 写 PRD" 后把 "Ready to proceed?" 当终点。

**Hook 无法解决此问题**：`session-start.py` 在 session 开头已经跑过；`inject-subagent-context.py` 需要模型调用 Task/Agent 才触发，但模型还没走到那步。

### 问题 B: Session 恢复不知道继续做什么

新 session 开始时，如果有半配置的 task（已创建但未 init-context/start），模型不知道该继续哪一步。

**Hook 可以解决此问题**：`session-start.py` 检查 task 状态，注入 ready/not ready 标签。

## Requirements

### R1: `start.md` 强化指令（解决问题 A）

去掉 Simple Task 的 "Ready to proceed?" 停止点，改为确认后强制连续执行。

**方案选择**（二选一）：

**方案 1（推荐）: 直接收口到 plan agent**

```markdown
## Simple Task

1. Quick confirm: "I understand you want to [goal]. Shall I proceed?"
2. Create task: `TASK_DIR=$(python3 ./.trellis/scripts/task.py create "<title>" --slug <name>)`
3. Write PRD in task directory
4. **Immediately** call plan agent or execute Phase 2-3 steps — do NOT stop here
```

好处：plan agent 有明确的步骤和强制执行逻辑，不会半途而废。

**方案 2: 把 Step 2-9 写成硬性规则**

将 "after confirmation must execute Step 2 to Step 9" 从说明性文字改为硬性约束：

```markdown
**CRITICAL: After user confirms, you MUST execute ALL steps below without stopping.**
**Do NOT ask for additional confirmation between steps.**
```

### R2: `session-start.py` 加 task 状态标签（解决问题 B）

在 session-start hook 中检查当前 task 状态，注入结构化标签：

```python
# 检查 .current-task 和 task 目录状态
# 注入类似：
# <task-status>
# Status: NOT READY
# Task: 03-06-update-skip-dirs
# Missing: implement.jsonl not configured, task not started
# Next: Complete Phase 2 (research → init-context → start) before implementing
# </task-status>
```

状态判断逻辑：

| 条件 | 标签 | 指引 |
|------|------|------|
| 无 .current-task | `NO ACTIVE TASK` | 正常走 start 流程 |
| 有 task 但无 jsonl | `NOT READY` | 需要完成 Phase 2（research → init-context → start） |
| 有 task 且已 start | `READY` | 可以直接 implement/check |
| task status=completed | `COMPLETED` | 提示用户 archive 或开始新任务 |

### R3: `<ready>` 标签改为主动指令

```python
# 从：
"Context loaded. Wait for user's first message, then follow <instructions>."

# 改为：
"Context loaded. Report current state summary, then ask: What would you like to work on?"
```

## Acceptance Criteria

- [ ] Hook 注入后 AI 主动汇报当前上下文（分支、任务、工作区状态）
- [ ] Hook 注入后 AI 主动询问 "What would you like to work on?"
- [ ] Simple Task 确认后 AI 连续执行 Phase 1-3，不在 task 创建后停住
- [ ] Session 恢复时 AI 能识别 task 状态并继续对应步骤
- [ ] 手动 `/trellis:start` 行为不受影响（向后兼容）
- [ ] Claude Code 和 iFlow 两个平台同步更新

## Technical Notes

### Files to Modify

| 文件 | 改动 | 对应需求 |
|------|------|---------|
| `src/templates/claude/commands/trellis/start.md` | 强化 Simple Task 指令 | R1 |
| `src/templates/claude/hooks/session-start.py` | 加 task 状态检查 + 改 ready 标签 | R2, R3 |
| `src/templates/iflow/commands/trellis/start.md` | 同步修改 | R1 |
| `src/templates/iflow/hooks/session-start.py` | 同步修改 | R2, R3 |

### Key Insight

两个改动缺一不可：

- **只改 hook**（R2）→ 解决 session 恢复，但 session 内仍会中途停住
- **只改 start.md**（R1）→ 解决 session 内执行，但恢复时不知道接着做什么
- **两个都改** → 完整解决

### iFlow 适配层问题（独立 issue）

`cli_adapter.py` 对 iFlow 的 4 个错误假设（CLI 命令、IFLOW_NON_INTERACTIVE 环境变量、cli_name、supports_cli_agents）是独立问题，不在此 task 范围内，需要单独处理。
