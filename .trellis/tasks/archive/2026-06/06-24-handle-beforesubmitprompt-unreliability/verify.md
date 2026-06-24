# Verification Evidence

## Validation results

- Dual-environment marker probe (BYOK + Native) documented in `prd.md` Step 1: L1 hook not invoked, L2 marker not delivered.
- `inject-retrieval-plan.py` (template + dogfood) downgraded to telemetry-only (`action: telemetry-only`, no stdout injection).
- `.cursor/rules/retrieval-routing.mdc` `alwaysApply: true`; `AGENTS.md` has manual `route_codebase_retrieval.py --instructions` fallback.
- `.trellis/spec/guides/cursor-context-injection-guide.md` channel matrix includes `beforeSubmitPrompt` row marked unreliable.

Validation evidence: prd probe record + source inspection + channel matrix read (2026-06-24).

## Final acceptance evidence

C-2 mitigation complete: routing moved to reliable channels; hook retained for REC-03 telemetry only.

Accepted by user: inline Parent closure session (2026-06-24).

## Durable learning decision

Learning artifact: `.trellis/spec/guides/cursor-context-injection-guide.md` — documents beforeSubmitPrompt unreliability and D-1 subagent dispatch primary path.
