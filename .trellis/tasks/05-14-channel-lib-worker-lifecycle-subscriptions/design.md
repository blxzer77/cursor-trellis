# Draft Design: Channel Runtime Core APIs

## Status

Implemented. Architecture review findings were merged before implementation, and follow-up check review blockers were fixed.

## Problem

`@mindfoldhq/trellis-core` now owns channel storage, event schema, seq allocation, metadata/thread reducers, and pure mutation/read/watch APIs. The runtime half of channel remains in `@mindfoldhq/trellis` CLI: spawn, supervisor, inbox watcher, kill, pid file reconciliation, provider adapters, and terminal event handling.

That split blocks in-process consumers. A daemon can read channel events through core, but cannot spawn, route, interrupt, or monitor workers without shelling out to CLI or reimplementing CLI runtime logic.

This task covers the full issue scope. The implementation can be staged to control risk, but the final task outcome must include worker registry/liveness, inbox policy, strict delivery failure signaling, turn/interrupt semantics, paginated reads, and cross-channel watch.

## Ownership Boundaries

Core owns reusable state and runtime substrate:

- channel event schema and append/read/watch storage
- worker lifecycle event schema
- worker state reducer
- worker listing and watch APIs
- delivery policy classification
- paginated channel reads
- cross-channel watch/fan-in primitive
- typed delivery/interrupt/lifecycle primitives

CLI owns user-facing shell behavior:

- Commander options and help text
- terminal output and exit codes
- stdin/file argument parsing
- pretty rendering
- local release/update behavior
- agent file loading and prompt assembly
- provider adapter registry until a CLI-independent runtime kernel exists
- provider process launch details and `process.exit` behavior

External products own business semantics:

- users, orgs, auth, permission, subscription, notification, product inbox
- product runtime timelines such as approval requests and detailed agent UI lanes
- auto-respawn policy after delivery failure or `crashed`

Do not move `packages/cli/src/commands/channel/supervisor.ts` wholesale into core. It currently owns provider binaries, signal handling, pid files, config files, and process exit behavior. If a shared execution layer is needed, design it later as an injected `WorkerRuntime` / `SupervisorKernel`, not as CLI code inside core.

## Issue Acceptance Matrix

| Issue requirement | Design coverage | Validation target |
|---|---|---|
| `inboxPolicy` on spawn | `InboxPolicy = "explicitOnly" | "broadcastAndExplicit"`; default preserves current explicit `to` behavior | Core delivery helper tests; CLI spawn default behavior test |
| Worker registry / liveness | `reduceWorkerRegistry`, `listWorkers`, `watchWorkers`, and separate `probeWorkerRuntime` | Synthetic event-log reducer tests; local runtime probe tests |
| No silent delivery failure | `DeliveryMode` with strict modes and `undeliverable` events | Strict targeted send tests for unknown and terminal workers |
| Interrupt / mid-turn semantics | `turn_started.inputSeq`, `turn_finished`, `interrupt_requested`, `interrupted.method/outcome`, queue-till-boundary default | Adapter/supervisor tests for turn activity and interrupt outcomes |
| Paginated channel reads | `readChannelEvents` cursor options: `beforeSeq`, `afterSeq`, `limit` | Core pagination tests preserving read-all default |
| Cross-channel subscription | `watchChannels` with project/global scope, per-channel cursor, dynamic discovery | Core watch fan-in tests with two channels and cursor resume |
| Core/CLI package boundary | Core owns substrate and reducers; CLI owns rendering, argv, provider execution | Typecheck and import-boundary review; no CLI deep duplication of reducers |
| External identity boundary | Keep `by`, `to`, `origin`, `meta`; no business user/org schema | Event schema tests and spec update |

## Spawn Runtime Contract

Full issue scope includes a concrete `channel.spawn` design, but core must not import CLI provider adapters or shell-specific process behavior. The reusable contract is provider-injected:

