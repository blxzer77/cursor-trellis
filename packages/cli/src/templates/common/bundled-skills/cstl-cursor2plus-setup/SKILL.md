---
name: cstl-cursor2plus-setup
description: "Guides Cursor++ BYOK users through trellis-task-models.json5 setup at init or on demand. User picks models per Trellis/Cursor Task role; the agent lists providers, writes commented JSON5 with primary/fallback, runs patch_wpelc8.py. Use when cstl init just finished with Cursor selected, user asks to configure subagent models, or providers.json changed."
---

# Trellis Cursor++ subagent model setup (agent-led)

## Who does what

| Role | Responsibility |
|------|----------------|
| **User** | Chooses which **display/api model name** they want per scene (research / implement / check / built-in Task types). May skip types they never use. |
| **Agent** | Lists catalog, writes `~/.ccursor/trellis-task-models.json5` with **comments per entry**, primary + fallback, runs patch, reports WARN/ERROR from resolver. |

Do **not** ask the user to hand-edit slugs (`model-xxxxx`) unless they prefer it.

## When to run

- Right after **`cstl init`** when **Cursor** was selected (CLI prints a follow-up hint).
- User says they use **Cursor++ BYOK** and want per–subagent-type models.
- After Cursor++ **providers** change: re-list, adjust fallbacks, re-patch.
- After **Cursor or Cursor++ upgrade**: run `python ./.trellis/local/cursor2plus/patch_wpelc8.py --check-compat` before `--apply --approve`; revert first if compat fails.

Native **Cursor API** (no Cursor++): **stop** — frontmatter `model:` works; this skill does not apply. Tell the user: **`.trellis/local/cursor2plus/` is safe to ignore or delete** unless they use Cursor++ BYOK.

## Workflow

1. Confirm Cursor++ data dir exists (`~/.ccursor/providers.json` or user path in `.trellis/local/cursor2plus/config.local.json`).
2. From repo root:
   ```bash
   python ./.trellis/local/cursor2plus/patch_wpelc8.py --list-models
   python ./.trellis/local/cursor2plus/patch_wpelc8.py --explain
   ```
3. Ask the user **one role at a time** (or one message with a table) which **apiModel/displayName** they want for:
   - `cstl-research`, `cstl-implement`, `cstl-check`
   - optional: `generalPurpose`, `shell`, `best-of-n-runner`
   For each, ask **fallback** if they care (recommend a second choice from `--list-models`).
4. Write **`%USERPROFILE%\.ccursor\trellis-task-models.json5`** (or `~/.ccursor/`) using structure from `.trellis/local/trellis-task-models.json5.example`:
   - JSON5 with `//` comments above each key explaining the Trellis/Cursor role
   - `"models": { "<subagent_type>": { "primary": "...", "fallback": "..." } }`
5. Run:
   ```bash
   python ./.trellis/local/cursor2plus/patch_wpelc8.py --print-map
   python ./.trellis/local/cursor2plus/patch_wpelc8.py --apply --approve
   ```
6. Tell user: **Developer: Reload Window** in Cursor (once per patch).
7. If stderr shows `WARN ... using fallback`, explain that primary was missing from current `providers.json` and fallback was used — suggest updating primary/fallback names, not panicking.

## Resolver rules (for agent)

- Values match `apiModel`, `displayName`, or slug from latest `providers.json` (case-insensitive for names).
- **Primary** tried first; **fallback** only if primary does not resolve.
- **ERROR** only when **both** fail for a configured type — then fix JSON or ask user to pick another model from `--list-models`.
- Omit entire types the user does not use.

## Files

- User catalog: `~/.ccursor/providers.json`
- User routing doc: `~/.ccursor/trellis-task-models.json5` (gitignored on machine)
- Project override (optional): `.trellis/local/subagent-models.json5` — same shape, wins on same key
- Patch bundle: `.trellis/local/cursor2plus/`

Policy: `.trellis/spec/guides/cursor-subagent-policy.md` (Method 2.5 / 2.6).