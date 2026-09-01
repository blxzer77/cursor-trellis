# `candidate-pool`

P29 表名：`candidate-pool`（不得改名）。层：on-demand。

## 职责

需求池。把尚未承诺实现的想法写成 Candidate，不是 Task。Intake 可以发出「进池意图」；本块负责物化条目与队列语义。仅状态为 `accepted` 的条目可以变成 `task.py create` 的输入。`accepted` 只是裁决，不是做完；剩余义务看 `delivery`（open / in-slice / landed / standing / deferred）。standing 不是下一张工单。清晰且可直接做的请求不进池，走 Intake → Open Task。

## 触发/披露

未触发时目录都可以不存在。用户明确说「记一下 / 进池」，或 Intake 判定未成形时才激活并进 Prompt。日常 Open→Close、Execute、Verify **不见** `pool.py` 教战。首次 Capture 才创建 `.cstl/pool/`，安装时不建空骨架。

未触发 = 当没装。

Agent 看见：

1. 进池要有可审摘要；意图式同意（用户说记录即批准进池），否则先展示摘要再问一次。
2. 不得把池项当已开 Task、不得未 Open 就写 `prd.md` 或建任务目录。`accepted` 只冻需求，**不自动** `task.py create`。
3. 用户说开始实现某条已 accepted 条目时：先在该条目写 `## 切片`，再走 Intake Open Proposal；Open 之后才 `pool.py link`。
4. 选下一件：只在 open / in-slice 里排；standing 不排队。单一切片 Close ≠ 整条 `landed`（剩余可 `deferred`）。
5. 本块不决定 Rigor×Topology；开 Task 时仍走 Intake Proposal + Open 门。

用户看见：一个候选队列，不是看板。默认不出现池配置。

## 停止条件

- 触发：用户要进池 | Intake 出口为进池意图。
- 输出：Candidate 记录；首次才物化目录。`task_created: false`。
- 停止：把池当 Task；安装时预建空池；未激活仍把 pool README 灌进 SessionStart。

## 关掉必须消失

不能 Capture、不能物化池、Prompt 无池教战。直接做事仍走 intake → Open Task。

## 不得带走

Open Approval 与 Task 目录（`approval-personal` / Kernel）；Define 正文（`define-basic`）。
