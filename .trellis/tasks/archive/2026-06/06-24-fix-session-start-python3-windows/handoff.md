# Child handoff — session-start python3 Windows

## Summary

Replaced hardcoded `python3` in template `session-start.py` with cross-platform `_PYTHON_CMD` resolver.

## Changed files

| Path | Change |
| --- | --- |
| `packages/cli/src/templates/shared-hooks/session-start.py` | `_PYTHON_CMD` resolver + five hint sites |
| `.cursor/hooks/session-start.py` | Synced from template (dogfood) |

## Parent integration

Inline work on `main`; ref `7694ab74` (+ uncommitted dogfood hook sync at archive time).
