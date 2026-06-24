# cursor-trellis

English | [简体中文](README.zh-CN.md)

**Trellis** is a team harness for AI coding agents: it replaces one giant `AGENTS.md` / `.cursorrules` with a progressive `.trellis/` wiki—workflow, specs, tasks, and journals—plus generated **Cursor** integration (rules, commands, agents, hooks).

This repository is a **public fork** focused on **Cursor-first** workflow. Upstream inspiration: [mindfold-ai/Trellis](https://github.com/mindfold-ai/Trellis).

| | |
| --- | --- |
| **npm CLI** | `@blxzer/cursor-trellis` (`trellis`, `tl`, `smart-search`) |
| **Core SDK** | `@blxzer/cursor-trellis-core` |
| **This repo** | https://github.com/blxzer77/cursor-trellis |

## What problem it solves

- **Context rot**: agents miss rules buried in a single markdown file.
- **No task continuity**: PRDs, design, and verification scatter across chats.
- **Platform drift**: Cursor rules, commands, hooks, and agents each need the right shape.

Trellis generates the **Cursor adapter** (`.cursor/`) for your stack. This fork is **Cursor-only** for init and public docs (see [docs/cursor.md](docs/cursor.md)).

## Quick start (Cursor)

**1. Install the CLI** (global or project-local):

```bash
npm install -g @blxzer/cursor-trellis
trellis --version
```

**2. Initialize your application repo** (not the Trellis source tree):

```bash
cd /path/to/your-app
trellis init --cursor
```

**3. Open the project in Cursor** and use Agent mode. User-facing slash commands include `/trellis-continue` and `/trellis-finish-work`. Request Triage is enforced via `.cursor/rules/trellis-triage.mdc`.

Optional: `trellis init --cursor --cursor2plus` for Cursor++ BYOK local bundle; see [docs/cursor.md](docs/cursor.md#cursor-optional-appendix).

## After init: what appears

```text
your-app/
  .trellis/          workflow, spec, tasks, workspace, scripts
  AGENTS.md          Trellis-managed agent entry
  .cursor/           commands, rules, agents, hooks (Cursor)
```

Details: [Cursor integration](docs/cursor.md).

## Core concepts

| Path | Role |
| --- | --- |
| `.trellis/workflow.md` | Lifecycle: triage, plan, execute, finish, learning |
| `.trellis/spec/` | Layer/package coding guidelines |
| `.trellis/tasks/` | PRD, design, implement, verify artifacts |
| `.trellis/workspace/` | Developer journals and session traces |

## Workflow (summary)

1. **Triage** every request (`No Task` → `Parent Task`).
2. **Plan** with task artifacts for durable work (especially Full Tasks).
3. **Gate**: `task.py validate` + `start-execution --check`.
4. **Approve** execution explicitly, then `start-execution --approved`.
5. **Verify** and finish (`/trellis-finish-work`).

Walkthrough: [docs/workflow.md](docs/workflow.md).

## Cursor support

- **Rules** — reliable always-on policy (including Triage).
- **Commands** — small `/` palette (`commands-only` policy; skills not copied to `.cursor/skills/` by default).
- **Agents** — `trellis-research`, `trellis-implement`, `trellis-check`.
- **Hooks** — Python scripts for session, shell, and subagent context.

Deep dive: [docs/cursor.md](docs/cursor.md).

## Common commands

| Command | Purpose |
| --- | --- |
| `trellis init --cursor` | Create `.trellis/` + `.cursor/` in the current project |
| `trellis update` | Refresh templates from the installed CLI version |
| `trellis uninstall` | Remove Trellis-managed files from the project |

Flags and behavior: [packages/cli/README.md](packages/cli/README.md).

Other CLI commands (`rollout`, `upgrade`, …) are listed briefly in the CLI README only.

## Architecture (summary)

Monorepo: `packages/core` (SDK) + `packages/cli` (templates, configurators, bins). Init flows through `configureCursor()` into your `.cursor/` tree. **smart-search** ships as a vendored CLI for web research.

Diagram and data flow: [docs/architecture.md](docs/architecture.md).

## Development and verification

Contributors working on **this** repository:

```bash
pnpm install
pnpm build
pnpm test
```

Package-level detail: [packages/cli/README.md](packages/cli/README.md). Agent-oriented codebase guide: [AGENTS.md](AGENTS.md).

## Maintainer note

Local harness layout (`D:\MyHarness`), Git remote policy, release/publish, and deep implementation notes are **internal**—see [docs/maintainers.md](docs/maintainers.md). Public docs intentionally omit npm publish and private remote procedures.

## Read more

| Doc | Topic |
| --- | --- |
| [docs/workflow.md](docs/workflow.md) | Task lifecycle in Cursor |
| [docs/cursor.md](docs/cursor.md) | Generated Cursor files |
| [docs/architecture.md](docs/architecture.md) | High-level structure + smart-search |
| [packages/cli/README.md](packages/cli/README.md) | CLI / npm reference |
| [CHANGELOG](packages/cli/CHANGELOG.md) | Package history |

## License

AGPL-3.0-only — see package metadata in `packages/cli/package.json`.