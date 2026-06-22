# Platform Files Overview

Trellis connects the same local architecture to **Cursor**. `.trellis/` stores the shared runtime; `.cursor/` stores adapter files that define how Cursor enters Trellis.

When a local AI modifies Trellis, it should distinguish two file categories first:

- **Shared files**: `.trellis/workflow.md`, `.trellis/tasks/`, `.trellis/spec/`, `.trellis/scripts/`.
- **Platform files**: `.cursor/` (settings, hooks, agents, skills, commands, rules).

Platform files do not store business state. They let Cursor read Trellis state, call Trellis scripts, and load Trellis skills/agents/hooks.

> **Historical note**: Trellis previously shipped adapter directories for many AI tools (`.claude/`, `.codex/`, `.opencode/`, etc.). The project has converged on **Cursor-only**. Legacy adapter directories may still exist in upgraded projects (`trellis update` preserves user files), but new framework/runtime behavior targets Cursor exclusively.

## Platform File Categories (Cursor)

| Category | Common paths | Purpose |
| --- | --- | --- |
| settings/config | `.cursor/hooks.json` | Register hooks and platform behavior. |
| hooks | `.cursor/hooks/` | Inject context at session start, pre-tool-use on Task/Subagent, before-shell-execution, and stop events. |
| rules | `.cursor/rules/*.mdc` (`alwaysApply: true`) | Per-turn policy prepended before every prompt (e.g. Request Triage, retrieval routing). See `cursor-context-injection-guide.md.txt` for the channel-reliability matrix. |
| agents | `.cursor/agents/` | Define `trellis-research`, `trellis-implement`, and `trellis-check` for Task / Agent-session dispatch. |
| skills | `.cursor/skills/` | Capability descriptions that auto-trigger or can be read on demand. |
| commands | `.cursor/commands/` | User-invocable `/slash` entry points (e.g. `trellis-continue`, `record-session`). |

## Cursor Integration Mode

Cursor combines three integration styles:

1. **Hook / Extension Driven** — `.cursor/hooks.json` + `.cursor/hooks/` fire on sessionStart, pre-tool-use on Task/Subagent, beforeShellExecution, and stop. Common capabilities: session-start Task Dashboard + Phase Index injection (note the `additional_context` Cursor bug #158452 — use `.cursor/rules` or `AGENTS.md` for must-always-be-visible content), PRD/jsonl injection when sub-agents start, shell commands inheriting session identity.
2. **Agent Prelude / Pull-Based** — `.cursor/agents/*.md` instruct each custom Task subagent to read the selected task, PRD, and JSONL context after startup (the `<!-- trellis-hook-injected -->` marker confirms injected context).
3. **Main-Session Workflow** — `.cursor/commands/*.md` and `.cursor/skills/*.md` guide the main-session AI to read files, run scripts, and move tasks forward; `.cursor/rules/*.mdc` enforce per-turn policy.

To change "when the AI knows what," inspect `.cursor/hooks.json` and `.cursor/rules/` first. To change how sub-agents load context, inspect `.cursor/agents/`. To change user-invocable entry points, inspect `.cursor/commands/` and `.cursor/skills/`.

## Local Modification Order

When the user asks to customize behavior:

1. Read `.trellis/workflow.md` to confirm the shared flow.
2. Read `.cursor/hooks.json` to see which hooks are registered.
3. Read the relevant `.cursor/agents/*.md`, `.cursor/skills/*/SKILL.md`, `.cursor/commands/*.md`, and `.cursor/rules/*.mdc`.
4. Modify the local file closest to the user's need.
5. If the change affects the shared flow, synchronize `.trellis/workflow.md` or `.trellis/spec/`.

Do not modify only platform files and forget the shared workflow. Do not modify only `.trellis/workflow.md` and forget that platform entry points may still contain old descriptions.
