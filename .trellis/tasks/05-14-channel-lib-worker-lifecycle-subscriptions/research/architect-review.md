# Architect Review

## Channel

- Channel: `channel-lib-worker-lifecycle-arch`
- Worker: `arch`
- Done seq: `1776`
- Final answer seq: `1775`

## Conclusion

The task direction is valid, but the first design draft was too broad in two places:

1. Do not move CLI supervisor wholesale into core. Core should own reusable channel substrate and typed primitives; CLI/provider execution should remain injectable or stay in CLI until a smaller runtime kernel is designed.
2. Do not make default `sendMessage` write `undeliverable` for unknown workers. Current behavior supports pre-spawn backlog delivery. Strict delivery validation must be opt-in.

## Findings

### 1. `spawn` cannot move wholesale into core

Current supervisor includes provider binaries, CLI entry resolution, agent prompt assembly, `process.exit`, pid files, signal handling, and terminal behavior. Moving that whole module into core would make core a Claude/Codex launcher instead of a stable SDK.

Recommended boundary:

- Core: event schema, worker reducer, read/watch, delivery policy, cursor store, typed supervisor primitives.
- CLI: argv, agent loading, prompt assembly, provider adapter registry, terminal rendering, exit code.
- Future shared runtime: a `WorkerRuntime` / `SupervisorKernel` shape only if it is provider/process-controller injected and CLI-independent.

### 2. `undeliverable` must not break pre-spawn backlog

Current inbox starts with cursor `0` on first run and reads backlog. If `send --to worker` writes `undeliverable` before a worker exists, it would mark a message failed even though spawning that worker later can still consume it.

The design needs explicit delivery validation modes:

- `appendOnly`: preserve current append-only behavior.
- `requireKnownWorker`: fail/signal if worker has never existed.
- `requireLiveWorker`: fail/signal if worker is not currently running.
- `queueUntilWorker`: durable queue semantics, if implemented later.

CLI default should remain compatible.

### 3. Worker state needs durable projection and runtime probe separation

`reduceWorkerRegistry(events)` should be the durable SOT. Local pid checks are runtime observations, not reducer input. A runtime probe may be layered on top, but should not silently rewrite durable history.

### 4. Inbox policy naming should reflect existing broadcast semantics

Existing channel spec says omitted `to` is broadcast, but workers currently consume only explicit `to`. Better names:

- `explicitOnly`: current default.
- `broadcastAndExplicit`: consume broadcast plus explicitly addressed messages.
- `mentionsOnly`: future text/metadata mention mode, not first version.

Policy should only apply to `kind:"message"`.

### 5. Interrupt depends on turn model

Implement turn boundary events before provider interrupt. Suggested events:

- `turn_started { worker, turnId, inputSeq }`
- `turn_finished { worker, turnId, outcome }`
- `interrupt_requested { worker, turnId?, reason? }`
- `interrupted { worker, turnId?, method, outcome }`

Adapters must surface unsupported/cooperative outcomes explicitly.

## Design Changes To Apply

- Add compatibility section for existing `explicitOnly` inbox and pre-spawn backlog.
- Split worker state into durable projection and runtime probe.
- Replace `mentions/messages` first-version inbox naming with `explicitOnly/broadcastAndExplicit`.
- Make `undeliverable` opt-in via delivery mode.
- Put turn events before `interruptWorker`.
- Limit first cross-channel watch to explicit project/global scope; defer `all`.
