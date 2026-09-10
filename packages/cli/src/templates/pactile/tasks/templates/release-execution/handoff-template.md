# Handoff — Release execution — `{task-id}`

## Published

| Action | Evidence |
| --- | --- |
| Version bumped | `{yes/no}` — `{version}` |
| Git tag | `{tag or none}` |
| Git push | `{ref or none}` |
| npm publish | `{package@version + dist-tag or none}` |
| Post-publish smoke | `{summary}` |

## Not published

- `{Describe aborted or dry-run-only session}`

## Ready to publish

_Refer to readiness task:_ `{path to readiness handoff.md}`

## Blockers

| Blocker | Severity | Disposition | Notes |
| --- | --- | --- | --- |
| `{if any}` | | | |

## Residual risks

- `{registry lag, global CLI hygiene, consumer dist-tag confusion, etc.}`