# Cursor++ BYOK — Trellis subagent model routing

**Who needs this:** Cursor IDE with [Cursor++](https://ccursor.cometix.dev) (BYOK proxy). **Native Cursor API users can ignore this directory.**

## Agent-led setup (recommended)

In **Cursor Agent**, run skill **`trellis-cursor2plus-setup`** (after `trellis init` with Cursor, or anytime `providers.json` changes). The agent lists models, writes commented **`~/.ccursor/trellis-task-models.json5`** with **primary** and **fallback** per role, runs `patch_wpelc8.py`, and reports WARN/ERROR from the resolver.

Copy `../trellis-task-models.json5.example` only if you prefer a manual starting point.

## What to put in `trellis-task-models.json5`

| JSON key (under `models`) | Meaning |
|-----------------|--------|
| `trellis-research` | Trellis research Task subagent |
| `trellis-implement` | Trellis implement (+ Parent/Child default Task) |
| `trellis-check` | Trellis check Task subagent |
| `generalPurpose` / `shell` / `best-of-n-runner` | Cursor built-in Task types |

Each role: `{ "primary": "<name>", "fallback": "<name>" }`. **Names:** use **apiModel** or **displayName** from Cursor++ (not `model-xxxxx` unless you want to). Patch time resolves against `providers.json`; missing primary → WARN + fallback; ERROR only if both fail.

```bash
python patch_wpelc8.py --explain      # key meanings
python patch_wpelc8.py --list-models  # current catalog from providers.json
```

**Explore** is not in this file — use the Cursor++ panel.

## When Cursor++ models change

`providers.json` is the live catalog. Slugs (`model-xxxxx`) can change when you add/remove models in Cursor++.

1. Re-run skill **`trellis-cursor2plus-setup`**, or `python patch_wpelc8.py --list-models` and fix JSON5
2. `python patch_wpelc8.py` → Reload Window only if you had not patched yet or reverted

You may **omit** keys for Task types you never use.

## Two-layer JSON (project overrides user)

| File | Scope |
|------|--------|
| `~/.ccursor/trellis-task-models.json5` (or `.json`) | User — all repos |
| `{repo}/.trellis/local/subagent-models.json` | Project overrides (optional) |

## Paths

`providers.json` default: `~/.ccursor/providers.json`. Override: `config.local.json` → `providersJson`, or env `TRELLIS_CCURSOR_PROVIDERS`.

## Apply / revert

```bash
cd .trellis/local/cursor2plus
python patch_wpelc8.py --print-map
python patch_wpelc8.py
```

**Developer: Reload Window** after patch.

Policy: `.trellis/spec/guides/cursor-subagent-policy.md` (Method 2.5 / 2.6).