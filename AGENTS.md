<!-- CSTL:START -->
# Cursor-Trellis (cstl) Instructions

These instructions are for AI assistants working in this project.

**Thin-connect to the harness root instance (2026-08-16 决策落地)**: this repo has **no independent `.cstl/`** (its local instance was archived to `D:\MyHarness\.tmp\cstl-legacy-cursor-trellis-0.3.3`). The cstl runtime and all working knowledge live in the **harness root instance** `D:\MyHarness\.cstl`:

- `D:\MyHarness\.cstl/workflow.md` — development phases, when to create tasks, skill routing
- `D:\MyHarness\.cstl/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `D:\MyHarness\.cstl/workspace/` — per-developer journals and session traces
- `D:\MyHarness\.cstl/tasks/` — active and archived tasks (PRDs, research, jsonl context)

When a cstl command is available on Cursor (e.g. `cstl-finish-work`, `cstl-continue`), prefer it over manual steps. CLI/hook scripts run from this directory resolve to the root instance automatically (nearest-`.cstl` upward lookup). Tasks for this repo live under `D:\MyHarness\.cstl\tasks/`; mark them with `--package cursor-trellis` when creating.

## Command surface (what is user-invocable vs internal)

Only a handful of Trellis entry points are meant for **manual `/` invocation**. Everything else is an **internal auto-triggered skill** — the agent loads it via the skill matcher or workflow routing, not by being called directly. Do **not** manually invoke internal skills through the slash palette.

- **User-invocable (manual)**: `cstl-continue`, `cstl-finish-work` (and `cstl-start` when needed).
- **Internal auto-triggered (do NOT call manually)**: `cstl-brainstorm`, `cstl-before-dev`, `cstl-check`, `cstl-break-loop`, `cstl-update-spec`, `cstl-micro-grill`, `cstl-meta`, `cstl-spec-bootstrap`, `cstl-skill-creator`, `smart-search-cli`. These activate on their own when the workflow/skill matcher decides they fit.

## Goal runtime (not a task type)

**Goal** here means the **CLI subsystem** `cstl goal` (preflight → accept → run / pause / status / review), not a Task Ladder type and not Parent/Child orchestration.

- Prefer: `cstl goal status` / `cstl goal preflight …` in the project terminal.
- Do **not** invent a "goal" task kind or map "use goal" onto `add-subtask` / Parent-only planning.
- Default Cursor install has **no** `/cstl-goal` slash command (optional dogfood/extension only).
- Task directory `handoff.md` = child integration evidence; session handoff = `/cstl-handoff` (temp file).

## Invocation map (short)

| Intent | Use | Do not |
| --- | --- | --- |
| Session handoff | `/cstl-handoff` → report temp path | task `handoff.md`; ad-hoc workspace handoff |
| Goal runtime | `cstl goal status\|preflight\|run\|…` | Parent/Child as "goal"; invent goal task type |
| User slash surface | only listed `/cstl-*` commands | assume internal skills are slash commands |
| Internal skills (brainstorm, …) | workflow says load → Read documented path (see guides); not user slash | claim loaded with no file read |

Commands-only: internal skills stay **out of** the `/` palette by design; they must still be **reachable** via documented on-demand paths (not "missing from the framework").

## Internal skill reachability (on-demand)

Internal auto-triggered skills are **not** shipped to `.cursor/skills/` and have **no** default slash command. When the workflow routes to one, load its body by reading a documented path — do **not** claim it is loaded without a file read.

- PRD Grill / brainstorm discipline → **`Read .cstl/framework/prd-grill-frontier.md`** (SSOT: bundled `common/skills/brainstorm.md`).
- Full skill × load-channel matrix → **`Read .cstl/framework/internal-skills-cursor-reachability.md`**.
- Dogfood-only install surfaces (never shipped by default) → **`Read .cstl/framework/dogfood-only-surfaces.md`**.

## Web research routing (smart-search first)

For **any external / current / web fact**, run **`python ./.cstl/scripts/run_smart_search.py "<question>" --intent deep-research --json`** first. That script is the **only** Trellis web-research evidence entrypoint (it shells out to the `smart-search` CLI). Do not guess paths under package source trees or sibling repos. Platform built-in web tools (Cursor `WebSearch` / `WebFetch`, or native web tools elsewhere) are **downgrade-only fallbacks**, used solely when smart-search is unavailable (`doctor` not ok, status `not_configured` / `failed`, or search timeout). Do not reach for built-in web search while smart-search is healthy. On Cursor, `smart-search-cli` is an **internal workflow skill name** only (not shipped under `.cursor/skills/`); follow `.cstl/framework/retrieval-daily-guide.md` and `.cursor/rules/retrieval-routing.mdc` for the executable contract.

**External-knowledge gate:** If the answer would be wrong because the **world or a third-party API moved** and that matters → use smart-search (cheap `docs` / `broad-search` when enough; `deep-research` when multi-source). If truth lives only in this workspace → do not default to web. When unsure, prefer a cheap probe over guessing. See `.cstl/framework/retrieval-daily-guide.md` § External-knowledge gate.

Managed by cursor-trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `cstl update`.

<!-- CSTL:END -->

## Mindfold harness (maintainers)

The Trellis CLI source repo sits inside the **D:\MyHarness** harness: the harness root is a **local-only git repository** (git-ified 2026-08-14) holding the workspace-level `.cstl/` (tasks, spec, workflow, journals). This repo has no local `.cstl/` (archived 2026-08-16) — cstl runtime resolves to the harness root instance. Run `git`, `pnpm`, and CLI validation from **this** directory. See `D:\MyHarness\AGENTS.md` for the four-repo layout (`cursor-trellis/`, `smart-search/`, `blaze-skills/`, `cursor-byok/`).

**Git remotes (local policy):** This checkout uses **only** the `private` remote (`git@github.com:blxzer77/cursor-trellis.git`). Do **not** add or push to `origin` / `mindfold-ai/Trellis`. Use `git push` (default remote is `private`) or `git push private <branch>`. Do not run `git push origin`.

**Branch policy (mandatory):** **`main` is integration/release only — never develop on `main`.** Before any durable edit, create or checkout a short-lived branch (`feat/…`, `fix/…`, `chore/…`). Do not commit feature work directly to `main`. Harness-wide rule: `D:\MyHarness\.cursor\rules\feature-branch-policy.mdc`.

---

# Trellis — AI Agent Codebase Guide (Cursor-only fork)

> Operational guide for AI agents editing this repository.
> This fork targets **Cursor** only (`--cursor`, optional `--cursor2plus`).

## 1. What Trellis Is

Trellis is a **team AI coding harness** — it turns monolithic `AGENTS.md` / `.cursorrules` into a progressive wiki of specs, tasks, workflows, and journals that agents load only when needed.

Published as npm package `@blxzer/cursor-trellis` with core SDK `@blxzer/cursor-trellis-core`. **Init and public docs are Cursor-only**; generated output is `.cursor/` (commands, rules, agents, hooks) plus `.cstl/`.

**Key concepts delivered to user projects**:
- `.cstl/spec/` — Team coding standards
- `.cstl/tasks/` — PRDs, context, status, acceptance criteria
- `.cstl/workspace/` — Developer journals and session continuity
- `.cstl/workflow.md` — Shared lifecycle: plan, build, check, finish, learn
- Cursor adapter — Generated `.cursor/` tree

---

## 2. Monorepo Architecture

```
Trellis/
  packages/
    core/              # @blxzer/cursor-trellis-core - domain primitives
    cli/               # @blxzer/cursor-trellis - CLI tool
  drafts/
  assets/
  .cstl/            # (archived 2026-08-16 to harness .tmp; runtime = harness root instance)
  .cursor/
  package.json
  pnpm-workspace.yaml
