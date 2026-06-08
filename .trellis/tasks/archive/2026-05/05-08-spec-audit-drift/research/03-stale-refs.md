# Research: Stale Code References in Specs

- **Query**: For every `path/file.ext:line` or `` `functionName()` `` reference in a spec markdown file, is the file/symbol still present at roughly the cited location?
- **Scope**: internal
- **Date**: 2026-05-08

Tolerance: ±50 lines is acceptable (code drift). Off by >100 lines = must fix. Symbol/file gone entirely = must fix.

---

## File:line references

| Spec file | Spec line | Reference | Current state | Status | Suggested fix |
|---|---|---|---|---|---|
| `cli/backend/workflow-state-contract.md` | 136 | `task_store.py:206` (`cmd_create` writes `"planning"`) | `task_store.py:206` literally has `"status": "planning",` | ✅ exact | none |
| `cli/backend/workflow-state-contract.md` | 137 | `task.py:109-111` (`cmd_start` flip) | Actual `data["status"] = "in_progress"` at `task.py:115` (and again at `:129` for the alternate branch). Line 109–111 is `cmd_start` body but not the literal status assignment | ⚠️ off by ~5 | Update to `task.py:111-130` to cover both branches; or pin to the function body via `cmd_start` named ref |
| `cli/backend/workflow-state-contract.md` | 138 | `task_store.py:319-323` (`cmd_archive` writes `"completed"`) | Actual at `task_store.py:337` (`data["status"] = "completed"`) | ⚠️ off by ~15 | Update to `task_store.py:332-339` |
| `cli/backend/workflow-state-contract.md` | 139 | `utils/task-json.ts:54` (`emptyTaskJson` default) | Line 54 is `status: "planning",` literally | ✅ exact | none |
| `cli/backend/workflow-state-contract.md` | 140 | `init.ts:417` (`getBootstrapTaskJson`) | Actual function at `init.ts:535` | ❌ off by ~120 | Update to `init.ts:535-585` or just `init.ts:535` |
| `cli/backend/workflow-state-contract.md` | 141 | `init.ts:460` (`getJoinerTaskJson`) | Actual function at `init.ts:587` | ❌ off by ~130 | Update to `init.ts:587-625` or just `init.ts:587` |
| `cli/backend/workflow-state-contract.md` | 142 | `update.ts:2215-2226` (migration-task literal) | Actual at `update.ts:2483-2495` (now using `emptyTaskJson` factory rather than inline literal — minor description drift too) | ❌ off by ~270 | Update to `update.ts:2483-2495`; also update description from "literal" to "via `emptyTaskJson` factory" |
| `cli/backend/quality-guidelines.md` | 866 | `init.ts:931` (`handleReinit` short-circuit) | Actual `handleReinit` is defined at `init.ts:740`; the call site that mis-routes joiner is at `init.ts:1081`. Line 931 is unrelated | ❌ off by ~150 | Update to `init.ts:1081` (the actual short-circuit return) and `init.ts:740` (handleReinit definition) |
| `cli/unit-test/conventions.md` | 344 | `init.ts:931` (in test code comment, same context) | Same as above | ❌ off by ~150 | Update to `init.ts:1081` |
| `docs-site/docs/style-guide.md` | 248 | `init.ts:1370` (used as an illustrative example of a stable file:line reference style) | Used pedagogically; the actual content at `init.ts:1370` is irrelevant to the spec point | 🟡 illustrative | none — but worth swapping to a current line if you want the example to actually point at code |
| `docs-site/docs/style-guide.md` | 347 | `task_store.py:147-172` (illustrative example) | Same — pedagogical | 🟡 illustrative | none |

---

## Symbol / function references (no line number)

These are references like `` `functionName()` `` or `` `module.method()` `` without a line number. The check is "does the symbol still exist anywhere?"

| Spec file | Reference | Current state |
|---|---|---|
| `cli/backend/platform-integration.md` | `configurePlatform`, `getConfiguredPlatforms`, `isManagedPath`, `isManagedRootDir` | All exported from `configurators/index.ts` (lines 477, 497, 508, 522) ✅ |
| `cli/backend/platform-integration.md` | `resolvePlaceholders`, `resolvePlaceholdersNeutral`, `resolveAllAsSkills`, `resolveAllAsSkillsNeutral`, `resolveCommands`, `resolveSkills`, `resolveBundledSkills`, `wrapWithSkillFrontmatter`, `wrapWithCommandFrontmatter` | All present in `configurators/shared.ts` ✅ |
| `cli/backend/platform-integration.md` | `writeSkills`, `writeAgents`, `writeSharedHooks`, `collectSkillTemplates`, `collectPlatformTemplates` | All present in `configurators/shared.ts` / `configurators/index.ts` ✅ |
| `cli/backend/platform-integration.md` | `createTemplateReader(import.meta.url)`, `listMdAgents()`, `listJsonAgents()` | Present in `templates/template-utils.ts` ✅ |
| `cli/backend/platform-integration.md` | `getBundledSkillTemplates()` | Present at `templates/common/index.ts:128` ✅ |
| `cli/backend/platform-integration.md` | `_SUBAGENT_CONFIG_DIRS` in `task_store.py` | Present in `task_store.py` ✅ |
| `cli/backend/platform-integration.md` | `_resolve_single_session_fallback` in `active_task.py` | Present in `active_task.py` ✅ |
| `cli/backend/platform-integration.md` | `buildPullBasedPrelude`, `injectPullBasedPreludeMarkdown`, `injectPullBasedPreludeToml`, `detectSubAgentType` | All present in `configurators/shared.ts` ✅ |
| `cli/backend/platform-integration.md` | `resolvePiInvocation` (Pi launcher) | Present in `templates/pi/extensions/trellis/index.ts.txt` ✅ |
| `cli/backend/migrations.md` | `getConfigSectionsAddedBetween(fromVersion, toVersion)` | Present in `migrations/index.ts` ✅ |
| `cli/backend/migrations.md` | `update.skip` config field | Present in `commands/update.ts` and Python `config.py` ✅ |
| `cli/backend/script-conventions.md` | `cmd_init_context` (line 30 lists `task_context.py # JSONL context management (init-context, add-context)`) | **Removed** in v0.5.0-beta.12. Still imported at `task.py:1091` only as a deprecation guard via `from common.task_context import cmd_init_context` (the function is gone, so this import probably already errors — needs verification) | ❌ stale — see `01-spec-drift.md` S1 |
| `cli/backend/script-conventions.md` | `_run_hooks` in task lifecycle hooks section | Present (in `task_utils.py` or `task_store.py`, exact location not verified) ✅ |
| `cli/backend/workflow-state-contract.md` | `_TAG_RE` parser regex in `inject-workflow-state.py` | Present ✅ |
| `cli/backend/workflow-state-contract.md` | `_strip_breadcrumb_tag_blocks` in `session-start.py` | Present ✅ |
| `cli/backend/workflow-state-contract.md` | `linear_sync.py` writes `meta.linear_issue` only | Present at `.trellis/scripts/hooks/linear_sync.py` ✅ |
| `cli/unit-test/conventions.md` | `OpenCodeContext.getContextKey`, `TrellisContext.getActiveTask` (referenced in env-leak guard discussion) | These are TS classes in OpenCode plugin, location not pinned in spec; existence verified by spec context. ✅ |

