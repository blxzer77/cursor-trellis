# Cursor integration

English | [简体中文](cursor.zh-CN.md)

Trellis treats **Cursor** as a first-class platform. After you run `trellis init --cursor` in your project, the CLI writes a managed `.cursor/` tree plus the shared `.trellis/` workspace. This document explains what gets generated, how context reaches the agent, and how Cursor differs from other platforms in this fork.

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
| `.cursor/rules/*.mdc` | Always-on or glob-scoped rules (e.g. Request Triage hard gate) |
| `.cursor/agents/` | Sub-agent definitions (`trellis-research`, `trellis-implement`, `trellis-check`, …) |
| `.cursor/hooks/` + `hooks.json` | Python hook scripts and wiring |
| `.cursor/worktrees.json` | Cursor native worktree helper config |
| `.cursor/skills/` | **Not** populated by default — internal workflow skills stay off the palette |

Rationale: keep the `/` palette small and reliable. Workflow semantics still reach the agent through **rules** and **AGENTS.md** / `.trellis/workflow.md`, not through a large skills tree on Cursor.

Other platforms (Claude Code, Codex, …) may ship skills under their own config dirs; that is intentional and documented only in the appendix below.

## Generated layout

```text
your-project/
  .trellis/
    workflow.md          # Shared lifecycle (plan, execute, finish, triage)
    spec/                # Coding guidelines by layer
    tasks/               # PRDs, design, implement, verify
    workspace/           # Journals and session traces
    scripts/             # task.py, get_context.py, hooks helpers
  AGENTS.md              # Entry instructions for agents
  .cursor/
    commands/
      trellis-continue.md
      trellis-finish-work.md
      trellis-cursor2plus-setup.md   # Cursor-only (BYOK routing)
    rules/
      trellis-triage.mdc             # alwaysApply: true
    agents/
      trellis-research.md
      trellis-implement.md
      trellis-check.md
    hooks/
      *.py                           # sessionStart, preToolUse, shell, stop, …
    hooks.json
    worktrees.json
```

Implementation reference: `packages/cli/src/configurators/cursor.ts` and `packages/cli/src/templates/cursor/`.

## Rules

Cursor **User Rules** and project **`.cursor/rules`** are the reliable channel for always-on policy on Cursor.

Trellis ships `trellis-triage.mdc` with `alwaysApply: true` so **Request Triage** runs before durable work. This compensates for a known Cursor limitation: `sessionStart` hook `additional_context` may not reach the agent (#158452). Triage therefore must not depend only on hook-injected workflow text.

For day-to-day edits, treat `.trellis/workflow.md` as the canonical workflow spec; rules summarize the hard gates agents must follow in chat.

## Slash commands

Cursor exposes Trellis through **slash commands** under `.cursor/commands/`:

| Command file | Typical invocation | Purpose |
| --- | --- | --- |
| `trellis-continue.md` | `/trellis-continue` | Resume the active task with Trellis context |
| `trellis-finish-work.md` | `/trellis-finish-work` | Close out verification, learning, and task status |
| `trellis-cursor2plus-setup.md` | `/trellis-cursor2plus-setup` | Map subagent roles to Cursor++ BYOK models (optional) |

Placeholder prefix on Cursor is `/trellis-` (see `AI_TOOLS.cursor.templateContext` in `packages/cli/src/types/ai-tools.ts`).

## Agents (subagents)

Files in `.cursor/agents/` define **Task** subagents with isolated context—for example research, implementation, and check/review passes. Hooks can inject extra context when the agent spawns a subagent (`preToolUse` matcher `Task|Subagent` in `hooks.json`).

Prefer named Trellis agents over ad-hoc prompts when a step needs a clean context window.

## Hooks

`hooks.json` registers Python scripts (resolved `{{PYTHON_CMD}}` at init/update time):

| Hook | Role |
| --- | --- |
| `sessionStart` | Session bootstrap (workflow context; subject to Cursor injection limits) |
| `preToolUse` | Subagent context injection |
| `beforeShellExecution` | Shell/session context for terminal tools |
| `stop` | End-of-turn retrieval pack (research workflow) |

Local overrides may live in `.trellis/hooks.local.json` (gitignored in Trellis source policy). Requires **Python ≥ 3.9** on the machine where hooks run.

## Cursor++ (optional appendix)

If you pass **`--cursor2plus`** together with **`--cursor`**, init can materialize a local BYOK bundle under `.trellis/local/cursor2plus/`. The slash command **`/trellis-cursor2plus-setup`** walks through mapping models to Trellis subagent roles.

- Only relevant when you use **Cursor++** (BYOK), not the native Cursor API-only setup.
- Details stay in the generated command markdown; public docs do not duplicate provider install steps.

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
- [Architecture](architecture.md)
- [CLI package reference](../packages/cli/README.md)
- [Project README](../README.md)