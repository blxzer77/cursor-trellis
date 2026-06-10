# Quality Gate Fingerprints

Quality gates are task-local guard records stored in `task.json` under `quality_gate_results.transitions[transition][gate]`. They are compact machine-checkable state, not review prose.

## Fingerprints

`contract_fingerprint` covers stable task metadata plus the parsed Development Strategy Contract from `implement.md`. It must not change when only generated/runtime fields change, including:

- `quality_gate_results`
- `execution_approval`
- timestamps
- runtime/session paths

`artifact_fingerprint` is scoped by transition and gate. Pre-execution fingerprints cover planning artifacts only and must not change when only `verify.md` changes. Completion and handoff fingerprints include evidence artifacts such as `verify.md` and `handoff.md` when those artifacts are part of the reviewed transition.

Post-implementation fingerprints must include reviewed change-set identity. `full-task-complete` extracts short reviewed change-set entries from `verify.md`; `child-review` extracts them from `verify.md` and `handoff.md`; Parent-controlled `parent-*` transitions extract them from `task-map.md` and `verify.md`. Recognized evidence lines include `Reviewed change-set:`, `Change-set:`, `Reviewed diff:`, `Diff evidence:`, `Reviewed ref:`, and `Ref:`. These lines should contain compact refs or diff identifiers, not full logs or patch bodies.

Parent/Child integration fingerprints must include Parent contract validity when it matters. `child-review` fingerprints include the Child task artifacts plus the linked Parent `task-map.md` `contract_epoch`. Parent-controlled integration transitions (`parent-*`) include the Parent `task-map.md` `contract_epoch` as fingerprint metadata, even when the transition's reviewed file set does not otherwise include `task-map.md`.

## Execution Approval

`task.py start-execution <task> --check` is non-mutating and reports current fingerprints for the approval prompt.

`task.py start-execution <task> --approved` records `task.json.execution_approval` for the current `start-execution` fingerprints. If an existing execution approval is present and its transition, contract fingerprint, or artifact fingerprint no longer matches current artifacts, the command must reject rather than silently refresh approval. The agent must return to Planning, refresh affected gates/fingerprints, rerun `--check`, and ask for explicit approval again.

## Gate Records

`task.py record-gate` is the only writer for non-baseline reviewer gates. It must reject:

- unknown transitions;
- unknown gates;
- invalid results;
- manual `baseline-check` records;
- missing reviewer or evidence;
- long review bodies, logs, screenshots, or payload-like text as CLI arguments;
- `FAIL` without `--issue-fingerprint`;
- `FAIL` without `--root-cause`;
- `SKIPPED` without `--skip-approved-by user` and `--skip-reason`;
- caller-provided stale contract or artifact fingerprints.

Allowed `FAIL` root causes and routes are:

| Root cause | Route |
| --- | --- |
| `implementation-defect` | Execution |
| `contract-changing-defect` | Planning |
| `validation-environment-blocker` | Verification / Review |

Gate records must store the root cause and route for `FAIL` results. `PASS` and `SKIPPED` must reject root-cause metadata.

`architecture-review` and other reviewer gate names are scoped by transition. A record for `start-execution/architecture-review` must not overwrite `full-task-complete/architecture-review` or `child-review/architecture-review`.

## Platform Reviewer Adapters

Reviewer adapters are platform-specific prompt/template details. They must not redefine gate names, gate dependencies, transition keys, result values, or fingerprint rules.

First-class reviewer ids:

| Platform | Reviewer id |
| --- | --- |
| Codex | `codex` |
| Claude Code | `claude-code` |
| Cursor | `cursor` |

Adapter responsibilities:

- write human-readable review evidence in `verify.md` before recording a gate result;
- use Parent `task-map.md` for Parent/Child integration evidence when applicable;
- record non-baseline gates through `task.py record-gate`;
- pass `--root-cause implementation-defect|contract-changing-defect|validation-environment-blocker` and `--issue-fingerprint` for `FAIL`;
- use `--skip-approved-by user` and `--skip-reason` for `SKIPPED`;
- never record `baseline-check`, because it is CLI-owned;
- never pass long review prose, logs, screenshots, or issue lists through `record-gate` arguments.

The same semantic gate contract applies across Codex, Claude Code, and Cursor. Platform templates may phrase the instructions differently, but the machine-checkable result shape remains portable.

## Quality Gate Config

Full Tasks must define valid `quality_gates` in the Development Strategy Contract. Invalid or missing gate configuration blocks protected transitions before mutation. `baseline-check` is CLI-owned and cannot be disabled. `architecture-deep-review` requires `architecture-review`.

Required gate records must be current for both contract and artifact fingerprints. Stale `PASS` and invalid `SKIPPED` records block protected transitions until a current `PASS` or valid user-approved `SKIPPED` is recorded.

## Repeated Failures

Repeated `FAIL` records for the same transition, gate, and `issue_fingerprint` increment `consecutive_failures`. More than three consecutive failures must warn that the agent should ask the user to choose between re-plan, continue fixing, or user-approved skip if that gate is skippable.
