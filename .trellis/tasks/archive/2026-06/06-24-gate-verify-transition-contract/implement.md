# Implementation Plan: Gate / Verify / Transition Contract

## Development Strategy Contract

execution_mode: inline
isolation: main-worktree
verification_profile: architecture
retrieval_profile: structure
optional_capabilities:
  - codegraph
quality_gates:
  mode: profile
  profile: architecture
  enabled: []
  disabled: []

## Execution Principles

- Implement from the smallest safe fix to the broader contract refactor.
- Keep all evidence and gate semantics in `task_gates.py`.
- Keep Parent/Child structural state checks in `task_map.py`.
- Keep command handlers thin; do not add new command-specific regex checks.
- Update template source and dogfood mirror when workflow text or generated scripts change.
- Add tests before or alongside behavior changes for each failure mode.

## Ordered Work Plan

### Step 1: Add closeout profile helpers

Files:

- `packages/cli/src/templates/trellis/scripts/common/task_gates.py`
- `.trellis/scripts/common/task_gates.py` if the dogfood copy must mirror template behavior during this task

Actions:

- Add `task_closeout_profile(task_dir, task_data)`.
- Preserve `is_full_task()` compatibility by delegating to the new profile where appropriate.
- Define profile precedence:
  - structural children or explicit parent -> `parent`
  - explicit full -> `full`
  - explicit lite -> `lite`
  - `design.md` + `implement.md` -> `full`
  - default -> `lite`
- Add unit coverage for profile classification.

Rollback:

- Revert the helper and restore direct `is_full_task()` logic if profile behavior causes unexpected planning gate failures.

### Step 2: Centralize substantive evidence extraction

Files:

- `task_gates.py`

Actions:

- Add placeholder detection for content-free values.
- Refactor current `_verify_evidence_status()` into a richer status object or dict with:
  - validation
  - check_evidence
  - acceptance
  - durable_learning
  - integration
  - reviewed_change_set
- Add support for grep-friendly lines such as:
  - `Validation evidence: <substantive value>`
  - `Check evidence: <substantive value>`
  - `Reviewed change-set: <substantive value>`
  - `Integration evidence: <substantive value>`
- Preserve existing accepted forms for validation, acceptance, durable learning, and integration.
- Do not require exact heading names when an existing supported line format is substantive.

Rollback:

- Keep old regex helpers available until callers are migrated; remove only after tests pass.

### Step 3: Add `validate_transition_readiness()`

Files:

- `task_gates.py`

Actions:

- Implement a non-mutating shared guard:
  - validates transition-specific evidence
  - validates required gate records for completion checks
  - validates a single gate's evidence prerequisites for `record-gate`
  - delegates Parent child-terminal checks to `validate_parent_children_complete()`
- Keep error strings stable and actionable.
- Ensure `FAIL` gate recording remains possible when validation evidence is absent; hard evidence requirements apply to `PASS` and `SKIPPED`.

Rollback:

- If the shared guard becomes too broad, keep the helper but initially call it only from `record-gate` and archive paths.

### Step 4: Bind `record-gate` to transition readiness

Files:

- `packages/cli/src/templates/trellis/scripts/task.py`
- `task_gates.py`

Actions:

- In `cmd_record_gate`, before writing the record, call `validate_transition_readiness(..., gate=args.gate)` for PASS/SKIPPED.
- Print errors through the existing `_print_guard_errors()` path.
- Preserve fingerprint mismatch behavior.
- Preserve `baseline-check` as CLI-owned and not manually recordable.

Tests:

- PASS rejected when evidence is placeholder.
- PASS accepted when evidence is substantive.
- FAIL still recordable with proper fail metadata.
- SKIPPED requires user approval and transition context.

Rollback:

- Gate the new check behind the helper call only; revert the call if emergency compatibility is needed.

### Step 5: Require Full Child review before Parent acceptance

Files:

- `task_map.py`
- `parent_orchestration.py`
- `task_gates.py`

Actions:

- Add optional `current_state_override` parameter to `validate_parent_child_integration()`.
- After structural checks for `state == "accepted"`, call child `validate_transition_readiness(..., "child-review")` when child profile is `full`.
- Treat child profile `lite` as no gate chain.
- For child profile `parent`, block acceptance unless its Parent closeout readiness is satisfied.
- Update `parent_orchestration` hints:
  - Full child `child-review` is required.
  - Lite child explicitly says no gate chain.

Tests:

- Full child accepted check fails without `child-review/code-review`.
- Lite child accepted check passes with valid verify/handoff and no gate.
- Full child accepted check passes after required gate exists.

