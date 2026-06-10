# Verification Evidence

## 2026-06-10 Bundled Built-In Skills Slice

Scope verified:

- Added `packages/cli/src/templates/common/bundled-skills/smart-search-cli/`.
- Added `packages/cli/src/templates/common/bundled-skills/trellis-micro-grill/SKILL.md`.
- Updated bundled skill distribution tests for configurator collection, platform writes, init output, and hash tracking.
- Built CLI templates into `packages/cli/dist/templates/common/bundled-skills/**`.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `git diff --no-index -- D:\MyHarness\smartsearch-private\skills\smart-search-cli D:\MyHarness\Trellis-v0.6.0-beta.22\packages\cli\src\templates\common\bundled-skills\smart-search-cli` | PASS | No content diff; Git printed line-ending warnings only. |
| `rg -n "sk-[A-Za-z0-9]{20,}|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|OPENAI_API_KEY\s*=\s*[^\s]+|ANTHROPIC_API_KEY\s*=\s*[^\s]+|api[_-]?key\s*[:=]\s*[^\s]+|secret\s*[:=]\s*[^\s]+|token\s*[:=]\s*[^\s]+" packages/cli/src/templates/common/bundled-skills/smart-search-cli packages/cli/src/templates/common/bundled-skills/trellis-micro-grill` | PASS | No matches. |
| `pnpm --filter @mindfoldhq/trellis-core build` | PASS | Required before CLI integration tests can import workspace core package. |
| `pnpm --filter @mindfoldhq/trellis test test/configurators/platforms.test.ts test/configurators/index.test.ts test/commands/init.integration.test.ts` | PASS | 3 files, 136 tests passed. |
| `pnpm --filter @mindfoldhq/trellis test test/configurators/index.test.ts` | PASS | Re-run after adding the Smart Search POSIX-key assertion; 43 tests passed. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and `copy-templates` completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |

Built artifact checks:

- `packages/cli/dist/templates/common/bundled-skills/smart-search-cli/SKILL.md` exists.
- `packages/cli/dist/templates/common/bundled-skills/smart-search-cli/references/cli-contract.md` exists.
- `packages/cli/dist/templates/common/bundled-skills/trellis-micro-grill/SKILL.md` exists.

Not run in this slice:

- `pnpm typecheck` as a standalone command. The CLI build ran `tsc`, but `tsc --noEmit` was not run separately.
- Full `pnpm test`.
- Built CLI temp-repo smoke test.

Current conclusion:

The bundled built-in skills slice is verified at source-template, init/update collection, targeted integration-test, and build-copy levels. The broader parent task remains open for workflow/task-selection, Parent/Child orchestration, Smart Search runtime vendoring, platform cleanup, and selectable capability integration.

## 2026-06-10 Framework Entry / Selected-Task Slice

Scope verified:

- `selected_task` is explicit live-session state in Python and OpenCode paths.
- `task.py create` creates artifacts without selecting or activating the task.
- `task.py select`, `task.py selected --source`, `task.py exit`, and `task.py start-execution` replace the old `start/current/finish` user-facing chain in the targeted Codex / Claude / Cursor template surface and regression tests.
- OpenCode runtime tests now assert exact-session `selected_task` lookup and no single-session fallback.
- Init bootstrap / joiner tests now reject `task.py finish` guidance and rely on archive-only completion.
- `tl mem --phase` recognizes `task.py start-execution` as the execution-start boundary while preserving legacy `task.py start` log parsing for older sessions.
- Claude mem project-directory sanitization now handles Windows drive separators in cwd-scoped session lookup.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/regression.test.ts test/configurators/platforms.test.ts test/templates/opencode.test.ts test/commands/init.integration.test.ts test/commands/init-joiner.integration.test.ts test/commands/mem-integration.test.ts` | PASS | 6 files, 471 tests passed. Includes selected-task, execution-gate, OpenCode selected-task, init/joiner, platform, and CLI mem integration coverage. |
| `pnpm --filter @mindfoldhq/trellis-core test test/mem/phase.test.ts` | PASS | 43 tests passed. Covers `start-execution` parsing and legacy `task.py start` compatibility. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `python -m compileall -q packages/cli/src/templates/trellis/scripts packages/cli/src/templates/shared-hooks packages/cli/src/templates/codex/hooks packages/cli/src/templates/copilot/hooks` | PASS | Python template scripts compile. Generated `__pycache__` directories were removed after verifying paths were inside the repo. |
| `rg --pcre2 -n "task\.py current --source|task\.py current\b|task\.py start(?!-)|task\.py finish\b|Current task:|session-fallback" ...targeted paths...` | PASS | Remaining targeted hits are historical explanation or negative regression assertions only. |
| `rg --pcre2 -n "task\.py start(?!-)|task\.py current\b|task\.py finish\b|session-fallback" packages/core/src packages/core/test packages/cli/src/commands/mem.ts packages/cli/test/commands/mem-integration.test.ts` | PASS | Remaining core hits are intentional legacy-session compatibility tests/comments. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors after removing one trailing-space line; Git printed CRLF warnings only. |

Not run in this slice:

- Full `pnpm test`.
- Built CLI temp-repo smoke test.
- GitNexus impact / detect checks; no GitNexus MCP tools are available in this Codex session.

Current conclusion:

The Framework entry / selected-task slice is verified at targeted regression, platform template, OpenCode, init/joiner, CLI mem, core mem, build, typecheck, and Python syntax levels. The broader parent task remains open for dashboard completeness, guarded archive / gate records, Parent/Child orchestration, Smart Search runtime vendoring, platform cleanup beyond the first-class Codex / Claude / Cursor surface, and built CLI smoke validation.

## 2026-06-10 Dashboard Completeness Slice

Scope verified:

- `task.py dashboard` renders a compact routing view without selecting a task, inferring singleton runtime sessions, mutating `task.status`, or mutating session runtime state.
- `task.py list` remains raw task enumeration and does not render dashboard routing copy.
- Shared Python SessionStart and Codex SessionStart inject `<task-dashboard>` and pass hook session input into `render_task_dashboard()`, so selected-task display matches the exact live session.
- OpenCode SessionStart now injects `<task-dashboard>`; generated projects reuse `task.py dashboard`, with a JS fallback for incomplete/test fixtures.
- Common `start` and `continue` command templates are asserted to route through dashboard / selected-task semantics and reject old `task.py start/current/finish` wording.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/regression.test.ts test/templates/opencode.test.ts` | PASS | 2 files, 349 tests passed. Covers dashboard CLI behavior, Python SessionStart dashboard injection, OpenCode SessionStart dashboard injection, selected-task exact-session behavior, and historical regression coverage. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `python -m compileall -q packages/cli/src/templates/trellis/scripts packages/cli/src/templates/shared-hooks packages/cli/src/templates/codex/hooks` | PASS | Python template scripts compile. Generated `__pycache__` directories were verified under `packages/cli/src/templates/` and removed. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |
| `pnpm --filter @mindfoldhq/trellis test test/regression.test.ts` | PASS | Re-run after adding static `start` / `continue` dashboard-routing assertions; 315 tests passed. |
| `pnpm --filter @mindfoldhq/trellis test test/templates/opencode.test.ts` | PASS | Re-run after aligning OpenCode task-status wording; 35 tests passed. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | Serial re-run after `pnpm typecheck` completed; `tsc` and template copy completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `rg --pcre2 -n "task\.py current\b|task\.py finish\b|task\.py start(?!-execution)|Current task:|NO ACTIVE TASK|STALE POINTER|session-fallback" ...dashboard slice paths...` | PASS | Remaining matches are historical task artifacts or negative regression assertions only. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |

Validation note:

- An initial parallel `pnpm --filter @mindfoldhq/trellis build` overlapped with `pnpm typecheck`, while `typecheck` was cleaning/rebuilding `@mindfoldhq/trellis-core`. That parallel build failed with transient missing `@mindfoldhq/trellis-core/*` module declarations. The serial CLI build re-run passed.

Not run in this slice:

- Full `pnpm test`.
- Built CLI temp-repo smoke test.
- Guarded archive / gate-record validations; those remain a separate workstream.

Current conclusion:

Dashboard completeness is verified for the shared CLI renderer, Python SessionStart, Codex SessionStart, OpenCode SessionStart, raw-list separation, and start/continue routing text. The broader parent task remains open for guarded archive / gate records, Parent/Child orchestration, Smart Search runtime vendoring, first-class platform cleanup, optional full-suite validation, and built CLI smoke validation.

## 2026-06-10 Guarded Archive / Gate Records Slice

Scope verified:

- Added `common/task_gates.py` with v1 transition/gate constants, Lite/Full task detection, lightweight Development Strategy Contract parsing, quality gate config validation, layered fingerprints, baseline record creation, reviewer gate record validation, and protected transition guards.
- Added `task.py record-gate <task>` as the focused non-baseline reviewer gate writer.
- `record-gate` rejects manual `baseline-check`, validates transition/gate/result/reviewer/evidence fields, requires `--issue-fingerprint` for `FAIL`, and requires `--skip-approved-by user` plus `--skip-reason` for `SKIPPED`.
- `task.py start-execution --check` remains non-mutating; `--approved` writes `quality_gate_results.transitions.start-execution["baseline-check"]` plus fingerprint-scoped `execution_approval` before `planning -> in_progress`.
- `task.py start-execution <task>` without `--check` or `--approved` is non-mutating and reports the two valid paths.
- `task.py archive <task> --check` now runs non-mutating completion preflight.
- Real `task.py archive <task>` now rejects missing `verify.md`; Full Tasks also require valid `quality_gate_results.transitions.full-task-complete` reviewer gate records before completion.
- Full Task archive writes a CLI-owned `baseline-check` record for `full-task-complete` before status completion and directory move.
- Updated `getAllScripts()` packaging so generated projects receive `common/task_gates.py`.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `python -m compileall -q packages/cli/src/templates/trellis/scripts` | PASS | Initial syntax check after adding `task_gates.py`; generated `__pycache__` was removed. |
| `pnpm --filter @mindfoldhq/trellis test test/regression.test.ts` | PASS | 323 tests passed. Covers record-gate validation/write shape, start-execution no-action non-mutation, start baseline writes, archive `--check` non-mutation, missing `verify.md`, Full Task missing completion gate, and Full Task archive baseline write. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | Serial rerun passed; `tsc` and template copy completed. |
| `python -m compileall -q packages/cli/src/templates/trellis/scripts packages/cli/src/templates/shared-hooks packages/cli/src/templates/codex/hooks` | PASS | Python template scripts compile. Generated `__pycache__` directories were verified under template roots and removed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |

Validation note:

- An initial parallel `pnpm --filter @mindfoldhq/trellis build` overlapped with `pnpm typecheck` while core dist was being rebuilt, and failed with transient missing `@mindfoldhq/trellis-core/*` declarations. The serial CLI build rerun passed.

Not run in this slice:

- Full `pnpm test`.
- Built CLI temp-repo smoke test.
- Parent/Child archive/integration guard validation; Parent/Child orchestration remains a separate workstream.
- Full stale-fingerprint invalidation matrix and direct Git diff/ref identity in post-implementation fingerprints.

Current conclusion:

Guarded archive / gate records v1 is verified for task-local quality gate records, baseline-check ownership, start-execution approval recording, non-mutating archive preflight, Lite archive `verify.md` enforcement, and Full Task completion gate enforcement. The broader parent task remains open for Parent/Child orchestration, Smart Search runtime vendoring, first-class platform cleanup, optional full-suite validation, built CLI smoke validation, and deeper stale-fingerprint matrix coverage.

## 2026-06-10 Parent/Child Orchestration v1 Slice

Scope verified:

