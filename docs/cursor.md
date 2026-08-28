# Cursor integration
> **⚠️ Cursor++ retired (P23):** Trellis no longer ships Cursor++ product surfaces (`cstl-cursor2plus-setup`, `--cursor2plus`, `.cstl/local/cursor2plus/`). Do **not** install Cursor++, run `patch_wpelc8.py`, or treat Method 2.5 as setup. **Product path = Native Cursor** — `cstl init --cursor`. Env detection (`cursorEnv` / `TRELLIS_CURSOR_BYOK` / `~/.ccursor/routes.json`) may remain for **retrieval routing only**.


English | [简体中文](cursor.zh-CN.md)

Trellis treats **Cursor** as a first-class platform. After you run `cstl init --cursor`, the CLI writes a managed `.cursor/` tree plus the shared `.cstl/` workspace. This document explains what gets generated, how context reaches the agent, how retrieval plans are injected, and how Native Cursor works (Cursor++ product path retired; env detection may remain) for subagent dispatch.

## What `cstl init --cursor` does

From your **project root** (the repo you are developing, not the Trellis source repo):

```bash
npm install -g @blxzer/cursor-trellis
cd /path/to/your-project
cstl init --cursor
```

`init` also creates or updates:

- `.cstl/` — workflow, spec, tasks, workspace, scripts
- `AGENTS.md` — high-level agent instructions (Trellis-managed block)
- Platform files under `.cursor/` (see below)

Use `-y` to accept defaults, `-f` to overwrite, or `-s` to skip existing files. See [CLI README](../packages/cli/README.md) for the full flag list.

### Commands-only policy on Cursor

On Cursor, Trellis uses a **commands-only** default:

| Surface | On Cursor after init |
| --- | --- |
| `.cursor/commands/` | User-facing slash commands (`/cstl-continue`, `/cstl-finish-work`, Native Cursor commands only) |
| `.cursor/rules/*.mdc` | Always-on or glob-scoped rules (e.g. Request Triage hard gate, retrieval routing) |
| `.cursor/agents/` | Sub-agent definitions (`cstl-research`, `cstl-implement`, `cstl-check`, …) |
| `.cursor/hooks/` + `hooks.json` | Python hook scripts and wiring |
| `.cursor/worktrees.json` | Cursor native worktree helper config |
| `.cursor/skills/` | **Not** populated by default — internal workflow skills stay off the palette |

**Rationale.** Keep the `/` palette small and reliable. Workflow semantics reach the agent through **rules** and **AGENTS.md** / `.cstl/workflow.md`, not through a large skills tree on Cursor. Other platforms (Claude Code, Codex, …) may ship skills under their own config dirs; that is intentional and documented only in the appendix below.

## Generated layout

```text
your-project/
  .cstl/
    workflow.md          # Shared lifecycle (plan, execute, finish, triage)
    spec/                # Coding guidelines by layer
    tasks/               # PRDs, design, implement, verify
    workspace/           # Journals and session traces
    scripts/             # task.py, get_context.py, hooks helpers, retrieval router
  AGENTS.md              # Entry instructions for agents
  .cursor/
    commands/
      cstl-continue.md
      cstl-finish-work.md
      # (Cursor++ setup command retired)
    rules/
      cstl-triage.mdc             # alwaysApply: true
      retrieval-routing.mdc          # alwaysApply: true
      cstl-session-rename.mdc        # alwaysApply: true
    agents/
      cstl-research.md
      cstl-implement.md
      cstl-check.md
    hooks/
      *.py                           # sessionStart, preToolUse, beforeSubmitPrompt, shell, stop, …
    hooks.json
    worktrees.json
```

Implementation reference: `packages/cli/src/configurators/cursor.ts` and `packages/cli/src/templates/cursor/`.

## Rules

Cursor **User Rules** and project **`.cursor/rules`** are the reliable channel for always-on policy on Cursor. Trellis ships three always-on rules:

- `cstl-triage.mdc` (`alwaysApply: true`) — enforces **Request Triage** before durable work.
- `retrieval-routing.mdc` (`alwaysApply: true`) — enforces [retrieval layer](retrieval.md) routing for codebase questions.
- `cstl-session-rename.mdc` (`alwaysApply: true`) — after `task.py select` or `start-execution --approved`, best-effort rename of the **main** chat tab to the task **directory name** via `cursor-app-control` `rename_chat` (skip silently if MCP unavailable).

