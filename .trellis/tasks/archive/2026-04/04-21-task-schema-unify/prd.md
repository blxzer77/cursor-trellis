# PRD: Unify task.json schema across all writers

## Problem

Three different code paths write `task.json` in 0.5, each with its own field set:

| Writer | Location | Schema |
|---|---|---|
| Normal user task | `.trellis/scripts/common/task_store.py:147-172` (`cmd_create`) | 24 fields — the canonical shape (id / name / title / description / status / dev_type / scope / package / priority / creator / assignee / createdAt / completedAt / branch / base_branch / worktree_path / commit / pr_url / subtasks / children / parent / relatedFiles / notes / meta) |
| Bootstrap task | `packages/cli/src/commands/init.ts:258-339` (`getBootstrapTaskJson` + interface `TaskJson`) | 17 fields — no `title` / `scope` / `package` / `branch` / `base_branch` / `worktree_path` / `pr_url`; `status` init to `in_progress` |
| Migration task (breaking update) | `packages/cli/src/commands/update.ts:2009-2036` | 19 fields — no `id` / `name` / `package`; includes legacy `current_phase` (int) + `next_action` (array of `{phase, action}`) that nothing reads in 0.5 |

This divergence causes real problems:

1. **Docs are hard to write**: `appendix-c` / `ch06 §6.3` have to disclaim variant schemas or users hit surprises inspecting real task.json files.
2. **Downstream readers break on missing fields**: any hook / integration / `get_context.py` path that expects a canonical 24-field shape has to defensively handle missing keys per task type.
3. **Dead legacy fields leak into prod**: `current_phase` / `next_action` in migration tasks reference the removed Multi-Agent Pipeline. `phase.py` (the reader) is orphan code — no active script imports it. So those fields are pure noise, but `update.ts` keeps writing them.
4. **Same concept, three implementations**: `TaskJson` interface in `init.ts` duplicates what `task_store.py` already defines; `update.ts` inlines a third literal. Any schema evolution (e.g. adding a new field) requires updating three places.

## Goal

Single source of truth for `task.json` shape. All three writers (normal create / bootstrap / migration) produce the same 24-field canonical schema. Bootstrap and migration keep their special field VALUES (e.g. `status: "in_progress"`, `scope: "migration"`) but share the structural layout.

## Proposed approach

1. **Pick the canonical shape**: `task_store.py cmd_create`'s 24-field output. Field names, field order, null defaults.
2. **Drop dead fields**: remove `current_phase` and `next_action` from `update.ts`. No reader uses them in 0.5. If migration tasks need a checklist representation, use `subtasks: [{name, status}, ...]` (which matches the bootstrap task's existing usage).
3. **Factor into a shared TypeScript helper**: introduce `packages/cli/src/utils/task-json.ts` (or similar) exporting:
   - `TaskJson` type (mirror of the Python schema)
   - `emptyTaskJson(overrides)` helper producing a fully-populated, canonical-shape object with all 24 keys and documented defaults
   - Replace both `getBootstrapTaskJson` and the `update.ts` inline literal with calls to `emptyTaskJson({...})`.
4. **Keep the Python create canonical on runtime side**. Optional: extract the field list into `common/task_store.py` module-level constant `EMPTY_TASK_JSON_DEFAULTS` so a future `cmd_repair` could top up missing keys.
5. **Remove `.trellis/scripts/common/phase.py`** at the same time — orphan code, no importers.

## Refined decisions (2026-04-22)

Locked in during brainstorm before execution — supersedes anything above in case of conflict:

### D1. `subtasks` semantic collision → option C (drop bootstrap's structured checklist)

Canonical `subtasks: string[]` (child task dir names, even if rarely used — matches `children`/`subtasks` twin design in `task_store.py`). Bootstrap's `{name, status}[]` checklist disappears from task.json and is rendered as markdown `- [ ]` items in prd.md instead — migration task already does this, so the two align. AI readers can still extract progress from prd.md.

### D2. Cleanup scope expanded

PRD originally only called out deleting `phase.py` from this repo. Execution must also:
- Add `safe-file-delete` entry for `.trellis/scripts/common/phase.py` to the next migration manifest (e.g., `0.5.0-beta.9.json` or wherever this ships) — it wasn't in `0.5.0-beta.0`'s 138-entry cleanup (only `multi_agent/*` was), so existing users on early 0.5 betas still have the file.
- Update `packages/cli/src/templates/markdown/spec/backend/script-conventions.md:24` directory-tree — still lists `phase.py` (template source, shipped to users).
- Update `.trellis/spec/cli/backend/quality-guidelines.md:288` — uses `phase.py:get_current_phase` as a reader example; swap for a still-live reader.

### D3. Factory location

`packages/cli/src/utils/task-json.ts` (PRD's suggestion). Contains both `TaskJson` type and `emptyTaskJson` factory — function-carrying module belongs under `utils/`, not `types/`.

### D4. Not doing

- `EMPTY_TASK_JSON_DEFAULTS` Python constant (PRD's optional #4) — YAGNI; extract when `cmd_repair` is actually needed.
- Auto-repair of existing task.json files in users' repos — `task.py` reads with `.get(key, null)` tolerance, no breakage.

### Meta-note

This task is the literal follow-through for the `quality-guidelines.md` spec lesson **"Schema Deprecation: Audit ALL Writers, Not Just the Creator"** (captured in 0.5.0-beta.0). `task_store.py cmd_create` got cleaned up for `current_phase`/`next_action`, but `update.ts`/`init.ts` were missed. Worth calling out in commit message.

## Out of scope

- Auto-migrating existing tasks in users' repos to add missing keys. `task.py` already treats missing fields as null, so no user breaks; a future `trellis update` migration entry can normalize if desired.
- Changing the runtime Python writer (`task_store.py`) — it's already canonical.

## Acceptance criteria

- [ ] `packages/cli/src/utils/task-json.ts` exports `TaskJson` type + `emptyTaskJson(overrides)` factory.
- [ ] `init.ts getBootstrapTaskJson` uses the factory; output has all 24 canonical fields; structured `subtasks: [{name, status}]` removed from task.json and rendered in the bootstrap prd.md instead (D1).
- [ ] `update.ts` migration task block uses the factory; output has all 24 canonical fields; `current_phase` / `next_action` removed.
- [ ] `.trellis/scripts/common/phase.py` deleted.
- [ ] Next migration manifest gains a `safe-file-delete` entry for `common/phase.py` (D2) so users on early 0.5 betas get it cleaned up.
- [ ] `templates/markdown/spec/backend/script-conventions.md` directory-tree + `.trellis/spec/cli/backend/quality-guidelines.md` `phase.py` reader example updated (D2).
- [ ] `trellis init` on a fresh project still produces a working bootstrap task end-to-end.
- [ ] `trellis update --migrate` across a breaking boundary still produces a working migration task end-to-end.
- [ ] `docs-site/.../appendix-c.mdx` + `ch06-task-management.mdx` can be simplified (no "variant schemas" disclaimer needed).

## Notes

- This is a pure code-cleanup task, not a schema evolution. End-user tasks created by `task.py create` already look canonical — only bootstrap / migration tasks are structurally divergent today.
- Caught during docs audit of 0.5.0-beta.8 (`docs-site-version-audit` task, 2026-04-21).
