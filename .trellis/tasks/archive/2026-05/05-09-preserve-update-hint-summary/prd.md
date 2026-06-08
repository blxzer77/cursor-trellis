# Preserve Update Hint In Trellis Start Summaries

## Goal

Ensure `$trellis-start` instructions preserve the full Trellis update hint when summarizing session context, so operational install commands are not dropped from the assistant's final summary.

## Requirements

- Update the source template that generates Codex `.agents/skills/trellis-start/SKILL.md`.
- Update the current local `.agents/skills/trellis-start/SKILL.md` copy in this repository.
- Keep the wording narrow: only require preserving operational command hints, specifically the `Trellis update available:` line.
- Do not change `.trellis/scripts/get_context.py` behavior or update-check logic.

## Acceptance Criteria

- [x] `packages/cli/src/templates/common/commands/start.md` instructs agents not to shorten operational command hints and to copy the full `Trellis update available:` line verbatim.
- [x] `.agents/skills/trellis-start/SKILL.md` contains the same effective instruction.
- [x] Generated Codex `trellis-start` output remains consistent with the source template.

## Definition of Done

- Relevant template/local files updated.
- Focused verification run for generated template parity or existing init/configurator coverage.
- No unrelated summary template or script behavior introduced.

## Out of Scope

- Changing update version detection.
- Changing hook injection behavior.
- Adding broad session summary formatting rules.

## Technical Notes

- The Codex `trellis-start` skill is generated from `packages/cli/src/templates/common/commands/start.md` via `resolveCodexTrellisStartSkill`.
- The repository-local installed copy is `.agents/skills/trellis-start/SKILL.md`.
