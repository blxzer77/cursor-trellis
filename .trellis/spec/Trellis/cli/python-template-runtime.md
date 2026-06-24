# Python Template Runtime

## Runtime Boundary

The Python runtime under `packages/cli/src/templates/trellis/scripts/` is generated into user projects. It must stay portable and conservative.

Key files:

- `task.py` exposes task lifecycle commands.
- `get_context.py` builds session and package context.
- `common/task_store.py` owns task persistence and archive behavior.
- `common/session_context.py` owns selected-task and context reporting.
- `hooks/linear_sync.py` is optional lifecycle integration.

## Rules

- Keep generated scripts dependency-light and Python-version-compatible with Trellis init requirements.
- Preserve machine-readable task JSON fields and field order when writing `task.json`.
- Keep user-facing command examples platform-neutral unless a template is platform-specific.
- Do not assume the project root is a Git repository; package repos may be independent.
- Treat `.trellis/` ignore status and `session_auto_commit` carefully; scripts may need to skip Git operations.

## Testing

Changes usually require:

- `packages/cli/test/scripts/*.test.ts`
- `packages/cli/test/commands/*integration.test.ts`
- Any core task schema tests if JSON shape changes.

For Python syntax in generated scripts, use the project test path that copies templates into temp projects instead of editing installed project scripts directly.

