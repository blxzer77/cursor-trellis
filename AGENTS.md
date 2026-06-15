<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->

## Mindfold harness (maintainers)

The Trellis CLI source repo often sits inside the **D:\MyHarness** harness: the harness root holds workspace-level `.trellis/` (tasks, spec, workflow) and is **not** a git repository. Run `git`, `pnpm`, and CLI validation from **this** directory (`Trellis/`). See `D:\MyHarness\AGENTS.md` for the three-repo layout (`Trellis/`, `smartsearch-private/`, `riverfjs-skills/`).

---

# Trellis — AI Agent Codebase Guide

> This document gives AI agents deep operational understanding of the Trellis codebase.
> Read this before making any code changes. It covers architecture, data flow, conventions,
> and the gotchas that regression tests enforce.

## 1. What Trellis Is

Trellis is a **team AI coding harness** — it turns the monolithic `CLAUDE.md` / `AGENTS.md` / `.cursorrules` pattern into a progressive wiki of specs, tasks, workflows, and journals that agents load only when needed.

Published as npm package `@blxzer/trellis` with a core SDK at `@blxzer/trellis-core`. It generates platform-specific configuration for **14 AI coding platforms**: Claude Code, Cursor, Codex, OpenCode, Kilo, Kiro, Gemini CLI, Antigravity, Windsurf, Qoder, CodeBuddy, GitHub Copilot, Factory Droid, and Pi Agent.

**Key concepts delivered to user projects**:
- `.trellis/spec/` — Team coding standards agents load automatically
- `.trellis/tasks/` — PRDs, context, status, acceptance criteria
- `.trellis/workspace/` — Developer journals and session continuity
- `.trellis/workflow.md` — Shared lifecycle: plan, build, check, finish, learn
- Platform adapters — Generated commands, hooks, skills, and agent files per platform

---

## 2. Monorepo Architecture

