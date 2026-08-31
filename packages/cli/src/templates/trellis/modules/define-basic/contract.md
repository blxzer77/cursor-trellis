# `define-basic`

P29 表名：`define-basic`（不得改名）。层：baseline。

## 职责

Open 已成立之后、Execute 门之前。只负责**定义面**：Definition + 可测的 Acceptance Contract。Lite 到此为止（默认表面 `prd.md` + AC 清单）。Full 时按 Kernel 已解析的 `required_controls` 补齐 **Execution Contract** 与 **Verification Plan** 两个语义角色（默认可仍写在 `implement.md`），不因「要显得完整」机械生成空文档。本块**产**契约；`execute-agent` / `verify-basic` **消费**契约。契约变更必须 Return-to-Define，刷新后再走 Execute 门。

## 触发/披露

Phase=Define 时加载本块短契约 + 当前 Definition/AC（及 Full 时已有的执行/验证契约片段）。Grill、深研、`design.md` 仅当 `define-extended` 已激活才进入包。Execute 门过后，常驻包只留**已批准定义摘要**（加 AC 列表），不留 Grill 全文、不留未批准草稿。

Agent 看见：

1. 没有可测 AC，不得请求 Execute 门。
2. 不得在 Define 写实现代码、不得 `--approved`。
3. Full 缺已解析 controls 要求的语义角色，Define 未完成。
4. Design 不是本块的必产出；出现 Design 需求时触发 `define-extended`，不把 Grill 正文写进本块短契约。
5. Adapter 可以把本阶段绑到 Cursor Plan；那是 Adapter 绑定，不是本块拥有 Plan 模式说明书。

用户看见：阶段名 Define。Lite：一份需求 + 验收。Full：需求 + 验收 + 执行/验证契约（仍是人话文档，不是设计论文）。被问的是意图、范围、风险接受，不是仓库里已有的事实。

渐进：过了 Define，从常驻包拿掉本块教战，只留已批摘要。

## 停止条件

- 输入：Open 已过（Task 已建、Rigor×Topology 已批）；`selected_task` 指向本任务。
- 输出（Lite）：Definition + 可测 AC。缺 AC = Define 未完成。
- 输出（Full）：在 Lite 之上，按 `required_controls` 补 Execution Contract 与 Verification Plan 角色；Design 角色不在本块。
- 不改产品代码、不 archive、不假装 Execute 已批、不把 `workflow.md` 当定义 SSOT。
- Return-to-Define：范围/AC/执行契约/验证策略/capability 假设变化时，停 Execute，刷新定义与门指纹后再请 Execute 批准。

## 关掉必须消失

不能写验收、不能宣称 Define 完成、不能把 AC 当 Evidence。Kernel 仍可停在 Open，但没有定义槽 provider。

## 不得带走

Task 前澄清（`intake-basic`）；Grill / 深研 / 条件 Design / spec-bootstrap（`define-extended`）；Execute 人批（`approval-personal`）；jsonl/上下文预算（`context-progressive`）；独立 Check（`independent-check`）。
