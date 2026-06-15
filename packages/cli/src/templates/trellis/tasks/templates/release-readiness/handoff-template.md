# Handoff — Release readiness — `{task-id}`

## Ready to publish

**Materials are prepared; explicit user approval still required before any remote release.**

| Area | Status |
| --- | --- |
| Version recommendation | `{proposed-version}` via `{channel}` |
| Changelog / release notes | Draft in `verify.md` |
| Migration manifest | `{manifest-id or none}` |
| Build / test / pack dry-run | `{summary}` |

**Operator checklist before publish (not executed in readiness task):**

1. Resolve or waive each **blocking** row in Blockers below.
2. Create or select a **release-execution** task; obtain explicit publish approval.
3. Only then run release scripts (`release.js` / CI publish) per project policy.

## Not published

- No npm publish, git tag, git push, or GitHub release in this task session.
- Workspace `package.json` versions unchanged unless a separate task already bumped them.

## Blockers

| Blocker | Severity | Disposition | Notes |
| --- | --- | --- | --- |
| Explicit user approval for publish | **Required gate** | blocking | Out of scope for readiness by design |
| `{example}` | blocking / fixed / waived / deferred | `{disposition}` | `{notes}` |

## Published

_Not applicable in a readiness task. Record publish evidence only in release-execution `handoff.md`._

## Integration notes

- Link execution task: `{path or pending}`
- Parent / dogfood notes: `{optional}`