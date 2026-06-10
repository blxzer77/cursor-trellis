# Design

## Baseline

Implementation targets:

```text
Worktree: D:\MyHarness\Trellis-v0.6.0-beta.22
Branch: personal-v0.6.0-beta.22
Trellis version: 0.6.0-beta.22
Task: .trellis/tasks/06-08-personal-skills-trellis-refactor
```

Reference repositories:

```text
D:\MyHarness\smartsearch-private
D:\MyHarness\Trellis
D:\MyHarness\riverfjs-skills
D:\MyHarness\riverfjs-skills-research
```

`D:\MyHarness\riverfjs-skills\skill-creator\SKILL.md` and the matching research copy under `D:\MyHarness\riverfjs-skills-research\skill-creator\SKILL.md` are the local skill-authoring references for any new or revised Skill file.

## Scope Update

The user rejected the earlier narrow implementation boundary. This task is not limited to bundling `smart-search-cli` and `trellis-micro-grill`. The target is a custom Trellis-derived workflow framework that includes:

- generated custom `.trellis/workflow.md` behavior;
- bundled built-in skills;
- project-level capability integration for the user's chosen MCPs and graph/retrieval tools;
- runtime bundling or management support for required tools.

Implementation should still be split into small reviewable slices, but the architecture must treat these surfaces as one framework rather than unrelated optional follow-ups.

The fork is custom-framework by default. `trellis init` and `trellis update` should produce the custom framework behavior without requiring a `--profile personal`, `trellis personal ...`, or separate profile flag. Source code may still keep custom templates modular to reduce maintenance cost, but the product behavior is not a generic Trellis profile chooser.

The fork is also personal by default. It does not need to preserve upstream Trellis's full generic multi-user behavior, nor full first-class support for every upstream AI platform. Prefer deletion or degradation of unused surfaces before adding new abstraction.

Confirmed first-class platforms:

- Codex
- Claude Code
- Cursor

Confirmed capability classes:

- Core/global framework capabilities: `smart-search-cli` and `trellis-micro-grill`. These always ship with the workflow framework.
- Selectable project capabilities: `fast-context-mcp`, `colbymchenry/codegraph`, Graphify, GitHub MCP, and Playwright MCP. Support for all five must land in this refactor, but they are enabled per project instead of installed into every project by default.

## Current Trellis Skill Pipeline

Trellis already has the required distribution mechanism. Multi-file built-in skills live here:

```text
packages/cli/src/templates/common/bundled-skills/<skill-name>/
```

The pipeline is:

1. `packages/cli/src/templates/common/index.ts`
   - `getBundledSkillTemplates()` lists directories under `bundled-skills/`.
   - It recursively reads files and normalizes file paths to POSIX relative paths.
2. `packages/cli/src/configurators/shared.ts`
   - `resolveBundledSkills(ctx)` renders placeholders and returns `<skill-name>/<relative-file>` entries.
   - `writeSkills()` writes bundled files beside generated single-file workflow skills.
   - `collectSkillTemplates()` exposes the same files for update hash tracking.
3. `packages/cli/src/configurators/index.ts`
   - Each skill-writing platform calls `resolveBundledSkills(ctx)` in both init/write and update/collect paths.
4. `packages/cli/scripts/copy-templates.js`
   - Copies `src/templates/` into `dist/templates/` during `pnpm build`.
5. `packages/cli/package.json`
   - Publishes `dist/**`, so copied bundled assets are included in the npm package.

Conclusion for bundled skills: reuse this existing distribution mechanism. Add skill folders, then update tests and docs that hardcode the current bundled skill set. Broader workflow, runtime, platform cleanup, and capability setup changes are separate slices under the same parent task.

## Target Skill Layouts

### Smart Search

Name:

```text
smart-search-cli
```

Do not prefix this with `trellis-`. This is the user's existing agent-facing contract and matches `smartsearch-private`.

Trellis snapshot:

```text
packages/cli/src/templates/common/bundled-skills/smart-search-cli/
  SKILL.md
  agents/openai.yaml
  examples/batch-search.md
  examples/evidence-gathering.md
  references/cli-contract.md
```

Canonical source:

```text
D:\MyHarness\smartsearch-private\skills\smart-search-cli\
```

Design rules:

- For the bundled skill snapshot, copy only skill assets. Smart Search runtime vendoring is handled separately in Runtime Integration Design.
- Keep frontmatter owned by the bundled `SKILL.md`; do not wrap it with Trellis workflow skill frontmatter.
- Keep `agents/openai.yaml` because Trellis supports agent-skill metadata and the source skill already provides it.
- Keep examples and `cli-contract.md` as progressive disclosure assets.
- Do not include `smart-search` config files, logs, API keys, evidence directories, or `.venv` content.
- Do not depend on the public Smart Search npm package unless the customized `smartsearch-private` implementation is published through that path.

Availability rule:

- The installed framework should expose `smart-search` on `PATH` through the Trellis-owned runtime wrapper.
- If unavailable or unhealthy, agents should run or recommend `smart-search doctor --format json` and report setup blockers. They must not perform uncited web claims as a fallback.

### Trellis Micro-Grill

Name:

```text
trellis-micro-grill
```

Trellis snapshot:

```text
packages/cli/src/templates/common/bundled-skills/trellis-micro-grill/
  SKILL.md
```

Canonical source:

```text
D:\MyHarness\Trellis\.agents\skills\trellis-micro-grill\SKILL.md
```

Design rules:

- Treat this as a Trellis-native wrapper around `grill-me`.
- Keep it short enough that loading the skill does not crowd the planning context.
- Include explicit task escalation boundaries.
- Add `## Hard Constraints` near the top, per `riverfjs/skills/skill-creator`.
- Ask one high-value question at a time.
- Do not create task artifacts by default.

## Platform Targets

Only three platforms are first-class targets:

| Platform | Skill root |
| --- | --- |
| Claude Code | `.claude/skills/` |
| Cursor | `.cursor/skills/` |
| Codex | `.agents/skills/` |

Non-target platform behavior should be removed, disabled, or degraded by default. If keeping an upstream platform writer is cheaper than deletion, it must not drive product decisions, tests, or acceptance criteria for this personal framework.

Project-level MCP/capability config targets:

| Platform | Project-level config |
| --- | --- |
| Codex | `.codex/config.toml` |
| Claude Code | `.mcp.json` |
| Cursor | `.cursor/mcp.json` |

Do not silently write global client configuration. If a global config write is ever required, it must be exposed as an explicit user-approved action.

## Framework Entry And Task Selection

The custom framework must separate three concepts that upstream Trellis currently blends together:

```text
Trellis Framework Context
  = current directory has .trellis and the framework workflow is active

Task Selection Context
  = the current live session has explicitly selected one task

Task Lifecycle Status
  = task.json status such as planning, in_progress, completed
```

New session behavior:

```text
open session in project with .trellis
-> Trellis framework: active
-> Selected task: none
-> show Task Dashboard
-> wait for user to select task / create task / continue without task
```

A new session must not auto-select a task. This remains true even if:

- exactly one task is `planning` or `in_progress`;
- the previous session selected a task;
- exactly one runtime session file exists under `.trellis/.runtime/sessions/`;
- a Parent Task has active Child Workers.

`selected_task` rules:

- `selected_task` is live-session state only.
- Selecting a task does not change `task.status`.
- Exiting a task does not change `task.status`.
- Switching tasks does not change `task.status`.
- `selected_task` may remain selected for the current live session until the user exits, switches, archives the task, or selects another task.
- A new session always starts at `Selected task: none`.

Command model:

```text
task.py dashboard
  Render the compact Task Dashboard for AI routing and user choice.
  Does not select a task and does not change task.status.

task.py list
  Keep the raw task list behavior for scripts and direct inspection.
  Do not mix routing advice or selected_task behavior into this command.

task.py create <task fields...>
  Create task artifacts only.
  Does not select the new task and does not change execution state.

task.py select <task>
  Select the task for the current live session only.
  Does not change task.status.

task.py selected [--source]
  Print the current live-session selected_task.
  Does not change task.status.

task.py start-execution <task> --approved
  Enforce artifact gates and explicit user approval.
  May move planning -> in_progress.

task.py exit
  Clear selected_task for the current live session.
  Does not change task.status.
```

Delete the old `task.py start`, `task.py current`, and `task.py finish` commands and behavior. Do not keep compatibility aliases or deprecation shims. The fork is personal and can break this upstream compatibility to keep semantics clean.

`task.py create` should stay a creation primitive, not an entry primitive. If the user says to create and enter a task, the AI may run `task.py create ...` and then `task.py select <task>` as two explicit steps. A bare create flow must leave `Selected task: none`.

Runtime changes:

- Rename user-facing language from `active task` to `selected task`.
- Replace `current task` inspection with `selected_task` inspection. User-facing commands, hooks, agents, and skills should not keep teaching `task.py current`.
- Remove or disable single-session fallback in `active_task.py`; the framework must not infer a selected task from the existence of one runtime session file.
- Keep session-scoped runtime storage for explicit selections.
- Update generated workflow, command docs, hooks, and tests to use `selected_task`.
- Use `task.py exit` for leaving a Task Selection Context. Use `task.py archive` for task completion. Do not use "finish" for either action.

Hook/context behavior:

- Do not add a separate heavy session header.
- Reuse existing SessionStart and per-turn `workflow-state` / `task-status` injection.
- SessionStart must deliberately ignore previous session selections and single runtime-session files for auto-selection.
- Update injected wording to express:

```text
Trellis framework: active
Selected task: none | <task>
Task status: <status when a task is selected>
```

When `Selected task: none`, the per-turn hook should still inject the `no_task` workflow-state body, but the header must make the distinction clear:

```text
Trellis framework: active
Selected task: none
```

When a task is selected, the per-turn hook should include the selected task id/path, source when useful, and `Task status: <status>`, then choose the workflow-state body by that selected task's `task.status`.

SessionStart should also include a lightweight Task Dashboard:

- open/planning tasks;
- in-progress tasks;
- review tasks;
- blocked tasks;
- Parent Tasks with child summary;
- suggested actions: select task, create task, continue without task, view details.

The dashboard is information and routing context only. It must not select a task.

`task.py dashboard` is the shared renderer for this view. SessionStart, manual user inspection, `/trellis:continue` with no selection, and platform-specific start/continue commands should call or mirror this same renderer instead of each owning separate routing logic.

Command and skill routing:

- `/trellis:continue` means "continue the selected task" only when `selected_task` exists.
- If `/trellis:continue` runs with `Selected task: none`, it shows the Task Dashboard and asks the user to select a task, create a task, inspect details, or continue without a task.
- `/trellis:continue` must never auto-resume a unique task or previous-session selection.
- `$start` and `/trellis:start` are framework/dashboard entry surfaces. They activate or refresh the Trellis Framework Context and show routing choices.
- `$start` and `/trellis:start` must not call the old task-start semantics, select a task, or move `planning -> in_progress`.
- Platform-specific command docs and skills should point task entry to `task.py select <task>` and execution start to `task.py start-execution <task> --approved`.

## Task Ladder And Artifact Gates

The generated workflow should preserve the confirmed ladder:

```text
No Task
Micro-Grill
Lite Task
Full Task
Parent Task / Child Tasks
```

Entry classification applies only when `Selected task: none`.

Classification is risk-and-persistence first. The framework should not classify by apparent effort alone, because a small edit to workflow semantics or runtime setup can carry more long-term risk than a larger localized implementation.

Classification matrix:

| Mode | Use when | Required persistence |
| --- | --- | --- |
| `No Task` | one-off, low-risk, reversible, no durable artifact value; examples include status checks, direct explanations, or safe inspection commands | none |
| `Micro-Grill` | user intent, acceptance criteria, or constraints are unclear, but the work has not yet justified task artifacts | conversation only unless it upgrades |
| `Lite Task` | one low-risk deliverable needs tracking and verification, but no meaningful design or approval gate is required | `prd.md` plus `verify.md` |
| `Full Task` | code, template, config, workflow, platform, runtime, retrieval/capability, or cross-module work has regression, architecture, or review risk | `prd.md`, `design.md`, `implement.md`, `verify.md`, Strategy Contract, gates |
| `Parent Task / Child Tasks` | multiple independent deliverables, staged phases, parallel work, separate verification surfaces, or final integration authority is needed | Parent `task-map.md`, Child artifacts, handoff/integration evidence |

Default Full Task surfaces:

- Trellis framework semantics;
- task model, session model, selected-task behavior, lifecycle commands, or archive behavior;
- Parent/Child orchestration;
- workflow templates, hooks, bundled skills, or generated command docs;
- platform adapters for Codex, Claude Code, or Cursor;
- MCP/capability setup, project config, diagnostics, or readiness gates;
- Smart Search runtime vendoring, Graphify, CodeGraph, fast-context, GitHub MCP, or Playwright MCP;
- quality gates, fingerprints, approval guards, review routing, or validation contracts.

Upgrade to Parent/Child only when the work naturally decomposes into independently deliverable and independently verifiable units, or when staged/parallel execution and Parent-controlled integration are required. Do not create Child Tasks merely because a Full Task has several checklist items.

When no task is selected, classify user requests using repo-first context:

- current request intent, ambiguity, and deliverable count;
- project-local instructions and `.trellis/workflow.md`;
- Task Dashboard and relevant task artifacts;
- affected surface: code, config, workflow, platform adapter, MCP/capability, runtime, task model, templates;
- verification needs: tests, external research, browser verification, retrieval/graph tooling.

Classification outcomes:

```text
No Task
  Clear, low-risk, no durable artifact needed.

Micro-Grill
  Small but underspecified. Ask exactly one high-value question.
  Do not create task artifacts unless it upgrades.

Lite Task
  One low-risk deliverable that needs persistence and verification.
  Usually prd.md plus verify.md.

Full Task
  Technical, architecture, platform, recovery-context, or verification risk.
  Requires prd.md, design.md, implement.md, strategy contract, and user approval.

Parent Task / Child Tasks
  Multiple independently deliverable/verifiable work units requiring coordination,
  staged execution, parallel execution, or final integration.
```

Upgrade suggestions are allowed:

- `No Task -> Micro-Grill`: request is underspecified and one high-value clarification question can resolve the next decision.
- `Micro-Grill -> Lite Task`: clarification reveals one low-risk durable deliverable that needs `prd.md` and `verify.md`.
- `Micro-Grill -> Full Task`: clarification reveals implementation risk, template/config/workflow impact, external research, or review-gate need.
- `Lite Task -> Full Task`: discovered risk requires `design.md`, `implement.md`, external research, cross-file/template/config analysis, quality gates, or execution approval.
- `Full Task -> Parent Task / Child Tasks`: the work splits into multiple independently deliverable/verifiable units, parallelizable branches, staged phases, or Parent-controlled integration paths.

The framework may automatically detect and recommend these upgrades, but it must not silently execute an upgrade that creates artifacts, changes task mode, adds quality gates, changes verification profile, changes selected capabilities, or changes approval requirements. The AI should explain the reason and ask for confirmation before mutating task artifacts or command state.

Automatic downgrade is not allowed. Once the user selected or approved a task mode, downgrading to a lighter mode requires explicit user confirmation because it removes or weakens artifacts, gates, validation, or approval safeguards. Downgrade suggestions are allowed only when the current mode is clearly over-scoped and the user accepts the reduced rigor.

### Return To Planning Rules

Return-to-Planning is a hard cross-cutting rule. It applies during Execution, Verification / Review, Parent/Child integration, and any selected-task continuation.

Return to Planning when any approved contract fact changes or proves invalid:

- `prd.md` scope, constraints, or acceptance criteria;
- `design.md` boundary, dependency, rollback strategy, or validation matrix;
- `implement.md` execution plan;
- Development Strategy Contract fields such as `execution_mode`, `isolation`, `verification_profile`, `retrieval_profile`, `optional_capabilities`, or `quality_gates`;
- quality gate configuration, required gate set, gate dependency rules, or reviewer requirements;
- selected capability or runtime assumptions, including MCP availability, Graphify/CodeGraph indexing assumptions, Smart Search readiness, browser/UI verification assumptions, or GitHub operation assumptions;
- Parent `contract_epoch`, Parent `task-map.md` contract, Child boundary, Child handoff validity, or integration assumptions;
- selected-task fit, such as a new user request clearly exceeding the selected task scope;
- reviewer-gate failure whose root cause is requirement, design, contract, scope, capability, or integration-contract error rather than implementation defect.

Do not return to Planning for ordinary implementation defects inside the approved contract. Those route back to Execution: fix the code/files, update `verify.md`, rerun validation, and rerun affected gates. Planning is for changing or revalidating the contract; Execution is for satisfying the current contract.

When the workflow returns to Planning, the old approval path is no longer sufficient:

```text
update affected artifacts
-> refresh required review gates
-> task.py start-execution <task> --check
-> explicit execution approval
-> task.py start-execution <task> --approved
```

When `Selected task: none`, implementation requests must not be automatically assigned to an existing task. The framework may say that the request appears related to a task, but the user must explicitly choose to select that task, create a new task, or continue without a task.

When a task is selected, subsequent requests default to the selected task's session and artifacts. The global entry classifier re-enters only when:

- the user explicitly exits the task;
- the user explicitly switches task;
- the user explicitly creates a new task;
- the user explicitly says the request is outside the current task;
- the request clearly conflicts with the selected task's scope, `prd.md`, or Parent `task-map.md`.

Selected-task conflict test:

| New request signal | Route |
| --- | --- |
| User says exit, switch, create another task, or this is another task | Leave selected-task flow and follow the explicit user route |
| Request is within `prd.md`, `design.md`, `implement.md`, or Parent `task-map.md` scope | Continue inside selected task |
| Request changes the selected task's scope, acceptance criteria, design boundary, Strategy Contract, gate configuration, selected capability assumptions, or Parent `contract_epoch` | Return to the selected task's Planning flow |
| Request targets another task's artifacts, archive, handoff, or Parent `task-map.md` | Ask the user to select/switch/create before touching it |
| Request introduces a new independent deliverable that cannot be treated as an implementation detail | Recommend new task or Parent/Child upgrade and ask for confirmation |
| Request is unrelated enough that recording it would pollute `verify.md`, gate evidence, or Parent Event Log | Ask whether to exit/switch/create or continue without task |

This rule prevents the framework from reclassifying every turn while a task is selected. The selected task owns ordinary follow-up requests, implementation questions, validation reruns, review fixes, and evidence updates. Only strong conflict signals break out of the selected-task flow.

If the request changes the current contract, the first route is re-plan inside the same selected task, not automatic task switching. Switching or creating another task requires explicit user choice.

Persist classification only for durable task modes:

- No Task: no artifact.
- Micro-Grill: no artifact unless it upgrades.
- Lite Task: write `Task Classification` in `prd.md`.
- Full Task: write `Task Classification` in `prd.md` and the strategy contract in `implement.md`.
- Parent Task: write Parent classification/topology in `task-map.md`; each Child `prd.md` records Child classification and boundary.

Artifact ownership:

| Artifact | Meaning |
| --- | --- |
| `prd.md` | WHAT: user need, scope, constraints, acceptance criteria |
| `design.md` | HOW: architecture, contracts, tradeoffs, rollout shape |
| `implement.md` | DO: ordered execution plan, strategy contract, validation |
| `verify.md` | EVIDENCE: validation commands, outputs, screenshots, review notes |
| `retrospective.md` | Conditional learning only |

`verify.md` is the evidence anchor for completion. For any Lite, Full, Child, or Parent task that reached execution, guarded archive requires `verify.md` to record:

- validation commands and results;
- quality gate evidence references;
- browser/screenshot/UI evidence when applicable;
- final acceptance evidence against `prd.md`;
- whether durable learning existed and, if not, why no `retrospective.md` or spec update was needed.

`retrospective.md` and spec updates are conditional. Use them only for repeated failure loops, requirement drift, architecture decisions, reusable conventions, toolchain pitfalls, or other long-lived knowledge.

Execution gate:

- Micro-Grill stays conversational and asks one high-value question at a time.
- Lite Task may be PRD-only when the blast radius is small.
- Full Task requires `prd.md`, `design.md`, and `implement.md` before implementation.
- Parent/Child work requires Parent `task-map.md`, Child artifacts, hard artifact gate, and explicit user approval before Child execution.

`implement.md` for Full Tasks and Child Workers must start with a lightweight `Development Strategy Contract`:

```yaml
execution_mode: inline | worker | child-task
isolation: main-worktree | git-worktree
verification_profile: standard | strict | architecture
retrieval_profile: exact-only | semantic | structure | architecture-memory
optional_capabilities:
  - fast-context-mcp
  - codegraph
  - graphify
  - github
  - playwright
quality_gates:
  mode: profile | explicit
  profile: standard | strict | architecture
  enabled:
    - requirements-review
    - code-review
    - architecture-review
    - integration-review
  disabled:
    - architecture-deep-review
```