```ts
interface WorkerStartInput {
  channel: ChannelRef;
  workerId: string;
  cwd: string;
  systemPrompt: string;
  model?: string;
  resume?: string;
  env?: Record<string, string>;
}

interface WorkerRuntimeHandle {
  workerId: string;
  provider?: string;
  pid?: number;
  startedAt: string;
}

interface WorkerInterruptInput {
  workerId: string;
  turnId?: string;
  reason?: InterruptReason;
  message?: string;
}

interface WorkerInterruptResult {
  method: "provider" | "stdin" | "signal" | "none";
  outcome: "interrupted" | "queued" | "unsupported" | "no-active-turn" | "failed";
  message?: string;
}

interface WorkerStopInput {
  workerId: string;
  reason: "explicit-kill" | "timeout" | "crash" | "shutdown";
  signal?: NodeJS.Signals;
  force?: boolean;
}

interface WorkerStopResult {
  outcome: "stopped" | "already-stopped" | "failed";
  signal?: NodeJS.Signals;
  message?: string;
}

interface WorkerRuntime {
  start(input: WorkerStartInput): Promise<WorkerRuntimeHandle>;
  interrupt?(input: WorkerInterruptInput): Promise<WorkerInterruptResult>;
  stop?(input: WorkerStopInput): Promise<WorkerStopResult>;
}

interface SpawnWorkerInput {
  channel: string;
  scope?: ChannelScope;
  projectKey?: string;
  cwd: string;
  by: string;
  workerId: string;
  provider?: string;
  agent?: string;
  systemPrompt: string;
  model?: string;
  resume?: string;
  inboxPolicy?: InboxPolicy;
  timeoutMs?: number;
  meta?: Record<string, unknown>;
}

async function spawnWorker(
  input: SpawnWorkerInput,
  runtime: WorkerRuntime,
): Promise<WorkerState>;
```

Core coordinates event writes, reducer state, delivery policy, and lifecycle contract. `spawnWorker` resolves the channel, asks the injected runtime to start, appends `spawned` with runtime metadata, and returns projected `WorkerState`. CLI adapter registry can implement `WorkerRuntime`; external daemons can provide their own runtime without shelling out.

The selected inbox policy is durable worker state:

```ts
interface SpawnedChannelEvent extends BaseChannelEvent<"spawned"> {
  as: string;
  provider?: string;
  pid?: number;
  agent?: string;
  inboxPolicy?: InboxPolicy;
}
```

Reducer rule: old `spawned` events without `inboxPolicy` project as `explicitOnly`. Spawn config files are host-local runtime artifacts and must not be treated as worker registry SOT.

## Event Schema Additions

Add event kinds in core:

```ts
type ChannelEventKind =
  | ExistingKinds
  | "undeliverable"
  | "interrupt_requested"
  | "turn_started"
  | "turn_finished"
  | "interrupted";
```

Worker lifecycle should remain event-sourced from existing and new events:

```ts
type WorkerLifecycle =
  | "starting"
  | "running"
  | "done"
  | "error"
  | "killed"
  | "crashed";

type WorkerActivity = "idle" | "mid-turn";

interface WorkerState {
  workerId: string;
  channel: ChannelRef;
  agent?: string;
  provider?: string;
  lifecycle: WorkerLifecycle;
  terminal: boolean;
  activity: WorkerActivity;
  activeTurnId?: string;
  activeTurnStartedAt?: string;
  pendingMessageCount: number;
  inboxPolicy: InboxPolicy;
  spawnedAt?: string;
  updatedAt: string;
  startedBy?: string;
  exitCode?: number;
  signal?: string;
  reason?: string;
  error?: string;
  lastSeq: number;
}
```

`WorkerState` must not include `pid`. Pids are host-local forensic details, not a portable contract. Raw `spawned` events may continue to carry `pid`.

## Worker Runtime Probe

Keep durable projection and local runtime observation separate:

```ts
interface WorkerRuntimeObservation {
  workerId: string;
  pid?: number;
  workerPid?: number;
  supervisorAlive?: boolean;
  workerAlive?: boolean;
  observedAt: string;
  source: "local-pid-files";
}

async function probeWorkerRuntime(input): Promise<WorkerRuntimeObservation[]>;
```

