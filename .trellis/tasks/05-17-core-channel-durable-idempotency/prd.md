# Core channel durable idempotency

## Goal

Add durable idempotency to `@mindfoldhq/trellis-core` channel writes so replayed commands can return the original event instead of appending duplicate JSONL events.

## User Value

Downstream callers that retry a logical send or forum/thread mutation after a crash or reconnect need a stable event `seq`. The channel event log should be the source of truth for replay safety, not a process-local cache.

## Confirmed Facts

- Source issue: global forum `trellis-issue`, thread `channel-event-durable-idempotency`, opened `2026-05-17T12:30:27.941Z`.
- Scope is this project only: update the core package behavior in this repository.
- Explicitly out of scope per user direction: channel-as-lib design expansion or broader worker lifecycle work.
- `sendMessage` in `packages/core/src/channel/api/send.ts` currently appends a `message` event directly.
- `postThread` in `packages/core/src/channel/api/post-thread.ts` currently appends a `thread` event directly.
- `appendEvent` in `packages/core/src/channel/internal/store/events.ts` owns channel locking, seq allocation, JSONL append, and `.seq` sidecar update.
- `SendMessageOptions` and `PostThreadOptions` in `packages/core/src/channel/api/types.ts` are the intended public option surfaces for this task.
- Current tests under `packages/core/test/channel/` cover seq sidecar behavior, metadata validation, thread lifecycle, and delivery modes, but not idempotent replay.
- GitNexus impact/context for `appendEvent`, `sendMessage`, `postThread`, and the target files returned `Target not found`; local file search and spec review are the evidence source for this task.

## Requirements

- `sendMessage` and `postThread` must accept an optional `idempotencyKey`.
- Channel events written with an idempotency key must persist that key in `events.jsonl`.
- Replaying a `sendMessage` call with the same key must return the original `message` event, including the original `seq`, without appending another `message`.
- Replaying a `postThread` call with the same key must return the original `thread` event, including the original `seq`, without appending another `thread`.
- The replay check must survive process restart by reading durable channel state, not process memory.
- The check must happen inside the channel lock so concurrent writers cannot append duplicate events for the same key.
- Calls without an idempotency key must preserve current append-only behavior.
- Empty idempotency keys must be rejected with a clear error.
- Reusing an idempotency key for a different event kind must fail clearly instead of returning a mismatched event.
- Strict delivery side effects from `sendMessage` must remain replay-safe when the original message is replayed, including when a retry payload drifts from the original target list.

## Acceptance Criteria

- [ ] `SendMessageOptions` and `PostThreadOptions` accept `idempotencyKey` directly.
- [ ] `BaseChannelEvent` includes optional `idempotencyKey`.
- [ ] `appendEvent` returns the existing matching event for duplicate `(channel, idempotencyKey, kind)` writes.
- [ ] Duplicate keyed `sendMessage` calls produce one `message` event and return the same `seq`.
- [ ] Duplicate keyed `postThread` calls produce one `thread` event and return the same `seq`.
- [ ] Duplicate keyed `sendMessage` with strict delivery produces only one `undeliverable` per failed target.
- [ ] Unkeyed repeated writes still append distinct events.
- [ ] Empty keys and cross-kind key reuse are covered by tests.
- [ ] Core tests for the affected channel behavior pass.
- [ ] Core typecheck/build passes.

## Out Of Scope

- No CLI flags for idempotency keys.
- No channel-as-lib worker lifecycle changes.
- No public export of `appendEvent`.
- No durable secondary idempotency index unless tests or performance prove JSONL lookup insufficient for this patch.
- No changes to existing event `seq` sidecar semantics beyond preserving them.

## Evidence Pass

- Read `packages/core/src/channel/api/send.ts`, `post-thread.ts`, `types.ts`, and `internal/store/events.ts`.
- Read core tests: `metadata.test.ts`, `threads.test.ts`, and `seq.test.ts`.
- Read specs: `.trellis/spec/cli/backend/trellis-core-sdk.md`, `error-handling.md`, `quality-guidelines.md`, and unit-test conventions.
- Searched for `idempot`, `appendEvent`, `sendMessage`, and `postThread`.
- GitNexus did not have indexed symbols/files for the `packages/core/src/channel/**` targets; this limitation is recorded here.

## Brainstorm Rounds

1. Decision: Keep scope to the core package in this repository.
   Evidence: User explicitly said not to care about channel-as-lib and to inspect whether this project's core package needs work.
   User answer: "不用管 channel-as-lib ，我们只处理本 project 的情况，就是看看我们的 core 包有没有什么需要搞的".
   Resulting requirement: No worker lifecycle or larger channel-as-lib planning in this task.

2. Decision: Implement durable idempotency at the event append boundary.
   Evidence: `appendEvent` owns lock, seq allocation, JSONL append, and sidecar update; process-local caches cannot survive restart.
   User answer: "continue" followed by task creation approval.
   Resulting requirement: Replay detection happens inside the channel lock and reads persisted event state.

3. Decision: Start with optional idempotency keys on existing public mutation options.
   Evidence: `sendMessage` and `postThread` are the issue's affected public APIs; shared mutation types would overpromise support for unrelated mutations.
   User answer: Scope is core package behavior, not CLI UX.
   Resulting requirement: Add the option to the core API surface, with no CLI flags in this task.
