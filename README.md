# cursor-trellis

English | [简体中文](README.zh-CN.md)

**Trellis** is a progressive context management system for AI coding agents. It structures agent instructions as `.trellis/` (workflow, specs, tasks, workspace) instead of a single large file, and generates platform-specific integration files (`.cursor/` for Cursor).

Based on the [Trellis framework by mindfold-ai](https://github.com/mindfold-ai/Trellis), this version is adapted for Cursor with rules, commands, agents, and hooks.

## What it does

- Task artifacts (PRD, design, implementation plan) persist in `.trellis/tasks/`
- Resume work across chat sessions with `/trellis-continue`
- Load specs progressively based on files being edited
- Route requests through structured workflow: triage → plan → gate → execute → verify

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

## When to use

- Multi-file refactoring that needs architecture consistency
- Long-running feature development spanning multiple sessions
- Projects with custom coding standards agents must follow
- Tasks requiring research → design → implement → verify workflow

Not needed for quick one-file edits or exploratory coding.

## smart-search integration

Trellis includes [smart-search](https://github.com/blxzer77/smart-search), a CLI tool for agents to retrieve current information from the web (search engines, fetch pages, deep research mode, JSON output). The workflow routes external fact queries to smart-search when available.

**Installation:**
```bash
npm install -g @blxzer/smart-search
```

**Links:**
- npm package: https://www.npmjs.com/package/@blxzer/smart-search
- GitHub repository: https://github.com/blxzer77/smart-search

See the repository for configuration and usage details.

## Common commands

| Command | Purpose |
| --- | --- |
| `trellis init --cursor` | Create `.trellis/` + `.cursor/` in the current project |
| `trellis update` | Refresh templates from the installed CLI version |
| `trellis uninstall` | Remove Trellis-managed files from the project |

Full CLI reference: [packages/cli/README.md](packages/cli/README.md).

## Package information

| | |
| --- | --- |
| **npm CLI** | `@blxzer/cursor-trellis` (`trellis`, `tl`, `smart-search`) |
| **Core SDK** | `@blxzer/cursor-trellis-core` |
| **Repository** | https://github.com/blxzer77/cursor-trellis |
| **Original Trellis** | [mindfold-ai/Trellis](https://github.com/mindfold-ai/Trellis) |

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