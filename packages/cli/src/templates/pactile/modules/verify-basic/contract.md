# `verify-basic`

P29 表名：`verify-basic`（不得改名）。层：baseline。

## 职责

Verify 槽与 Evidence 角色。做确定性检查，并把每条 AC 映射到真实证据。Lite 也必须有真实 Evidence；占位、TBD、空勾选、假绿不得 Close。`verify.md` 是给人看的投影；机器账本是 `ac_evidence_ledger`（Kernel extras）。本块不负责独立第二遍语义 Check（那是 `independent-check`）。

## 触发/披露

Phase=Verify，或 Execute 刚结束正在收证据时加载。Intake / Define 不讲假绿、不灌 `verification-strength-guide`。Close 之后本块教战从常驻包拿掉，只留「证据是否已覆盖」。

Agent 看见：

1. 每条 AC 必须有可定位证据（测试输出、diff、命令结果、人工验收记录）；缺映射或指纹在定义/代码变更后过期 → 不得 Close。
2. 实现缺陷 → 回 Execute 修，再验。不得在 Verify 里扩范围或改 AC 来「验过」。
3. 契约/范围缺陷 → Return-to-Define，再走 Execute 门。
4. 不得把 `self-review` 写成 `true-independent`；独立 Check 未激活则本块只做 Baseline Evidence。
5. Adapter 可把卡住的运行时问题绑到 Cursor Debug；证据仍必须落回 Evidence 角色，Debug 不是本块。

用户看见：阶段名 Verify。能否收工、哪条 AC 还没证据。Lite 不出现「独立审查员」叙事。

渐进：非 Verify（及收证窗口）不加载本块教战。

## 停止条件

- 输入：Execute 已产生可验的工作结果；AC 列表来自已批 Definition。
- 输出：AC→Evidence 覆盖；人读 `verify.md`；机器 ledger 更新。未覆盖 = Verify 未完成。
- 停止：假绿；在 Verify 中改需求；宣称 Close 但 Evidence 槽空。
- Lite / Full：本块对两者都强制真实 Evidence。Full 额外的 Independent Check 是另一模块。

## 关掉必须消失

不能 Close（缺 Evidence 必需槽）。不得用「看起来做过检查」代替映射。

## 不得带走

独立只读 Check（`independent-check`）；retrieval pack 打分（`retrieval-extended`）；如何写 AC（`define-basic`）；学习写回 spec（`spec-learning`）。
