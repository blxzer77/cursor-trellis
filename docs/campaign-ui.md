# Campaign UI MIX — operator guide

Read-only campaign observation inside **Cursor IDE / Agents Window**.  
CMD Must · MCP Must · Canvas Should (deferred).

## Prerequisites

1. Trellis harness with a campaign Parent (`task-map.md` + children).
2. Optional: localhost RPC broker (`cstl rpc serve`, default `http://127.0.0.1:7843`).
3. Built CLI (`cstl` on PATH, or `node packages/cli/dist/cli/index.js` from a worktree build).

## IDE path (CMD + panel)

```powershell
# From harness root (example Parent)
cstl campaign status --parent .cstl/tasks/08-01-trellis-intent-multisession --json

# Write Markdown panel and print absolute path
cstl campaign status --parent .cstl/tasks/08-01-trellis-intent-multisession --panel
```

Open the printed path with Cursor **`open_resource`** (cursor-app-control MCP), or open the file from the explorer.

Default panel location:

```text
.cstl/workspace/campaign-status/campaign-status-<parentId>.md
```

Broker down is OK: Trellis stages/children still render; RPC section shows `reachable: false`.

## Agents Window path

1. Parent (or any) session: `python ./.cstl/scripts/task.py publish-pack <parent>` when dispatching workers (PACK).
2. Open **New Chat** or an **Agents Window** tab (human).
3. Paste `child-prompts/<child>.md` for the unit you run.
4. In that session: `python ./.cstl/scripts/task.py select <explicit-child-path>`.
5. Observe the campaign anytime:

```powershell
cstl campaign status --parent .cstl/tasks/<campaign-parent> --panel
```

6. Parent keeps `review-child` / `integrate-child`. This UI never auto-approves gates.

## MCP path (in-session)

Add to project or user `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "trellis-campaign": {
      "command": "cstl",
      "args": ["campaign", "mcp"],
      "env": {
        "TRELLIS_CAMPAIGN_PARENT": ".cstl/tasks/08-01-trellis-intent-multisession"
      }
    }
  }
}
```

Then call tool **`campaign_status`** (optional args: `parent`, `rpcUrl`).

Equivalent CLI for the MCP process:

```powershell
cstl campaign mcp --parent .cstl/tasks/08-01-trellis-intent-multisession
```

## Client kind labels

| RPC `kind` | Panel `capLabel` |
| --- | --- |
| worker | Task |
| session | window |
| sdk | SDK |
| cli | CLI |
| broker | broker |

**Task ≠ Agent window** — labels are CAP diversion hints only.

## Non-goals

- Standalone browser ops site
- Canvas interactive UI (deferred)
- HITL / integrate from this surface