`reduceWorkerRegistry` must never read pid files. Runtime probes may feed UI or reconciliation commands, but pid state is not durable channel truth.

## Inbox Policy

Add a spawn option:

```ts
type InboxPolicy = "explicitOnly" | "broadcastAndExplicit";

interface SpawnWorkerOptions {
  inboxPolicy?: InboxPolicy; // default "explicitOnly"
}
```

Semantics:

- `explicitOnly`: consume `kind:"message"` only when `to` contains the worker id. This preserves current CLI behavior.
- `broadcastAndExplicit`: consume broadcast messages plus messages addressed to the worker, excluding messages authored by that worker.

Do not add a `verbose` policy in the first implementation. Raw progress stream consumption is runtime-specific and will couple worker turns to provider noise. A text/metadata `mentionsOnly` mode can be designed later if a real mention parser exists.

## Worker Registry API

Add core reducer and APIs:

```ts
function reduceWorkerRegistry(events: ChannelEvent[]): WorkerRegistry;

async function listWorkers(input: {
  channel: string;
  scope?: ChannelScope;
  projectKey?: string;
  cwd?: string;
  includeTerminal?: boolean;
}): Promise<WorkerState[]>;

function watchWorkers(input: {
  channel: string;
  scope?: ChannelScope;
  projectKey?: string;
  cwd?: string;
  includeTerminal?: boolean;
  sinceSeq?: number;
  signal?: AbortSignal;
}): AsyncGenerator<WorkerState[], void, unknown>;
```

`reduceWorkerRegistry` is the SOT. CLI list/status, daemon runtime cards, and tests should use it instead of reparsing event logs independently.

## Local Liveness Reconciliation

Add a host-local API:

```ts
async function reconcileWorkerLiveness(input: {
  channel: string;
  scope?: ChannelScope;
  projectKey?: string;
  cwd?: string;
  now?: () => Date;
  appendTerminalEvents?: boolean; // default false
}): Promise<{
  observations: WorkerRuntimeObservation[];
  proposedEvents: ChannelEvent[];
  appended: ChannelEvent[];
}>;
```

This API may inspect local pid files and OS liveness. It reports observations and proposed durable events first. It only appends when `appendTerminalEvents: true`; the default must not write `events.jsonl`. It must be documented as only valid on the machine that owns the supervisor files.

## Undeliverable Messages

When sending a targeted message, core may classify target state if the caller opts into strict delivery validation.

```ts
interface UndeliverableChannelEvent extends BaseChannelEvent<"undeliverable"> {
  targetWorker: string;
  messageSeq: number;
  reason: "worker-terminal" | "worker-unknown";
}
```

Add delivery validation mode:

```ts
type DeliveryMode =
  | "appendOnly"
  | "requireKnownWorker"
  | "requireRunningWorker";
```

Initial behavior:

1. Default `appendOnly` preserves current behavior, including pre-spawn backlog.
2. Strict modes append the `message` event first so user intent is durable, then append `undeliverable` for targets that fail the selected condition.
3. Do not auto-respawn. Consumers decide policy.

`requireRunningWorker` means running according to the durable worker registry, not OS liveness. If a worker is `running` in durable state but its supervisor pid is already dead and unreconciled, `sendMessage` cannot know that without host-local liveness. That case belongs to runtime probe/reconciliation, not hidden inside every send.

`queueUntilWorker` is not a first-version public mode. It would require a durable queue, retry, expiry, and failure contract; keep it as a future design unless fully specified.

## Interrupt API

Do not model interrupt as a tag-only convention. Add after turn state exists:

```ts
type InterruptReason = "user" | "system" | "timeout" | "superseded";

async function interruptWorker(input: {
  channel: string;
  workerId: string;
  by: string;
  message?: string;
  reason?: InterruptReason;
  meta?: Record<string, unknown>;
}, runtime: WorkerRuntime): Promise<{
  event: ChannelEvent;
  interrupted: boolean;
  delivery:
    | "interrupted-current-turn"
    | "no-active-turn"
    | "worker-terminal"
    | "worker-unknown";
}>;

async function requestInterrupt(input: {
  channel: string;
  workerId: string;
  by: string;
  message?: string;
  reason?: InterruptReason;
  meta?: Record<string, unknown>;
}): Promise<ChannelEvent>;
```

