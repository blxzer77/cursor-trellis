# Development Workflow

---

## Core Principles

1. **Plan before code** — figure out what to do before you start
2. **Specs injected, not remembered** — guidelines are injected via hook/skill, not recalled from memory
3. **Persist everything** — research, decisions, and lessons all go to files; conversations get compacted, files don't
4. **Incremental development** — one task at a time
5. **Capture learnings** — after each task, review and write new knowledge back to spec

---

## Trellis System

### Developer Identity

On first use, initialize your identity:

```bash
python3 ./.trellis/scripts/init_developer.py <your-name>
```

Creates `.trellis/.developer` (gitignored) + `.trellis/workspace/<your-name>/`.

### Spec System

`.trellis/spec/` holds coding guidelines organized by package and layer.

- `.trellis/spec/<package>/<layer>/index.md` — entry point with **Pre-Development Checklist** + **Quality Check**. Actual guidelines live in the `.md` files it points to.
- `.trellis/spec/guides/index.md` — cross-package thinking guides.

```bash
python3 ./.trellis/scripts/get_context.py --mode packages   # list packages / layers
```

**When to update spec**: new pattern/convention found · bug-fix prevention to codify · new technical decision.

### Task System

Every task has its own directory under `.trellis/tasks/{MM-DD-name}/` holding `task.json`, `prd.md`, optional `design.md`, optional `implement.md`, optional `research/`, and context manifests (`implement.jsonl`, `check.jsonl`) for Cursor (sub-agent dispatch).

```bash
# Task lifecycle
python3 ./.trellis/scripts/task.py create "<title>" [--slug <name>] [--parent <dir>]
python3 ./.trellis/scripts/task.py dashboard             # show Task Dashboard without mutating state
python3 ./.trellis/scripts/task.py select <name>         # select task for this live session
python3 ./.trellis/scripts/task.py selected --source     # show selected task and source
python3 ./.trellis/scripts/task.py start-execution <name> --check
python3 ./.trellis/scripts/task.py start-execution <name> --approved
python3 ./.trellis/scripts/task.py exit                  # clear selected task without changing status
python3 ./.trellis/scripts/task.py archive <name>        # move to archive/{year-month}/
python3 ./.trellis/scripts/task.py list [--mine] [--status <s>]
python3 ./.trellis/scripts/task.py list-archive
python3 ./.trellis/scripts/task.py add-subtask <parent> <child>
python3 ./.trellis/scripts/task.py set-child-state <parent> <child> review --evidence verify.md
python3 ./.trellis/scripts/task.py prepare-child-worktree <parent> <child> --branch <child-branch>
python3 ./.trellis/scripts/task.py integrate-child <parent> <child> accepted --evidence handoff.md --ref <child-ref>

# Code-spec context (injected into implement/check agents via JSONL).
# `implement.jsonl` / `check.jsonl` are seeded on `task create` for sub-agent-capable
# platforms; the AI curates real spec + research entries during planning when needed.
python3 ./.trellis/scripts/task.py add-context <name> <action> <file> <reason>
python3 ./.trellis/scripts/task.py list-context <name> [action]
python3 ./.trellis/scripts/task.py validate <name>

# Task metadata
python3 ./.trellis/scripts/task.py set-branch <name> <branch>
python3 ./.trellis/scripts/task.py set-base-branch <name> <branch>    # PR target
python3 ./.trellis/scripts/task.py set-scope <name> <scope>

# Hierarchy (parent/child)
python3 ./.trellis/scripts/task.py add-subtask <parent> <child>
python3 ./.trellis/scripts/task.py remove-subtask <parent> <child>

# PR creation
python3 ./.trellis/scripts/task.py create-pr [name] [--dry-run]
```

> Run `python3 ./.trellis/scripts/task.py --help` to see the authoritative, up-to-date list.

**Selected-task mechanism**: entering a Trellis project activates framework context, but every new live session starts with `Selected task: none`. `task.py create` creates artifacts only. `task.py select <task>` writes a per-session `selected_task` pointer without changing `task.json.status`. `task.py selected --source` reports that pointer. `task.py exit` clears it without changing status. `task.py start-execution <task> --check` verifies execution readiness without mutation; `task.py start-execution <task> --approved` is the explicit execution boundary and may flip `planning` to `in_progress`. `task.py archive <task>` writes `status=completed`, moves the directory to `archive/`, and deletes runtime session files that still point at the archived task.

### Workspace System

Records every AI session for cross-session tracking under `.trellis/workspace/<developer>/`.

- `journal-N.md` — session log. **Max 2000 lines per file**; a new `journal-(N+1).md` is auto-created when exceeded.
- `index.md` — personal index (total sessions, last active).

```bash
python3 ./.trellis/scripts/add_session.py --title "Title" --commit "hash" --summary "Summary"
```

### Context Script

```bash
python3 ./.trellis/scripts/get_context.py                            # full session runtime
python3 ./.trellis/scripts/get_context.py --mode packages            # available packages + spec layers
python3 ./.trellis/scripts/get_context.py --mode phase --step <X.Y>  # detailed guide for a workflow step
python3 ./.trellis/scripts/get_context.py --mode retrieval-pack --json --input <evidence.json>  # score collected evidence (not default --json)
```

**Evidence scoring:** default `--json` returns `retrievalGuide` only. After collecting artifact search, session memory, smart-search manifests under `{TASK}/research/smart-search/`, or codebase candidates, run **`--mode retrieval-pack`** with `--input` or stdin JSON. See `research/evidence-scoring-integration.md` in the active task or archived `06-15-child-phase2-evidence-scoring`.

**Research-end hook (Cursor `stop`):** when the selected task has `{TASK}/research/*.md` or `research/smart-search/`, `.cursor/hooks/research-end-retrieval-pack.py` may write `{TASK}/research/retrieval-pack-latest.json` via `get_context --mode retrieval-pack`. Default session JSON is unchanged; use the file when closing research or before Phase 3.1.

