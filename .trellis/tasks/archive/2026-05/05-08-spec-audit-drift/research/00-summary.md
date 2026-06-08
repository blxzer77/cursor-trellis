# Spec Audit Summary — 2026-05-08

- **Task**: `.trellis/tasks/05-08-spec-audit-drift/`
- **Scope**: Project-wide spec audit covering 4 dimensions
- **Spec files audited**: 13 (9 backend + 4 unit-test files; docs-site internal spec checked for cross-refs)
- **Code base size**: ~13,000 lines TS (`packages/cli/src/`) + ~20 Python modules under `.trellis/scripts/common/`
- **Migration manifests**: 96 files (0.1.9 → 0.6.0-beta.1)
- **Docs-site files audited**: 8 EN + 8 ZH (start/ + advanced/)

---

## Findings count by dimension

| Dimension | Research file | Findings | P0 | P1 | P2 | P3 |
|---|---|---|:-:|:-:|:-:|:-:|
| 1. Spec ↔ code drift | `01-spec-drift.md` | 15 items | 1 | 5 | 5 | 4 |
| 2. Missing specs (code without spec coverage) | `02-missing-specs.md` | 18 items | 2 | 6 | 8 | 2 |
| 3. Stale code references in spec (file:line, symbols) | `03-stale-refs.md` | 7 hard misses + several soft | 0 | 5 | 2 | 0 |
| 4. docs-site ↔ spec consistency | `04-docs-spec-consistency.md` | 8 items (3 drift + 5 positive checks) | 0 | 1 | 2 | 0 |
| **Total** | — | **48** | **3** | **17** | **17** | **6** |

---

## Top P0 items (must-fix immediately)

1. **`script-conventions.md` claims `task_context.py` has `init-context`** (`01-spec-drift.md` S1). The function was removed in v0.5.0-beta.12; spec line 30 still describes it as live.
2. **`commands/mem.ts` has zero spec coverage** (`02-missing-specs.md`). 1506-line command with five subcommands, multi-platform session indexing, and Zod schemas. No future contributor can extend it safely.
3. **`task_context.py` description in spec is fundamentally wrong** (overlap of 1 + 2). Same root cause as #1; fixing the description in script-conventions.md resolves both.

---

## Top P1 items (next batch)

### Spec ↔ code drift (5)

- D1: `directory-structure.md` configurator listing missing `pi.ts`
- D4: `directory-structure.md` utils tree missing 4 files (`posix.ts`, `proxy.ts`, `task-json.ts`, `uninstall-scrubbers.ts`)
- D5: `directory-structure.md` commands tree only mentions `init.ts` (3 commands missing)
- S2: `script-conventions.md` missing two new modules (`trellis_config.py`, `workflow_phase.py`)
- W1: `workflow-state-contract.md` writer-table line numbers stale (rows 5/6/7 off by 100–270)

### Missing specs (6)

- `commands/update.ts` (2589 lines) — partial coverage via `migrations.md` only
- `commands/uninstall.ts` (433 lines) — zero coverage
- `configurators/workflow.ts` (243 lines) — only mentioned by name in directory-structure
- `utils/uninstall-scrubbers.ts` (354 lines) — zero coverage; uninstall correctness depends on it
- `trellis_config.py` (Python) — new module, undocumented
- `workflow_phase.py` (Python) — new module, undocumented

### Stale refs (5)

- `init.ts:417` → actual `:535` (`getBootstrapTaskJson`)
- `init.ts:460` → actual `:587` (`getJoinerTaskJson`)
- `update.ts:2215-2226` → actual `:2483-2495` (migration-task literal)
- `init.ts:931` → actual `:1081` (handleReinit return; cited 2x in 2 files)
- `task_context.py` description (overlaps with P0)

### docs-site ↔ spec (1)

- `architecture.mdx` (en + zh) line 173 wrongly states `.trellis/.current-task` is a CLI fallback. Spec says it's never written by current code.

---

## P2/P3 items

Most items at P2 are quality-of-life additions: dedicated spec files for `configurators/shared.ts`, `task_queue.py`, `proxy.ts`, `file-writer.ts`, manifest JSON schema. P3 includes `posix.ts` polish and stale `iflow` examples in pedagogical sections.

See per-dimension research files for the full P2/P3 lists.

---

## Recommended fix batches

### Batch A — P0 sweep (1 PR, small)

Files to edit:

- `.trellis/spec/cli/backend/script-conventions.md` lines 30, 34 (drop `init-context`, add the two new modules `trellis_config.py` and `workflow_phase.py`)

This single edit clears the two P0 items.

### Batch B — Writer-table refresh (1 PR, small)

Files to edit:

- `.trellis/spec/cli/backend/workflow-state-contract.md` lines 137–142 (fix line numbers in the status writer table)
- `.trellis/spec/cli/backend/quality-guidelines.md` line 866 (fix `init.ts:931` → `init.ts:1081`)
- `.trellis/spec/cli/unit-test/conventions.md` line 344 (same fix)

### Batch C — Directory-structure refresh (1 PR, medium)

Files to edit:

- `.trellis/spec/cli/backend/directory-structure.md` lines 18, 22–37, 53–67, 70–75 (add missing configurators, templates, utils, commands)

### Batch D — Docs-site `.current-task` correction (1 PR, small)

Files to edit:

- `docs-site/advanced/architecture.mdx` line 173
- `docs-site/zh/advanced/architecture.mdx` line 173

Both edits are short prose changes; bilingual sync is a single sentence each side.

### Batch E — New spec files for uncovered commands and modules (separate PRs, medium each)

Recommend one PR per file to keep review sizes manageable:

- `.trellis/spec/cli/backend/commands/update.md` (or as section in existing `migrations.md`)
- `.trellis/spec/cli/backend/commands/uninstall.md`
- `.trellis/spec/cli/backend/commands/mem.md`
- `.trellis/spec/cli/backend/utils/uninstall-scrubbers.md`
- `.trellis/spec/cli/backend/configurator-shared-helpers.md`

If grouping into a `commands/` and `utils/` sub-layer, note that the spec template tree (`packages/cli/src/templates/markdown/spec/`) currently only ships `backend/`, `frontend/`, `guides/`. Add `commands/` and `utils/` sub-layer templates, OR keep the new specs flat under `backend/`.

### Batch F — docs-site platform grouping & ai-tools coverage decision (1 PR + 1 decision)

Decisions needed:

1. Should `architecture.mdx` use the spec's Mode A/B/C taxonomy verbatim? (Recommend yes.)
2. Should every supported platform have an `ai-tools/<platform>.mdx` page? (Spec says yes; current state has only 3/14. Either bulk-author 11 pages or relax the rule.)

---

## Cross-cutting observations

- The **platform-integration spec** is the cleanest of the backend specs — clearly the most-maintained file. Most other specs show ~6-month drift trails.
- **Line-numbered references rot fastest**. Half of the P1 stale items in `03-stale-refs.md` are line-number mismatches in `init.ts` (which has grown from ~900 lines to 1859 lines since the spec text was written). Recommend a convention shift: either anchor by symbol name without line, or use a `// SPEC-ANCHOR: ...` comment in code so refactors flag the spec.
- **docs-site is more current than spec on two specific cleanups**: the `init-context` removal (clean in docs, stale in spec) and the `iflow` removal (clean in docs, residual in spec). Likely because the docs-site sync was mechanical (driven by `sync-on-change.md` checklist) while spec edits are author-discretion.
- **Two new Python modules** (`trellis_config.py`, `workflow_phase.py`) shipped without spec updates. Worth adding a CI check or a pre-merge spec-coverage smoke test for new files in `templates/trellis/scripts/common/`.
- **`commands/mem.ts` is a strategic gap**. 1500 lines of code, P0 priority. Suggest treating "every command file under `commands/` must have a section in the backend spec" as a hard rule.

---

## Files written

| Path | One-line takeaway |
|---|---|
| `.trellis/tasks/05-08-spec-audit-drift/research/01-spec-drift.md` | 15 drift items across 6 backend spec files; biggest offenders are `script-conventions.md` and `directory-structure.md` |
| `.trellis/tasks/05-08-spec-audit-drift/research/02-missing-specs.md` | 18 code modules with insufficient or zero spec coverage; `commands/mem.ts`, `commands/uninstall.ts`, `utils/uninstall-scrubbers.ts` are the worst |
| `.trellis/tasks/05-08-spec-audit-drift/research/03-stale-refs.md` | 7 hard line-number misses (4 of them off by >100 lines), plus several soft pedagogical refs; symbol-only references are mostly clean |
| `.trellis/tasks/05-08-spec-audit-drift/research/04-docs-spec-consistency.md` | 1 P1 contradiction (`.current-task` fallback claim), 2 P2 (Mode taxonomy mismatch, ai-tools/ coverage), bilingual pairs structurally aligned |
| `.trellis/tasks/05-08-spec-audit-drift/research/00-summary.md` | this file |

---

## Total time-to-fix estimate

Batches A + B + D are each ~10-minute edits. Batch C is ~30 minutes. Batches E and F are the bulk of the work — author estimates: 4–6 hours for E (5 new spec files at ~45 minutes each), 1 hour for F (taxonomy edit) + decision-dependent for ai-tools/ pages.

Total: ~6-8 focused hours for full P0+P1 cleanup; P2/P3 polish is a separate quarter's work.
