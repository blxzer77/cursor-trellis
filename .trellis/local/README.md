# `.trellis/local/` — project-local Trellis assets

This directory holds project-local configuration that is **not** part of the
shared `.trellis/spec/` or `.trellis/scripts/` surface. Most projects do not
need anything here.

## What lives here

| Path | Purpose | Who needs it |
|------|---------|--------------|
| `cursor2plus/` | Cursor++ BYOK subagent model routing (Method 2.5): `patch_wpelc8.py`, resolver, config example. | **Only** Cursor IDE users with the Cursor++ BYOK proxy. Native Cursor API users can ignore / delete this directory. See `cursor2plus/README.md`. |
| `trellis-task-models.json5.example` | User-wide `trellis-task-models.json5` template (primary + fallback per Task role). | Cursor++ BYOK users starting a manual config. |
| `trellis-task-models.json.example` | Legacy JSON-format variant of the above (JSON5 is the primary). | Backward compat only. |
| `subagent-models.json.example` | Per-project override over the user-wide map. | Projects that need role→slug mapping differing from the user default. |

## When to delete

If you do **not** use Cursor++ BYOK, `cursor2plus/` and the three `*.example`
files are safe to remove — they have no effect on native Cursor or other
platforms. `trellis init` / `trellis update` will not recreate them when the
BYOK opt-in is declined (1.1.0+).
