# Trellis Cursor++ Subagent Model Setup

Configure per-subagent-type model routing for Cursor++ BYOK. Run this after `cstl init` (when Cursor++ is selected), when providers change, or whenever you want to re-map which model each Trellis Task subagent uses.

Native Cursor API (no Cursor++): stop — this does not apply; agent frontmatter `model:` works natively.

---

## Step 1: Verify Cursor++ is configured

Confirm the Cursor++ data directory exists:

- `~/.ccursor/providers.json` (or a custom path in `.trellis/local/cursor2plus/config.local.json`)

If missing, Cursor++ is not set up — ask the user to install/configure it first.

## Step 2: List available models + roles

```bash
python ./.trellis/local/cursor2plus/patch_wpelc8.py --list-models
python ./.trellis/local/cursor2plus/patch_wpelc8.py --explain
```

`--list-models` shows the model catalog (apiModel / displayName / slug / provider) from `providers.json`.
`--explain` lists the subagent types you can route:

- `cstl-research`, `cstl-implement`, `cstl-check` (core Trellis roles)
- `generalPurpose`, `shell`, `best-of-n-runner` (built-in Cursor Task types, optional)

## Step 3: Ask the user which model per role

Ask the user (one role at a time, or a single table) which **apiModel/displayName** they want for each subagent type they use. For each, also ask a **fallback** (recommended: a second choice from `--list-models`).

The user may skip types they don't use — omit those from the map.

## Step 4: Write the routing map

Write `~/.ccursor/trellis-task-models.json5` (or `~/.ccursor/` on Unix) using the structure from `.trellis/local/trellis-task-models.json5.example`:

```json5
// Trellis + Cursor++ BYOK — per-subagent-type model routing
{
  "models": {
    // <role comment>
    "cstl-research": { "primary": "<model>", "fallback": "<model>" },
    "cstl-implement": { "primary": "<model>", "fallback": "<model>" },
    "cstl-check": { "primary": "<model>", "fallback": "<model>" }
  }
}
```

Project-level override (optional, wins on same key): `.trellis/local/subagent-models.json5`.

## Step 5: Apply the patch + verify

```bash
python ./.trellis/local/cursor2plus/patch_wpelc8.py --print-map
python ./.trellis/local/cursor2plus/patch_wpelc8.py
```

Then tell the user: **Developer: Reload Window** in Cursor (required once per patch for the resolver change to take effect).

## Step 6: Interpret resolver output

- `OK <type>: '<model>' → model-<slug>` — resolved successfully.
- `WARN ... using fallback` — primary was missing from current `providers.json`; fallback was used. Suggest updating primary/fallback names.
- `ERROR` — both primary and fallback failed for a configured type. Fix the JSON or pick another model from `--list-models`.

## Resolver rules

- Values match `apiModel`, `displayName`, or slug from latest `providers.json` (case-insensitive for names).
- Primary tried first; fallback only if primary does not resolve.
- ERROR only when both fail for a configured type.

## Files

- User catalog: `~/.ccursor/providers.json`
- User routing doc: `~/.ccursor/trellis-task-models.json5` (machine-local, gitignored)
- Project override (optional): `.trellis/local/subagent-models.json5`
- Patch bundle: `.trellis/local/cursor2plus/`

Policy: `.trellis/spec/guides/cursor-subagent-policy.md` (Method 2.5 / 2.6).
