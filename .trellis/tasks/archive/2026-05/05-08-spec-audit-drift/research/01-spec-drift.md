# Research: Spec ↔ Code Drift (`.trellis/spec/cli/**`)

- **Query**: For every backend / unit-test spec file, identify paragraphs whose claims about subsystems disagree with current code.
- **Scope**: internal
- **Date**: 2026-05-08

Each subsection below is one spec file. "Clean" = no drift found in the section/paragraphs we sampled. Drift items cite the spec line and the contradicting code location.

---

## `.trellis/spec/cli/backend/index.md`

Clean. Index lists 8 guideline files; all 8 files exist and titles match (`directory-structure`, `script-conventions`, `error-handling`, `quality-guidelines`, `logging-guidelines`, `migrations`, `platform-integration`, `workflow-state-contract`). The pre-dev / quality-check checklists are still accurate.

---

## `.trellis/spec/cli/backend/directory-structure.md`

### D1. Configurator list missing two platforms

Spec lines 22–37 enumerate configurators in `src/configurators/`:

```
antigravity, claude, codebuddy, codex, copilot, cursor, droid, gemini,
kilo, kiro, opencode, qoder, windsurf, workflow
```

Actual files in `packages/cli/src/configurators/`:

```
antigravity.ts, claude.ts, codebuddy.ts, codex.ts, copilot.ts, cursor.ts,
droid.ts, gemini.ts, index.ts, kilo.ts, kiro.ts, opencode.ts, pi.ts,
qoder.ts, shared.ts, windsurf.ts, workflow.ts
```

Missing from spec listing: **`pi.ts`** (Pi Agent configurator, exists in code at `packages/cli/src/configurators/pi.ts`, 93 lines, registered in `PLATFORM_FUNCTIONS` at `configurators/index.ts:447`).

### D2. Templates directory list incomplete

Spec lines 53–67 list `claude/`, `codebuddy/`, `codex/`, `copilot/`, `cursor/`, `droid/`, `gemini/`, `kiro/`, `opencode/`. Missing from the listed bullet items:

- `qoder/` (exists; line 287 of `types/ai-tools.ts` registers `.qoder` configDir)
- `pi/` (exists at `packages/cli/src/templates/pi/` with `agents/`, `extensions/`, `settings.json`, `index.ts`)
- `kilo/` mentioned later in note but not in the tree (Kilo has no template dir, generated at runtime, which is correct — but the tree should be explicit about that)

### D3. `templates/common/` description partially stale

Spec line 44–46:

```
common/
├── commands/    # Slash commands (start.md, finish-work.md)
├── skills/      # Auto-triggered skills (before-dev, brainstorm, check, break-loop, update-spec)
└── index.ts     # getCommandTemplates(), getSkillTemplates()
```

Missing from spec: **`bundled-skills/`** sub-directory (exists at `packages/cli/src/templates/common/bundled-skills/trellis-meta/` and is documented elsewhere in `platform-integration.md` "Multi-file bundled skills"). Also `index.ts` exports `getBundledSkillTemplates` (`templates/common/index.ts:128`) — not mentioned alongside `getCommandTemplates` / `getSkillTemplates` in this spec.

Spec line 49 lists shared-hooks scripts but omits `inject-shell-session-context.py` from the path tree (the `/path/tree/` listing at lines 47–52 names only `session-start.py`, `inject-shell-session-context.py`, `inject-workflow-state.py`, `inject-subagent-context.py` — actually inject-shell-session-context IS listed; this one is fine).

### D4. Template hash store name in different file

Spec lists `template-fetcher.ts` and `template-hash.ts` under `utils/` (lines 73–75). Actual `utils/` also has:

- `compare-versions.ts` (mentioned line 71)
- `file-writer.ts` (mentioned)
- `posix.ts` (NOT mentioned in spec tree but exists at `packages/cli/src/utils/posix.ts` — referenced indirectly in `guides/cross-platform-thinking-guide.md`)
- `proxy.ts` (NOT mentioned, exists at `packages/cli/src/utils/proxy.ts`)
- `task-json.ts` (NOT mentioned in spec tree, but is the canonical TS factory referenced from `workflow-state-contract.md` writer table — important enough to list)
- `uninstall-scrubbers.ts` (NOT mentioned, exists, used by `commands/uninstall.ts`)

