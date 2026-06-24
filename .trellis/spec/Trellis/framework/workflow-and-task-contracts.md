# Workflow And Task Contracts

## Canonical Task Shape

`packages/core/src/task/schema.ts` defines the canonical 24-field task record and field order. It intentionally mirrors the Python writer under generated `.trellis/scripts/common/task_store.py`.

Rules:

- Do not redefine task shape in new code.
- Preserve `TASK_RECORD_FIELD_ORDER` unless the Python runtime and tests are updated together.
- Unknown fields may be preserved on disk, but canonical parsing should reject missing required fields.
- Task lifecycle changes must update TypeScript core tests and generated Python scripts/tests together.

## Workflow Phases

The generated workflow is under `packages/cli/src/templates/trellis/workflow.md`. It is runtime input, not just documentation.

When changing workflow semantics:

- Update tests that assert session start, task dashboard, execution gate, archive guard, and quality gate behavior.
- Keep selected-task behavior explicit: session selection is separate from task status mutation.
- Preserve planning/execution/archive boundaries unless the task explicitly changes them.
- Avoid changing prompt blocks without checking platform hook injection and sub-agent dispatch behavior.

## Channel And Memory Contracts

`packages/core/src/channel/internal/store/schema.ts` shows the local style: string unions, explicit parsers, legacy rejection, and normalized output.

Rules:

- Parse external string values through small parser helpers.
- Reject legacy spellings at write boundaries instead of silently normalizing new writes.
- Keep context entries structured as `file` or `raw`; require absolute file paths where the API says so.
- Add tests for both accepted and rejected values.

## Evidence

Reference files:

- `packages/core/src/task/schema.ts`
- `packages/core/src/task/phase.ts`
- `packages/core/src/channel/internal/store/schema.ts`
- `packages/cli/src/templates/trellis/scripts/common/task_store.py`
- `packages/cli/test/scripts/task-archive.integration.test.ts`

