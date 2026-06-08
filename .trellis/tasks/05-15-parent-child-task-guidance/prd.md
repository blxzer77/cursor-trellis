# Document parent child task guidance

## Goal

Make Trellis parent/child task behavior discoverable in the main workflow, specs, and local architecture guidance so agents use task trees consistently instead of treating them as an undocumented script feature.

## Confirmed Facts

- `task.py create` already accepts `--parent <dir>`.
- `task.py add-subtask` and `task.py remove-subtask` already maintain parent/child links for existing tasks.
- `task.json` already stores `children` on the parent and `parent` on the child.
- `script-conventions.md` already defines the archive invariant: `children` is a historical list and archived children remain counted for progress.
- `workflow.md` lists the commands but does not explain when to create a parent task, what the parent owns, or how child tasks should declare dependencies.
- The local `trellis-meta` task-system reference contains stale archive guidance that contradicts the current invariant.

## Requirements

- Add parent/child task guidance to the Trellis workflow template and the current local workflow copy.
- Document the parent/child planning contract in the CLI backend platform integration spec.
- Update local architecture references so meta guidance explains the current parent/child model and archive invariant.
- Keep the guidance product-level and agent-facing: parent tasks group related deliverables; child tasks remain independently verifiable; dependency ordering belongs in each child task artifact.
- Do not change task script behavior in this task.

## Acceptance Criteria

- [x] Workflow guidance explains when to use parent/child task trees.
- [x] Workflow guidance explains parent vs child responsibilities.
- [x] Spec guidance documents the command surface, metadata fields, and archive/progress invariant.
- [x] Local architecture guidance no longer says archived child tasks are removed from the parent.
- [x] Relevant template checks pass.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
