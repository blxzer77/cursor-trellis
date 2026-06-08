# Channel wait and supervisor warnings design

## Overview

本任务把 dispatcher 需要的两个运行时能力做成 Trellis channel substrate
能力：`wait --kind` 支持 OR 语义，supervisor 在 worker timeout 前写入一次
可观察的 warning event。实现不引入业务系统字段，不支持 legacy
`thread` / `threads` 类型。

## Wait kind union

`--kind done,killed` 表示 OR：任一 kind 到达即唤醒。`--kind done` 保持现有
行为。

核心 contract 放在 event filter 层：

- `packages/core/src/channel/internal/store/events.ts`
  - 保留 `parseChannelKind()` 的单值语义。
  - 新增 `parseChannelKinds(v?: string): ChannelEventKind[] | undefined`。
  - `parseChannelKinds()` 拆 CSV 后逐项调用 `parseChannelKind()`，不复制白名单。
- `packages/core/src/channel/internal/store/filter.ts`
  - `ChannelEventFilter.kind` 支持 `ChannelEventKind | readonly ChannelEventKind[]`。
  - `matchesEventFilter()` 对 kind 使用 OR 匹配。
- `packages/cli/src/commands/channel/wait.ts`
  - `WaitOptions.kind` 仍是 CLI 原始字符串。
  - `channelWait()` 调用 `parseChannelKinds()`。
- `packages/cli/src/commands/channel/index.ts`
  - help 改为 `--kind <kind[,kind...]>`。

`messages --kind` 不在本任务扩展为 CSV。它继续使用 `parseChannelKind()`，
避免把 wait 的多 kind contract 泄漏到其他命令。

`--all` 语义不变：每个 `--from` agent 只需要产生一个匹配 kind；不要求每个
agent 产生所有 kind。

## Supervisor warning event

新增 event kind：`supervisor_warning`。

事件字段：

```ts
{
  kind: "supervisor_warning";
  by: `supervisor:${workerName}`;
  worker: string;
  reason: "approaching_timeout";
  timeout_ms: number;
  remaining_ms: number;
}
```

Schema 归属：

- `packages/core/src/channel/internal/store/events.ts`
  - `ChannelEventKind` 加 `supervisor_warning`。
  - `CHANNEL_EVENT_KINDS` 加 `supervisor_warning`。
  - 新增 `SupervisorWarningChannelEvent`，并加入 `ChannelEvent` union。

`supervisor_warning` 不加入 `MEANINGFUL_EVENT_KINDS`。默认 wait 不应被 warning
唤醒；显式 `--kind supervisor_warning` 必须可匹配。`trellis channel messages`
是事件日志视角，默认可以显示 warning，并应补 pretty renderer 分支。

## Timing

第一版使用内部常量，不增加 CLI flag：

```ts
const SUPERVISOR_TIMEOUT_WARNING_REMAINING_MS = 30_000;
```

当 `timeoutMs > 30_000` 时，在 timeout 前 30 秒写 warning。当
`timeoutMs <= 30_000` 时，warning delay 为 `0`，`remaining_ms = timeoutMs`。

以后如需配置，再从 `SupervisorConfig.timeoutWarningRemainingMs?: number` 往上暴露；
本任务不扩展 `spawn` / `run` CLI contract。

## Lifecycle placement

Warning scheduling 放在 `packages/cli/src/commands/channel/supervisor.ts` 的
timeout guard 附近。`createShutdown()` 继续只负责终态和 kill ladder，不承载
pre-timeout warning。

Warning timer 写入前必须检查：

```ts
if (
  warningEmitted ||
  shutdown.isShuttingDown() ||
  shutdown.hasTerminalEvent() ||
  child.exitCode !== null ||
  child.signalCode !== null
) {
  return;
}
```

`warningEmitted = true` 应在 append 前同步设置。append 失败只写 supervisor log，
不改变 worker 生命周期，也不阻止后续 `killed` / `done` / `error`。

## Tests

最小测试集：

- Core filter:
  - `supervisor_warning` 在默认 filter 下不匹配。
  - `supervisor_warning` 在显式 kind 下匹配。
  - `done` 匹配 `["done", "killed"]`。
  - `error` 不匹配 `["done", "killed"]`。
  - `includeNonMeaningful` 可以匹配 warning。
- Parser:
  - `parseChannelKind("done,killed")` 仍失败。
  - `parseChannelKinds("done,killed")` 返回 `["done", "killed"]`。
  - `parseChannelKinds("done,nope")` 复用现有 invalid kind 错误。
- CLI wait:
  - `channelWait(... kind: "done,killed")` 可被 `killed` 唤醒。
  - `channelWait(... kind: "done")` 行为不变。
  - invalid CSV member 走现有错误路径。
- Supervisor warning:
  - fake timer 或小型调度 helper 验证 warning 只发一次。
  - `shutdown.hasTerminalEvent()` 为 true 时不发 warning。
  - `shutdown.isShuttingDown()` 为 true 时不发 warning。
  - warning 后 timeout 仍写 `killed`。

不要用真实 30 秒 timeout 测试。

## Rejected alternatives

- 只在 `channelWait()` 里手写 `kinds.includes(ev.kind)`：拒绝。会让 CLI wait
  和 core watch/filter contract 漂移。
- 让 `parseChannelKind()` 接受 CSV：拒绝。会意外扩展 `messages --kind`。
- 同时引入 `kind` 和 `kinds` 两个 filter 字段：拒绝。会制造优先级和同步规则。
- 把 warning 写成 `progress` 或 `killed` 附加字段：拒绝。warning 不是 adapter
  progress，也不是终态。
- 把 warning 放进 `createShutdown()`：拒绝。warning 是 timeout scheduler 的
  pre-timeout 观测事件，不属于终态漏斗。
