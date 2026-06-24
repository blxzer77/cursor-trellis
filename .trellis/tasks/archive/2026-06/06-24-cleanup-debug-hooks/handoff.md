# Child handoff — cleanup debug hooks

## Summary

Removed probe JSON scaffolding from `.trellis/scripts/`; confirmed no unregistered debug hook scripts in cursor-trellis.

## Changed files

| Path | Change |
| --- | --- |
| `.trellis/scripts/probe-byok.json` | Deleted |
| `.trellis/scripts/probe-native.json` | Deleted |

## Out of scope

MyHarness workspace-root `.cursor/hooks/*-debug.py` (separate harness tree, not cursor-trellis git root).
