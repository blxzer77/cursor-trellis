# Add Trellis retrieval context ranking

## Goal

Rank and recommend relevant artifacts, memory entries, and retrieval queries in Trellis context loading after upstream evidence sources expose stable contracts.

## Requirements

- Recommend the most relevant retrieval sources for the current Trellis context using stable outputs from artifacts, session memory, Smart Search evidence, and codebase retrieval guidance.
- Consume upstream contracts from `retrieval-smart-search-integration` and `retrieval-session-memory`; do not read their internals directly.
- Keep recommendations explainable and additive in text and JSON context output.
- Preserve existing `get_context.py` behavior when no ranking inputs are available.
- Keep context loading side-effect free: do not auto-run Smart Search, do not write manifests, and do not perform expensive codebase scans from context loading.
- Use selected task metadata and artifact presence to build concrete next actions such as artifact search, session memory search, Smart Search evidence capture, and codebase evidence checks.

## Acceptance Criteria

- [ ] Implementation starts only after upstream Smart Search and session memory handoff contracts are reviewed or the parent contract is explicitly updated.
- [ ] Ranked recommendations include source type, reason, confidence or priority, and a concrete next action/reference.
- [ ] JSON output remains backward compatible with additive ranking fields.
- [ ] Tests cover ranking with multiple sources, missing sources, and no relevant matches.
- [ ] Parent final verification confirms ranking connects the Phase 2 retrieval sources coherently.
- [ ] Context loading remains read-only and does not invoke network, Smart Search, or codebase search commands automatically.

## Notes

- Upstream Smart Search and session memory children are integrated and archived.
- Smart Search handoff contract: consume manifest metadata as explicit external evidence; do not parse raw Smart Search output directly.
- Session memory handoff contract: consume `source: "session-memory"` result metadata as local historical context, not authoritative task truth.