**Retrieval daily guide:** `.trellis/spec/guides/retrieval-daily-guide.md` — when to use rg, codegraph, fast-context-mcp, smart-search-cli (and Cursor web fallback), artifact/session memory, codebase router (suggest-only), and explicit retrieval-pack scoring.

**Cursor subagent dispatch:** `.trellis/spec/guides/cursor-subagent-policy.md` — `cstl-research` / `cstl-implement` / `cstl-check`; Parent child default **Task** `cstl-implement` from Parent session (`generate-child-prompt --mode subagent`). **Cursor++ BYOK:** per-type models via `.trellis/local/cursor2plus/` + user/project JSON maps (not committed slugs). **Native Cursor API:** frontmatter `model:` on agents still works. PRD Grill stays in `cstl-brainstorm`, not a subagent. **Cursor++:** compatible v0.0.11+ (SubAgent readonly bug fixed).

---

<!--
  WORKFLOW-STATE BREADCRUMB CONTRACT (read this before editing the tag blocks below)

  The [workflow-state:STATUS] blocks embedded in the ## Phase Index section
  below are the SINGLE source of truth for the per-turn `<workflow-state>`
  breadcrumb that Cursor's UserPromptSubmit hook reads. inject-workflow-state.py
  only parses them — there is no
  fallback dict baked into the scripts after v0.5.0-rc.0.

  STATUS charset: [A-Za-z0-9_-]+. When the hook can't find a tag, it
  degrades to a generic "Refer to workflow.md for current step." line —
  intentionally visible so users notice and fix a broken workflow.md.

  INVARIANT (test/regression.test.ts):
    Every workflow-walkthrough step marked `[required · once]` must have a
    matching enforcement line in its phase's [workflow-state:*] block. The
    breadcrumb is the only per-turn channel; if a mandatory step isn't
    mentioned there, the AI silently skips it (Phase 1 planning gate
    skip and Phase 3.4 commit skip both manifested via this gap).

  TAG ↔ PHASE scoping:
    [workflow-state:no_task]      → framework active, selected task none; before Phase 1
    [workflow-state:planning]     → all of Phase 1 (status='planning')
    [workflow-state:in_progress]  → Phase 2 + Phase 3.1-3.4
                                    (status stays 'in_progress' from
                                    start-execution --approved until task.py archive)
    [workflow-state:completed]    → currently DEAD: cmd_archive flips
                                    status and moves the dir in the same
                                    call, so the resolver loses the
                                    pointer (block kept for a future
                                    explicit in_progress→completed
                                    transition)

  Editing checklist:
    - When you change a [workflow-state:STATUS] block, also check the
      matching phase's `[required · once]` walkthrough steps for sync
    - Run `cstl update` after editing to push the new bodies to
      downstream user projects (block-level managed replacement)
    - Full runtime contract:
      .trellis/spec/cli/backend/workflow-state-contract.md
-->

## Phase Index

```
Phase 1: Plan    → classify, get task-creation consent, then write planning artifacts
Phase 2: Execute → implement only after task status is in_progress
Phase 3: Finish  → verify, record learning decision, commit, and guarded archive
```

### Request Triage (mandatory before any work)

**Every turn that could produce work must be classified before acting.** This is a hard gate, not a suggestion. Resolve the request against the Task Ladder decision tree below, then emit the classification mark. If you cannot classify, you have not understood the request — ask a clarifying question instead of starting work.

Decision tree (first match wins):

1. **No durable project change** (conversation, status, explanation, read-only lookup, tiny one-turn action) → `No Task`.
2. **Underspecified small request, no task yet** (needs focused clarification or decision pressure before work exists) → `Micro-Grill` (load `cstl-micro-grill`).
3. **Low-risk durable work, narrow scope, local validation, no shared contract** → `Lite Task`.
4. **Durable code/template/runtime/workflow/cross-file behavior, or framework semantics** → `Full Task`.
5. **Multiple independent deliverables, staged/parallel execution, or final integration authority** → `Parent Task / Child Tasks`.

Classification mark (R2 — visible audit trail). Start your reply with one line in this exact shape:

```
[Triage: <Mode>] <one-sentence reason citing the trigger signal>
```

- `<Mode>` ∈ `No Task | Micro-Grill | Lite | Full | Parent`.
- The reason must reference the trigger signal from the Task Ladder table (e.g. "cross-file workflow change", "read-only explanation"). Vague reasons like "looks complex" are not acceptable.
- For `No Task` turns the mark is still required — it is how the user audits that you actually classified rather than skipped.

Consent gate. After classifying into any mode that creates a task, ask the user for task-creation consent before creating any Trellis artifact. User approval to create a task is **not** approval to start implementation — planning still happens first. If the user declines a task for a simple request, skip Trellis for this session.

Selected-task continuity. When a `selected_task` already exists, do not rerun global classification on every follow-up; continue inside the selected task unless a strong conflict exists (explicit exit/switch/create language, out-of-scope request, different artifact/archive target, new independent deliverable, contract-changing request, or evidence pollution risk).

### Task Ladder And Routing

Classify by risk and persistence, not raw effort size. A short change to durable framework semantics can require a Full Task; a long conversation can remain No Task when it leaves no durable project state.

| Mode | Use when | Trigger signals | Durable artifacts |
| --- | --- | --- | --- |
| No Task | Conversation, status, explanation, read-only lookup, or a tiny one-turn action with no durable project change. | explain / status / lookup / read-only / one-liner | None. No archive unless upgraded. |
| Micro-Grill | The user needs focused clarification, decision pressure, or a small requirement interrogation before deciding whether work exists. | small + underspecified / "depends" / needs clarification / decision tree first | Usually none. Upgrade before durable edits, validation, gates, or archive evidence. |
| Lite Task | Low-risk durable work with narrow scope, local validation, and no shared contract change. | low-risk / single file / local validation / no contract / narrow scope | `task.json`, `prd.md`, `verify.md`, and archive evidence. |
| Full Task | Durable code, template, runtime, workflow, or cross-file behavior where design, execution strategy, validation, or reviewer gates matter. | cross-file / framework semantics / contract change / template / runtime / workflow / multi-file behavior | `prd.md`, `design.md`, `implement.md`, `verify.md`, Development Strategy Contract, `verification_profile`, `quality_gates`, and archive evidence. |
| Parent Task / Child Tasks | One request contains independent deliverables, staged execution, parallel execution, or final integration authority that must be owned by a Parent. | multiple independent deliverables / staged / parallel / integration authority | Parent `task-map.md`, Child task artifacts, Child handoff evidence, Parent final integration evidence. |

