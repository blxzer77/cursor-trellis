# Campaign UI MIX — operator guide

Read-only campaign observation inside **Cursor IDE / Agents Window**.  
CMD Must · MCP Must · Canvas delivered (IDE-local `.canvas.tsx`).

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

## Canvas path (IDE-local)

> **Critical — where Canvas actually renders**
>
> Cursor only shows the **graphical** Canvas UI for files under:
> `~/.cursor/projects/<workspace-slug>/canvases/*.canvas.tsx`
> (or a directory set via `TRELLIS_CAMPAIGN_CANVAS_DIR` / `CURSOR_CANVAS_DIR`).
>
> If you open the same `.canvas.tsx` from elsewhere (for example `.cstl/workspace/...`)
> in a normal editor tab, you will see **TypeScript source only** — not the campaign UI.
> Always open the printed path in the Cursor **Canvas** view.
>
> **User environments differ.** Do not assume a specific machine path, drive letter, or
> Cursor project folder name. Prefer the CLI default (derived from the harness root +
> `os.homedir()`). If Cursor’s project slug does not match the derived one, set
> `TRELLIS_CURSOR_PROJECT_SLUG` or point `TRELLIS_CAMPAIGN_CANVAS_DIR` at the canvases
> folder that your IDE actually uses.

Generate or refresh a Cursor Canvas with an **embedded** campaign snapshot (no `fetch()` inside the canvas):

```powershell
# Preferred: write to the default canvases path (CLI mkdir if needed)
cstl campaign canvas --parent .cstl/tasks/<campaign-parent>
```

Default write target: `~/.cursor/projects/<workspace-slug>/canvases/campaign-<parentId>.canvas.tsx`  
Overrides (portable escape hatches):

| Env | Purpose |
| --- | --- |
| `TRELLIS_CAMPAIGN_CANVAS_DIR` / `CURSOR_CANVAS_DIR` | Absolute canvases directory |
| `TRELLIS_CURSOR_PROJECT_SLUG` | Force `~/.cursor/projects/<slug>/canvases` when auto-slug is wrong |
| `TRELLIS_CAMPAIGN_CANVAS_OPEN=1` | Same as `--open` |
| `CURSOR_BIN` | Cursor CLI binary when not on PATH |

```powershell
# Optional: pin --out ONLY when the path stays under *your* canvases dir
cstl campaign canvas --parent .cstl/tasks/<campaign-parent> --out "$env:USERPROFILE\.cursor\projects\<your-slug>\canvases\campaign-<id>.canvas.tsx"

# Script-friendly: stdout = path only
cstl campaign canvas --parent .cstl/tasks/<campaign-parent> --quiet

# Best-effort open via Cursor CLI (may still open as text; use Canvas view if needed)
cstl campaign canvas --parent .cstl/tasks/<campaign-parent> --open
```

**Do not** use `--out` to dump into `.cstl/workspace/...` or other repo paths unless you only want a source copy — the CLI still writes the file but prints a **warning**, and a normal editor will not render Canvas graphics.

After a successful write, stdout prints the absolute path; stderr prints open hints (and a warning when the path is outside canvases) unless `--quiet`. Re-run the same command to refresh.

**Native and BYOK:** Canvas is IDE-local React compiled from `.canvas.tsx`; it works for both Native and BYOK sessions (does not depend on the official model billing channel).

## Agents Window path

1. Parent (or any) session: `python ./.cstl/scripts/task.py publish-pack <parent>` when dispatching workers (PACK).
2. Open **New Chat** or an **Agents Window** tab (human).
3. Paste `child-prompts/<child>.md` for the unit you run.
4. In that session: `python ./.cstl/scripts/task.py select <explicit-child-path>`.
5. Observe the campaign anytime:

```powershell
cstl campaign status --parent .cstl/tasks/<campaign-parent> --panel
cstl campaign canvas --parent .cstl/tasks/<campaign-parent>
```

6. Parent keeps `review-child` / `integrate-child`. This UI never auto-approves gates.

## MCP path (in-session)

**Preferred:** select the `campaign-mcp` optional capability during `cstl init` / capability update. Trellis **merges** this entry into project `.cursor/mcp.json` without wiping other servers:

```json
{
  "mcpServers": {
    "trellis-campaign": {
      "command": "npx",
      "args": ["-y", "@blxzer/cursor-trellis", "campaign", "mcp"]
    }
  }
}
```

Trellis does **not** embed `TRELLIS_CAMPAIGN_PARENT` in that template (avoids committing a wrong Parent path). Set the parent via:

- process env `TRELLIS_CAMPAIGN_PARENT`, or
- `cstl campaign mcp --parent <dir>`, or
- optional `parent` argument on tool **`campaign_status`**.

You may still hand-edit `.cursor/mcp.json` to add `env` if you want a fixed default Parent for the MCP process.

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
- HITL / integrate from this surface
- Live polling / `fetch()` inside Canvas (refresh = re-run `cstl campaign canvas`)
