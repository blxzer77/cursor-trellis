# Research: docs-site User Docs vs Spec Consistency

- **Query**: Does the user-facing documentation under `docs-site/` agree with the internal contracts in `.trellis/spec/cli/backend/`? Are bilingual files in sync?
- **Scope**: mixed (docs-site vs spec)
- **Date**: 2026-05-08

---

## Layout context

- User-facing English docs: `docs-site/start/`, `docs-site/advanced/`, `docs-site/ai-tools/`
- User-facing Chinese docs: `docs-site/zh/start/`, `docs-site/zh/advanced/`, `docs-site/zh/ai-tools/`
- Internal docs-site spec: `.trellis/spec/docs-site/docs/` (covers MDX, plugin, sync-on-change rules)
- Internal CLI backend spec (the contract): `.trellis/spec/cli/backend/`

The check below is "user reads docs-site, AI reads `.trellis/spec/cli/backend/` — are both telling the same story?"

---

## Drift item D1 — `.trellis/.current-task` description disagrees with spec

**docs-site** (`advanced/architecture.mdx:173` and `zh/advanced/architecture.mdx:173`):

> `.trellis/.current-task` is a fallback for command-line contexts. Session-scoped runtime pointers take precedence when the platform provides a session identity.

**spec** (`cli/backend/script-conventions.md:299-303, 327, 343`):

> `task.py create` creates only task-owned files under `.trellis/tasks/<date-slug>/`. It must not create `.trellis/.runtime/` and **must not write `.trellis/.current-task`**.
>
> `task.py start` writes session-local state only when a context key is available. **Otherwise it exits non-zero and must not write `.trellis/.current-task`**.

**Spec** (`cli/backend/migrations.md:170`) lists `.trellis/.current-task` as a protected user-data path — i.e. it can exist as a leftover on legacy projects, but new code does not write it.

**Drift**: The docs-site claim that `.current-task` is an active fallback contradicts the spec. The current code **never writes** `.current-task`, and `task.py start` actively fails (with a session-identity hint) when no context key exists. The user reading docs-site will think there's a fallback that no longer exists.

**Severity**: P1 (user-facing contract is wrong).

**Fix**: Update `architecture.mdx` (and ZH) to drop the `.current-task` fallback claim, replacing with: "If the platform doesn't provide session identity, `task.py start` requires `TRELLIS_CONTEXT_ID` to be set explicitly; otherwise it exits with a hint."

---

## Drift item D2 — `task.py init-context` mentioned in docs

Spot-check: `grep init-context` across `docs-site/start/`, `docs-site/advanced/`, ZH equivalents returned **zero hits** — clean.

This is good news: `init-context` was removed in v0.5.0-beta.12, and the docs-site pages have been swept. The same removal still drifted into the **spec** (see `01-spec-drift.md` S1 — `script-conventions.md` line 30 still describes `task_context.py` as having `init-context`). So the docs-site is more current than the spec on this point.

---

## Drift item D3 — `iflow` no longer in docs

Spot-check: `grep iflow` across `docs-site/start/`, `docs-site/advanced/`, `docs-site/ai-tools/`, ZH equivalents returned **zero hits**. Clean.

Spec residue: `quality-guidelines.md` and `unit-test/conventions.md` still mention `iflow` (see `01-spec-drift.md` Q2, U1). Again docs-site is more current.

---

## Drift item D4 — `ai-tools/` page coverage stale

`docs-site/ai-tools/` and `docs-site/zh/ai-tools/` each contain only:

```
claude-code.mdx
cursor.mdx
windsurf.mdx
```

Per `.trellis/spec/docs-site/docs/sync-on-change.md` Trigger 2 ("Platform Add"), every supported platform should have an `ai-tools/<platform>.mdx` page. The current Trellis registry supports 14 platforms (per `install-and-first-task.mdx:37`):

```
claude, cursor, opencode, codex, kiro, gemini, qoder, codebuddy,
copilot, droid, pi, antigravity, windsurf, kilo
```

Missing pages: opencode, codex, kiro, gemini, qoder, codebuddy, copilot, droid, pi, antigravity, kilo (11 platforms).

**Severity**: P2 (does not break existing user flow, but the spec rule says these should exist).

