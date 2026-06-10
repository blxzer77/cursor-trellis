# Implementation Plan

This task is still in planning. Do not start source implementation until the user reviews this plan and explicitly approves moving from planning to execution.

## Development Strategy Contract

execution_mode: inline
isolation: main-worktree
verification_profile: standard
retrieval_profile: semantic
optional_capabilities:
  - smart-search-cli
  - codegraph
  - graphify
  - fast-context-mcp
  - github-mcp
  - playwright-mcp
quality_gates:
  mode: profile
  profile: standard
  enabled: []
  disabled: []

## Scope Rebaseline

- [x] User rejected the narrow "bundled skills only" implementation boundary.
- [x] Parent task scope now includes custom workflow template changes, MCP configuration integration, and runtime bundling or management.
- [x] User confirmed this fork should be a custom workflow framework by default, not a generic Trellis profile requiring `--profile personal`.
- [x] User clarified that this is not a `trellis personal ...` product surface; Trellis itself must carry the intended behavior.
- [x] Complete framework-level Micro-Grill requirement interrogation. Remaining decisions are slice-local implementation details that must be frozen inside the relevant workstream before dependent source edits.
- [x] Decide the MCP config safety boundary: generate capability setup/diagnostics, but do not silently mutate global MCP/client config.
- [x] Decide Smart Search is a required built-in runtime sourced from `D:\MyHarness\smartsearch-private`, not merely an optional external diagnostic.
- [x] Decide the concrete Smart Search bundling surface: vendor Smart Search into the Trellis CLI package and expose `smart-search` from the Trellis install/runtime path.
- [x] Decide framework readiness gate: `trellis init` must initialize or verify Smart Search and selected project capabilities before claiming the framework is ready.
- [x] Decide readiness failure behavior: default init fails non-zero; only explicit `--skip-readiness` may bypass checks and must report not-ready status.
- [x] Decide Graphify/CodeGraph scope: `fast-context-mcp`, `colbymchenry/codegraph`, Graphify, GitHub MCP, and Playwright MCP all land in this refactor as selectable project capabilities.
- [x] Decide platform scope: only Codex, Claude Code, and Cursor are first-class.
- [x] Decide session model: entering `.trellis/` enters Trellis Framework Context, but every new session starts with `Selected task: none`.
- [x] Decide task selection model: `selected_task` is explicit live-session state, not automatically restored, and fully decoupled from `task.status`.
- [x] Decide selected-task request routing: selected task owns subsequent requests by default; only strong conflicts break out, and contract-changing requests re-plan inside the selected task instead of auto-switching.
- [x] Decide dashboard model: `task.py dashboard` is the shared AI-routing renderer; `task.py list` remains raw task listing.
- [x] Decide command model: delete `task.py start`; add `task.py select`, `task.py start-execution`, and `task.py exit`.
- [x] Decide creation model: `task.py create` creates artifacts only and never auto-selects, auto-activates, or starts execution.
- [x] Decide inspection command model: delete `task.py current`; add `task.py selected [--source]` for live-session selected task inspection.
- [x] Decide platform command semantics: `/trellis:continue` requires an existing `selected_task`, while `$start` and `/trellis:start` are framework/dashboard entry surfaces.
- [x] Decide Planning boundary: Planning stops at execution readiness and may not implement, mutate execution status, or bypass `start-execution --check`.
- [x] Decide re-plan invalidation: post-approval changes to core planning artifacts, strategy contract, gate config, Parent contract, or reviewed execution scope stale prior approval and affected gate records.
- [x] Decide Execution Gate approval handshake: conversational agreement is not execution approval; a passing `start-execution --check`, explicit execution-approval prompt, user approval in that context, and `start-execution --approved` are all required.
- [x] Decide Execution boundary: Execution stays inside the approved contract, updates evidence artifacts, and stops back to Planning when scope/design/contract/capability assumptions need to change.
- [x] Decide Verification / Review boundary: review proves conformance and records evidence; implementation defects route back to Execution, while requirement/design/contract defects route back to Planning.
- [x] Decide return-to-Planning triggers: contract-changing PRD/design/strategy/gate/capability/Parent/Child/selected-task/reviewer-root-cause changes return to Planning; implementation defects inside contract return to Execution.
- [x] Decide Integration boundary: Integration exists only for Parent/Child work; Parent is the only integration authority, Child submits evidence/handoff/ref only, and default integration is serial from Git refs with `merge_limit: 1`.
- [x] Decide Archive / Learning boundary: `task.py archive <task>` is the only completion writer, `archive --check` is the non-mutating completion preflight, and learning artifacts are conditional before archive.
- [x] Decide archive readiness: archive is evidence/gate based; No Task and Micro-Grill have no archive unless upgraded, and every executed durable task records durable-learning decision before archive.
- [x] Decide workflow chain closure: node design is closed around `Framework Entry / Routing -> Planning -> Execution Gate -> Execution -> Verification / Review -> Integration (Parent/Child only) -> Archive / Learning`; next analysis moves to cross-cutting routing and guard rules.
- [x] Decide task ladder classification: classify by risk and persistence, default Trellis framework/platform/MCP/runtime/quality-gate work to at least Full Task, and reserve Parent/Child for independent deliverables or staged/parallel integration.
- [x] Decide upgrade/downgrade rules: automatic upgrade suggestions are allowed, upgrade execution needs confirmation when it changes artifacts/mode/gates/approval, and downgrades always need explicit user confirmation.
- [x] Decide review-gate failure routing: gate `FAIL` is routed by root cause; implementation defects go to Execution, contract-changing defects go to Planning, environment blockers stay in Verification / Review, repeated same-issue failures escalate to the user, and `baseline-check` is never skippable.
- [x] Decide review-gate model: absorb Herbivore's review-gate idea as `verification_profile` plus `Quality Gate Contract v1`, not fixed Claude-only gates.
- [x] Decide quality-gate enforcement model: protected task transitions use strong CLI guards; reviewer adapters provide semantic PASS/FAIL records.
- [x] Decide execution approval model: `task.py start-execution <task> --approved` records fingerprint-scoped `task.json.execution_approval`; no separate approval command.
- [x] Decide baseline-check model: deterministic CLI-run gate, auto-recorded in `task.json.quality_gate_results`, with no semantic review responsibility.
- [x] Decide reviewer gate recording model: one `task.py record-gate <task>` entry point for non-baseline gates; no per-gate commands.
- [x] Decide fingerprint model: task-level `contract_fingerprint` plus transition/gate-scoped `artifact_fingerprint`; exclude self-mutating runtime/result fields.
- [x] Decide preflight model: no standalone `check-gates`; protected transition commands use `--check` to run the same guards without mutation.

