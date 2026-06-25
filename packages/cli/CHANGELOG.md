# Changelog

All notable changes to **@blxzer/cursor-trellis** are documented in this file.

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).  
SemVer: [semver.org](https://semver.org/spec/v2.0.0.html).

> This is a **new npm product line**. Prior internal releases shipped as `@blxzer/trellis` (1.x). They remain on npm for history; use `@blxzer/cursor-trellis` for new installs.

---

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