- Added `common/task_map.py` as the stdlib-only helper for Parent `task-map.md` frontmatter and Event Log.
- `task.py add-subtask` and `task.py create --parent` now ensure Parent `task-map.md` exists and contains a Child entry in `open` state.
- `task.py remove-subtask` removes the Child entry from Parent `task-map.md`.
- Added `task.py set-child-state <parent> <child> <state> --evidence <ref> [--reason <text>]` to update Parent task-map Child state with an Event Log entry.
- Parent task-map snapshots include `contract_epoch`, `execution_topology`, `merge_limit`, Child `state`, `depends_on`, `touches`, `isolation`, and `ref` fields.
- Child archive now requires Parent `task-map.md` to mark that Child `integrated` or `cancelled`; integrated Children also require `handoff.md`.
- Parent archive now requires every structural Child to be `integrated` or `cancelled` in Parent `task-map.md`.
- Template packaging now includes `common/task_map.py`.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/regression.test.ts` | PASS | 329 tests passed. Added coverage for task-map creation, child-state update, Child archive rejection/pass, and Parent archive rejection/pass. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |
| `python -m compileall -q packages/cli/src/templates/trellis/scripts packages/cli/src/templates/shared-hooks packages/cli/src/templates/codex/hooks` | PASS | Python template scripts compile. Generated `__pycache__` directories were verified under template roots and removed. |

Not run in this slice:

- Full `pnpm test`.
- Built CLI temp-repo smoke test.
- Git ref/worktree integration smoke.
- Parent-only integration commands for `accepted`, `integrating`, `integrated`, conflict routing, and `merge_limit: 1` enforcement beyond the recorded task-map fields.

Current conclusion:

Parent/Child v1 now has a durable Parent `task-map.md` authority, CLI-managed Child state updates, and archive guards that block Child/Parent completion until Parent map state is terminal. The broader parent task remains open for full Parent-controlled integration semantics, Git ref/worktree isolation, capability/runtime work, platform cleanup, optional full-suite validation, and built CLI smoke validation.

## 2026-06-10 Smart Search Runtime Vendoring Slice

Scope verified:

- Vendored Smart Search runtime from `D:\MyHarness\smartsearch-private` into `packages/cli/vendor/smart-search/`.
- Preserved Smart Search package structure for `package.json`, `pyproject.toml`, `npm/**`, `src/smart_search/**`, `skills/smart-search-cli/**`, README files, and `LICENSE`.
- Added Trellis package `smart-search` bin entry at `packages/cli/bin/smart-search.js`.
- Added Trellis-owned wrapper that locates `vendor/smart-search`, repairs missing `.smart-search-python` via the vendored Smart Search postinstall script, then launches `python -m smart_search.cli`.
- Added Trellis package `postinstall` forwarding script at `packages/cli/scripts/postinstall.js`.
- Added opt-in drift-check script at `packages/cli/scripts/check-smart-search-vendor.js` using an explicit source path or `SMARTSEARCH_PRIVATE_PATH`; production wrapper does not hardcode local `D:\MyHarness` paths.
- Added `packages/cli/test/runtime/smart-search-vendor.test.ts` covering package metadata, required vendored files, forbidden runtime/cache files, wrapper launch contract, and drift-check source-path behavior.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `node packages/cli/scripts/check-smart-search-vendor.js D:\MyHarness\smartsearch-private` | PASS | Vendored runtime matches the selected source files; build metadata/cache exclusions are ignored by the drift contract. |
| `Get-ChildItem -LiteralPath packages\cli\vendor\smart-search -Recurse -Force -Directory -Filter '__pycache__'` | PASS | No output; recursive Python cache directories removed from vendor. |
| `Get-ChildItem -LiteralPath packages\cli\vendor\smart-search -Recurse -Force -File -Include '*.pyc','*.pyo'` | PASS | No output; recursive Python bytecode files removed from vendor. |
| `pnpm --filter @mindfoldhq/trellis test test/runtime/smart-search-vendor.test.ts` | PASS | 1 file, 4 tests passed. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | Serial rerun passed; `tsc` and template copy completed. |
| `npm pack --dry-run --json --cache <workspace-cache>` | PASS | Parsed package file list; verified `bin/smart-search.js`, `scripts/postinstall.js`, vendored runtime files are included and forbidden cache/build files are excluded. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |
| `rg -n "[ \t]+$" ...runtime-slice-paths...` | PASS | No trailing whitespace matches in new runtime files or updated task evidence. |

Validation note:

- A first `npm pack --dry-run --json` attempt failed because npm tried to write to the user-level cache under `C:\Users\blaze\AppData\Local\npm-cache` and hit `EPERM`. Re-running with a workspace-local npm cache passed.
- An initial parallel `pnpm --filter @mindfoldhq/trellis build` overlapped with `pnpm typecheck` while core dist was being rebuilt, and failed with transient missing `@mindfoldhq/trellis-core/*` declarations. The serial CLI build rerun passed.

Not run in this slice:

- Real `packages/cli/scripts/postinstall.js`; it would create the Smart Search Python venv and run `pip install` for runtime dependencies.
- Real `bin/smart-search.js` execution or `smart-search doctor --format json`; readiness remains a later init/capability slice.
- Full `pnpm test`.
- Built CLI temp-repo smoke test.

Current conclusion:

Smart Search is now vendored into the Trellis CLI package surface with a Trellis-owned executable wrapper, npm package inclusion, install/runtime repair path, and deterministic local drift-check evidence. The broader parent task remains open for Smart Search readiness in `trellis init`, `--skip-readiness`, selected project capability diagnostics, optional full-suite validation, and built CLI smoke validation.

## 2026-06-10 Platform Target Cleanup Slice

Scope verified:

- Added explicit `tier: "first-class" | "legacy"` platform metadata in `AI_TOOLS`.
- Marked only Codex, Claude Code, and Cursor as first-class.
- Added `FIRST_CLASS_PLATFORM_IDS` and `LEGACY_PLATFORM_IDS` derived helpers.
- Kept legacy adapters registered and explicitly configurable; this slice does not delete existing platform support.
- Ordered interactive `trellis init` choices so first-class platforms appear before legacy adapters.
- Updated CLI/init display copy to name Codex, Claude Code, and Cursor as the active framework targets.
- Updated trellis-meta platform docs to distinguish first-class platform surfaces from legacy adapter directories.
- Added registry invariants to prevent non-target platforms from being treated as first-class again by accident.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/registry-invariants.test.ts test/configurators/platforms.test.ts test/commands/init.integration.test.ts` | PASS | Serial rerun passed; 3 files, 113 tests passed. Covers registry tier invariants, platform template parity, and init behavior. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |

Validation note:

- An initial parallel run of the platform test group overlapped with `pnpm typecheck` while core dist was being rebuilt, causing `init.integration.test.ts` to fail importing `@mindfoldhq/trellis-core/task`. The serial test rerun after typecheck passed.

Not run in this slice:

- Full `pnpm test`.
- Built CLI temp-repo smoke test for first-class platform targets.
- Removal of legacy adapter code/templates; this slice intentionally tiers them instead of deleting them.

Current conclusion:

The platform model now has an explicit first-class boundary around Codex, Claude Code, and Cursor while retaining legacy adapter compatibility for explicitly configured projects. The broader parent task remains open for Smart Search readiness in `trellis init`, `--skip-readiness`, selected project capability diagnostics, optional full-suite validation, and built CLI smoke validation.

## 2026-06-10 Smart Search Init Readiness Slice

Scope verified:

- Added the required `trellis init` Smart Search readiness gate by running `smart-search doctor --format json`.
- Default readiness failure now blocks init before `.trellis/` is created in the normal non-template init path.
- Readiness failures report concise details plus exact recovery commands: `smart-search doctor --format json`, `smart-search setup`, and `trellis init --skip-readiness`.
- Added explicit `trellis init --skip-readiness`; it bypasses doctor and reports framework readiness as unverified rather than ready.
- Added init integration coverage for the default doctor call, failure blocking, and skip-readiness bypass.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/commands/init.integration.test.ts` | PASS | 1 file, 38 tests passed. Covers default Smart Search doctor invocation, readiness failure blocking before `.trellis/`, and `--skip-readiness`. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |
| `rg -n "[ \t]+$" packages\cli\src\commands\init.ts packages\cli\src\cli\index.ts packages\cli\test\commands\init.integration.test.ts .trellis\tasks\06-08-personal-skills-trellis-refactor\implement.md .trellis\tasks\06-08-personal-skills-trellis-refactor\verify.md` | PASS | No output; `rg` returned 1 because there were no matches. |

Not run in this slice:

- Real `smart-search doctor --format json`; integration tests mock `execSync` to avoid requiring provider credentials or network.
- Interactive `smart-search setup` guidance for missing provider configuration.
- `trellis update` readiness / `--skip-readiness`.
- Selected project capability readiness for fast-context, CodeGraph, Graphify, GitHub MCP, or Playwright MCP.
- Full `pnpm test`.
- Built CLI temp-repo smoke test.

Current conclusion:

`trellis init` now treats Smart Search as required framework readiness by default while retaining an explicit repair/debug bypass. The broader parent task remains open for interactive setup guidance, update readiness, selected capability diagnostics, optional full-suite validation, and built CLI smoke validation.

## 2026-06-10 Smart Search Update Readiness Slice

Scope verified:

- Extracted Smart Search readiness into `packages/cli/src/utils/readiness.ts` for init/update reuse.
- `trellis update` now runs `smart-search doctor --format json` after confirming `.trellis/` exists and before version/template/migration state, backups, or writes.
- Default update readiness failure exits through the CLI error path and reports `smart-search doctor --format json`, `smart-search setup`, and `trellis update --skip-readiness`.
- Added explicit `trellis update --skip-readiness`; it bypasses doctor and warns that framework readiness was not verified.
- Added update integration coverage for default doctor invocation, failure before backup/writes, and skip-readiness bypass.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/commands/init.integration.test.ts test/commands/update.integration.test.ts` | PASS | 2 files, 75 tests passed. Covers init readiness plus update readiness default/failure/skip paths. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |
| `rg -n "[ \t]+$" packages\cli\src\utils\readiness.ts packages\cli\src\commands\init.ts packages\cli\src\commands\update.ts packages\cli\src\cli\index.ts packages\cli\test\commands\update.integration.test.ts .trellis\spec\cli\backend\commands-update.md .trellis\tasks\06-08-personal-skills-trellis-refactor\implement.md .trellis\tasks\06-08-personal-skills-trellis-refactor\verify.md` | PASS | No output; `rg` returned 1 because there were no matches. |

Not run in this slice:

- Real `smart-search doctor --format json`; integration tests mock `execSync` to avoid requiring provider credentials or network.
- Interactive `smart-search setup` guidance for missing provider configuration.
- Selected project capability readiness for fast-context, CodeGraph, Graphify, GitHub MCP, or Playwright MCP.
- Full `pnpm test`.
- Built CLI temp-repo smoke test.

Current conclusion:

`trellis update` now shares the same required Smart Search readiness posture as `trellis init`, while preserving an explicit repair/debug bypass that does not claim readiness. The broader parent task remains open for interactive setup guidance, selected capability diagnostics/config output, deeper Parent/Child integration semantics, optional full-suite validation, and built CLI smoke validation.

## 2026-06-10 Project Capability Config Output Slice

Scope verified:

- Added `packages/cli/src/utils/project-capabilities.ts` as the selectable capability registry for `fast-context-mcp`, `codegraph` / `colbymchenry/codegraph`, Graphify, GitHub MCP, and Playwright MCP.
- Added repeatable `trellis init --capability <id>` support, including comma-separated values, aliases, `all`, and `none`.
- Default init still enables no optional project capabilities and writes no `.trellis/capabilities.*`, `.mcp.json`, or `.cursor/mcp.json`.
- Explicit capability selection writes `.trellis/capabilities.json`, `.trellis/capabilities.md`, Codex `.codex/config.toml` MCP server blocks, Claude Code `.mcp.json`, and Cursor `.cursor/mcp.json`.
- Capability output records routing and no-capability-hallucination rules, keeps credentials out of templates, and does not mutate global MCP/client config.
- `trellis update` reconstructs selected capability templates from `.trellis/capabilities.json` so same-version update stays idempotent.
- Added `.trellis/spec/cli/backend/project-capabilities.md` to document the capability registry, generated files, safety rules, and readiness boundary.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/utils/project-capabilities.test.ts test/commands/init.integration.test.ts test/commands/update.integration.test.ts` | PASS | 3 files, 82 tests passed. Covers parsing/rendering, default no optional capabilities, explicit config output, hash tracking, and update no-op stability. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |

Validation note:

- One parallel run of the test group overlapped with `pnpm typecheck` while core `dist/` was being cleaned/rebuilt, causing transient imports of `@mindfoldhq/trellis-core/task` to fail in init/update suites. The same test group passed when rerun serially after typecheck completed.

Not run in this slice:

- Real selected-capability readiness checks for fast-context, CodeGraph, Graphify, GitHub MCP, or Playwright MCP.
- CodeGraph install/index/query smoke.
- Graphify artifact/MCP smoke.
- Global/full `pnpm test`.
- Built CLI temp-repo smoke test.

Current conclusion:

Selected project capability intent and project-level config output are now represented and update-tracked without enabling optional capabilities by default or silently touching global MCP/client config. Runtime readiness, fallback reporting, and graph/browser/GitHub smoke contracts remain separate follow-up slices.

## 2026-06-10 Selected Capability Readiness / Fallback v1 Slice

Scope verified:

- Added fallback guidance to the project capability registry and generated `.trellis/capabilities.json` / `.trellis/capabilities.md`.
- Added selected-capability-only readiness probes reused by `trellis init` and `trellis update`.
- Readiness probes use lightweight PATH/artifact/credential-posture checks and do not start MCP servers, browsers, graph builds, index refreshes, or GitHub remote actions.
- Hard failures block init before `.trellis/` creation and block update before backups/template writes.
- Warnings report host-level smoke gaps for fast-context, CodeGraph freshness, Graphify artifacts, and Playwright runtime without claiming the capability was used.
- `--skip-readiness` bypasses Smart Search plus selected capability readiness and reports not-ready/unverified posture.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/utils/project-capabilities.test.ts test/commands/init.integration.test.ts test/commands/update.integration.test.ts` | PASS | 3 files, 86 tests passed. Covers fallback rendering, selected capability command probes, init/update hard failures before writes, skip-readiness bypass, and update idempotency for selected capability templates. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |
| `rg -n "[ \t]+$" ...selected-capability-readiness-slice-paths...` | PASS | No trailing whitespace matches; `rg` returned 1 because there were no matches. |

Not run in this slice:

- Real MCP host-level tool visibility / smoke search checks; v1 warns where the CLI cannot safely prove host runtime from this process.
- CodeGraph real install/index/query smoke.
- Graphify graph build/update or MCP startup.
- Real GitHub MCP credential/toolset smoke.
- Real Playwright MCP/browser startup.
- Full `pnpm test`.
- Built CLI temp-repo smoke test.

Current conclusion:

Selected capability readiness now has a conservative v1 gate: selected hard blockers fail before init/update writes, fallback guidance is generated and reported, skipped readiness is never marked ready, and runtime-heavy verification remains an explicit follow-up rather than an implicit side effect.

## 2026-06-10 Parent/Child Integration Guards v1 Slice

Scope verified:

- Split Child-reported state updates from Parent-controlled integration decisions.
- `task.py set-child-state` now records only Child/Worker states: `open`, `working`, `blocked`, `review`.
- Added `task.py integrate-child` for Parent-controlled states: `changes`, `accepted`, `integrating`, `integrated`, `cancelled`.
- Added non-mutating `integrate-child --check`.
- `integrate-child` requires Child `verify.md`, Child `handoff.md`, and `--ref` before `accepted`, `integrating`, or `integrated`.
- `integrate-child` enforces ordered transitions: `review -> accepted -> integrating -> integrated`.
- Default `merge_limit: 1` now blocks a second concurrently `integrating` Child.
- Parent task-map `integration_queue`, Child `ref`, evidence, reason, and Event Log entries are updated through the guarded Parent command.
- Added `.trellis/spec/cli/backend/parent-child-task-map.md` for the new command/state contract.
- Updated the workflow template's Parent/Child guidance and task command quick reference for `integrate-child`.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `python -m compileall -q packages/cli/src/templates/trellis/scripts` | PASS | Python task template scripts compile. Generated `__pycache__` directories were verified under `packages/cli/src/templates/trellis/scripts` and removed. |
| `pnpm --filter @mindfoldhq/trellis test test/regression.test.ts` | PASS | 1 file, 331 tests passed. Covers Child state boundary, Parent `integrate-child` sequence, non-mutating check, `merge_limit: 1`, workflow parser invariants, and Parent/Child archive guards. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |
| `rg -n "[ \t]+$" ...parent-child-integration-slice-paths...` | PASS | No trailing whitespace matches; `rg` returned 1 because there were no matches. |

Not run in this slice:

- Full `pnpm test`.
- Built CLI temp-repo smoke test.
- Automatic Git worktree creation, checkout, merge execution, or semantic conflict detection.

Current conclusion:

Parent/Child v1 now has a guarded Parent integration state machine with ref/evidence requirements and merge-limit enforcement. It records integration decisions instead of performing Git merges automatically; real worktree/merge automation remains a follow-up.

## 2026-06-10 Archive / Learning Hardening Slice

Scope verified:

- `task.py archive <task>` now rejects `verify.md` that lacks validation evidence.
- `task.py archive <task>` now rejects `verify.md` that lacks final acceptance evidence.
- `task.py archive <task>` now rejects `verify.md` that lacks a durable-learning decision, including explicit `No durable learning` when no spec/retrospective update is needed.
- Parent tasks with structural children now require final integration evidence in Parent `verify.md` before archive, in addition to terminal Child states in `task-map.md`.
- Full Task completion archive tests now cover unresolved required `FAIL` gates and stale `full-task-complete` artifact fingerprints.
- `record-gate` PASS is asserted not to mark the task completed or create an archive directory; real `task.py archive <task>` remains the only completion writer.
- Generated workflow text now treats spec updates and `retrospective.md` as conditional learning artifacts instead of mandatory ceremony.
- Added `.trellis/spec/cli/backend/archive-learning-guards.md` and linked it from the backend spec index.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `python -m compileall -q packages/cli/src/templates/trellis/scripts` | PASS | Python task template scripts compile. Generated `__pycache__` directories were verified under `packages/cli/src/templates/trellis/scripts` and removed. |
| `pnpm --filter @mindfoldhq/trellis test test/regression.test.ts` | PASS | Final rerun passed: 1 file, 337 tests. Covers archive evidence guards, stale completion fingerprints, required `FAIL` gates, Parent final integration evidence, and existing archive/session behavior. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |
| `rg -n "[ \t]+$" ...archive-learning-slice-paths...` | PASS | No trailing whitespace matches; `rg` returned 1 because there were no matches. |
| `Get-ChildItem ... -Filter __pycache__` | PASS | No source-template `__pycache__` directories remained after compileall cleanup. |

Validation note:

- The first `test/regression.test.ts` run failed in four old archive-success fixtures because they wrote `Acceptance: PASS` without the new durable-learning decision evidence. The fixtures were updated to include `No durable learning: recorded.`, then the full regression file passed.

Not run in this slice:

- Full `pnpm test`.
- Built CLI temp-repo smoke test.

Current conclusion:

Archive / Learning now has content-level evidence guards for acceptance, learning decisions, and Parent final integration evidence, while preserving non-mutating `archive --check` and real archive as the only completion writer.

## 2026-06-10 Workflow Ladder / Return-to-Planning Slice

Scope verified:

- Compared project-local `.trellis/workflow.md` with the source template before editing; this slice updates the generated source template, not the local runtime workflow copy.
- Added task ladder routing for No Task, Micro-Grill, Lite Task, Full Task, and Parent Task / Child Tasks.
- Made ladder classification risk-and-persistence based instead of effort-size based.
- Defaulted Trellis framework semantics, task model, platform adapters, MCP/capability setup, runtime integration, retrieval/graph tooling, Parent/Child orchestration, and quality-gate work to Full Task or higher.
- Added upgrade/downgrade rules and explicit confirmation requirements when rigor, artifacts, gates, capability assumptions, verification profile, or approval requirements change.
- Added repo-first routing for `Selected task: none` and strong selected-task conflict rules.
- Removed stale workflow text that said `task.py create` auto-targeted the task or that legacy `task.py start` advanced execution; the template now keeps create/select separate from execution approval.
- Strengthened the execution gate: Planning stops at `start-execution --check`, generic conversational confirmation is not execution approval, and approval prompts must report task plus contract/fingerprint context before `--approved`.
- Added Execution boundary and Return-to-Planning rules for scope, design, strategy contract, gate, capability/runtime, Parent `contract_epoch`, Child boundary, selected-task fit, and non-implementation reviewer-gate changes.
- Reworked Verification / Review as evidence and judgment rather than a hidden implementation loop; implementation defects route to Execution, while contract/scope defects route to Planning.
- Defined Integration as Parent/Child-only; ordinary Lite/Full tasks skip Integration, Children provide evidence only, and Parent integration authority records Git refs, `merge_limit: 1`, conflicts, and decisions in `task-map.md` Event Log.

Validation commands so far:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/regression.test.ts` | PASS | 1 file, 344 tests. Added static workflow assertions for task ladder/routing, create/select separation, execution approval, Return-to-Planning, Verification / Review, and Integration boundaries. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |
| `rg -n "[ \t]+$" ...workflow-ladder-slice-paths...` | PASS | No trailing whitespace matches; `rg` returned 1 because there were no matches. |

Not run in this slice:

- Full `pnpm test`.
- Built CLI temp-repo smoke test.

Current conclusion:

Workflow/task ladder and Return-to-Planning semantics are now represented in the generated workflow template and covered by static regression tests. The deeper runtime matrix for stale approval/fingerprint rejection and expanded `record-gate` invalid-input cases remains a follow-up slice.

## 2026-06-10 Quality Gate / Fingerprint Runtime v2 Slice

Scope verified:

- Added stale execution approval rejection in `common/task_gates.py`: an existing `task.json.execution_approval` with mismatched transition, contract fingerprint, or artifact fingerprint now blocks `start-execution --approved` instead of being silently refreshed.
- Added `.trellis/spec/cli/backend/quality-gate-fingerprints.md` and linked it from the backend spec index.
- Added regression coverage for missing/invalid `quality_gates`, including baseline-check disable attempts.
- Added regression coverage for `architecture-deep-review` requiring `architecture-review`.
- Added expanded `record-gate` invalid-input coverage: unknown transition, unknown gate, invalid result, missing reviewer, missing evidence, payload-like evidence, invalid `SKIPPED` approval metadata, and stale caller-provided fingerprints.
- Added transition-scoping coverage so `architecture-review` records under `start-execution`, `full-task-complete`, and `child-review` do not overwrite each other.
- Added fingerprint coverage:
  - stale `PASS` gate records fail after contract changes;
  - `contract_fingerprint` changes when strategy contract or `quality_gates` config changes;
  - `contract_fingerprint` ignores generated runtime fields such as `quality_gate_results`, `execution_approval`, timestamps, and runtime paths;
  - pre-execution `artifact_fingerprint` ignores `verify.md`.
- Added repeated `FAIL` coverage: same transition/gate/issue increments `consecutive_failures` and warns after more than three loops.

Validation commands so far:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/regression.test.ts` | PASS | 1 file, 353 tests. Covers stale execution approval, quality gate config, record-gate invalid inputs, transition-scoped records, fingerprint behavior, and repeated FAIL escalation warning. |
| `python -c "... compile(...)"` over `packages/cli/src/templates/trellis/scripts/**/*.py` | PASS | No-bytecode Python syntax check; avoided generating `__pycache__`. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |
| `rg -n "[ \t]+$" ...quality-gate-fingerprint-slice-paths...` | PASS | No trailing whitespace matches; `rg` returned 1 because there were no matches. |
| `Get-ChildItem ... -Filter __pycache__` | PASS | No source-template `__pycache__` directories were present. |

Remaining follow-ups:

- Root-cause field/routing for gate `FAIL` moved to the next slice and is now covered below.
- Parent `contract_epoch` in Child/Parent integration fingerprints remains pending.
- Reviewed change-set identity / diff evidence in post-implementation fingerprints remains pending.

## 2026-06-10 Quality Gate FAIL Root-Cause Routing Slice

Scope verified:

- `task.py record-gate ... --result FAIL` now requires `--root-cause`.
- Supported root causes route gate failures as:
  - `implementation-defect` -> `Execution`
  - `contract-changing-defect` -> `Planning`
  - `validation-environment-blocker` -> `Verification / Review`
- FAIL gate records now store `root_cause` and `route` in `task.json.quality_gate_results`.
- PASS and SKIPPED records reject root-cause metadata.
- Repeated same transition/gate/issue loops now store `required_user_choice` after more than three failures, with options for `re-plan`, `continue-fixing`, and `user-approved-skip-if-allowed`.
- CLI output prints `Route: ...` for FAIL records and warns that the agent must ask the user to choose before continuing when repeated-loop escalation triggers.
- Updated `.trellis/spec/cli/backend/quality-gate-fingerprints.md` with root-cause routing and repeated-loop decision requirements.

Validation commands so far:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/regression.test.ts` | PASS | 1 file, 354 tests. Covers FAIL root-cause routing, required `--root-cause`, invalid root-cause metadata, stored route, and repeated-loop user-choice metadata. |
| `python -c "... compile(...)"` over `packages/cli/src/templates/trellis/scripts/**/*.py` | PASS | No-bytecode Python syntax check; avoided generating `__pycache__`. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |
| `rg -n "[ \t]+$" ...quality-gate-root-cause-slice-paths...` | PASS | No trailing whitespace matches; `rg` returned 1 because there were no matches. |
| `Get-ChildItem ... -Filter __pycache__` | PASS | No source-template `__pycache__` directories were present. |