The contract is not a new subsystem. It is a compact pre-execution declaration so the agent, Parent Supervisor, and user agree on execution mode, isolation, retrieval tools, and verification intensity before work starts.

`verification_profile` semantics:

| Profile | Use for | Required evidence |
| --- | --- | --- |
| `standard` | ordinary localized implementation | smallest relevant tests, typecheck/lint/build/smoke as applicable |
| `strict` | cross-module, stateful, CLI, template, migration, or high-regression-risk work | broader targeted suite, regression checks, failure recovery notes |
| `architecture` | workflow, task model, Parent/Child, platform, retrieval, MCP/capability, runtime, or architecture refactor work | design consistency review, boundary/dependency checks, rollback plan, validation matrix, targeted tests |

Herbivore's review gate idea is kept at this semantic level only. Do not copy Herbivore's fixed Claude-only gate chain. Platform-specific review agents may be implementation details under a profile, but the workflow contract is `verification_profile` plus `quality_gates`.

For `verification_profile: architecture`, execution cannot start until `design.md` explicitly contains:

- module/system boundaries;
- dependencies and external capability assumptions;
- rollback strategy;
- validation matrix.

### Quality Gate Contract v1

`quality_gates` makes review gates explicit without adopting Herbivore's Claude-only agent chain. It is part of the Development Strategy Contract, not a separate scheduler.

`baseline-check` is always on and cannot be disabled. It verifies:

- required artifacts exist for the chosen task mode;
- the Development Strategy Contract is complete;
- execution has user approval when required;
- minimum validation expectations are known before work or handoff is claimed.

`baseline-check` is implemented by the CLI, not by an AI reviewer. It checks deterministic facts only and must not decide whether requirements are good, code is correct, architecture is sound, or validation is sufficient beyond declared minimums. Those semantic judgments belong to the named reviewer gates.

For protected transitions that require it, the CLI runs `baseline-check` automatically. Agents do not need to create a prior `baseline-check` review record. On `PASS`, the CLI writes or refreshes:

```text
task.json.quality_gate_results.transitions[transition]["baseline-check"]
```

On `FAIL`, the CLI blocks the transition and prints concrete missing/invalid facts plus next actions. The failure may be recorded with an `issue_fingerprint` when useful for repeated-failure tracking, but no separate gate ledger is introduced.

For `start-execution`, baseline-check verifies:

- task directory exists and `task.json` is readable;
- requested transition is legal, especially `planning -> in_progress`;
- required artifacts exist and are non-empty for the task kind;
- Full Tasks and Child Workers have parseable, complete Development Strategy Contract fields;
- `quality_gates` mode/profile/enabled/disabled configuration is valid;
- `baseline-check` has not been disabled by explicit overrides;
- all gate names are known;
- `architecture-deep-review` is not enabled without `architecture-review`;
- current `contract_fingerprint` and `artifact_fingerprint` can be computed;
- required pre-execution reviewer gate records exist with acceptable result and matching fingerprints;
- `--approved` is present for `start-execution`.

Supported named gates:

| Gate | Purpose | When it runs |
| --- | --- | --- |
| `requirements-review` | Check PRD, scope, constraints, artifact consistency, and approval readiness | before execution for Full Tasks and Child Workers; after major requirement changes |
| `code-review` | Check implementation correctness, maintainability, regressions, and test adequacy | after implementation before handoff or completion |
| `architecture-review` | Check boundaries, coupling, contracts, migration shape, rollback, and validation matrix | required for `verification_profile: architecture`; optional under explicit overrides |
| `architecture-deep-review` | Extra architecture stress test for high-blast-radius design changes | only when explicitly enabled; depends on `architecture-review` |
| `integration-review` | Check merge/integration result, Parent/Child handoff evidence, and conflict resolution | after Parent integration, worktree merge, or other integration step |

Default profile expansion:

| Profile | Default gates |
| --- | --- |
| `standard` | `requirements-review`, `code-review` |
| `strict` | `requirements-review`, `code-review`, conditional `integration-review` |
| `architecture` | `requirements-review`, `architecture-review`, `code-review`, conditional `integration-review` |

`quality_gates.mode: profile` expands from `verification_profile` unless `quality_gates.profile` overrides it. `quality_gates.mode: explicit` uses the task's `enabled` and `disabled` lists, except `baseline-check` remains mandatory. `architecture-deep-review` is never enabled by default.

Quality gates are read-only. A gate returns `PASS` or `FAIL`, reviewed evidence, blocking issues, and next actions. It must not edit code or artifacts directly. On `FAIL`, the main agent or Child Worker fixes the issue and reruns the same gate. If the same gate blocks the same task on the same issue more than three times, Trellis reports the loop to the user, checks for requirement drift, and asks whether to re-plan, continue fixing, or explicitly skip that gate.

Gate failure routing is root-cause based:

| Root cause | Route | Required action |
| --- | --- | --- |
| Implementation defect inside approved contract | Execution | Fix inside the current contract, update evidence, rerun validation, rerun the same gate |
| Requirement, design, contract, scope, capability, runtime, Parent contract, or Child boundary defect | Planning | Update affected artifacts, refresh required gates, rerun `start-execution --check`, get explicit approval |
| Validation environment blocker | Verification / Review | Record blocker evidence in `verify.md`, determine whether recovery is possible without contract change |
| Same gate and same `issue_fingerprint` failed more than three loops | User decision | Ask whether to re-plan, continue fixing, or user-approved skip when the gate is skippable |

Do not treat `FAIL` as automatic skip, automatic Planning escalation, or automatic implementation permission. The gate's evidence must state enough root-cause information for the next route to be defensible.

`baseline-check` failure is always a deterministic guard failure. It blocks the transition and must be fixed by satisfying the missing/invalid facts. It cannot be skipped.

Non-baseline `SKIPPED` is exceptional. It requires explicit user approval, a reason, CLI-generated timestamp, current matching fingerprints, and evidence reference. A skip satisfies only the specific transition/gate/fingerprint combination; it is not a broad pass for future changes.

Codex, Claude Code, and Cursor may implement gates through different reviewer prompts, subagents, or local checks. Those adapters are implementation details; the portable workflow contract is the gate name and required result shape.

Reviewer gate records use one focused CLI entry point:

```text
task.py record-gate <task> \
  --transition start-execution \
  --gate requirements-review \
  --result PASS \
  --reviewer codex \
  --evidence verify.md#requirements-review
```

Minimum required inputs for all non-baseline reviewer gates:

- `<task>`
- `--transition`
- `--gate`
- `--result PASS|FAIL|SKIPPED`
- `--reviewer`
- `--evidence`

`PASS` requires no additional CLI fields.

`FAIL` requires an issue fingerprint and may include a short issue summary:

```text
task.py record-gate <task> \
  --transition start-execution \
  --gate requirements-review \
  --result FAIL \
  --reviewer codex \
  --evidence verify.md#requirements-review \
  --issue-fingerprint sha256:<issue> \
  --issue-summary "PRD acceptance criteria conflict with implementation plan"
```

`SKIPPED` requires explicit user approval metadata. The CLI sets `approved_at` automatically:

```text
task.py record-gate <task> \
  --transition full-task-complete \
  --gate architecture-deep-review \
  --result SKIPPED \
  --reviewer codex \
  --evidence verify.md#architecture-deep-review-skip \
  --skip-approved-by user \
  --skip-reason "User accepted skipping architecture-deep-review for this low-risk change"
```

Do not pass full review prose, blocking issue lists, command output, screenshots, or browser evidence through CLI arguments. Those belong in `verify.md` or Parent `task-map.md`; `record-gate` stores only a machine-checkable summary plus evidence reference.

Do not create one command per gate. `requirements-review`, `code-review`, `architecture-review`, `architecture-deep-review`, and `integration-review` all use `record-gate`. This keeps the CLI cohesive: one writer for structured reviewer results, while reviewer adapters remain platform-specific implementation details.

`record-gate` responsibilities:

- reject `--gate baseline-check`; `baseline-check` is produced only by protected transition guards;
- validate transition key and gate name are known;
- validate the gate is allowed or required for the task's quality-gate contract;
- validate `result` is `PASS`, `FAIL`, or `SKIPPED`;
- validate `reviewer` is present and non-empty;
- validate `evidence` points at a task-local human-readable artifact, usually `verify.md` or Parent `task-map.md`;
- require `issue_fingerprint` for `FAIL`;
- accept only a short optional `issue_summary` for `FAIL`;
- compute current `contract_fingerprint` and relevant `artifact_fingerprint`;
- preserve transition-scoped records under `task.json.quality_gate_results.transitions[transition][gate]`;
- update `issue_fingerprint` and `consecutive_failures` for repeated `FAIL` records;
- require `approved_skip` metadata for `SKIPPED`, generate `approved_at`, and reject `SKIPPED` for `baseline-check`;
- reject large review bodies or payload-like arguments that belong in artifacts.

Reviewer adapters decide the semantic result and write human-readable evidence. `record-gate` validates and stores the machine-checkable summary only.

### CLI Transition Guards

Quality gates are enforced by CLI state-transition guards. Workflow text and reviewer prompts explain what to do; `task.py` decides whether protected transitions may happen.

The CLI does not decide whether code quality or architecture is good. That semantic judgment belongs to Codex, Claude Code, Cursor, or other selected reviewer adapters. The CLI enforces facts it can verify:

- required artifacts exist for the task mode;
- the Development Strategy Contract is present and parseable;
- `quality_gates` has valid mode/profile/enabled/disabled fields;
- `baseline-check` is effectively enabled;
- gate names are known;
- dependency rules are valid, especially `architecture-deep-review` requiring `architecture-review`;
- required reviewer gate records exist and have `PASS` status or valid user-approved `SKIPPED` status where allowed;
- `FAIL` gate records block later transitions unless a user-approved skip is recorded;
- explicit user approval exists before execution starts.

Keep gate state inside existing task artifacts rather than introducing a database, scheduler, or separate gate ledger file in v1. Storage:

- machine-checkable summary in `task.json.quality_gate_results`;
- human-readable evidence in `verify.md`;
- Parent orchestration events in `task-map.md` Event Log.

Minimum gate record shape:

```json
{
  "quality_gate_results": {
    "schema_version": 1,
    "contract_fingerprint": "sha256:<development-strategy-contract-and-quality-gates>",
    "artifact_fingerprint": "sha256:<task-artifacts-and-reviewed-change-set>",
    "transitions": {
      "start-execution": {
        "baseline-check": {
          "result": "PASS",
          "reviewer": "trellis-cli",
          "evidence": "task.json",
          "checked_at": "2026-06-09T00:00:00Z",
          "contract_fingerprint": "sha256:<same-contract>",
          "artifact_fingerprint": "sha256:<same-or-gate-specific-artifacts>",
          "issue_fingerprint": null,
          "consecutive_failures": 0,
          "approved_skip": null
        }
      }
    }
  }
}
```

`transitions` stores the latest machine-checkable record per protected transition and gate, not full review history. This prevents a gate such as `architecture-review` from overwriting itself when it runs both before execution and after implementation. Full review text, command output, screenshots, and rationale belong in `verify.md`; Parent integration decisions belong in `task-map.md` Event Log.

Transition keys:

| Key | Meaning |
| --- | --- |
| `start-execution` | `planning -> in_progress` through `task.py start-execution` |
| `full-task-complete` | Full Task implementation is ready to complete/archive |
| `child-review` | Child `working/blocked -> review` |
| `parent-changes` | Parent sends Child from `review` to `changes` |
| `parent-accepted` | Parent accepts reviewed Child work |
| `parent-integrating` | Parent starts integration for an accepted Child |
| `parent-integrated` | Parent marks Child integrated |
| `parent-cancelled` | Parent cancels Child work |

Result semantics:

| Result | Meaning | CLI behavior |
| --- | --- | --- |
| `PASS` | Gate passed for matching `contract_fingerprint` and relevant `artifact_fingerprint` | can satisfy protected transitions |
| `FAIL` | Gate found blocking issues | blocks protected transitions; same `issue_fingerprint` increments `consecutive_failures` |
| `SKIPPED` | User explicitly accepted bypassing the gate | can satisfy optional/required gates only when `approved_skip` contains approval evidence; never valid for `baseline-check` |

Fingerprint rules:

- Use layered fingerprints. Do not compute one whole-task hash for every gate.
- `contract_fingerprint` is task-level. It covers the Development Strategy Contract, `quality_gates` configuration, enabled/disabled lists, task kind, execution mode, verification profile, and gate dependency rules.
- `contract_fingerprint` excludes self-mutating runtime/result fields: `quality_gate_results`, `execution_approval`, runtime paths, worktree paths, timestamps, checked-at values, approval timestamps, and other generated state.
- `artifact_fingerprint` is scoped by `transition + gate`. It covers only the artifacts and evidence relevant to that gate, plus reviewed change-set identity when the gate is post-implementation.
- Pre-execution gates must not include `verify.md`; writing later validation or review evidence must not invalidate requirements or architecture pre-review.
- Post-implementation gates must include reviewed change-set identity or diff evidence; otherwise code changes could leave stale review records valid.
- Parent/Child gate fingerprints include Parent `contract_epoch` whenever Child validity, handoff validity, or integration validity depends on the Parent contract.
- If a protected transition sees a missing or mismatched fingerprint, the corresponding gate result is stale and does not count as `PASS`.
- `baseline-check` is recomputed and recorded by the CLI for protected transitions that require it; it cannot be manually skipped.
- `SKIPPED` requires `approved_skip: { approved_by: "user", reason: "...", approved_at: "<iso8601>" }`.
- Same-gate failure loops are counted by matching `gate` plus `issue_fingerprint`; a changed issue fingerprint resets `consecutive_failures`.

Recommended `artifact_fingerprint` scopes:

| Transition + gate | Include | Exclude |
| --- | --- | --- |
| `start-execution` + `requirements-review` | `prd.md`, relevant `design.md`/`implement.md` planning sections, stable `task.json` fields | `verify.md`, `quality_gate_results`, `execution_approval`, timestamps |
| `start-execution` + `architecture-review` | `design.md`, architecture sections of `implement.md`, relevant boundary/dependency evidence, stable `task.json` fields | `verify.md`, review results, approval records |
| `full-task-complete` + `code-review` | `verify.md`, relevant task artifacts, reviewed change-set identity/diff evidence | unrelated runtime session files, archived unrelated task data |
| `child-review` + `code-review` | Child `verify.md`, `handoff.md`, relevant Child artifacts, reviewed Child ref/diff evidence, Parent `contract_epoch` | Parent unrelated event history outside the current contract snapshot |
| `parent-integrated` + `integration-review` | Parent `task-map.md` snapshot, Child handoff, integration ref, final validation evidence, Parent `contract_epoch` | unrelated child drafts not in the integration queue |

Stable `task.json` fields include task identity, kind/classification, status needed for the transition, parent/children structural links when relevant, package/scope, and strategy/gate references. They exclude result ledgers and generated runtime state to avoid fingerprint self-pollution.

### Execution Approval

`start-execution` uses explicit command-line approval instead of a separate approval command:

```text
task.py start-execution <task> --approved
```

Preflight uses the same transition command, not a standalone gate-check command:

```text
task.py start-execution <task> --check
```

Do not add a separate `task.py check-gates`, `task.py gate-check`, or equivalent command in v1. A standalone checker would become a second state-machine entry point. Non-mutating preflight belongs on the protected transition command and must call the same guard functions as the real transition.

`--check` rules for every protected transition command that supports it:

- run the same guard function as the real transition;
- report pass/fail, stale fingerprints, and missing/invalid facts;
- do not write `task.json` or other task artifacts;
- do not mutate `task.status` or Parent/Child state;
- do not archive, move, merge, integrate, or clear `selected_task`;
- do not write `execution_approval`;
- do not run hooks such as `after_archive`;
- return success only when the real transition would be allowed after explicit approval or final non-check invocation.

For `start-execution`, `--check` does not require `--approved` and does not write `execution_approval`. A passing check means: artifact gates, quality gate configuration, baseline-check facts, reviewer gate records, and fingerprints are ready; rerun with `--approved` after user approval to mutate `planning -> in_progress`.

Without `--approved` or `--check`, the command must not mutate `task.status` and should point the agent to `--check` for preflight or `--approved` for the actual transition.

With `--approved`, the CLI still validates every guard before changing status:

- required artifacts exist;
- Development Strategy Contract is present and parseable;
- quality gate configuration is valid;
- `baseline-check` passes;
- required pre-execution gate records are valid `PASS` or valid user-approved `SKIPPED` where allowed;
- current fingerprints match the records used for approval.

When the guarded transition is allowed, the CLI writes or refreshes the `baseline-check` gate record, writes approval evidence into `task.json`, and only then mutates `task.status`:

```json
{
  "execution_approval": {
    "schema_version": 1,
    "transition": "start-execution",
    "approved_by": "user",
    "approved_at": "2026-06-09T00:00:00Z",
    "approval_source": "task.py start-execution --approved",
    "contract_fingerprint": "sha256:<development-strategy-contract-and-quality-gates>",
    "artifact_fingerprint": "sha256:<task-artifacts-and-reviewed-change-set>"
  }
}
```

Approval is fingerprint-scoped. If `prd.md`, `design.md`, `implement.md`, `task.json`, the Development Strategy Contract, quality gate configuration, or reviewed change set changes after approval, the old `execution_approval` is stale and cannot satisfy `start-execution`. Markdown-only approval notes are not machine-checkable and do not satisfy the CLI guard.

Protected transitions:

| Transition key | Required gates and guard requirements |
| --- | --- |
| `start-execution` | `baseline-check`, `requirements-review`; add `architecture-review` when `verification_profile: architecture` or explicitly enabled; artifacts complete, strategy contract valid, quality gate config valid, `--approved` provided for mutation, `execution_approval` recorded with matching fingerprints |
| `full-task-complete` | `baseline-check`, `code-review`; add `architecture-review` for architecture profile; add `architecture-deep-review` only when explicitly enabled; validation evidence recorded |
| `child-review` | `baseline-check`, `code-review`; add `architecture-review` for architecture profile; add `architecture-deep-review` only when explicitly enabled; Child `verify.md` and `handoff.md` exist |
| `parent-changes` | No `PASS` gate required; Child is in `review`, blocking issue evidence exists, Parent authority verified, Event Log entry written |
| `parent-accepted` | Child required gates for `child-review` are `PASS` or valid `SKIPPED`, Child `verify.md` and `handoff.md` exist, Parent acceptance evidence written |
| `parent-integrating` | Child is `accepted`, Git ref/worktree evidence exists, `merge_limit: 1` respected, Parent authority verified |
| `parent-integrated` | `baseline-check`, `integration-review`, integration completed, build/test or equivalent validation evidence recorded |
| `parent-cancelled` | No review `PASS` required; Parent authority verified, cancellation reason and Event Log entry written |

This is stronger than Herbivore's current reference implementation. Herbivore is kept as a mechanism reference for explicit gate contracts and read-only review discipline, while this fork makes the protected state transitions enforceable in CLI.

### Completion And Archive

Completion semantics belong to `task.py archive`, not `task.py exit`.

`task.py archive <task>` is a guarded completion transition:

- it validates the task can complete;
- it writes `status=completed` and completion timestamp;
- it moves the task under `.trellis/tasks/archive/<YYYY-MM>/`;
- it clears live-session selected-task pointers that still reference the archived task;
- it runs `after_archive` hooks.

`task.py archive <task> --check` runs the same archive guards without changing status, moving the task, clearing selected-task pointers, staging/committing, or running hooks. It is the completion preflight path; do not add a separate archive-readiness command.

Archive is the only completion writer. Passing validation, writing `verify.md`, receiving user acceptance, or running reviewer gates does not by itself complete the task. Completion happens only when the guarded archive transition succeeds.

There is no `task.py finish` in the custom framework. Existing `after_finish` hook semantics are removed or migrated because "finish" no longer exists as a lifecycle event. Use `after_archive` for "task completed" integrations and `exit` for live-session context clearing.

Archive guards:

| Task kind | Archive guard |
| --- | --- |
| No Task | No archive; no durable task exists |
| Micro-Grill | No archive unless it upgraded into Lite, Full, or Parent/Child |
| Lite Task after execution | `verify.md` exists; required validation evidence recorded; no unresolved required gates |
| Full Task | `verify.md` exists; `quality_gate_results.transitions.full-task-complete` satisfies required gates; acceptance evidence recorded |
| Child Worker | Parent `task-map.md` marks Child `integrated` or `cancelled`; Child `verify.md` and `handoff.md` exist unless cancelled before work started |
| Parent Supervisor | every Child is `integrated` or `cancelled`; final integration evidence exists; required Parent integration gates passed or validly skipped |

