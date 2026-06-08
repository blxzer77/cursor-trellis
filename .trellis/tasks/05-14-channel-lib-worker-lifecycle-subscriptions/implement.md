# Implementation Plan

## Status

Implemented.

Scope decision: this task covers the full issue. The ordered work below was staged for dependency control, not a scope reduction.

## Ordered Work

0. [x] Keep context manifests usable.
   - `implement.jsonl` and `check.jsonl` must use `{"file": "...", "reason": "..."}` entries, not `path` / `description`.
   - `task.py validate` should report non-zero entries before sub-agent execution.

1. [x] Add core worker event/type definitions.
   - Extend `ChannelEventKind`.
   - Add typed event interfaces for `undeliverable`, `interrupt_requested`, `turn_started`, `turn_finished`, and `interrupted`.
   - `turn_started` must include `inputSeq`.
   - `interrupted` must include `method` and `outcome`.
   - Export public types through `packages/core/src/channel/index.ts`.

2. [x] Update specs for event schema and API contracts.
   - Update `.trellis/spec/cli/backend/commands-channel.md`.
   - Update `.trellis/spec/cli/backend/trellis-core-sdk.md`.
   - Keep specs in sync with raw event fields before CLI wrappers are added.

3. [x] Add worker state reducer.
   - New core module under `packages/core/src/channel/internal/store/worker-state.ts`.
   - Implement `reduceWorkerRegistry(events)`.
   - Keep pid out of `WorkerState`.
   - Cover lifecycle, terminal, activity, pending count, inbox policy, and lastSeq.
   - Pending count must derive only from durable events, using `turn_started.inputSeq` as the consumed marker. Do not read host-local inbox cursor files.

4. [x] Add worker read/watch APIs.
   - Add `listWorkers` and `watchWorkers` under `packages/core/src/channel/api/`.
   - Reuse existing `readChannelEvents` / `watchChannelEvents`.
   - Add core tests before CLI integration.

5. [x] Add paginated read API.
   - Extend public read options with `beforeSeq`, `afterSeq`, and `limit`.
   - Preserve read-all behavior when pagination options are absent.
   - Add tests for empty logs, latest-N limit only, beforeSeq, afterSeq, invalid before+after.

6. [x] Add cross-channel watch API.
   - Reuse core path/project helpers and `watchEvents`.
   - Add per-channel cursor map.
   - Add dynamic discovery with polling first; optimize later if needed.
   - Test project scope and global scope.
   - Defer all-scope watch until project/global behavior is stable.

7. [x] Add turn boundary projection.
   - Update adapters/supervisor to append turn boundary events.
   - `turn_started` must bind provider turn to channel `message` through `inputSeq`.
   - Codex can use app-server turn notifications and request ids.
   - Claude may need synthesized turn ids if protocol lacks stable ids.
   - Update `reduceWorkerRegistry` activity and pending count tests.

8. [x] Factor inbox policy.
   - Add `InboxPolicy = "explicitOnly" | "broadcastAndExplicit"`.
   - Store selected policy on durable `spawned.inboxPolicy`; old events project as `explicitOnly`.
   - Keep CLI spawn default as current explicit-only behavior.
   - Move delivery classification to core helper and reuse from supervisor inbox.

9. [x] Add undeliverable handling.
   - Add explicit delivery validation modes.
   - Preserve default append-only/pre-spawn backlog behavior.
   - First-version `DeliveryMode` is `appendOnly | requireKnownWorker | requireRunningWorker`.
   - In strict modes, append message first, then append `undeliverable` for unknown/terminal workers.
   - Ensure default broadcast messages do not create undeliverable.
   - Add CLI tests using raw messages output.

10. [x] Add first-class interrupt.
   - Add durable-only `requestInterrupt`.
   - Add core `interruptWorker(input, runtime)` with injected `WorkerRuntime`.
   - Normalize CLI `--tag interrupt` / future explicit command to the new API.
   - Replace Codex text prefix with provider-level `turn/interrupt` after active turn id is tracked.
   - Keep Claude control_request behavior but describe its cooperative limit.
   - Test unsupported/cooperative/failed interrupt outcomes.

11. [x] Add provider-injected spawn runtime contract.
    - Define `SpawnWorkerInput`, `WorkerRuntime`, `WorkerStartInput`, `WorkerRuntimeHandle`, `WorkerInterruptInput`, `WorkerInterruptResult`, `WorkerStopInput`, and `WorkerStopResult`.
    - Core coordinates event writes and state; CLI adapter registry implements the runtime.
    - Do not import CLI provider adapters from core.

12. [x] Evaluate shared runtime kernel after state is stable.
    - Do not move CLI supervisor wholesale.
    - Move only reusable, CLI-independent primitives behind core APIs.
    - Leave Commander, stdout formatting, and exit codes in CLI.
    - Keep provider adapter process invocation in a Node-only core subpath if necessary; do not put terminal UX into core.

13. [x] Close the issue-level acceptance loop.
    - Verify every issue requirement is represented in core APIs, CLI wrappers, specs, and tests.
    - Post final upstream status back to global `trellis-issue`.

## Risky Files

- `packages/core/src/channel/internal/store/events.ts`
- `packages/core/src/channel/internal/store/watch.ts`
- `packages/core/src/channel/api/read.ts`
- `packages/core/src/channel/api/watch.ts`
- `packages/cli/src/commands/channel/spawn.ts`
- `packages/cli/src/commands/channel/supervisor.ts`
- `packages/cli/src/commands/channel/supervisor/inbox.ts`
- `packages/cli/src/commands/channel/adapters/codex.ts`
- `packages/cli/src/commands/channel/adapters/claude.ts`
- `packages/cli/src/commands/channel/kill.ts`
- `.trellis/spec/cli/backend/commands-channel.md`
- `.trellis/spec/cli/backend/trellis-core-sdk.md`

## Validation Commands

```bash
pnpm --filter @mindfoldhq/trellis-core test
pnpm --filter @mindfoldhq/trellis-core test -- test/channel
pnpm --filter @mindfoldhq/trellis-core build
pnpm --filter @mindfoldhq/trellis test -- test/commands/channel*.test.ts
pnpm --filter @mindfoldhq/trellis lint
pnpm --filter @mindfoldhq/trellis typecheck
python3 ./.trellis/scripts/task.py validate .trellis/tasks/05-14-channel-lib-worker-lifecycle-subscriptions
```

## Review Gates

- Architect review approved the event schema and package boundary before implementation.
- Core tests exist before and alongside CLI wrappers.
- CLI behavior preserves current defaults for existing channel users.
- Specs were updated in the same change as public API/CLI contract changes.
- Final task completion has code, tests, and spec coverage for every row in the design acceptance matrix.
