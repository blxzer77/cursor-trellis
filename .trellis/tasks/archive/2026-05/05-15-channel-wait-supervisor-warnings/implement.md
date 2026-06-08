# Channel wait and supervisor warnings implementation

## Scope

Implement the child task `05-15-channel-wait-supervisor-warnings`.

This task owns:

- `trellis channel wait --kind done,killed` OR semantics.
- `supervisor_warning` event schema and one-shot pre-timeout emission.
- Pretty/raw visibility and tests for the new event behavior.

This task does not own:

- Worker inbox core API.
- Legacy `thread` / `threads` type compatibility.
- User-configurable timeout-warning CLI flags.

## Implementation Steps

1. [x] Extend event schema and parser.
   - Add `supervisor_warning` to `ChannelEventKind` and `CHANNEL_EVENT_KINDS`.
   - Add `SupervisorWarningChannelEvent` to the event union.
   - Add `parseChannelKinds(v?: string): ChannelEventKind[] | undefined`.
   - Keep `parseChannelKind()` single-value only.

2. [x] Extend filter semantics.
   - Change `ChannelEventFilter.kind` to accept one kind or a readonly kind list.
   - Use OR semantics when a list is provided.
   - Apply `MEANINGFUL_EVENT_KINDS` only when no explicit `kind` is provided.
   - Do not add `supervisor_warning` to `MEANINGFUL_EVENT_KINDS`.

3. [x] Update CLI wait contract.
   - Change `channelWait()` to call `parseChannelKinds()`.
   - Update wait help to `--kind <kind[,kind...]>`.
   - Preserve single-kind behavior.
   - Preserve `--all`: each `--from` agent needs one matching event, not every kind.

4. [x] Add supervisor warning emission.
   - Keep scheduling in `runSupervisor()` next to the timeout guard.
   - Use an internal `SUPERVISOR_TIMEOUT_WARNING_REMAINING_MS = 30_000` constant.
   - Emit immediately for timeout values <= 30 seconds.
   - Guard with `warningEmitted`, `shutdown.isShuttingDown()`,
     `shutdown.hasTerminalEvent()`, and child exit state.
   - Log append failures without changing worker lifecycle.

5. [x] Update message rendering.
   - Add a pretty renderer branch for `supervisor_warning`.
   - Raw output should work through the normal event schema.

6. [x] Add tests.
   - Parser tests for `parseChannelKind()` and `parseChannelKinds()`.
   - Filter tests for kind arrays and explicit non-meaningful matching.
   - CLI wait tests for `done,killed`, single kind, invalid CSV member, and `--all`.
   - Supervisor warning tests with fake timers or a small extracted helper. Do not use real 30s waits.

7. [x] Validate.
   - Run targeted CLI/core channel tests.
   - Run typecheck or the repository's equivalent check command.
   - Run GitNexus change detection if available before final review.

## Risk Points

- `parseChannelKind()` must not accept CSV, or `messages --kind` changes contract.
- `supervisor_warning` must not be meaningful by default, or plain wait can wake early.
- Warning must not become a terminal event. It must not suppress `killed`, `done`, or `error`.
- Tests must not depend on real timeout duration.
