# Platform File Map

This page lists Trellis file locations in a user project on **Cursor**.

Trellis originally supported multiple AI platforms (Claude Code, Codex, OpenCode, Kilo, Kiro, Gemini, Antigravity, Windsurf, Qoder, CodeBuddy, GitHub Copilot, Factory Droid, Pi Agent). The project has since converged on **Cursor-only**. Legacy adapter directories may still exist in upgraded projects (`cstl update` preserves user files), but new framework/runtime behavior targets Cursor exclusively.

## Matrix

| Platform | CLI flag | Main directory | Skill directory | Agent directory | Hooks/extensions |
| --- | --- | --- | --- | --- | --- |
| Cursor | `--cursor` | `.cursor/` | `.cursor/skills/` | `.cursor/agents/` | `.cursor/hooks.json` + `.cursor/hooks/` |

## Capability Reference (Cursor)

- **Skills** auto-trigger via the workflow matcher and can be read on demand. They live in `.cursor/skills/`.
- **Agents** (`cstl-research`, `cstl-implement`, `cstl-check`) live in `.cursor/agents/` and are dispatched via the Task tool or opened as Agent sessions / Skill forms depending on the entry point (see `cursor-subagent-policy.md.txt`).
- **Commands** (e.g. `record-session`, `cstl-continue`) live in `.cursor/commands/` and are user-invocable via `/slash`.
- **Hooks** (session start, pre-tool-use on Task/Subagent, before-shell-execution, stop) are registered in `.cursor/hooks.json` and their handler scripts live in `.cursor/hooks/`.
- **Project rules** (always-applied policy) live in `.cursor/rules/*.mdc`.

## Decision Rules When Modifying Platform Files

1. User specified a platform other than Cursor: treat as a legacy adapter inspection — preserve existing files but do not extend new behavior there.
2. User says "all platforms should do this": in Cursor-only world this is equivalent to "modify the Cursor path"; also mirror any dogfooded copy under `.cursor/` in `packages/cli/src/templates/cursor/` if applicable.
3. User only says "my AI": inspect which directories actually exist in the project; on a fresh `cstl init` only `.cursor/` and `.trellis/` are created.
4. User wants project rules: prefer `.trellis/spec/` or a project-local skill under `.cursor/skills/`.
5. User wants Trellis behavior: edit `.trellis/workflow.md` plus `.cursor/hooks.json` / `.cursor/agents/` / `.cursor/skills/` / `.cursor/commands/`.

## When Paths Differ

Cursor's layout can change between versions, and user projects may already be customized. If this table disagrees with local files, use the actual settings/config in the user project as authoritative:

- Check the hook that `.cursor/hooks.json` registers.
- Check the script that a command/agent points to.
- Judge behavior by the read rules currently written in the agent file.

Do not delete a custom file just because it is not listed in this path table.

## Legacy Adapter Handling

If a user project still contains legacy platform directories (e.g. `.claude/`, `.codex/`, `.opencode/`):

- `cstl update` preserves them; do not delete on sight.
- If the user asks to clean them up, suggest removing the unused platform directories after confirming they are not shared with another tool.
- Do not register new hooks/agents/skills/commands under legacy platform directories. New Trellis features ship to `.cursor/` only.
