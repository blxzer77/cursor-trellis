# Worker inbox core API design

## 决策

本任务不新增 `deliverMessage()`。Trellis channel 的 durable contract 是先写入
append-only `message` event，再由 worker runtime 消费 inbox。`deliverMessage()`
会把“写入用户意图”和“进程 stdin 已收到”混成一个承诺，边界过强。

写入继续由现有 `sendMessage()` 负责；本任务新增 core-level worker inbox 消费 API：

```ts
readWorkerInbox(input): Promise<WorkerInboxMessage[]>
watchWorkerInbox(input): Promise<AsyncGenerator<WorkerInboxMessage>>
```

`watchWorkerInbox()` is an `async` function that returns the generator.
The outer call performs upfront validation (unknown / terminal worker) and
captures the current `lastSeq` snapshot before returning, so errors surface
eagerly and `sinceSeq` is taken before the caller can append more events.

这两个 API 只负责按 worker 的 durable registry state 和 `inboxPolicy` 读取 /
监听可消费的 `message` events，不负责 provider adapter、stdin encoding、turn
queueing、进程 readiness 或本地 cursor 文件。

## API surface

新增文件：

```text
packages/core/src/channel/api/inbox.ts
```

新增导出：

```ts
export {
  readWorkerInbox,
  watchWorkerInbox,
  WorkerInboxError,
} from "./api/inbox.js";

export type {
  ReadWorkerInboxInput,
  WatchWorkerInboxInput,
  WorkerInboxMessage,
  WorkerInboxErrorCode,
} from "./api/inbox.js";
```

类型：

```ts
export interface ReadWorkerInboxInput extends ChannelAddressOptions {
  workerId: string;
  afterSeq?: number;
  limit?: number;
  includeTerminal?: boolean;
}

export interface WatchWorkerInboxInput extends ChannelAddressOptions {
  workerId: string;
  sinceSeq?: number;
  fromStart?: boolean;
  signal?: AbortSignal;
}

export interface WorkerInboxMessage {
  workerId: string;
  event: MessageChannelEvent;
  seq: number;
  cursor: number;
}

export type WorkerInboxErrorCode =
  | "WORKER_INBOX_WORKER_NOT_FOUND"
  | "WORKER_INBOX_WORKER_TERMINAL";

export class WorkerInboxError extends Error {
  readonly code: WorkerInboxErrorCode;
  readonly channel: string;
  readonly workerId: string;
}
```

## Read semantics

`readWorkerInbox()` reads channel events, reduces the worker registry, finds
`workerId`, and filters `message` events through the existing
`matchesInboxPolicy()` single source of truth.

- Unknown worker: throw `WorkerInboxError` with
  `WORKER_INBOX_WORKER_NOT_FOUND`.
- Terminal worker: throw `WorkerInboxError` with
  `WORKER_INBOX_WORKER_TERMINAL` unless `includeTerminal: true`.
- Non-terminal durable worker: return matching message events. Core only
  reasons from the event log; it does not claim the OS process is live.
- `afterSeq`: return only messages with `seq > afterSeq`.
- `limit`: non-negative integer cap applied after filtering; `0` returns `[]`.
  Implementations must not pass `limit` directly to raw event reads before inbox
  filtering, or non-matching events can hide later matching messages.
- Cursor: `cursor` is the returned message event `seq`.

Pre-spawn targeted backlog is supported. If a `message` targeting `implement`
was appended before `spawned(as: "implement")`, then after the worker is
spawned, `readWorkerInbox({ workerId: "implement", afterSeq: 0 })` returns
that message. The latest/current worker `inboxPolicy` decides which backlog
messages are consumable; policy is not reconstructed at historical message
time.

## Watch semantics

`watchWorkerInbox()` validates the worker exists and is non-terminal in durable
worker state at watch startup, then uses existing channel watch primitives and
`matchesInboxPolicy()` to yield future inbox messages. Host-local process
liveness remains in `probeWorkerRuntime()` / `reconcileWorkerLiveness()` and
CLI supervisor code.

- Unknown worker: throw `WORKER_INBOX_WORKER_NOT_FOUND`.
- Terminal worker: always throw `WORKER_INBOX_WORKER_TERMINAL`.
- Cancellation: only `AbortSignal`; core does not provide `timeoutMs`.
- `sinceSeq` / `fromStart`: same meaning as `watchChannelEvents()`.
- It does not persist cursor state.
- If a terminal event for the watched worker arrives after startup, the
  generator ends. It does not cross a terminal event into a later respawn with
  the same `workerId`.
- `fromStart` / explicit `sinceSeq` are clamped to the current worker
  generation floor: the latest terminal event before the current `spawned`.
  This prevents old-generation messages from replaying while still allowing
  messages appended between that terminal event and the current spawn to be
  consumed as backlog.

If a caller wants to watch a future respawn of the same worker id, it should use
`watchWorkers()` first, wait for the worker to become non-terminal, then start
`watchWorkerInbox()`.

## Delivery and failure model

`sendMessage()` remains the only write API and continues returning
`MessageChannelEvent`.

Strict delivery failures remain durable `undeliverable` events:

```ts
sendMessage({
  channel,
  by,
  to: "implement",
  text,
  deliveryMode: "requireRunningWorker",
});
```

The API does not return a parallel delivery result. Event log replay and UI /
daemon watchers must see the same source of truth.

## Boundaries

In scope:

- Core inbox read/watch API.
- Stable inbox error class and error codes.
- Reuse of `sendMessage`, `reduceWorkerRegistry`, `matchesInboxPolicy`,
  `readChannelEvents`, and `watchChannelEvents`.
- Tests for cursor, policy, unknown/terminal workers, pre-spawn backlog, watch,
  and abort.

Out of scope:

- `deliverMessage()` or any direct runtime push API.
- Moving CLI `WorkerAdapter`, stdin encoding, adapter readiness, turn queueing,
  or `<worker>.inbox-cursor` into core.
- Changing `sendMessage()` return type or default `appendOnly` behavior.
- Business identity, user/org/source modeling, subscriptions, product inbox,
  or mem-source behavior.
- Legacy `thread` / `threads` compatibility.
- `tag: "interrupt"` behavior changes. First-class interrupt remains owned by
  `requestInterrupt()` / `interruptWorker()`.

## CLI follow-up shape

CLI supervisor consolidation is explicitly deferred from this task. The
supervisor inbox path owns adapter readiness, stdin encoding, turn events,
interrupt compatibility, and local cursor persistence; mixing that behavior
change into this core substrate task would expand the blast radius.

The later shape should be:

```ts
for await (const msg of watchWorkerInbox({
  channel,
  workerId,
  sinceSeq: cursor,
  fromStart: cursor === 0,
  signal,
})) {
  // CLI-only: adapter readiness, stdin encoding, turn events, cursor file write.
}
```

The cursor file remains CLI-local runtime state. It is not durable channel
truth and should not become a core storage abstraction.
