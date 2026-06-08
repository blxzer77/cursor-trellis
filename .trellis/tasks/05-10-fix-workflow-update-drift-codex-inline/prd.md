# Fix workflow.md update drift for Codex inline

## Goal

Fix the upgrade path where `trellis update` upgrades Codex dispatch scripts to the `codex-inline` / `codex-sub-agent` routing model but leaves an older `.trellis/workflow.md` with `[Codex]` and `[Kilo, Antigravity, Windsurf]` platform blocks. The update command must keep runtime-parsed workflow files consistent with the shipped CLI template.

## What I already know

- Reproduced on beta line: `0.6.0-beta.0 init --codex` followed by `0.6.0-beta.6 update --force`.
- Reproduced on stable line: `0.5.8 init --codex` followed by `0.5.11 update --force`.
- Fresh init on `0.5.11` is correct: `.trellis/workflow.md` contains `codex-inline` / `codex-sub-agent`.
- Upgrade path is broken: `workflow_phase.py` maps `codex` to `codex-inline`, but `.trellis/workflow.md` still lacks that platform block.
- Runtime symptom:
  ```text
  python3 ./.trellis/scripts/get_context.py --mode phase --step 2.1 --platform codex
  ```
  returns only:
  ```text
  #### 2.1 Implement `[required · repeatable]`
  ```
- Root cause candidate: `update.ts` builds the workflow template by replacing only `[workflow-state:*]` blocks and preserving the rest of the existing file. That preserved old platform blocks that are also runtime-parsed.

## Assumptions

- `.trellis/workflow.md` is a runtime file, not only user-facing prose.
- If `workflow.md` is unmodified from the last tracked template hash, `trellis update` should replace the whole file with the current shipped template.
- If a user modified `workflow.md`, the normal modified-file conflict path can still protect those edits.

## Requirements

- `trellis update` must update `.trellis/workflow.md` as a normal template file when the installed file is hash-matched / unmodified.
- The update path must not preserve stale non-`[workflow-state:*]` platform blocks from older templates.
- The Codex upgrade path must produce a workflow file containing `codex-inline` and `codex-sub-agent`.
- `get_context.py --mode phase --step 2.1 --platform codex` must return inline implementation instructions after upgrade.
- Tests must cover both:
  - stale workflow with old `[Codex]` / `[Kilo, Antigravity, Windsurf]` blocks
  - updated script logic that maps Codex to `codex-inline`
- Specs must record the lesson: runtime-parsed workflow structures outside breadcrumb tags cannot be preserved blindly.
- Break-loop analysis must be captured in repo docs/specs, not only chat.

## Acceptance Criteria

- [ ] Regression test fails on current `main` and passes after the fix.
- [ ] Test simulates an older tracked `.trellis/workflow.md` and verifies `update({ force: true })` writes the current workflow template, including `codex-inline` / `codex-sub-agent`.
- [ ] Test verifies the upgraded Codex phase extraction includes `trellis-before-dev` and does not collapse to title-only output.
- [ ] Relevant specs mention whole-file update requirements for runtime-parsed workflow structure.
- [ ] Break-loop/root-cause notes classify this as a cross-layer update contract failure and identify prevention mechanisms.

## Definition of Done

- Focused tests pass.
- Typecheck passes for changed TypeScript.
- Specs/templates stay in sync where this project requires mirrored generated spec content.
- No sub-agents are used for this task.

## Out of Scope

- Reworking all migration mechanics.
- Changing `workflow.md` customization policy beyond restoring normal hash-based full-file updates for runtime structure.
- Publishing a release.

## Technical Notes

- Relevant implementation:
  - `packages/cli/src/commands/update.ts`
  - `packages/cli/src/templates/trellis/workflow.md`
  - `packages/cli/src/templates/trellis/scripts/common/workflow_phase.py`
  - `packages/cli/test/regression.test.ts`
- Relevant specs:
  - `.trellis/spec/cli/backend/migrations.md`
  - `.trellis/spec/cli/backend/workflow-state-contract.md`
  - `.trellis/spec/cli/unit-test/conventions.md`
  - `.trellis/spec/cli/unit-test/integration-patterns.md`