```

**Package manager**: pnpm 10.32.1 (monorepo workspaces)
**Build order**: core MUST build before cli
**Node.js**: >= 18.17.0
**TypeScript**: ES2022 target, NodeNext module resolution, strict mode, ESM only
**Python**: >= 3.9 for hook scripts; basedpyright for type checking

### Root scripts

| Command | What it does |
|---------|-------------|
| `pnpm build` | Build core then cli (ordered) |
| `pnpm build:core` / `pnpm build:cli` | Build a single package |
| `pnpm test` | Test core then cli (ordered) |
| `pnpm test:core` / `pnpm test:cli` | Test a single package |
| `pnpm lint` | ESLint both packages |
| `pnpm typecheck` | Build core then tsc --noEmit on cli |
| `pnpm release` | Patch release of cli |
| `pnpm release:beta` / `release:rc` | Prerelease channels |
| `pnpm release:promote` | Promote prerelease to stable |
| `pnpm release:check` | Preflight version alignment checks |
| `pnpm release:plan` | Compute publish plan |

---

## 3. Core Package — `packages/core/`

**npm**: `@blxzer/cursor-trellis-core` — Zero runtime dependencies.

### Subpath exports

| Import path | Contents |
|-------------|----------|
| `@blxzer/cursor-trellis-core` | Root barrel (channel + task) |
| `@blxzer/cursor-trellis-core/channel` | Channel event log, worker lifecycle, threads, inbox |
| `@blxzer/cursor-trellis-core/task` | Task record schema, paths, phase inference |
| `@blxzer/cursor-trellis-core/testing` | Test utilities (NOT in root barrel) |

### Task API — `core/src/task/`

| Module | Purpose |
|--------|---------|
| `schema.ts` | TrellisTaskRecord type, Zod schema, field order, emptyTaskRecord() |
| `records.ts` | loadTaskRecord(), writeTaskRecord() |
| `paths.ts` | validateTaskDirName(), isValidTaskDirName() |
| `phase.ts` | inferTaskPhase() |

**Task phases**: planning -> in_progress -> verify -> complete

---

## 4. CLI Package — `packages/cli/`

**npm**: `@blxzer/cursor-trellis` — Bins: `cstl`, `smart-search`
**Dependencies**: trellis-core (workspace), chalk, commander, figlet, giget, inquirer, undici, zod

### Source layout (high level)

```
src/
  cli/index.ts                   # Commander program + update check
  commands/
    init.ts, update.ts, rollout.ts, upgrade.ts, uninstall.ts, workflow.ts
    channel/                     # Advanced multi-agent runtime (not public Cursor docs)
  configurators/
    cursor.ts, cursor2plus.ts, workflow.ts, shared.ts
  templates/
    trellis/ (scripts, workflow.md, config.yaml)
    common/ (commands, skills)
    cursor/
    shared-hooks/
    markdown/ (AGENTS.md, guides)
  migrations/manifests/
  types/ai-tools.ts              # Cursor + cursor2plus-local registry
  utils/ (template-hash, file-writer, codebase-retrieval-router, …)
