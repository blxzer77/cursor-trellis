# Planning Review 2

## Channel

- Channel: `channel-lib-worker-lifecycle-arch`
- Architect worker: `arch2`, final seq `3341`, done seq `3342`
- Check worker: `check-plan`, final seq `4648`, done seq `4649`

## Verdict

Fix required before `task.py start`.

## Required Fixes

1. Add `inputSeq` to `turn_started`.
2. Add adapter result fields to `interrupted`: `method` and `outcome`.
3. Remove `queueUntilWorker` from first-version public `DeliveryMode`.
4. Rename `requireLiveWorker` to `requireRunningWorker` because the check is durable projection state, not OS liveness.
5. Split runtime probe from reconciliation; reconciliation must default to no durable writes.
6. Add a provider-injected spawn runtime contract so full issue scope has a concrete `channel.spawn` design without moving CLI supervisor wholesale into core.
7. Add `research/issue-intake.md` to `check.jsonl`.
8. Expand validation plan for worker APIs, runtime probe/reconcile, delivery modes, event schema/spec parity, and raw event contracts.

## Applied Resolution

The task documents should treat these as planning blockers, not implementation details. Implementation should not start until `design.md`, `implement.md`, and context manifests reflect them.