Default Trellis framework semantics, task model, platform adapters, MCP/capability setup, runtime integration, retrieval/graph tooling, Parent/Child orchestration, and quality-gate work to Full Task or higher.

When `Selected task: none`, enter repo-first routing: read local instructions/workflow evidence, run `task.py dashboard` when useful, classify the request on the ladder, and ask for task-creation consent before creating artifacts. Do not auto-select an existing task.

When a `selected_task` already exists, do not rerun global classification on every follow-up. Continue inside the selected task unless a strong conflict exists: explicit exit/switch/create language, an out-of-scope request, a different task artifact or archive target, a new independent deliverable, a contract-changing request, or evidence pollution risk. A contract-changing request under `selected_task` routes to that selected task's Planning flow unless the user explicitly switches or creates another task.

### Upgrade / Downgrade Rules

- No Task -> Micro-Grill when the turn needs structured clarification or a decision tree before work can be safely classified.
- Micro-Grill -> Lite/Full when the outcome needs persistent task artifacts, repo edits, validation evidence, quality gates, or archive.
- Lite -> Full when scope touches shared contracts, multi-file behavior, framework semantics, platform/runtime/capability assumptions, `verification_profile`, `quality_gates`, or rollback-sensitive validation.
- Full -> Parent/Child only when the work has independent deliverables, staged execution, parallel execution, or Parent-controlled final integration needs.

Before executing an upgrade that creates artifacts, changes task mode, adds gates, changes `verification_profile` or capabilities, or changes approval requirements, get explicit user confirmation. Every downgrade needs explicit user confirmation because it reduces artifact, gate, validation, or approval rigor.

### Task Ladder quick routing

| Situation | Action |
|-----------|--------|
| No selected task + small unclear ask | `cstl-micro-grill` |
| No selected task + need dashboard | `cstl-start` |
| Selected task + resume step | `cstl-continue` |
| Planning / PRD | `cstl-brainstorm` |
| Parent with parallel children | `generate-child-prompt --mode subagent`; writable Agent; see `.trellis/spec/guides/cursor-subagent-policy.md` |

Details: archived `06-15-child-phase3-task-ladder` → `research/task-ladder-iteration.md`.

### Planning Artifacts

- `prd.md` — requirements, constraints, and acceptance criteria. Do not put technical design or execution checklists here.
- `design.md` — technical design for complex tasks: boundaries, contracts, data flow, tradeoffs, compatibility, rollout / rollback shape.
- `implement.md` — execution plan for complex tasks: ordered checklist, Development Strategy Contract, validation commands, review gates, and rollback points.
- `implement.jsonl` / `check.jsonl` — spec and research manifests for sub-agent context. They do not replace `implement.md`.
- `verification_profile` / `quality_gates` — gate policy belongs in task artifacts and `task.json`; `task.json.quality_gate_results` is compact machine-checkable state, not human review prose.
- Lightweight tasks may be PRD-only. Complex tasks must have `prd.md`, `design.md`, and `implement.md` before `task.py start-execution --check`.
- `start-execution` planning gates (`requirements-review`, `architecture-review` when enabled) auto-record on `--approved` when artifacts pass CLI checks; use `record-gate` only as a manual override.

### Parent / Child Task Trees

Use a parent task when one user request contains several independently verifiable deliverables. The parent task owns the source requirement set, the task map, cross-child acceptance criteria, and final integration review; it normally should not be the implementation target unless it also has direct work.

Use child tasks for deliverables that can be planned, implemented, checked, and archived independently. Parent/child structure is not a dependency system: if one child must wait for another, write that ordering in the child `prd.md` / `implement.md` and keep each child's acceptance criteria testable.

Create new children with `task.py create "<title>" --slug <name> --parent <parent-dir>`. Link existing tasks with `task.py add-subtask <parent> <child>`, and unlink mistakes with `task.py remove-subtask <parent> <child>`.

Child Workers report only Child-owned progress states with `task.py set-child-state`: `open`, `working`, `blocked`, or `review`. Parent-controlled setup and decisions use `task.py prepare-child-worktree` and `task.py integrate-child`: `changes`, `accepted`, `integrating`, `integrated`, or `cancelled`. Parent integration requires reviewed evidence, Child `verify.md` / `handoff.md`, and a short `--ref` for accepted/integrating/integrated states. Default Parent `merge_limit: 1` blocks more than one Child from being `integrating` at the same time.

Integration is Parent/Child-only. Ordinary Lite and Full Tasks skip Integration and go from Verification / Review to Archive / Learning checks. A Child can provide evidence and request review, but cannot mark itself `changes`, `accepted`, `integrating`, `integrated`, or `cancelled`; only the Parent has integration authority. Parent integration is serial Git-ref integration by default: Child worktrees are prepared explicitly, Child decisions carry refs, `integrate-child ... integrated --execute-merge` runs an explicit no-commit merge when requested, and every decision respects `merge_limit: 1` and writes conflicts, merge decisions, and acceptance rationale to `task-map.md` Event Log.

### Parent reviewer orchestration (inline or optional subagent)

Parent sessions can productize child dispatch and review without a new agent runtime:

```bash
python3 ./.trellis/scripts/task.py parent-status <parent-task>
python3 ./.trellis/scripts/task.py generate-child-prompt <parent-task> <child-task> --mode inline
python3 ./.trellis/scripts/task.py review-child <parent-task> <child-task> --check --decision accept --ref <child-ref>
python3 ./.trellis/scripts/task.py review-child <parent-task> <child-task> --decision accept --ref <child-ref>
python3 ./.trellis/scripts/task.py review-child <parent-task> <child-task> --decision integrate-through --ref <child-ref>
```

