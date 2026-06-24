# Child handoff — beforeSubmitPrompt unreliability

## Summary

Confirmed C-2 on BYOK + Native; degraded retrieval-plan hook to telemetry-only; migrated routing to rules + AGENTS.md; updated context injection guide.

## Changed files

| Path | Change |
| --- | --- |
| `packages/cli/src/templates/shared-hooks/inject-retrieval-plan.py` | Telemetry-only mode |
| `.cursor/hooks/inject-retrieval-plan.py` | Synced from template |
| `.cursor/rules/retrieval-routing.mdc` | Reliable retrieval matrix |
| `AGENTS.md` | Manual router fallback |
| `.trellis/spec/guides/cursor-context-injection-guide.md` | Channel matrix update |
