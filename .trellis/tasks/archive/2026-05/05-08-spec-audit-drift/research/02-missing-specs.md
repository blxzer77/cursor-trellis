# Research: Missing Specs (Code modules without spec coverage)

- **Query**: For each significant code module in `packages/cli/src/`, is there a dedicated spec file? Is it at least mentioned in a spec index? What's the priority?
- **Scope**: internal
- **Date**: 2026-05-08

"Mentioned" = appears as a path or filename inside any `.trellis/spec/cli/**/*.md`. "Dedicated spec" = a spec section ≥1 paragraph that describes the module's contract / behavior.

---

## `commands/` (4 files)

| Code module | Lines | Dedicated spec | Mentioned in index? | Priority |
|---|---|---|---|---|
| `commands/init.ts` | 1859 | Partial — `platform-integration.md` covers init flow + monorepo init; `directory-structure.md` covers the bootstrap/joiner task generation | ✅ in `platform-integration.md` | — |
| `commands/update.ts` | 2589 | Partial — covered indirectly via `migrations.md` (migration mechanics) and platform-integration's `configSectionsAdded` paragraph | ⚠️ Mentioned via migrations.md only | **P1** — need a `commands/update.md` spec describing the file-write loop, conflict resolution prompts (`y/n/d`), batch flags, dry-run, hash refresh |
| `commands/uninstall.ts` | 433 | **None** | ❌ Not mentioned anywhere in `.trellis/spec/cli/` | **P1** — file does substantial work (manifest scan, scrubber dispatch, `.trellis/` removal); should have a spec describing the contract: which files are deleted, hash check, scrubber selection, dry-run, idempotence |
| `commands/mem.ts` | 1506 | **None** | ❌ Zero references in spec | **P0** — 1500-line command with its own zod schemas, multi-platform session indexing (Claude/Codex/OpenCode), search / context / extract / projects subcommands, no spec at all |

### `commands/mem.ts` (P0) — what's in it that needs spec

- Subcommand surface: `list`, `search`, `context`, `extract`, `projects`
- Domain types: `SessionInfo`, `DialogueRole`, `DialogueTurn` — currently only described via Zod schemas inline
- File-system layout it reads:
  - Claude: `~/.claude/projects/<encoded-cwd>/*.jsonl`
  - Codex: `~/.codex/sessions/**/*.jsonl`
  - OpenCode: `~/.local/share/opencode/project/<id>/storage/sessions/<id>.json` + `messages/`
- Cross-platform tilde / home expansion behavior
- `--grep` filter semantics
- Output formats and stability guarantees

Without a spec, future contributors have no contract for "if I add Cursor session indexing, what's the minimum interface?" or "what happens on a malformed JSONL row?"

---

## `configurators/` (15 files + `index.ts` + `shared.ts` + `workflow.ts`)

| Configurator | Lines | Mentioned in `platform-integration.md` table | Has scenario block? | Priority |
|---|---|---|---|---|
| `claude.ts` | 96 | ✅ "Claude Code pattern" | ✅ reference platform | OK |
| `cursor.ts` | 50 | ✅ "Standard with shared hooks" | ✅ inline | OK |
| `opencode.ts` | 112 | ✅ "JS plugin pattern" | ✅ inline | OK |
| `codex.ts` | 138 | ✅ "Skills pattern" + Codex two-layer model | ✅ extensive | OK |
| `kiro.ts` | 38 | ✅ "Kiro JSON agent pattern" | ✅ inline | OK |
| `kilo.ts` | 30 | ✅ "Workflows pattern" | ✅ inline | OK |
| `gemini.ts` | 63 | ✅ "Standard with shared hooks" | ✅ inline | OK |
| `antigravity.ts` | 30 | ✅ "Workflows pattern (Antigravity)" | ✅ inline | OK |
| `qoder.ts` | 57 | ✅ "Skills pattern" + Qoder hybrid note | ✅ inline | OK |
| `codebuddy.ts` | 51 | ✅ "Standard with shared hooks" | ✅ inline | OK |
| `copilot.ts` | 83 | ✅ "Copilot pattern" | ✅ inline | OK |
| `droid.ts` | 48 | ✅ "Droid pattern" | ✅ inline | OK |
| `windsurf.ts` | 33 | ✅ "Windsurf pattern" | ✅ inline | OK |
| `pi.ts` | 93 | ✅ "TypeScript extension pattern" + extensive Pi sub-agent launcher contract | ✅ very extensive | OK |
| `index.ts` | 562 | ✅ Architecture section line 9–13 | ✅ inline | OK |
| `shared.ts` | 753 | ✅ Architecture line 13 + Mode A/B/C tables describe `resolveCommands`, `resolveSkills`, `buildPullBasedPrelude`, `injectPullBasedPreludeMarkdown`, etc. | Partial | **P2** — the file is 753 lines and grew significantly in 0.5.x. A dedicated `configurator-shared-helpers.md` could enumerate every public helper, its input contract, and which configurators use it |
| `workflow.ts` | 243 | ⚠️ Mentioned briefly in `directory-structure.md` line 37 ("Creates .trellis/ structure") | ❌ No detailed contract | **P1** — `createWorkflowStructure()` is the entry point that writes `.trellis/` skeleton (workflow.md, scripts, .gitignore, spec dirs per package). It has logic for monorepo per-package spec dirs, remote template handling, and `remoteSpecPackages` skip set. No spec. |

