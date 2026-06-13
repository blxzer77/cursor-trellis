# Build Trellis Retrieval Context Pack Builder

## Goal

Build a deterministic context pack builder that converts scored retrieval evidence into bounded context payloads with selected items, omitted items, budget metadata, and explanations.

## Requirements

- Consume the `retrieval-evidence-scoring` handoff contract; do not redefine evidence scoring.
- Accept scored evidence candidates from Phase 2/3 retrieval sources.
- Produce a stable JSON context pack shape for downstream agents.
- Pack output must include:
  - selected evidence items;
  - omitted evidence items with omission reasons;
  - budget target and budget used;
  - estimated size for each item;
  - pack-level summary and warnings;
  - deterministic ordering and tie-breakers.
- Support at least one explicit budget input, such as max items or max estimated tokens.
- Preserve side-effect-free behavior: pack building does not execute retrieval commands, Smart Search, network calls, MCP tools, or codebase searches.
- Keep existing `get_context.py` output backward compatible if pack metadata is surfaced there.
- Publish a handoff contract consumed by `retrieval-eval-harness`.

## Acceptance Criteria

- [ ] Pack builder consumes scored evidence objects from the scoring child contract.
- [ ] Pack output includes selected and omitted items with reasons.
- [ ] Pack behavior is deterministic under equal scores and repeated runs.
- [ ] Budget trimming is tested and documented.
- [ ] Missing or empty input returns an explicit empty pack rather than failing.
- [ ] Tests cover mixed sources, budget overflow, tie-breaking, and no-source cases.
- [ ] No retrieval source is automatically executed during pack building.

## Out Of Scope

- Defining scoring rules.
- Running live Smart Search or codebase retrieval.
- Building the full evaluation harness; this child adds focused pack tests only.
- Changing provider-specific Smart Search output.

## Dependency Notes

- Implementation depends on accepted `retrieval-evidence-scoring` handoff.
- Can run in parallel with `retrieval-eval-harness` after scoring contract is accepted.
