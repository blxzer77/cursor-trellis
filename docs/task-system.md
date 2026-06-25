# Task System

English | [简体中文](task-system.zh-CN.md)

This document covers the **Trellis task system**: durable task artifacts, the Development Strategy Contract, quality gates, the three-phase lifecycle (Plan → Execute → Finish), and Parent/Child task trees.

## What Trellis tasks are

A Trellis task is a set of **durable artifacts** on disk under `.trellis/tasks/<MM-DD-slug>/`. Conversations compact; files do not. When the main session loses context, the task artifacts are the source of truth — the next session reads `prd.md`, `design.md`, `implement.md`, and resume from the recorded phase.

Tasks are created only after **Request Triage** classifies a turn into a work-capable mode (Lite / Full / Parent) and the user gives **task-creation consent**. Consent to create a task is not consent to start coding — planning happens first. See [workflow.md](workflow.md) for the Triage decision tree.

## Artifact contract

| File | Role | Required for |
| --- | --- | --- |
| `prd.md` | Requirements, constraints, acceptance criteria. No technical design or execution checklists here | All tasks |
| `design.md` | Technical design for complex tasks: boundaries, contracts, data flow, tradeoffs, compatibility, rollback shape | Full + Parent |
| `implement.md` | Execution plan for complex tasks: ordered checklist, Development Strategy Contract, validation commands, review gates, rollback points | Full + Parent |
| `verify.md` | Validation evidence, final acceptance, durable learning decision, check evidence, reviewed change-set | All (at finish) |
| `implement.jsonl` | Spec/research manifest for the implementer subagent | When subagents need context |
| `check.jsonl` | Spec/research manifest for the checker subagent | When subagents need context |
| `task.json` | Machine state: status, quality_gate_results, fingerprints, contract epoch | Auto-managed |
| `task-map.md` | Parent-only: child states, integration event log | Parent tasks |

Lightweight (Lite) tasks may be PRD-only. Complex (Full) tasks must have `prd.md`, `design.md`, and `implement.md` before `start-execution --check`.

## Development Strategy Contract

Every Full / Parent task carries a **Development Strategy Contract** in `implement.md` as a YAML block. The contract is parsed and validated by `task.py` (see `task_gates.py`). Invalid enum values fail the gate.

```yaml
execution_mode: inline
isolation: main-worktree
verification_profile: standard
retrieval_profile: structure
optional_capabilities:
  - markdown-documentation
quality_gates:
  mode: profile
  profile: standard
  enabled:
    - requirements-review
  disabled: []
```

### Enum values

| Field | Allowed values | Meaning |
| --- | --- | --- |
| `execution_mode` | `inline` \| `worker` \| `child-task` | Where the work runs: main session / worker subagent / Child task |
| `isolation` | `main-worktree` \| `git-worktree` | Git isolation level |
| `verification_profile` | `standard` \| `strict` \| `architecture` | Which gate set applies |
| `retrieval_profile` | `exact-only` \| `semantic` \| `structure` \| `architecture-memory` | Retrieval aggressiveness |
| `quality_gates.mode` | `profile` \| `explicit` | Derive gates from profile or list explicitly |
| `quality_gates.profile` | `standard` \| `strict` \| `architecture` | Gate set (when mode=profile) |
| `quality_gates.enabled` | list of gate names | Explicit gate list (when mode=explicit) |

All six top-level fields (`execution_mode`, `isolation`, `verification_profile`, `retrieval_profile`, `optional_capabilities`, `quality_gates`) are required. Missing any fails the gate.

## Verification profiles and default gates

| Profile | Default gates |
| --- | --- |
| `standard` | `requirements-review`, `code-review` |
| `strict` | `requirements-review`, `code-review` |
| `architecture` | `requirements-review`, `architecture-review`, `code-review` |

Gate set source: `PROFILE_DEFAULT_GATES` in `task_gates.py`. `strict` adds rigor via evidence requirements, not extra gate names; `architecture` adds the `architecture-review` gate.

## Gate mechanism

### Start-execution gate (Phase 1.4)

```bash
python ./.trellis/scripts/task.py start-execution <task> --check        # non-mutating preflight
python ./.trellis/scripts/task.py start-execution <task> --approved     # flip status → in_progress
```

`--check` validates the contract, artifacts, and required gates without mutating. Planning gates (`requirements-review`, `architecture-review` when enabled) auto-record on `--approved` when artifacts pass CLI checks. Requires explicit user approval before `--approved`.

### Manual gate recording

```bash
python ./.trellis/scripts/task.py record-gate <task> \
  --transition full-task-complete \
  --gate code-review \
  --result PASS \
  --reviewer <reviewer-id> \
  --evidence verify.md
```

`record-gate` rejects `PASS` / `SKIPPED` when transition evidence is missing or placeholder-only. Reviewer gates are **never auto-PASS** — they require explicit recording after review.

### Known transitions

| Transition | When |
| --- | --- |
| `start-execution` | Phase 1.4, before implementation |
| `full-task-complete` | Phase 3, before archive |
| `child-review` | Parent reviewing a Child |
| `parent-changes` / `parent-accepted` / `parent-integrating` / `parent-integrated` / `parent-cancelled` | Parent/Child integration lifecycle |

### Known gates

`baseline-check`, `requirements-review`, `code-review`, `architecture-review`, `architecture-deep-review`, `integration-review`. Results: `PASS` / `FAIL` / `SKIPPED`.

## Phase 1–3 lifecycle

### Phase 1: Plan

