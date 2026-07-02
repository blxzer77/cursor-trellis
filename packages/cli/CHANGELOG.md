# Changelog

All notable changes to **@blxzer/cursor-trellis** are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
SemVer: [semver.org](https://semver.org/spec/v2.0.0.html).

> This is a **new npm product line**. Prior internal releases shipped as `@blxzer/trellis` (1.x). They remain on npm for history; use `@blxzer/cursor-trellis` for new installs.

---

## [Unreleased]

### Changed

- **docs(spec)**: mirror Native OC-06/OC-15 live evidence into spec templates — `cursor-subagent-policy.md` (Method 4 verified footnote) and `cursor-semantic-compliance.md` (Native semantic exec proof + caveat); add `cursor-semantic-compliance.md` to spec guides index.
- **feat(init/capabilities)**: selected project capabilities now land as `pending` in `.trellis/capabilities.json`, bootstrap/join tasks prompt capability verification, and `cstl capability-smoke --write-status` can promote them to `ready` / `failed` without losing stored readiness on later template refreshes.
- **fix(tasks)**: Parent `record-gate` / archive now share the same `implement.md` contract fingerprint when a Parent task carries a Development Strategy Contract (fixes `stale contract fingerprint` on `parent-integrated`).
- **docs(cursor++)**: Method 2.5 ops — document `--check-compat` after Cursor/Cursor++ upgrades; soften `WPeLc8` as a verified anchor, not a stable API; `cstl update` prints a BYOK compat reminder when `.trellis/local/cursor2plus/` exists.

## [0.3.0] - 2026-07-01

**Breaking**: rename CLI command from `trellis`/`tl` to `cstl`. The `trellis` and `tl` bin aliases are **removed**. All skill, command, agent, and rule name prefixes renamed `trellis-*` → `cstl-*` (hard cut, no compatibility aliases).

### Breaking

- **feat(cli)**: rename CLI command from `trellis`/`tl` to `cstl`. Update any aliases, CI scripts, or shell history that reference `trellis` or `tl`.
- **feat(templates)**: all skill, command, agent, and rule names renamed `trellis-*` → `cstl-*` (hard cut, no compatibility aliases):
  - `.cursor/commands/trellis-continue.md` → `cstl-continue.md`
  - `.cursor/commands/trellis-finish-work.md` → `cstl-finish-work.md`
  - `.cursor/commands/trellis-cursor2plus-setup.md` → `cstl-cursor2plus-setup.md`
  - `.cursor/rules/trellis-triage.mdc` → `cstl-triage.mdc`
  - `.cursor/rules/trellis-subagent-dispatch.mdc` → `cstl-subagent-dispatch.mdc`
  - `.cursor/agents/trellis-research.md` → `cstl-research.md`
  - `.cursor/agents/trellis-implement.md` → `cstl-implement.md`
  - `.cursor/agents/trellis-check.md` → `cstl-check.md`
  - `.cursor/skills/trellis-meta/` → `cstl-meta/` (and 4 other bundled skill dirs)
- **fix(hooks)**: `<!-- trellis-hook-injected -->` marker → `<!-- cstl-hook-injected -->`
- **fix(subagents)**: `subagent_type` identifiers `trellis-research/implement/check` → `cstl-research/implement/check` (affects Cursor++ BYOK `trellis-task-models.json5` keys)

### Changed

- `AUTO_PLANNING_REVIEWER` identifier `"trellis-cli"` → `"cstl-cli"`
- `<!-- trellis-research-end-pack -->` marker → `<!-- cstl-research-end-pack -->`
- `CURSOR_SKILL_RESIDUE_DIRS` in `update.ts` now checks both `cstl-*` (current) and `trellis-*` (legacy) skill directories for residue detection

### Migration

**Manual npm install required** — the old `trellis upgrade` command no longer exists after install.

```bash
npm install -g @blxzer/cursor-trellis@latest
cstl update --migrate
```

The `--migrate` flag is REQUIRED to trigger the file renames in your project (`trellis-*` → `cstl-*`). Renames are hash-verified; locally modified files are preserved with a warning.

New migration manifest `src/migrations/manifests/0.3.0.json` ships 13 rename entries (3 commands, 2 rules, 3 agents, 5 skill directories).

If you use Cursor++ BYOK (`.trellis/local/cursor2plus/`), the `trellis-task-models.json5` keys must be updated from `trellis-research/implement/check` to `cstl-research/implement/check`. Run the `cstl-cursor2plus-setup` skill or edit `~/.ccursor/trellis-task-models.json5` manually then re-run `patch_wpelc8.py --apply`.

The `.trellis/` directory name is UNCHANGED — only the CLI command and skill/command/agent/rule name prefixes changed.

### Notes

- npm package name `@blxzer/cursor-trellis` is unchanged.
- `trellis-task-models.json5` filename is unchanged (user data file).
- `trellis_task_models_config.py` module name is unchanged.
- `<!-- TRELLIS:START -->` / `<!-- TRELLIS:END -->` managed block markers are unchanged.

[0.3.0]: https://github.com/blxzer77/cursor-trellis/releases/tag/v0.3.0

## [0.2.9] - 2026-06-26

Adapt `@blxzer/cursor-trellis` to **@blxzer/smart-search 0.1.15** (research locale scope, dry-run/progress, structured citations, provider TTL cache). Cursor **commands-only** policy unchanged — internal `smart-search-cli` is not exposed under `.cursor/skills/`.

### Added

- `run_smart_search.py` passthrough for `--locale-scope`, `--dry-run`, and `--progress` on `--intent deep-research`
- Trellis evidence manifests preserve `outputSchemaVersion`, structured citation fields (`id`, `source_type`, `verified`, `content_len`), and `dryRun` when applicable

### Changed

- Dependency `@blxzer/smart-search` bumped to `^0.1.15`
- Bundled `smart-search-cli` skill synced from smart-search v0.1.15 (installed to `.agents/skills/` on Codex/Gemini; **not** `.cursor/skills/` on Cursor)
- `retrieval-daily-guide.md` documents smart-search 0.1.15 research flags and Cursor skill-surface policy

### Upgrade

```bash
npm install -g @blxzer/cursor-trellis@0.2.9
# In each project:
trellis update
```

[0.2.9]: https://github.com/blxzer77/cursor-trellis/releases/tag/v0.2.9

## [0.2.8] - 2026-06-26

Cursor platform adaptation Phase 0 + Phase 1+2 stabilization. Six feature commits landed since 0.2.7, all back-ported to public docs in this release.

### Added

- `trellis validate-rules` hard gate + `pnpm mirror-check` — enforce dogfood/template sync for `.cursor/rules/` and agents; `init`/`update` throw on regression via `assertCursorRulesValid()` (OC-02)
- Agent template standard sections **Entry points** + **Context source** — declare CLI Layer 2 dispatch as the primary and guaranteed context channel; `sessionStart.additional_context` / `preToolUse` hooks are best-effort only (Cursor #158452) (OC-01, OC-07)
- Cursor++ Method 2.5 safety gate — `patch_wpelc8.py` requires explicit `--approve`; `--check-compat` pre-flight; `smoke.py` health check (no secrets); `trellis init --cursor` prints a Native safe-to-ignore hint for the Cursor++ appendix (OC-05, OC-08, OC-13)
- Retrieval BYOK/Native compliance — `unknown` cursorEnv routes conservatively to BYOK + warning (no silent native); LSP overpromises softened to codegraph + Read; telemetry splits **planned** vs **executed** semantic backend (OC-03, OC-04, OC-10)
- Task path fallback — `task.py select` failure now prints a tip pointing to `generate_dispatch_prompt.py --task <path>` as the select-free dispatch path; dispatch prompt docstring marks `--task` as the primary fallback (OC-09)
- Evidence pack integration — `/trellis-finish-work` and `trellis-check` skill cite `retrieval-pack-latest.json` when present; `trellis-research` prompts include provider relevance caveats and query-refinement guidance (OC-12, OC-14)
- Automations spike decision — Cursor Automations assessed as `conditional-go`, non-defaulting; rationale recorded in `cursor-subagent-policy.md` (OC-11)

### Changed

- Agent templates (`trellis-research` / `trellis-implement` / `trellis-check`) now open with Entry points / Context source sections
- Retrieval router + agent-instruction builder: LSP / `GO_TO_DEFINITION` references replaced with codegraph + Read + caveat
- `patch_wpelc8.py` bare invocation (no subcommand) no longer implicitly writes; prints planned map and exits
- Docs synced (English + zh-CN pairs): `cursor.md`, `subagents.md`, `retrieval.md`, `task-system.md`, `README.md`

### Upgrade

```bash
npm install -g @blxzer/cursor-trellis@0.2.8
# In each project:
trellis update
```

**Behavior changes:**

- `trellis init` / `trellis update` now run `assertCursorRulesValid()` — a regression in the rules manifest aborts the operation. Run `trellis validate-rules` to re-check after hand-editing `.cursor/rules/`.
- Cursor++ operators: `python patch_wpelc8.py` without `--approve` no longer patches. Add `--approve` to apply.
- Retrieval: when `cursorEnv` is `unknown`, the router now warns and routes to BYOK behavior instead of silently using native `@codebase`.

[0.2.8]: https://github.com/blxzer77/cursor-trellis/releases/tag/v0.2.8

## [0.2.7] - 2026-06-25

Aligned **@blxzer/cursor-trellis** and **@blxzer/cursor-trellis-core** at `0.2.7`.

### Added

- `task.py suggest-execution-strategy` — deterministic `execution_mode` / `isolation` suggestions from `.trellis/config/execution-strategy-rules.json`
- `common/execution_strategy.py`, drift **WARN** on `start-execution --check` when contract differs from suggestion (advisory only)
- Spec guide `execution-strategy.md`; `brainstorm.md` step before freezing Development Strategy Contract
- Vitest: `execution-strategy.integration.test.ts`
- Backfilled migration manifests `0.2.2`–`0.2.6` for npm / `trellis update` continuity

### Changed

- `workflow.md` Phase 2.1 / 2.2 and `[workflow-state:in_progress]`: dispatch `trellis-implement` / `trellis-check` only when contract `execution_mode: worker` (not unconditional spawn)
- `trellis init` / `trellis update` ship `execution-strategy-rules.json` and `execution_strategy.py`
- `docs/task-system.md` (+ zh-CN): planning suggest + drift WARN

### Upgrade

```bash
npm install -g @blxzer/cursor-trellis@0.2.7
# In each project:
trellis update
```

**Behavior change:** Full tasks that touch code are **suggested** as `worker` + `main-worktree`; approved `implement.md` contract still authoritative. Run `task.py suggest-execution-strategy <task>` during planning.

[0.2.7]: https://github.com/blxzer77/cursor-trellis/releases/tag/v0.2.7

## [0.1.4] - 2026-06-24

Aligned **@blxzer/cursor-trellis** and **@blxzer/cursor-trellis-core** at `0.1.4` (fixes core/cli version drift since the in-repo `0.1.3` bump).

### Added

- Gate verify transition contract: stricter Parent archive, Full Child accept, `record-gate` placeholder rejection, integrate-through guards (7 CLI integration tests).
- `cursor-context-injection-guide.md` included in default `trellis init` spec guides.

### Changed

- `trellis init` writes `.trellis/scripts/` from `getAllScripts()` only (same source as `trellis update`) — maintainer probe/eval scripts no longer copied into user projects.
- User-facing spec guides and `workflow.md` cleaned of Trellis maintainer / harness paths; default workflow no longer documents npm release execution.
- Removed shipped `aggregate_retrieval_telemetry.py` and `batch_plan_envelope.py` (maintainer eval tooling).

### Upgrade

```bash
npm install -g @blxzer/cursor-trellis@0.1.4
# In each project:
trellis update
```

**Behavior change:** archive and gate checks may fail where placeholder evidence or incomplete Parent/Child handoff previously passed. Review `verify.md` and run `task.py archive <task> --check` after upgrade.

[0.1.4]: https://github.com/blxzer77/cursor-trellis/releases/tag/v0.1.4

## [0.1.3] - 2026-06-23

In-repo bump only (never published as an aligned core/cli pair). Included here for continuity.

### Added

- Cursor BYOK/native semantic routing, Experiment D retrieval probes, adapter metadata.
- Hook health fixes for Native Cursor and Cursor++ BYOK paths.

### Changed

- Smart-search wrapper status detection and timeout handling; clearer npm CLI resolver paths.

## [0.1.2] - 2026-06-22

### Added

- `task.py generate-dispatch-prompt` (Layer 2 subagent context assembly before `Task(...)`).
- Shared `common/subagent_dispatch.py` builder; slim `preToolUse` hook wrapper.

[0.1.2]: https://github.com/blxzer77/cursor-trellis/releases/tag/v0.1.2

## [0.1.1] - 2026-06-21

### Changed

- Cursor-only product trim: platform registry, init/update/uninstall, and retrieval router reduced to Cursor.
- Workflow, AGENTS, README, and guides aligned to Cursor-only surface.

[0.1.1]: https://github.com/blxzer77/cursor-trellis/releases/tag/v0.1.1

## [0.1.0] - 2026-06-20

First public release under `@blxzer/cursor-trellis` / `@blxzer/cursor-trellis-core`.

### Added

- Public GitHub repo: [blxzer77/cursor-trellis](https://github.com/blxzer77/cursor-trellis).
- Router v2 codebase retrieval (platform-adaptive routing, codegraph structural-first, token economy).
- Cursor `.cursor/rules/trellis-triage.mdc` (Request Triage hard gate via rules channel).
- Cursor commands-only default policy + `trellis-cursor2plus-setup` command.
- `release:publish` script (publishes core then cli in dependency order).
- Fresh migration manifest line starting at `0.1.0` (legacy `@blxzer/trellis` manifests archived in-repo).

### Changed

- Package rename from `@blxzer/trellis` → `@blxzer/cursor-trellis` (and matching `-core` SDK).
- `trellis update` non-interactive contexts fail fast instead of hanging on prompts.

### Install

```bash
npm install -g @blxzer/cursor-trellis
```

### Migrating from `@blxzer/trellis`

```bash
npm uninstall -g @blxzer/trellis
npm install -g @blxzer/cursor-trellis
# In each project:
trellis update
```

[0.1.0]: https://github.com/blxzer77/cursor-trellis/releases/tag/v0.1.0
