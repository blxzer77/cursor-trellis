# Cursor integration

English | [简体中文](cursor.zh-CN.md)

Trellis treats **Cursor** as a first-class platform. After you run `trellis init --cursor`, the CLI writes a managed `.cursor/` tree plus the shared `.trellis/` workspace. This document explains what gets generated, how context reaches the agent, how retrieval plans are injected, and how the two Cursor environments (Native API vs Cursor++ BYOK) differ for subagent dispatch.

## What `trellis init --cursor` does

From your **project root** (the repo you are developing, not the Trellis source repo):

```bash
npm install -g @blxzer/cursor-trellis
cd /path/to/your-project
trellis init --cursor
```

`init` also creates or updates:

- `.trellis/` — workflow, spec, tasks, workspace, scripts
- `AGENTS.md` — high-level agent instructions (Trellis-managed block)
- Platform files under `.cursor/` (see below)

Use `-y` to accept defaults, `-f` to overwrite, or `-s` to skip existing files. See [CLI README](../packages/cli/README.md) for the full flag list.

### Commands-only policy on Cursor

On Cursor, Trellis uses a **commands-only** default:

| Surface | On Cursor after init |
| --- | --- |
| `.cursor/commands/` | User-facing slash commands (`/trellis-continue`, `/trellis-finish-work`, optional Cursor++ setup) |
| `.cursor/rules/*.mdc` | Always-on or glob-scoped rules (e.g. Request Triage hard gate, retrieval routing) |
| `.cursor/agents/` | Sub-agent definitions (`trellis-research`, `trellis-implement`, `trellis-check`, …) |
| `.cursor/hooks/` + `hooks.json` | Python hook scripts and wiring |
| `.cursor/worktrees.json` | Cursor native worktree helper config |
| `.cursor/skills/` | **Not** populated by default — internal workflow skills stay off the palette |

**Rationale.** Keep the `/` palette small and reliable. Workflow semantics reach the agent through **rules** and **AGENTS.md** / `.trellis/workflow.md`, not through a large skills tree on Cursor. Other platforms (Claude Code, Codex, …) may ship skills under their own config dirs; that is intentional and documented only in the appendix below.

## Generated layout

```text
your-project/
  .trellis/
    workflow.md          # Shared lifecycle (plan, execute, finish, triage)
    spec/                # Coding guidelines by layer
    tasks/               # PRDs, design, implement, verify
    workspace/           # Journals and session traces
    scripts/             # task.py, get_context.py, hooks helpers, retrieval router
  AGENTS.md              # Entry instructions for agents
  .cursor/
    commands/
      trellis-continue.md
      trellis-finish-work.md
      trellis-cursor2plus-setup.md   # Cursor-only (BYOK routing)
    rules/
      trellis-triage.mdc             # alwaysApply: true
      retrieval-routing.mdc          # alwaysApply: true
    agents/
      trellis-research.md
      trellis-implement.md
      trellis-check.md
    hooks/
      *.py                           # sessionStart, preToolUse, beforeSubmitPrompt, shell, stop, …
    hooks.json
    worktrees.json
```

Implementation reference: `packages/cli/src/configurators/cursor.ts` and `packages/cli/src/templates/cursor/`.

## Rules

Cursor **User Rules** and project **`.cursor/rules`** are the reliable channel for always-on policy on Cursor. Trellis ships two always-on rules:

- `trellis-triage.mdc` (`alwaysApply: true`) — enforces **Request Triage** before durable work.
- `retrieval-routing.mdc` (`alwaysApply: true`) — enforces [retrieval layer](retrieval.md) routing for codebase questions.