**Fix**: Either author the missing pages (large effort) OR update `sync-on-change.md` to clarify that `ai-tools/<platform>.mdx` is "for platforms that have non-trivial setup quirks worth a page" rather than mandatory for every supported platform.

The `multi-platform.mdx` and `appendix-d.mdx` files in `advanced/` may already cover the per-platform quirks adequately; if so, the `ai-tools/` directory is just the wrong location for that content. Worth a clarifying decision.

---

## Drift item D5 — Phase 3.4 commit step in docs vs spec

**spec** (`cli/backend/workflow-state-contract.md:18-21`):

> Two production bugs (Phase 1.3 jsonl curation skip, **Phase 3.4 commit skip**) hit exactly this failure mode.

**docs-site** (`advanced/architecture.mdx:245`):

> 3. Phase 3.4 proposes a batched commit plan, waits for one user confirmation, stages the listed files, and runs `git commit`. It does not amend and does not push.

These agree. ✅

But: spec also says Phase 3.4 commit IS the work commit, and `/trellis:finish-work` is bookkeeping AFTER commit. `architecture.mdx:248`:

> `/trellis:finish-work` is not the command that commits feature code. Work commits happen first; archive and journal commits are bookkeeping after that.

Cross-reference confirmed. Clean.

---

## Drift item D6 — `start/everyday-use.mdx` task.py command catalog

`everyday-use.mdx` lines 158-260 enumerate task.py commands: `create`, `add-context`, `validate`, `list-context`, `start`, `finish`, `set-branch`, `set-base-branch`, `set-scope`, `archive`, `list`, `add-subtask`, `remove-subtask`, `list-archive`, `current`.

Cross-checked against `.trellis/scripts/task.py:390-465` subparsers: every cited subcommand is present. ✅

The `init-context` command would need to be absent — verified zero hits in this file. ✅

This file appears clean.

---

## Drift item D7 — `custom-workflow.mdx` `task.py create` auto-pointer claim

`docs-site/advanced/custom-workflow.mdx:59`:

> `task.py create` now sets the active-task pointer alongside writing `status=planning`, so the `[workflow-state:planning]` block fires from the very next turn — during brainstorm and JSONL curation, not just after `task.py start`.

Cross-check: `task_store.py:270-276` calls `set_active_task(rel_dir, repo_root)` inside `cmd_create`. Spec (`workflow-state-contract.md:172`) confirms: "After `cmd_create` (which now auto-sets the session pointer when available)". ✅

Clean.

---

## Drift item D8 — `architecture.mdx` Mode A/B/C platform groupings

`docs-site/advanced/architecture.mdx:198-203`:

| Group | Platforms |
|---|---|
| Hook + hook-push sub-agent | Claude Code, Cursor, OpenCode, CodeBuddy, Droid, Pi |
| Hook + pull-prelude sub-agent | Gemini CLI, Qoder, Copilot |
| Codex | Codex (own row) |
| Kiro | Kiro (own row) |
| Main-session workflow/skill | Kilo, Antigravity, Windsurf |

Cross-check against spec (`cli/backend/platform-integration.md`):

- Mode A (hook-inject, line 788–800): Claude Code, CodeBuddy, Cursor, Factory Droid, Kiro, OpenCode (6)
- Mode B (pull-based, line 802–812): Gemini CLI, Qoder, Codex, Copilot (4)
- Mode C (extension-backed, line 822–828): Pi Agent (1)
- Hookless: Kilo, Antigravity, Windsurf (3)

**Drift**:
1. `architecture.mdx` puts **Pi** under "hook-push" (Mode A), but spec says Pi is **Mode C, extension-backed** — different mechanism (project-local TS extension, not hooks).
2. `architecture.mdx` puts **Codex** under its own row (correctly noting it has special semantics), but the row's claim "Pull-based prelude plus shared `.agents/skills/`" matches Mode B in the spec, so it should arguably be grouped with Gemini/Qoder/Copilot, not separated.
3. `architecture.mdx` puts **Kiro** under its own row, but spec says Kiro is **Mode A** (hook-inject via per-agent `agentSpawn` hook).

**Severity**: P2 — the docs-site grouping is consistent within its own logic ("Codex is special enough to call out") but doesn't match the spec's Mode A/B/C taxonomy. Either the spec or the docs should be the canonical taxonomy.