```

### CLI Commands (user-facing)

| Command | Module | Key behavior |
|---------|--------|-------------|
| `cstl init` | commands/init.ts | Detect project, check Python, write Cursor templates |
| `cstl update` | commands/update.ts | Diff templates, classify changes, apply migrations |
| `cstl rollout` | commands/rollout.ts | Multi-project update with evidence |
| `cstl upgrade` | commands/upgrade.ts | npm install -g with tag resolution |
| `cstl uninstall` | commands/uninstall.ts | Scrub Trellis-managed files |
| `cstl workflow` | commands/workflow.ts | List/switch workflow.md |

**Init flags**: `--cursor`, `--cursor2plus` (with `--cursor`), `-u name`, `--capability id` (repeatable/all), `--workflow id`, `-t template`, `--monorepo/--no-monorepo`

---

## 5. Cursor Platform System

### AI_TOOLS registry — `types/ai-tools.ts`

Cursor-only fork: active platforms are **cursor** (first-class) and **cursor2plus-local** (BYOK bundle). Legacy platform IDs may remain in types for migration compatibility but are not init targets.

### Configurators — `configurators/`

- `configureCursor()` — `.cursor/` commands, rules, agents, hooks
- `configureCursor2plus()` — `.cstl/local/cursor2plus/` BYOK maps
- `configureWorkflow()` — `.cstl/` structure creation

Key helpers: `replacePythonCommandLiterals()`, `resolvePlaceholders()`.

### Template System

Templates are **TypeScript string constants** in `src/templates/`, not disk files.

**The Mirror Rule (critical)**: When modifying `.cstl/` or `.cursor/` in project root (dogfooding), MUST also update `src/templates/`. Project files are self-consumed; templates go to user projects.

### Template hash tracking — `utils/template-hash.ts`

SHA-256 in `.cstl/.template-hashes`: Unchanged (auto-update), Modified (conflict), New (safe write), Deleted (user removed).

---

## 6. Migration Engine — `migrations/`

JSON manifests in `manifests/` (v0.1.9 -> v1.0.0). Types: rename, delete, safe-file-delete, config-section-added.

API: `getMigrationsForVersion()`, `getAllMigrations()`, `hasPendingMigrations()`, `getMigrationSummary()`, `getMigrationMetadata()`, `getConfigSectionsAddedBetween()`, `clearManifestCache()`

---

## 7. Smart-Search npm Dependency

Runtime: `@blxzer/smart-search` npm package (installed as a dependency of `@blxzer/cursor-trellis`).
Bin: `smart-search` → `./bin/smart-search.js` forwards to `node_modules/@blxzer/smart-search`.
Bundled skill template: `packages/cli/src/templates/common/bundled-skills/smart-search-cli/` (synced from the smart-search repo; written to `.agents/skills/` on non-Cursor platforms only — **not** `.cursor/skills/`).
Cursor entrypoint: `./.cstl/scripts/run_smart_search.py` + `.cursor/rules/retrieval-routing.mdc` + `AGENTS.md`.

---

## 8. Build, Test & CI/CD

**Build**: core (clean+tsc), cli (clean+tsc+copy-templates).

**Test config**: core (Vitest 4.x, 10s timeout, threads), cli (Vitest 4.x, 30s timeout, forks pool, test/setup.ts, v8 coverage).

**Test categories**: Unit, Integration, Regression (`regression.test.ts`), Template (`trellis.test.ts`), Dogfood fixtures.

**CI / hooks:** No GitHub Actions or Husky hooks in this fork. Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` locally before push.