## Expanded Workstreams

Use these workstreams as the controlling plan. The detailed bundled-skill phases below remain valid for Workstream 2.

1. **Custom workflow template**
   - [x] Compare the current customized `.trellis/workflow.md` with Trellis's source workflow template.
   - [x] Identify which behavior belongs in source templates, generated project files, or runtime commands.
   - [x] Ensure generated behavior is custom-framework default without a profile flag or `trellis personal ...` command.
   - [x] Preserve the useful three-phase task skeleton while adding non-lifecycle `Framework Entry / Routing`.
   - [x] Split `Execution Gate` into a hard boundary between Planning and Execution.
   - [x] Rework Planning into classify/create-or-select/artifacts/research/reviewer-gate-recording/preflight.
   - [x] Ensure Planning cannot perform implementation edits, execution-status mutation, child execution, integration, or completion claims.
   - [x] Make Planning end at `task.py start-execution <task> --check` and explicit user approval request.
   - [x] Make re-plan/scope-change events invalidate stale `execution_approval` and affected gate records through fingerprints.
   - [x] Add workflow text that ordinary "confirm/agree/start" language does not authorize execution unless it answers an explicit execution-approval prompt after a passing `--check`.
   - [x] Rework Execution to follow `Development Strategy Contract.execution_mode` instead of a fixed subagent-first path.
   - [x] Constrain Execution to approved scope, direct code/file edits, declared validation, and evidence updates.
   - [x] Add Execution stop conditions for requirement drift, scope conflict, design change, contract change, Parent contract change, capability assumption change, or inability to prove task fit.
   - [x] Route Execution stop conditions back to Planning with refreshed gates and explicit approval before continuing.
   - [x] Add a cross-cutting Return-to-Planning rule for PRD scope/acceptance changes, design boundary/dependency/rollback/validation changes, strategy contract changes, quality gate changes, capability/runtime assumption changes, Parent `contract_epoch` or Child boundary changes, selected-task scope mismatch, and non-implementation reviewer-gate failures.
   - [x] Keep implementation defects inside the approved contract routed to Execution rather than Planning.
   - [x] Rework Verification/Review around `verify.md`, reviewer gates, `record-gate`, and conditional learning.
   - [x] Ensure Verification/Review is evidence and judgment only, not a hidden implementation loop.
   - [x] Route review-found implementation defects back to Execution and requirement/design/contract/scope defects back to Planning.
   - [x] Keep `verify.md` as the single human-readable evidence center and `task.json.quality_gate_results` as compact machine-checkable summaries only.
   - [x] Define Integration as Parent/Child-only; ordinary Lite/Full Tasks skip Integration.
   - [x] Define Parent-only integration authority and Child evidence-only handoff behavior.
   - [x] Define serial Git-ref integration with `merge_limit: 1`, Event Log recording, and conflict routing.
   - [x] Rework completion around guarded `task.py archive <task>` and `task.py archive <task> --check`, not `finish`.
   - [x] Make archive the only command that writes completed status and moves tasks to archive.
   - [x] Make `archive --check` use the same guards without status changes, file moves, selected-task clearing, staging/committing, or hooks.
   - [x] Make Learning conditional: spec update or `retrospective.md` only for durable learning, otherwise record "No durable learning" in `verify.md`.
   - [x] Add archive readiness matrix for No Task, Micro-Grill, Lite, Full, Child, and Parent modes.
   - [x] Make archive readiness depend on artifact evidence, required gate state, fingerprint freshness, Parent/Child state when applicable, final acceptance evidence, and durable-learning decision evidence.
   - [x] Treat Archive / Learning as terminal; follow-up work after archive becomes a new task unless the user explicitly approves archive amendment.
   - [x] Keep the main workflow node chain closed unless later analysis exposes a contradiction requiring a new node.
   - [x] Move remaining workflow decisions into cross-cutting routing and guard rules.
   - [x] Avoid adding scheduler-like statuses for ordinary Full Tasks; use artifacts and gate records for substep evidence.
   - [x] Add routing for No Task, Micro-Grill, Lite Task, Full Task, and Parent/Child.
   - [x] Implement risk-and-persistence-based task ladder classification.
   - [x] Default Trellis framework semantics, task model, platform adapters, MCP/capability setup, runtime integration, retrieval/graph tooling, Parent/Child orchestration, and quality gates to Full Task or higher.
   - [x] Upgrade to Parent/Child only for independent deliverables, staged execution, parallel execution, or Parent-controlled integration needs.
   - [x] Add upgrade trigger rules for `No Task -> Micro-Grill`, `Micro-Grill -> Lite/Full`, `Lite -> Full`, and `Full -> Parent/Child`.
   - [x] Require confirmation before executing an upgrade that creates artifacts, changes task mode, adds gates, changes verification profile/capabilities, or changes approval requirements.
   - [x] Require explicit user confirmation for every downgrade because it reduces artifact, gate, validation, or approval rigor.
   - [x] Add repo-first entry classification when `Selected task: none`.
   - [x] Ensure selected-task mode does not rerun global classification on every follow-up request.
   - [x] Add selected-task strong conflict rules: explicit exit/switch/create, out-of-scope request, another task artifact/archive target, new independent deliverable, contract-changing request, or evidence pollution risk.
   - [x] Route contract-changing requests under `selected_task` to the selected task's Planning flow unless the user explicitly switches/creates another task.
   - [x] Add `Development Strategy Contract`, `verification_profile`, and `quality_gates` rules.
   - [x] Add read-only quality gate result shape, profile defaults, explicit overrides, and repeated-failure escalation.
   - [x] Add root-cause-based review-gate failure routing for implementation defects, contract-changing defects, validation environment blockers, and repeated same-issue loops.
   - [x] Keep `baseline-check` unskippable and make non-baseline `SKIPPED` exceptional, user-approved, reasoned, timestamped, and fingerprint-scoped.
   - [x] Add CLI transition-guard rules for quality gates without introducing a database or scheduler.
   - [x] Preserve workflow-state block parsing while changing wording from active task to selected task.
   - [x] Reframe `$start`, `/trellis:start`, and `/trellis:continue` around framework/dashboard routing instead of old task-start/current-task semantics.
