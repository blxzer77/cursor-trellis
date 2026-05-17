# Core channel durable idempotency implementation plan

## Checklist

- [x] Create Trellis task and record user scope.
- [x] Read relevant core channel source, tests, and specs.
- [x] Record GitNexus indexing limitation for `packages/core/src/channel/**`.
- [x] Add planning artifacts before continuing implementation.
- [x] Finish implementation in `packages/core/src/channel/**`.
- [x] Add core channel tests for durable idempotency.
- [x] Run focused core tests.
- [x] Run core typecheck.
- [x] Run core build.
- [x] Run core lint.
- [x] Run channel-driven check worker and fix the two blocking findings.
- [x] Run two additional sequential channel-driven check reviews.
- [x] Run build after sequential reviews.
- [x] Run real dist-based channel write/replay test against physical `events.jsonl`.
- [x] Run `gitnexus_detect_changes`.
- [x] Update specs if the final API contract changes the documented core/channel behavior.
- [ ] Commit only this task's files.

## Implementation Steps

1. Keep `idempotencyKey` on `SendMessageOptions`, `PostThreadOptions`, and `BaseChannelEvent`.
2. Keep `appendEvent` idempotency lookup inside the channel lock.
3. Make `sendMessage` pass the key to the message event.
4. Make strict delivery side-effect writes use deterministic derived keys and the persisted message `to` field.
5. Make `postThread` pass the key to the thread event.
6. Add tests covering:
   - duplicate keyed `sendMessage`
   - duplicate keyed `postThread`
   - unkeyed writes still append
   - empty key rejection
   - cross-kind key reuse error
   - strict delivery replay does not duplicate `undeliverable`
7. Review the implementation for type safety and event compatibility.

## Validation Commands

```bash
pnpm --filter @mindfoldhq/trellis-core test -- test/channel/idempotency.test.ts
pnpm --filter @mindfoldhq/trellis-core lint
pnpm --filter @mindfoldhq/trellis-core typecheck
pnpm --filter @mindfoldhq/trellis-core build
```

## Rollback Point

If the event-boundary approach breaks existing channel tests, revert the
idempotency lookup and keep only the task artifacts. Do not leave partial
schema/API changes without passing tests.
