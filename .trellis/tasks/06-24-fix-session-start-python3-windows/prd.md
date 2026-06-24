# Fix session-start.py python3 portability on Windows

## Goal

H-2 fix: Template source packages/cli/src/templates/shared-hooks/session-start.py hardcodes 'python3' in 5 places (lines 341, 641, 672, 739, 836). Standard Windows lacks 'python3' command. Fix: either placeholder-ize via {{PYTHON_CMD}} or use a cross-platform resolver. Affects all Windows users on fresh install.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start-execution --check`.