2. **Framework entry and task selection**
   - [x] Show Task Dashboard at SessionStart without selecting a task.
   - [x] Add `task.py dashboard` as the shared compact dashboard renderer for SessionStart, manual inspection, and command/skill fallback flows.
   - [x] Keep `task.py list` as raw task enumeration, without routing advice or selection behavior.
   - [x] Change hook output to report Trellis framework active and `Selected task: none | <task>`.
   - [x] Change `/trellis:continue` so it continues only the current `selected_task`; with no selected task, it shows the dashboard and asks for explicit user choice.
   - [x] Change `$start` and `/trellis:start` so they show framework/dashboard routing and never select, start, or resume a task.
   - [x] Delete `task.py start` from generated scripts, docs, commands, and tests.
   - [x] Make `task.py create` stop auto-selecting or auto-activating the created task.
   - [x] Add `task.py select <task>` without status mutation.
   - [x] Delete `task.py current` from generated scripts, docs, hooks, agents, skills, and tests.
   - [x] Add `task.py selected [--source]` without status mutation.
   - [x] Add `task.py start-execution <task> --approved` with artifact gate and user approval before `planning -> in_progress`.
   - [x] Add `task.py exit` without status mutation.
   - [x] Delete `task.py finish` from generated scripts, docs, commands, hooks, and tests.
   - [x] Convert `task.py archive <task>` into the only guarded task completion/archive action.
   - [x] Remove or disable single-session fallback in task resolution.
   - [x] Add task-local gate state in `task.json.quality_gate_results` and machine-checkable gate result records.
   - [x] Add `task.py record-gate <task>` as the single writer for non-baseline reviewer gate records.
   - [x] Make `record-gate` reject manual `baseline-check` records.
   - [x] Make `record-gate` validate transition key, gate name, result, reviewer id, evidence reference, fingerprints, and minimal result metadata.
   - [x] Make `record-gate` require `--issue-fingerprint` for `FAIL`, with optional short `--issue-summary`.
   - [x] Make `record-gate` require `--skip-approved-by user` and `--skip-reason` for `SKIPPED`, with approval timestamp generated by the CLI.
   - [x] Make `record-gate` reject large review bodies, command output, screenshot payloads, or full blocking issue lists as CLI arguments.
   - [x] Add layered fingerprint helpers: task-level `contract_fingerprint` and transition/gate-scoped `artifact_fingerprint`.
   - [x] Exclude `quality_gate_results`, `execution_approval`, runtime paths, timestamps, and generated state from `contract_fingerprint`.
   - [x] Keep `verify.md` out of pre-execution artifact fingerprints.
   - [x] Include reviewed change-set identity or diff evidence in post-implementation artifact fingerprints.
   - [x] Include Parent `contract_epoch` in Child and Parent integration gate fingerprints when Parent contract validity matters.
   - [x] Do not add a standalone `check-gates` command.
   - [x] Add `--check` preflight to protected transition commands that would otherwise mutate task state, archive/move files, integrate children, clear selected-task pointers, or run hooks.
   - [x] Make `--check` call the same guard functions as the real transition and report pass/fail plus missing/invalid facts.
   - [x] Make `--check` avoid all writes, status mutations, archive moves, integration changes, selected-task clearing, approval recording, and hooks.
   - [x] Make `task.py start-execution <task>` enforce artifact completeness, strategy contract validity, quality gate configuration, required `PASS` records, and explicit `--approved`.
   - [x] Make `baseline-check` run automatically inside protected CLI transitions that require it.
   - [x] Make passing `baseline-check` write or refresh `task.json.quality_gate_results.transitions[transition]["baseline-check"]`.
   - [x] Make failing `baseline-check` block the transition with concrete missing/invalid facts and next actions.
   - [x] Require agents and command docs to show/report a passing `task.py start-execution <task> --check` result before asking for execution approval.
   - [x] Require execution approval prompts to explicitly name the task, current contract/fingerprint context, and that approval permits `start-execution --approved`.
   - [x] Make `task.py start-execution <task> --approved` write fingerprint-scoped `task.json.execution_approval` before `planning -> in_progress`.