- `generate-child-prompt` reads parent `task-map.md` for `depends_on` and `touches`, child artifacts, and optional parent `child-prompts.md`. Use `--mode subagent` only as a delivery hint when the platform can spawn subagents; inline mode remains the portable default.
- `review-child` summarizes child `verify.md` / `handoff.md`, appends notes to parent `verify.md`, and can advance `accepted` / `integrating` / `integrated` in one flow (`--decision integrate-through`) while still using the same Stage 0 integration guards as `integrate-child`.
- Reviewer quality gates are **not** auto-recorded. CLI enforces them at transition boundaries:
  - **Full Child accept / integrate-through**: requires substantive `verify.md` evidence and `child-review/code-review` (plus configured architecture gates) before Parent marks the Child `accepted`.
  - **Parent archive**: requires every structural Child `integrated` or `cancelled`, substantive Parent integration evidence, and `parent-integrated/integration-review`.
  - **Lite closeout**: explicit no-gate chain; archive still requires validation, acceptance, and durable-learning evidence in `verify.md`.
  - **`record-gate`**: rejects PASS/SKIPPED when transition evidence is missing or placeholder-only.

<!-- Per-turn breadcrumb: shown when no task is selected (before Phase 1) -->

[workflow-state:no_task]
Trellis framework active. Selected task: none. Use `task.py dashboard` for routing; do not auto-select an existing task.
MANDATORY TRIAGE (hard gate, not optional): every work-capable turn must be classified FIRST, before any action, into No Task / Micro-Grill / Lite Task / Full Task / Parent Task — see "Request Triage" in workflow.md for the decision tree. Emit the classification as the first line of your reply: `[Triage: <Mode>] <one-sentence reason citing the trigger signal>`. If you cannot classify, you have not understood the request — ask a clarifying question instead of starting work.
After classifying into any mode that creates a task, ask the user for task-creation consent before creating any Trellis artifact. User consent to create a task is NOT consent to start implementation — planning still happens first.
Underspecified small request with no task: load `cstl-micro-grill` before creating artifacts or upgrading the ladder.
Framework refresh with no selected task: load `cstl-start` once; after the user selects a task, use `cstl-continue` for step-level resume—not `cstl-start`.
[/workflow-state:no_task]

### Phase 1: Plan
- 1.0 Create task `[required · once]` (only after task-creation consent)
- 1.1 Requirement exploration `[required · repeatable]` (`prd.md`; complex tasks also need `design.md` + `implement.md`)
- 1.2 Research `[optional · repeatable]`
- 1.3 Configure context `[conditional · once]` — Cursor
- 1.4 Execution gate `[required · once]` (`task.py start-execution <task> --check`, explicit approval, then `--approved`; status → in_progress)
- 1.5 Completion criteria

<!-- Per-turn breadcrumb: shown throughout Phase 1 (status='planning') -->

[workflow-state:planning]
Load `cstl-brainstorm`; stay in planning.
Lightweight: `prd.md` can be enough. Complex: finish `prd.md`, `design.md`, and `implement.md`; run `task.py start-execution <task> --check`, report PASS with task plus current contract/fingerprint context, and ask for explicit execution approval before `--approved`.
Multi-deliverable scope: consider a parent task plus independently verifiable child tasks; dependencies must be written in child artifacts, not implied by tree position.
Sub-agent mode: curate `implement.jsonl` and `check.jsonl` as spec/research manifests before start.
[/workflow-state:planning]

### Phase 2: Execute
- 2.1 Implement `[required · repeatable]`
- 2.2 Quality check `[required · repeatable]`
- 2.3 Rollback `[on demand]`

<!-- Per-turn breadcrumb: shown while status='in_progress'.
     Scope: all of Phase 2 + Phase 3.1-3.4 (status stays 'in_progress' from
     start-execution --approved until task.py archive; only archive flips it). The body
     therefore must cover every required step from implementation through
                                    commit, including Phase 3.3 learning decision and Phase 3.4 commit. -->

[workflow-state:in_progress]
Tools: `cstl-implement` / `cstl-research` are sub-agent types only (Task/Agent tool, NOT Skill; there is no skill by these names). `cstl-update-spec` is a skill for durable learning only. `cstl-check` exists as both; prefer the Agent form when verifying after code changes when `execution_mode: worker`.
Execution boundary: implement only inside approved `prd.md`, `design.md`, `implement.md`, and Development Strategy Contract; stop and Return-to-Planning for scope, contract, gate, capability/runtime, Parent `contract_epoch`, Child boundary, selected-task fit, or non-implementation reviewer-gate changes.
Follow the approved contract's `execution_mode` for Phase 2 (see Phase 2.1 / 2.2):
- `inline` — main session implements and checks (use `cstl-check` skill or inline review); do NOT spawn `cstl-implement` / `cstl-check` agents unless you explicitly re-negotiate the contract.
- `worker` — main session dispatches `cstl-implement` then `cstl-check` agents (CLI Layer 2 dispatch prompt + `Task`).
- `child-task` — Child session or Parent orchestration per `task-map.md`; main session does not replace Child delivery.
Flow after implementation path: validation/evidence in `verify.md` -> learning decision -> commit (Phase 3.4) -> `task.py archive <task> --check` -> `/cstl:finish-work`.
Sub-agent self-exemption: if already running as `cstl-implement`, do NOT spawn another `cstl-implement` or `cstl-check`; if already running as `cstl-check`, do NOT spawn another `cstl-check` or `cstl-implement`. Dispatch is main session only.
Dispatch prompt starts with `Selected task: <task path from task.py selected>`. Read context: jsonl entries -> `prd.md` -> `design.md if present` -> `implement.md if present`.
[/workflow-state:in_progress]

### Phase 3: Finish
- 3.1 Quality verification `[required · repeatable]`
- 3.2 Debug retrospective `[on demand]`
- 3.3 Learning decision `[required · once]`
- 3.4 Commit changes `[required · once]`
- 3.5 Wrap-up reminder

