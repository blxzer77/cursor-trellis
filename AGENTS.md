<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

## Codebase retrieval fallback

When you need a retrieval plan for a codebase question and no plan block was auto-injected, generate one manually:

```powershell
python ./.trellis/scripts/route_codebase_retrieval.py "<question>" --instructions
```

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

## Mindfold harness (maintainers)

The Trellis CLI source repo often sits inside the **D:\MyHarness** harness: the harness root holds workspace-level `.trellis/` (tasks, spec, workflow) and is **not** a git repository. Run `git`, `pnpm`, and CLI validation from **this** directory (`Trellis/`). See `D:\MyHarness\AGENTS.md` for the three-repo layout (`Trellis/`, `smartsearch-private/`, `riverfjs-skills/`).

**Git remotes (local policy):** This checkout uses **only** the `private` remote (`git@github.com:blxzer77/cursor-trellis.git`). Do **not** add or push to `origin` / `mindfold-ai/Trellis`. Use `git push` (default remote is `private`) or `git push private <branch>`. Do not run `git push origin`.

**Branch policy:** Default development branch is **`main`**. Use short-lived feature branches (`feat/…`, `fix/…`) merged back to `main`; avoid long-lived personal version branches unless cutting a release tag.

---

# Trellis — AI Agent Codebase Guide (Cursor-only fork)

> Operational guide for AI agents editing this repository.
> This fork targets **Cursor** only (`--cursor`, optional `--cursor2plus`).

## 1. What Trellis Is

Trellis is a **team AI coding harness** — it turns monolithic `AGENTS.md` / `.cursorrules` into a progressive wiki of specs, tasks, workflows, and journals that agents load only when needed.

Published as npm package `@blxzer/cursor-trellis` with core SDK `@blxzer/cursor-trellis-core`. **Init and public docs are Cursor-only**; generated output is `.cursor/` (commands, rules, agents, hooks) plus `.trellis/`.

**Key concepts delivered to user projects**:
- `.trellis/spec/` — Team coding standards
- `.trellis/tasks/` — PRDs, context, status, acceptance criteria
- `.trellis/workspace/` — Developer journals and session continuity
- `.trellis/workflow.md` — Shared lifecycle: plan, build, check, finish, learn
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
  .trellis/            # Self-dogfooding Trellis workspace
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

**npm**: `@blxzer/cursor-trellis` — Bins: `trellis`, `tl`, `smart-search`
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
| `trellis init` | commands/init.ts | Detect project, check Python, write Cursor templates |
| `trellis update` | commands/update.ts | Diff templates, classify changes, apply migrations |
| `trellis rollout` | commands/rollout.ts | Multi-project update with evidence |
| `trellis upgrade` | commands/upgrade.ts | npm install -g with tag resolution |
| `trellis uninstall` | commands/uninstall.ts | Scrub Trellis-managed files |
| `trellis workflow` | commands/workflow.ts | List/switch workflow.md |

**Init flags**: `--cursor`, `--cursor2plus` (with `--cursor`), `-u name`, `--capability id` (repeatable/all), `--workflow id`, `-t template`, `--monorepo/--no-monorepo`

---

## 5. Cursor Platform System

### AI_TOOLS registry — `types/ai-tools.ts`

Cursor-only fork: active platforms are **cursor** (first-class) and **cursor2plus-local** (BYOK bundle). Legacy platform IDs may remain in types for migration compatibility but are not init targets.

### Configurators — `configurators/`

- `configureCursor()` — `.cursor/` commands, rules, agents, hooks
- `configureCursor2plus()` — `.trellis/local/cursor2plus/` BYOK maps
- `configureWorkflow()` — `.trellis/` structure creation

Key helpers: `replacePythonCommandLiterals()`, `resolvePlaceholders()`.

### Template System

Templates are **TypeScript string constants** in `src/templates/`, not disk files.

**The Mirror Rule (critical)**: When modifying `.trellis/` or `.cursor/` in project root (dogfooding), MUST also update `src/templates/`. Project files are self-consumed; templates go to user projects.

### Template hash tracking — `utils/template-hash.ts`

SHA-256 in `.trellis/.template-hashes`: Unchanged (auto-update), Modified (conflict), New (safe write), Deleted (user removed).

---

## 6. Migration Engine — `migrations/`

JSON manifests in `manifests/` (v0.1.9 -> v1.0.0). Types: rename, delete, safe-file-delete, config-section-added.

API: `getMigrationsForVersion()`, `getAllMigrations()`, `hasPendingMigrations()`, `getMigrationSummary()`, `getMigrationMetadata()`, `getConfigSectionsAddedBetween()`, `clearManifestCache()`

---

## 7. Smart-Search Vendor Integration

Source: `D:\MyHarness\smartsearch-private\`. Vendor: `packages/cli/vendor/smart-search/`.
Sync: `scripts/sync-smart-search-vendor.js`. Check: `scripts/check-smart-search-vendor.js`.
Bin: `smart-search` -> `./bin/smart-search.js`. postinstall: `scripts/postinstall.js`.

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
- `python3` in templates -> `python` on Windows via `replacePythonCommandLiterals()`

### Path handling

- POSIX paths in templates/hashes: `toPosix()`
- `DIR_NAMES` / `PATHS` in `constants/paths.ts` — single source for names
- Managed paths from `AI_TOOLS` via `getManagedPaths()` — never hardcode

### Session records

- 5 columns: | # | Date | Title | Commits | Branch |
- `add_session.py` uses `--branch` (not `--base-branch`)

### Sub-agent dispatch (workflow.md)

- `trellis-implement` / `trellis-check` / `trellis-research` via Cursor Task tool
- Sub-agents self-exempt from recursion
- Dispatch prompt starts with `Selected task: <path>`

### File writing

Modes: force, skip, create-new. `startRecordingWrites()`/`stopRecordingWrites()` for tracking.

---

## 10. Dogfooding

`.trellis/` in project root. Changes MUST mirror to `src/templates/`.

---

## 11. Quick Reference

**New CLI command**: `src/commands/{name}.ts` -> register in `cli/index.ts` -> tests

**New Python script**: `src/templates/trellis/scripts/` -> export from `trellis/index.ts` -> `getAllScripts()` -> regression test

**New migration**: `src/migrations/manifests/{version}.json` -> regression test -> `check-manifest-continuity.js`

**Modify workflow.md**: Edit `src/templates/trellis/workflow.md` -> mirror `.trellis/workflow.md` -> template tests

**Modify AGENTS.md template**: Edit `src/templates/markdown/index.ts` (user projects) or root `AGENTS.md` (self). Never edit inside TRELLIS:START/END block.

**Sync smart-search**: Update smartsearch-private -> `pnpm sync:smart-search` -> `pnpm check:smart-search`

**Full quality check**: `pnpm lint && pnpm lint:py && pnpm typecheck && pnpm test && pnpm build`

---

## 12. Path Constants — `constants/paths.ts`

```
DIR_NAMES: .trellis, workspace, tasks, archive, spec, scripts
FILE_NAMES: AGENTS.md, .developer, .current-task, task.json, prd.md, workflow.md, journal-
Helpers: getWorkspaceDir(dev), getTaskDir(name), getArchiveDir()
```