Archive readiness is not based on "looks done" or conversation acceptance. It is based on artifact evidence, gate state, fingerprint freshness, Parent/Child state where applicable, and durable-learning decision evidence.

Additional readiness checks:

- all required gate records for the relevant completion transition are current and match fingerprints;
- `verify.md` contains final acceptance evidence against `prd.md`;
- validation commands and results are recorded, including skipped/impossible validation with reason when applicable;
- no unresolved required `FAIL` gates remain unless a non-baseline gate has valid user-approved `SKIPPED` metadata;
- Parent/Child archive requires Parent-controlled state, not Child self-report;
- live-session `selected_task` pointers that reference the archived task are clearable by real archive;
- durable-learning decision is present before real archive.

Spec update is not a mandatory Phase 3 step. During completion, the agent must decide whether durable learning exists:

- if yes, update `.trellis/spec/` or write `retrospective.md` as appropriate and include evidence in `verify.md`;
- if no, write a short "No durable learning" note in `verify.md`.

Learning decision rules:

- durable learning exists when the task reveals reusable project conventions, repeated failure loops, requirement drift, architecture decisions, toolchain pitfalls, platform adapter behavior, retrieval/capability routing lessons, or Parent/Child orchestration lessons;
- no durable learning exists when the task was a localized change, validation was routine, no reusable convention changed, and no long-lived operating knowledge was discovered;
- the decision must be recorded before real archive, because post-archive mutation should be exceptional.

Archive / Learning is terminal. After real archive, follow-up work should become a new task, and additional learning should normally be captured in that new task's artifacts. Editing archived artifacts after completion requires an explicit user-approved archive amendment and must not be a hidden continuation of the old task.

## Parent/Child Orchestration Design

Replace Trellis native parent-child semantics with `Parent Supervisor / Child Worker` while preserving the underlying structural indexes:

- Keep `task.json.parent` and `task.json.children` as structural links.
- Do not introduce multiple selected-task pointers.
- During parallel child work, the single live-session `selected_task` points to the Parent Supervisor after the user explicitly selects it.
- Child Worker state and coordination live in Parent `task-map.md`, child artifacts, Git worktrees/refs, and `handoff.md`.

Parent artifact:

```text
task-map.md
```

`task-map.md` is the orchestration authority. It uses YAML frontmatter for the current snapshot and Markdown for the Event Log.

Minimum snapshot fields:

```yaml
parent_id: personal-skills-trellis-refactor
contract_epoch: 1
execution_topology: serial | parallel | staged
merge_limit: 1
children:
  - id: child-a
    state: open
    depends_on: []
    touches: []
    isolation: git-worktree
    ref: null
integration_queue: []
```

Child artifacts:

- `prd.md`
- `design.md`
- `implement.md`
- `verify.md`
- `handoff.md`

A Child can enter `review` only after `verify.md` and `handoff.md` exist, the artifact gate passes, and the required CLI quality-gate guard passes.

Child states:

```text
open
working
blocked
review
changes
accepted
integrating
integrated
cancelled
```

State authority:

- Child may move itself through `working`, `blocked`, and `review`.
- Parent only may set `changes`, `accepted`, `integrating`, `integrated`, and `cancelled`.
- Child cannot self-accept or self-integrate.
- All Parent-only transitions must go through CLI guards so Parent authority, gate results, handoff evidence, and Event Log entries are checked before the state changes.

Condition vocabulary:

```text
ContractStale
LeaseInvalid
DependencyBlocked
ScopeConflict
VerificationMissing
VerificationFailed
MergeConflict
IntegrationFailed
UserDecisionRequired
```

Parallel eligibility is explicit, not guessed. Parent planning must declare one topology:

```yaml
execution_topology: serial
```

```yaml
execution_topology: parallel
```

```yaml
execution_topology: staged
stages:
  - [child-a, child-b]
  - [child-c]
```

Parallel work is allowed only when:

- there are at least two Child Workers;
- dependencies are absent or can be represented as staged DAG batches;
- each Child has a clear delivery boundary;
- touched files/modules are expected not to overlap heavily;
- shared contracts are defined by the Parent first;
- each Child can provide independent verification evidence;
- Parent can integrate the results serially.

Isolation and integration:

- Default Child isolation is Git worktree isolation.
- Parent integrates from Git refs, not ad hoc local directories.
- `worktree_path` is runtime-only and belongs under ignored `.trellis/.runtime/` data.
- Default integration is serial with `merge_limit: 1`.
- Parent writes integration decisions and conflicts into `task-map.md` Event Log.

Conflict handling:

- `MergeConflict`: Parent resolves when safe; otherwise return the Child to `changes`.
- `ScopeConflict`: Child exceeded its contract; return to `changes` or re-plan.
- `ContractStale`: Parent contract changed; Child must refresh to the new `contract_epoch`.
- `VerificationFailed`: do not enter `integration_queue`.
- `IntegrationFailed`: stop integration, record evidence, and return to handling.

V1 exclusions:

- no `task-map.json`;
- no database;
- no multiple selected-task pointers;
- no complex scheduler.

## Retrieval Architecture Requirement Addendum

Retrieval architecture was previously investigated in child task:

```text
.trellis/tasks/archive/2026-06/06-08-code-retrieval-architecture-evaluation
```

That child task is now reference evidence. This parent task owns the final framework decision: `fast-context-mcp`, `colbymchenry/codegraph`, and Graphify must all land in this refactor as selectable project capabilities, alongside GitHub MCP and Playwright MCP.

The retrieval design goal is fast and accurate lookup without treating every tool as the same kind of search. Use each layer for the problem it is strongest at, and make capability setup project-scoped.

Decision file:

```text
.trellis/tasks/archive/2026-06/06-08-code-retrieval-architecture-evaluation/decision.md
```

Repositories studied:

```text
https://github.com/safishamsi/graphify
https://github.com/colbymchenry/codegraph
https://github.com/codegraph-ai/CodeGraph
https://github.com/optave/ops-codegraph-tool
https://github.com/CodeGraphContext/CodeGraphContext
```

Observed shape:

- Python package name: `graphifyy`.
- CLI name: `graphify`.
- Published script entrypoint: `graphify = graphify.__main__:main`.
- Full build workflow is primarily encoded in `graphify/skill.md` and `skills/graphify/skill.md`, not in a conventional `graphify <path>` CLI implementation. The Skill orchestrates detection, AST extraction, semantic subagents, graph build, community labels, exports, reporting, update, query, path, explain, ingest, watch, hooks, and optional MCP startup.
- The packaged `graphify` CLI currently exposes install/config support commands such as `install`, `vscode install`, `benchmark`, `hook`, and `claude install`; the slash-command workflow in the Skill is the fuller operational contract.
- Core pipeline: `detect() -> extract() -> build_graph() -> cluster() -> analyze() -> report() -> export()`.
- Output directory: `graphify-out/`.
- Important outputs:
  - `GRAPH_REPORT.md`
  - `graph.json`
  - `graph.html`
  - `wiki/index.md`
  - `obsidian/`
  - optional `graph.svg`, `graph.graphml`, Neo4j Cypher
- Optional MCP server: an existing `graphify-out/graph.json` exposed through stdio tools such as `query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`, `graph_stats`, and `shortest_path`.
- Security model: local tool, no network listener, no source-code execution, URL fetch only through explicit ingest, `graphify-out/` path guard for MCP graph files, and sensitive-file skipping during detection.

### Complement With `fast-context-mcp`

`fast-context-mcp`, Graphify, and `colbymchenry/codegraph` should not be treated as duplicates.

Use `fast-context-mcp` for:

- live semantic code search;
- targeted "where is X implemented?" questions;
- file/line range discovery;
- grep keyword suggestions;
- low-setup investigation during implementation.

Use `graphify` for:

- persistent architecture graph creation;
- community and "god node" discovery;
- shortest-path / relationship questions between concepts;
- wiki-style navigation after a corpus has been indexed;
- cross-modal or mixed corpus analysis involving docs, PDFs, images, or diagrams;
- session-to-session architectural memory.

Use `colbymchenry/codegraph` for:

- code-level structural retrieval;
- definitions, callers, callees, imports, and dependencies;
- shortest paths between code symbols;
- refactor impact and affected tests;
- edit preflight when a project-local code graph index exists.

Decided Trellis policy:

- Keep `fast-context-mcp` as the default code-search MCP.
- Treat `colbymchenry/codegraph` as the selectable code-structure graph layer.
- Treat Graphify as the selectable persistent architecture/wiki/mixed-corpus layer.
- Keep GitHub MCP and Playwright MCP as selectable project capabilities for repository actions and browser/UI verification.
- Use a hybrid ownership model:
  - semantic discovery belongs to `fast-context-mcp`;
  - exact proof belongs to `rg`, Git, and direct file reads;
  - code structure belongs to `colbymchenry/codegraph`;
  - architecture/wiki/mixed-corpus memory belongs to Graphify;
  - runtime installation, indexing, build/update, watch/hooks, and MCP configuration are project-selected and user-approved.
- Add a concise retrieval/capability routing surface that routes among semantic search, exact search, CodeGraph indexes, existing Graphify wiki/report files, GitHub MCP, Playwright MCP, and optional MCP queries.

### Capability Stability And Readiness Rules

Capability routing is a decision table, not a scheduler. It should help agents choose the right evidence surface while keeping each tool's lifecycle and failure mode local to that capability.

Stability layers:

| Layer | Capabilities | Stability stance |
| --- | --- | --- |
| Core evidence | `smart-search-cli`, `trellis-micro-grill`, `rg`, Git, direct file reads | Required or always available through the framework/environment; exact proof still comes from `rg`, Git, and direct reads. |
| Official optional tools | GitHub MCP, Playwright MCP | Mature and useful, but selected per project because they may require credentials, remote side effects, browser startup, or persistent session state. |
| Index/API-dependent retrieval | `fast-context-mcp`, `colbymchenry/codegraph`, Graphify | High value, but readiness depends on credentials, runtime availability, graph/index freshness, existing artifacts, and explicit indexing/server choices. |

No capability hallucination:

- Do not say a selectable capability was used unless it was selected for the project, readiness passed or was explicitly skipped, and the agent actually invoked it or read its declared artifacts.
- If a selected capability is unavailable, stale, unauthenticated, or skipped, report that fact and either fall back to an approved lower layer or stop at readiness failure.
- Do not treat fallback evidence as if it came from the unavailable capability.

