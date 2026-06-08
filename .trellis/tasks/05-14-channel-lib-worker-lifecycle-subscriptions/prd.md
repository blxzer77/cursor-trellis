# Design channel-as-lib worker lifecycle and subscriptions

## Goal

把 `trellis channel` 的 worker lifecycle、投递策略、interrupt、分页读取和跨 channel 订阅整理成可进入 `@mindfoldhq/trellis-core` 的设计。目标是让 CLI、外部 daemon、未来 SDK 消费方复用同一套 channel substrate，而不是各自解析 events.jsonl、pid 文件和 worker 状态。

## Requirements

- `channel.spawn` 设计必须支持明确的 inbox delivery policy，至少区分只收显式 `to` 和收 broadcast + 显式 `to` 的 message 事件。
- worker 状态必须有 core 级投影和查询/watch API，不能让 CLI、daemon、UI 各自从 `spawned` / `done` / `error` / `killed` / pid 文件推断。
- 投递给不存在或 terminal worker 的消息在严格投递模式下不能静默失败，必须产生可观察信号；默认 CLI 行为必须保留 pre-spawn backlog 兼容性。
- interrupt 必须是一等 API 和一等事件，不能只靠 `tag: "interrupt"` 或 provider adapter 的文本前缀。
- worker state 需要区分进程 lifecycle 和 turn activity，避免把“worker 活着”和“正在跑当前 turn”混成一个状态。
- `readChannelEvents` 需要 cursor pagination API shape；默认行为不能破坏现有“读取全部”的调用方。
- 需要一个跨 channel watch / fan-in API shape，支持 scope 内动态 channel discovery 和 per-channel cursor。
- 设计必须遵守 `@mindfoldhq/trellis-core` 边界：core 拥有可复用 domain/storage/reducer/API，CLI 只做参数解析、渲染和 exit code。
- 不把外部业务身份、租户、权限模型写进 Trellis channel schema；这类数据通过 `meta` 透传。
- 本 task 最终必须覆盖 issue 里的全部需求；允许按依赖顺序分阶段实现，但不能把 interrupt、worker registry、delivery failure、pagination 或 cross-channel watch 作为后续另开任务遗漏。

## Out of Scope

- 不在本任务实现代码。
- 不设计外部产品自己的 inbox、权限、订阅、UI merge timeline。
- 不新增业务身份 schema，例如 user/org/displayName。
- 不把 `progress` runtime stream 纳入 `messages` inbox policy 的默认消费范围。
- 不做 thread/comment hard delete。

## Acceptance Criteria

- [ ] PRD 记录 issue 来源、需求、非目标和可验证验收标准。
- [ ] research 记录已核对的 core/CLI/channel 现状、相关 spec、GitNexus/abcoder 证据和已确认缺口。
- [ ] 至少一轮 architect agent review 记录到 task research，重点检查高内聚、低耦合、SOT、API 边界和兼容性。
- [ ] 产出 draft `design.md`，包含 API surface、事件 schema、reducer 边界、CLI 迁移顺序、兼容策略和验证计划。
- [ ] 产出 draft `implement.md`，但保持 planning 状态，等待用户明确开干。

## Brainstorm Rounds

1. Decision: 先把 issue 拆成 channel-as-lib 设计研究任务，不直接实现。
   Evidence: global `trellis-issue` 的 external daemon/core SDK 需求 comment seq 18；`packages/core/src/channel` 当前没有 spawn/supervisor API；CLI supervisor 仍持有 worker lifecycle。
   User answer: 用户要求“记录个 task，然后先自己研究下，可以拉 arch/research agent brainstorm”。
   Resulting requirement: 本任务先完成 evidence + architect review + draft design，不进入 implementation。
2. Decision: 保持 core substrate 和 CLI/provider executor 边界分离。
   Evidence: architect review 指出 CLI supervisor 包含 provider binary、agent prompt assembly、CLI entry、`process.exit`、pid/signal 等执行器细节。
   User answer: 用户要求高内聚、低耦合、可复用、SOT；本轮由 architect 代理给出架构反馈。
   Resulting requirement: `spawn` 不整体搬进 core；先抽 event/reducer/read/watch/delivery primitives，后续再评估 provider-injected supervisor kernel。
3. Decision: `undeliverable` 不能作为默认 `sendMessage` 行为。
   Evidence: current inbox first run uses cursor `0` to consume backlog；pre-spawn `send --to worker` later spawn can still be delivered.
   User answer: 用户要求先研究；无额外产品决定。
   Resulting requirement: 新设计引入 delivery validation mode；默认 CLI 行为保持 append-only/backlog compatible。
4. Decision: 第一版 task scope 覆盖 issue 全量需求，而不是只做 core substrate 子集。
   Evidence: 用户明确说“反正需求就是这个 issue 里的要求都得做”。
   User answer: 全部 issue 要求都要做。
   Resulting requirement: `implement.md` 可以分阶段排序，但 task 验收必须包含 inbox policy、worker registry/liveness、undeliverable/strict delivery、turn/interrupt、paginated read、cross-channel watch；不得把 interrupt/runtime 作为 scope 外。

## Notes

- Issue source: global channel `trellis-issue`, external daemon/core SDK thread, seq 18, timestamp `2026-05-14T11:38:56.022Z`.
