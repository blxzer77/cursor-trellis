# Shared Hooks Distribution: Remove Dead Hook Files Per Platform

## Problem

`getSharedHookScripts()` (`packages/cli/src/templates/shared-hooks/index.ts`)
returns all four `*.py` files from the shared-hooks directory. Both
distribution paths use it indiscriminately:

- **Runtime install** — `writeSharedHooks(hooksDir, { exclude? })` in
  `packages/cli/src/configurators/shared.ts:283`, called from each
  platform's `configureX()`.
- **Diff/manifest** — `collectSharedHooks(hooksPath, { exclude? })` in
  `packages/cli/src/configurators/index.ts:106`, used by `trellis update`.

Per-platform `exclude` lists are hand-rolled and incomplete. Only the
"class-2 pull-based platforms skip `inject-subagent-context.py`" rule is
centralized (`PULL_BASED_HOOK_EXCLUDE`). The "`statusline.py` is Claude
Code only" rule was never encoded — so every non-Claude platform ships
it as a dead file. Kiro's case is worse: it only supports `agentSpawn`
(no SessionStart, no UserPromptSubmit), so 3 of the 4 shared hooks are
dead weight there.

## Current Dead-File Matrix

| Platform | Installed | Referenced by config | Dead files |
|---|---|---|---|
| claude | 4/4 | 4/4 | — |
| cursor | 4/4 | session-start, inject-workflow-state, inject-subagent-context | `statusline.py` |
| codex | inject-workflow-state, statusline | inject-workflow-state (own session-start) | `statusline.py` |
| gemini | session-start, inject-workflow-state, statusline | session-start, inject-workflow-state | `statusline.py` |
| qoder | session-start, inject-workflow-state, statusline | session-start, inject-workflow-state | `statusline.py` |
| copilot | inject-workflow-state, statusline | inject-workflow-state (own session-start) | `statusline.py` |
| codebuddy | 4/4 | session-start, inject-workflow-state, inject-subagent-context | `statusline.py` |
| droid | 4/4 | session-start, inject-workflow-state, inject-subagent-context | `statusline.py` |
| kiro | 4/4 | inject-subagent-context (agentSpawn only) | `session-start.py`, `inject-workflow-state.py`, `statusline.py` |

OpenCode uses a JS plugin (not shared-hooks) — unaffected.

## Root Cause

Policy of "which platform supports which hook event" is not centralized.
Each configurator duplicates its own exclude list, and the two
distribution paths (`writeSharedHooks` vs `collectSharedHooks`) can
drift apart silently.

## Fix

1. **Centralize platform hook capability.** Add a table (or per-script
   `supportedPlatforms` metadata) describing which platforms register
   each shared hook. Source of truth lives next to
   `shared-hooks/index.ts`.
2. **Drive distribution from capability.** Refactor `writeSharedHooks`
   and `collectSharedHooks` so both read from the same capability table
   keyed by platform id — eliminating the hand-rolled exclude lists
   per configurator.
3. **Ship a `safe-file-delete` migration** for existing installs. Entry
   per (platform, dead hook) pair, hash-verified so locally-modified
   files stay put with a warning.

Expected scope:
- 1 dead file × 7 platforms (cursor / codex / gemini / qoder / copilot
  / codebuddy / droid) = 7 entries
- 3 dead files on kiro = 3 entries
- Total ~10 `safe-file-delete` entries.

## Non-Goals

- No behavior change for Claude Code.
- No change to OpenCode (uses its own plugin path).
- No change to `inject-subagent-context.py` pull-based routing — that
  rule is already correctly centralized via `PULL_BASED_HOOK_EXCLUDE`.
- No new hook events or scripts added.

## Verification

- `trellis init` on every supported platform writes only the hooks that
  platform's `hooks.json`/`settings.json`/agent JSON references. No
  orphan `*.py` under `<platformDir>/hooks/`.
- `trellis update` diff on a pristine 0.5.0-beta install shows the
  expected `safe-file-delete` entries and nothing more.
- Locally-modified hook files are preserved with a warning (hash
  mismatch path in the safe-file-delete handler).
- Unit tests cover the capability table + `writeSharedHooks` output for
  at least claude (positive all-4 case), kiro (worst 1-of-4 case), and
  one class-2 platform (codex).

## Open Questions

- Capability table shape: `Record<PlatformId, Set<HookName>>` vs
  per-script `supportedPlatforms: PlatformId[]` frontmatter-style
  metadata. Leaning toward the table — keeps all hook routing readable
  in one place and matches how `PULL_BASED_HOOK_EXCLUDE` is done today.