```
Trellis/
  packages/
    core/              # @blxzer/trellis-core (v1.0.0) - domain primitives
    cli/               # @blxzer/trellis (v1.0.0) - CLI tool
  marketplace/         # Workflow template variants (native, tdd, etc.)
  docs-site/           # Documentation site source
  drafts/              # Draft documents
  assets/              # Logo, demo gifs
  .github/workflows/   # CI (ci.yml) + Publish (publish.yml)
  .husky/              # pre-commit -> pnpm lint-staged
  .trellis/            # Self-dogfooding Trellis workspace
  .claude/ .cursor/ .codex/ .gemini/ .opencode/ .pi/
  package.json         # Root workspace
  pnpm-workspace.yaml  # packages/*
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

**npm**: `@blxzer/trellis-core` — Zero runtime dependencies.

### Subpath exports

| Import path | Contents |
|-------------|----------|
| `@blxzer/trellis-core` | Root barrel (channel + task) |
| `@blxzer/trellis-core/channel` | Channel event log, worker lifecycle, threads, inbox |
| `@blxzer/trellis-core/mem` | Session search, dialogue extraction |
| `@blxzer/trellis-core/task` | Task record schema, paths, phase inference |
| `@blxzer/trellis-core/testing` | Test utilities (NOT in root barrel) |

### 3.1 Channel API — `core/src/channel/`

Multi-agent event log for coordinating AI workers.

**Layers**: `channel/index.ts` (barrel), `channel/api/` (high-level: create, send, inbox, postThread, context, title, read, watch, watchChannels, workers, spawn, interrupt, runtime, resolve, types), `channel/internal/store/` (low-level: schema, events, paths, lock, seq, inbox, filter, delivery, channel-metadata, thread-state, worker-state, watch)

**Key APIs**: `createChannel()`, `sendMessage()`, `readWorkerInbox()`, `watchWorkerInbox()`, `postThread()`, `addChannelContext()`, `readChannelEvents()`, `watchChannelEvents()`, `listWorkers()`, `spawnWorker()`, `interruptWorker()`

**Event kinds**: create, message, thread, context, metadata, spawned, killed, done, error, progress, undeliverable, interrupt_requested, turn_started, turn_finished, interrupted, supervisor_warning

**Worker lifecycle**: spawning -> running -> done / killed / error

**Key types**: ChannelScope (project|global), ChannelType (chat|forum), InboxPolicy (explicitOnly|broadcastAndExplicit), DeliveryMode (appendOnly|requireKnownWorker|requireRunningWorker)

### 3.2 Task API — `core/src/task/`

| Module | Purpose |
|--------|---------|
| `schema.ts` | TrellisTaskRecord type, Zod schema, field order, emptyTaskRecord() |
| `records.ts` | loadTaskRecord(), writeTaskRecord() |
| `paths.ts` | validateTaskDirName(), isValidTaskDirName() |
| `phase.ts` | inferTaskPhase() |

**Task phases**: planning -> in_progress -> verify -> complete

### 3.3 Mem API — `core/src/mem/`

| Module | Purpose |
|--------|---------|
| `sessions.ts` | listMemSessions(), searchMemSessions(), extractMemDialogue() |
| `context.ts` | readMemContext() |
| `projects.ts` | listMemProjects() |
| `filter.ts` | Session filtering |
| `dialogue.ts` | Turn extraction |
| `phase.ts` | Phase inference |
| `search.ts` | Text search |
| `types.ts` | All types |
| `adapters/` | Platform session parsers (Claude, Codex, OpenCode) |

**Critical**: NOT in root barrel. Import: `import { searchMemSessions } from "@blxzer/trellis-core/mem"`

---

## 4. CLI Package — `packages/cli/`

**npm**: `@blxzer/trellis` — Bins: `trellis`, `tl`, `smart-search`
**Dependencies**: trellis-core (workspace), chalk, commander, figlet, giget, inquirer, undici, zod

### Source layout

```
src/
  index.ts                       # Library barrel (VERSION + init)
  cli/index.ts                   # Commander program + update check
  commands/
    init.ts                      # trellis init
    update.ts                    # trellis update (diff-based sync)
    rollout.ts                   # trellis rollout (multi-project)
    upgrade.ts                   # trellis upgrade (npm -g)
    uninstall.ts                 # trellis uninstall
    mem.ts                       # trellis mem (search/recall)
    workflow.ts                  # trellis workflow (list/switch)
    channel/                     # Multi-agent runtime
      index.ts, adapters/, store/, supervisor/
      supervisor.ts, spawn.ts, run.ts, send.ts, wait.ts, interrupt.ts, ...
  configurators/                 # Platform init/update logic
    index.ts                     # PLATFORM_FUNCTIONS registry
    shared.ts                    # Cross-platform utilities
    claude.ts, cursor.ts, codex.ts, copilot.ts, gemini.ts, ...
    workflow.ts                  # .trellis/ structure creation
  templates/                     # Template content as TS modules
    trellis/ (scripts, workflow.md, config.yaml)
    common/ (commands, skills)
    claude/ codex/ copilot/ cursor/ gemini/ ... (per-platform)
    shared-hooks/                # Cross-platform Python hooks
    markdown/                    # AGENTS.md, guides
  migrations/
    index.ts                     # Migration engine
    manifests/                   # 60+ version JSON manifests
  constants/
    paths.ts                     # DIR_NAMES, FILE_NAMES, PATHS
    version.ts                   # VERSION, PACKAGE_NAME
  types/
    ai-tools.ts                  # AI_TOOLS registry (14 platforms)
    migration.ts                 # Migration types
  utils/
    compare-versions.ts, file-writer.ts, template-hash.ts
    template-fetcher.ts, project-detector.ts, project-capabilities.ts
    readiness.ts, workflow-resolver.ts, proxy.ts, cwd-guard.ts
    posix.ts, task-json.ts, update-rollout-report.ts
    manifest-prune.ts, post-update-smoke.ts, uninstall-scrubbers.ts
    codebase-retrieval-router.ts
