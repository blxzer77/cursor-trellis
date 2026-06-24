# Verification Evidence

## Validation results

- Verified `packages/cli/src/templates/shared-hooks/inject-subagent-context.py` strips UTF-8 BOM before `json.loads` (lines 170–172) and handles decode errors without silent exit.
- Dogfood `.cursor/hooks/inject-subagent-context.py` hash MATCH with template (7837 bytes thin-wrapper).

Validation evidence: source read + hash compare (2026-06-24).

## Final acceptance evidence

M-2 resolved: BOM-prefixed stdin on Windows no longer causes silent hook failure.

Accepted by user: inline Parent closure session (2026-06-24).

## Durable learning decision

No durable learning for this task scope.
