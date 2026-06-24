---
parent_id: fix-hook-health-native-byok
contract_epoch: 1
execution_topology: serial
merge_limit: 1
children:
  - id: 06-24-fix-session-start-python3-windows
    state: integrated
    depends_on: []
    touches: []
    isolation: git-worktree
    ref: 7694ab74
    evidence: task-map.md
  - id: 06-24-backport-bom-strip-subagent-hook
    state: integrated
    depends_on: []
    touches: []
    isolation: git-worktree
    ref: 2429f8fe
    evidence: task-map.md
  - id: 06-24-sync-dogfooding-hooks
    state: integrated
    depends_on: []
    touches: []
    isolation: git-worktree
    ref: 2429f8fe
    evidence: task-map.md
  - id: 06-24-handle-beforesubmitprompt-unreliability
    state: integrated
    depends_on: []
    touches: []
    isolation: git-worktree
    ref: 2429f8fe
    evidence: task-map.md
  - id: 06-24-cleanup-debug-hooks
    state: integrated
    depends_on: []
    touches: []
    isolation: git-worktree
    ref: 2429f8fe
    evidence: task-map.md
integration_queue: []
---
# Task Map

## Orchestration notes

- `execution_topology: parallel` — children with empty `depends_on` may run concurrently; Parent integrates serially up to `merge_limit`.
- Child-reported states: `open` → `working` → `blocked` | `review`.
- Parent-controlled states: `review` → `changes` | `accepted` → `integrating` → `integrated` | `cancelled`.
- Declare `touches` per child before dispatch to reduce merge conflicts.
- `isolation: git-worktree` — run `prepare-child-worktree` from the **git package root** (not a non-git harness root).

## Event Log

- 2026-06-24T10:02:25Z - Linked Child `06-24-fix-session-start-python3-windows`.

- 2026-06-24T10:02:27Z - Linked Child `06-24-backport-bom-strip-subagent-hook`.

- 2026-06-24T10:02:52Z - Linked Child `06-24-sync-dogfooding-hooks`.

- 2026-06-24T10:02:54Z - Linked Child `06-24-handle-beforesubmitprompt-unreliability`.

- 2026-06-24T10:02:56Z - Linked Child `06-24-cleanup-debug-hooks`.

- 2026-06-24T12:31:40Z - Set Child `06-24-fix-session-start-python3-windows` state to `review`. Evidence: verify.md.

- 2026-06-24T12:32:03Z - Parent set Child `06-24-fix-session-start-python3-windows` integration state to `accepted`. Evidence: handoff.md. Ref: 7694ab74.

- 2026-06-24T12:32:03Z - Parent set Child `06-24-fix-session-start-python3-windows` integration state to `integrating`. Evidence: task-map.md. Ref: 7694ab74.

- 2026-06-24T12:32:03Z - Parent set Child `06-24-fix-session-start-python3-windows` integration state to `integrated`. Evidence: task-map.md. Ref: 7694ab74.

- 2026-06-24T12:32:10Z - Set Child `06-24-backport-bom-strip-subagent-hook` state to `review`. Evidence: verify.md.

- 2026-06-24T12:32:10Z - Parent set Child `06-24-backport-bom-strip-subagent-hook` integration state to `accepted`. Evidence: handoff.md. Ref: 2429f8fe.

- 2026-06-24T12:32:10Z - Parent set Child `06-24-backport-bom-strip-subagent-hook` integration state to `integrating`. Evidence: task-map.md. Ref: 2429f8fe.

- 2026-06-24T12:32:11Z - Parent set Child `06-24-backport-bom-strip-subagent-hook` integration state to `integrated`. Evidence: task-map.md. Ref: 2429f8fe.

- 2026-06-24T12:32:12Z - Set Child `06-24-handle-beforesubmitprompt-unreliability` state to `review`. Evidence: verify.md.

- 2026-06-24T12:32:12Z - Parent set Child `06-24-handle-beforesubmitprompt-unreliability` integration state to `accepted`. Evidence: handoff.md. Ref: 2429f8fe.

- 2026-06-24T12:32:13Z - Parent set Child `06-24-handle-beforesubmitprompt-unreliability` integration state to `integrating`. Evidence: task-map.md. Ref: 2429f8fe.

- 2026-06-24T12:32:13Z - Parent set Child `06-24-handle-beforesubmitprompt-unreliability` integration state to `integrated`. Evidence: task-map.md. Ref: 2429f8fe.

- 2026-06-24T12:32:14Z - Set Child `06-24-sync-dogfooding-hooks` state to `review`. Evidence: verify.md.

- 2026-06-24T12:32:14Z - Parent set Child `06-24-sync-dogfooding-hooks` integration state to `accepted`. Evidence: handoff.md. Ref: 2429f8fe.

- 2026-06-24T12:32:15Z - Parent set Child `06-24-sync-dogfooding-hooks` integration state to `integrating`. Evidence: task-map.md. Ref: 2429f8fe.

- 2026-06-24T12:32:15Z - Parent set Child `06-24-sync-dogfooding-hooks` integration state to `integrated`. Evidence: task-map.md. Ref: 2429f8fe.

- 2026-06-24T12:32:16Z - Set Child `06-24-cleanup-debug-hooks` state to `review`. Evidence: verify.md.

- 2026-06-24T12:32:16Z - Parent set Child `06-24-cleanup-debug-hooks` integration state to `accepted`. Evidence: handoff.md. Ref: 2429f8fe.

- 2026-06-24T12:32:17Z - Parent set Child `06-24-cleanup-debug-hooks` integration state to `integrating`. Evidence: task-map.md. Ref: 2429f8fe.

- 2026-06-24T12:32:17Z - Parent set Child `06-24-cleanup-debug-hooks` integration state to `integrated`. Evidence: task-map.md. Ref: 2429f8fe.