Not run in this slice:

- Full `pnpm test`.
- Built CLI temp-repo smoke test.

Current conclusion:

Reviewer gate `FAIL` records now carry a machine-checkable root-cause route and repeated-loop user-choice metadata. The remaining fingerprint follow-ups are Parent `contract_epoch` in Child/Parent integration fingerprints and reviewed diff/change-set identity for post-implementation fingerprints.

## 2026-06-10 Parent Contract Epoch Fingerprint Slice

Scope verified:

- `artifact_fingerprint` payloads now include Parent contract metadata for `child-review` and all Parent-controlled `parent-*` transitions.
- Child `child-review` fingerprints read the linked Parent `task-map.md` `contract_epoch` through the Child `task.json.parent` relationship.
- Parent integration transition fingerprints read the Parent task's own `task-map.md` `contract_epoch`.
- Updated quality gate and Parent/Child task-map specs to document `contract_epoch` as a freshness marker for Child review and Parent integration gates.
- Added regression coverage proving Child and Parent integration artifact fingerprints change when Parent `contract_epoch` changes.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/regression.test.ts` | PASS | 1 file, 355 tests. Added coverage for Child `child-review` and Parent `parent-integrating` artifact fingerprint changes after Parent `task-map.md` `contract_epoch` changes. |
| `python -c "... compile(...)"` over `packages/cli/src/templates/trellis/scripts/**/*.py` | PASS | No-bytecode Python syntax check; avoided generating `__pycache__`. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |
| `rg -n "[ \t]+$" ...parent-contract-epoch-slice-paths...` | PASS | No trailing whitespace matches; `rg` returned 1 because there were no matches. |
| `Get-ChildItem ... -Filter __pycache__` | PASS | No source-template `__pycache__` directories were present. |

Remaining follow-ups:

- Reviewed change-set identity / diff evidence in post-implementation fingerprints is covered in the following slice.
- Full `pnpm test` and built CLI temp-repo smoke remain broader validation follow-ups.

## 2026-06-10 Reviewed Change-Set Fingerprint Slice

Scope verified:

- `artifact_fingerprint` payloads now include reviewed change-set metadata for post-implementation transitions.
- `full-task-complete` extracts compact reviewed change-set evidence from `verify.md`.
- `child-review` extracts compact reviewed change-set evidence from `verify.md` and `handoff.md`.
- Parent-controlled `parent-*` transitions extract compact reviewed change-set evidence from `task-map.md` and `verify.md`.
- Added regression coverage proving a Parent post-implementation integration fingerprint changes when a reviewed change-set evidence line is added to Parent `task-map.md`.
- Updated quality gate and Parent/Child task-map specs with the supported compact evidence line conventions.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/regression.test.ts` | PASS | 1 file, 356 tests. Added coverage for post-implementation artifact fingerprint changes after reviewed change-set evidence changes. |
| `python -c "... compile(...)"` over `packages/cli/src/templates/trellis/scripts/**/*.py` | PASS | No-bytecode Python syntax check; avoided generating `__pycache__`. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |
| `rg -n "[ \t]+$" ...reviewed-change-set-fingerprint-slice-paths...` | PASS | No trailing whitespace matches; `rg` returned 1 because there were no matches. |
| `Get-ChildItem ... -Filter __pycache__` | PASS | No source-template `__pycache__` directories were present. |

