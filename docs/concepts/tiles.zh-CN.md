# Tiles

[English](tiles.md) | 简体中文

## 定义

Tile 是一个小型、有版本的能力契约，由模型或用户针对当前任务选择和组合。它声明能力所需条件与允许边界，不规定私有推理，也不嵌入宿主特定脚本。

## 职责

Tile 声明：

- 稳定 identity 与 semantic version；
- trigger 与支持的 intent；
- 逻辑输入、输出、依赖与冲突；
- filesystem、process、network、credential、privacy、telemetry、destination 与 cost 上限；
- 最低 assurance 与必需 Evidence 类型；
- 有界 fallback policy、停止条件与 attempt limit。

Compiler 在执行前检查依赖、冲突、策略上限、确定性顺序和 fallback 边界。模型仍负责选择有用的 Tiles 并理解任务；Kernel 不是中央规划器。

## 边界

Tile 不包含 steps DSL、tool/MCP server 名、Cursor/Codex 路径、prompt 记录、任意 URL、credential value 或私有 chain of thought。`structural`、`external` 等 intent 稍后通过 Middleware 解析。MCP 是一种可能的 Provider 集成，不是 Tile。

Fallback 不能扩大 permission、destination、egress、credential、telemetry、cost 或 assurance policy。禁止网络的 Tile 也不能通过 fallback 偷渡远程行为。

## 用户场景

一次仓库调查需要精确 symbol 搜索和结构依赖视图。模型选择两个输出兼容的 Tiles；Compiler 为它们排序，确认都不请求网络，并记录选择。如果 structural Provider 不可用，只有当本地 exact search fallback 不越过原策略上限且仍满足最低 assurance 时才能使用；否则应返回 degraded 和明确用户动作。

## 应检查什么

- Tile manifest 表示请求的最大权限。
- Provider 解析结果表示实际 origin、assurance、readiness 与 Evidence。
- Trace 表示 Tile 被 selected、invoked、skipped、failed 还是 completed。
- Policy denial 是合法结果，不能成为静默调用更宽权限工具的理由。

继续阅读 [Kernel、Evidence 与 Trace](kernel-evidence-trace.zh-CN.md)和[能力](../capabilities/index.zh-CN.md)。