`requestInterrupt` is durable-event-only and appends `interrupt_requested`. `interruptWorker(input, runtime)` is the orchestration API: it appends `interrupt_requested`, calls the injected `WorkerRuntime.interrupt`, then appends `interrupted` with explicit `method` and `outcome`. Core must not import CLI provider adapters.

- Claude: existing `control_request` path remains the provider adapter mechanism.
- Codex: replace text prefix with `turn/interrupt` once adapter state stores active `turnId`.

`tag:"interrupt"` should be CLI compatibility input only. The CLI may normalize it to `interruptWorker`; new core events should not rely on magic tag semantics.

## Turn Boundary Events

Worker activity requires durable turn boundary events:

```ts
interface TurnStartedEvent extends BaseChannelEvent<"turn_started"> {
  worker: string;
  inputSeq: number;
  turnId?: string;
}

interface TurnFinishedEvent extends BaseChannelEvent<"turn_finished"> {
  worker: string;
  turnId?: string;
  outcome?: "done" | "error" | "aborted";
}

interface InterruptedEvent extends BaseChannelEvent<"interrupted"> {
  worker: string;
  turnId?: string;
  reason?: InterruptReason;
  method: "provider" | "stdin" | "signal" | "none";
  outcome: "interrupted" | "queued" | "unsupported" | "no-active-turn" | "failed";
  message?: string;
}
```

Adapters should emit these from provider notifications where available. If a provider cannot expose a stable turn id, the supervisor may synthesize a local turn id for activity projection while preserving provider ids when present.

Reducer rule: `pendingMessageCount` is derived only from durable events. It counts deliverable `message` events matching the worker inbox policy whose seq is greater than the latest `turn_started.inputSeq` consumed for that worker. It must not read host-local inbox cursor files. `turn_started.inputSeq` is the durable link between a channel `message` and the provider turn it initiated.

## Mid-Turn Delivery

Default behavior should be queue-till-boundary:

- idle worker: deliver message immediately
- mid-turn worker: append message event, count it as pending for that worker, deliver after `turn_finished`
- interrupt: only `interruptWorker` can break the active turn

Do not add an `immediate` mode yet. The current behavior is not a contract; preserving an undefined behavior as a configurable mode would make it harder to fix.

## Paginated Reads

Extend `readChannelEvents` without changing current default:

```ts
interface ReadChannelEventsOptions extends ChannelAddressOptions {
  beforeSeq?: number;
  afterSeq?: number;
  limit?: number;
}
```

Rules:

- no pagination options: return all events, preserving compatibility
- `afterSeq`: return events with `seq > afterSeq`, ascending
- `beforeSeq`: return events with `seq < beforeSeq`, newest page first internally but return ascending for stable consumers
- `limit` with `beforeSeq` or `afterSeq`: cap the page size; recommended default `200` when a cursor is present
- `limit` without cursor: return the latest N events in ascending seq order
- `beforeSeq` and `afterSeq` together should throw unless a real range use case is added

Implementation can start with read-all-and-slice for correctness if tests guard semantics, then optimize with seq-to-offset indexing later. The API must not use offset pagination.

## Cross-Channel Watch

Add a core fan-in primitive:

```ts
type ChannelCursorKey = string;
type ChannelCursor = Record<ChannelCursorKey, number>;

function channelCursorKey(ref: ChannelRef): ChannelCursorKey {
  return `${ref.scope}/${ref.project}/${ref.name}`;
}

interface WatchChannelsInput {
  scope: { projectKey: string } | "global";
  filter?: ChannelEventFilter;
  cursor?: ChannelCursor;
  signal?: AbortSignal;
  fromStartNewChannels?: boolean;
}

interface CrossChannelEvent {
  channel: ChannelRef;
  event: ChannelEvent;
  cursor: ChannelCursor;
}

function watchChannels(
  input: WatchChannelsInput,
): AsyncGenerator<CrossChannelEvent, void, unknown>;
```