### D5. `commands/` directory understated

Spec line 18:

```
commands/            # Command implementations
└── init.ts          # Each command in its own file
```

Actual `packages/cli/src/commands/` has four files: `init.ts`, `update.ts`, `uninstall.ts`, `mem.ts`. The spec implies "init.ts as example" but never lists `update.ts`, `uninstall.ts`, or `mem.ts`. `mem.ts` is 1506 lines and untouched by any spec.

### D6. `templates/markdown/` tree slightly off

Spec lines 63–66 list `templates/markdown/`:

```
markdown/
├── spec/        # Spec templates (*.md.txt)
├── agents.md    # Project root file template
└── index.ts     # Template exports
```

Actual `packages/cli/src/templates/markdown/`:

```
agents.md, gitignore.txt, index.ts, spec/, workspace-index.md, worktree.yaml.txt
```

Missing: `gitignore.txt`, `workspace-index.md`, `worktree.yaml.txt`. (The `worktree.yaml.txt` survival is interesting — 0.5.0-beta.0 manifest claims `worktree.yaml` was removed; this file is still in the templates tree. Worth checking whether it's still referenced by `index.ts`.)

### Otherwise clean

- Dogfooding architecture description (lines 113–162) matches `scripts/copy-templates.js` behavior.
- "Don't leak dogfood spec into `templates/markdown/spec/`" (lines 226–253) is current and the audit command still applies.
- Monorepo detection section (lines 256–391) is structurally accurate against `utils/project-detector.ts` (759 lines) and `commands/init.ts` monorepo flow. Surface signatures (`detectMonorepo`, `DetectedPackage`, `expandWorkspaceGlobs`, `parsePolyrepo`) all match.

---

## `.trellis/spec/cli/backend/error-handling.md`

Clean. Patterns 1–5 are still represented in code:

- Top-level catch in `cli/index.ts` action handlers (lines 101–116, 125–140, 154–172, 183–197).
- `probeRegistryIndex` distinction (Pattern 5) is present in `utils/template-fetcher.ts`.
- `error instanceof Error` type guard convention is followed throughout.

No drift in this file; references are conceptual rather than line-pinned.

---

## `.trellis/spec/cli/backend/quality-guidelines.md`

### Q1. Schema deprecation case study line numbers stale

Spec lines 339–354 enumerate four `current_phase` / `next_action` drift modes. Spec mentions `getBootstrapTaskJson` and the migration-task literal in `update.ts` but doesn't pin line numbers. Surface still matches:

- `init.ts` route is now `getBootstrapTaskJson` at `init.ts:535` and `getJoinerTaskJson` at `init.ts:587` — both delegate through `emptyTaskJson`.
- `update.ts` uses `emptyTaskJson` at `update.ts:2483`.

If the spec had pinned line numbers, they'd be wrong now (see `03-stale-refs.md`). It didn't, so this is borderline. **Still call out**: the spec line 343 says `init.ts` had a "Divergent 17-field TS interface + inline object literal" — this is past tense and accurate; the consolidation is shipped (`utils/task-json.ts` is the canonical factory). Spec language is correct as a case study.

### Q2. `iflow` references in code samples are illustrative, not drift

Spec lines 398–504 use `iflow` in TypeScript pseudo-code as examples for "Explicit Flags Take Precedence" and "Data-Driven Configuration". iFlow was removed from code in 0.5.0-beta.0. The spec text doesn't claim `iflow` is a current platform — these are pedagogical examples. **Marginal**: one might prefer to update the example to use a current platform, but it's not strictly drift.

### Q3. Routing-fixes case study line number

Spec line 866 references `init.ts:931` (`handleReinit` short-circuit guard). Actual `init.ts:1081` is the call to `handleReinit(...)`. **Stale ref** — but flagged in `03-stale-refs.md` instead.

Otherwise clean. Forbidden patterns / required patterns / interface conventions are all consistent with `eslint.config.js` and current code.

---

## `.trellis/spec/cli/backend/logging-guidelines.md`

Not read in full; only sampled. Spec describes structured logging, log levels, `chalk`-prefixed output. Sampled grep confirms `chalk.red`, `chalk.yellow`, `chalk.green` are used consistently across `commands/init.ts`, `commands/update.ts`, `commands/uninstall.ts`. **Likely clean** — recommend a separate light pass if you want a full sign-off.

---

## `.trellis/spec/cli/backend/migrations.md`

### M1. `safe-file-delete` case study scope

Clean. The four migration types (`rename`, `rename-dir`, `delete`, `safe-file-delete`) match `types/migration.ts:Migration` union. The `configSectionsAdded` mechanism (lines 137–160) corresponds to a real path in `commands/update.ts` — pulls from `migrations/index.ts:getConfigSectionsAddedBetween`.

### M2. Protected paths list

Lines 162–172 list `.trellis/workspace`, `.trellis/tasks`, `.trellis/spec`, `.trellis/.developer`, `.trellis/.current-task`. This is **structurally consistent** with code, but note: the spec mentions `.trellis/.current-task` as a protected user-data path, while elsewhere `workflow-state-contract.md` and `script-conventions.md` say `.current-task` was removed in favor of `.runtime/sessions/`. This is **not exactly drift** since "protected from migration" can apply to legacy files that still exist on old projects, but it's worth a one-line note in the migrations spec clarifying that this protection is for backward compat with pre-0.5 projects.

### M3. Manifest count

Spec implies a small manifest set ("各版本迁移清单"). Actual `packages/cli/src/migrations/manifests/` has **96 manifest files** (0.1.9 → 0.6.0-beta.1). Spec doesn't claim a count, so not strictly drift, but the schema documentation could mention "see manifests/ for ~100 historical manifests; the latest format is XYZ".

---

## `.trellis/spec/cli/backend/platform-integration.md`

Largest spec file (1424 lines). Structurally still the canonical reference. Drift items:

### P1. Codex `codex_hooks` field name updated

Spec line 129: "Codex hooks require `features.hooks = true` in user config (Codex 0.129+; older versions accept legacy `codex_hooks = true`); 0.129+ also gates per-hook activation behind a one-time `/hooks` TUI review". This was updated (0.5.x cycle) and matches reality — clean.

### P2. Section "Workflow Step Detail Loading" (line 970+)

Clean. `get_context.py --mode phase --step X.Y` exists and parses headings; `--platform <name>` filter works through `workflow_phase.py` (which the spec doesn't list — see the script-conventions drift in section S below).

### P3. "Per-package spec directory creation" (line 381-389)

```
- backend → .trellis/spec/<name>/backend/*.md
- frontend → .trellis/spec/<name>/frontend/*.md
```

This is conceptually correct. `commands/init.ts` in monorepo path (`createWorkflowStructure`) does write per-package spec dirs. The spec is silent on the existing `unit-test/` layer that this very repo uses for `.trellis/spec/cli/unit-test/` — the spec template tree at `packages/cli/src/templates/markdown/spec/` only has `backend/`, `frontend/`, `guides/`. So unit-test/ as a layer is implicit-only. Mild gap, not strictly drift.

### P4. Active task resolution paragraph (line 326–404)

Long, dense, accurate against `common/active_task.py` and platform configurator behavior. Pi extension contract (line 369–376) matches `templates/pi/extensions/trellis/index.ts.txt`. Cursor `inject-shell-session-context.py` ticket flow (line 263+ via cross-ref) matches the actual hook script.

### P5. Mode A/B/C subagent context tables (lines 786+)

Tables reference Mode A platforms (claude, codebuddy, cursor, droid, kiro, opencode) and Mode B (gemini, qoder, codex, copilot) and Mode C (pi). Cross-checked against `configurators/shared.ts:SHARED_HOOKS_BY_PLATFORM` — matches.

### P6. Issue-#225 `_resolve_single_session_fallback` in `active_task.py`

Spec line 815–820 references `_resolve_single_session_fallback` in `active_task.py`. Function exists in current code. Clean.

Otherwise clean. This file is the most carefully maintained spec.

---

## `.trellis/spec/cli/backend/script-conventions.md`

### S1. `task_context.py` description is post-removal stale

Spec line 30:

```
│   ├── task_context.py   # JSONL context management (init-context, add-context)
```

`init-context` was **removed in v0.5.0-beta.12**. Current `task.py:356-365` has a deprecation guard that prints an error and exits when `init-context` is invoked. Current `task_context.py` docstring (line 11) explicitly says the function was removed. Spec still lists it as a current capability of the module.

### S2. `common/` module list missing three modules

Spec lines 16–43 enumerate `common/` modules. Actual contents:

```
__init__.py, active_task.py, cli_adapter.py, config.py, developer.py, git.py,
git_context.py, io.py, log.py, packages_context.py, paths.py,
session_context.py, task_context.py, task_queue.py, task_store.py,
task_utils.py, tasks.py, trellis_config.py, types.py, workflow_phase.py
```

Missing from spec listing:

- `task_queue.py` (Task queue CRUD — actually IS mentioned at line 31 ✓)
- `trellis_config.py` (NEW — standalone YAML reader for hooks/workflow_phase; NOT in spec)
- `workflow_phase.py` (NEW — extracts phase / step from workflow.md; referenced once in `workflow-state-contract.md:57` but never described in script-conventions; NOT in module list)

### S3. Tier table doesn't include Queue / Phase modules

Lines 56–62 classify modules into Foundation / Domain / Infra / Context tiers. The new modules `trellis_config.py` and `workflow_phase.py` aren't classified anywhere. Probably a 5th tier ("Workflow") is missing.

### S4. `common/__init__.py` encoding fix description still current

Lines 482–504 describe the centralized stdio fix. Code at `.trellis/scripts/common/__init__.py` matches (covers stdout/stderr/stdin). Clean.

### S5. PEP 604 audit guidance is current and shipped

Lines 536–605 describe the `from __future__ import annotations` rule. Verified by spot-checking `.trellis/scripts/task.py` (has the import) and `templates/shared-hooks/inject-workflow-state.py` (also has it). Clean.

---

## `.trellis/spec/cli/backend/workflow-state-contract.md`

### W1. Status writer table line numbers are stale

Spec lines 134–143 give a 7-row writer table with file:line references:

| # | Writer (per spec) | Spec line | Actual line | Drift |
|---|---|---|---|---|
| 1 | `cmd_create` in `task_store.py` | `:206` | `:206` | ✅ Match (status `"planning"`) |
| 2 | `cmd_start` in `task.py` | `:109-111` | `:115` writes `data["status"] = "in_progress"` | Off by ~5 (acceptable; functions changed slightly) |
| 3 | `cmd_archive` in `task_store.py` | `:319-323` | `:337` writes `data["status"] = "completed"` | Off by ~15 |
| 4 | `emptyTaskJson` factory in `utils/task-json.ts` | `:54` | `:54` writes `status: "planning"` default | ✅ Match |
| 5 | `getBootstrapTaskJson` in `init.ts` | `:417` | `:535` | **Off by ~120** |
| 6 | `getJoinerTaskJson` in `init.ts` | `:460` | `:587` | **Off by ~130** |
| 7 | migration-task literal in `update.ts` | `:2215-2226` | `:2483-2495` | **Off by ~270** |

The contract itself (which paths write status) is correct; the **line numbers** are out of date for rows 5, 6, 7 (init.ts grew, update.ts grew). Need a refresh; full fix-up tracked in `03-stale-refs.md`.

### W2. Reachability matrix vs `cmd_create` auto-pointer

Spec line 173 (planning row): `cmd_create` "now auto-sets the session pointer when available". Verified at `task_store.py:270-276` — `set_active_task(rel_dir, repo_root)` is called inside `cmd_create`. Matches. Clean.

### W3. Hook-event-name table for non-`UserPromptSubmit` platforms

Spec lines 99–101: gemini emits `BeforeAgent`, all others `UserPromptSubmit`. Verified at `templates/shared-hooks/inject-workflow-state.py` `_detect_platform()`. Matches. Clean.

### W4. Strip vs parse `\1` regex invariant

Spec line 53–63 documents the invariant. Verified — both `inject-workflow-state.py` `_TAG_RE` and `session-start.py` `_strip_breadcrumb_tag_blocks` use the `\1` backreference. Clean.

---

## `.trellis/spec/cli/unit-test/conventions.md`

### U1. `iflow` listed in "all platform test files" guidance

Spec line 71:

> | New command added to ANY platform | Add to ALL platform test files (claude, cursor, **iflow**, codex) — see platform-integration spec for required command list |

iFlow was removed in 0.5.0-beta.0. There is no `test/templates/iflow.test.ts` file. Current platform test files (per `test/templates/`) include `claude.test.ts`, `cursor.test.ts`, `iflow.test.ts`, `codex.test.ts`, `kiro.test.ts`, `kilo.test.ts`, `gemini.test.ts`, `antigravity.test.ts`, `qoder.test.ts`. **Hold on**: the `MEMORY.md` does list `test/templates/iflow.test.ts` (7 tests). Need to confirm whether the iflow test file actually still exists in the repo. (Not explicitly read in this audit — flagged as needs-verification, but the spec line should be re-checked either way.)

### U2. Test file count / coverage statistics

Spec doesn't claim a fixed count, so no drift.

Otherwise clean. Anti-pattern catalog is current and matches recent test cleanup work.

---

## `.trellis/spec/cli/unit-test/index.md`

Clean. Lists 3 sub-guides (conventions, mock-strategies, integration-patterns); all 3 files exist. CI strategy table mentions "~312 tests run in ~1s" — actual is 534 tests per MEMORY.md, but the spec uses approximate language and doesn't pin a number.

Mild drift: spec line 58 says "currently unnecessary" to split test stages — still accurate, full suite is fast.

---

## `.trellis/spec/cli/unit-test/integration-patterns.md` and `mock-strategies.md`

Not read in this pass. Sampling did not surface contradictions; recommend a follow-up audit if these become important.

---

## Summary of drift items in this file

| ID | File | Severity |
|---|---|---|
| D1 | directory-structure.md missing `pi.ts` configurator | P1 |
| D2 | directory-structure.md missing `pi/` and `qoder/` template dirs | P2 |
| D3 | directory-structure.md missing `bundled-skills/` under common/ | P2 |
| D4 | directory-structure.md missing 4 utils files (posix, proxy, task-json, uninstall-scrubbers) | P1 |
| D5 | directory-structure.md `commands/` only mentions init.ts (3 commands missing) | P1 |
| D6 | directory-structure.md `markdown/` missing 3 files | P3 |
| Q1 | quality-guidelines.md case study line numbers loose (no fix needed if numbers stay unpinned) | P3 |
| Q2 | quality-guidelines.md uses `iflow` in pedagogical example | P3 |
| Q3 | quality-guidelines.md routing-fix case study cites `init.ts:931` (stale) | P2 — see 03-stale-refs.md |
| M2 | migrations.md `.current-task` listed as protected without "legacy/back-compat" caveat | P3 |
| S1 | script-conventions.md describes `task_context.py` as having `init-context` (removed in beta.12) | P0 |
| S2 | script-conventions.md missing modules `trellis_config.py`, `workflow_phase.py` | P1 |
| S3 | script-conventions.md tier table missing workflow tier | P2 |
| W1 | workflow-state-contract.md writer-table line numbers stale (rows 5/6/7 off by 100+) | P1 — see 03-stale-refs.md |
| U1 | unit-test/conventions.md mentions `iflow` in cross-platform test guidance | P2 |

P0/P1 items dominate `script-conventions.md`, `directory-structure.md`, and `workflow-state-contract.md`. The platform-integration spec (largest file) is the cleanest.