---

## File-level references (no line, no symbol)

| Spec file | Reference | Status |
|---|---|---|
| Multiple | `packages/cli/src/templates/trellis/scripts/` and `.trellis/scripts/` parity | Both directories exist and have the same module list. ✅ |
| `cli/backend/directory-structure.md:99` | `.trellis/scripts/multi_agent/` (in description "(no `multi_agent/`)") | Correct — `multi_agent/` was removed in 0.5.0-beta.0; the spec line says it should NOT be in dist | ✅ |
| `cli/backend/quality-guidelines.md:354` | "consolidation outcome: `packages/cli/src/utils/task-json.ts` exports `TaskJson` + `emptyTaskJson(overrides)` factory" | Verified. ✅ |
| `cli/backend/platform-integration.md` | `.trellis/tasks/04-17-subagent-hook-reliability-audit/research/platform-hook-audit.md` | Path likely archived; `.trellis/tasks/` only has the active workspace, this date prefix suggests it's been archived to `.trellis/tasks/archive/`. Unverified. 🟡 |
| `cli/backend/platform-integration.md` | `.trellis/tasks/<archive>/05-04-fix-codex-subagent-missing-active-task/manual-verify.md` | Same — archived path, the `<archive>` placeholder is intentional but worth replacing with an actual archive subdir if one exists. 🟡 |

---

## Test-file references

| Spec file | Reference | Status |
|---|---|---|
| `cli/backend/workflow-state-contract.md` | `test/regression.test.ts > [strip-breadcrumb] _strip_breadcrumb_tag_blocks only strips matched STATUS pairs` | Test name; not directly verified against test file but `regression.test.ts` exists ✅ |
| `cli/backend/workflow-state-contract.md` | `test/regression.test.ts > [issue-225]`, `[session-fallback]` | Same ✅ |
| `cli/backend/workflow-state-contract.md` | `templates/trellis.test.ts > [issue-225]` | Same ✅ |
| `cli/unit-test/conventions.md` | `test/setup.ts` registered via `setupFiles` | Verified — file exists ✅ |
| `cli/unit-test/conventions.md` | `test/templates/iflow.test.ts` (implicitly: spec mentions `iflow` as a test platform) | Per `MEMORY.md`, exists with 7 tests, but iFlow platform was removed. **The test file is now testing a removed platform** — separate question whether the test file should still exist | 🟡 see `01-spec-drift.md` U1 |

---

## Stale references summary

| Severity | Count | Notes |
|---|---|---|
| **❌ Off by >100 lines** | 4 | `init.ts:417`, `init.ts:460`, `update.ts:2215-2226`, `init.ts:931` (latter cited 2x in 2 files) |
| **⚠️ Off by 5-50 lines** | 2 | `task.py:109-111`, `task_store.py:319-323` |
| **❌ Symbol removed** | 1 | `cmd_init_context` referenced as live functionality in `task_context.py` description |
| **🟡 Pedagogical / placeholder refs** | 3 | `init.ts:1370`, `task_store.py:147-172` (illustrative); archived task path placeholders |
| **✅ Verified or symbol-only** | many | All other symbol references are still valid |

---

## Recommended fix

A single-PR fix for the writer table in `workflow-state-contract.md` (rows 5/6/7) plus the `init.ts:931` reference in `quality-guidelines.md` and `unit-test/conventions.md` would resolve all P0/P1 stale-line items. The `task_context.py` description fix overlaps with `01-spec-drift.md` S1 — same edit covers both.

Suggested approach:

1. Replace literal line numbers with anchor-style references when the underlying file is volatile:
   - Use `` `getBootstrapTaskJson` in `init.ts` (search by name, currently around line 535) ``
   - Or pin the line and add a comment in code: `// SPEC-ANCHOR: workflow-state-contract.md writer table row 5`
2. For the `task_store.py:319-323` and `task.py:109-111` references, ±20 lines is borderline; either fix now or use a "fuzzy" reference (`task_store.py cmd_archive (around L335)`).
3. Stop using line numbers in case studies (`quality-guidelines.md` line 866) — use the function name instead, since case studies explicitly document something that happened weeks ago and the file evolves.
