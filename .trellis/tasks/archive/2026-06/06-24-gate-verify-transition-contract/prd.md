# Harden gate verify transition contract

## Goal

Make Trellis quality gates reliable enough that Full and Parent tasks cannot be archived or integrated through missing, placeholder, or silently bypassed evidence, while keeping the implementation cohesive, low-coupled, non-redundant, and efficient.

This task addresses five related reliability gaps in the current Cursor Trellis workflow:

- `record-gate` can record reviewer PASS/SKIPPED results without checking whether `verify.md` or `handoff.md` contains substantive evidence for that transition.
- Parent integration can accept a Full Child without a required child `code-review` gate.
- Parent archive can drift if children remain `accepted` instead of `integrated`, or if the Parent lacks a final `integration-review`.
- `review-child --decision integrate-through` validation is not trustworthy because simulated states are checked against the real task-map state.
- Lite closeout is an implicit absence of Full artifacts rather than an explicit no-gate policy, allowing Full/Child/Parent work to be accidentally treated as gate-free.

## Problem Statement

The existing gate model has useful pieces: transition names, required gates derived from the Development Strategy Contract, artifact fingerprints, archive checks, and Parent task-map state validation. The weakness is that these pieces are not bound through a single transition evidence contract.

As a result, a gate record can be mechanically valid but semantically weak. A reviewer can write `record-gate --result PASS --evidence verify.md` even when `verify.md` has only placeholder lines. A Parent can accept or integrate Child work while `child-review` remains only an optional hint. Parent archive currently validates terminal child states, but the Parent-level `integration-review` gate is still not a hard archive requirement. Lite handling is also too implicit: the intended "no gate chain" behavior is valid for genuine Lite work, but dangerous when Full, Child, or Parent work is misclassified.

The desired behavior is not a second gate system. The desired behavior is a single transition-readiness layer that all commands reuse.

## In Scope

- Add or refactor a shared transition evidence contract in `task_gates.py`.
- Bind `record-gate` to transition-specific evidence readiness before writing `quality_gate_results`.
- Enforce Full Child `child-review/code-review` before Parent `accepted` decisions.
- Enforce Parent final `parent-integrated/integration-review` before Parent archive.
- Fix `integrate-through` check-mode validation so simulated transitions use simulated current state.
- Make Lite, Full, Child, and Parent closeout profiles explicit in code and user-facing hints.
- Update workflow/template documentation where current text says reviewer gates are optional.
- Add focused regression tests for the above behavior.

## Out of Scope

- Creating a new reviewer service, hook-only gate enforcement path, or external quality platform.
- Replacing `quality_gate_results` schema wholesale.
- Changing Trellis task creation triage policy beyond the metadata needed to distinguish Lite/Full/Parent closeout.
- Requiring code review gates for genuine Lite tasks.
- Rewriting Parent/Child orchestration into a new runtime.
- Solving existing unrelated lint debt.

## Requirements

- `record-gate` must reject PASS or SKIPPED records when the referenced transition lacks required, non-placeholder evidence.
- Evidence validation must be stronger than "line matches regex": placeholder values such as `TBD`, `TODO`, `N/A`, `-`, empty strings, or similarly content-free values must fail where substantive evidence is required.
- `code-review` gates for `full-task-complete` and `child-review` must require reviewed change-set evidence and validation evidence.
- `integration-review` gates for `parent-integrated` must require Parent integration evidence and a task-map where every structural child is terminal (`integrated` or `cancelled`).
- Parent `integrate-child ... accepted` and `review-child --decision accept|integrate-through` must require Full Child `child-review` gates before acceptance, unless the child is explicitly Lite.
- `integrate-through --check` must validate the sequence `review -> accepted -> integrating -> integrated` against simulated state, not the unchanged task-map state.
- Parent archive must require both all children terminal and a valid `parent-integrated/integration-review` gate.
- Lite closeout must be explicit: genuine Lite tasks have no gate chain, but Full/Child/Parent tasks cannot silently bypass gates by omitting design artifacts or relying on ambiguous metadata.
- The implementation must preserve baseline-check as CLI-owned and preserve user-approved SKIPPED semantics.
- The implementation must keep structure validation in `task_map.py`, evidence and gate validation in `task_gates.py`, and command orchestration thin.

## Acceptance Criteria

- [ ] `record-gate` fails for `full-task-complete/code-review` when `verify.md` lacks substantive validation, check evidence, or reviewed change-set evidence.
- [ ] `record-gate` fails for `child-review/code-review` when a Full Child lacks substantive `verify.md`/`handoff.md` evidence.
- [ ] `record-gate` fails for `parent-integrated/integration-review` when Parent integration evidence is missing or children remain non-terminal.
- [ ] `integrate-child <parent> <full-child> accepted --check` fails until the Full Child has the required `child-review` gate record.
- [ ] `review-child --decision integrate-through --check` succeeds for a valid `review -> accepted -> integrating -> integrated` simulated sequence and no longer fails on the second step because task-map still says `review`.
- [ ] `archive <parent> --check` fails when any child remains `accepted`, `integrating`, `review`, `working`, `blocked`, or `open`.
- [ ] `archive <parent> --check` fails when all children are terminal but `parent-integrated/integration-review` is missing, failed, stale, or improperly skipped.
- [ ] A genuine Lite task with valid `verify.md` closeout evidence and no Full/Parent classification passes archive without requiring `quality_gate_results`.
- [ ] A Full task with `meta.classification=full`, `mode=full`, or `design.md` + `implement.md` cannot archive without required Full completion gates.
- [ ] Workflow text and command hints no longer describe Full Child or Parent integration gates as merely optional where they are hard requirements.
- [ ] Regression tests cover the new negative and positive paths without requiring network access or external services.

## Constraints

- Keep the change localized to Trellis CLI templates and dogfood workflow mirror files.
- Do not add new runtime dependencies.
- Preserve Windows compatibility for generated scripts.
- Preserve existing task archives; new validation applies forward to active tasks and future archives.
- Keep gate errors actionable: command output should name the missing evidence/gate and suggest the next command or file to fix.

## Notes

- The 2026-06-20 Parent archive drift and 2026-06-24 manual integrate workaround are treated as regression examples for test fixtures, not as data to mutate.
- This task is planning-only until `task.py start-execution --approved` is explicitly run after the planning gate passes.
