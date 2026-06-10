# Archive / Learning Guards

`task.py archive <task>` is the only task completion writer. Archive readiness is evidence-based and is enforced by `common/task_gates.py`, not by workflow text alone.

## Archive Preflight

`task.py archive <task> --check` must call the same guard path as the real archive command and must not mutate state. It must not:

- write task artifacts or `task.json`;
- set `status=completed`;
- move the task directory;
- clear selected-task runtime files;
- stage, commit, or run archive hooks.

Use `--check` before asking the user to proceed with real archive when evidence is incomplete or uncertain.

## Verify Evidence

`verify.md` is the human-readable evidence center before archive. Every archived durable task must include:

- validation evidence;
- final acceptance evidence, such as `Acceptance: PASS`, `Final acceptance: ...`, or `Accepted by user: ...`;
- gate/review evidence references when applicable;
- a durable-learning decision.

The durable-learning decision must be either:

- a link or note for a spec update, `retrospective.md`, or other learning artifact; or
- an explicit `No durable learning` decision.

Parent tasks with structural children must also include final integration evidence in Parent `verify.md`, such as `Integration: PASS` or `Final integration evidence: ...`.

Do not store long validation logs, screenshots, or review bodies in `task.json`. Keep `task.json.quality_gate_results` compact and link back to `verify.md` or Parent `task-map.md`.

## Gate State

Full Tasks must satisfy required `full-task-complete` gates before archive. Required gates must be current for the task's contract and artifacts, and must be `PASS` or valid user-approved `SKIPPED`.

Archive must reject:

- missing required gate records;
- required `FAIL` records;
- stale contract fingerprints;
- stale artifact fingerprints;
- invalid `SKIPPED` metadata.

`baseline-check` is CLI-owned. It is written or refreshed by the archive command for Full Task completion when the guard passes; users and reviewers must not record it manually.

## Completion Boundary

Passing validation, recording user acceptance, writing `verify.md`, or recording reviewer gate `PASS` never marks a task completed. Only real `task.py archive <task>` may set `status=completed` and move the task to `.trellis/tasks/archive/<YYYY-MM>/`.

Archive / Learning is terminal. Follow-up work after archive requires a new task unless the user explicitly approves amending archived artifacts.

## Tests Required

When changing archive guards, add regression coverage for:

- `archive --check` non-mutation;
- missing `verify.md`;
- missing final acceptance evidence;
- missing durable-learning decision evidence;
- Parent missing final integration evidence;
- required gate `FAIL` and stale fingerprints;
- real archive writing completion state only after guards pass.
