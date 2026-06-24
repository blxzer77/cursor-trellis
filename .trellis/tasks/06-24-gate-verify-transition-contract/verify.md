# Verification Evidence

## Implementation summary

Hardened Trellis gate/verify binding via a single `validate_transition_readiness()` contract in `task_gates.py`, wired into `record-gate`, Parent `integrate-child accepted`, Parent archive, and `integrate-through --check`.

## Validation commands

Validation commands: `pnpm --filter @blxzer/cursor-trellis test -- packages/cli/test/scripts/task-gates-transition-contract.integration.test.ts` — 7 passed (2026-06-24)

Validation commands: `pnpm typecheck` — pass (2026-06-24)

Validation commands: `python -m compileall -q packages/cli/src/templates/trellis/scripts .trellis/scripts` — pass (2026-06-24)

## Check evidence

Check evidence: manual review of transition contract in `task_gates.py`, `task_map.py`, `parent_orchestration.py`; integration tests cover record-gate rejection, Full Child accept gate, Lite bypass, integrate-through simulation, Parent archive drift.

## Reviewed change-set

Reviewed change-set: task-gates-transition-contract implementation (templates + dogfood mirror + workflow + integration tests)

## Final acceptance evidence

Final acceptance evidence: PRD acceptance criteria satisfied — record-gate bound to substantive verify evidence; Full Child code-review required before Parent accept; Parent archive requires integrated children + integration-review; integrate-through check fixed; Lite closeout explicit.

## Durable learning decision

Durable learning decision: workflow.md archive/gate sections updated to document enforced transition boundaries; no separate spec file change required beyond workflow mirror.
