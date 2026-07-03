# cursor-trellis

<p>
  <a href="https://www.npmjs.com/package/@blxzer/cursor-trellis">
    <img src="https://img.shields.io/npm/v/@blxzer/cursor-trellis?label=npm%20latest" alt="npm latest">
  </a>
  <a href="https://www.npmjs.com/package/@blxzer/smart-search">
    <img src="https://img.shields.io/npm/v/@blxzer/smart-search?label=smart-search" alt="smart-search">
  </a>
</p>

English | [简体中文](README.zh-CN.md)

**Trellis** is a progressive context management system for AI coding agents. It structures agent instructions as `.trellis/` (workflow, specs, tasks, workspace) instead of a single large file, and generates platform-specific integration files (`.cursor/` for Cursor).

Based on the [Trellis framework by mindfold-ai](https://github.com/mindfold-ai/Trellis), this version is adapted for Cursor with rules, commands, agents, and hooks.

## What it does

- Task artifacts (PRD, design, implementation plan) persist in `.trellis/tasks/`
- Resume work across chat sessions with `/cstl-continue`
- Load specs progressively based on files being edited
- Route requests through structured workflow: triage → plan → gate → execute → verify
- **Validated gates** — `cstl validate-rules` + `pnpm mirror-check` enforce dogfood/template sync; `init`/`update` throw on regression
- **Retrieval compliance** — BYOK/Native split with conservative `unknown` routing; LSP overpromises softened to codegraph + Read; telemetry separates planned vs executed semantic
- **Cursor++ safety** — Method 2.5 patch requires explicit `--approve`; `--check-compat` pre-flight; `smoke.py` health check (no secrets)
- **Evidence pack** — finish/check cite `retrieval-pack-latest.json` when present; research prompts include provider relevance caveats

## Quick start (Cursor)

**1. Install the CLI** (global or project-local):

```bash
npm install -g @blxzer/cursor-trellis
cstl --version
```

**2. Initialize your application repo** (not the Trellis source tree):

```bash
cd /path/to/your-app
cstl init --cursor
```

**3. Open the project in Cursor** and use Agent mode. User-facing slash commands include `/cstl-continue` and `/cstl-finish-work`. Request Triage is enforced via `.cursor/rules/cstl-triage.mdc`.

Optional: `cstl init --cursor --cursor2plus` materializes a **per-repo** Cursor++ BYOK bundle (not a global either/or choice). Native and BYOK can coexist across projects on one machine — see [Native and BYOK coexistence](docs/cursor.md#native-and-byok-coexistence-not-eitheror).

## Upgrade from 0.2.x (v0.3.0)

v0.3.0 is a **breaking rename**. The CLI is **`cstl` only** — the `trellis` and `tl` bin aliases are removed.

| Changed | Unchanged |
| --- | --- |
| CLI: `trellis` / `tl` → `cstl` | `.trellis/` directory name |
| Skills, commands, agents, rules: `trellis-*` → `cstl-*` | `trellis-task-models.json5` filename |

**Migration steps** (run in each project):

```bash
npm install -g @blxzer/cursor-trellis@latest
cd /path/to/your-app
cstl update --migrate
```

`--migrate` is **required** for the `trellis-*` → `cstl-*` renames under `.cursor/`. Renames are hash-verified; locally modified files are preserved with a warning — manually rename or re-apply customizations to the new `cstl-*` paths.

After 0.3.0, routine CLI bumps can use `cstl upgrade`. The old `trellis upgrade` command no longer exists once you are on 0.3.0.

**Cursor++ BYOK** (optional, `.trellis/local/cursor2plus/` only): update `trellis-task-models.json5` keys from `trellis-research/implement/check` to `cstl-research/implement/check`, then re-run `patch_wpelc8.py --apply`. Use `/cstl-cursor2plus-setup` in Agent mode.

Details: [CHANGELOG](packages/cli/CHANGELOG.md#030---2026-07-01).

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
5. **Verify** and finish (`/cstl-finish-work`).

Walkthrough: [workflow.md](docs/workflow.md) — Triage decision tree, Task Ladder, upgrade/downgrade rules, Parent/Child task trees, Phase 1–3 lifecycle.

## Cursor support

- **Rules** — reliable always-on policy (including Triage and retrieval routing).
- **Commands** — small `/` palette (`commands-only` policy; skills not copied to `.cursor/skills/` by default).
- **Agents** — `cstl-research`, `cstl-implement`, `cstl-check`.
- **Hooks** — Python scripts for session, shell, and subagent context.

Deep dive: [docs/cursor.md](docs/cursor.md) — Native vs Cursor++ BYOK environments, subagent dispatch Methods 1–4, environment detection. Retrieval layer design: [docs/retrieval.md](docs/retrieval.md).

## When to use

- Multi-file refactoring that needs architecture consistency
- Long-running feature development spanning multiple sessions
- Projects with custom coding standards agents must follow
- Tasks requiring research → design → implement → verify workflow

Not needed for quick one-file edits or exploratory coding.

## smart-search integration

Trellis integrates with [smart-search](https://github.com/blxzer77/smart-search), a CLI tool for agents to retrieve current information from the web. smart-search is automatically installed as a dependency when you install cursor-trellis.

**Installation:**

When you install cursor-trellis, smart-search is installed automatically:

```bash
npm install -g @blxzer/cursor-trellis
# smart-search is now available
smart-search --version
```

**Links:**
- npm package: https://www.npmjs.com/package/@blxzer/smart-search
- GitHub repository: https://github.com/blxzer77/smart-search

The workflow routes external fact queries to smart-search when available. See the repository for configuration and usage details.

## Common commands

| Command | Purpose |
| --- | --- |
| `cstl init --cursor` | Create `.trellis/` + `.cursor/` in the current project |
| `cstl update` | Refresh templates from the installed CLI version |
| `cstl uninstall` | Remove Trellis-managed files from the project |

Full CLI reference: [packages/cli/README.md](packages/cli/README.md).

## Package information

| | |
| --- | --- |
| **npm CLI** | `@blxzer/cursor-trellis` (`cstl`) |
| **Core SDK** | `@blxzer/cursor-trellis-core` |
| **smart-search** | `@blxzer/smart-search` (auto-installed dependency) |
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

Local harness layout (`D:\MyHarness`), Git remote policy, release/publish, and deep implementation notes are **internal** — see the internal maintainer handbook (not in the public repo; gitignored). Public docs intentionally omit npm publish and private remote procedures.

## Read more

| Doc | Topic |
| --- | --- |
| [docs/workflow.md](docs/workflow.md) | Task lifecycle in Cursor |
| [docs/cursor.md](docs/cursor.md) | Generated Cursor files |
| [docs/cursor-platform-limitations-and-trellis-adaptation.md](docs/cursor-platform-limitations-and-trellis-adaptation.md) | Cursor platform limits & trellis adaptation (users/devs) |
| [docs/retrieval.md](docs/retrieval.md) | Retrieval layer design |
| [docs/architecture.md](docs/architecture.md) | High-level structure + smart-search |
| [docs/skills.md](docs/skills.md) | Internal skills reference |
| [docs/subagents.md](docs/subagents.md) | Subagent dispatch design |
| [docs/spec-system.md](docs/spec-system.md) | Progressive spec system |
| [docs/task-system.md](docs/task-system.md) | Task artifacts, gates, Parent/Child |
| [packages/cli/README.md](packages/cli/README.md) | CLI / npm reference |
| [CHANGELOG](packages/cli/CHANGELOG.md) | Package history |

## Community

[LINUX DO](https://linux.do)

## License

AGPL-3.0-only — see package metadata in `packages/cli/package.json`.