This compensates for a known Cursor limitation: `sessionStart` hook `additional_context` may not reach the agent (#158452). Triage and retrieval policy therefore must not depend only on hook-injected workflow text.

### Session rename (one task per main chat)

Trellis **encourages** binding one cstl task to one main Agent session for clarity. It does **not** rename on `task.py create` (create does not select/bind the session). Subagent child windows are out of scope.

| Trigger | Chat title |
| --- | --- |
| `task.py select <task-dir>` | Task directory name (e.g. `07-04-my-task`) |
| `task.py start-execution <task-dir> --approved` | Same |

Mechanism: `afterShellExecution` hook emits an `agent_message` (best-effort) plus always-on rule `cstl-session-rename.mdc` instructing the agent to call **`cursor-app-control` → `rename_chat`**. This MCP is a **Cursor platform** capability (not installed by `cstl init`); Trellis does not add it to `.cursor/mcp.json`.

| Environment | Notes |
| --- | --- |
| Native Cursor API | Expected to work when `rename_chat` is in the agent tool list |
| BYOK env (detection) | Same rename path when MCP available; skip silently if not |

Dedup state: `.cstl/.runtime/session-rename/` (per conversation context key).

For day-to-day edits, treat `.cstl/workflow.md` as the canonical workflow spec; rules summarize the hard gates agents must follow in chat.

**Platform issues, Native/BYOK split, step-by-step operations, and external evidence** are documented in [Cursor platform limitations and cursor-trellis adaptation](cursor-platform-limitations-and-trellis-adaptation.md).

## Slash commands

| Command file | Typical invocation | Purpose |
| --- | --- | --- |
| `cstl-continue.md` | `/cstl-continue` | Resume the active task with Trellis context |
| `cstl-finish-work.md` | `/cstl-finish-work` | Close out verification, learning, and task status |
| *(removed)* | — | Cursor++ setup command retired |

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
| `afterShellExecution` | After successful `task.py select` / `start-execution --approved`, best-effort prompt to rename the main chat to the task directory name (`rename-session-for-task.py`) |
| `stop` | End-of-turn retrieval pack (research workflow) |

Local overrides may live in `.cstl/hooks.local.json` (gitignored in Trellis source policy). Requires **Python ≥ 3.9** on the machine where hooks run.

For the retrieval injection channel, see [Retrieval layer design](retrieval.md#cursor-dual-injection-channel).

## Product path: Native Cursor

Run `cstl init --cursor` per project. Multi-repo harnesses still init **per repo**. There is **no** `--cursor2plus` flag and **no** Cursor++ local bundle install path.

### Env detection (retrieval only)

`cursorEnv` (`native` | `byok` | `unknown`) may be resolved from:

1. `TRELLIS_CURSOR_BYOK=0|1`
2. `~/.ccursor/routes.json` `byokMode`
3. Presence of `~/.ccursor/providers.json` (legacy signal)

Use this only to choose retrieval backends (Native built-in semantic vs `fast_context_search` MCP). It is **not** a Cursor++ install or Method 2.5 setup signal.

### Optional capabilities

Init/update can select `codebase-retrieval`, `github-mcp`, and `playwright-mcp`. MCP writes **merge** into existing `.cursor/mcp.json`: Trellis-managed server names are upserted/removed from the current selection; unrelated servers are preserved.

`cursor-sdk` and `campaign-mcp` have been **removed**. Daily execution is IDE Agent / Task and BYOK. Do not set `CURSOR_API_KEY` to enable a Trellis SDK bridge. See the retired notes in the harness spec (`rpc-full-core.md`, `campaign-ui-mix.md`) if you need history.

## Subagent dispatch strategy (Native)

Abstract policy: `model_policy: cursor-configured` — do not hardcode vendor model IDs in committed defaults.

| Method | Mechanism | Use when |
| --- | --- | --- |
| **1. Inherit** (default) | Task subagents inherit parent session model | Parent model is fine |
| **2. Explore** | Built-in Explore subagent + Native model picker | Read-only codebase exploration |
| **3. Manual dispatch** | New chat, pick model, paste CLI dispatch prompt | Need a different model without frontmatter |
| **4. Ephemeral overlay** | Temporary frontmatter `model:`, then restore | Native one-off per-dispatch model |

**Ask** for model choice only when a Trellis subagent dispatch is imminent and the method depends on user choice. Do **not** ask for planning-only / PRD Grill / no-subagent turns.

```text
Subagent dispatch needed
├─ Parent model appropriate? → Method 1 (inherit)
├─ Read-only exploration only? → Method 2 (Explore)
├─ Need temporary Native model? → Method 4 (ephemeral frontmatter)
└─ Otherwise → Method 3 (manual dispatch)
```

## Historical appendix (retired; not SOP)

> **Not operational.** Cursor++ / Method 2.5 / `--cursor2plus` / `cstl-cursor2plus-setup` / `patch_wpelc8.py` are **retired**. Do not patch `extension.js`, do not Reload Window for Trellis setup, do not edit `trellis-task-models.json5` as a product step. Leftover `.cstl/local/cursor2plus/` is residue — `cstl update` hash-safe cleanup removes pristine managed copies. Historical evidence may remain in changelogs and migration manifests only.

## Validated gates (since 0.2.8)

Trellis ships two hard gates that keep dogfood files (`./cursor/` and `./.cstl/scripts/`) in lock-step with generated templates. They run as part of `cstl init` / `cstl update` and as standalone checks:

- **`cstl validate-rules`** — compares every rule file under `.cursor/rules/` against the bundled manifest in `packages/cli/src/templates/cursor/fixtures/expected-rules.ts`. Fails the command when a rule is missing, mis-titled, or out of sync.
- **`pnpm mirror-check`** (contributor-side) — compares agent and rule template files against their dogfood instances in this repo, so the source-of-truth templates and the live `.cursor/` files do not drift.

`cstl init` and `cstl update` call `assertCursorRulesValid()` before writing, so a regression in the manifest aborts the operation instead of leaving the project in a half-init state. Run `cstl validate-rules` manually after hand-editing `.cursor/rules/` to re-check.


## Keeping Cursor files current

```bash
cstl update
```

Compares template hashes, applies safe updates, and can run migrations (`--migrate`). Use `--dry-run` first in sensitive repos. See [CLI README](../packages/cli/README.md#trellis-update).

To remove Trellis-managed Cursor files:

```bash
cstl uninstall
```

## See also

- [Workflow in Cursor](workflow.md)
- [Retrieval layer design](retrieval.md)
- [Architecture](architecture.md)
- [CLI package reference](../packages/cli/README.md)
- [Project README](../README.md)