This compensates for a known Cursor limitation: `sessionStart` hook `additional_context` may not reach the agent (#158452). Triage and retrieval policy therefore must not depend only on hook-injected workflow text.

For day-to-day edits, treat `.trellis/workflow.md` as the canonical workflow spec; rules summarize the hard gates agents must follow in chat.

**Platform issues, Native/BYOK split, step-by-step operations, and external evidence** are documented in [Cursor platform limitations and cursor-trellis adaptation](cursor-platform-limitations-and-trellis-adaptation.md).

## Slash commands

| Command file | Typical invocation | Purpose |
| --- | --- | --- |
| `trellis-continue.md` | `/trellis-continue` | Resume the active task with Trellis context |
| `trellis-finish-work.md` | `/trellis-finish-work` | Close out verification, learning, and task status |
| `trellis-cursor2plus-setup.md` | `/trellis-cursor2plus-setup` | Map subagent roles to Cursor++ BYOK models (optional, BYOK only) |

Placeholder prefix on Cursor is `/trellis-` (see `AI_TOOLS.cursor.templateContext` in `packages/cli/src/types/ai-tools.ts`).

## Agents (subagents)

Files in `.cursor/agents/` define **Task** subagents with isolated context — for example research, implementation, and check/review passes. Hooks can inject extra context when the agent spawns a subagent (`preToolUse` matcher `Task|Subagent` in `hooks.json`).

Each `trellis-*` agent template opens with two standard sections (since 0.2.8):

- **Entry points** — the three ways the agent can be reached (Agent session, Task dispatch, Skill form) and which model-routing path each implies.
- **Context source** — declares **CLI Layer 2 dispatch** (`generate_dispatch_prompt.py` → `Task` tool `prompt`) as the **primary** and guaranteed context channel. `sessionStart.additional_context` and `preToolUse` hooks are **best-effort** only (Cursor issue #158452 makes `additional_context` unreliable; the agent definition body does not reliably enter the subagent system prompt). When a hook-injected path is the only context available, treat the agent as undersupplied and request a Layer 2 dispatch prompt.

Prefer named Trellis agents over ad-hoc prompts when a step needs a clean context window. See [Subagent dispatch strategy](#subagent-dispatch-strategy) below for environment-specific model routing.

## Hooks

`hooks.json` registers Python scripts (resolved `{{PYTHON_CMD}}` at init/update time):

| Hook | Role |
| --- | --- |
| `sessionStart` | Session bootstrap (workflow context; subject to Cursor injection limits — #158452) |
| `preToolUse` | Subagent context injection (best-effort on Cursor) |
| `beforeSubmitPrompt` | Per-query retrieval plan injection (`inject-retrieval-plan.py` → `## 代码库检索计划` block) |
| `beforeShellExecution` | Shell/session context for terminal tools |
| `stop` | End-of-turn retrieval pack (research workflow) |

Local overrides may live in `.trellis/hooks.local.json` (gitignored in Trellis source policy). Requires **Python ≥ 3.9** on the machine where hooks run.

For the retrieval injection channel, see [Retrieval layer design](retrieval.md#cursor-dual-injection-channel).

## Cursor environments (Native vs BYOK)

Trellis supports two Cursor environments. The **same** `trellis-*` subagent names are reached via three entry points (Agent session, Task dispatch, Skill form) with **different** model routing. Identify your entry point before touching model config.

### Environment comparison

| Capability | Native Cursor API | Cursor++ BYOK |
| --- | --- | --- |
| Agent frontmatter `model:` | ✅ Works (server-side routing) | ❌ Not wired for `trellis-*`; frontmatter ignored |
| Cursor Settings per-agent model UI | ✅ Works | ❌ Does not populate `subagentModelOverrides` for `trellis-*` |
| Explore subagent model | ✅ Native model picker | ✅ Independent model via Cursor++ panel (v0.0.11+) |
| Task subagent (`trellis-*`) model | ✅ Frontmatter / Settings | ❌ Without Method 2.5, **inherits** parent session BYOK model |
| Built-in `@codebase` semantic search | ✅ `platformNative: true` | ❌ Not in agent tool list |
| `fast_context_search` MCP | Not Primary | ✅ Required for concept retrieval |

### Environment detection

`cursorEnv` is resolved from (first match wins):

1. `TRELLIS_CURSOR_BYOK=0|1` environment variable
2. `~/.ccursor/routes.json` `byokMode` field
3. Presence of `~/.ccursor/providers.json` (Cursor++ data dir)

The router envelope (`route_codebase_retrieval.py`) always includes `cursorEnv` so the agent knows which semantic backend to call. See [Semantic routing](retrieval.md#semantic-routing-cursor).

## Subagent dispatch strategy

When a subagent dispatch is imminent, the dispatch method depends on environment and user choice. The abstract policy is `model_policy: cursor-configured` — Trellis workflow, agents, skills, and hooks **must not** hardcode vendor model IDs in committed defaults.

### Dispatch methods

| Method | Environment | Mechanism | Use when |
| --- | --- | --- | --- |
| **1. Inherit** (default) | Both | Custom Task subagents inherit parent session model. No frontmatter edit. | Parent model is appropriate; user says "inherit" / "用当前模型派发" |
| **2. Explore + custom model** | BYOK | Dispatch built-in **Explore** subagent (read-only) with independent model via Cursor++ panel | Pure codebase exploration; no file writing, no external search |
| **2.5. BYOK proxy map** | BYOK only | Reversible patch to Cursor++ `extension.js` resolver `WPeLc8`; maps `subagentType` → BYOK slug from `~/.ccursor/trellis-task-models.json5`; evaluated **before** inherit branch | Need fixed per-role models for `trellis-research` / `trellis-implement` / `trellis-check` under BYOK |
| **2.6. Temporary Task types** | BYOK | Add `.cursor/agents/trellis-worker-<id>.md` + project `subagent-models.json` key; re-run patch; dispatch; remove when done | Rare per-dispatch model without changing global slots |
| **3. Manual dispatch** | Both | Main session prepares full dispatch prompt; user opens new chat, selects model, pastes prompt, returns results | Subagent work benefits significantly from a different model, Method 2.5 unavailable |
| **4. Ephemeral overlay** | Native only | Before dispatch: edit frontmatter `model: <id>`; after dispatch: restore frontmatter | Native API, need temporary per-dispatch model. **Does NOT work under BYOK** |

### Method 2.5 detail (BYOK json5 patch)

**What it is:** a reversible patch to Cursor++ `extension.js` resolver `WPeLc8` that maps `subagentType` → BYOK catalog slug (`model-xxxxx`), evaluated before the inherit-parent branch. Verified against Cursor++ v0.0.11+.

**Trellis ships** (every `trellis init` / `trellis update`, when `--cursor2plus` is passed): `.trellis/local/cursor2plus/` containing `patch_wpelc8.py`, `README.md`, `config.local.json.example`. Native Cursor API users can ignore this directory.

**Operator workflow (BYOK only):**

1. Fill `~/.ccursor/trellis-task-models.json5` with `subagent_type` → slug from `~/.ccursor/providers.json` `id` fields.
2. Optionally override per repo: `.trellis/local/subagent-models.json` (project wins on same key).
3. From `.trellis/local/cursor2plus/`: `python patch_wpelc8.py --print-map` → `python patch_wpelc8.py` → **Developer: Reload Window**.
4. Verify: `taskToolCall dispatching` → `resolvedModelId` matches slug.
5. **Revert:** `python patch_wpelc8.py --revert`; Reload Window. Re-run patch after Cursor / Cursor++ upgrades.

Native Cursor API: **stop** — frontmatter `model:` works; Method 2.5 does not apply.

### `--cursor2plus` initialization

Pass both `--cursor` and `--cursor2plus` to `trellis init` to materialize the BYOK local bundle at `.trellis/local/cursor2plus/`. This adds the `/trellis-cursor2plus-setup` slash command, which launches an agent-led workflow to write the json5 model map. Without `--cursor2plus`, this directory is absent and BYOK users must manage the patch manually if they want Method 2.5.

### When to ask the user for model choice

**Ask** when a subagent dispatch is imminent **AND** the dispatch method depends on user choice (e.g. Method 2 vs 2.5 vs 3).

**Do not ask** for: planning-only turns, PRD Grill / micro-grill, inline edits in the main session, `trellis-check` skill without spawning the check agent, or any turn where no Trellis subagent will run this round.

Task mode (Lite / Full / Parent) does **not** by itself trigger the question — only **impending subagent dispatch** does.

### Dispatch decision flow

```text
Subagent dispatch needed
├─ Cursor++ BYOK + trellis-* needs fixed per-role models?
│  └─ Method 2.5 applied on this machine? → dispatch Task normally (map handles routing)
├─ Parent model appropriate for trellis-*? → Method 1 (inherit)
├─ Read-only codebase exploration only? → Method 2 (Explore + Cursor++ panel)
├─ Native Cursor API (non-BYOK)? → Method 1 (inherit) or Method 4 (ephemeral frontmatter)
└─ Need a different model, Method 2.5 unavailable? → Method 3 (manual dispatch)
```

## Validated gates (since 0.2.8)

Trellis ships two hard gates that keep dogfood files (`./cursor/` and `./.trellis/scripts/`) in lock-step with generated templates. They run as part of `trellis init` / `trellis update` and as standalone checks:

- **`trellis validate-rules`** — compares every rule file under `.cursor/rules/` against the bundled manifest in `packages/cli/src/templates/cursor/fixtures/expected-rules.ts`. Fails the command when a rule is missing, mis-titled, or out of sync.
- **`pnpm mirror-check`** (contributor-side) — compares agent and rule template files against their dogfood instances in this repo, so the source-of-truth templates and the live `.cursor/` files do not drift.

`trellis init` and `trellis update` call `assertCursorRulesValid()` before writing, so a regression in the manifest aborts the operation instead of leaving the project in a half-init state. Run `trellis validate-rules` manually after hand-editing `.cursor/rules/` to re-check.

## Cursor++ Method 2.5 safety gate (since 0.2.8)

The Cursor++ local patcher (`patch_wpelc8.py`) now requires explicit consent before touching Cursor's `extension.js`:

- **`--approve`** — the patch step refuses to write without this flag. A bare `python patch_wpelc8.py` (no subcommand) prints the planned map and exits; it no longer implicitly patches.
- **`--check-compat`** — pre-flight that verifies the `WPeLc8` resolver symbol is still present in the installed Cursor++ build before attempting any patch.
- **`smoke.py`** — health check that confirms the patched resolver maps `subagentType` → slug without reading any secret-bearing files (no provider keys, no token inspection).
- **Native safe-to-ignore** — `trellis init --cursor` (without `--cursor2plus`) prints a one-line hint that the Cursor++ appendix is safe to ignore for Native API users.

These gates exist because Method 2.5 patches a vendored `extension.js`; the previous default (implicit write) could break Cursor on a Cursor++ upgrade without operator confirmation.

## Keeping Cursor files current

```bash
trellis update
```

Compares template hashes, applies safe updates, and can run migrations (`--migrate`). Use `--dry-run` first in sensitive repos. See [CLI README](../packages/cli/README.md#trellis-update).

To remove Trellis-managed Cursor files:

```bash
trellis uninstall
```

## See also

- [Workflow in Cursor](workflow.md)
- [Retrieval layer design](retrieval.md)
- [Architecture](architecture.md)
- [CLI package reference](../packages/cli/README.md)
- [Project README](../README.md)
