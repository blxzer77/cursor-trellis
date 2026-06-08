# Implementation Review

## Channel

- Channel: `channel-lib-worker-lifecycle-impl`
- Implement worker: `impl-core`
- Check workers: `check-2`, `check-3`, `check-4`, `check-5`

## Findings Resolved

1. `watchChannels` child watchers leaked after abort.
   - Fix: track child watcher controllers and tasks, abort and await them during generator cleanup, and call `gen.return()` in tests after abort.
2. `watchEvents` did not handle asynchronous `fs.watch` errors.
   - Fix: core and CLI watch stores attach `FSWatcher#error` handlers, close the watcher, and keep the 200ms polling fallback alive.
3. Real CLI workers did not emit durable turn boundaries.
   - Fix: supervisor inbox emits `turn_started` with `inputSeq` before delivering stdin, stdout pump emits `turn_finished` on terminal adapter events, and a local `TurnTracker` links the pair.
4. Strict delivery existed only in core.
   - Fix: CLI `trellis channel send --delivery-mode` now passes `appendOnly | requireKnownWorker | requireRunningWorker` through to core and has coverage.
5. Task/spec artifacts exposed an internal project name.
   - Fix: touched specs, task docs, code, and tests were scanned and sanitized.

## Final Validation

```bash
env -u TRELLIS_HOOKS pnpm --filter @mindfoldhq/trellis-core exec vitest run test/channel/channel-runtime.test.ts
pnpm --dir packages/core exec vitest run test/channel/channel-runtime.test.ts
pnpm --filter @mindfoldhq/trellis-core typecheck
pnpm --filter @mindfoldhq/trellis-core lint
pnpm --filter @mindfoldhq/trellis-core test
pnpm --filter @mindfoldhq/trellis-core build
pnpm --filter @mindfoldhq/trellis typecheck
pnpm --filter @mindfoldhq/trellis lint
cd packages/cli && npx vitest run test/commands/channel.test.ts test/commands/channel-codex-adapter.test.ts
./.trellis/scripts/task.py validate .trellis/tasks/05-14-channel-lib-worker-lifecycle-subscriptions
```

All listed commands passed. One earlier CLI channel test run failed because it raced a parallel `trellis-core build` that cleaned `packages/core/dist`; rerunning the CLI tests after the build completed passed.
