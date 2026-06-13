# Improve Trellis session memory retrieval

## Goal

Improve Trellis session memory search, ranking, and reusable decision context without coupling it to Smart Search implementation details.

## Requirements

- Confirmed evidence from Trellis:
  - Workspace journals live under `.trellis/workspace/<developer>/journal-N.md`.
  - `add_session.py` appends structured session records and updates workspace `index.md`.
  - `session_context.py` reports the active journal file and line count.
  - Phase 1 artifact search already indexes `workspace` artifacts, but there is no dedicated session-memory query layer or decision-oriented result contract.
- Improve how Trellis finds reusable session history, prior decisions, and recent work context.
- Keep session memory local to Trellis workspace/journal data; do not depend on Smart Search implementation details.
- Produce a stable result summary shape that downstream context ranking can consume.
- Make ranking explainable enough that agents can tell why a memory item was surfaced.
- Preserve existing journal/session recording behavior.
- Treat session memory as workspace-local evidence, not as a replacement for task artifacts or codebase retrieval.

## Acceptance Criteria

- [ ] Planning identifies current session/journal data sources and their limitations.
- [ ] Retrieval results include enough metadata for downstream ranking or display.
- [ ] Existing session journal writes remain compatible.
- [ ] Tests or smoke checks cover memory retrieval behavior and no-match behavior.
- [ ] Child handoff documents the contract consumed by `retrieval-context-ranking`.

## Notes

- This child may run in parallel with `06-13-retrieval-smart-search-integration`.
- It should not call Smart Search or assume external network availability.
- Open product decision: whether memory retrieval should cover only completed session records or also in-progress notes. Recommended default is completed session records plus active-task references from current context.
