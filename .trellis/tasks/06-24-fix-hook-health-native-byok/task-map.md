---
parent_id: fix-hook-health-native-byok
contract_epoch: 1
execution_topology: serial
merge_limit: 1
children:
  - id: 06-24-fix-session-start-python3-windows
    state: open
    depends_on: []
    touches: []
    isolation: git-worktree
    ref: null
  - id: 06-24-backport-bom-strip-subagent-hook
    state: open
    depends_on: []
    touches: []
    isolation: git-worktree
    ref: null
  - id: 06-24-sync-dogfooding-hooks
    state: open
    depends_on: []
    touches: []
    isolation: git-worktree
    ref: null
  - id: 06-24-handle-beforesubmitprompt-unreliability
    state: open
    depends_on: []
    touches: []
    isolation: git-worktree
    ref: null
  - id: 06-24-cleanup-debug-hooks
    state: open
    depends_on: []
    touches: []
    isolation: git-worktree
    ref: null
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
