# Change Local Task Lifecycle

Task lifecycle includes creation, selection, execution start, context configuration, archive, parent/child tasks, and lifecycle hooks. The default customization targets are `.cstl/tasks/`, `.cstl/config.yaml`, and `.cstl/scripts/`.

## Read These Files First

1. `.cstl/workflow.md`
2. `.cstl/config.yaml`
3. `.cstl/scripts/task.py`
4. `.cstl/scripts/common/task_store.py`
5. `.cstl/scripts/common/task_utils.py`
6. The selected task's `.cstl/tasks/<task>/task.json`

## Common Needs And Edit Points

| Need | Edit point |
| --- | --- |
| Automatically sync an external system after task creation | `hooks.after_create` in `.cstl/config.yaml`. |
| Automatically update status after execution start | `hooks.after_start` in `.cstl/config.yaml`. |
| Clean external resources after archive | `hooks.after_archive` in `.cstl/config.yaml`. |
| Change default task fields | `.cstl/scripts/common/task_store.py`. |
| Change task parsing/search | `.cstl/scripts/common/task_utils.py`. |
| Change selected task behavior | `.cstl/scripts/common/active_task.py`. |

## lifecycle hooks

`.cstl/config.yaml` supports:

```yaml
hooks:
  after_create:
    - "python3 .cstl/scripts/hooks/my_sync.py create"
  after_start:
    - "python3 .cstl/scripts/hooks/my_sync.py start"
  after_archive:
    - "python3 .cstl/scripts/hooks/my_sync.py archive"
```

Hook commands receive the `TASK_JSON_PATH` environment variable, pointing to the task's `task.json`. Hook failures should usually warn, but not block the main task operation.

## Change Task Fields

If the user wants to add project-local fields, prefer putting them under `meta` in `task.json` to avoid breaking existing scripts' assumptions about standard fields.

Example:

```json
"meta": {
  "linearIssue": "ENG-123",
  "risk": "high"
}
```

If standard fields really need to change, inspect every local script that reads `task.json`.

## Change Selected Task

Selected task is session-level state stored in `.cstl/.runtime/sessions/`. Do not fall back to a global `.current-task` model. If the user wants to change selected task behavior, edit:

- `.cstl/scripts/common/active_task.py`
- platform hooks or shell session bridges
- selected task descriptions in `.cstl/workflow.md`

### `task.py create` Does Not Select

`cmd_create` in `.cstl/scripts/common/task_store.py` writes the task directory and planning artifacts only. The behavior:

- The task's `status=planning` is written.
- No selected-task pointer is written, even when session identity exists.
- The user or AI selects the task later with `task.py select <dir>` when they explicitly choose to enter it.

This keeps new sessions and bare task creation at `Selected task: none` until a live-session choice is made.

If you fork `task.py` to add a new creation path (e.g. an external import that bypasses `cmd_create`), audit that it does not auto-select or auto-start the created task. The full status writer table is in `.cstl/spec/cli/backend/workflow-state-contract.md`.

## Modification Steps

1. Confirm the selected task with `python3 ./.cstl/scripts/task.py selected --source`.
2. Read the selected task's `task.json` and confirm status and fields.
3. For configuration needs, edit `.cstl/config.yaml` first.
4. For script behavior needs, then edit `.cstl/scripts/`.
5. If the AI flow changed, synchronize `.cstl/workflow.md`.

## Do Not

- Do not directly edit `.cstl/.runtime/sessions/` to "fix" business state.
- Do not hard-code project-private fields into scripts; prefer `meta`.
- Do not default to asking the user to fork Trellis CLI.
