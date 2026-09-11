# Kernel、Evidence 与 Trace

[English](kernel-evidence-trace.md) | 简体中文

这三个概念分别回答持久化工作中的不同问题：

- **Kernel：** 这次状态转换是否允许发生？
- **Evidence：** 哪个可观察事实支持这项声明？
- **Trace：** 哪些可观察的能力组合事件按什么顺序发生？

把三者分开，可以避免一条成功命令、一行日志或 Agent 的解释在无意中变成项目权威。

## Kernel

### 定义

Kernel 是 Pactile 面向宿主无关持久记录的校验器和变更边界。它先根据 canonical 状态检查 task、gate、archive、lifecycle 或 record 转换请求，再决定是否接受写入。

### 职责

- 校验 record 形状、阶段、转换与必需 gates；
- 在有时效要求时比较 contract 与 artifact fingerprint；
- 要求已记录的执行批准，不把 preflight 当作同意；
- 把通过的转换写入 canonical `.pactile/` 状态，并产生 audit fact；
- 以 typed、可检查的结果拒绝非法或过期请求。

### 边界

Kernel 不选择 Tiles，不替模型制定计划，不判断某个 Provider 是否值得使用，不写宿主投影，也不推断用户批准。`--check` 通过只证明请求在结构上已就绪，并不授权相应变更。

## Evidence

### 定义

Evidence 是指向可观察 artifact 或事实的稳定引用，用来支持一项声明。它可以指向验证结果、receipt、已审 diff、probe 结果，或由所属子系统保存的其他有界记录。

### 职责

- 让 readiness、assurance、gate 与完成声明可以审计；
- 足够精确地标识 artifact 与 outcome，以便复查；
- 区分声明、支撑声明的 Evidence，以及接受声明的权威；
- 当声明依赖当前 Provider readiness 时携带时效信息。

### 边界

Evidence 不是私有推理、prompt 记录、credential，也不是任意 inline output dump。引用本身不等于证明：目标事实必须存在、与声明相关，并满足所需 freshness 或 reviewer 边界。`native`、`provider` 等 Provider origin 也不能证明 `verified` assurance。

## Trace

### 定义

Trace 是按 fingerprint 串联的 append-only 可观察能力组合事件序列。它可以记录 discovery、eligibility、selection、ordering、invocation、completion、failure、skip/fallback、Provider resolution 与 Evidence recording。

### 职责

- 通过连续 sequence number 与 previous-event fingerprint 保持事件顺序；
- 关联 task、Tile、intent、Provider resolution、artifact 与 Evidence，但不复制其内容；
- 展示能力是完成、降级、fallback 还是停止；
- 让中断、stale-head 写入、畸形事件与链断裂可被发现。

### 边界

Trace 不含 prompt、rationale、scratchpad、私有 chain of thought、secret、credential value、任意 URL 或 prose error payload。它只使用有界逻辑引用与 symbolic error code。与可信 head 对比时，hash chain 能发现不一致历史；它是完整性 Evidence，不是数字签名。

## 三者如何协作

```text
模型选择 Tiles
  -> Trace 记录可观察的 selection 与 ordering
  -> Provider resolution 关联 readiness Evidence
  -> 能力产出 artifacts 与 Evidence
  -> Kernel 校验所请求的持久转换
  -> 只有转换被接受时 canonical record 才变化
  -> Trace 记录可观察 outcome
```

顺序很重要。能力执行成功不代表 task gate 已满足；存在 Evidence 不代表状态转换已获授权；Kernel 拒绝转换时，Trace 仍可如实记录发生过的尝试。

## 用户场景

Agent 完成文档修改并运行 focused checks。检查报告成为 Evidence，Trace 记录所选检查能力及其 outcome。但在必需 review gate、最终 acceptance、durable-learning decision 与 reviewed change set 齐备前，Kernel 仍拒绝 archive。事实补齐后，同一个 archive 转换即可通过，不需要改写之前的 Trace。

## 应检查什么

| 问题                         | 检查对象                                                              |
| ---------------------------- | --------------------------------------------------------------------- |
| 持久转换是否获准？           | Kernel 结果与 canonical task/lifecycle record                         |
| 哪个事实支持声明？           | Evidence 引用及其所属 artifact 或 receipt                             |
| 哪条可观察能力路径实际运行？ | Trace events 与可信 head                                              |
| 谁可以写宿主文件？           | Projection Plan、Reconciler receipt 与 Ownership ledger，而不是 Trace |

严格 schema 与 fingerprint 规则见 [v1 契约参考](../pactile/contracts-v1.md)。继续阅读 [Projection 与 Ownership](projection-and-ownership.zh-CN.md)、[Spec system](spec-system.zh-CN.md)和[Task system](task-system.zh-CN.md)。