<!-- Per-turn breadcrumb: shown while status='completed'.
     Currently DEAD in normal flow: cmd_archive writes status='completed' in
     the same call that moves the task dir to archive/, so the selected-task
     resolver loses the pointer and the hook never fires on archived tasks.
     Block preserved for a future status-transition redesign (e.g. an
     explicit in_progress→completed command). Edit through the same spec
     channel as the live blocks. -->

[workflow-state:completed]
Code committed. Run `/cstl:finish-work`; if dirty, return to Phase 3.4 first.
[/workflow-state:completed]

### Rules

1. Identify which Phase you're in, then continue from the next step there
2. Run steps in order inside each Phase; `[required]` steps can't be skipped
3. Phases can roll back (e.g., Execute reveals a prd defect → return to Plan to fix, then re-enter Execute)
4. Steps tagged `[once]` are skipped if the output already exists; don't re-run
5. Artifact presence informs the next step; missing `design.md` / `implement.md` is valid for lightweight tasks and incomplete planning for complex tasks.
6. Return-to-Planning triggers must refresh affected artifacts, gates, fingerprints, and explicit execution approval before Execution resumes.

### Active Task Routing

When a user request matches one of these intents inside a selected task, route first, then load the detailed phase step if needed.


- Planning or unclear requirements -> `cstl-brainstorm`.
- `in_progress` implementation/check -> if contract `execution_mode: worker`, dispatch `cstl-implement` / `cstl-check`; if `inline`, main session; if `child-task`, Child/Parent orchestration.
- Repeated debugging -> `cstl-break-loop`; spec updates -> `cstl-update-spec`.



### Guardrails

- Task creation approval is not implementation approval; implementation waits for passing `task.py start-execution <task> --check`, explicit user execution approval, and `task.py start-execution <task> --approved`.
- Planning stops at `task.py start-execution <task> --check` plus an explicit execution-approval request. Planning may not perform implementation edits, mutate execution status, start child execution, integrate children, archive, or claim completion.
- Ordinary conversational confirmations such as "confirm", "agree", "ok", or "start" are not execution authorization unless they answer the explicit execution-approval prompt after a passing `--check`.
- PRD-only is valid for lightweight tasks; complex tasks need `design.md` + `implement.md`.
- Planning must be persisted to task artifacts; checks must run before reporting completion.
- `verify.md` is the human-readable evidence center. `task.json.quality_gate_results` stores compact machine-checkable gate summaries and references only.

### Return-to-Planning

Return to Planning when continued execution would change the approved contract: PRD scope or acceptance criteria, design boundary, dependency, rollback, or validation strategy, Development Strategy Contract, `quality_gates`, `verification_profile`, capability/runtime assumptions, Parent `contract_epoch`, Child boundary, selected-task fit, or a non-implementation reviewer-gate root cause.

When returning to Planning, update the affected planning artifacts, refresh gate records or fingerprints that depend on them, rerun `task.py start-execution <task> --check`, report the new task and contract/fingerprint context, and ask for explicit execution approval again before `--approved`.

Implementation defects inside the already approved contract route back to Execution, not Planning. Validation environment blockers stay in Verification / Review until the environment or evidence path is resolved. Repeated same-issue review/gate loops require escalation to the user instead of silent retries.

### Loading Step Detail

At each step, run this to fetch detailed guidance:

```bash
python3 ./.trellis/scripts/get_context.py --mode phase --step <step>
# e.g. python3 ./.trellis/scripts/get_context.py --mode phase --step 1.1
```

---

## Phase 1: Plan

Goal: classify the request, get task-creation consent when a task is needed, and produce the planning artifacts required before implementation.

#### 1.0 Create task `[required · once]`

Create the task directory only after task-creation consent. The command sets status to `planning`, writes `task.json`, and creates a default `prd.md`. It does not select the task, start execution, or approve execution:

```bash
python3 ./.trellis/scripts/task.py create "<task title>" --slug <name>
```

`--slug` is the human-readable name only. Do **not** include the `MM-DD-` date prefix; `task.py create` adds that prefix automatically.

For task trees, create the parent task first and then create each child with `--parent <parent-dir>`. Do not start the parent just because children exist; start the child that owns the next independently verifiable deliverable.

After creation, select the task only when the user has chosen it for this live session:

```bash
python3 ./.trellis/scripts/task.py select <task-dir>
```

After selection, the per-turn breadcrumb switches to `[workflow-state:planning]`, telling the AI to stay in planning.

Run only `create` and, when appropriate, `select` here. Do not run `start-execution --approved` until step 1.4 passes its non-mutating `--check` and the user gives explicit execution approval.

Skip when the user has already explicitly selected an appropriate task with `python3 ./.trellis/scripts/task.py select <task>`.

#### 1.1 Requirement exploration `[required · repeatable]`

Load the `cstl-brainstorm` skill and explore requirements interactively with the user per the skill's guidance.

The brainstorm skill will guide you to:
- Ask one question at a time
- Prefer researching over asking the user
- Prefer offering options over open-ended questions
- Update `prd.md` immediately after each user answer
- Split large scopes into a parent task plus child tasks when the deliverables can be verified independently
- Keep `prd.md` focused on requirements and acceptance criteria
- For complex tasks, produce `design.md` and `implement.md` before implementation starts

When considering a parent/child split:
- Use a parent task when one request contains several independently verifiable deliverables.
- Parent tasks own source requirements, child-task mapping, cross-child acceptance criteria, and final integration review.
- Child tasks own actual deliverables that can be planned, implemented, checked, and archived independently.
- Parent/child structure is not a dependency system. If child B depends on child A, write that ordering in child B's `prd.md` / `implement.md`.
- Start the child task that owns the next deliverable. Do not start the parent unless the parent itself has direct implementation work.

Return to this step whenever requirements change and revise the relevant artifact.

#### 1.2 Research `[optional · repeatable]`

Research can happen at any time during requirement exploration. It isn't limited to local code — you can use any available tool (MCP servers, skills, web search, etc.) to look up external information, including third-party library docs, industry practices, API references, etc.


Spawn the research sub-agent:

- **Agent type**: `cstl-research`
- **Task description**: Research <specific question>
- **Key requirement**: Research output MUST be persisted to `{TASK_DIR}/research/`



