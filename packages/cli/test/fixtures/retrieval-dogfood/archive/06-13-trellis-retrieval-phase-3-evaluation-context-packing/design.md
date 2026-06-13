# Design

## Architecture

Phase 3 is a parent orchestration task. It should not own direct implementation unless a child returns a parent-level integration defect that cannot be assigned back to one child.

The intended flow is:

```text
Phase 2 evidence sources
  -> evidence scoring contract
  -> bounded context pack builder
  -> fixture-driven eval harness
  -> parent integration review
```

## Child Boundaries

### Evidence Scoring

Owns the normalized evidence quality model:

- source type
- trust level
- freshness/recency
- status/degradation
- source-specific score input
- explanation
- stable JSON shape

This child should produce the contract consumed by both pack builder and eval harness.

### Context Pack Builder

Owns pack assembly and budget behavior:

- input: ranked recommendations and scored evidence candidates
- output: bounded context pack with selected items, omitted items, budget metadata, and reasons
- no automatic external retrieval
- deterministic sorting and trimming

This child should not redefine scoring. It consumes the scoring contract.

### Eval Harness

Owns fixtures and regression checks:

- fixture projects/tasks/journals/manifests
- source degradation cases
- no-match and missing-source behavior
- context pack budget cases
- no-side-effect checks

This child can build fixture infrastructure after evidence scoring is reviewed, then finalize end-to-end assertions after pack builder is reviewed.

## Parent Integration Policy

The parent reviewer accepts child output only when each child provides:

- `verify.md` with validation evidence, final acceptance evidence, and durable learning decision.
- `handoff.md` with downstream contract and compatibility notes.
- Code ref or reviewed diff identity.
- Clear statement of side effects and non-side effects.

The parent reviewer then:

- reviews child handoff contracts for compatibility;
- verifies the next dependent child can consume the contract;
- serially marks accepted/integrating/integrated in `task-map.md`;
- does not let a child mark itself integrated.

## Execution Topology

`parallel-staged`:

- Stage 1: `retrieval-evidence-scoring`
- Stage 2 parallel candidates after scoring accepted:
  - `retrieval-context-pack-builder`
  - `retrieval-eval-harness` fixture/harness work
- Stage 3: final eval-harness validation after pack-builder handoff is available

## Compatibility

- Phase 2 commands and JSON fields remain valid.
- New contracts must be additive.
- Context loading remains read-only by default.
- Generated dogfood and template scripts must stay synchronized when Python runtime files change.

## Risks

- Pack builder may duplicate scoring rules if the scoring contract is vague.
- Eval harness may overfit implementation details if fixtures assert private internals.
- Parallel Stage 2 can drift unless pack builder and eval harness both consume the same scoring handoff.
- Token-budget behavior can become non-deterministic if trimming depends on file-system order.
