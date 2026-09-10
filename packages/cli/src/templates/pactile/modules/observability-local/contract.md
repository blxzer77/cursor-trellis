# `observability-local`

P29 表名：`observability-local`（不得改名）。层：baseline。

## 职责

本地、只读消费式的可观测性。记录生命周期耗时、门的通过/失败、Return-to-Define、AC 覆盖、上下文包大小/重复、人工打断、Verify 后返工原因。默认不外发、不进 Session 包、不以 Token 估算或 Agent 调用次数当质量。评价回到节奏是否可靠、上下文是否浪费、有没有假绿、返工是否集中（与 P26 四轴一致）。不控制生命周期，不写 Kernel 核心状态。

## 触发/披露

永远可以记（被动、后台）。**永远不**作为第 2 层模块短契约进入默认 Prompt。用户问健康/返工、或 Close 需要引用本地事实时，由 `context-progressive` 按第 4 层缺口再取片段。不是监控产品、不是常驻仪表盘。

Agent 看见：默认看不见本块教战。不得把「记了多少事件」写成任务已完成。平台没有 Token/成本数据时标 `unavailable`，不得编数字。

用户看见：按需。日常 Open→Close 不出现可观测性配置。外发遥测必须显式 opt-in（本需求默认不做外发）。

渐进：需要时才披露片段，从不常驻。

## 停止条件

- 输入：Kernel 审计、Gate、Evidence、编译器包元数据（大小/层/模块列表）。
- 输出：本地事实记录。零 Prompt 是成功标准，不是缺陷。
- 停止：把本块灌进 SessionStart；用虚荣指标代替 Evidence；默默上传。

## 关掉必须消失

不再记账。Open→Close 仍必须能走完（本块不是生命周期必需槽，是 Baseline 里的横切记录器）。

## 不得带走

Gate 是否通过（Kernel）；Evidence 正文（`verify-basic`）；为了「像模块」而占常驻包。
