# Child handoff — BOM strip subagent hook

## Summary

BOM strip + stdin robustness backported to template `inject-subagent-context.py`; dogfood copy matches template.

## Changed files

| Path | Change |
| --- | --- |
| `packages/cli/src/templates/shared-hooks/inject-subagent-context.py` | BOM strip on stdin JSON |
| `.cursor/hooks/inject-subagent-context.py` | Already synced (MATCH) |