Minimum readiness checks:

| Capability | Minimum ready signal | Failure/fallback behavior |
| --- | --- | --- |
| `smart-search-cli` | `smart-search doctor --format json` passes the required minimum profile | Required core capability; init/update fail unless `--skip-readiness` is explicit. |
| `fast-context-mcp` | MCP tool is available and a small project-scoped semantic search succeeds or returns a well-formed availability error | Use only for semantic discovery. If unavailable, use `rg`/Git/direct reads and report that semantic discovery was not available. |
| `colbymchenry/codegraph` | `codegraph` runtime exists, project is initialized/indexed, and `codegraph status` or MCP `codegraph_status` reports usable freshness | Do not trust structure/impact/affected-test answers from stale or missing indexes; fall back to exact tools or require index repair. |
| Graphify | `graphify` runtime exists when setup/build is requested; existing `graphify-out/GRAPH_REPORT.md`, `graphify-out/graph.json`, or wiki artifacts exist when querying artifacts | Prefer artifact reads first. Building/updating graph artifacts, hooks/watchers, or MCP startup requires explicit selected-capability approval. |
| GitHub MCP | Server is configured, credentials are valid, and selected read/write/toolset posture is known | Prefer read-only and narrow toolsets. Write-capable remote actions require explicit task scope and user approval. |
| Playwright MCP | Server is configured and browser runtime is available for the selected project/session | Use for UI/browser verification or persistent exploratory browser context. Do not replace unit tests, build checks, or direct source evidence. |

Routing rules:

- `fast-context-mcp` may find candidate files and line ranges quickly, but final claims must be confirmed with `rg`, Git, or direct file reads.
- CodeGraph is authoritative only for indexed code-structure questions after freshness checks; direct file reads remain authoritative for the text being edited.
- Graphify is architecture memory, not a live source-of-truth for unverified current code. Existing artifacts can orient work; stale or missing artifacts require explicit rebuild/update or fallback.
- GitHub MCP is for GitHub remote state and operations, not local repo proof when local Git data is available.
- Playwright MCP is for browser-visible behavior and interaction evidence, not generic code search.

### MCP vs Skill+CLI Evaluation Matrix

| Need | Best candidate | Reason |
| --- | --- | --- |
| Build graph from a corpus | Skill+CLI | The complete pipeline is encoded in the Skill and uses subagent extraction, labeling, exports, and reporting. |
| Incrementally update graph | Skill+CLI | The Skill defines cache/update behavior and asks before expensive semantic extraction. |
| Query existing graph for broad context | MCP or wiki/report | MCP exposes `query_graph`; wiki/report may be cheaper if enough. |
| Shortest path between concepts | MCP | `shortest_path` is a stable MCP tool with structured arguments. |
| Inspect neighbors/node/community | MCP | `get_node`, `get_neighbors`, and `get_community` are explicit tools. |
| Architecture preflight before a Trellis Full Task | Skill reading artifacts first | Reading `wiki/index.md` and `GRAPH_REPORT.md` avoids server startup and dependency churn. |
| Long-running always-on project memory | To be tested | Could be MCP if query quality is better, or Skill+artifact if startup/config overhead outweighs gains. |

### Integration Levels

Use a project-selected integration model:

Level 1: routing surface.

- Generated workflow and/or bundled capability skill explains when to use `fast-context-mcp`, exact search, CodeGraph, Graphify, GitHub MCP, and Playwright MCP.
- No heavyweight indexing happens automatically.

Level 2: project capability setup.

- The init/update flow can ask which selectable capabilities this project should enable.
- It emits project-level config material for Codex, Claude Code, and Cursor.
- It records selected capabilities in a non-secret project artifact or generated config.

Level 3: readiness diagnostics.

- Selected capability availability can be checked explicitly.
- Init/update may fail readiness only for required core capabilities and selected project capabilities.

Level 4: runtime/index operation.

- Building or updating Graphify output requires explicit selection/approval because it may be expensive.
- CodeGraph indexing/query setup requires explicit selection/approval and smoke testing against `colbymchenry/codegraph`.
- MCP server startup remains explicit; ordinary install should not start long-running servers.

Current decision: hybrid and selectable. `fast-context-mcp`, `colbymchenry/codegraph`, Graphify, GitHub MCP, and Playwright MCP all belong to the framework, but they are project-level capabilities rather than global always-on dependencies.

## Skill Destination Rule

Only Codex, Claude Code, and Cursor are first-class targets. For bundled skills this means:

- Avoid platform-specific prose in bundled skill files unless the target platform requires it.
- Avoid placeholders such as `{{CLI_FLAG}}` inside these new skills unless tests prove the rendered destination remains stable.
- Prefer neutral wording such as "Trellis command" or "local CLI" over platform-specific invocation syntax when the same skill file is written to more than one target.

## Test Design

Known hardcoded points:

- `packages/cli/test/configurators/platforms.test.ts`
  - `BUNDLED_SKILL_NAMES` currently lists only `trellis-meta` and `trellis-spec-bootstarp`.
  - Existing tests may assert every skill directory starts with `trellis-`; this must be changed because `smart-search-cli` is a valid bundled companion skill.
  - Platform coverage tests must be updated so Codex, Claude Code, and Cursor are the only first-class targets.
- `packages/cli/test/configurators/index.test.ts`
  - Bundled skill tracking test should assert the two new skill directories and at least one Smart Search reference file.
- `packages/cli/test/commands/init.integration.test.ts`
  - Default init, Codex init, and hash tracking should assert the new bundled files.
  - Capability setup/readiness tests should cover selected project capabilities without requiring all optional capabilities by default.
- Task/session tests should assert:
  - `task.py start` no longer exists;
  - `task.py current` no longer exists;
  - `task.py select` does not mutate `task.status`;
  - `task.py selected [--source]` reports the selected task and source without mutating `task.status`;
  - `task.py exit` does not mutate `task.status`;
  - `task.py start-execution` enforces artifact gates before `planning -> in_progress`;
  - single-session fallback cannot auto-select a task in a new session;
  - hooks render `Selected task: none` when no task is explicitly selected.

Recommended test approach:

- Keep a single `BUNDLED_SKILL_NAMES` list in tests and add constants for representative files:
  - `smart-search-cli/references/cli-contract.md`
  - `trellis-micro-grill/SKILL.md`
- Replace `startsWith("trellis-")` assertions with "has SKILL.md and appears in expected generated names".
- Assert `resolveBundledSkills(ctx).filter(file => file.relativePath.endsWith("/SKILL.md")).length` rather than relying on a prefix.
- Preserve byte-for-byte init/update parity tests; they are the best guard against update churn.

## Documentation Design

Update documentation where it describes bundled skills, generated workflow behavior, runtime setup, or MCP capability setup:

- `packages/cli/src/templates/common/bundled-skills/trellis-meta/references/platform-files/skills-and-commands.md`

Avoid broad README edits unless they are needed to explain the custom framework's install-time behavior.

## Custom Workflow Design

The generated `.trellis/workflow.md` must be based on the currently customized workflow. It should preserve the Trellis task ladder while adding custom routing:

- keep the useful three-phase skeleton for task work, but do not keep the old `task.py start` / `finish` lifecycle semantics;
- add a non-lifecycle `Framework Entry / Routing` layer before task phases;
- split `Execution Gate` out as a hard boundary between Planning and Execution;
- auto-enter Trellis Framework Context when `.trellis/` exists, but start every new session with `Selected task: none`;
- show Task Dashboard at session start without selecting a task;
- use `task.py dashboard` as the shared compact routing renderer and keep `task.py list` as raw task listing;
- require explicit `task.py select <task>` before entering a task session;
- use `task.py selected [--source]` for live-session task inspection;
- keep `task.py create` from auto-selecting or auto-activating newly created tasks;
- use `task.py start-execution <task> --approved` for artifact-gated execution start;
- remove `task.py start`, `task.py current`, and `task.py finish` from workflow text and command guidance;
- reframe `$start` and `/trellis:start` as framework/dashboard entry surfaces;
- reframe `/trellis:continue` as selected-task continuation only, falling back to dashboard plus explicit user choice when no task is selected;
- use Micro-Grill for unclear requirements, PRD pressure-testing, and one-question-at-a-time clarification;
- use Smart Search for external web/docs/API research with reproducible evidence;
- use `fast-context-mcp` for semantic code discovery;
- use exact `rg`, Git, and direct file reads for proof and validation;
- use `colbymchenry/codegraph` for definitions, relationships, callers/callees, dependency paths, and refactor impact when selected for the project;
- use Graphify for architecture graph, wiki, mixed-corpus memory, and concept relationship work when selected for the project;
- use GitHub MCP for explicit repository/issue/PR operations;
- use Playwright MCP for browser inspection, UI verification, and local web testing;
- route Parent/Child work through `task-map.md`, Child artifacts, Git worktree/ref isolation, and Parent-controlled integration.

The workflow should not embed secrets, provider config values, or user-machine-only absolute paths.

### Workflow Chain

The generated workflow should be organized around this chain:

```text
Framework Entry / Routing
  -> Planning
  -> Execution Gate
  -> Execution
  -> Verification / Review
  -> Integration (Parent/Child only)
  -> Archive / Learning
```

This node chain is closed for the current design pass. Additional workflow refinement should not add another lifecycle node unless a later contradiction proves one is necessary. Remaining analysis belongs to cross-cutting rules that operate across the chain:

- task ladder classification: No Task, Micro-Grill, Lite, Full, Parent/Child;
- upgrade and downgrade triggers;
- stop-and-return-to-Planning triggers;
- review failure routing;
- Parent/Child integration routing;
- archive readiness and conditional learning.

`Framework Entry / Routing` is not a task lifecycle phase. It activates the Trellis framework when `.trellis/` exists, shows `Selected task: none`, shows the Task Dashboard, and routes the user toward one of:

- continue without a task;
- use Micro-Grill for a small underspecified request;
- select an existing task;
- create a Lite/Full/Parent task;
- inspect task details before choosing.

It must not mutate `task.status`, infer a selected task, or silently resume a previous selection.

Routing surfaces should stay thin and shared:

- SessionStart uses `task.py dashboard`.
- `task.py dashboard` is the bottom-level renderer for AI-routing views.
- `task.py list` remains raw task enumeration for scripts and direct inspection.
- `/trellis:continue` uses the selected task if one exists; otherwise it shows the dashboard and requests an explicit user route.
- `$start` and `/trellis:start` show the framework/dashboard surface and do not start task execution.
- `task.py create` only creates artifacts. Selecting the created task remains a separate explicit step.