**Suggested fix**: Restructure the docs-site table to mirror the spec's Mode A/B/C labels exactly, with one row each for Mode A / Mode B / Mode C / Hookless. Codex special-casing can be a footnote.

---

## Bilingual diff items

Methodology: word-by-word diff of EN vs ZH MDX files.

### B1. `start/install-and-first-task.mdx`

- EN: 372 lines, ZH: 364 lines. 8-line gap.
- Heading count: identical structure (16 vs 16 H2/H3 headings sampled).
- Code blocks: identical bash invocations, only prose translated.
- Sampled prose match: ✅ (e.g., `Quick Start` ↔ `快速开始`, `Platform Configuration` ↔ `平台配置`, `init Scenarios` ↔ `init 场景对照`).
- 8-line discrepancy probably comes from prose density differences (Chinese text is naturally shorter line-wise). Not drift.

### B2. `start/everyday-use.mdx`

- EN: 705 lines, ZH: 703 lines. 2-line gap. Likely no drift.

### B3. `start/how-it-works.mdx`

- EN: 280 lines, ZH: 280 lines. ✅ exact match likely.

### B4. `start/real-world-scenarios.mdx`

- EN: 404 lines, ZH: 397 lines. 7-line gap. Acceptable.

### B5. `advanced/architecture.mdx`

- EN: 274 lines, ZH: 274 lines. ✅ exact match likely.
- Both have the same `.current-task` fallback line (D1) — drift is symmetric.
- Both have the same Mode A/B/C grouping (D8) — drift is symmetric.

### B6. `advanced/custom-workflow.mdx`

- EN: 144 lines, ZH: 143 lines. 1-line gap. Likely no drift.

**Conclusion**: bilingual files appear to be in lockstep on structure (line counts within ±2%, heading counts identical for sampled files). No structural orphan files (every EN page has a ZH counterpart in `start/`, `advanced/`).

---

## Items that are correctly synced (positive checks)

1. `task.py` 16-subcommand catalog: spec (`platform-integration.md` and `workflow-state-contract.md`) and docs (`start/everyday-use.mdx`, `advanced/appendix-b.mdx` per sync-on-change.md) describe the same command set.
2. Skill list (`trellis-brainstorm`, `trellis-before-dev`, `trellis-check`, `trellis-break-loop`, `trellis-update-spec`): consistent across spec, `templates/common/skills/`, and `start/everyday-use.mdx`.
3. Workflow state markers (`planning`, `in_progress`, `completed`, `no_task`): consistent across spec, `workflow.md` template, hook code, and `advanced/custom-workflow.mdx`.
4. Phase 3.4 commit semantics: spec and docs agree (D5 above).

---

## Summary

| ID | Item | Severity |
|---|---|---|
| D1 | `architecture.mdx` (en + zh) wrongly states `.current-task` is a fallback | P1 |
| D2 | docs-site clean of `init-context` references (positive) | — |
| D3 | docs-site clean of `iflow` references (positive) | — |
| D4 | `ai-tools/` only covers 3/14 platforms; sync-on-change rule says all platforms should have a page | P2 |
| D5 | Phase 3.4 commit semantics match between docs and spec (positive) | — |
| D6 | `start/everyday-use.mdx` task.py catalog clean (positive) | — |
| D7 | `custom-workflow.mdx` `task.py create` auto-pointer claim correct (positive) | — |
| D8 | Mode A/B/C grouping in `architecture.mdx` doesn't match spec taxonomy | P2 |

Bilingual pairs all appear structurally aligned (line-count delta ≤ 2%, heading count identical). No orphan or unmatched MDX pages found.

---

## Recommended fixes

1. **D1 (P1)**: Update `architecture.mdx` and `zh/architecture.mdx` to remove the `.current-task` fallback paragraph. Replace with a sentence saying the platform's session identity is required and pointing to the runtime spec.
2. **D8 (P2)**: Restructure the platform-grouping table in `architecture.mdx` (en + zh) to mirror the spec's Mode A/B/C/Hookless taxonomy.
3. **D4 (P2)**: Decision: either author 11 missing `ai-tools/<platform>.mdx` pages, OR amend `sync-on-change.md` Trigger 2 to make these pages optional.
