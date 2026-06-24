# Cursor++ BYOK — Trellis subagent model routing

**Who needs this:** Cursor IDE with [Cursor++](https://ccursor.cometix.dev) (BYOK proxy). **Native Cursor API users can ignore this directory.**

Trellis does **not** commit model slugs or patch `extension.js` in git. This bundle is copied on every `trellis init` / `trellis update`.

## What you get

- Per **Task** `subagent_type` routing (`trellis-research`, `trellis-implement`, `trellis-check`, plus `generalPurpose`, `shell`, `best-of-n-runner`).
- **Explore** still uses the Cursor++ panel (not this map).
- Slugs are `id` values from your provider catalog (`providers.json` under your Cursor++ data directory).

## Two-layer JSON (project overrides user)

| File | Scope |
|------|--------|
| `~/.ccursor/trellis-task-models.json` | User — all repos on this machine |
| `{repo}/.trellis/local/subagent-models.json` | Project — optional overrides |

Copy `../subagent-models.json.example` when you need project-specific slugs.

Example user file:

```json
{
  "trellis-research": "model-xxxxxxxx",
  "trellis-implement": "model-xxxxxxxx",
  "trellis-check": "model-xxxxxxxx",
  "generalPurpose": "model-xxxxxxxx",
  "shell": "model-xxxxxxxx",
  "best-of-n-runner": "model-xxxxxxxx"
}
```

Look up slugs in `providers.json` (same folder as `routes.json`). On Windows typically `%USERPROFILE%\.ccursor\providers.json`.

## Paths auto-detect vs manual

1. Copy `config.local.json.example` → `config.local.json` (gitignored) when auto-detect fails.
2. Or set env: `TRELLIS_CCURSOR_HOME`, `TRELLIS_CURSOR2PLUS_EXTENSION`.
3. Or run: `python patch_wpelc8.py --bootstrap`

`extensionJs` must point at `cursor2plus/dist/extension.js` inside your Cursor install.

## Apply / revert

```bash
cd .trellis/local/cursor2plus
python patch_wpelc8.py --print-map   # verify merge
python patch_wpelc8.py --dry-run
python patch_wpelc8.py
```

Then **Developer: Reload Window** in Cursor.

After editing JSON maps, re-run `patch_wpelc8.py` (patch bakes the map into `extension.js`).

```bash
python patch_wpelc8.py --revert
```

Re-apply after Cursor or Cursor++ upgrades.

## Verify

In Cursor++ log: `taskToolCall dispatching` → `resolvedModelId` matches your slug.

Policy: `.trellis/spec/guides/cursor-subagent-policy.md` (Method 2.5 / 2.6).

## Temporary per-dispatch types (advanced)

For rare cases, add a custom agent under `.cursor/agents/trellis-worker-<id>.md` and a matching key in project `subagent-models.json`, then re-patch. Remove the agent when done. Parent/Child default uses `trellis-implement` only; per-child manual model → new Agent chat (see policy).