# Channel wait and supervisor warnings

## Goal

让 Trellis channel dispatcher 可以可靠等待多个终态事件，并在 worker
接近 supervisor lifetime timeout 时得到可观察的预警事件。

本任务只处理 channel wait / supervisor 运行时表面，不处理 worker inbox
push API，不处理 legacy `thread` / `threads` 类型兼容。

## Requirements

- `trellis channel wait` 支持等待多个 event kind。
  - 推荐 CLI 语法：`--kind done,killed`。
  - 保留现有单值语法：`--kind done`。
  - 多值语义是 OR：任一匹配 kind 出现即返回成功。
  - kind 值仍必须走现有 event kind validation，不接受任意字符串。
- 多 kind 能力必须落在 core event filter contract 中，而不是只在 CLI
  `channelWait()` 循环里特判。
- 明确 supervisor pre-timeout warning 事件。
  - 推荐 kind：`supervisor_warning`。
  - 推荐 reason：`approaching_timeout`。
  - 事件至少包含 worker identity、`timeout_ms`、`remaining_ms`。
  - warning 只用于可观测性，不替代最终 `killed` / `done` / `error` 事件。
- `supervisor_warning` 不加入默认 meaningful event 集合。
  - 无 `--kind` 的 wait 不应被 warning 唤醒。
  - 显式 `--kind supervisor_warning` 必须可匹配。
  - `trellis channel messages` 默认作为事件日志视角，可以显示 warning。
- Supervisor warning 的发送策略必须避免重复刷屏。
  - 每个 worker 每次 run 最多发送一次 approaching-timeout warning。
  - 如果 worker 已经退出，不发送 warning。
  - 如果 adapter 已经产生 terminal event，不发送 warning。
- Warning timing 第一版使用内部固定阈值：timeout 前 30 秒。
  - `timeoutMs <= 30_000` 时，warning 立即发送一次，`remaining_ms = timeoutMs`。
  - 本任务不增加用户可配置 CLI flag。
- 不修改或兼容历史 `type:"thread"` / `type:"threads"` channel 数据。
- 不引入业务系统字段；事件 schema 保持 Trellis substrate 语义。

## Evidence

- `packages/cli/src/commands/channel/wait.ts` 目前只有 `WaitOptions.kind?: string`，
  filter 只能匹配单个 kind。
- `trellis channel wait --help` 目前显示单个 `--kind <kind>`。
- `packages/cli/src/commands/channel/supervisor/shutdown.ts` 目前只有 shutdown /
  killed 路径，没有 pre-timeout warning。
- Core event schema 已有 runtime kinds，如 `turn_started`、`turn_finished`、
  `undeliverable`，适合新增 substrate event kind。
- GitNexus context:
  - `channelWait` 的直接调用者是 `registerChannelCommand`。
  - `channelWait` 依赖 `parseChannelKind`、`parseCsv`、`parseThreadAction`、
    `normalizeThreadKey`。
  - `createShutdown` 的直接调用者是 `runSupervisor`。

## Acceptance Criteria

- [x] `trellis channel wait --kind done,killed` 可以在任一 kind 出现时返回。
- [x] `trellis channel wait --kind done` 现有行为不回退。
- [x] `trellis channel wait` 无显式 `--kind` 时不会被
      `supervisor_warning` 唤醒。
- [x] `trellis channel wait --kind supervisor_warning` 可以被 warning 唤醒。
- [x] 无效 kind 在单值和多值输入里都会失败并给出清晰错误。
- [x] Supervisor pre-timeout warning event schema 和发送策略写入 design 并实现。
- [x] 本任务包含单次 warning、worker 已退出不 warning、terminal event 后不
      warning、warning 后仍正常 killed/done 的测试。
- [x] CLI/core 测试覆盖 wait union 行为。

## Notes

- Parent task: `05-15-worker-dispatcher-observability-gaps`.
- Source issue:
  `trellis channel thread trellis-issue worker-dispatcher-observability-gaps --scope global`.
- This is an independently verifiable child task. It may be implemented before
  `05-15-worker-inbox-core-api`.

## Brainstorm Rounds

1. Decision: wait union and supervisor warning architecture.
   Evidence: `wait.ts` parses a single `kind`, `filter.ts` stores a single
   `kind`, `events.ts` has no `supervisor_warning`, and supervisor timeout
   currently writes only final `killed`.
   Architect answer: Make wait union a core filter capability. Add
   `supervisor_warning` as a first-class channel event. Keep warning scheduling
   in `runSupervisor()` near the timeout guard, not in `createShutdown()`.
   Resulting requirement: `ChannelEventFilter.kind` accepts one kind or a list;
   `parseChannelKinds()` composes the existing single-kind parser; warning
   writes a one-shot pre-timeout runtime event.

2. Decision: warning visibility, parser ownership, timing, and race guards.
   Evidence: `MEANINGFUL_EVENT_KINDS` filters non-meaningful events before kind
   matching; `messages` uses event-log rendering; `ShutdownController` already
   exposes `hasTerminalEvent()`.
   Architect answer: Do not add `supervisor_warning` to meaningful defaults.
   Explicit kind filters bypass meaningful filtering. `messages` default may
   show warning. Add `parseChannelKinds()` beside event kind validation, but do
   not change `parseChannelKind()`. Use a fixed 30s warning threshold without a
   new CLI flag. Guard warning with `shutdown.isShuttingDown()`,
   `shutdown.hasTerminalEvent()`, and child exit state.
   Resulting requirement: no default wait wakeup on warning; explicit wait works;
   parser SOT stays in event schema code; warning is one-shot and race-safe.