```

### CLI Commands

| Command | Module | Key behavior |
|---------|--------|-------------|
| `trellis init` | commands/init.ts | Detect project, check Python, select platforms, write templates |
| `trellis update` | commands/update.ts | Diff templates, classify changes, apply migrations |
| `trellis rollout` | commands/rollout.ts | Multi-project update with evidence |
| `trellis upgrade` | commands/upgrade.ts | npm install -g with tag resolution |
| `trellis uninstall` | commands/uninstall.ts | Scrub all Trellis files |
| `trellis mem` | commands/mem.ts | Search/recall conversation history |
| `trellis workflow` | commands/workflow.ts | List/switch workflow.md |
| `trellis channel` | commands/channel/ | Multi-agent runtime |

**Init flags**: --cursor, --claude, --opencode, --codex, --kilo, --kiro, --gemini, --antigravity, --windsurf, --qoder, --codebuddy, --copilot, --droid, --pi
**Other**: -u name, --capability id (repeatable/all), --workflow id, -t template, --monorepo/--no-monorepo

---

## 5. Platform System

### 5.1 AI_TOOLS Registry — `types/ai-tools.ts`

Single source of truth for all 14 platforms. Each entry has: name, tier (first-class|legacy), templateDirs, configDir, cliFlag, agentCapable, hasHooks, templateContext (cmdRefPrefix, executorAI, userActionLabel).

| Platform | Tier | Config dir | Agent capable |
|----------|------|-----------|---------------|
| claude-code | first-class | .claude | yes |
| cursor | first-class | .cursor | yes |
| codex | first-class | .codex | yes |
| opencode | legacy | .opencode | yes |
| kilo | legacy | .kilocode | no |
| kiro | legacy | .kiro/skills | yes |
| gemini | legacy | .gemini | yes |
| antigravity | legacy | .agent/workflows | no |
| windsurf | legacy | .windsurf/workflows | no |
| qoder | legacy | .qoder | yes |
| codebuddy | legacy | .codebuddy | yes |
| copilot | legacy | .github/copilot | yes |
| droid | legacy | .factory | yes |
| pi | legacy | .pi | yes |

**cmdRefPrefix**: `/trellis:` (Claude, Gemini, CodeBuddy), `/trellis-` (Cursor, Windsurf, Droid, Pi), `\$` (Codex, Kiro, Qoder), `/` (Antigravity, Copilot)

### 5.2 Adding a new platform — checklist

1. Add to AI_TOOLS in types/ai-tools.ts
2. Create src/configurators/{platform}.ts with configure function
3. Create src/templates/{platform}/ with content
4. Register in configurators/index.ts PLATFORM_FUNCTIONS
5. Add CLI flag in cli/index.ts
6. Add to InitOptions in commands/init.ts
7. Add regression tests

### 5.3 Configurators — `configurators/`

Each configure{Platform}(cwd): creates config dir, writes commands/skills/hooks/agents/settings.
PLATFORM_FUNCTIONS maps to configure (init) + collectTemplates (update diff).
Key helpers: replacePythonCommandLiterals(), resolvePlaceholders().

### 5.4 Template System

Templates are **TypeScript string constants** in src/templates/, not disk files.

**The Mirror Rule (critical)**: When modifying .claude/, .trellis/, or .cursor/ in project root (dogfooding), MUST also update src/templates/. Project files are self-consumed; templates go to user projects.

### 5.5 Template hash tracking — `utils/template-hash.ts`

SHA-256 in .trellis/.template-hashes: Unchanged (auto-update), Modified (conflict), New (safe write), Deleted (user removed).

---

## 6. Channel Subsystem — `commands/channel/`

Multi-agent runtime: Main Agent <-> Channel (event log) <-> Workers (claude/codex). Supervisor manages worker lifecycle.

**Adapters** (adapters/): index.ts (REGISTRY, getAdapter, listProviders), claude.ts (stream-json, no handshake), codex.ts (JSON-RPC 2.0, initialize+thread/start handshake), types.ts

**Supervisor** (supervisor/): supervisor.ts (3 loops: stdout pump, inbox watcher, signal handler), stdout.ts, inbox.ts, shutdown.ts (SIGTERM->3s->SIGTERM->3s->SIGKILL), idle.ts (OOM guard), turns.ts (TurnTracker), warning.ts

**Store** (store/): events.ts (JSONL), paths.ts, schema.ts, lock.ts, thread-state.ts, filter.ts, watch.ts

**Commands**: spawn, run, send, wait, interrupt, create, list, rm, kill, context, threads, title, messages, guard, agent-loader, context-loader, text-body

**Adding a new worker provider**: Create adapters/<name>.ts implementing WorkerAdapter interface, add to REGISTRY in adapters/index.ts. Done.

---

## 7. Migration Engine — `migrations/`

60+ JSON manifests in manifests/ (v0.1.9 -> v1.0.0). Types: rename, delete, safe-file-delete, config-section-added.

API: getMigrationsForVersion(), getAllMigrations(), hasPendingMigrations(), getMigrationSummary(), getMigrationMetadata(), getConfigSectionsAddedBetween(), clearManifestCache()

---

## 8. Smart-Search Vendor Integration

Source: D:\MyHarness\smartsearch-private\. Vendor: packages/cli/vendor/smart-search/.
Sync: scripts/sync-smart-search-vendor.js. Check: scripts/check-smart-search-vendor.js.
Bin: smart-search -> ./bin/smart-search.js. postinstall: scripts/postinstall.js.
files array in package.json explicitly lists every vendored file.
Workflow: update source -> pnpm sync:smart-search -> pnpm check:smart-search

---

## 9. Build, Test & CI/CD

**Build**: core (clean+tsc), cli (clean+tsc+copy-templates). copy-templates.js copies non-TS assets.

**Test config**: core (Vitest 4.x, 10s timeout, threads), cli (Vitest 4.x, 30s timeout, forks pool, test/setup.ts, v8 coverage).

**Test categories**: Unit (commands, utils, core), Integration (spawn real processes), Regression (100+ cases in regression.test.ts), Template (trellis.test.ts), Dogfood fixtures.

**Test files**: cli/test/ (setup.ts, regression.test.ts, commands/, templates/, scripts/, utils/, runtime/, fixtures/), core/test/ (channel/ 8 files, mem/ 5 files, task/ 4 files).

**CI** (.github/workflows/ci.yml): push/PR to main -> checkout -> Node 20 + pnpm -> install -> typecheck -> lint -> test -> build -> verify output.

**Publish** (.github/workflows/publish.yml): Release/tag -> version check -> typecheck -> test -> build -> verify pack -> plan -> publish core+cli -> verify npm.

**Pre-commit**: Husky + lint-staged (eslint --fix + prettier --write).

---

## 10. Release Process

| Command | Type |
|---------|------|
| pnpm release | patch |
| pnpm release:minor | minor |
| pnpm release:major | major |
| pnpm release:beta | beta |
| pnpm release:rc | rc |
| pnpm release:promote | promote |

Scripts: release.js, release-preflight.js (check-versions, publish-plan, verify-packed-cli, verify-npm), bump-versions.js, check-cli-pack-files.js, check-release-pack-contents.js, check-smart-search-vendor.js, check-manifest-continuity.js, check-docs-changelog.js.

**Version rule**: Core and CLI MUST match. CLI pins core to exact version.

---

## 11. Key Conventions & Gotchas

### Windows compatibility (regression-tested)

- Python hooks MUST call configure_encoding() from common/__init__.py
- sys.platform == "win32" guards for stdout/stderr
- reconfigure() check before detach() check (beta.16 root cause)
- python3 in templates -> python on Windows via replacePythonCommandLiterals()

### Path handling

- POSIX paths in templates/hashes: toPosix()
- DIR_NAMES / PATHS in constants/paths.ts — single source for names
- Managed paths from AI_TOOLS via getManagedPaths() — never hardcode

### Session records

- 5 columns: | # | Date | Title | Commits | Branch |
- add_session.py uses --branch (not --base-branch)
- Regex separator detection, not startswith("|---")

### Sub-agent dispatch (workflow.md)

- in_progress breadcrumb has class-2 dispatch protocol
- Sub-agents self-exempt from recursion (issue-237)
- Prompt recursion guards in Phase 2

### File writing

Modes: force, skip, create-new. startRecordingWrites()/stopRecordingWrites() for tracking.

---

## 12. Testing Patterns

**Regression** (test/regression.test.ts): Version-referenced bug prevention across 7 categories (Windows/encoding, paths, semver/migration, template integrity, platform registry, session branch context, sub-agent dispatch).

**Template** (test/templates/trellis.test.ts): Constants contain expected patterns.

**Integration** (test/scripts/*.integration.test.ts): End-to-end retrieval pipeline.

```bash
pnpm test              # All
pnpm test:core         # Core only
pnpm test:cli          # CLI only
pnpm test:coverage     # v8 coverage
```

---

## 13. Dogfooding

.trellis/ in project root. Changes MUST mirror to src/templates/. marketplace/workflows/native/workflow.md must match bundled template (test-enforced).

---

## 14. Quick Reference

**New CLI command**: src/commands/{name}.ts -> register in cli/index.ts -> tests

**New Python script**: src/templates/trellis/scripts/ -> export from trellis/index.ts -> getAllScripts() -> regression test

**New migration**: src/migrations/manifests/{version}.json -> regression test -> check-manifest-continuity.js

**Modify workflow.md**: Edit src/templates/trellis/workflow.md -> mirror .trellis/workflow.md -> mirror marketplace/workflows/native/workflow.md -> template tests

**Modify AGENTS.md template**: Edit src/templates/markdown/index.ts (user projects) or root AGENTS.md (self). Never edit inside TRELLIS:START/END block.

**Sync smart-search**: Update smartsearch-private -> pnpm sync:smart-search -> pnpm check:smart-search

**Full quality check**: pnpm lint && pnpm lint:py && pnpm typecheck && pnpm test && pnpm build

---

## 15. Path Constants — `constants/paths.ts`

```
DIR_NAMES: .trellis, workspace, tasks, archive, spec, scripts
FILE_NAMES: AGENTS.md, .developer, .current-task, task.json, prd.md, workflow.md, journal-
Helpers: getWorkspaceDir(dev), getTaskDir(name), getArchiveDir()
```