- [x] Make guarded archive enforce `verify.md` and required Lite/Full completion gates.
- [x] Make guarded archive enforce Parent/Child completion state.
- [x] Make guarded archive enforce final integration evidence beyond Parent `task-map.md` terminal states.
- [x] Make guarded archive enforce conditional Learning decision evidence before real archive.
3. **Parent/Child Supervisor/Worker orchestration**
   - [x] Add/adjust Parent `task-map.md` convention.
   - [x] Add `execution_topology: serial | parallel | staged` field support in the Parent task-map snapshot.
- [x] Add Parent/Child state vocabulary.
- [x] Add Parent/Child condition vocabulary through Child-reported vs Parent-controlled state boundaries.
- [x] Add v1 Git ref evidence and Parent-controlled serial integration state semantics.
- [x] Add automatic Git worktree creation / checkout / merge execution.
- [x] Ensure Child cannot self-accept or self-integrate.
- [x] Ensure Child can only submit `verify.md`, `handoff.md`, and reviewed ref/diff evidence for Parent review.
- [x] Enforce `merge_limit: 1` for default Parent integration and block concurrent Parent integration unless explicitly changed by contract.
- [x] Record Parent/Child link and state-transition events in `task-map.md` Event Log.
- [x] Record v1 Parent integration decisions, change requests, cancellations, and validation/conflict reasons in `task-map.md` Event Log.
   - [x] Make Child `review` and Parent-only `changes` / `accepted` / `integrating` / `integrated` / `cancelled` transitions go through CLI guards.
4. **Bundled built-in skills**
   - [x] Add `trellis-micro-grill`.
   - [x] Add `smart-search-cli`.
   - [x] Update skill distribution tests and build packaging checks.
5. **Smart Search runtime**
   - [x] Treat Smart Search as required built-in runtime sourced from `D:\MyHarness\smartsearch-private`.
   - [x] Decide bundling model: vendor Smart Search runtime files into Trellis rather than depending on the public package or requiring a separate setup command.
   - [x] Choose exact vendored directory layout: `packages/cli/vendor/smart-search/`.
   - [x] Copy/sync runtime files from `D:\MyHarness\smartsearch-private`.
   - [x] Add vendored runtime files to Trellis package output.
   - [x] Decide wrapper shape: Trellis-owned thin wrapper that locates and launches vendored Smart Search while leaving Smart Search CLI logic intact.
   - [x] Add a `smart-search` bin entry.
   - [x] Add the Trellis-owned thin wrapper.
   - [x] Add postinstall/runtime repair behavior for the vendored Python environment.
   - [x] Add sync or drift-check tooling against `D:\MyHarness\smartsearch-private`.
   - [x] Preserve Smart Search license notices.
   - [x] Ensure `smart-search` is available as part of Trellis's install/runtime path, not through `trellis personal setup smart-search`.
   - [x] Keep provider secrets outside templates.
   - [x] Add install/postinstall diagnostics that fail explicitly when the runtime is unavailable.
   - [x] Add init readiness check that runs `smart-search doctor --format json`.
   - [x] Add update readiness check that runs `smart-search doctor --format json`.
   - [x] In interactive init, guide `smart-search setup` when provider configuration is missing.
   - [x] In non-interactive init, report not-ready Smart Search with exact recovery commands.
   - [x] Make Smart Search readiness failure exit non-zero by default.
   - [x] Support explicit `--skip-readiness` for Smart Search readiness bypass, with clear not-ready output.
   - [x] Make `trellis update` Smart Search readiness failure exit non-zero before backups, migrations, template collection, or writes.
   - [x] Support explicit `trellis update --skip-readiness`, with clear not-ready output and no readiness-success claim.
6. **Platform target cleanup**
   - [x] Add explicit first-class vs legacy platform tier metadata.
   - [x] Mark only Codex, Claude Code, and Cursor as first-class.
   - [x] Keep legacy adapters available through explicit init/update compatibility paths.
   - [x] Order interactive init choices with first-class platforms before legacy adapters.
   - [x] Update trellis-meta platform docs to show first-class vs legacy adapter status.
   - [x] Update CLI/init display copy to name Codex, Claude Code, and Cursor as the active framework targets.
   - [x] Add registry invariants that prevent non-target platforms from regaining first-class status accidentally.
7. **Project capability integration**
   - [x] Represent `fast-context-mcp`, `colbymchenry/codegraph`, Graphify, GitHub MCP, and Playwright MCP in the custom framework.
   - [x] Choose the safety model: project-level setup material and diagnostics by default; global client config writes only through explicit user-invoked command.
   - [x] Generate or document project-level config for Codex `.codex/config.toml`, Claude Code `.mcp.json`, and Cursor `.cursor/mcp.json`.
   - [x] Add routing for semantic search, exact proof, code structure, architecture/wiki memory, GitHub operations, and browser/UI verification.
   - [x] Add no-capability-hallucination guidance: unselected, unavailable, skipped, or uninvoked capabilities must not be reported as used.
   - [x] Add fallback reporting: when a selected capability is unavailable or stale, report the fallback layer used or block readiness instead of silently claiming success.
   - [x] Require `fast-context-mcp` semantic results to be confirmed with `rg`, Git, or direct file reads before final evidence claims.
   - [x] Add init/update readiness checks for selected project capabilities only.
   - [x] Add v1 readiness/fallback probes specific to each selectable capability:
     - [x] `fast-context-mcp`: PATH command baseline plus host-level smoke-search warning.
     - [x] `colbymchenry/codegraph`: runtime command baseline plus common index-marker freshness warning.
     - [x] Graphify: runtime command baseline, artifact-first fallback, and missing-artifact warning.
     - [x] GitHub MCP: command baseline plus credential-environment posture gate without printing secrets.
     - [x] Playwright MCP: `npx` baseline plus browser/MCP smoke warning without implicit startup.
   - [x] Add full host-level MCP smoke checks where the CLI can safely verify tool visibility without starting unrelated services.
   - [x] In interactive init, guide explicit user-approved setup/config actions when a selected capability is missing.
   - [x] In non-interactive init, report not-ready selected capabilities with exact recovery commands.
   - [x] Make selected-capability readiness failure exit non-zero by default.
   - [x] Support explicit `--skip-readiness` for selected capability readiness bypass, with clear not-ready output.
   - [x] Ensure `--skip-readiness` never marks skipped capabilities as verified ready.
   - [x] Keep credentials out of repository templates.
