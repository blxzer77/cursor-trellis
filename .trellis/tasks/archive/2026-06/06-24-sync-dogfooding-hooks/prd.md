# Sync dogfooding cursor-trellis/.cursor/hooks to latest template source

## Goal

C-1 + H-1 fix: cursor-trellis/.cursor/hooks/ is out of sync with template source. Critical: hooks.json registers inject-retrieval-plan.py but the file is MISSING (beforeSubmitPrompt fails every prompt). Also inject-subagent-context.py is the old 25KB full-implementation version while template source is the new 7.6KB thin-wrapper version (delegates to common.subagent_dispatch, matches D-1 dispatch policy). Re-sync all 5 hooks from packages/cli/src/templates/shared-hooks/ + ensure hooks.json PYTHON_CMD resolution.

## Requirements

- TBD

## Acceptance Criteria

- [x] All five hooks registered in hooks.json exist under `.cursor/hooks/`
- [x] Dogfood hook files normalized-match template source in `packages/cli/src/templates/shared-hooks/`

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start-execution --check`.