---

## `templates/` (top-level)

| File | Mentioned? | Priority |
|---|---|---|
| `extract.ts` | ✅ `directory-structure.md` describes `getTrellisSourcePath`, `readTrellisFile`, `copyTrellisDir` | OK |
| `template-utils.ts` | ✅ `platform-integration.md` line 14, line 57, mentions `createTemplateReader(import.meta.url)` factory | OK |
| `common/index.ts` (`getCommandTemplates`, `getSkillTemplates`, `getBundledSkillTemplates`) | Partial — `platform-integration.md` covers commands/skills via `resolveCommands` etc. | OK |
| `markdown/index.ts` | ⚠️ `directory-structure.md` mentions `markdown/spec/` and the dogfood-leak invariant | OK |

### `templates/shared-hooks/*.py`

| File | Spec coverage | Priority |
|---|---|---|
| `session-start.py` | Mentioned across `platform-integration.md`, `workflow-state-contract.md` (parser/strip invariant), and the Agent-Curated JSONL Contract section. No dedicated spec, but it's documented across three files | **P2** — could benefit from a single `session-start-hook.md` spec that enumerates all responsibilities (workflow overview injection, breadcrumb strip, JSONL READY gating, encoding fix, multi-platform `_detect_platform()`) |
| `inject-workflow-state.py` | ✅ `workflow-state-contract.md` is its dedicated spec | OK |
| `inject-subagent-context.py` | ✅ Covered by `platform-integration.md` Mode A discussion + JSONL contract | OK |
| `inject-shell-session-context.py` | ⚠️ Mentioned in `script-conventions.md` line 264 (Cursor ticket), `platform-integration.md` (Cursor `beforeShellExecution` paragraph). No dedicated description of the hook's input/output schema | **P2** — Cursor-specific, ticket-based. Should describe the ticket file format (`.trellis/.runtime/cursor-shell/*.json`), the freshness window, single-key invariant |

---

## `migrations/`

| File | Spec coverage | Priority |
|---|---|---|
| `migrations/index.ts` (TS loader) | ✅ `migrations.md` describes the system | OK |
| `migrations/manifests/*.json` (96 files) | Schema described inline in `migrations.md`. No formal JSON Schema | **P2** — a formal JSON schema (or TypeScript-derived schema doc) would let `create-manifest.js` validate structurally. Currently it only validates the `migrationGuide` requirement for breaking releases |

---

## `utils/`