`Planning` keeps the useful old Phase 1 intent, but changes the steps:

```text
classify
-> create or select task
-> write/update prd.md
-> add design.md and implement.md when Full/Child risk requires them
-> declare or update Development Strategy Contract
-> add Parent task-map.md and Child boundaries when needed
-> run research and capability routing
-> run requirements-review and any required pre-execution reviewer gates
-> record reviewer gates with task.py record-gate
-> run task.py start-execution <task> --check
```

Planning is a pre-execution construction and validation stage. It may discover requirements, create or select tasks, write artifacts, search external sources, route optional capabilities, and collect pre-execution review records. It must not edit implementation source files for the requested deliverable, start Child execution, integrate work, mutate `task.status`, or claim execution progress.

Planning outputs are:

- `prd.md` with scope, constraints, acceptance criteria, and task classification;
- `design.md` when architecture, workflow, task-model, integration, runtime, or high-regression risk exists;
- `implement.md` with ordered execution plan and Development Strategy Contract for Full Tasks and Child Workers;
- Parent `task-map.md` and Child boundaries for Parent/Child work;
- recorded pre-execution reviewer gate results, such as `requirements-review` and required `architecture-review`;
- `task.py start-execution <task> --check` result showing whether the task is ready for explicit user approval.

Planning has a hard stop: a passing `--check` means "ready to ask the user for execution approval", not "approved to execute".

Conversational agreement is not execution approval. Words such as "confirm", "agree", "yes", or "start" may approve a design decision, a PRD section, or a Planning update, but they do not authorize execution unless they answer an explicit execution-approval prompt after a passing `start-execution --check`.

The approval handshake is:

```text
task.py start-execution <task> --check
-> AI reports gate result, current fingerprints, required gates, and any skipped gates
-> AI asks explicitly: approve execution for this task and current contract?
-> user approves in that execution context
-> task.py start-execution <task> --approved
```

The AI may not collapse the last two steps into a generic prior "confirmed" from the planning discussion. The CLI still validates all guards on `--approved`; the prompt rule prevents accidental authorization before the CLI guard is reached.

After `task.py start-execution <task> --approved`, these changes are re-plan or scope-change events:

- `prd.md` scope, constraints, or acceptance criteria change;
- `design.md` boundaries, dependencies, rollback strategy, or validation matrix change;
- `implement.md` execution plan, Development Strategy Contract, quality gates, retrieval profile, optional capabilities, or verification profile change;
- Parent `task-map.md` contract or `contract_epoch` changes in a way that affects a Child or integration transition;
- the reviewed execution scope or change-set identity changes.

When a re-plan/scope-change event occurs, existing `execution_approval` and affected pre-execution gate records are stale by fingerprint and must not authorize continued execution. The workflow returns to Planning for artifact update, required reviewer gate refresh, `start-execution --check`, and explicit user approval before execution proceeds under the new contract.

`Execution Gate` is a hard transition boundary, not implementation work:

```text
baseline-check
-> required reviewer gate records valid
-> fingerprints current
-> task.py start-execution <task> --check passes
-> user approves execution
-> task.py start-execution <task> --approved
```

Only `start-execution --approved` may move `planning -> in_progress`.

The Execution Gate has two approval layers:

- workflow approval: the user explicitly approves execution after seeing the passing `--check` result;
- CLI approval record: `task.py start-execution <task> --approved` writes fingerprint-scoped `task.json.execution_approval` before status mutation.

Both are required. A markdown note, chat history, or previous Planning confirmation can support audit context, but it cannot substitute for the guarded `--approved` transition.

`Execution` is controlled by the Development Strategy Contract rather than by a fixed subagent-first flow:

```text
execution_mode: inline | worker | child-task
isolation: main-worktree | git-worktree
retrieval_profile: exact-only | semantic | structure | architecture-memory
```

Codex, Claude Code, and Cursor should each adapt to the same contract. The generated workflow should not assume one platform's agent model is the universal path.

Execution boundary:

- stay inside the approved `prd.md`, `design.md`, `implement.md`, and Development Strategy Contract;
- perform only the approved code/file changes and directly required local edits;
- run the declared validation profile and record evidence in `verify.md`;
- update execution evidence, gate evidence references, and handoff notes when applicable;
- do not run global entry classification again;
- do not auto-switch `selected_task`;
- do not auto-create new scope or silently expand the task;
- do not rewrite `prd.md`, `design.md`, `implement.md`, or the Development Strategy Contract to legitimize work discovered during execution.

Execution stop conditions:

- user request or discovered work conflicts with current `prd.md` scope;
- implementation requires a different design boundary, dependency, rollback plan, validation matrix, or platform/capability assumption;
- the Development Strategy Contract needs a different `execution_mode`, `isolation`, `verification_profile`, `retrieval_profile`, optional capability set, or quality gate configuration;
- Parent `contract_epoch` or child boundary changes affect the task being executed;
- validation shows the approved strategy is wrong enough that fixes would exceed the current contract;
- the agent cannot prove the requested change remains within the selected task.

When a stop condition occurs, execution does not continue by editing the plan in place. The workflow returns to Planning: update artifacts, refresh required review gates, run `task.py start-execution <task> --check`, ask for explicit approval, and then rerun `task.py start-execution <task> --approved` before continuing.

Allowed execution-time artifact updates are evidence-oriented: `verify.md`, handoff notes, execution logs inside existing task artifacts, and Parent `task-map.md` Event Log entries when Parent/Child workflow requires them. Planning artifacts may receive typo-level clarification only when it does not change scope, design, contract, validation requirements, or fingerprints; otherwise it is a re-plan event.

`Verification / Review` replaces the old mandatory finish checklist:

- write `verify.md`;
- run validation commands and record results;
- run reviewer gates such as `code-review` or `architecture-review`;
- record gate results through `task.py record-gate`;
- decide whether durable learning exists.

Verification / Review is an evidence and judgment stage, not a hidden implementation loop. It proves whether the executed change satisfies:

- `prd.md` scope, constraints, and acceptance criteria;
- `design.md` boundaries, dependencies, rollback strategy, and validation matrix when present;
- `implement.md` execution plan and Development Strategy Contract;
- declared validation profile and quality gates;
- Parent `task-map.md` contract and child handoff requirements when applicable.

Allowed Verification / Review actions:

- run tests, lint, typecheck, build, smoke checks, browser checks, and other declared validation;
- inspect diffs and executed artifacts;
- run reviewer gates such as `code-review`, `architecture-review`, `architecture-deep-review`, and `integration-review`;
- write human-readable evidence in `verify.md`;
- record compact machine-checkable gate summaries with `task.py record-gate`;
- update Parent `task-map.md` Event Log with review/integration evidence when Parent/Child flow requires it.

Disallowed Verification / Review actions:

- silently continue implementation to fix issues;
- expand task scope;
- change `prd.md`, `design.md`, `implement.md`, Development Strategy Contract, quality gate configuration, or capability assumptions;
- mark work complete without validation evidence;
- store large review bodies, command output, screenshots, or rationale in `task.json`.

Review routing:

- Implementation defect inside the approved contract: return to Execution, fix, rerun validation, refresh `verify.md`, and rerun affected reviewer gates.
- Validation environment issue: stay in Verification / Review only long enough to document the blocker and determine whether it is recoverable without changing the contract.
- Requirement drift, design error, invalid contract, missing capability assumption, or scope conflict: return to Planning, update artifacts, refresh required gates, rerun `start-execution --check`, and get explicit execution approval.
- Parent/Child integration defect: route through Parent-controlled `task-map.md` state and the relevant integration gate, not direct Child self-acceptance.

Evidence storage stays high-cohesion:

- `verify.md` is the single human-readable evidence center for validation commands/results, review notes, screenshots/browser evidence, acceptance evidence, and "No durable learning" decisions.
- `task.json.quality_gate_results` stores only machine-checkable records: schema version, transition, gate, result, reviewer id, fingerprints, issue/skip metadata, timestamps, and evidence references.
- Parent orchestration evidence belongs in `task-map.md` Event Log.

`Integration` applies only to Parent/Child work. Ordinary Lite Tasks and Full Tasks skip this node and move from Verification / Review toward Archive / Learning after required evidence and gates are satisfied.

Parent-only integration authority:

- Child Workers produce `verify.md`, `handoff.md`, reviewed Git ref/diff evidence, and any required review-gate records.
- Child Workers cannot mark themselves `accepted`, `integrating`, `integrated`, `changes`, or `cancelled`.
- Parent reviews Child evidence and is the only actor that can set Parent-controlled states.
- Parent integrates accepted Child work serially by default with `merge_limit: 1`.
- Parent integrates from Git refs, not ad hoc local directories or runtime worktree paths.
- Parent records every integration decision, conflict, validation result, and state transition in `task-map.md` Event Log.

Integration flow:

```text
Child review evidence ready
-> Parent marks accepted
-> Parent moves one Child to integrating, respecting merge_limit: 1
-> Parent integrates from Child Git ref
-> Parent runs declared integration validation
-> integration-review records PASS / FAIL / SKIPPED where applicable
-> Parent marks integrated or routes to changes/cancelled/re-plan
```

Conflict handling:

- Merge conflict: Parent resolves only when it can do so inside the Parent contract; otherwise the Child returns to `changes`.
- Semantic conflict between Children: Parent records the conflict in `task-map.md`, decides ordering or scope split, and may return one or more Children to `changes`.
- Child exceeded scope: Parent records `ScopeConflict` and routes to `changes`, `cancelled`, or Planning depending on whether the Parent contract must change.
- Integration validation failure: Parent records `IntegrationFailed`, keeps or returns the Child out of `integrating`, and reruns the relevant review/integration path after fixes.
- Parent contract changed: increment or update `contract_epoch`; affected Child handoffs and integration gate fingerprints become stale and must refresh.

`Archive / Learning` is the only completion path:

- run `task.py archive <task> --check`;
- perform conditional spec update or `retrospective.md` only when durable learning exists;
- record "No durable learning" in `verify.md` when skipped;
- run guarded `task.py archive <task>`.

Do not introduce a scheduler-like status ladder for ordinary Full Tasks. The main lifecycle can stay lightweight (`planning -> in_progress -> archived/completed`) while artifacts, gate records, and Parent `task-map.md` carry workflow detail.

## MCP Integration Design

MCP/capability integration must distinguish workflow routing from secret-bearing client configuration and heavyweight runtime work.

