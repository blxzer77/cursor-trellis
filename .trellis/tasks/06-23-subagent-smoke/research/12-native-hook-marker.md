# Research: Native hook marker (test #12)

- **Query**: Check the very first line of the prompt/input for marker `<!-- trellis-hook-injected -->`
- **Scope**: internal (hook injection verification)
- **Date**: 2026-06-24

## Findings

### Marker present: NO

The received input does **not** begin with `<!-- trellis-hook-injected -->`. The first visible content is the `<user_info>` block.

### First 300 chars of received input

```
<user_info>
OS Version: win32 10.0.26200

Shell: powershell

Workspace Path: d:\MyHarness

Is directory a git repo: Unknown (git repository detection still warming)

Terminals folder: C:\Users\blaze\.cursor\projects\d-MyHarness/terminals

Today's date: Wednesday Jun 24, 2026

Note: Prefer absolute paths
```

## Caveats / Not Found

- Marker was searched at the very top of the full agent context (system + rules + user message); not found anywhere in the opening lines.
- Subagent dispatch may receive a different injection surface than the parent session; this result reflects the trellis-research subagent input only.
