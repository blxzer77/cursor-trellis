# Design: Gate / Verify / Transition Contract

## Design Goal

Introduce one cohesive transition-readiness contract that binds gate records to substantive task evidence, while preserving the current Trellis architecture:

- `task_gates.py` owns evidence, gate records, fingerprints, and archive readiness.
- `task_map.py` owns Parent/Child state-machine structure.
- `parent_orchestration.py` owns review report assembly and delegates validation.
- `task_store.py` remains a thin command layer.

The design avoids a parallel gate system. Existing `quality_gate_results`, `required_gates_for_transition`, artifact fingerprints, and archive checks stay the foundation.

## Current Weak Points

### 1. `record-gate` validates form, not substance

Today `build_reviewer_gate_record()` validates known transition, known gate, result value, reviewer id, evidence field length, fingerprints, fail metadata, and skip approval. It does not verify that the transition's evidence files contain the material needed to justify the result.

This means `record-gate ... --result PASS --evidence verify.md` can succeed when `verify.md` contains only placeholders or lacks reviewed files, test output, check evidence, or integration evidence.

### 2. Parent acceptance treats Child review gate as optional

`parent_orchestration.build_review_report()` prints an optional hint for `child-review/code-review` after an accept decision. `task_map.validate_parent_child_integration()` only checks state, parent linkage, `verify.md`, and `handoff.md` presence. It does not require Full Child `quality_gate_results`.

This leaves Full Child review dependent on agent discipline instead of CLI enforcement.

### 3. Parent archive lacks a hard Parent integration gate

`validate_parent_children_complete()` now blocks child states that are not `integrated` or `cancelled`. That fixes the 06-20-style "accepted forever" drift for current code. The remaining gap is that Parent archive does not require `parent-integrated/integration-review`.

The Parent can therefore have terminal child states without a recorded final integration review.

### 4. `integrate-through` validation mixes simulated and real states

`review-child --decision integrate-through` simulates a three-step state sequence. The local loop updates `sim_state`, but each call to `validate_parent_child_integration()` reloads the real task-map and still sees the original child state. The second step can fail because the task-map still says `review`, even though the check is intentionally simulating `accepted`.

### 5. Lite closeout is implicit

`is_full_task()` currently uses explicit Full/Lite metadata if present, otherwise `design.md` + `implement.md`. That is useful but incomplete:

- Genuine Lite tasks should have no gate chain.
- Full/Child/Parent tasks must not accidentally become Lite because metadata or design files are missing.
- Parent tasks with children need Parent integration gates even when they do not have Full implementation docs.

## Proposed Model

### Closeout Profile

Add a small profile helper in `task_gates.py`:

```python
def task_closeout_profile(task_dir: Path, task_data: dict | None) -> str:
    ...
```

Possible return values:

- `lite`: no reviewer gate chain; archive still requires `verify.md` evidence.
- `full`: Full completion gate chain applies.
- `parent`: Parent integration gate chain applies in addition to archive evidence.

Profile rules:

1. Structural children or explicit `meta.classification=parent` -> `parent`.
2. Explicit Full metadata (`full`, `full-task`) -> `full`.
3. Explicit Lite metadata (`lite`, `lite-task`) -> `lite`, unless structural children exist.
4. `design.md` and `implement.md` present -> `full`.
5. Default -> `lite`.

`is_full_task()` remains as compatibility wrapper for existing call sites, implemented via `task_closeout_profile(...) == "full"` where safe. Parent callers should use the new profile helper directly.

### Evidence Signals

Keep existing regex helpers, but add a substantive evidence layer:

```python
def _is_substantive_evidence(value: str | None) -> bool:
    ...
```

Reject content-free values:

- empty or whitespace only
- `TBD`, `TODO`, `待定`, `待补充`
- `N/A`, `NA`, `none`, `-`, `...`
- single punctuation or very short placeholder-like values

Signals should be extracted into named evidence statuses rather than repeated regex calls:

```python
@dataclass
class VerifyEvidenceStatus:
    validation: bool
    check_evidence: bool
    acceptance: bool
    durable_learning: bool
    integration: bool
    reviewed_change_set: bool
```

Existing `_verify_evidence_status()` can be refactored or wrapped to produce this shape. The important design rule is that command-specific validation uses the same status source.

### Transition Readiness

Add one central API:

```python
def validate_transition_readiness(
    task_dir: Path,
    task_data: dict | None,
    transition: str,
    *,
    gate: str | None = None,
    parent_dir: Path | None = None,
    parent_data: dict | None = None,
    current_state_override: str | None = None,
) -> list[str]:
    ...
```

Responsibilities:

- Validate required evidence files are present.
- Validate transition-specific substantive evidence signals.
- Validate required gate records when checking transition completion.
- Validate a single gate's evidence prerequisites before `record-gate` writes that gate.
- Delegate Parent task-map terminal state checks to `validate_parent_children_complete()`.
- Never mutate files.

This function should not perform state transitions. It is a guard only.

### Transition Requirements

Represent transition requirements in one table or small set of helper functions in `task_gates.py`.

| Transition | Applies to | Required evidence | Required gates |
| --- | --- | --- | --- |
| `start-execution` | Full | PRD + design/implement contract | requirements-review, optional architecture-review from contract |
| `full-task-complete` | Full | validation, check evidence, acceptance, durable learning, reviewed change-set | code-review plus configured architecture gates |
| `child-review` | Full Child | validation, check evidence, reviewed change-set, handoff evidence | code-review plus configured architecture gates |
| `parent-integrated` | Parent | integration evidence, task-map all children terminal | integration-review |
| Lite archive | Lite | validation, acceptance, durable learning | none |

