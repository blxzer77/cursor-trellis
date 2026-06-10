# Parent/Child Task Map

Parent/Child orchestration is task-local and artifact-driven. The Parent task owns `task-map.md`, cross-child acceptance, serial integration authority, and final Child terminal state. The Child task owns its implementation evidence and handoff artifacts.

## Commands

| Command | Owner | Contract |
| --- | --- | --- |
| `task.py set-child-state <parent> <child> <state> --evidence <ref>` | Child / Worker reporting | Records only Child-reported states: `open`, `working`, `blocked`, `review`. It cannot set Parent-controlled acceptance or integration states. |
| `task.py prepare-child-worktree <parent> <child> --branch <branch> [--base <ref>] [--path <path>] [--check]` | Parent Supervisor | Creates or checks out a Child Git worktree under `.trellis/worktrees/`, then records branch/path/base metadata in Child `task.json` and Parent `task-map.md`. `--check` validates without creating a worktree or writing artifacts. |
| `task.py integrate-child <parent> <child> <state> --evidence <ref> [--ref <git-ref>] [--reason <text>] [--execute-merge] [--check]` | Parent Supervisor | Records Parent-controlled states: `changes`, `accepted`, `integrating`, `integrated`, `cancelled`. `--check` runs the same guard without writing. `--execute-merge` is valid only for `integrated` and runs `git merge --no-ff --no-commit <git-ref>` before recording the terminal state. |

By default, `integrate-child` still records Parent decisions and reviewed refs/diff evidence only. Git worktree creation and merge execution require explicit command flags so source mutation remains visible and reviewable.

## State Boundary

Child-reported states:

- `open`
- `working`
- `blocked`
- `review`

Parent-controlled states:

- `changes`
- `accepted`
- `integrating`
- `integrated`
- `cancelled`

Parent-controlled transitions are guarded:

- `accepted` and `changes` require current Child state `review`.
- `integrating` requires current Child state `accepted`.
- `integrated` requires current Child state `integrating`.
- `accepted`, `integrating`, and `integrated` require non-empty Child `verify.md`, non-empty Child `handoff.md`, and `--ref`.
- `changes` and `cancelled` require `--reason`.
- `integrating` enforces Parent `merge_limit`; default `merge_limit: 1` blocks a second concurrently integrating Child.
- `prepare-child-worktree` requires a valid Git repository, a valid branch name, a base ref that resolves to a commit, and a worktree path under `.trellis/worktrees/`.
- `integrate-child ... integrated --execute-merge` requires current Child state `integrating`, a merge ref that resolves to a commit, and no non-Trellis working tree changes before running `git merge --no-ff --no-commit`.

## Task Map Evidence

`task-map.md` frontmatter records:

- `contract_epoch`
- `execution_topology`
- `merge_limit`
- Child `state`
- Child `depends_on`
- Child `touches`
- Child `isolation`
- Child `ref`
- Child `branch`
- Child `worktree_path`
- Child `base_ref`
- Child `merged_ref`
- compact evidence and reason fields when present
- `integration_queue`

The body Event Log records link/unlink events, Child-reported state changes, and Parent integration decisions. Event Log entries are the durable place for conflict, validation-failure, scope-conflict, and cancellation reasons in v1.

`contract_epoch` is the Parent contract freshness marker. When it changes, Child `child-review` quality gate fingerprints and Parent-controlled `parent-*` integration fingerprints become stale and must be refreshed before those gate records can be trusted again.

Child handoff refs and Parent Event Log reviewed change-set notes are also fingerprint inputs for post-implementation review and integration gates. Keep them compact, for example `Ref: refs/heads/child-task` in `handoff.md` or `Reviewed change-set: refs/changes/child-task-1` in the Parent `task-map.md` body.

## Archive Boundary

Child archive still requires the Parent `task-map.md` to mark that Child `integrated` or `cancelled`. Parent archive requires every structural Child to be `integrated` or `cancelled`, and Parent `verify.md` must contain final integration evidence before archive.

This integration layer records and guards Parent decisions, can prepare Child Git worktrees, and can execute an explicit no-commit merge for a Child marked `integrated`. It still does not perform semantic conflict detection automatically; merge conflicts must be resolved or aborted by the operator before recording terminal success.
