# Discuss worker dispatcher observability gaps

## Goal

Clarify and prioritize the `trellis-issue` thread
`worker-dispatcher-observability-gaps` into an implementable Trellis channel
runtime plan.

The thread reports four gaps surfaced while wiring a daemon dispatcher to
Trellis channel worker execution:

1. Worker inbox push API / in-process delivery surface.
2. `trellis channel wait --kind` only accepts one kind; dispatcher wants
   `done` or `killed` / warning-style union waits.
3. Supervisor has no pre-kill warning event before lifetime timeout.
4. Historical channel `type:"thread"` / `type:"threads"` logs exist in local
   beta data, but Trellis will not support those names going forward.

This task is now the parent planning task. Implementation is split into child
tasks so each deliverable can be reviewed and verified independently.

## Requirements

- Inspect current `@mindfoldhq/trellis-core` and CLI channel implementation
  before proposing changes.
- Separate what is already solved in `0.6.0-beta.15` from what is still open.
- Keep Vine/product identity and subscription semantics out of Trellis core;
  Trellis should expose channel substrate primitives only.
- Define API/CLI shape for each accepted gap in its owning child task:
  - core function signatures or event schema,
  - CLI flags if applicable,
  - reducer/projection behavior,
  - compatibility behavior if applicable.
- Decide priority and release scope:
  - small CLI/runtime fixes suitable for `0.6.x` / `0.7.x` patch,
  - larger core API work that needs design before implementation.
- Record explicit rejected alternatives to avoid re-opening settled questions.

## Acceptance Criteria

- [ ] PRD records confirmed current behavior from code/help output.
- [ ] Parent PRD records confirmed current behavior from code/help output.
- [ ] Parent task links the independent child tasks and records their
      boundaries.
- [ ] `05-15-channel-wait-supervisor-warnings` owns `wait --kind` union
      behavior and supervisor pre-timeout warning behavior.
- [ ] `05-15-worker-inbox-core-api` owns the worker inbox push / in-process
      delivery API.
- [ ] Legacy `thread` / `threads` compatibility is explicitly out of scope.
- [ ] Child tasks define their own design, implementation plan, and tests
      before implementation starts.

## Child Tasks

| Child task | Scope | Dependency |
| --- | --- | --- |
| `05-15-channel-wait-supervisor-warnings` | CLI/core wait-kind union plus supervisor pre-timeout warning event design and implementation. | Independent. |
| `05-15-worker-inbox-core-api` | Core worker inbox push / in-process delivery API for dispatcher integrations. | Can use wait-union behavior if implemented first, but must not depend on legacy type compatibility. |

## Notes

- Source issue:
  `trellis channel thread trellis-issue worker-dispatcher-observability-gaps --scope global`
- Related prior thread:
  `trellis channel thread trellis-issue vine-trellis-core-sdk-needs --scope global`
- Current quick verification:
  - `trellis channel wait --help` still shows single `--kind <kind>`.
  - `trellis channel post --help` already supports `--stdin` and
    `--text-file`.
  - Core/CLI code contains `undeliverable`, `delivery-mode`, inbox policy,
    `turn_started`, and `turn_finished`.
  - No current `supervisor_warning` event was found.

## Evidence Pass

Inspected sources:

- `trellis channel thread trellis-issue worker-dispatcher-observability-gaps --scope global`
- `trellis channel wait --help`
- `trellis channel send --help`
- `trellis channel create --help`
- `packages/core/src/channel/api/send.ts`
- `packages/core/src/channel/api/read.ts`
- `packages/core/src/channel/api/watch-channels.ts`
- `packages/core/src/channel/api/workers.ts`
- `packages/core/src/channel/internal/store/events.ts`
- `packages/core/src/channel/internal/store/channel-metadata.ts`
- `packages/core/src/channel/internal/store/schema.ts`
- `packages/cli/src/commands/channel/wait.ts`
- `packages/cli/src/commands/channel/supervisor/shutdown.ts`

Confirmed solved in current code:

- `trellis channel post` already supports `--stdin` and `--text-file`.
- `trellis channel send` already supports strict `--delivery-mode` values and
  records `undeliverable` events when strict delivery fails.
- Worker spawn already has an inbox policy surface, and core has worker
  registry helpers for list/watch/probe/reconcile.
- Runtime events already include `turn_started` and `turn_finished`.
- Core read APIs already support cursor pagination, and `watchChannelEvents`
  / `watchChannels` provide file-backed event watching primitives.

Confirmed open:

- `trellis channel wait --kind` accepts one event kind only; no CSV or
  `--kind-any` union syntax exists.
- No `supervisor_warning` event or pre-timeout warning policy exists in the
  supervisor shutdown path.
- Legacy channel `type:"thread"` / `type:"threads"` is intentionally not
  normalized to `forum`; metadata projection currently falls back to `chat`,
  and `parseChannelType` rejects those values. This remains unsupported by
  product decision.
- A direct in-process worker inbox push API is not present. Current code has
  adjacent primitives (`sendMessage`, `watchChannelEvents`, worker registry),
  but no first-class `deliver()` / `runWorkerInbox()` style core API.

Repository-answerable questions already resolved:

- `post --text-file` / `--stdin` does not need to be designed in this task.
- Wait-union behavior needs CLI parsing and event filter semantics, not a
  broader runtime rewrite.

Remaining product decisions:

- Whether `supervisor_warning` is required in the same release as wait union
  and legacy compatibility.
- What delivery semantics the in-process worker inbox API must guarantee.

## Brainstorm Rounds

1. Decision: first implementation slice.
   Evidence: Current code already has post text-file/stdin, strict delivery,
   worker registry, runtime events, and event watching. It still lacks
   wait-kind unions, supervisor pre-timeout warnings, legacy forum projection,
   and a direct worker inbox API.
   User answer: Do not implement legacy `thread` / `threads` compatibility.
   Beta data can be manually edited locally; Trellis should not carry forward
   the old type names.
   Resulting requirement: Keep accepted channel types as `chat` and `forum`.
   Do not add old-type projection, old-type aliases, or a migrate command for
   `thread` / `threads`.

2. Decision: task split.
   Evidence: `wait --kind` union and supervisor pre-timeout warning share the
   channel wait/supervisor operational surface. Worker inbox push API is a
   separate core substrate/API design.
   User answer: Split into two child tasks. Put items 1 and 2 together; put
   item 3 in a separate task.
   Resulting requirement: Parent task owns source requirements and final
   integration review. Child `05-15-channel-wait-supervisor-warnings` owns
   wait union plus supervisor warning. Child `05-15-worker-inbox-core-api`
   owns worker inbox API.

## Out of Scope

- Legacy `thread` / `threads` channel type compatibility. Existing beta-local
  data may be manually corrected; Trellis core and CLI should not preserve
  those names as supported aliases.