8. **Retrieval graph adapters**
   - [x] Smoke test `colbymchenry/codegraph` install/index/query contract before final adapter implementation.
   - [x] Implement CodeGraph as selectable code-structure graph layer.
   - [x] Implement CodeGraph freshness handling so stale/missing indexes route to repair, fallback, or readiness failure.
   - [x] Implement Graphify as selectable architecture/wiki/mixed-corpus layer with artifact-first behavior and explicit approval for indexing/MCP startup.
   - [x] Implement Graphify stale/missing artifact handling so existing artifacts orient work but do not become unverified current-code proof.
9. **Validation**
   - [x] Extend tests for workflow template output, selected-task semantics, task command changes, Parent/Child orchestration, quality gate contract text, skill distribution, built-in runtime availability, Smart Search readiness, selected-capability readiness, no-capability-hallucination guidance, fallback reporting, `--skip-readiness`, and project capability config output.
   - [x] Run targeted tests, typecheck, build, and smoke init/update checks.
10. **Review and handoff**
   - [x] Review diff by workstream.
   - [x] Document validation evidence.
   - [x] Do not commit unless explicitly asked.

## Phase 0: Preflight

- [x] Confirm worktree is `D:\MyHarness\Trellis-v0.6.0-beta.22`.
- [x] Confirm branch is `personal-v0.6.0-beta.22`.
- [x] Confirm `packages/cli/package.json` version is `0.6.0-beta.22`.
- [x] Confirm `D:\MyHarness\riverfjs-skills` exists.
- [x] Read `D:\MyHarness\riverfjs-skills\skill-creator\SKILL.md`.
- [x] Confirm `D:\MyHarness\riverfjs-skills-research` exists.
- [x] Read `D:\MyHarness\riverfjs-skills-research\skill-creator\SKILL.md`.
- [x] Confirm `D:\MyHarness\smartsearch-private\skills\smart-search-cli\` is readable.
- [x] Confirm `D:\MyHarness\Trellis\.agents\skills\trellis-micro-grill\SKILL.md` is readable.
- [x] Research `https://github.com/safishamsi/graphify` through GitHub MCP as an added requirement.
- [x] Record expanded user scope: workflow, MCP integration, and runtime support are in scope.
- [x] Compare current customized `.trellis/workflow.md` against source workflow templates before workflow edits.
- [x] Before code edits, run `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 status --short --branch`.
- [x] Before code edits, inspect relevant source specs from `implement.jsonl`.

## Phase 1: Add `trellis-micro-grill`

- [x] Create `packages/cli/src/templates/common/bundled-skills/trellis-micro-grill/`.
- [x] Add `trellis-micro-grill/SKILL.md`.
- [x] Use the custom Trellis skill as the source:
  - `D:\MyHarness\Trellis\.agents\skills\trellis-micro-grill\SKILL.md`
- [x] Rewrite lightly to match `riverfjs/skills` guidance:
  - [x] `name: trellis-micro-grill`
  - [x] third-person trigger-rich `description`
  - [x] `## Goal`
  - [x] `## Hard Constraints`
  - [x] `## Workflow`
  - [x] `## Escalation`
  - [x] `## When NOT to Use`
- [x] Preserve these behavior rules:
  - [x] no Trellis task by default;
  - [x] exactly one high-value question at a time;
  - [x] inspect local context instead of asking when the answer is discoverable;
  - [x] escalate to Lite/Full or Parent/Child when persistence, broad design risk, or multiple independent deliverables appear;
  - [x] user-facing questions in Simplified Chinese.

## Phase 2: Add `smart-search-cli`

