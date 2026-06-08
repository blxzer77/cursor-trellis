# Worker inbox core API

## Goal

为 Trellis core 提供 worker inbox push / in-process delivery API，使本地
daemon 或 SDK 集成方可以直接向已知 worker 投递消息并消费 worker 收件箱，
不需要通过 CLI subprocess 拼装 `channel send` / `channel wait` 循环。

本任务只处理 core substrate API。它不引入业务系统身份模型，不引入订阅产品语义，
不把 channel/forum/thread 变成 mem source。

## Requirements

- 设计并实现 core-level worker inbox API。
  - 推荐能力：向指定 worker 投递 message。
  - 推荐能力：按 worker 消费 inbound messages。
  - 推荐能力：复用现有 channel event store、worker registry、delivery mode、
    event watching primitives。
- API 必须保持 Node-only Trellis core 边界，不要求 browser/isomorphic SDK。
- 投递语义必须明确。
  - worker 不存在时的行为。
  - worker 不在运行中时的行为。
  - append-only 与 strict delivery 的关系。
  - 是否返回 delivery result，或通过 `undeliverable` event 表达失败。
- inbox 消费语义必须明确。
  - cursor / since seq 行为。
  - 是否只读取 `to:<worker>` 的 message。
  - 是否包含历史未读 message。
  - 是否需要 abort signal / timeout。
- 不能复制 CLI-only 解析逻辑。CLI 后续如需要使用该能力，应调用 core API。
- 不做 legacy `thread` / `threads` 类型兼容。
- 不把业务系统的 user/org/source identity 固化进 Trellis core；外部系统可以通过
  generic metadata / event fields 自行承载自己的上下文。

## Evidence

- `packages/core/src/channel/api/send.ts` 已有 `sendMessage`、delivery mode、
  `undeliverable` event。
- `packages/core/src/channel/api/read.ts` 已有 cursor pagination。
- `packages/core/src/channel/api/watch-channels.ts` 和 channel event watching 能作为
  inbox 消费基础。
- `packages/core/src/channel/api/workers.ts` 已有 worker registry、
  `listWorkers`、`watchWorkers`、`probeWorkerRuntime`、`reconcileWorkerLiveness`。
- 当前缺口不是消息事件不存在，而是缺少面向 SDK/daemon 的高内聚 API。

## Acceptance Criteria

- [ ] design.md 明确 core API 函数签名、返回值、错误模型和 event schema 复用点。
- [ ] design.md 明确 worker missing / stopped / running 三类投递语义。
- [ ] design.md 明确 inbox read/watch 的 cursor、filter、abort/timeout 行为。
- [ ] implement.md 拆分 core implementation、CLI follow-up、tests。
- [ ] 实现时测试覆盖 send success、unknown worker、stopped worker、
      cursor replay、watch delivery、abort/timeout。
- [ ] API 不引入业务系统特定字段或 product identity。

## Notes

- Parent task: `05-15-worker-dispatcher-observability-gaps`.
- Source issue:
  `trellis channel thread trellis-issue worker-dispatcher-observability-gaps --scope global`.
- This task can start after its API design is reviewed. It should not be
  blocked on supervisor warning implementation, but it may use wait-union
  behavior if that child lands first.
