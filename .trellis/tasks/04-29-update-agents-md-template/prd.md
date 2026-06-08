# fix: update AGENTS.md via trellis update

## Goal

Make `trellis update` manage the root `AGENTS.md` Trellis block the same way it manages other Trellis templates, so template changes added after `trellis init` reach existing projects when the file is safe to update.

## What I already know

- `trellis init` creates root `AGENTS.md` from `agentsMdContent`.
- `trellis update` currently collects `.trellis/*` templates and configured platform templates, but it does not collect root `AGENTS.md`.
- `.trellis/.template-hashes.json` does not track `AGENTS.md`, so update cannot distinguish an old pristine `AGENTS.md` from a user-modified one.
- The new `## Subagents` block is present in the source and dist `agents.md` template, but old projects do not receive it through update.

## Requirements

- Add root `AGENTS.md` to the update template collection.
- Add root `AGENTS.md` to initialization hash tracking for new projects.
- Preserve user edits through the existing update conflict behavior.
- Preserve content outside the Trellis-managed `AGENTS.md` block when updating that block.
- Add regression coverage for pristine old `AGENTS.md` auto-update.
- Keep the change narrowly scoped to root `AGENTS.md` lifecycle behavior.

## Acceptance Criteria

- [x] `trellis update` auto-updates `AGENTS.md` when the current file hash matches the stored old template hash.
- [x] `trellis init` records `AGENTS.md` in `.trellis/.template-hashes.json`.
- [x] User-modified `AGENTS.md` remains protected by existing conflict handling.
- [x] Targeted tests pass.

## Out of Scope

- Changing the user-facing `AGENTS.md` content beyond the already-added Subagents section.
- Reworking the broader template update mechanism.
- Generalizing block-level merge behavior beyond root `AGENTS.md`.

## Technical Notes

- Key files:
  - `packages/cli/src/commands/update.ts`
  - `packages/cli/src/utils/template-hash.ts`
  - `packages/cli/test/commands/update.integration.test.ts`
  - `packages/cli/test/commands/init.integration.test.ts`
