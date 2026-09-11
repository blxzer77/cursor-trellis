# Cursor host

English | [简体中文](cursor.zh-CN.md)

Pactile's Cursor adapter writes a small, rebuildable projection. The canonical
workflow, Tasks, Tiles, receipts, and ownership ledger remain under
`.pactile/`; Cursor consumes the managed `.cursor/` files and the shared
`AGENTS.md` block.

## Install and inspect

Run from the project root, not from the Pactile source checkout:

```bash
pactile init --cursor -y
pactile capability-smoke --json
pactile validate-rules
```

The generated surface normally includes:

| Surface                           | Purpose                                                  | Authority                                   |
| --------------------------------- | -------------------------------------------------------- | ------------------------------------------- |
| `.cursor/commands/`               | User-invoked workflow commands.                          | Projection of the active generation.        |
| `.cursor/rules/`                  | A small always-on bootstrap pointer.                     | Policy pointer; not the full workflow.      |
| `.cursor/agents/`                 | Named research, implementation, and review entry points. | Projection of task dispatch metadata.       |
| `.cursor/hooks/` and `hooks.json` | Best-effort context and evidence helpers.                | Host enhancement; never the only hard gate. |
| `AGENTS.md`                       | Shared managed instructions plus preserved user text.    | Shared resource with ownership claimants.   |

`pactile validate-rules` compares installed rules with the bundled manifest.
`pactile update --dry-run` previews projection changes before a user-confirmed
apply. A hand-edited or locked file is reported for review rather than silently
overwritten.

## Capabilities and limits

Cursor rules are the dependable always-on channel. Hooks can enrich a session,
inject a retrieval plan, or prepare a handoff, but host versions may omit hook
context from the Agent. The [limitations page](cursor-limitations.md) lists the
fallback: use the CLI-generated dispatch prompt and inspect the canonical
workflow when hook context is absent.

Skills, MCP servers, and retrieval providers follow the shared
[install → adopt → bind model](../capabilities/native-adoption.md). A native
resource remains host-owned or borrowed; a Pactile projection is managed only
when its bytes and ownership receipt prove that claim.

## Detach

```bash
pactile detach cursor --dry-run
pactile detach cursor
```

Detaching Cursor removes only the Cursor claimant and its binding. Shared
`AGENTS.md` or Skills stay when Codex still claims them, and borrowed or
modified native files are preserved. See [coexistence](coexistence.md) for a
two-host example.
