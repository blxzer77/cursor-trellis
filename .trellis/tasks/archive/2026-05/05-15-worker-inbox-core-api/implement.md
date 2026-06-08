# Worker inbox core API implementation plan

## Step 1: Core API

- Add `packages/core/src/channel/api/inbox.ts`.
- Implement `WorkerInboxError` with stable `code`, `channel`, and `workerId`.
- Implement `readWorkerInbox()` by composing:
  - `resolveChannelRef()`
  - core `readChannelEvents()`
  - `reduceWorkerRegistry()`
  - `matchesInboxPolicy()`
- Implement `watchWorkerInbox()` by composing:
  - upfront worker validation from current event log
  - `watchChannelEvents()`
  - `matchesInboxPolicy()`
- Export functions and types from `packages/core/src/channel/index.ts`.

## Step 2: Tests

Add `packages/core/test/channel/worker-inbox.test.ts` covering:

- `readWorkerInbox()` returns only targeted messages for `explicitOnly`.
- `readWorkerInbox()` includes broadcasts for `broadcastAndExplicit`.
- `readWorkerInbox()` respects `afterSeq` and `limit`.
- `readWorkerInbox()` applies `limit` after inbox filtering by placing
  non-matching events before matching events.
- `readWorkerInbox()` supports pre-spawn targeted backlog after `spawned`.
- Old `spawned` events without `inboxPolicy` default to `explicitOnly`.
- Unknown worker throws `WORKER_INBOX_WORKER_NOT_FOUND`.
- Terminal worker throws by default.
- Terminal worker can be inspected with `includeTerminal: true`.
- `watchWorkerInbox()` yields future matching messages.
- `watchWorkerInbox()` covers both `explicitOnly` and `broadcastAndExplicit`.
- `watchWorkerInbox()` honors `sinceSeq` / `fromStart`.
- `watchWorkerInbox()` rejects terminal workers.
- `watchWorkerInbox()` ends when a terminal event for the watched worker arrives
  and does not cross into a later respawn with the same worker id.
- `watchWorkerInbox()` exits through `AbortSignal`.
- `watchWorkerInbox()` exits cleanly when aborted before any event and when
  aborted while waiting.
- A worker's own messages are excluded through `matchesInboxPolicy()` for both
  read and watch.
- Multi-target messages such as `to: ["a", "worker"]` are delivered to the
  matching worker.

## Step 3: Spec

- Update `.trellis/spec/cli/backend/commands-channel.md` worker lifecycle /
  inbox section.
- Document that core owns inbox read/watch semantics while CLI owns local
  runtime cursor persistence and stdin forwarding.
- Keep command docs unchanged unless CLI behavior changes in this task.

## Step 4: Deferred CLI consolidation

Do not change CLI supervisor behavior in this task. Defer this to a follow-up
after the core API is stable.

Later work can update `packages/cli/src/commands/channel/supervisor/inbox.ts`
to use `watchWorkerInbox()`:

- Update `packages/cli/src/commands/channel/supervisor/inbox.ts` to use
  `watchWorkerInbox()`.
- Keep adapter readiness, turn tracking, interrupt compatibility, stdin
  encoding, and `<worker>.inbox-cursor` in the CLI module.

## Step 5: Validation

Run:

```bash
pnpm --filter @mindfoldhq/trellis-core test worker-inbox
pnpm --filter @mindfoldhq/trellis-core test channel
pnpm --filter @mindfoldhq/trellis-core typecheck
pnpm --filter @mindfoldhq/trellis-core lint
pnpm --filter @mindfoldhq/trellis typecheck
```

When the deferred CLI supervisor consolidation is implemented, run:

```bash
pnpm --filter @mindfoldhq/trellis test channel
pnpm --filter @mindfoldhq/trellis lint
```

## Review gate

Before implementation starts, send `design.md` and `implement.md` back to the
architecture worker for one more review. Start implementation only after the
review has no blocker.
