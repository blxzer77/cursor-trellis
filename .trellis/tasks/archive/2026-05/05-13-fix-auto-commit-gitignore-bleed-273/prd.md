# fix archive auto-commit: narrow scope + phantom-delete

## Goal

Fix two real bugs in `task.py archive`'s auto-commit:

1. **Scope-creep**: `git add -A .trellis/tasks` stages dirty state in
   EVERY task directory, not just the one being archived. Side effect:
   archiving task A bundles unrelated changes from other in-progress
   task dirs into the same `chore(task): archive` commit.
2. **Phantom-delete**: after `shutil.move(<task>, archive/...)`, the
   subsequent `git add -A .trellis/tasks` does not pick up the deletes
   at the source location, leaving the working tree dirty with tracked
   files that don't physically exist (we hit this 2026-05-12 when
   archiving `05-12-trellis-agent-runtime`; had to follow up with a
   manual fixup commit `8fae0a5`).

`add_session.py` keeps the wider scope by design — its commit is the
session journal sweep across `.trellis/workspace/` + `.trellis/tasks/`,
which is meant to be cross-task.

## Out of scope (explicit)

- **Issue #273** (gitignore-bleed): user error, not a Trellis bug.
  Already-tracked files don't respect `.gitignore`; that's standard
  git behaviour. Reply with `git rm --cached` guidance; close wontfix.
- Allowlist / .trellisignore mechanism: rejected after brainstorm —
  Trellis treats task dirs as fully-owned territory, the issue was
  user expecting gitignore to retroactively untrack.
- Tool-assisted migration / `trellis cleanup` command.

## What I already know

`task.py archive` calls `_auto_commit_archive` (`.trellis/scripts/common/task_store.py:385-403`):

```python
def _auto_commit_archive(task_name: str, repo_root: Path) -> None:
    tasks_rel = f"{DIR_WORKFLOW}/{DIR_TASKS}"        # ".trellis/tasks"
    run_git(["add", "-A", tasks_rel], cwd=repo_root)
    rc, _, _ = run_git(
        ["diff", "--cached", "--quiet", "--", tasks_rel], cwd=repo_root
    )
    if rc == 0: return  # nothing staged
    commit_msg = f"chore(task): archive {task_name}"
    run_git(["commit", "-m", commit_msg], cwd=repo_root)
```

Two problems:
1. `tasks_rel = ".trellis/tasks"` — too broad. Should be just the
   archived task's new location AND its original location.
2. `git add -A` with a path arg DOES include deletions in general, but
   the 2026-05-12 incident showed the source deletes were not staged.
   Need to reproduce + identify the actual cause (likely interaction
   with `shutil.move` and pathspec resolution).

## Requirements (evolving)

- Archive auto-commit only stages files inside:
  - `.trellis/tasks/archive/<YYYY-MM>/<task-name>/` (new location)
  - `.trellis/tasks/<task-name>/` (deletes at original location)
- Archive auto-commit does NOT touch other task dirs in `.trellis/tasks/`.
- After `task.py archive <name>`, working tree is clean — no phantom
  deletes, no leftover modifications, no other tasks pulled in.

## Acceptance Criteria

- [ ] Reproduction test: create two active task dirs A and B; modify
      a file in B; archive A; assert the resulting commit contains
      ONLY paths under A's old + new location (no B paths).
- [ ] Reproduction test: archive a task whose dir contains 50+ tracked
      files; assert the resulting commit has both the inserts at the
      archive destination AND the deletes at the source location;
      `git status` clean afterward.
- [ ] Manual smoke: archive `05-12-trellis-agent-runtime` (we already
      did this once and hit the phantom delete) — verify the fix
      eliminates it.
- [ ] No regression in `add_session.py` (its broader scope is
      intentional and stays unchanged).

## Definition of Done

- Unit tests covering the two reproductions above
- Lint / typecheck / vitest green
- Manual smoke against real archive flow
- Both source-of-truth locations updated:
  - `packages/cli/src/templates/trellis/scripts/common/task_store.py`
  - `.trellis/scripts/common/task_store.py` (local copy, kept in sync)

## Technical Notes

- The source of truth lives in
  `packages/cli/src/templates/trellis/scripts/common/task_store.py`;
  `.trellis/scripts/` is the local copy templated by `trellis init`.
- Probable fix for #1 (scope): pass the two specific paths to
  `git add -A`:
  ```python
  source_rel = f"{tasks_rel}/{task_name}"
  archive_rel = f"{tasks_rel}/archive/{year_month}/{task_name}"
  run_git(["add", "-A", "--", source_rel, archive_rel], cwd=repo_root)
  ```
- Probable fix for #2 (phantom-delete): need to reproduce first to
  understand why `-A` missed the deletes. Hypothesis: `shutil.move`
  uses `os.rename` which on some platforms might lose the index entry
  in a way `-A` doesn't catch. Fallback: explicit
  `run_git(["rm", "-r", "--cached", "--", source_rel])` BEFORE the
  add, so source deletion is staged unconditionally.

## Out of scope (extra)

- `add_session.py` scope change (intentionally workspace-wide).
- `.DS_Store` filtering: that's a user gitignore concern; if Trellis
  ever needs to do this, do it in a separate change.

## Open questions

- None blocking. Implementation can proceed.