Cursor is per channel. The cursor key is `channelCursorKey(ref)`, using the resolved scope, project bucket key, and channel name. This disambiguates global/project channels with the same name. There is no global seq across channels, and adding one would create a second ordering system with harder recovery semantics.

Dynamic discovery is part of the contract. If a channel is created inside the watched scope after the watcher starts, it should enter the stream. Delivery is at-least-once; consumers must persist `(channel, seq)` checkpoints.

Do not add `scope: "all"` in the first implementation. Cross-project/all-scope watch adds permission, ordering, cursor-size, and discovery semantics that should not be locked before project/global scope is proven.

## Migration Sequence

1. Add schema/types for new events and worker state.
2. Add `reduceWorkerRegistry`, `listWorkers`, and `watchWorkers`.
3. Add `readChannelEvents` pagination.
4. Add `watchChannels`.
5. Add `inboxPolicy` to spawn config and factor inbox delivery helper into core.
6. Add opt-in `undeliverable` classification to targeted send through delivery validation modes.
7. Add turn boundary events and worker activity projection.
8. Add `interruptWorker` and provider-level interrupt updates.
9. Add CLI wrappers and renderer updates around the new core primitives.
10. Evaluate whether a provider-injected supervisor kernel belongs in core or a separate runtime subpath. Do not move CLI supervisor wholesale.

This sequence keeps state projection stable before moving process orchestration, reducing risk.

## Validation Plan

- Core unit tests:
  - `reduceWorkerRegistry` lifecycle transitions and terminal filtering
  - `listWorkers` and `watchWorkers` API behavior
  - inbox policy classification
  - strict delivery modes: `appendOnly`, `requireKnownWorker`, `requireRunningWorker`
  - `undeliverable` after strict-mode targeted send to unknown/terminal worker
  - `readChannelEvents` pagination semantics
  - `watchChannels` per-channel cursor and new-channel discovery
  - `probeWorkerRuntime` / `reconcileWorkerLiveness` default no-write behavior and explicit append behavior
  - event schema parity for `turn_started.inputSeq` and `interrupted.method/outcome`
- CLI tests:
  - existing spawn/send/kill behavior preserved under default `explicitOnly`
  - `tag:"interrupt"` compatibility maps to first-class interrupt behavior
  - messages/read output unchanged unless new options are used
  - `messages --raw` preserves new event fields
  - `.trellis/spec/cli/backend/commands-channel.md` matches emitted event schema
- Type checks:
  - `pnpm --filter @mindfoldhq/trellis-core build`
  - `pnpm --filter @mindfoldhq/trellis typecheck`
- Runtime dogfood:
  - spawn worker, send targeted message, kill worker, send targeted message again, observe `undeliverable`
  - create two channels in a scope and verify cross-channel watch sees both

## Rejected Alternatives

- Structured business identity in `by`: rejected. Trellis should persist `by`, `to`, `origin`, and `meta`; business identity belongs under external namespaces in `meta`.
- Global cross-channel seq: rejected. Per-channel append logs already have seq; global seq would require a new transactional index across channel directories.
- Worker state based on pid files only: rejected. Pid files are local runtime artifacts and cannot power server-side projections.
- Auto-respawn in Trellis core: rejected. Retry policy depends on product semantics and crash-loop tolerance.
- Progress-inclusive inbox policy: rejected for first version. It couples agents to provider runtime noise and breaks the collaboration/runtime stream separation.
- Whole CLI supervisor in core: rejected. It would couple core to provider binaries, agent loading, CLI entry resolution, pid files, and process exit behavior.
- Default undeliverable on every targeted send: rejected. It breaks pre-spawn backlog compatibility.
- `queueUntilWorker` in first-version `DeliveryMode`: rejected until durable queue/retry/expiry semantics are designed.
