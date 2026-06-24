# Clean up debug hook scaffolding and stale logs

## Goal

M-3 fix: D:\MyHarness\.cursor\hooks/ contains 5 *-debug.py scaffolding files (inject-retrieval-plan-debug.py etc.) not registered in hooks.json. inject-retrieval-plan-debug.py hardcodes log path d:\MyHarness\.trellis\beforesubmit-debug.log (non-portable). Remove debug scripts + beforesubmit-debug.log; if debugging still needed, register a separate hooks.debug.json or document the manual workflow. Low risk but reduces confusion.

## Requirements

- TBD

## Acceptance Criteria

- [ ] TBD

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start-execution --check`.
