# Simple research smoke (08)

## Query

对任务 `06-23-subagent-smoke` 做最小只读调研：列出任务目录全部文件、摘要 prd.md 的 R1/R2/R3、确认 `Trellis/scripts/smoke_echo.py` 是否存在，并记录本次 subagent 派发路径与 hook 注入观察。

## Scope

- 只读：`d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\` 及 `d:\MyHarness\Trellis\scripts\`
- 写入：仅本文件（`research/08-simple-research-smoke.md`）
- 不修改代码、不 git

## Date

2026-06-24

## Findings

### 任务目录文件清单（22 项，绝对路径）

| # | 绝对路径 |
|---|----------|
| 1 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\prd.md` |
| 2 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\dispatch-prompts.md` |
| 3 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\byok-road-b-plan.md` |
| 4 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\verify.md` |
| 5 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\check.jsonl` |
| 6 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\implement.jsonl` |
| 7 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\task.json` |
| 8 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\01-hook-injection-mechanism.md` |
| 9 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\02-task-artifacts-inventory.md` |
| 10 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\03-prd-feasibility-check.md` |
| 11 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\05-cursor-custom-subagent-enum-research.md` |
| 12 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\06-cursor-subagent-enum-research-round2.md` |
| 13 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\07-enum-plugin-verification.md` |
| 14 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\native-api-verification.md` |
| 15 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\sm-exa-plugin.json` |
| 16 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\sm-exa-recent.json` |
| 17 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\sm-exa-round2.json` |
| 18 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\sm-exa-skills-cursor.json` |
| 19 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\sm-exa-version-bug.json` |
| 20 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\sm-research-final.json` |
| 21 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\sm-research-round2.json` |
| 22 | `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\sm-zhipu-round2.json` |

（本文件写入后，任务目录含 23 个文件，其中 `research/` 下 15 个。）

### prd.md — R1 / R2 / R3（5 条摘要）

1. **R1**：在 `Trellis/scripts/` 新增 `smoke_echo.py`，实现 `echo_msg(msg) -> "[smoke] <msg>"` 与 `__main__` CLI（单参数打印结果），不增依赖、不改其他文件。
2. **R2**：验证三种 Trellis subagent 可通过主会话 `Task(subagent_type=...)` 派发——research 能体现已读注入上下文；implement 在 `start-execution --approved` 后完成 R1 并自报改动清单；check 对 implement 改动做 spec 对齐检查。
3. **R3**：每个 subagent 首轮应体现收到 `<!-- trellis-hook-injected -->` 后的 prd/验收内容；若未注入则走 fallback（从 `Selected task:` 自行加载工件）并记录。
4. **验收**：`smoke_echo.py` 存在且 `python .../smoke_echo.py hello` 输出 `[smoke] hello`；三种 subagent 派发可见；至少一例明确读取注入上下文；`verify.md` 记录派发与 hook 结果。
5. **范围外**：不改 `packages/cli/`、不改 `.cursor/agents/` 与 hook 脚本、不发布/PR；不测 BYOK 模型路由。

### `smoke_echo.py` 存在性

- **Glob** `d:\MyHarness\Trellis\scripts\**\smoke_echo.py`：**0 匹配**
- **Glob** `d:\MyHarness\Trellis\**\smoke_echo.py`：**0 匹配**
- **结论**：`d:\MyHarness\Trellis\scripts\smoke_echo.py` **尚不存在**（R1.1 待 implement 完成）。同目录现有 Python 脚本为 `check_router_copy_sync.py`（见 `research/03-prd-feasibility-check.md`）。

### 派发路径与 hook 注入（本次运行）

- **角色声明**：用户 prompt 指定 acting as **trellis-research**；子代理系统说明为 `subagent under a parent agent`，可用 `subagent_type` 仅含 `generalPurpose | explore | shell | best-of-n-runner`（无 `trellis-research`）。
- **派发路径**：父会话很可能以 **`generalPurpose` fallback** 派发本 run（与 `dispatch-prompts.md` / `verify.md` 描述的 enum 退化一致）；本代理无法直接观测父会话 `Task()` 参数，依据为 Task 工具 enum 与历史 `verify.md` 记录。
- **Hook 注入标记**：本代理收到的 **user_query 全文未出现** `<!-- trellis-hook-injected -->`，也未出现 hook 注入的 prd/jsonl/spec 树块；仅含手写 `Selected task:`、`Repo root:` 与调研步骤。与 R3.2 fallback 分支一致：**应按 prompt 自行 Read 任务工件**（本报告已执行）。

## Caveats

- 文件清单以 2026-06-24 Glob 快照为准；写入本文件后 `research/` 计数 +1。
- `07-enum-plugin-verification.md` 记载另一会话中 plugin 路径曾成功 `Task(trellis-research)`，与本会话 Task enum 限制可能因 Cursor/插件版本或 workspace root 不同而不一致。
- 未运行 `python Trellis/scripts/smoke_echo.py`（文件不存在）；验收 CLI 需在 R1 落地后重测。