| Step | Name | Required | Repeatable |
| --- | --- | --- | --- |
| 1.0 | Create task (after consent) | once | — |
| 1.1 | Requirement exploration (`prd.md`; Full also needs `design.md` + `implement.md`) | required | repeatable |
| 1.2 | Research (dispatch `trellis-research`, write `research/<topic>.md`) | optional | repeatable |
| 1.3 | Configure context (`implement.jsonl` / `check.jsonl`) | conditional | once |
| 1.4 | Execution gate (`start-execution --check` → approval → `--approved`; status → `in_progress`) | required | once |
| 1.5 | Completion criteria | — | — |

### Phase 2: Execute

| Step | Name | Required | Repeatable |
| --- | --- | --- | --- |
| 2.1 | Implement (`trellis-implement` subagent or inline) | required | repeatable |
| 2.2 | Quality check (`trellis-check` skill or agent) | required | repeatable |
| 2.3 | Rollback | on demand | — |

### Phase 3: Finish

| Step | Name | Required |
| --- | --- | --- |
| 3.1 | Verification (evidence in `verify.md`) | required |
| 3.2 | Break loop (if stuck; `trellis-break-loop`) | on demand |
| 3.3 | Durable learning decision (`update-spec` \| `no-update` \| `unsure`) | required |
| 3.4 | Commit | required |

Status stays `in_progress` from `--approved` until `task.py archive`; only archive flips it.

## Parent/Child task trees

Use a Parent task when one request contains several independently verifiable deliverables.

- **Parent owns**: source requirement set, `task-map.md`, cross-child acceptance criteria, final integration review
- **Child owns**: independently plannable, implementable, checkable, archivable deliverable

Create children:

```bash
python ./.trellis/scripts/task.py create "<title>" --slug <name> --parent <parent-dir>
python ./.trellis/scripts/task.py add-subtask <parent> <child>      # link existing
python ./.trellis/scripts/task.py remove-subtask <parent> <child>   # unlink mistake
```

Parent/Child is **not** a dependency system. If one child must wait for another, write that ordering in the child `prd.md` / `implement.md` and keep each child's acceptance criteria testable.

### Child states (Child-controlled)

```bash
python ./.trellis/scripts/task.py set-child-state <parent> <child> open|working|blocked|review --evidence <ref>
```

### Integration states (Parent-controlled)

```bash
python ./.trellis/scripts/task.py prepare-child-worktree <parent> <child> --branch <branch>
python ./.trellis/scripts/task.py integrate-child <parent> <child> changes|accepted|integrating|integrated|cancelled --evidence <ref>
```

- `merge_limit: 1` blocks more than one Child from being `integrating` simultaneously
- Integration is serial Git-ref integration; every decision writes conflicts, merge decisions, and acceptance rationale to `task-map.md` Event Log
- A Child can provide evidence and request review, but **cannot** mark itself `changes` / `accepted` / `integrating` / `integrated` / `cancelled` — only the Parent has integration authority

### Parent reviewer orchestration

```bash
python ./.trellis/scripts/task.py parent-status <parent-task>
python ./.trellis/scripts/task.py generate-child-prompt <parent-task> <child-task> --mode inline
python ./.trellis/scripts/task.py review-child <parent-task> <child-task> --check
python ./.trellis/scripts/task.py review-child <parent-task> <child-task> --decision accept --ref <child-ref>
python ./.trellis/scripts/task.py review-child <parent-task> <child-task> --decision integrate-through --ref <child-ref>
```

`review-child` summarizes child `verify.md` / `handoff.md`, appends notes to parent `verify.md`, and can advance `accepted` → `integrating` → `integrated` in one flow (`--decision integrate-through`) using the same Stage 0 integration guards as `integrate-child`.

Reviewer quality gates are **not** auto-recorded. CLI enforces them at transition boundaries:

- **Full Child accept / integrate-through**: requires substantive `verify.md` evidence and `child-review/code-review` (plus configured architecture gates) before Parent marks the Child `accepted`
- **Parent archive**: requires every structural Child `integrated` or `cancelled`, substantive Parent integration evidence, and `parent-integrated/integration-review`
- **Lite closeout**: explicit no-gate chain; archive still requires validation, acceptance, and durable-learning evidence in `verify.md`

## Archive gate

```bash
python ./.trellis/scripts/task.py archive <task> --check    # non-mutating preflight
python ./.trellis/scripts/task.py archive <task>            # archive (moves to archive/2026-MM/)
```

Archive requires `verify.md` evidence lines (grep-friendly):

- Validation commands + outcome
- Final acceptance evidence (or `Accepted by user:`)
- Durable learning decision (`no durable learning` / `Spec update evidence:` / `Learning artifact:`)
- Check evidence (`trellis-check` summary or manual review notes)
- Reviewed change-set (git ref or diff summary)

Plus the `full-task-complete/code-review` gate recording. Use `prepare-archive-evidence` helper to draft the evidence block, then `record-gate` after explicit review (never auto-PASS).

## See also

- [Workflow in Cursor](workflow.md) — the full Triage decision tree, Task Ladder, upgrade/downgrade rules
- [Internal skills](skills.md) — `trellis-brainstorm` / `trellis-before-dev` / `trellis-check` / `trellis-break-loop` / `trellis-update-spec`
- [Subagent dispatch](subagents.md) — `trellis-implement` / `trellis-check` dispatch, Parent/Child integration authority
- [Spec system](spec-system.md) — `implement.jsonl` / `check.jsonl` manifests that feed task context
