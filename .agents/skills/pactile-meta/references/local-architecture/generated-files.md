# Local Files Generated After Init

`pactile init` writes the Pactile runtime into the user project. Later, `pactile update` tries to update Pactile-managed template files, but it uses `.pactile/.template-hashes.json` to determine which files have already been modified by the user.

This page only describes files that are visible and editable inside the user project.

## `.pactile/`

```text
.pactile/
├── workflow.md
├── config.yaml
├── .developer
├── .version
├── .template-hashes.json
├── .runtime/
├── scripts/
├── spec/
├── tasks/
└── workspace/
```

| Path | Usually editable? | Notes |
| --- | --- | --- |
| `.pactile/workflow.md` | Yes | Local workflow documentation and AI routing rules. |
| `.pactile/config.yaml` | Yes | Project configuration, hooks, packages, journal line limits, and related settings. |
| `.pactile/spec/` | Yes | Project specs, intended to be updated regularly by users and AI. |
| `.pactile/tasks/` | Yes | Task material and research artifacts, maintained by the task workflow. |
| `.pactile/workspace/` | Yes | Session records, usually written by `add_session.py`. |
| `.pactile/scripts/` | Carefully | Local runtime. It can be customized, but only after understanding the call chain. |
| `.pactile/.runtime/` | No | Runtime state, usually written automatically by hooks/scripts. |
| `.pactile/.developer` | Carefully | Current developer identity. |
| `.pactile/.version` | No | Pactile version record used by update/migration logic. |
| `.pactile/.template-hashes.json` | No | Template hash record. Do not hand-write business rules here. |

## Platform Directories

On a fresh `pactile init --cursor`, the only platform directory created is `.cursor/`. Pactile previously generated per-platform directories for many AI tools (`.claude/`, `.codex/`, `.opencode/`, etc.); those legacy directories are preserved by `pactile update` but new Pactile behavior ships to `.cursor/` only.

Common categories inside `.cursor/`:

| Category | Path | Purpose |
| --- | --- | --- |
| hooks | `.cursor/hooks/` | Hook scripts invoked from `.cursor/hooks.json`. Inject session context, workflow-state, and sub-agent context. |
| settings/registration | `.cursor/hooks.json` | Registers which scripts run on which Cursor events. |
| rules | `.cursor/rules/*.mdc` (`alwaysApply: true`) | Per-turn policy prepended before every prompt. |
| agents | `.cursor/agents/` | Define agents such as `pactile-research`, `pactile-implement`, and `pactile-check`. |
| skills | `.cursor/skills/` | Skills that auto-trigger or can be read by AI. |
| commands | `.cursor/commands/` | Legacy compatibility-only user-invoked entry points. |

When modifying a platform directory, also confirm whether `.pactile/workflow.md` still describes the same flow.

## Meaning Of Template Hashes

`.pactile/.template-hashes.json` records the content hash from the last time Pactile wrote a template file. `pactile update` uses it to distinguish three cases:

| Case | Update behavior |
| --- | --- |
| File was not modified by the user | It can be updated automatically. |
| File was modified by the user | Prompt the user to overwrite, keep, or generate `.new`. |
| File is no longer a current template | It may be deleted, renamed, or preserved according to migration rules. |

When an AI customizes local Pactile files, it does not need to maintain hashes manually. It is normal for Pactile update to recognize the result as "modified by the user."

## Local Customization Boundaries

Editable by default:

- `.pactile/workflow.md`
- `.pactile/config.yaml`
- `.pactile/spec/**`
- `.pactile/scripts/**`
- Platform hooks, settings, agents, skills, commands, prompts, and workflows

Do not edit by default:

- Global npm install directory
- `node_modules/@blxzer/pactile`
- Pactile GitHub repository source code
- Concrete state files under `.pactile/.runtime/**`
- Hash contents inside `.pactile/.template-hashes.json`

Switch to the Pactile CLI source-code perspective only when the user explicitly wants to contribute upstream.
