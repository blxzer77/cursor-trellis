# Release execution — {package_or_product}

## Goal

Execute an **already prepared** release after explicit user approval, with auditable evidence for each remote mutation.

## Preconditions

- A completed **release-readiness** task (or equivalent evidence) with **ready to publish** status.
- Explicit user approval in this session for **each** of: version bump (if not done), git tag, git push, npm publish (and GitHub release if used).
- No execution without naming the approved version and dist-tag.

## Requirements

- Link readiness task path and restate approved version/channel in `verify.md`.
- Run project release preflight (`check-versions`, `publish-plan`, `verify-packed-cli`) immediately before publish.
- Execute only approved steps; record exact commands, timestamps, and outcomes.
- Capture post-publish smoke (registry visibility, installed CLI version, or project-specific smoke).
- Write `handoff.md` with **Published** evidence separate from readiness artifacts.

## Acceptance Criteria

- [ ] `handoff.md` documents what was published/tagged/pushed vs skipped.
- [ ] `verify.md` lists validation and post-publish smoke results.
- [ ] No publish/tag/push occurred before documented user approval.
- [ ] Readiness task remains **not published** if execution was aborted.

## Out Of Scope

- Re-doing full readiness research (fix blockers in readiness or a new readiness task).
- Publishing without user approval “because checks passed”.