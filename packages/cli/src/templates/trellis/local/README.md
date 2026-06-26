# Cursor++ Local Bundle

> **Native Cursor users:** safe to ignore or delete this directory unless using **Cursor++ BYOK**.

**Who needs this:** Cursor IDE with [Cursor++](https://ccursor.cometix.dev) (BYOK proxy). Method 2.5 patches the `WPeLc8` resolver so Trellis Task subagents get per-role BYOK slugs instead of inheriting the parent model.

## Bundle files

| File | Purpose |
|------|---------|
| `patch_wpelc8.py` | Operator CLI: dry-run map, compat check, apply (with `--approve`), revert |
| `smoke.py` | Health smoke: env, patch status, configured roles (no secret reads) |
| `trellis_task_models_config.py` | JSON5 + providers catalog resolver (used by patch) |
| `config.local.json.example` | Optional paths (`extensionJs`, `ccursorHome`, …) |
| `config.local.json` | Your local paths (gitignored; never commit secrets) |

User-wide model doc: `~/.ccursor/trellis-task-models.json5` (see `../trellis-task-models.json5.example`). Project override: `../subagent-models.json` (optional).

## Compatibility window

- **Verified:** Cursor **3.7.27** / Cursor++ **v0.0.11** (see `.trellis/spec/guides/cursor-subagent-policy.md`, 2026-06-18)
- **Re-verify** after any Cursor or Cursor++ upgrade: `python patch_wpelc8.py --check-compat`
- If `--check-compat` reports `fail` or `unknown`, treat the patch as stale until you re-apply or revert

## Method 2.5 workflow

1. **Dry-run map** — `python patch_wpelc8.py --print-map` (no file writes)
2. **Operator approval** — review map and compat output; decide to proceed
3. **Apply** — `python patch_wpelc8.py --apply --approve` (writes `extension.js`)
4. **Reload Cursor** — Developer: Reload Window (once per apply/revert)
5. **A ≠ B probe** — parent chat model must differ from a patched subagent map target; dispatch a `trellis-*` Task and confirm the subagent self-reports the **map target** slug/model, not the parent
6. **Revert if needed** — `python patch_wpelc8.py --revert` then Reload Window

Agent-led setup: run skill **`trellis-cursor2plus-setup`** in Cursor Agent (lists models, writes JSON5, runs patch steps).

## Revert recipe

```bash
cd .trellis/local/cursor2plus
python patch_wpelc8.py --revert
```

Then **Developer: Reload Window**. Subagents return to **inherit parent** BYOK model. Re-apply only after `--check-compat` is `ok` and you have explicit `--approve`.

## A ≠ B verification recipe

Goal: prove the patch routes **subagent** model independently of the **parent** session model.

1. Set parent chat to model **A** (any BYOK model in Cursor++).
2. Ensure `trellis-task-models.json5` maps e.g. `trellis-implement` to model **B** (`primary`/`fallback` resolving to a different slug than A).
3. `python patch_wpelc8.py --print-map` — note the slug for `trellis-implement` (= map target **B**).
4. `python patch_wpelc8.py --apply --approve` → Reload Window.
5. Dispatch a `trellis-implement` Task from a parent on model **A**.
6. **Pass:** subagent self-report / trace shows **B** (map target), not **A**.
7. **Fail:** subagent shows **A** → patch stale or not applied; run `--check-compat`, re-patch, or `--revert`.

## CLI reference

```bash
python patch_wpelc8.py --print-map          # dry-run slug map
python patch_wpelc8.py --check-compat       # WPeLc8 locatability (no writes)
python patch_wpelc8.py --apply --approve    # write patch (requires --approve)
python patch_wpelc8.py --apply --dry-run    # validate without write
python patch_wpelc8.py --revert             # remove patch
python patch_wpelc8.py --explain            # JSON5 key meanings
python patch_wpelc8.py --list-models        # catalog from providers.json
python smoke.py                             # env + patch_status smoke
```

`--apply` without `--approve` **refuses** and exits non-zero.

## What to put in `trellis-task-models.json5`

| JSON key (under `models`) | Meaning |
|---------------------------|---------|
| `trellis-research` | Trellis research Task subagent |
| `trellis-implement` | Trellis implement (+ Parent/Child default Task) |
| `trellis-check` | Trellis check Task subagent |
| `generalPurpose` / `shell` / `best-of-n-runner` | Cursor built-in Task types |

Each role: `{ "primary": "<name>", "fallback": "<name>" }`. Names: **apiModel** or **displayName** from Cursor++ (`--list-models`). **Explore** is not in this file — use the Cursor++ panel.

Policy: `.trellis/spec/guides/cursor-subagent-policy.md` (Method 2.5 / 2.6).