Do not duplicate this table in command code. Command code asks the transition-readiness API.

## Command Behavior

### `record-gate`

Before building/writing a reviewer gate record:

1. Validate CLI input as today.
2. Call `validate_transition_readiness(..., transition=args.transition, gate=args.gate)`.
3. If readiness fails, return non-zero and print actionable errors.
4. If readiness passes, compute fingerprints and write the record as today.

For `FAIL`, evidence readiness should not block recording. A FAIL can be valid precisely because evidence shows a defect or because validation failed. The hard evidence requirement applies to `PASS` and `SKIPPED`.

For `SKIPPED`, keep existing `--skip-approved-by user` and `--skip-reason`, but also require the same transition context unless the skipped gate is explicitly allowed by the existing skip policy. This prevents "silent bypass"; it still allows explicit user-approved bypass with a reason.

### `integrate-child accepted`

`validate_parent_child_integration()` remains the structural gate for parent linkage, task-map state, ref, reason, and merge-limit checks. After structure checks:

- If target state is `accepted` and the Child closeout profile is `full`, call `validate_transition_readiness(child_dir, child_data, "child-review", parent_dir=parent_dir, parent_data=parent_data)`.
- If the Child is `lite`, do not require a gate chain.
- If the Child is `parent`, treat it as requiring its own Parent archive readiness before acceptance unless a future explicit policy says otherwise. For now, the safe behavior is to block and ask for Parent-level terminal review evidence.

This makes `integrate-child` and `review-child` consistent because both already use `validate_parent_child_integration()`.

### `review-child --decision integrate-through`

Add `current_state_override` to `validate_parent_child_integration()`:

```python
current_state = (
    current_state_override
    if current_state_override is not None
    else child.get("state")
)
```

`build_review_report()` passes the local `sim_state` for each simulated step. Actual mutation still uses `set_parent_child_integration_state()` step by step and therefore keeps the real task-map as source of truth during execution.

### `archive --check`

Refactor `validate_archive()`:

- Always require `verify.md` and Lite closeout evidence.
- If profile is `full`, call `validate_transition_readiness(..., "full-task-complete")`.
- If profile is `parent`, call `validate_transition_readiness(..., "parent-integrated")`.
- If task has a parent, preserve current child archive state checks and integrated child handoff requirement.

Parent archive should fail if:

- any structural child is not `integrated` or `cancelled`
- Parent `verify.md` lacks substantive integration evidence
- `parent-integrated/integration-review` is missing, failed, stale, or improperly skipped

## Error Messages and Repair Hints

Errors should be specific and stable enough for tests:

- `verify.md missing substantive validation evidence`
- `verify.md missing check evidence`
- `verify.md missing reviewed change-set evidence`
- `handoff.md missing reviewed change-set evidence`
- `missing gate record: child-review/code-review`
- `missing gate record: parent-integrated/integration-review`
- `child <name> must be integrated or cancelled before parent archive, got 'accepted'`

Hints should point to existing commands:

- `task.py prepare-archive-evidence <task>`
- `task.py record-gate <task> --transition child-review --gate code-review ...`
- `task.py record-gate <parent> --transition parent-integrated --gate integration-review ...`
- `task.py review-child <parent> <child> --decision integrate-through --ref <ref>`

## Data Compatibility

No schema migration is required. Existing `quality_gate_results` records remain valid if their fingerprints match and evidence files satisfy the new checks. Historical archives are not rewritten.

New metadata uses existing `meta`:

```json
{
  "meta": {
    "classification": "lite|full|parent"
  }
}
```

If metadata is absent, the compatibility heuristic remains.

## Template and Dogfood Mirroring

Because this repository dogfoods Trellis templates, implementation must update both:

- Template source under `packages/cli/src/templates/trellis/...`
- Dogfood copy under `.trellis/...` where workflow/scripts are mirrored

Template index/export changes are not expected unless new Python files are added. This design should avoid adding new files.

## Test Strategy

Use focused tests that create temporary Trellis task directories and run the Python CLI or import helper functions through generated fixture paths.

Required scenarios:

- `record-gate` rejects placeholder validation evidence.
- `record-gate` accepts substantive validation + check evidence + reviewed change-set for Full code-review.
- Full Child `accepted --check` fails without `child-review/code-review`.
- Full Child `accepted --check` passes after valid child-review gate exists.
- Parent archive fails when a child is `accepted`.
- Parent archive fails when all children are terminal but `integration-review` is absent.
- Lite archive passes without `quality_gate_results`.
- `integrate-through --check` passes through simulated states.

No tests should require network access, git remotes, or external MCP servers.

## Risks

- Tightening gates may expose existing weak task artifacts. This is intended for active/future tasks but may surprise users. Mitigation: produce actionable repair hints.
- Evidence requirements can become too rigid. Mitigation: keep evidence signals line-oriented and documented, and support both `verify.md` and `handoff.md` where appropriate.
- Parent tasks without implementation docs could be misclassified. Mitigation: structural children always select `parent` profile.
- Existing optional gate hints might conflict with new hard requirements. Mitigation: update workflow text and CLI hints in the same task.

## Rejected Alternatives

- **Hook-only enforcement**: unreliable because hooks can be disabled or platform-dependent, and CLI archive/record commands must be authoritative.
- **Separate gate verifier script**: creates a second source of truth and repeats `task_gates.py`.
- **Require all tasks to be Full**: too heavy and contradicts Lite workflow purpose.
- **Regex-only tightening**: better than current behavior but still accepts placeholders and does not bind evidence to transition semantics.