| File | Spec coverage | Priority |
|---|---|---|
| `compare-versions.ts` | Mentioned in `platform-integration.md`, `directory-structure.md`. No dedicated spec, but the function's contract is "semver with prerelease" — short | OK |
| `file-writer.ts` | Mentioned only in `directory-structure.md` line 72 and in unit-test conventions ("`writeMode`" in tests). The actual `WriteMode = "ask" \| "force" \| "skip" \| "append"` contract has no spec | **P2** — write-conflict UX is a real contract; e.g. when does `--force` skip the prompt vs when does `ask` mode prompt |
| `posix.ts` | Mentioned only in `guides/cross-platform-thinking-guide.md:133`. Not in `cli/backend/` index | **P3** — single function `toPosix(p)`; mention in directory-structure or quality-guidelines is enough |
| `project-detector.ts` | ✅ `directory-structure.md` lines 256–339 cover `detectMonorepo`, `DetectedPackage`, etc. | OK |
| `proxy.ts` | ❌ Not mentioned anywhere | **P2** — proxy support has user-facing implications (`HTTPS_PROXY`, `NO_PROXY`); should at least be cross-referenced in `error-handling.md` or `cli-design-patterns` section |
| `task-json.ts` | ✅ `workflow-state-contract.md` writer table includes `emptyTaskJson`. Quality-guidelines case study line 354 mentions it | OK |
| `template-fetcher.ts` | ✅ `directory-structure.md` design decisions section describes `giget` choice + `INSTALL_PATHS` mapping. Error-handling.md Pattern 5 covers `probeRegistryIndex` | OK |
| `template-hash.ts` | ✅ `migrations.md` "模板哈希追踪" section covers it | OK |
| `uninstall-scrubbers.ts` | ❌ Not mentioned anywhere | **P1** — `commands/uninstall.ts` depends on this module's behavior (selective scrubbing of structured config files like `settings.json`, `hooks.json`, `config.toml`, `package.json`). Critical for uninstall correctness; needs a spec describing the per-format scrubber contract |

---

## `cli/index.ts`

Mentioned only as the entry point in `directory-structure.md` line 17 and `error-handling.md` (top-level catch pattern). Not described as a Commander.js wire-up reference. The four registered commands (`init`, `update`, `uninstall`, `mem`) and their flags are defined here.

**Priority: P2** — given that the spec mentions `cli_adapter.py` carefully but skips `cli/index.ts` flag declarations, a small spec section listing every flag and its intended interaction with command actions would help.

---

## `types/`

| File | Spec coverage | Priority |
|---|---|---|
| `ai-tools.ts` | ✅ `platform-integration.md` Step 1 describes `AITool` union, `CliFlag`, `TemplateDir`, `AI_TOOLS` record | OK |
| `migration.ts` | ✅ Implicitly covered by `migrations.md`. Type union (`rename` / `rename-dir` / `delete` / `safe-file-delete`) is documented | OK |

---

## Python script-side modules (`.trellis/scripts/common/*.py`)

Already covered partially in `script-conventions.md` Shared Module API Reference. Missing:

| Module | Status | Priority |
|---|---|---|
| `task_queue.py` | Listed in tree (line 31) but no API description in "Shared Module API Reference" sub-section | **P2** |
| `trellis_config.py` | NEW — not listed at all | **P1** |
| `workflow_phase.py` | NEW — referenced once in `workflow-state-contract.md:57` (strip regex consumer) but not described as a module | **P1** |
| `task_context.py` | Listed but description is stale (claims `init-context`, removed) — see `01-spec-drift.md` S1 | **P0** |

---

## Summary table

| Priority | Count | Examples |
|---|---|---|
| **P0** | 2 | `commands/mem.ts` (1506 lines, no spec); `task_context.py` description claims removed `init-context` |
| **P1** | 6 | `commands/update.ts`, `commands/uninstall.ts`, `configurators/workflow.ts`, `utils/uninstall-scrubbers.ts`, `trellis_config.py`, `workflow_phase.py` |
| **P2** | 8 | `configurators/shared.ts` (deep), `task_queue.py`, `proxy.ts`, `file-writer.ts`, manifest schema, session-start.py umbrella, inject-shell-session-context.py, cli/index.ts flag table |
| **P3** | 2 | `posix.ts`, minor coverage gaps in `markdown/index.ts` |

---

## Recommended fix batches

**Batch A (P0)**: Update existing `script-conventions.md` to drop the `init-context` mention from `task_context.py` description and add the two new modules. This is a short edit, can be done in one PR.

**Batch B (P1, command specs)**: Create `commands/update.md`, `commands/uninstall.md`, `commands/mem.md` under `.trellis/spec/cli/backend/` (or a new `commands/` sub-layer if you want to group them). Each describes the public contract, flags, exit codes, side-effects.

**Batch C (P1, util spec)**: Add `utils/uninstall-scrubbers.md` describing the per-format scrubber contract (and the JSON / TOML / package.json strategies).

**Batch D (P1, configurator helper spec)**: A short `configurator-shared-helpers.md` enumerating every export from `configurators/shared.ts` (the file is 753 lines; right now you have to read it to know what's available).

**Batch E (P2, sweep)**: Polish remaining P2 items in a separate "spec hygiene" PR.
