# Hooks And Settings

Hooks/settings are the entry layer that connects Cursor to Trellis. They decide which scripts run on which Cursor events.

## Settings Responsibilities

`.cursor/hooks.json` registers:

- session-start hook: injects a Trellis overview when a new session starts or context resets (note the Cursor `additional_context` bug #158452 — see `cursor-context-injection-guide.md.txt`).
- workflow-state hook: parses `[workflow-state:STATUS]` blocks from `.trellis/workflow.md` and emits the body matching the selected task `status` on each user input. Parser-only; the script does not embed fallback content.
- sub-agent context hook: injects task context when implementation/check/research agents start.
- shell/session bridge: lets shell commands see the same Trellis session identity.

> Trellis previously shipped settings/config files for many platforms (`.claude/settings.json`, `.codex/hooks.json`, `.gemini/settings.json`, etc.). The project has converged on **Cursor-only**. New Trellis features ship into `.cursor/hooks.json` + `.cursor/hooks/`.

Whether legacy settings/config files exist in a project depends on which historical `trellis init --<platform>` flags the user previously ran; `trellis update` preserves them.

| Platform | settings/config |
| --- | --- |
| Cursor | `.cursor/hooks.json` |

## Hook Script Types

| Script | Purpose |
| --- | --- |
| `session-start.py` | Generates session-start context. |
| `inject-workflow-state.py` | Parses `[workflow-state:STATUS]` blocks in `.trellis/workflow.md` and emits the body matching the selected task status. Falls back to `Refer to workflow.md for current step.` when no matching block exists. |
| `inject-subagent-context.py` | Injects PRD, JSONL context, and related spec/research into sub-agents. |
| `inject-shell-session-context.py` | Lets shell commands inherit Trellis session identity. |

Cursor exposes sessionStart, preToolUse on Task/Subagent, beforeShellExecution, and stop events. Confirm against the current Cursor release before wiring a new event name; the available event surface has evolved over time and historical platform documentation may be stale.

## Local Change Scenarios

| User need | Edit location |
| --- | --- |
| AI should see more/less context in a new session | `.cursor/hooks.json` → `session-start` hook (or `.cursor/rules/*.mdc` for content the model must see every turn — see `cursor-context-injection-guide.md.txt`). |
| Per-turn hint policy should change | `[workflow-state:STATUS]` block in `.trellis/workflow.md`. The hook parses workflow.md verbatim — no script edit required. |
| Sub-agent cannot read PRD/spec | `inject-subagent-context.py` hook or agent prelude in `.cursor/agents/*.md`. |
| `task.py selected` in shell has no selected task | `inject-shell-session-context.py` hook or environment-variable configuration. |
| Disable an automatic injection | The corresponding hook registration in `.cursor/hooks.json`. |

## Modification Principles

1. **Settings wire things up; hooks define behavior**. If only the hook changes, Cursor may never call it. If only settings change, behavior may not change.
2. **Confirm Cursor event names first**. Cursor's hook event surface has changed between releases; what an older guide calls `UserPromptSubmit` may now be modeled by `beforeSubmitPrompt` instead.
3. **Hooks read local `.trellis/`, not upstream source**. `.trellis/scripts/` and `.trellis/workflow.md` in the user project are the default targets.
4. **Errors must be visible**. Hook failures should tell the user what was not injected instead of silently leaving the AI without context.

## Troubleshooting Path

If the user says "AI did not read Trellis state":

1. Check whether `.cursor/hooks.json` registers the hook.
2. Check whether the hook file exists under `.cursor/hooks/`.
3. Manually run the `.trellis/scripts/get_context.py` or `task.py selected --source` command that the hook depends on.
4. Check whether selected task state exists in `.trellis/.runtime/sessions/`.
5. Check whether the Cursor shell passes session identity.