Decision: Trellis should generate project-level capability entry points plus diagnostics, but must not silently mutate global MCP/client configuration. If global Codex, Claude, Cursor, or other client config needs to be written, that action must be explicit and user-approved.

Selectable project capabilities:

- `fast-context-mcp` for semantic code search and repository discovery.
- `colbymchenry/codegraph` for code structure, definitions, relationships, impact, and path queries.
- Graphify for architecture graph, wiki/memory, mixed-corpus analysis, and graph artifact navigation.
- GitHub MCP for GitHub repository, issue, PR, and review actions.
- Playwright MCP for browser automation and UI verification.

Project-level config targets:

| Platform | Config file |
| --- | --- |
| Codex | `.codex/config.toml` |
| Claude Code | `.mcp.json` |
| Cursor | `.cursor/mcp.json` |

Design constraints:

- Do not commit credentials or tokens.
- Prefer generated project-local examples, config snippets, or setup scripts over global client mutation.
- If global config must be touched for the framework to work, the command must be explicit and user-approved.
- Capability routing should be reflected in workflow text and/or a concise bundled skill so agents know when to use each surface.
- Capability setup should feel AI-guided: the user chooses desired project capabilities, while the installer/configurator handles mechanical setup behind the flow.
- Ordinary install must not start MCP servers, browser sessions, graph indexing, watchers, or other heavyweight jobs unless the selected capability flow explicitly calls for it.
- Capability routing must follow the Capability Stability And Readiness Rules above, including no capability hallucination, capability-specific readiness checks, and explicit fallback reporting.

Implementation direction:

- Generate project-level setup material for Codex, Claude Code, and Cursor.
- Add or document a diagnostic path that verifies whether selected capabilities are available in the current AI environment.
- Keep secret-bearing config values outside templates.
- Consider an explicit MCP config command for global client config, but do not run it from ordinary `trellis init` or `trellis update`.
- Record unselected optional capabilities as not enabled, not failed.

Readiness decision:

- `smart-search-cli` and `trellis-micro-grill` are required core capabilities.
- External MCP/graph tools are selected project capabilities.
- `trellis init` must initialize or verify only required core capabilities plus selected project capabilities.
- `trellis init` may guide explicit user-approved project/global config actions, but it must not silently mutate global client configuration.
- Non-interactive init should report not-ready selected capabilities with actionable recovery instead of claiming the framework is ready.
- Default readiness failure is a hard init failure only for required core capabilities and selected project capabilities.
- `--skip-readiness` is the explicit repair/debug escape hatch. When used, Trellis may generate files but must print that readiness was skipped and the framework is not verified ready.
- `--skip-readiness` does not make a skipped capability available. Generated workflow and diagnostics must still report that the capability was not verified, and agents must not claim that capability was used until a later readiness check or actual tool/artifact use proves it.

## Runtime Integration Design

Runtime integration must make required tools available or fail with an actionable diagnostic.

Decision: Smart Search is a required built-in runtime, not merely an optional external command. Its canonical source is `D:\MyHarness\smartsearch-private`, which is the customized implementation this framework should carry.

Decision: Smart Search should be vendored into the Trellis CLI package as part of the Trellis install/runtime path. Installing Trellis should expose `trellis`, `tl`, and `smart-search` without requiring a separate Smart Search package install or `trellis personal ...` command.

Initial runtime candidates:

- Smart Search runtime from `D:\MyHarness\smartsearch-private` as a required built-in capability.
- Graphify runtime/indexing only when selected by the project capability flow.
- `colbymchenry/codegraph` runtime/indexing only when selected by the project capability flow and after smoke testing its actual CLI/API contract.

Observed Smart Search package shape:

- `package.json` exposes the `smart-search` bin through `npm/bin/smart-search.js`.
- `npm/scripts/postinstall.js` creates a package-local `.smart-search-python` virtual environment.
- The postinstall installs the Python package from the package root.
- `pyproject.toml` exposes the Python script entry point `smart-search = smart_search.cli:main`.
- The skill assets are included in both `skills/smart-search-cli/**` and `src/smart_search/assets/skills/smart-search-cli/**`.

Target Trellis package shape:

- Copy or sync the Smart Search runtime from `D:\MyHarness\smartsearch-private` into `packages/cli/vendor/smart-search/`.
- Preserve Smart Search's original package/Python/npm wrapper structure inside the vendor directory:
  - `package.json`
  - `pyproject.toml`
  - `src/smart_search/**`
  - `npm/**`
  - `skills/smart-search-cli/**`
  - `README.md` / `README.zh-CN.md`
  - `LICENSE`
- Add the vendored runtime to the Trellis npm package `files`.
- Add a `smart-search` bin entry to Trellis's package metadata.
- Add a Trellis-owned thin wrapper that launches the vendored Smart Search runtime.
- Add postinstall/runtime repair behavior equivalent to Smart Search's npm wrapper: create an isolated Python environment and install the vendored Python package.
- Add a sync or drift-check path so changes in `smartsearch-private` can be intentionally copied into Trellis.
- Preserve Smart Search's license notice when vendoring.

Wrapper decision:

- Use a Trellis-owned wrapper instead of directly reusing Smart Search's `npm/bin/smart-search.js`.
- Keep the wrapper thin: locate `vendor/smart-search`, verify or repair the vendored Python environment, then execute `python -m smart_search.cli ...`.
- Do not fork Smart Search's CLI behavior into Trellis TypeScript.
- Keep Smart Search's internal package structure responsible for provider routing, config, command parsing, and output contracts.
- Use Trellis-specific error messages only for packaging/runtime-location failures, such as a missing vendored runtime after install.
- This keeps the integration low-coupling and high-cohesion: Trellis owns packaging and launch, Smart Search owns search behavior.

Readiness decision:

- Trellis install/postinstall owns Smart Search runtime availability: the vendored Python package and isolated environment must be created or repairable.
- Trellis init owns Smart Search capability readiness: run `smart-search doctor --format json` and require it to pass before claiming the framework is ready.
- If `doctor` reports missing provider configuration, interactive init should guide `smart-search setup`; non-interactive init should report the missing readiness gate and exact recovery commands.
- Default readiness failure is a hard init failure. `trellis init --yes` exits non-zero if `smart-search doctor --format json` does not pass.
- `--skip-readiness` bypasses Smart Search doctor only when explicitly supplied, and the generated output must not claim Smart Search or the framework is ready.
- Provider secrets remain outside Trellis templates and source.

Design constraints:

- Keep runtime install separate from secret/provider configuration.
- Prefer idempotent verification commands such as `smart-search doctor --format json`.
- `D:\MyHarness\smartsearch-private` may be used as the source path during local development. The packaged Trellis runtime should carry Smart Search itself rather than requiring a later `trellis personal setup smart-search` command.
- Do not run heavyweight indexing, watchers, or MCP servers during install unless explicitly requested.
- Do not make Trellis depend on the public `@konbakuyomu/smart-search` package unless the customized implementation is published through that package path. The framework must carry the customized implementation from `smartsearch-private`.

## Drift Management Design

Minimum implementation:

- Vendor the current Smart Search skill snapshot and runtime from `smartsearch-private`.
- Add source-map documentation that the canonical source is `smartsearch-private`.
- Add tests for required skill/runtime file presence and no missing Smart Search reference file.

Deferred stronger implementation:

- Add a script such as `packages/cli/scripts/sync-smart-search.js`.
- It should copy from `SMARTSEARCH_PRIVATE_PATH` if set, otherwise from a documented local default only for the user's development machine.
- It should be opt-in and never run in normal build/test flows.

Recommended choice for this task: include at least a deterministic drift-check path for the vendored Smart Search snapshot and runtime. Avoid hardcoding `D:\MyHarness\smartsearch-private` into production Trellis behavior.

## Rollout Shape

1. Update generated workflow/task templates for the personal task ladder, artifact gates, and `Development Strategy Contract`.
2. Implement Framework Entry / Task Selection split: Task Dashboard, `selected_task`, `task.py select`, `task.py selected`, `task.py start-execution --approved`, `task.py exit`, removal of `task.py start` / `task.py current` / `task.py finish`, and removal of single-session fallback.
3. Implement Parent/Child orchestration semantics around `task-map.md`, topology, states, and Parent-controlled integration.
4. Add `trellis-micro-grill` first because it is small and exercises the bundled skill path.
5. Add `smart-search-cli` snapshot.
6. Vendor the Smart Search runtime and thin launcher.
7. Reduce first-class platform targets to Codex, Claude Code, and Cursor.
8. Add selectable project capability setup/routing/diagnostics for `fast-context-mcp`, `colbymchenry/codegraph`, Graphify, GitHub MCP, and Playwright MCP.
9. Update tests to accept the expanded bundled skill set, personal platform scope, selected-task semantics, Parent/Child semantics, and selected-capability readiness.
10. Run targeted tests, build/typecheck, and local temp init smoke tests using the built CLI.

## Rollback Shape

If implementation exposes broad breakage:

1. Revert the failing functional slice only: workflow, Parent/Child orchestration, skills, runtime, platform cleanup, or capability setup.
2. Keep unaffected slices and this research task's artifacts.
3. Preserve generated/user project files unless explicitly asked to remove them.
4. Do not use destructive Git commands.

## Open Decisions

These are slice-local implementation decisions, not framework-level requirement blockers. They must be frozen before source edits in the workstream that depends on them, but they do not reopen the approved workflow chain or capability ownership model.

- Exact postinstall/runtime repair integration for the Trellis-owned Smart Search wrapper.
- Exact Task Dashboard formatting in user-facing workflow text.
- Exact project capability config rendering for Codex `.codex/config.toml`, Claude Code `.mcp.json`, and Cursor `.cursor/mcp.json`.
- Whether capability routing should live only in workflow text or also in a concise bundled routing skill.
- Exact `colbymchenry/codegraph` install/index/query adapter after smoke testing.
- Exact Graphify adapter split between artifact-first Skill+CLI behavior and optional MCP query behavior.
- Whether the full workflow rewrite should be one source template replacement or layered internally on top of upstream workflow blocks. User-facing behavior remains custom-framework by default either way.

Recommendation: re-plan implementation as functional child slices under this parent task:

1. Workflow/task ladder and artifact gates.
2. Parent/Child Supervisor/Worker orchestration.
3. Bundled core skills.
4. Built-in Smart Search runtime.
5. Platform target cleanup.
6. Project capability setup and diagnostics.
7. Retrieval/graph adapters for `fast-context-mcp`, `colbymchenry/codegraph`, and Graphify.