**Publish:** Manual via `pnpm release*` scripts; pushes tags to the `private` remote.

---

## 9. Key Conventions & Gotchas

### Windows compatibility (regression-tested)

- Python hooks MUST call `configure_encoding()` from `common/__init__.py`
- `sys.platform == "win32"` guards for stdout/stderr
- `reconfigure()` check before `detach()` check (beta.16 root cause)
- `python` in templates -> `python` on Windows via `replacePythonCommandLiterals()`

### Path handling

- POSIX paths in templates/hashes: `toPosix()`
- `DIR_NAMES` / `PATHS` in `constants/paths.ts` — single source for names
- Managed paths from `AI_TOOLS` via `getManagedPaths()` — never hardcode

### Session records

- 5 columns: | # | Date | Title | Commits | Branch |
- `add_session.py` uses `--branch` (not `--base-branch`)

### Sub-agent dispatch (workflow.md)

- `cstl-implement` / `cstl-check` / `cstl-research` via Cursor Task tool
- Sub-agents self-exempt from recursion
- Dispatch prompt starts with `Selected task: <path>`

### File writing

Modes: force, skip, create-new. `startRecordingWrites()`/`stopRecordingWrites()` for tracking.

---

## 10. Dogfooding

The local dogfooding instance was archived 2026-08-16 (`.cstl` → `D:\MyHarness\.tmp\cstl-legacy-cursor-trellis-0.3.3`); cstl runtime now resolves to the harness root instance. **The Mirror Rule still applies**: when modifying `.cstl/` or `.cursor/` content that ships to user projects, update `src/templates/` — mirror edits are made against the harness root instance's `.cstl/`.

---

## 11. Quick Reference

**New CLI command**: `src/commands/{name}.ts` -> register in `cli/index.ts` -> tests

**New Python script**: `src/templates/trellis/scripts/` -> export from `trellis/index.ts` -> `getAllScripts()` -> regression test

**New migration**: `src/migrations/manifests/{version}.json` -> regression test -> `check-manifest-continuity.js`

**Modify workflow.md**: Edit `src/templates/trellis/workflow.md` -> mirror `.cstl/workflow.md` -> template tests

**Modify AGENTS.md template**: Edit `src/templates/markdown/index.ts` (user projects) or root `AGENTS.md` (self). Never edit inside CSTL:START/END block.

**Sync smart-search bundled skill**: Update `smart-search/skills/smart-search-cli/` → copy into `packages/cli/src/templates/common/bundled-skills/smart-search-cli/` (does not change Cursor `.cursor/skills/` policy).

**Full quality check**: `pnpm lint && pnpm lint:py && pnpm typecheck && pnpm test && pnpm build`

---

## 12. Path Constants — `constants/paths.ts`

```
DIR_NAMES: .cstl, workspace, tasks, archive, spec, scripts
FILE_NAMES: AGENTS.md, .developer, .current-task, task.json, prd.md, workflow.md, journal-
Helpers: getWorkspaceDir(dev), getTaskDir(name), getArchiveDir()
```
