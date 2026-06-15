# Release readiness — {package_or_product}

## Goal

Prepare a **ready-to-publish** release recommendation and evidence **without** publishing, tagging, pushing, or bumping versions in this task.

## Requirements

- Record current workspace versions (CLI, core, or product packages as applicable).
- Recommend next version and release channel (`patch` / `minor` / `major` / `beta` / `rc` / `promote`) with rationale.
- Draft changelog / release notes for the scoped changes.
- Document migration manifest expectations when the Trellis CLI ships template or script changes.
- Run **non-mutating** validation: build, focused tests, typecheck, pack dry-run, manifest/docs guards (dry-run only).
- Structure prepublish blockers as `blocking` / `fixed` / `waived` / `deferred`.
- Write `verify.md` and `handoff.md` that clearly separate **ready to publish** from **published**.

## Acceptance Criteria

- [ ] `handoff.md` includes **Ready to publish**, **Not published**, and **Blockers** sections.
- [ ] `verify.md` includes validation commands/results and standardized release evidence headings.
- [ ] No `npm publish`, `git tag`, `git push`, version bump commits, or GitHub release created in this task.
- [ ] Any waived blocker names the approver and rationale in `handoff.md`.

## Out Of Scope

- Release execution (publish / tag / push / bump).
- Fixing unrelated full-suite failures unless required to document a publish blocker.

## Operator handoff

When readiness is complete, open a separate **release-execution** task (or explicit user approval in-session) before any remote mutation. Link the readiness task directory in execution `prd.md`.