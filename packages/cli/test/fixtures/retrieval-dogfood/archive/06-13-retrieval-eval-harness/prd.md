# Add Trellis Retrieval Evaluation Harness

## Goal

Add fixture-driven evaluation coverage for retrieval evidence scoring, context packing, source degradation, and no-side-effect guarantees.

## Requirements

- Consume the `retrieval-evidence-scoring` handoff contract.
- Final acceptance must also consume the `retrieval-context-pack-builder` handoff contract.
- Build fixtures that represent real Trellis retrieval sources without live network or credentials:
  - task artifacts;
  - session memory results;
  - Smart Search manifests in `ok`, `degraded`, `failed`, and `not_configured` states;
  - codebase candidate evidence;
  - missing/no-match cases.
- Test deterministic ordering, budget behavior, omission reasons, and side-effect boundaries.
- Avoid live Smart Search, network, MCP, browser, or external code search calls.
- Keep fixtures small, readable, and close to the tests that consume them.
- Publish final handoff explaining the eval cases and what future retrieval changes must keep passing.

## Acceptance Criteria

- [ ] Eval fixtures cover all Phase 2/3 source types.
- [ ] Tests verify scoring behavior against stable expected scores or relative ordering.
- [ ] Tests verify context pack selection and omission behavior after pack builder is available.
- [ ] Tests include missing-source and degraded-source cases.
- [ ] Tests assert no retrieval commands are executed implicitly.
- [ ] Harness can run in CI/local test without credentials or network.

## Out Of Scope

- Live quality benchmarking against the web.
- Installing or configuring external eval services.
- Changing scoring or packing contracts except by returning to planning.
- Browser/UI tests.

## Dependency Notes

- Can begin fixture and harness structure after evidence scoring handoff is accepted.
- Final acceptance is blocked until context pack builder handoff is available.
- Can run in parallel with pack builder after scoring is accepted, but may need one final update after pack builder integration.
