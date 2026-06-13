# Add Trellis Retrieval Evidence Scoring

## Goal

Define and implement a Trellis-owned evidence scoring contract that normalizes artifact, session memory, Smart Search, and codebase evidence candidates into comparable, explainable scores.

## Requirements

- Consume Phase 2 public contracts:
  - `retrievalGuide.recommendations`
  - Smart Search `manifest.json`
  - Session Memory `results[]`
  - artifact search result metadata
  - codebase evidence guidance as candidate evidence
- Produce a stable evidence score JSON shape for downstream context packing.
- Score must be explainable, deterministic, and source-aware.
- Include at least these scoring dimensions:
  - source type
  - relevance
  - trust/source authority
  - freshness or recency
  - status/degradation
  - validation state
  - final priority/score
  - reason/explanation
- Treat Smart Search `failed` and `not_configured` as availability signals, not positive evidence.
- Treat session memory as historical context, not authoritative proof.
- Treat codebase retrieval as candidate evidence until current source, Git, or validation confirms it.
- Preserve side-effect-free behavior: scoring must not run Smart Search, network calls, MCP tools, or codebase search.
- Publish a handoff contract consumed by `retrieval-context-pack-builder` and `retrieval-eval-harness`.

## Acceptance Criteria

- [ ] Stable scored evidence JSON contract is documented in `handoff.md`.
- [ ] Scoring handles artifact, session-memory, smart-search, and codebase-evidence inputs.
- [ ] Degraded, failed, unavailable, and missing evidence states are represented explicitly.
- [ ] Result ordering is deterministic across repeated runs.
- [ ] Tests cover multiple sources, degraded Smart Search, session memory, candidate codebase evidence, and no-source/no-match cases.
- [ ] No retrieval source is automatically executed during scoring.

## Out Of Scope

- Building final context packs.
- Adding fixture-wide eval coverage beyond focused scoring tests.
- Changing Smart Search provider behavior.
- Changing session journal write format.
- Changing context loading to auto-run scoring unless explicitly approved in this child design.

## Dependency Notes

- This is the first Phase 3 child and has no Phase 3 child dependency.
- Pack builder and eval harness should wait for this child's `handoff.md` before final implementation.
