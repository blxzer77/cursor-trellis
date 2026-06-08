# Evidence Pass

## Files And Tools Inspected

- `trellis channel messages trellis-issue --scope global --raw --last 40`
- `packages/core/src/channel/index.ts`
- `packages/core/src/channel/internal/store/events.ts`
- `packages/core/src/channel/internal/store/watch.ts`
- `packages/core/src/channel/api/read.ts`
- `packages/core/src/channel/api/watch.ts`
- `packages/core/src/channel/api/types.ts`
- `packages/cli/src/commands/channel/spawn.ts`
- `packages/cli/src/commands/channel/supervisor.ts`
- `packages/cli/src/commands/channel/supervisor/inbox.ts`
- `packages/cli/src/commands/channel/kill.ts`
- `.trellis/spec/cli/backend/trellis-core-sdk.md`
- `.trellis/spec/cli/backend/commands-channel.md`
- GitNexus query/context for `channelSpawn`, `runInboxWatcher`, `readChannelEvents`
- abcoder file structure for core channel event/read/watch files

## Confirmed Facts

1. Core channel currently exports data/storage APIs and reducers, not supervisor APIs.
   - `packages/core/src/channel/index.ts` exports `createChannel`, `sendMessage`, thread/context/title APIs, `readChannelEvents`, `watchChannelEvents`, metadata/thread reducers, filters, and event types.
   - It does not export `spawn`, `kill`, `runSupervisor`, worker registry, worker reducer, or interrupt API.

2. Core already owns event type definitions and append/read/watch storage.
   - `packages/core/src/channel/internal/store/events.ts` defines `ChannelEventKind`, `BaseChannelEvent`, `SpawnedChannelEvent`, `KilledChannelEvent`, `DoneChannelEvent`, `ErrorChannelEvent`, `ProgressChannelEvent`, and `appendEvent`.
   - `appendEvent` already uses `.seq` sidecar reconciliation and is the intended SOT for seq allocation.

3. Core read API has no pagination shape.
   - `packages/core/src/channel/api/read.ts` exposes `readChannelEvents(opts: ChannelAddressOptions): Promise<ChannelEvent[]>`.
   - Internal store `readChannelEvents(name, project?)` reads the full file into memory and returns all events.

4. Core watch API is single-channel only.
   - `packages/core/src/channel/api/watch.ts` exposes `watchChannelEvents(opts)` for one channel.
   - Internal `watchEvents` supports `fromStart`, `sinceSeq`, `filter`, and `signal`, but no multi-channel fan-in or dynamic channel discovery.

5. CLI still owns spawn/supervisor/kill.
   - `packages/cli/src/commands/channel/spawn.ts` resolves agent/provider/model/context, writes supervisor config, forks `trellis channel __supervisor`, and prints JSON.
   - `packages/cli/src/commands/channel/supervisor.ts` owns child process lifecycle, adapter selection, `spawned` event writing, stdout pump, timeout, inbox watcher, and cleanup.
   - `packages/cli/src/commands/channel/kill.ts` reads pid files, kills supervisor/worker, writes fallback `killed` or `error`, and cleans runtime files.

6. Inbox delivery is currently hardcoded to explicit `to=<worker>` messages.
   - `packages/cli/src/commands/channel/supervisor/inbox.ts` calls `watchEvents` with `{ self: workerName, to: workerName, kind: "message" }`.
   - It then rechecks `to` and skips broadcasts. There is no `inboxPolicy`.

7. Current event taxonomy lacks the new issue's proposed events.
   - `CHANNEL_EVENT_KINDS` does not include `interrupt`, `turn_started`, `turn_finished`, `interrupted`, or `undeliverable`.
   - Existing runtime kinds include `spawned`, `killed`, `respawned`, `progress`, `done`, `error`, `waiting`, and `awake`.

8. Existing specs already require core/CLI SOT boundaries.
   - `.trellis/spec/cli/backend/trellis-core-sdk.md` says event file format, append, seq allocation, reducers, and channel/thread summaries belong to core.
   - It explicitly says not to duplicate `lastSeq`, event classification, linked context parsing, or thread status rules across command files.
   - `.trellis/spec/cli/backend/commands-channel.md` currently documents `spawn`, `kill`, `wait`, `messages`, `post`, `forum`, `thread`, and current routing semantics.

9. GitNexus confirms current call boundaries.
   - `channelSpawn` is called by `channelRun` and `registerChannelCommand`.
   - `runInboxWatcher` is called only by `runSupervisor`.
   - `readChannelEvents` is ambiguous across core API, core store, and CLI compatibility store, which is exactly the kind of split that needs careful SOT work.

10. abcoder confirms core channel structure has no worker projection module.
    - Core indexed channel packages include `api/read.ts`, `api/watch.ts`, store `events.ts`, `watch.ts`, `thread-state.ts`, metadata, schema, seq, and paths.
    - No worker-state or supervisor module exists under core.

## Repository-Answerable Questions Already Resolved

- Does core already have `readChannelEvents`? Yes, but no pagination parameters.
- Does core already have single-channel watch? Yes, with `sinceSeq`.
- Does core already have `reduceThreads` and metadata reducer? Yes.
- Does core already have worker lifecycle reducer? No.
- Does current inbox consume broadcasts? No, it intentionally skips them.
- Is seq sidecar already implemented in core? Yes.

## Remaining Product / Scope Decisions

- Whether a future `mentionsOnly` mode needs text mention parsing or only metadata-based targeting.
- Whether `queueUntilWorker` deserves first-version support or should remain a named future delivery mode.
- Whether provider-level interrupt should be part of the same implementation phase as worker registry, or a follow-up after turn boundary events exist.

## Early Design Bias

The likely correct implementation sequence is:

1. Add event/schema/types and worker reducer in core.
2. Add paginated read and cross-channel watch in core while preserving current read-all defaults.
3. Move inbox delivery policy into a reusable core delivery helper.
4. Evaluate a provider-injected supervisor kernel only after state projection is stable; do not move CLI supervisor wholesale.
5. Add provider interrupt after turn boundary events are modeled, because `interruptWorker` needs reliable active turn identity.

## Architect Review Corrections

Later architect review refined this initial bias:

- `undeliverable` must be opt-in through delivery validation mode, because current pre-spawn backlog delivery is compatible behavior.
- Inbox policy names should reflect current broadcast semantics: `explicitOnly` and `broadcastAndExplicit`.
- Durable worker registry and local pid/runtime probe must remain separate.
- Turn boundary events must land before first-class provider interrupt.