Rollback:

- Revert the call from `validate_parent_child_integration()`; structural state behavior remains unchanged.

### Step 6: Fix integrate-through validation

Files:

- `task_map.py`
- `parent_orchestration.py`

Actions:

- Use `current_state_override` in `validate_parent_child_integration()`.
- Pass the simulated state from `build_review_report()` during `integrate-through` dry-run validation.
- Keep actual mutation through `set_parent_child_integration_state()` unchanged.

Tests:

- Valid simulated sequence passes `review-child --decision integrate-through --check`.
- Invalid initial state still fails with a clear state error.

Rollback:

- Revert parameter use; no data migration needed.

### Step 7: Require Parent integration review before archive

Files:

- `task_gates.py`
- `task_map.py` only if an extra helper is needed

Actions:

- In `validate_archive()`, use `task_closeout_profile()`.
- For `parent` profile, require:
  - all structural children terminal
  - substantive Parent integration evidence
  - valid `parent-integrated/integration-review` gate
- Continue to require Lite-style archive evidence (`verify.md` validation, acceptance, durable learning) for all profiles.

Tests:

- Parent archive fails with accepted child.
- Parent archive fails with terminal children but missing integration-review.
- Parent archive passes with terminal children, integration evidence, and valid gate.

Rollback:

- Temporarily downgrade `integration-review` failure to warning only if transition blocks too many active tasks; do not remove child terminal checks.

### Step 8: Update workflow text and command hints

Files:

- `packages/cli/src/templates/trellis/workflow.md`
- `.trellis/workflow.md`
- Any hint text in `parent_orchestration.py` or `task_gates.py`

Actions:

- Replace text saying `child-review` / `parent-integrated` gates are optional when they are required for Full/Parent closeout.
- Document Lite closeout as explicit no-gate chain.
- Ensure repair hints point to the right command.

Tests:

- Existing workflow-state regression tests still pass.
- Template tests still pass.

Rollback:

- Revert documentation text only if behavior is reverted.

### Step 9: Regression tests

Files:

- Prefer existing test structure under `packages/cli/test/`.
- Add a focused test file if no existing Python-template test suite fits.

Scenarios:

- `record-gate` rejects placeholder evidence.
- `record-gate` accepts substantive evidence.
- Full Child acceptance requires child-review.
- Lite Child acceptance has no gate chain.
- Parent archive requires integrated/cancelled children.
- Parent archive requires integration-review.
- `integrate-through --check` uses simulated state.

Implementation note:

- Use temp directories and local Python invocation of `.trellis/scripts/task.py` or direct imports from copied template scripts.
- Avoid network, git remote, MCP, or browser dependencies.

## Validation Commands

Run the smallest relevant checks first:

```powershell
pnpm test -- packages/cli/test/<new-or-updated-test-file>
python ./.trellis/scripts/task.py start-execution 06-24-gate-verify-transition-contract --check
```

Then run broader checks before handoff:

```powershell
pnpm test
pnpm typecheck
pnpm build
```

`pnpm lint` should be run if touched files are TypeScript or template exports. Existing unrelated lint debt must be reported separately and not silently treated as caused by this task.

## Review Gates

This Full Task uses the `architecture` verification profile:

- `start-execution` requires requirements-review and architecture-review.
- `full-task-complete` requires code-review and architecture-review.
- Archive requires `verify.md` validation, acceptance, durable learning, and Full completion gates.

Because the task itself changes gate semantics, final verification must include explicit evidence for:

- changed files reviewed
- tests run and output
- before/after behavior for `record-gate`
- before/after behavior for Parent integration
- Lite no-gate closeout behavior

## Handoff Requirements

Before requesting review:

- Update `verify.md` with validation commands and outcomes.
- Include `Check evidence:` with either trellis-check output or a clear manual review summary.
- Include `Reviewed change-set:` with a git ref or diff summary.
- Include `Durable learning decision:` with either no durable learning or spec/workflow updates.

## Open Questions for Implementation

- Whether `SKIPPED` should require the same evidence context as PASS for every transition, or only require user approval plus a task-map/verify context. Default implementation should be strict for Full/Parent work.
- Whether Parent tasks with `cancelled` children require cancellation-specific evidence beyond the existing `--reason`. Default implementation should keep existing cancellation rules and rely on integration-review for final judgment.
- Whether `check evidence` should be mandatory for Lite archive immediately or only for reviewer gates. Default implementation should require it for Full/Child gates and keep Lite archive compatible with current validation/acceptance/learning until workflow text is updated.
