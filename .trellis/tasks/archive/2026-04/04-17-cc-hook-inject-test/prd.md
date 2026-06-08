# CC Hook Injection Test

Test whether Trellis's `inject-subagent-context.py` hook actually injects context into Claude Code sub-agents (Task/Agent tool).

## Canary string (PRD)

PRD_CANARY = **`PRD_MOON_TURTLE_91F3C2`**

If the sub-agent can quote this exact token back, the `prd.md` injection path works.

## Acceptance

1. Sub-agent correctly reports PRD_CANARY token
2. Sub-agent correctly reports SPEC_CANARY token (from test-spec.md referenced in implement.jsonl)
3. Sub-agent confirms it received Trellis-formatted context blocks (e.g. `=== .../prd.md (Requirements) ===` header)
