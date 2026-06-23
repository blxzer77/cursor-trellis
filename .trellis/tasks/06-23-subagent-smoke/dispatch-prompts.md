# Subagent 派发测试包 — 任务 `06-23-subagent-smoke`

> 用途：在**另一个 Cursor 会话**里，按下面顺序依次派发 `trellis-research` / `trellis-implement` / `trellis-check` 三个 subagent，验证 Trellis 的"自动以 subagent 发放"机制 + `inject-subagent-context.py` hook 的上下文注入。
>
> 任务路径：`d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke`
> 任务根（git repo）：`d:\MyHarness\Trellis`

---

## ⚠️ 派发前的硬前置（在目标会话里执行一次）

Trellis 的 `selected_task` 是**按会话持久化**的（`.trellis/.runtime/sessions/` 下按 `context_key` 分文件）。我无法从本会话替你那边的会话 select —— **目标会话必须自己执行一次 select**，否则 `preToolUse` hook 会 `sys.exit(0)` 不注入上下文，subagent 拿到空 prompt。

在**目标会话**的终端里跑：

```powershell
cd d:\MyHarness\Trellis
python ./.trellis/scripts/task.py select .trellis/tasks/06-23-subagent-smoke
python ./.trellis/scripts/task.py selected --source
```

预期输出第二行：`Selected task: .trellis/tasks/06-23-subagent-smoke`。

> 真实 Cursor 会话里，`beforeShellExecution` hook（`inject-shell-session-context.py`）会自动从 `conversation_id` 写 30 秒 ticket，让 `task.py select` 能拿到 session identity。**不要**用 `TRELLIS_CONTEXT_ID` 环境变量 override —— 那是我在普通 shell 里测试用的旁路。

---

## 派发方式

每个角色用 **Cursor 内置的 Task 工具**派发（即你在 agent 会话里让它"spawn a subagent"）：

| 角色 | subagent_type | 派发时机 |
|---|---|---|
| research | `trellis-research` | 随时（不需要 in_progress） |
| implement | `trellis-implement` | **必须先** `start-execution --approved` |
| check | `trellis-check` | implement 完成后 |

下面三段是**派发提示词原文**（直接贴给目标会话的 agent，让它调用 `Task(subagent_type=..., prompt=...)`）。

---

## ① Research subagent 派发词

> 派发前无需额外状态变更。直接派。
> **enum 退化提示**：若主会话 Task 工具拒收 `trellis-research`，退化为 `generalPurpose`，prompt 原样照传 —— 但 hook 不会注入，subagent 会走 fallback。这本身就是一次有效观察。

```
请用 Task 工具派发一个 trellis-research subagent，subagent_type 为 "trellis-research"，prompt 内容如下（原样传入）：

---
Selected task: d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke
Repo root: d:\MyHarness\Trellis

研究目标：调研 Trellis 项目中 subagent 上下文注入的实现机制，为 implement 阶段做铺垫。

具体任务：
1. 定位 `d:\MyHarness\Trellis\.cursor\hooks\inject-subagent-context.py`，说明它在 PreToolUse(Task|Subagent) 时如何截获 trellis-implement / trellis-check / trellis-research 三种 subagent，以及如何注入 `<!-- trellis-hook-injected -->` 标记 + 任务上下文。
2. 列出本任务目录 `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\` 下已有的工件（prd.md / implement.jsonl / check.jsonl / task.json / dispatch-prompts.md），简要描述每个文件作用。**注意：必须读这个绝对路径下的目录，不要按 cwd 相对路径解析，不要 mkdir 任何新目录。**
3. 验证 prd.md 中的 R1.1 / R1.2 需求（新增 d:\MyHarness\Trellis\scripts\smoke_echo.py，导出 echo_msg）在现有 Trellis 代码结构下是否合理，是否有冲突的 echo 脚本已存在。

输出要求：
- 按 trellis-research agent 定义，把每个研究主题写到 `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\<topic>.md`。
- 回复主会话时只给绝对文件路径 + 一行摘要，不要贴全文。

验证点（主会话观察）：
- subagent 回复里是否体现已读取 hook 注入的 spec 目录树上下文（agent 定义里会引用 `.trellis/spec/` 结构）。
- 如果 hook 没注入（提示词里没有 `<!-- trellis-hook-injected -->` 相关内容），subagent 是否按 fallback 协议从首行 `Selected task:` 读取并自行加载工件。
- **关键**：subagent 写文件是否落到了 `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\`（正确）而非 `d:\MyHarness\.trellis\tasks\06-23-subagent-smoke\research\`（错误，workspace 级）。
---
```

---

## ② Implement subagent 派发词

> 派发前**必须**在目标会话终端跑（**务必先 cd 到 Trellis 子项目**）：
> ```powershell
> cd d:\MyHarness\Trellis
> python ./.trellis/scripts/task.py start-execution .trellis/tasks/06-23-subagent-smoke --approved
> ```
> 这会把 `task.json.status` 从 `planning` 翻成 `in_progress`。不翻这个状态直接派 implement 是违规的（workflow.md Phase 2 硬前置）。
> **派发后验证**：跑 `python ./.trellis/scripts/task.py dashboard`，确认该任务出现在主条目且状态是 in_progress。
> **enum 退化提示**：同 ①，若 Task 工具拒收 `trellis-implement`，退化 `generalPurpose`，靠 fallback 跑。

