# Native API Verification — Task(subagent_type=trellis-research)

> 会话：cursor_c455f78d-08ae-4088-867b-95d837268052
> 日期：2026-06-23
> 执行者：主会话 agent（subagent 未成功派发）

## 前置条件

```text
Selected task: .trellis/tasks/06-23-subagent-smoke
Source: session:cursor_c455f78d-08ae-4088-867b-95d837268052
```

任务已在目标会话内 select，hook 的 selected_task 前置已满足。

## 验证结论（摘要）

| 问题 | 结论 |
|---|---|
| Task enum 是否接受 `trellis-research`？ | **❌ 否** — schema 层直接拒绝 |
| hook 是否注入？ | **❌ 未验证 / 推断为否** — subagent 未启动；且 enum 拒绝意味着 hook 的 `subagent_type in AGENTS_ALL` 守卫不会被 trellis-research 触发 |
| fallback 是否触发？ | **❌ 否** — subagent 未运行，无法执行 fallback 协议 |

## A. Task 工具调用结果

**调用**：`Task(subagent_type="trellis-research", prompt=<派发词原文>)`

**结果**：❌ **失败** — 工具 schema 在参数校验阶段拒绝，subagent 未启动。

**错误信息原文**：

```text
Error: Invalid arguments:
subagent_type: Invalid enum value. Expected 'generalPurpose' | 'explore' | 'shell' | 'cursor-guide' | 'ci-investigator' | 'bugbot' | 'security-review' | 'best-of-n-runner', received 'trellis-research'
```

**观察**：

- 当前 Cursor Task 工具 `subagent_type` enum 共 8 个内置值，**不含** `trellis-research` / `trellis-implement` / `trellis-check`。
- 与先前 verify.md 记录相比，enum 新增了 `cursor-guide`、`ci-investigator`、`bugbot`、`security-review`，但 **trellis-* 自定义 agent 仍未纳入**。
- `.cursor/agents/trellis-research.md` frontmatter 定义（`name: trellis-research`，tools 含 Read/Write/Glob/Grep/Bash/mcp__exa__*/Skill/mcp__chrome-devtools__*）对 Task 工具 enum **无影响** — slash 菜单 / agent 文件加载与 Task API enum 是两条独立路径。

## B. Subagent prompt 前 5 行（追问结果）

**无法追问** — subagent 未成功派发，不存在 subagent 视角的原始 prompt。

主会话 agent 传入的 prompt 前 5 行（供对照，非 subagent 实际收到）：

```text
---
Selected task: d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke
Repo root: d:\MyHarness\Trellis

研究目标：确认本会话的 Task 工具能否接受 trellis-research subagent_type，以及 hook 是否自动注入上下文。
```

**`<!-- trellis-hook-injected -->` 标记**：subagent 侧 **未见**（未运行）。

## C. Hook 注入链路推断

`inject-subagent-context.py` 在 `PreToolUse(Task|Subagent)` 时检查 `subagent_type in {trellis-implement, trellis-check, trellis-research}`。由于 Task 工具在 schema 层就拒绝了 `trellis-research`：

1. hook 要么根本不被以 trellis-research 类型触发；
2. 若退化为 `generalPurpose` 派发，hook 会 `sys.exit(0)` 跳过注入（守卫行为正确）。

**prd.md / implement.jsonl 自动注入**：本次 **未发生**。

## D. Fallback 协议

Fallback（从首行 `Selected task:` 自行加载 prd.md）需 subagent 实际运行。本次 subagent 未启动 → **fallback 未触发**。

## E. trellis-research.md frontmatter 参考（预期 vs 实际）

| 字段 | frontmatter 预期 | 实际 subagent 收到 |
|---|---|---|
| name | trellis-research | N/A（未派发） |
| tools | Read, Write, Glob, Grep, Bash, mcp__exa__*, Skill, mcp__chrome-devtools__* | N/A（未派发） |

## 建议后续

1. 若需验证 hook 注入行为：退化为 `generalPurpose` 派发并观察 fallback（已知 hook 不会注入）。
2. 若需验证 trellis-research 身份与 tools：通过 Cursor slash 菜单 `@trellis-research` 或 Agent 会话入口启动，而非 Task 工具 enum。
3. Trellis policy 文档假设 `Task(subagent_type=trellis-research)` 在本环境 **不成立**，需 Road B（BYOK / 替代派发路径）或等待 Cursor 扩展 Task enum。