**Retrieval during research**:
- Use `python3 ./.trellis/scripts/search_artifacts.py --query "<topic>" --json` to find durable Trellis specs, prior tasks, research, verification notes, and workspace journals before re-discovering framework context.
- Use `codebase-retrieval` evidence levels for source-code questions: adapter output is candidate evidence until current source, Git, or validation confirms it.
- Persist useful exploratory retrieval chains, adapter availability, and competing hypotheses under `{TASK_DIR}/research/`.

**Research artifact conventions**:
- One file per research topic (e.g. `research/auth-library-comparison.md`)
- Record third-party library usage examples, API references, version constraints in files
- Note relevant spec file paths you discovered for later reference
- Optional reusable-research frontmatter can make findings easier to rediscover:
  ```markdown
  ---
  doc_type: research
  status: active
  confidence: medium
  scope: authentication
  related_files:
    - src/auth/login.ts
  ---
  ```
- Recommended reusable-research sections: Quick Answer, Key Evidence, Details, Risks / Open Questions, Next Steps
- Evidence claims should include file paths, commands, URLs, or validation output when available

Brainstorm and research can interleave freely — pause to research a technical question, then return to talk with the user.

**Key principle**: Research output must be written to files, not left only in the chat. Conversations get compacted; files don't.

#### 1.3 Configure context `[required · once]`


Curate `implement.jsonl` and `check.jsonl` so the Phase 2 sub-agents get the right spec/research context. These files were seeded on `task create` with a single self-describing `_example` line; your job here is to fill in real entries.

**Location**: `{TASK_DIR}/implement.jsonl` and `{TASK_DIR}/check.jsonl` (already exist).

**Format**: one JSON object per line — `{"file": "<path>", "reason": "<why>"}`. Paths are repo-root relative.

**What to put in**:
- **Spec files** — `.trellis/spec/<package>/<layer>/index.md` and any specific guideline files (`error-handling.md`, `conventions.md`, etc.) relevant to this task
- **Research files** — `{TASK_DIR}/research/*.md` that the sub-agent will need to consult

**What NOT to put in**:
- Code files (`src/**`, `packages/**/*.ts`, etc.) — those are read by the sub-agent during implementation, not pre-registered here
- Files you're about to modify — same reason

**Split between the two files**:
- `implement.jsonl` → specs + research the implement sub-agent needs to write code correctly
- `check.jsonl` → specs for the check sub-agent (quality guidelines, check conventions, same research if needed)

These manifests do not replace `implement.md`. `implement.md` is the human-readable execution plan for a complex task; jsonl files only list context files to inject or load.

**How to discover relevant specs**:

```bash
python3 ./.trellis/scripts/get_context.py --mode packages
```

Lists every package + its spec layers with paths. Pick the entries that match this task's domain.

Use artifact search when prior task/research evidence is likely relevant:

```bash
python3 ./.trellis/scripts/search_artifacts.py --query "<topic>" --json
```

Add any reusable `{TASK_DIR}/research/*.md` files you discovered when sub-agents need them.

**How to append entries**:

Either edit the jsonl file directly in your editor, or use:

```bash
python3 ./.trellis/scripts/task.py add-context "$TASK_DIR" implement "<path>" "<reason>"
python3 ./.trellis/scripts/task.py add-context "$TASK_DIR" check "<path>" "<reason>"
```