- [x] Create `packages/cli/src/templates/common/bundled-skills/smart-search-cli/`.
- [x] Copy the current Smart Search skill snapshot from:
  - `D:\MyHarness\smartsearch-private\skills\smart-search-cli\`
- [x] Preserve exactly these files unless review finds a reason to exclude one:
  - [x] `SKILL.md`
  - [x] `agents/openai.yaml`
  - [x] `examples/batch-search.md`
  - [x] `examples/evidence-gathering.md`
  - [x] `references/cli-contract.md`
- [x] Verify frontmatter:
  - [x] `name: smart-search-cli`
  - [x] description includes CLI-first, source-backed web research, URL fetching, docs/API search, and reproducible evidence triggers.
- [x] Verify no file contains:
  - [x] API keys;
  - [x] credential values;
  - [x] local provider config JSON;
  - [x] private logs;
  - [x] evidence output files;
  - [x] `.venv`, npm cache, or build output.
- [x] Do not edit Trellis dependencies for Smart Search in this phase.

## Phase 3: Source Pipeline Verification

- [x] Confirm `packages/cli/src/templates/common/index.ts` needs no change:
  - [x] `getBundledSkillTemplates()` discovers both new directories.
  - [x] recursive file scan includes `agents/`, `examples/`, and `references/`.
  - [x] relative paths remain POSIX-style.
- [x] Confirm `packages/cli/src/configurators/shared.ts` needs no change:
  - [x] `resolveBundledSkills(ctx)` preserves bundled frontmatter.
  - [x] `writeSkills()` writes nested bundled files.
  - [x] `collectSkillTemplates()` tracks nested bundled files.
- [x] Confirm `packages/cli/src/configurators/index.ts` already passes `resolveBundledSkills(ctx)` for every skill-writing platform.
- [x] If any platform misses bundled skills, fix the platform collect/write parity and add a regression test.

## Phase 4: Update Tests

### `packages/cli/test/configurators/platforms.test.ts`

- [x] Extend `BUNDLED_SKILL_NAMES` to include:
  - [x] `smart-search-cli`
  - [x] `trellis-micro-grill`
- [x] Add representative bundled file constants:
  - [x] `smart-search-cli/references/cli-contract.md`
  - [x] `trellis-micro-grill/SKILL.md`
- [x] Update Codex skill directory assertions to include both new skills.
- [x] Update Claude Code skill directory assertions to include both new skills.
- [x] Update Cursor skill directory assertions to include both new skills.
- [x] Remove, disable, or downgrade first-class platform assertions for non-target platforms.
- [x] Remove assumptions that every bundled skill starts with `trellis-`; explicitly allow `smart-search-cli`.
- [x] Keep byte-for-byte configure/write parity test unchanged; it should catch missed collect paths.

### Task/session tests

- [x] Assert `task.py start` is not generated or available.
- [x] Assert `task.py finish` is not generated or available.
- [x] Assert `task.py current` is not generated or available.
- [x] Assert `task.py select <task>` writes live-session selected task state without changing `task.status`.
- [x] Assert `task.py selected [--source]` reports live-session selected task state and source without changing `task.status`.
- [x] Assert `task.py exit` clears selected task state without changing `task.status`.
- [x] Assert `task.py start-execution <task>` rejects missing artifact gates before `planning -> in_progress`.
- [x] Assert `task.py start-execution <task>` without `--approved` never mutates `task.status`.
- [x] Assert no standalone `task.py check-gates` or equivalent command is generated.
- [x] Assert protected transition `--check` paths call the same guard functions as real transitions.
- [x] Assert protected transition `--check` paths do not write artifacts, mutate status, archive/move files, clear selected-task pointers, record approval, or run hooks.
- [x] Assert `task.py start-execution <task> --check` verifies readiness without requiring or writing `execution_approval`.
- [x] Assert Planning workflow text stops at `start-execution --check` and does not permit implementation before explicit approval.
- [x] Assert workflow/command guidance rejects generic prior conversational confirmations as execution authorization.
- [x] Assert execution approval guidance requires a passing `start-execution --check` report before asking the user for approval.
- [x] Assert execution approval prompt names the task and current contract/fingerprint context before `start-execution --approved`.
- [x] Assert Execution workflow text stays within approved `prd.md`, `design.md`, `implement.md`, and Development Strategy Contract.
- [x] Assert Execution workflow text does not allow global reclassification, auto task switching, auto scope creation, or planning-artifact edits that change scope/design/contract.
- [x] Assert Execution stop conditions route back to Planning and require refreshed gates plus explicit approval before continuing.
- [x] Assert Return-to-Planning triggers cover PRD, design, strategy contract, gate configuration, capability/runtime assumptions, Parent `contract_epoch`, Child boundary, selected-task fit, and non-implementation reviewer-gate root causes.
- [x] Assert implementation defects inside the approved contract route to Execution, not Planning.
- [x] Assert Verification/Review workflow text does not allow silent implementation fixes or scope expansion.
- [x] Assert review-found implementation defects route to Execution, while requirement/design/contract/scope defects route to Planning.
- [x] Assert `verify.md` contains human-readable validation/review/acceptance evidence and `task.json.quality_gate_results` contains only compact machine-checkable summaries and references.
- [x] Assert ordinary Lite/Full workflow skips Integration and goes from Verification/Review to Archive/Learning checks.
- [x] Assert Integration workflow exists only for Parent/Child and requires Parent authority.
- [x] Assert Child handoff can provide evidence but cannot mark itself `accepted`, `integrating`, `integrated`, `changes`, or `cancelled`.
- [x] Assert Parent integration uses Git refs, respects default `merge_limit: 1`, and writes conflicts/decisions to `task-map.md` Event Log.
- [x] Assert `task.py archive <task> --check` verifies completion guards without archiving, auto-committing, clearing selected-task pointers, or running `after_archive`.
- [x] Assert passing validation, writing `verify.md`, user acceptance, or reviewer gates alone do not mark a task completed without real `task.py archive <task>`.
- [x] Assert `task.py start-execution <task> --approved` writes `task.json.execution_approval` before status mutation.
- [x] Assert `task.py start-execution <task> --approved` rejects stale approval/fingerprint state.
- [x] Assert `task.py start-execution <task>` rejects invalid or missing `quality_gates`.
- [x] Assert `task.py start-execution <task>` auto-runs `baseline-check`.
- [x] Assert passing `baseline-check` writes or refreshes `task.json.quality_gate_results.transitions.start-execution["baseline-check"]`.
- [x] Assert failing `baseline-check` blocks `task.py start-execution <task>` with concrete missing/invalid facts.
- [x] Assert `task.py start-execution <task>` rejects `architecture-deep-review` without `architecture-review`.
- [x] Assert failed quality gate records in `task.json.quality_gate_results` block protected transitions until a later `PASS` or explicit user-approved skip exists.
- [x] Assert `task.py record-gate <task>` is the only command that writes non-baseline reviewer gate records.
- [x] Assert `task.py record-gate <task> --gate baseline-check` is rejected.
- [x] Assert `task.py record-gate <task>` accepts `PASS` with only task, transition, gate, result, reviewer, and evidence.
- [x] Assert `task.py record-gate <task>` rejects `FAIL` without `--issue-fingerprint`.
- [x] Assert `task.py record-gate <task>` accepts `FAIL` with `--issue-fingerprint` and optional short `--issue-summary`.
- [x] Assert `task.py record-gate <task>` rejects `SKIPPED` without `--skip-approved-by user` and `--skip-reason`.
- [x] Assert `task.py record-gate <task>` rejects unknown transitions, unknown gates, invalid results, missing reviewer id, missing evidence, payload-like review body arguments, invalid `SKIPPED` approval metadata, and stale fingerprints.
- [x] Assert `task.py record-gate <task>` writes under `quality_gate_results.transitions[transition][gate]`.
- [x] Assert `quality_gate_results.transitions` scopes results by protected transition key and gate name.
- [x] Assert `architecture-review` results for `start-execution`, `full-task-complete`, and `child-review` do not overwrite each other.
- [x] Assert stale `PASS` records are rejected when `contract_fingerprint` or relevant `artifact_fingerprint` changes.
- [x] Assert post-approval changes to `prd.md`, `design.md`, `implement.md`, Development Strategy Contract, quality gate configuration, Parent `contract_epoch`, or reviewed execution scope invalidate prior approval and affected gate records.
- [x] Assert `contract_fingerprint` changes when the strategy contract or quality gate config changes.
- [x] Assert `contract_fingerprint` does not change when only `quality_gate_results`, `execution_approval`, timestamps, or runtime paths change.
- [x] Assert pre-execution `artifact_fingerprint` does not change when only `verify.md` changes.
- [x] Assert post-implementation `artifact_fingerprint` changes when reviewed change-set identity or diff evidence changes.
- [x] Assert Child/Parent integration artifact fingerprints change when Parent `contract_epoch` changes.
- [x] Assert `SKIPPED` is accepted only with explicit user approval metadata and never for `baseline-check`.
- [x] Assert repeated `FAIL` records with the same `issue_fingerprint` increment repeated-failure tracking and trigger escalation after more than three loops.
- [x] Assert gate `FAIL` routes by root cause: implementation defects to Execution, contract-changing defects to Planning, validation environment blockers to Verification / Review.
- [x] Assert repeated same `gate` plus same `issue_fingerprint` loops require user choice between re-plan, continue fixing, or user-approved skip where allowed.
- [x] Assert no separate gate ledger file is required or generated in v1.
- [x] Assert `task.py archive <task>` rejects executed Lite/Full tasks without `verify.md`.
- [x] Assert No Task and Micro-Grill have no archive unless upgraded into a durable task mode.
- [x] Assert `task.py archive <task>` rejects Full Tasks without valid `quality_gate_results.transitions.full-task-complete`.
- [x] Assert `task.py archive <task>` rejects Child Tasks not marked `integrated` or `cancelled` by the Parent.
- [x] Assert `task.py archive <task>` rejects Parent Tasks with non-integrated/non-cancelled Child Workers.
- [x] Assert archive readiness rejects stale completion gate fingerprints and unresolved required `FAIL` gates.
- [x] Assert archive readiness requires final acceptance evidence and durable-learning decision evidence.
- [x] Assert archive clears selected-task runtime pointers and runs `after_archive`, with no `after_finish` hook path.
- [x] Assert workflow/templates treat spec update and `retrospective.md` as conditional learning artifacts and require "No durable learning" evidence in `verify.md` when skipped.
- [x] Assert archived task artifacts are not silently mutated after completion; follow-up work requires a new task or explicit user-approved archive amendment.
- [x] Assert task ladder classification uses risk and persistence rather than raw effort size.
- [x] Assert framework/platform/MCP/runtime/retrieval/Parent-Child/quality-gate requests default to Full Task or higher.
- [x] Assert Parent/Child is selected only when independent deliverables, staged/parallel execution, or final integration authority is required.
- [x] Assert upgrade suggestions follow the confirmed trigger ladder and do not silently mutate artifacts or task mode without confirmation when rigor changes.
- [x] Assert downgrade paths always require explicit user confirmation.
- [x] Assert selected-task follow-up requests do not rerun global classification by default.
- [x] Assert selected-task strong conflicts include explicit exit/switch/create, out-of-scope request, another task artifact/archive target, new independent deliverable, contract-changing request, and evidence pollution risk.
- [x] Assert contract-changing selected-task requests route to Planning inside the selected task unless the user explicitly switches or creates another task.
- [x] Assert a new session in a Trellis project reports `Selected task: none`.
- [x] Assert single-session fallback cannot auto-select a task.
- [x] Assert SessionStart Task Dashboard lists tasks without selecting one.
- [x] Assert `task.py dashboard` renders the same routing view without selecting a task or mutating `task.status`.
- [x] Assert `task.py list` remains raw task enumeration and does not render dashboard routing copy.
- [x] Assert `/trellis:continue` continues a selected task and falls back to dashboard plus explicit user choice when no task is selected.
- [x] Assert `$start` and `/trellis:start` render framework/dashboard routing without selecting, resuming, or starting a task.
- [x] Assert `task.py create` does not auto-select or auto-activate the created task.
- [x] Assert per-turn `workflow-state` / `task-status` says `Selected task: none | <task>`.

### `packages/cli/test/configurators/index.test.ts`

- [x] Update "tracks bundled built-in skill files" test.
- [x] Assert every `SKILL_ROOTS` entry contains:
  - [x] `<skillRoot>/smart-search-cli/SKILL.md`
  - [x] `<skillRoot>/smart-search-cli/references/cli-contract.md`
  - [x] `<skillRoot>/trellis-micro-grill/SKILL.md`
- [x] Preserve the POSIX-key invariant test.
- [x] Add a short assertion that no collected key contains backslash for new nested Smart Search files.

### `packages/cli/test/commands/init.integration.test.ts`

- [x] In default target-platform init test, assert target platforms install:
  - [x] `.claude/skills/smart-search-cli/SKILL.md`
  - [x] `.claude/skills/smart-search-cli/references/cli-contract.md`
  - [x] `.cursor/skills/trellis-micro-grill/SKILL.md`
- [x] In single-platform Claude test, assert `.claude/skills/smart-search-cli/SKILL.md`.
- [x] In Codex init test, assert:
  - [x] `.agents/skills/smart-search-cli/SKILL.md`
  - [x] `.agents/skills/smart-search-cli/references/cli-contract.md`
  - [x] `.agents/skills/trellis-micro-grill/SKILL.md`
- [x] In Codex hash tracking assertions, assert tracked paths include:
  - [x] `.agents/skills/smart-search-cli/SKILL.md`
  - [x] `.agents/skills/smart-search-cli/references/cli-contract.md`
  - [x] `.agents/skills/trellis-micro-grill/SKILL.md`
- [x] Assert default init invokes `smart-search doctor --format json`.
- [x] Assert Smart Search readiness failure rejects init before creating `.trellis/`.
- [x] Assert `--skip-readiness` bypasses doctor, creates files, and reports framework readiness as unverified.
- [x] Assert default update invokes `smart-search doctor --format json`.
- [x] Assert Smart Search readiness failure rejects update before backups or template writes.
- [x] Assert `trellis update --skip-readiness` bypasses doctor, allows explicit repair/debug writes, and reports framework readiness as unverified.
- [x] Add capability setup tests for selected project capabilities without requiring all optional capabilities by default.
- [x] Add project-level config output tests for Codex `.codex/config.toml`, Claude Code `.mcp.json`, and Cursor `.cursor/mcp.json`.

## Phase 5: Optional Documentation

- [x] Search docs for closed-list descriptions of bundled skills.
- [x] If needed, update:
  - `packages/cli/src/templates/common/bundled-skills/trellis-meta/references/platform-files/skills-and-commands.md`
- [x] Keep documentation concise:
  - [x] bundled skills can be multi-file;
  - [x] Smart Search is CLI-backed and exposed by the Trellis runtime wrapper;
  - [x] Micro-Grill is a Trellis clarification adapter.
  - [x] `selected_task` replaces user-facing active task wording.
  - [x] `task.py select`, `task.py selected`, `task.py start-execution --approved`, and `task.py exit` replace `task.py start` / `task.py current` / `task.py finish`.
- [x] Do not rewrite root README unless release-facing docs become part of the task.

## Phase 6: Targeted Validation

Run from `D:\MyHarness\Trellis-v0.6.0-beta.22`.

- [x] `pnpm --filter @mindfoldhq/trellis test test/configurators/platforms.test.ts test/configurators/index.test.ts test/commands/init.integration.test.ts`
- [x] `pnpm --filter @mindfoldhq/trellis test test/configurators/index.test.ts`
- [x] `pnpm typecheck`
- [x] `pnpm --filter @mindfoldhq/trellis-core build`
- [x] `pnpm --filter @mindfoldhq/trellis build`

If build succeeds:

- [x] Verify `dist/templates/common/bundled-skills/smart-search-cli/SKILL.md`.
- [x] Verify `dist/templates/common/bundled-skills/smart-search-cli/references/cli-contract.md`.
- [x] Verify `dist/templates/common/bundled-skills/trellis-micro-grill/SKILL.md`.

If feasible after targeted tests:

- [x] `pnpm test`

If dependencies are missing or test commands cannot run:

- [x] Not applicable in the final closeout pass: validation commands ran successfully, so no dependency-missing failure needed reporting.
- [x] Not applicable in the final closeout pass: static file checks were used as supplementary evidence, not as a substitute for failed commands.
- [x] Not applicable in the final closeout pass: validation passed and the evidence log records the commands that actually ran.

## Phase 7: Smoke Test With Built CLI

Only after build succeeds:

- [x] Create a temporary directory under the system temp directory.
- [x] Run a built CLI init smoke for Codex, Claude Code, and Cursor target platforms.
- [x] Confirm generated files:
  - [x] `.agents/skills/smart-search-cli/SKILL.md`
  - [x] `.agents/skills/smart-search-cli/references/cli-contract.md`
  - [x] `.agents/skills/trellis-micro-grill/SKILL.md`
  - [x] `.claude/skills/smart-search-cli/SKILL.md`
  - [x] `.cursor/skills/trellis-micro-grill/SKILL.md`
- [x] Confirm `.trellis/.template-hashes.json` tracks the new files.
- [x] Run built CLI `trellis update --dry-run` in the temp repo and verify no template churn when already current.

## Phase 8: Review

- [x] Run `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 status --short --branch`.
- [x] Run `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --stat`.
- [x] Review Smart Search copied files for accidental drift unrelated to the skill snapshot.
- [x] Review tests changed only where bundled skill assumptions were hardcoded or where later expanded workflow/runtime/platform slices required regression coverage.
- [x] Document validation commands and results.
- [x] Do not commit unless the user explicitly asks.

## Phase 9: Deferred Follow-Ups

- [x] Improve Smart Search sync automation after the initial vendored runtime and drift-check path exist.
- [x] Consider richer Graphify MCP query behavior after artifact-first Graphify integration is working.
- [x] Consider richer CodeGraph impact automation after `colbymchenry/codegraph` smoke tests prove the contract.
- [x] Consider richer platform-specific reviewer adapters under `verification_profile` and `quality_gates`, but do not make Claude-only gates the workflow semantics.

## Rollback Plan

If implementation becomes unstable:

1. Revert only the failing functional slice: workflow/task selection, Parent/Child orchestration, skills, runtime, platform cleanup, or project capability setup.
2. Preserve unaffected slices and this task's planning/research artifacts.
3. Do not remove generated/user project files unless explicitly asked.
4. Do not use `git reset --hard` or broad checkout commands.