```
请用 Task 工具派发一个 trellis-implement subagent，subagent_type 为 "trellis-implement"，prompt 内容如下（原样传入）：

---
Selected task: d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke
Repo root: d:\MyHarness\Trellis

实现目标：实现 prd.md 中的 R1 需求。

具体任务：
1. 新增文件 `d:\MyHarness\Trellis\scripts\smoke_echo.py`（绝对路径，不要按 cwd 相对路径推断），内容：
   - 导出函数 `echo_msg(msg: str) -> str`，返回 f"[smoke] {msg}"
   - 提供 `if __name__ == "__main__":` CLI 入口，读取 sys.argv[1]，调用 echo_msg 并 print 结果
   - 不引入任何外部依赖
2. 不修改任何其他文件。
3. 自检：在 `d:\MyHarness\Trellis` 目录下运行 `python scripts/smoke_echo.py hello`，确认输出 `[smoke] hello`。

约束：
- 不得执行 git commit / push / merge。
- 完成后按 implement agent 定义报告：修改/新建文件清单（用绝对路径）+ 验证结果。

验证点（主会话观察）：
- subagent 是否在首轮就体现了已收到注入的 prd.md 内容（例如直接引用 R1.1 / R1.2 而无需主会话再贴）。
- `<!-- trellis-hook-injected -->` 标记是否存在（agent 看不到原始 prompt 头，但行为上应体现"上下文已备齐"）。
- **关键**：smoke_echo.py 是否落到了 `d:\MyHarness\Trellis\scripts\`（正确）而非 `d:\MyHarness\scripts\` 或其他位置。
---
```

---

## ③ Check subagent 派发词

> 派发前：implement subagent 必须已返回且 `d:\MyHarness\Trellis\scripts\smoke_echo.py` 已存在。
> **enum 退化提示**：同 ①，若 Task 工具拒收 `trellis-check`，退化 `generalPurpose`，靠 fallback 跑。

```
请用 Task 工具派发一个 trellis-check subagent，subagent_type 为 "trellis-check"，prompt 内容如下（原样传入）：

---
Selected task: d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke
Repo root: d:\MyHarness\Trellis

检查目标：对 implement 阶段产出的 `d:\MyHarness\Trellis\scripts\smoke_echo.py` 做质量检查 + 自修。

具体任务：
1. 运行 `git -C d:\MyHarness\Trellis diff --name-only` 和 `git -C d:\MyHarness\Trellis diff` 查看本次改动。
2. 对照 prd.md 的 R1.1 / R1.2 / R1.3 验收标准逐项检查：
   - echo_msg 签名是否为 (msg: str) -> str
   - 返回值格式是否为 "[smoke] <msg>"
   - CLI 入口是否正确读取 sys.argv[1]
   - 是否误改了其他文件
3. 运行 `python d:\MyHarness\Trellis\scripts\smoke_echo.py hello` 验证行为。
4. 如发现问题，按 check agent 定义**直接修复**（不只是报告）。

约束：
- 不得执行 git commit / push / merge。
- 完成后按 check agent 定义报告：检查的文件（绝对路径） / 发现并修复的问题 / 未修复的问题 / 验证结果。
- 不要重定义 Parent task-map 或 gate 语义（本次无 Parent）。

验证点（主会话观察）：
- subagent 是否体现了已收到注入的 prd.md + implement.md（如存在）上下文。
- 自修行为是否符合 check agent 定义的"Fix issues yourself, don't just report"。
- **关键**：任何自修改动是否落到了 `d:\MyHarness\Trellis\` 内（正确）而非 workspace 根。
---
```

---

## 观察清单（派发时记录这些，用于 verify.md）

每个 subagent 派发后，在目标会话主会话里观察并记录：

| 观察项 | research | implement | check |
|---|---|---|---|
| Task 调用是否成功（subagent 开始运行） | ☐ | ☐ | ☐ |
| subagent 首轮回复是否体现注入上下文（引用 prd/验收标准） | ☐ | ☐ | ☐ |
| `<!-- trellis-hook-injected -->` 行为迹象 | ☐ | ☐ | ☐ |
| 是否走了 fallback（subagent 自己 Read 了 prd.md） | ☐ | ☐ | ☐ |
| subagent 是否完成其职责（research 出文件 / implement 出代码 / check 自修） | ☐ | ☐ | ☐ |
| 是否有 recursion guard 违规（subagent 又 spawn 了 subagent） | ☐ | ☐ | ☐ |

派发结束后把这张表填好，写到 `.trellis/tasks/06-23-subagent-smoke/verify.md`。

---

## 已知坑（policy 文档明文，派发时留意）

1. **Cursor++ BYOK 下 `model:` 不路由 trellis-*** —— 模型会继承父会话。如果目标会话是 BYOK 且你想给 subagent 不同模型，需要 Method 2.5 patch（本次测试不涉及，继承即可）。
2. **Cursor++ < v0.0.11 的 SubAgent readonly bug** —— implement 写不了文件。如果派发后 implement 报"无法写入"，先确认 Cursor++ 版本。
3. **本机 `task.py` 不含 `generate-dispatch-prompt` 子命令** —— 部署版本落后于 `packages/cli/src/templates/` 源码。所以本测试走 hook-only 注入路径（提示词主会话手写，hook 仍会自动注入上下文），这正好同时验证了 hook-only 降级路径。
4. **selected_task 是会话级** —— 目标会话必须自己 select，不能复用本会话的指针。