Delete the seed `_example` line once real entries exist (optional — it's skipped automatically by consumers).

Skip when: `implement.jsonl` and `check.jsonl` have agent-curated entries (the seed row alone doesn't count).



#### 1.4 Execution gate `[required · once]`

After artifact review, run the non-mutating execution preflight:

```bash
python3 ./.trellis/scripts/task.py start-execution <task-dir> --check
```

For lightweight tasks, `prd.md` can be enough. For complex tasks, `prd.md`, `design.md`, and `implement.md` must exist and be reviewed before execution approval. On Cursor (sub-agent dispatch), curate jsonl manifests when extra spec or research context is needed; seed-only manifests are tolerated by consumers.

If `--check` passes, report that artifact gates are ready and include the task name/path plus current contract/fingerprint context. Then ask the user for explicit execution approval and state that approval permits `task.py start-execution <task-dir> --approved`. Ordinary agreement such as "confirm", "agree", "ok", or "start" before this preflight is not execution approval.

Only after the user approves execution in that context, run:

```bash
python3 ./.trellis/scripts/task.py start-execution <task-dir> --approved
```

After this command succeeds, the breadcrumb switches to `[workflow-state:in_progress]`, and the rest of Phase 2 / 3 follows.

#### 1.5 Completion criteria

| Condition | Required |
|------|:---:|
| `prd.md` exists | ✅ |
| `task.py start-execution <task> --check` passes | ✅ |
| User explicitly approves execution after the passing preflight is reported | ✅ |
| `task.py start-execution <task> --approved` has been run (status = in_progress) | ✅ |
| `research/` has artifacts (complex tasks) | recommended |
| `design.md` exists (complex tasks) | ✅ |
| `implement.md` exists (complex tasks) | ✅ |


| `implement.jsonl` / `check.jsonl` curated when extra spec or research context is needed | recommended |


---

## Phase 2: Execute

Goal: turn reviewed planning artifacts into code that passes quality checks.

Execution is bounded by the approved `prd.md`, `design.md`, `implement.md`, and Development Strategy Contract. Follow the contract's `execution_mode`, `verification_profile`, and `quality_gates`; do not global-reclassify the request, auto-switch selected tasks, auto-create new task scope, or edit planning artifacts to change scope, design, or contract while pretending execution is still approved.

Stop Execution and Return-to-Planning for PRD scope/acceptance changes, design boundary/dependency/rollback/validation changes, Development Strategy Contract changes, quality gate changes, capability/runtime assumption changes, Parent `contract_epoch` changes, Child boundary changes, selected-task scope mismatch, or non-implementation reviewer-gate failures. Refresh gates/fingerprints and get explicit approval before continuing.

Implementation defects inside the approved contract remain Execution work: fix them in Phase 2, update `verify.md` evidence, and re-run validation without changing the approved contract.

#### 2.1 Implement `[required · repeatable]`

Use retrieval layers before and during implementation when context is incomplete:
- `python3 ./.trellis/scripts/search_artifacts.py --query "<topic>" --json` for durable Trellis specs, prior task artifacts, research, verification notes, and journals.
- `codebase-retrieval` evidence levels for source claims: candidate -> corroborated candidate -> verified claim; unresolved or unavailable adapters must be reported instead of treated as proof.
- Record exploratory chains in `{TASK_DIR}/research/` and final source/Git/test proof in `verify.md`.


Read `execution_mode` from the approved Development Strategy Contract in `implement.md`:

| `execution_mode` | Phase 2.1 implement |
| --- | --- |
| `inline` | Main session implements directly in the approved contract. |
| `worker` | Spawn **`cstl-implement`** (Cursor): after `start-execution --approved`, assemble dispatch prompt via CLI Layer 2, then `Task(subagent_type=cstl-implement, prompt=<assembled>)`. Do **not** rely on preToolUse hook alone — see `cursor-context-injection-guide.md`. Tell the spawned agent it is already `cstl-implement` and must not spawn another `cstl-implement` / `cstl-check`. |
| `child-task` | Child worker session (or Parent `generate-child-prompt`); isolation per contract (`git-worktree` → `prepare-child-worktree` when applicable). |

Context for worker dispatch includes `implement.jsonl` references, `prd.md`, `design.md` if present, and `implement.md` if present.

#### 2.2 Quality check `[required · repeatable]`

| `execution_mode` | Phase 2.2 check |
| --- | --- |
| `inline` | Main session: `cstl-check` **skill** or inline review; record evidence in `verify.md`. |
| `worker` | Spawn **`cstl-check`** agent: CLI Layer 2 dispatch prompt, then `Task(subagent_type=cstl-check, prompt=<assembled>)`. Agent may fix defects inside the approved contract; must not spawn another check/implement agent. |
| `child-task` | Child delivers `verify.md` / handoff; Parent reviews via `review-child` when applicable. |

The check agent's job:
- Review code changes against specs
- Review code changes against `prd.md`, `design.md` if present, and `implement.md` if present
- Fix implementation defects only when they stay inside the approved contract
- Route requirement, design, contract, scope, gate, capability, runtime, Parent `contract_epoch`, or Child boundary defects to Return-to-Planning
- Run lint and typecheck to verify



#### 2.3 Rollback `[on demand]`

- `check` reveals a PRD, design, contract, scope, gate, capability/runtime, Parent `contract_epoch`, or Child boundary defect → Return-to-Planning, refresh gates/fingerprints, and get explicit approval again
- Implementation went wrong → revert code, redo 2.1
- Need more research → research (same as Phase 1.2), write findings into `research/`

---

## Phase 3: Finish

Goal: ensure code quality, capture lessons, record the work.

#### Evidence scoring (retrieval-pack, explicit)

For **complex** tasks, optionally before 3.1 when you have collected retrieval evidence JSON (e.g. after Phase 1.2 smart-search manifests in `{TASK}/research/smart-search/`):

`python3 ./.trellis/scripts/get_context.py --mode retrieval-pack --json --input <path-to-evidence.json>`

Use `contextPack.selected` / `scoredEvidence` to order citations in `verify.md`. Do **not** expect scoring in default `get_context --json`.

#### 3.1 Quality verification `[required · repeatable]`

Verification / Review is evidence and judgment, not a hidden implementation loop. Load the `cstl-check` skill or agent and do a final review:
- Spec compliance
- lint / type-check / tests
- Cross-layer consistency (when changes span layers)
- Retrieval evidence: final claims must cite current source, Git, or validation proof; unresolved adapter or artifact-search gaps belong in `verify.md`
- Reviewer gate evidence via `task.py record-gate <task> <transition> <gate> <PASS|FAIL|SKIPPED>` when a configured gate applies
- Human-readable validation, review, and acceptance evidence in `verify.md`

Do not silently implement fixes, expand scope, or edit planning artifacts during Verification / Review. Review-found implementation defects inside the approved contract route back to Execution. Requirement, design, contract, scope, gate-configuration, capability/runtime, Parent `contract_epoch`, or Child boundary defects route back to Planning. Validation environment blockers stay in Verification / Review with explicit blocker evidence.

`verify.md` is the evidence center for humans. `task.json.quality_gate_results` should contain only compact machine-checkable results, fingerprints, timestamps, reviewer ids, evidence references, and root-cause metadata.

#### 3.2 Debug retrospective `[on demand]`

If this task involved repeated debugging (the same issue was fixed multiple times), load the `cstl-break-loop` skill to:
- Classify the root cause
- Explain why earlier fixes failed
- Propose prevention

The goal is to capture debugging lessons so the same class of issue doesn't recur.

#### 3.3 Learning decision `[required · once]`

Review whether this task produced durable learning worth recording:
- repeated failure loops or debugging lessons;
- requirement drift, architecture decisions, reusable conventions, or toolchain pitfalls;
- new project-local patterns that should affect future work.

If durable learning exists, load `cstl-update-spec` and update `.trellis/spec/` or write a focused `retrospective.md`, then link that evidence from `verify.md`.

If no durable learning exists, write an explicit `No durable learning` decision in `verify.md`. Do not run a spec update only to satisfy ceremony.

Before archive, `verify.md` must contain validation evidence, final acceptance evidence, gate/review references when applicable, and the durable-learning decision. Parent tasks with children must also include final integration evidence.

#### 3.4 Commit changes `[required · once]`

The AI drives a batched commit of this task's code changes so `/finish-work` can run cleanly afterwards. Goal: produce work commits FIRST, then bookkeeping (archive + journal) commits land after — never interleaved.

**Step-by-step**:

1. **Inspect dirty state**:
   ```bash
   git status --porcelain
   ```
   Snapshot every dirty path. If the working tree is clean, skip to 3.5.

2. **Learn commit style** from recent history (so drafted messages blend in):
   ```bash
   git log --oneline -5
   ```
   Note the prefix convention (`feat:` / `fix:` / `chore:` / `docs:` ...), language (中文/English), and length style.

3. **Classify dirty files into two groups**:
   - **AI-edited this session** — files you wrote/edited via Edit/Write/Bash tool calls in this session. You know what changed and why.
   - **Unrecognized** — dirty files you did NOT touch this session (could be the user's manual edits, leftover WIP from a previous session, or unrelated work). Do NOT silently include these.

4. **Draft a commit plan**. Group AI-edited files into logical commits (1 commit per coherent change unit, not 1 commit per file). Each entry: `<commit message>` + file list. List unrecognized files separately at the bottom.

5. **Present the plan once, ask for one-shot confirmation**. Format:
   ```
   Proposed commits (in order):
     1. <message>
        - <file>
        - <file>
     2. <message>
        - <file>

   Unrecognized dirty files (NOT in any commit — confirm include/exclude):
     - <file>
     - <file>

   Reply 'ok' / '行' to execute. Reply with edits, or '我自己来' / 'manual' to abort.
   ```

6. **On confirmation**: run `git add <files>` + `git commit -m "<msg>"` for each batch in order. Do not amend. Do not push.

7. **On rejection** (user replies "不行" / "我自己来" / "manual" / any pushback on the plan): stop. Do not attempt a second plan. The user will commit by hand; you skip ahead to 3.5 once they confirm.

**Rules**:
- No `git commit --amend` anywhere — three-stage three-commit flow (work commits → archive commit → journal commit).
- Never push to remote in this step.
- If the user wants different message wording but accepts the file grouping, edit the message and re-confirm once — but if they reject the grouping, exit to manual mode.
- The batched plan is one prompt; do not prompt per commit.

#### 3.5 Archive / Learning

Run `task.py archive <task> --check` before the real archive. The check must pass without moving files, changing status, clearing selected-task state, staging or committing, or running hooks.

Real completion is only `task.py archive <task>`. It writes `status=completed`, moves the task to `archive/<YYYY-MM>/`, clears selected-task pointers for that task, and runs archive hooks. Passing validation, user acceptance, reviewer gates, or writing `verify.md` alone does not complete the task.

Archive readiness by mode:

| Mode | Archive readiness |
|---|---|
| No Task | No archive; upgrade to a durable task mode before archive is possible. |
| Micro-Grill | No archive unless upgraded into Lite, Full, or Parent/Child. |
| Lite | Explicit no-gate chain. `verify.md` has substantive validation, final acceptance, and durable-learning decision evidence. |
| Full | Lite evidence plus required completion gates (`full-task-complete/*`), substantive check/change-set evidence, fresh fingerprints, and no unresolved required `FAIL` gates. |
| Child | Lite or Full evidence (by child profile). Full Children require `child-review` gates before Parent `accepted`. Parent task-map marks the Child `integrated` or `cancelled`; integrated Children include `handoff.md`. |
| Parent | Archive evidence plus every Child `integrated` or `cancelled`, substantive final integration evidence, and `parent-integrated/integration-review`. |

Archive / Learning is terminal. After archive, do not silently mutate archived task artifacts; follow-up work requires a new task unless the user explicitly approves an archive amendment.

If archive is not being run in this session, report the passing or failing archive check and the remaining evidence gaps.

---

## Customizing Trellis (for forks)

This section is for developers who want to modify the Trellis workflow itself. All customization is done by editing this file; the scripts are parsers only.

### Changing what a step means

Edit the corresponding step's walkthrough body in the Phase 1 / 2 / 3 sections above. Critical invariants:
- No selected task must use framework/dashboard routing, then triage and ask for task-creation consent before creating a Trellis task.
- Planning must distinguish lightweight PRD-only tasks from complex tasks that require `prd.md`, `design.md`, and `implement.md` before start.
- Every required execution path must keep the Phase 3.4 commit reminder reachable before `/cstl:finish-work`.

All tag blocks live in the `## Phase Index` section above, immediately after each phase summary:

| Scope | Corresponding tag |
|---|---|
| No selected task (before Phase 1) | `[workflow-state:no_task]` (after the Phase Index ASCII art) |
| All of Phase 1 (task created → ready for implementation) | `[workflow-state:planning]` (after Phase 1 summary) |
| Phase 2 + Phase 3.1–3.4 (implementation + check + wrap-up) | `[workflow-state:in_progress]` (after Phase 2 summary) |
| After Phase 3.5 (archived) | `[workflow-state:completed]` (after Phase 3 summary; **currently DEAD**) |

### Changing the per-turn prompt text

Directly edit the body of the corresponding `[workflow-state:STATUS]` block. After editing, run `cstl update` (if you're a template maintainer) or restart your AI session (if you're customizing your own project) — no script changes required.

### Adding a custom status

Add a new block:

```
[workflow-state:my-status]
your per-turn prompt text
[/workflow-state:my-status]
```

Constraints:
- STATUS charset: `[A-Za-z0-9_-]+` (underscores and hyphens allowed, e.g. `in-review`, `blocked-by-team`)
- A lifecycle hook must write `task.json.status` to your custom value, otherwise the tag is never read
- Lifecycle hooks live in `task.json.hooks.after_*` and bind to one of `after_create / after_start / after_finish / after_archive`

### Adding a lifecycle hook

Add a `hooks` field to your `task.json`:

```json
{
  "hooks": {
    "after_archive": [
      "your-script-or-command-here"
    ]
  }
}
```

Supported events: `after_create / after_start / after_archive`. Use `after_archive` for "task is done" notifications. Historical `after_finish` hooks are not part of the selected-task workflow because `task.py finish` no longer exists.

### Full contract

For the workflow state machine's runtime contract, the locations of all status writers, pseudo-statuses (`no_task` / `stale_<source_type>`), the hook reachability matrix, and other deep details, see:

- `.trellis/spec/cli/backend/workflow-state-contract.md` — runtime contract + writer table + test invariants
- `.trellis/scripts/inject-workflow-state.py` — actual parser (reads workflow.md only, no embedded text)