Remaining follow-ups:

- The broad post-approval invalidation matrix remains partially open for reviewed execution scope beyond these fingerprint inputs.
- Full `pnpm test` and built CLI temp-repo smoke remain broader validation follow-ups.

## 2026-06-10 Bundled Skill Docs Cleanup Slice

Scope verified:

- Updated `trellis-meta` platform reference docs so built-in skills are no longer described as a closed `trellis-*` set.
- Documented multi-file bundled skill directories and the current bundled set: `trellis-meta`, `smart-search-cli`, and `trellis-micro-grill`.
- Documented Smart Search as CLI-backed and exposed through the Trellis `smart-search` runtime wrapper.
- Documented Micro-Grill as the Trellis clarification adapter.
- Documented `selected_task` command semantics and the replacement chain for legacy `task.py start`, `task.py current`, and `task.py finish`.
- Added regression coverage for the `trellis-meta` `skills-and-commands.md` reference.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/regression.test.ts` | PASS | 1 file, 357 tests. Added coverage that `trellis-meta` documents bundled skills and selected-task command semantics. |
| `python -c "... compile(...)"` over `packages/cli/src/templates/trellis/scripts/**/*.py` | PASS | No-bytecode Python syntax check; avoided generating `__pycache__`. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |
| `rg -n "[ \t]+$" ...bundled-skill-docs-cleanup-slice-paths...` | PASS | No trailing whitespace matches; `rg` returned 1 because there were no matches. |
| `Get-ChildItem ... -Filter __pycache__` | PASS | No source-template `__pycache__` directories were present. |

Remaining follow-ups:

- Full `pnpm test` and built CLI temp-repo smoke remain broader validation follow-ups.

## 2026-06-10 Retrieval Graph Capability Freshness Slice

Scope verified:

- CodeGraph remains a selectable project capability and now treats common index markers as freshness hints, not proof that graph-derived impact claims are current.
- CodeGraph readiness warns when no common index marker is present, routing agents to initialize/refresh the index or fall back to source/Git/test evidence.
- Graphify remains a selectable artifact-first architecture/wiki/mixed-corpus capability.
- Graphify readiness allows artifact-only fallback when the runtime command is missing but known artifacts exist, while warning that artifacts are orientation evidence only and cannot prove current-code behavior.
- Generated `.trellis/capabilities.md` and the backend project-capabilities spec now document the CodeGraph/Graphify freshness boundary.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/utils/project-capabilities.test.ts test/commands/init.integration.test.ts` | PASS | 2 files, 50 tests. Covers graph capability freshness docs, CodeGraph missing-index warning, and Graphify artifact-only fallback warning. |
| `pnpm --filter @mindfoldhq/trellis test test/commands/update.integration.test.ts` | PASS | 1 file, 39 tests. Confirms update's shared readiness/template path still passes. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |
| `rg -n "[ \t]+$" ...retrieval-graph-capability-slice-paths...` | PASS | No trailing whitespace matches; `rg` returned 1 because there were no matches. |

Not run in this slice:

- Real `colbymchenry/codegraph` install/index/query smoke.
- Graphify graph build/update or MCP startup.
- Full `pnpm test`.
- Built CLI temp-repo smoke test.

Current conclusion:

Retrieval graph capabilities now have a conservative selectable-layer contract: CodeGraph and Graphify can be configured and readiness-checked without side effects, but stale or unproven graph/index/artifact evidence routes to repair, fallback, or explicit user-approved runtime work instead of being treated as current-code proof.

## 2026-06-10 Built CLI Temp-Repo Smoke Slice

Scope verified:

- Created a fresh temp project under `C:\Users\blaze\AppData\Local\Temp\trellis-built-cli-smoke-ae1b67d2dbab406a9df5517cd4426356`.
- Ran the built CLI entrypoint from `packages/cli/dist/cli/index.js`.
- Initialized Codex, Claude Code, and Cursor target platforms with `--skip-readiness` to validate template generation without claiming Smart Search or optional capability readiness.
- Confirmed generated bundled skill files:
  - `.agents/skills/smart-search-cli/SKILL.md`
  - `.agents/skills/smart-search-cli/references/cli-contract.md`
  - `.agents/skills/trellis-micro-grill/SKILL.md`
  - `.claude/skills/smart-search-cli/SKILL.md`
  - `.cursor/skills/trellis-micro-grill/SKILL.md`
- Confirmed `.trellis/.template-hashes.json` tracks those generated files.
- Ran built CLI `update --dry-run --skip-readiness` and verified it did not change the temp project file set or file contents.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| PowerShell built CLI smoke script using `node packages/cli/dist/cli/index.js init --codex --claude --cursor --yes --skip-readiness` then `node packages/cli/dist/cli/index.js update --dry-run --skip-readiness` | PASS | Re-run after final build. Required bundled skill files existed, required hashes existed, dry-run changed no files, and update output included `Already up to date!`. |

Not run in this slice:

- Real Smart Search readiness; smoke intentionally used `--skip-readiness`.
- Real selected capability readiness or MCP host smoke.
- Full `pnpm test`.

Current conclusion:

The built CLI can generate first-class Codex / Claude Code / Cursor project templates with the bundled skills and hash tracking expected by this task, and an immediate built CLI dry-run update is stable when the generated project is current.

## 2026-06-10 Full Suite / Windows Compatibility Slice

Scope verified:

- Ran full `pnpm test`; first pass exposed CLI-suite failures unrelated to the retrieval graph slice:
  - stale `Active task` assertions after the selected-task model;
  - marketplace workflow fixture assumptions when `marketplace/workflows/**` is absent in this checkout;
  - CRLF-sensitive Cursor frontmatter and Git-backed template fetcher assertions on Windows;
  - upgrade command tests assuming POSIX command shape on Windows;
  - `tl mem` helper test assuming POSIX absolute path resolution.
