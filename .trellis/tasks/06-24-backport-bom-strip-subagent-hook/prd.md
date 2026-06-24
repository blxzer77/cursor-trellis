# Backport BOM strip patch to template inject-subagent-context.py

## Goal

M-2 fix: Workspace-root .cursor/hooks/inject-subagent-context.py has a UTF-8 BOM strip patch (input_text.startswith('\\ufeff')) that is missing from template source packages/cli/src/templates/shared-hooks/inject-subagent-context.py (uses bare json.load(sys.stdin)). On Windows, BOM-prefixed stdin causes silent JSONDecodeError exit(0) with no context injected and no warning. Backport the patch + ValueError handling to template source.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start-execution --check`.
