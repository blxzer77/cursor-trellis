# fix: Python 3.9 compatibility — add future annotations

## Goal

Fix Python 3.9 compatibility issue (#113). Trellis Python scripts use `X | Y` union type syntax (PEP 604, Python 3.10+), causing runtime errors on Python 3.9.

## Requirements

- Add `from __future__ import annotations` to all 21 affected Python files in `.trellis/scripts/`
- Add the same to all corresponding template copies in `packages/cli/src/templates/trellis/scripts/`
- Verify both copies remain identical after changes
- Consider adding Python version check during `trellis init`

## Affected Files (21)

- add_session.py
- common/cli_adapter.py, config.py, developer.py, git.py, io.py
- common/packages_context.py, paths.py, registry.py, session_context.py
- common/task_context.py, task_queue.py, task_store.py, task_utils.py, tasks.py, types.py, worktree.py
- hooks/linear_sync.py
- multi_agent/create_pr.py, status_display.py, status_monitor.py

## Acceptance Criteria

- [ ] All scripts work on Python 3.9+
- [ ] `from __future__ import annotations` added to all affected files
- [ ] Template copies identical to live scripts
- [ ] `pnpm test` passes
- [ ] No `tuple[...]` runtime usage (only in annotations)

## Technical Notes

- `from __future__ import annotations` makes all annotations strings (PEP 563), so `X | Y` works on 3.9
- Must check for runtime type usage like `isinstance(x, str | int)` — those need `Union[str, int]` instead
- GitHub issue: #113