- Updated tests to match the current selected-task contract and normalize CRLF where content semantics, not line endings, are under test.
- Added `class-2` selected-task dispatch guidance inside the generated `workflow-state:in_progress` block so the injected breadcrumb itself carries the Codex/Copilot/Gemini/Qoder dispatch context.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/templates/trellis.test.ts test/templates/cursor.test.ts test/commands/upgrade.test.ts test/commands/mem-helpers.test.ts test/utils/template-fetcher.test.ts` | PASS | 5 files, 105 tests passed, 1 skipped. Confirms the full-suite failure cluster is fixed. |
| `pnpm test` | PASS | Core: 17 files, 279 tests passed. CLI: 45 files passed, 1 skipped; 1250 tests passed, 4 skipped. |
| `pnpm typecheck` | PASS | Rebuilt `@mindfoldhq/trellis-core`, then ran CLI `tsc --noEmit`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and template copy completed after the workflow template change. |

Current conclusion:

The local full test suite now passes on Windows after aligning stale tests with the selected-task workflow contract and making line-ending-sensitive fixtures compare normalized content where appropriate.

## 2026-06-10 Template Legacy Command Cleanup / Archive Boundary Backfill Slice

Scope verified:

- Updated optional-platform generated templates so OpenCode, Kiro, CodeBuddy, Droid, Gemini, Qoder, Pi, and Copilot no longer instruct agents to use removed `task.py current`, `task.py start`, `task.py finish`, `Active task:`, or `Current task:` guidance.
- Updated OpenCode prompt-hint parsing from `Active task:` to `Selected task:` while keeping exact-session `selected_task` resolution first.
- Added a source-template regression scan that allows only explicit negative documentation to mention removed commands.
- Added static regression coverage that no standalone `check-gates` command is generated and protected `--check` paths reuse the same guard functions as real transitions.
- Expanded stale approval regression coverage so post-approval changes to `prd.md`, `design.md`, and `implement.md` reject reused execution approval.
- Added Archive / Learning readiness matrix to generated `workflow.md` for No Task, Micro-Grill, Lite, Full, Child, and Parent modes.
- Added generated workflow guidance that Archive / Learning is terminal and archived task artifacts must not be silently mutated after completion.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `rg -n -C 1 "task\\.py current|task\\.py start(?!-execution)|task\\.py finish\\b|Active task:|Current task:" packages\\cli\\src\\templates --pcre2 -g '!packages/cli/src/migrations/**'` | PASS | Remaining matches are only negative docs: generated `workflow.md` says `task.py finish` no longer exists, and `trellis-meta` says not to reintroduce removed commands. |
| `rg -n "trellis personal|--profile" packages\\cli\\src packages\\cli\\test .trellis\\tasks\\06-08-personal-skills-trellis-refactor --pcre2` | PASS | No source or test product-surface hits; hits are task requirement/design text only. |
| `pnpm --filter @mindfoldhq/trellis test test/templates/opencode.test.ts test/templates/pi.test.ts test/regression.test.ts` | PASS | 3 files, 408 tests passed after the selected-task prompt cleanup. |
| `pnpm --filter @mindfoldhq/trellis test test/regression.test.ts` | FAIL, then fixed | Expanded stale-approval tests initially failed because the Full Task setup missed the required `start-execution/requirements-review` PASS gate before approval. The test setup was corrected to follow the real gate flow. |
| `pnpm --filter @mindfoldhq/trellis test test/regression.test.ts` | PASS | Final rerun after archive-boundary additions: 1 file, 362 tests passed. |

Current conclusion:

Generated templates now consistently use selected-task wording and the replacement command chain across first-class and retained optional platform surfaces. Archive / Learning terminal behavior and mode-specific archive readiness are represented in the generated workflow template and covered by regression tests.

## 2026-06-10 Final Closeout Revalidation / Review

Scope verified:

- Rebuilt the CLI after the latest template and workflow cleanup.
- Revalidated the active task context files.
- Re-ran whitespace diff checks.
- Re-ran the built CLI temp-repo smoke after the latest build.
- Re-reviewed Smart Search copied skill files against the local source snapshot.
- Reviewed the changed test surface against the expanded workstream scope.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and `copy-templates` completed; latest templates copied to `packages/cli/dist/templates/`. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |
| Built CLI smoke with `node packages/cli/dist/cli/index.js init --codex --claude --cursor --yes --skip-readiness` followed by `update --dry-run --skip-readiness` | PASS | Temp root: `C:\Users\blaze\AppData\Local\Temp\trellis-built-cli-smoke-2d6c5976760348e2915a7810dd1ff5c7`. Required bundled skill files and `.trellis/.template-hashes.json` existed; dry-run update did not change the temp project file snapshot. |
| `git diff --no-index -- D:\MyHarness\smartsearch-private\skills\smart-search-cli D:\MyHarness\Trellis-v0.6.0-beta.22\packages\cli\src\templates\common\bundled-skills\smart-search-cli` | PASS | No content diff; Git printed line-ending warnings only. |
| Workstream diff review with `git diff --stat -- ...` over spec/task artifacts, template/runtime paths, CLI/config/readiness paths, test/core paths, plus `git ls-files --others --exclude-standard` | PASS | Tracked and untracked changes map to the planned workstreams: task/spec evidence, workflow/task runtime scripts, bundled skills, Smart Search vendor/runtime wrapper, platform templates, capability readiness, core mem compatibility, and regression/runtime tests. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --stat -- packages/cli/test` | PASS | Test changes are concentrated in configurator/init/update/runtime/template/regression coverage for bundled skills, selected-task routing, gate/archive behavior, Parent/Child, project capabilities, Smart Search vendor, and Windows compatibility. |
| `rg -n "smart-search-cli|trellis-micro-grill|selected_task|start-execution|record-gate|task-map|archive --check|quality_gate_results|project capabilities|Graphify|CodeGraph" packages\cli\test --pcre2` | PASS | Confirmed the changed test surface maps to the expanded task workstreams rather than unrelated product behavior. |

Current conclusion:

The latest cleanup slice is revalidated at build, task-context, whitespace, built-CLI smoke, Smart Search snapshot, and test-surface review levels. The remaining unchecked items in `implement.md` are intentional deferred follow-ups or future feature slices, not unvalidated work from the completed slices.

## 2026-06-10 Parent/Child Git Worktree / Merge Execution Slice

Scope verified:

- Added explicit Parent command surface for `task.py prepare-child-worktree <parent> <child> --branch <child-branch>`.
- Parent `task-map.md` Child entries now record Git worktree metadata: `branch`, `worktree_path`, `base_ref`, and `merged_ref`.
- `prepare-child-worktree` validates that the project is a Git repository, the requested branch name is safe, and the default worktree target stays under `.trellis/worktrees/<child>`.
- Generated `.trellis/.gitignore` now ignores `worktrees/`.
- `task.py integrate-child ... integrated --execute-merge` performs an explicit `git merge --no-ff --no-commit <ref>` before recording `integrated`.
- `integrate-child --execute-merge --check` validates merge execution readiness without mutating state.
- Default `integrate-child` remains record-only unless `--execute-merge` is explicitly provided.
- Workflow and backend spec text now document explicit worktree preparation and explicit no-commit merge execution.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/regression.test.ts test/templates/trellis.test.ts` | PASS | 2 files, 383 tests passed. Covers worktree creation/recording, no-commit merge execution, non-mutating merge check, workflow integration wording, and generated `.trellis/.gitignore` `worktrees/` entry. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and `copy-templates` completed after the Parent/Child Git template changes. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |

Not run in this slice:

- Standalone `pnpm typecheck`; the CLI build ran `tsc`.
- Full `pnpm test`; the previous full-suite pass is recorded above, and this slice reran the targeted Parent/Child/template tests.
- Real multi-repo semantic conflict handling beyond Git's `--no-commit` merge behavior.

Current conclusion:

Parent/Child integration now has explicit Git worktree preparation and opt-in no-commit merge execution. The remaining unchecked work in `implement.md` is limited to interactive setup guidance, host-level MCP smoke checks, real CodeGraph install/index/query smoke, and explicitly deferred richer automation/adapters.

## 2026-06-10 Interactive Smart Search Setup Guidance Slice

Scope verified:

- Added an interactive init readiness helper that preserves the existing non-interactive failure behavior.
- When `smart-search doctor --format json` fails during interactive `trellis init`, the CLI now reports the readiness failure and asks whether to run `smart-search setup`.
- If the user chooses setup, Trellis runs `smart-search setup` with inherited stdio, then re-runs `smart-search doctor --format json`.
- Init continues only after the post-setup readiness check passes.
- Non-interactive `trellis init -y` still fails before template writes and does not run `smart-search setup` implicitly.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/commands/init.integration.test.ts` | PASS | 1 file, 44 tests passed. Added coverage for interactive setup/recheck and strengthened non-interactive no-implicit-setup behavior. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and `copy-templates` completed after the init helper change. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |

Not run in this slice:

- Standalone `pnpm typecheck`; the CLI build ran `tsc`.
- Full `pnpm test`; the previous full-suite pass is recorded above, and this slice reran the targeted init integration suite.

Current conclusion:

Interactive Smart Search provider setup guidance is now implemented for `trellis init`, while non-interactive init remains conservative and non-mutating before readiness passes. Remaining unchecked work is host-level MCP smoke, interactive setup guidance for selected optional capabilities, real CodeGraph install/index/query smoke, and deferred richer adapters/automation.

## 2026-06-10 Interactive Selected Capability Setup Guidance Slice

Scope verified:

- Added an interactive init readiness helper for selected project capabilities.
- Non-interactive `trellis init -y --capability ...` still fails before project writes when selected capability readiness fails.
- Interactive init now prints the selected capability readiness failure and recovery guidance, then asks the user whether they have fixed setup/config and want to re-check.
- The CLI does not silently mutate global MCP/client config, credentials, or service state.
- Init continues only after the re-run selected-capability readiness check passes.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/commands/init.integration.test.ts` | PASS | 1 file, 45 tests passed. Added coverage for interactive selected capability re-check after user-approved setup/config. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and `copy-templates` completed after the init helper change. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |

Not run in this slice:

- Standalone `pnpm typecheck`; the CLI build ran `tsc`.
- Full `pnpm test`; the previous full-suite pass is recorded above, and this slice reran the targeted init integration suite.
- Real MCP host/server startup; ordinary init still avoids starting MCP servers, browser sessions, graph builds, watchers, remote GitHub actions, or credential-bearing setup.

Current conclusion:

Selected optional capabilities now have an interactive setup/re-check path during `trellis init` without weakening the safety boundary around global MCP/client config. Remaining unchecked work is host-level MCP smoke where safely possible, real CodeGraph install/index/query smoke, and deferred richer adapters/automation.

## 2026-06-10 Safe Host-Level MCP Visibility Smoke Slice

Scope verified:

- Added bounded host-level command visibility smoke for selected capabilities where the CLI can safely run a non-starting command.
- Safe smoke uses `<command> --help` with a timeout after PATH lookup succeeds.
- The smoke records positive readiness info when the command returns successfully.
- Failed safe smoke is a warning, not a hard readiness failure, because a server command may still be valid even when `--help` is unsupported.
- Capability paths that may download packages, start MCP servers, open browsers, build graphs, refresh indexes, or perform remote actions remain explicit user-approved work and are not run by ordinary init/update.
- Playwright's `npx -y @playwright/mcp@latest` path is intentionally not executed as a safe smoke because it may download/start runtime components.
- Updated the project-capabilities backend spec to document this safe-smoke boundary.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/commands/init.integration.test.ts test/commands/update.integration.test.ts test/utils/project-capabilities.test.ts` | PASS | 3 files, 91 tests passed. Added assertion that `fast-context-mcp --help` safe smoke runs and Playwright MCP is not implicitly started through `npx @playwright/mcp`. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and `copy-templates` completed after readiness changes. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |

Not run in this slice:

- Standalone `pnpm typecheck`; the CLI build ran `tsc`.
- Full `pnpm test`; the previous full-suite pass is recorded above, and this slice reran targeted readiness/init/update tests.
- MCP server startup, browser startup, graph indexing, remote GitHub calls, or Playwright package download/startup.

Current conclusion:

Selected capabilities now get the strongest host-level visibility smoke ordinary init/update can safely perform without starting unrelated services or touching global MCP/client config. Remaining unchecked work is real CodeGraph install/index/query smoke and explicitly deferred richer adapters/automation.

## 2026-06-10 CodeGraph Install / Index / Query Smoke Slice

Scope verified:

- Ran the real `@colbymchenry/codegraph` CLI through `npx -y @colbymchenry/codegraph`.
- Confirmed the CLI command surface includes `init`, `index`, `sync`, `status`, `query`, `files`, `serve`, `callers`, `callees`, `impact`, `affected`, `install`, and `uninstall`.
- Confirmed `codegraph init [path]` initializes `.codegraph/` and builds the initial index by default; `-i` is accepted only for backward compatibility.
- Confirmed `codegraph status --json [path]` returns machine-readable index status including `initialized`, `fileCount`, `nodeCount`, `edgeCount`, `backend`, `languages`, and `pendingChanges`.
- Confirmed `codegraph query <symbol> --path <path> --json` returns machine-readable symbol results with file path and line ranges.
- Confirmed `codegraph callers <symbol> --path <path> --json` returns callers from the indexed graph.
- Corrected the generated CodeGraph MCP server command from `codegraph mcp` to the verified `codegraph serve`.

Smoke project:

- Temp root: `C:\Users\blaze\AppData\Local\Temp\trellis-codegraph-smoke-8fbd77710cdf45478ba245c99ed2b550`.
- Files indexed:
  - `src/math.ts` with `addNumbers()` and `doubleNumber()`.
  - `test/math.test.ts` with `verifiesDoubleNumber()`.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `npx -y @colbymchenry/codegraph --help` | PASS | Confirmed top-level command surface and that MCP server startup is `serve`. |
| `npx -y @colbymchenry/codegraph init <temp-root>` | PASS | Initialized and indexed 2 files; output reported 6 nodes and 7 edges. |
| `npx -y @colbymchenry/codegraph status --json <temp-root>` | PASS | Returned `initialized: true`, `fileCount: 2`, `nodeCount: 6`, `edgeCount: 7`, `backend: node-sqlite`, `languages: ["typescript"]`, and no pending changes. |
| `npx -y @colbymchenry/codegraph query addNumbers --path <temp-root> --json` | PASS | Returned `addNumbers` from `src/math.ts`, lines 1-3, as an exported TypeScript function. |
| `npx -y @colbymchenry/codegraph callers addNumbers --path <temp-root> --json` | PASS | Returned `doubleNumber` in `src/math.ts` as a caller. |
| `pnpm --filter @mindfoldhq/trellis test test/utils/project-capabilities.test.ts test/commands/init.integration.test.ts test/commands/update.integration.test.ts` | PASS | 3 files, 92 tests passed. Added regression coverage that generated CodeGraph MCP config uses `args: ["serve"]`. |
| `rg -n 'codegraph mcp|args: \["mcp"\]|\["mcp"\]' packages/cli/src packages/cli/test .trellis/spec .trellis/tasks/06-08-personal-skills-trellis-refactor` | PASS | No matches. Confirms no generated source/test/spec residue for the incorrect `codegraph mcp` contract. |

Not run in this slice:

- `codegraph serve` MCP server startup.
- `codegraph install` or `codegraph uninstall`, because those mutate agent host configuration and require a separate explicit setup action.
- Larger impact/affected-test automation beyond the minimal query/callers smoke.

Current conclusion:

`colbymchenry/codegraph` has a verified npm/CLI contract for install-time availability through `npx`, project indexing through `init`, machine-readable readiness through `status --json`, and symbol queries through `query`/`callers`. Trellis's generated MCP config now uses the verified `codegraph serve` startup command.

## 2026-06-10 Smart Search Sync Automation / Bilingual No-Zhipu Slice

Scope verified:

- Updated canonical `smartsearch-private` behavior so default `search` / `research` web discovery no longer selects Zhipu by default.
- Added unconditional bilingual web discovery policy for normal `balanced` / `strict` Smart Search use: one Chinese-source query and one English-source query for the same user question.
- Kept `zhipu-search` as an explicit deprecated manual compatibility command with config flags and provider tests intact.
- Updated Smart Search README, Chinese README, CLI setup guidance, public skill assets, packaged skill assets, metadata, and tests to document Tavily / Firecrawl bilingual routing.
- Added Trellis `packages/cli/scripts/smart-search-vendor-utils.js` with shared collect/compare/sync logic.
- Reworked `check-smart-search-vendor.js` to reuse the shared helper.
- Added explicit `sync-smart-search-vendor.js` with `--source` / `SMARTSEARCH_PRIVATE_PATH` source selection and no hardcoded local path.
- Added `sync:smart-search` and `check:smart-search` package scripts.
- Added runtime tests for opt-in/source-driven sync, no hardcoded `D:\MyHarness`, runtime copy, bundled skill copy, exclusion preservation, stale-file removal, and post-sync drift detection.
- Ran the new sync script from `D:\MyHarness\smartsearch-private` into `packages/cli/vendor/smart-search` and `packages/cli/src/templates/common/bundled-skills/smart-search-cli`.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `.\.venv\Scripts\python.exe -m pytest tests/test_service.py tests/test_smoke.py tests/test_regression.py tests/test_cli.py -q` in `D:\MyHarness\smartsearch-private` | PASS | 151 tests passed after updating old Zhipu/default-routing expectations. |
| `.\.venv\Scripts\python.exe -m compileall -q src tests` in `D:\MyHarness\smartsearch-private` | PASS | Python syntax check passed. |
| `.\.venv\Scripts\python.exe -m pytest tests -q` in `D:\MyHarness\smartsearch-private` | PASS | Full Smart Search Python suite passed, 219 tests. |
| `npm test` in `D:\MyHarness\smartsearch-private` | PASS | npm wrapper flow reinstalled editable package, ran 219 pytest tests, displayed CLI help, and produced dry-run tarball output. |
| `pnpm --filter @mindfoldhq/trellis test test/runtime/smart-search-vendor.test.ts` | PASS | 6 runtime vendoring/sync tests passed before real sync. |
| `node packages/cli/scripts/sync-smart-search-vendor.js --source D:\MyHarness\smartsearch-private` | PASS | Synced 36 runtime files and 5 bundled skill files. |
| `node packages/cli/scripts/check-smart-search-vendor.js D:\MyHarness\smartsearch-private` | PASS | Vendored Smart Search runtime matches source. |
| `pnpm --filter @mindfoldhq/trellis sync:smart-search -- --dry-run --source D:\MyHarness\smartsearch-private` | PASS | Package script entrypoint works with pnpm's literal `--` separator; dry-run reported 36 runtime files and 5 bundled skill files. |
| `pnpm --filter @mindfoldhq/trellis check:smart-search -- D:\MyHarness\smartsearch-private` | PASS | Package script entrypoint works with pnpm's literal `--` separator and reports vendor/source match. |
| `pnpm --filter @mindfoldhq/trellis test test/runtime/smart-search-vendor.test.ts test/configurators/platforms.test.ts test/configurators/index.test.ts` | PASS | 3 files, 107 tests passed after real sync. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and `copy-templates` completed. |
| `pnpm --filter @mindfoldhq/trellis typecheck` | PASS | `tsc --noEmit` completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git diff --check` in `D:\MyHarness\smartsearch-private` | PASS | No whitespace errors; Git printed CRLF warnings only. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |

Not run in this slice:

- Full root `pnpm test`; this slice ran focused Trellis suites plus full Smart Search Python/npm validation.
- Built CLI temp-repo smoke after the new sync script; previous smoke evidence remains above, but this slice did not repeat a temp init/update smoke.
- Live Smart Search provider calls; tests used mocked provider behavior and did not spend Tavily/Firecrawl/Zhipu quota.

Current conclusion:

Smart Search's default source-discovery contract is now bilingual Tavily / Firecrawl with Zhipu removed from normal routing. Trellis has an opt-in sync command that copies both the vendored Smart Search runtime and bundled skill snapshot from an explicit source path or `SMARTSEARCH_PRIVATE_PATH`, with deterministic drift-check coverage and exclusion tests. Remaining unchecked work is limited to deferred richer Graphify query behavior, richer CodeGraph impact automation, and richer platform-specific reviewer adapters.

## 2026-06-10 Graphify MCP Query Guidance Slice

Scope verified:

- Added structured Graphify MCP query guidance to the project capability registry.
- Generated `.trellis/capabilities.json` now includes Graphify `mcp_query_guidance` entries for `query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`, `graph_stats`, and `shortest_path`.
- Generated `.trellis/capabilities.md` now includes selected-capability MCP query routing only when a selected capability has guidance.
- Preserved the artifact-first boundary: existing `graphify-out` artifacts orient work only, Graphify MCP startup still requires explicit approval, and graph-derived claims still require freshness plus source/Git/test confirmation.
- Updated the backend project-capabilities spec with the Graphify query tool mapping and safety boundary.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/utils/project-capabilities.test.ts` | PASS | 10 tests passed. Covers structured Graphify `mcp_query_guidance` and Markdown query routing. |
| `pnpm --filter @mindfoldhq/trellis test test/utils/project-capabilities.test.ts test/commands/init.integration.test.ts test/commands/update.integration.test.ts` | PASS | 3 files, 94 tests passed. Covers generated init/update capability templates and Graphify artifact-only fallback with query guidance. |
| `pnpm --filter @mindfoldhq/trellis typecheck` | PASS | `tsc --noEmit` completed. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and `copy-templates` completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check` | PASS | No whitespace errors; Git printed CRLF warnings only. |

Not run in this slice:

- Graphify MCP server startup.
- Graphify graph build/update/watch/hook workflows.
- Full root `pnpm test`.
- Built CLI temp-repo smoke after this Graphify guidance-only change.

Current conclusion:

Graphify now has richer selected-capability query routing without changing the runtime safety model. Agents can see which MCP tools answer concept, node, neighbor, community, hotspot, graph health, and shortest-path questions, but ordinary init/update still do not start Graphify or build/update graph artifacts.

## 2026-06-10 CodeGraph Impact Automation Guidance Slice

Scope verified:

- Added structured CodeGraph CLI automation guidance to the project capability registry.
- Generated `.trellis/capabilities.json` now includes CodeGraph `cli_automation_guidance` entries for `status`, `query`, `callers`, `callees`, `impact`, and `affected`.
- Generated `.trellis/capabilities.md` now includes selected-capability CLI automation routing for CodeGraph impact preflight and affected-test scoping.
- Preserved the freshness boundary: CodeGraph output is advisory until index freshness is confirmed, and current source/Git/test evidence remains the proof layer.
- Updated the backend project-capabilities spec with CodeGraph command routing and the no implicit index init/refresh boundary.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `npx -y @colbymchenry/codegraph affected --help` | PASS | Confirmed `affected [files...] --path <path> --json` shape and stdin/filter/depth options. |
| `npx -y @colbymchenry/codegraph impact --help` | PASS | Confirmed `impact <symbol> --path <path> --depth <number> --json` shape. |
| `npx -y @colbymchenry/codegraph callees --help` | PASS | Confirmed `callees <symbol> --path <path> --json` shape. |
| `npx -y @colbymchenry/codegraph callers --help` | PASS | Confirmed `callers <symbol> --path <path> --json` shape. |
| `npx -y @colbymchenry/codegraph query --help` | PASS | Confirmed `query <search> --path <path> --limit <number> --kind <kind> --json` shape. |
| `npx -y @colbymchenry/codegraph status --help` | PASS | Confirmed `status --json [path]` shape. |
| `pnpm --filter @mindfoldhq/trellis test test/utils/project-capabilities.test.ts` | PASS | 12 tests passed. Covers structured CodeGraph `cli_automation_guidance`, Graphify `mcp_query_guidance`, and Markdown routing. |
| `pnpm --filter @mindfoldhq/trellis test test/utils/project-capabilities.test.ts test/commands/init.integration.test.ts test/commands/update.integration.test.ts` | PASS | 3 files, 96 tests passed. Covers generated init/update capability templates with CodeGraph and Graphify guidance. |
| `pnpm --filter @mindfoldhq/trellis typecheck` | PASS | `tsc --noEmit` completed. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and `copy-templates` completed. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `rg -n "[ \t]+$" ...CodeGraph/Graphify guidance paths...` | PASS | No trailing whitespace matches in the touched source, test, spec, or task-evidence files. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check -- packages/cli/test/commands/init.integration.test.ts` | PASS | No whitespace errors in the tracked touched test file; Git printed a CRLF warning only. |

Not run in this slice:

- `codegraph init`, `codegraph sync`, or index refresh against this repository.
- `codegraph serve` MCP server startup.
- Real CodeGraph `impact` / `affected` execution on the Trellis working tree.
- Full root `pnpm test`.
- Built CLI temp-repo smoke after this guidance-only change.

Current conclusion:

CodeGraph now has richer selected-capability impact routing without changing ordinary init/update side effects. Agents can follow a deterministic command ladder from `status` to `query` to callers/callees/impact/affected-test scoping, but must still report stale or unverified indexes and confirm final claims with source, Git, and tests.

## 2026-06-10 Platform-Specific Reviewer Adapter Slice

Scope verified:

- Added first-class platform reviewer adapter guidance to the generated `trellis-check` agents for Codex, Claude Code, and Cursor.
- Codex records reviewer gates with reviewer id `codex`.
- Claude Code records reviewer gates with reviewer id `claude-code`.
- Cursor records reviewer gates with reviewer id `cursor`.
- Each adapter now explains where to write human-readable evidence, how to call `task.py record-gate`, how to handle `FAIL` root causes and `SKIPPED` approvals, and that `baseline-check` is CLI-owned.
- Updated the quality-gate fingerprint spec so platform adapters cannot redefine gate names, dependencies, transition keys, result values, or fingerprint rules.

Validation commands:

| Command | Result | Notes |
| --- | --- | --- |
| `pnpm --filter @mindfoldhq/trellis test test/templates/codex.test.ts test/templates/claude.test.ts test/templates/cursor.test.ts` | PASS | 3 files, 25 tests passed. Covers reviewer ids and `record-gate` boundary in first-class check agent templates. |
| `pnpm --filter @mindfoldhq/trellis test test/configurators/platforms.test.ts test/commands/init.integration.test.ts test/templates/codex.test.ts test/templates/claude.test.ts test/templates/cursor.test.ts` | PASS | 5 files, 128 tests passed. Covers platform template collection/write parity and init generation with updated agents. |
| `pnpm --filter @mindfoldhq/trellis typecheck` | PASS | `tsc --noEmit` completed. |
| `pnpm --filter @mindfoldhq/trellis build` | PASS | `tsc` and `copy-templates` completed. |
| `pnpm test` | PASS | Root suite passed: `@mindfoldhq/trellis-core` 17 files / 279 tests; `@mindfoldhq/trellis` 45 files passed, 1 skipped / 1269 tests passed, 4 skipped. |
| `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor` | PASS | `implement.jsonl` and `check.jsonl` both valid with 6 entries. |
| `rg -n "[ \t]+$" ...guidance/reviewer-adapter paths...` | PASS | No trailing whitespace matches in the touched source, test, spec, or task-evidence files. |
| `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check -- ...tracked reviewer adapter paths...` | PASS | No whitespace errors in tracked touched files; Git printed CRLF warnings only. |

Not run in this slice:

- Built CLI temp-repo smoke after this template-only reviewer adapter change.
- Real semantic reviewer gate execution and `task.py record-gate` writes by Codex/Claude/Cursor agents; existing CLI gate writer tests remain the coverage for the machine-checkable record path.

Current conclusion:

The final deferred reviewer adapter item is now implemented for the three first-class platforms without making Claude-specific gates the portable workflow contract. The CLI still owns gate schema and transition enforcement; platform agents only provide semantic review evidence and compact gate records.

## 2026-06-10 Final Archive Readiness Evidence

Validation: final tracked validation evidence is recorded in the slice sections above, including root `pnpm test`, `pnpm --filter @mindfoldhq/trellis typecheck`, `pnpm --filter @mindfoldhq/trellis build`, and `python ./.trellis/scripts/task.py validate 06-08-personal-skills-trellis-refactor`.

Acceptance: user approved moving forward with the completed task, requested the archive flow, and requested installing the modified Trellis after archive.

Integration: Parent task-map backfill records archived Child `06-08-code-retrieval-architecture-evaluation` as integrated via `task-map.md`; its code-retrieval architecture decision informed the Smart Search, CodeGraph, Graphify, and capability guidance slices completed in this parent task.

Learning decision: durable learning was captured in task-scoped specs and workflow/template changes, including `.trellis/spec/cli/backend/project-capabilities.md`, `.trellis/spec/cli/backend/quality-gate-fingerprints.md`, `.trellis/spec/cli/backend/parent-child-task-map.md`, and `.trellis/spec/cli/backend/archive-learning-guards.md`.

Reviewed change-set: parent task implementation spans workflow/task selection, guarded archive and gate records, Parent/Child orchestration, bundled skills, Smart Search runtime vendoring and sync automation, selected project capabilities, Graphify guidance, CodeGraph guidance, and first-class reviewer adapters.
