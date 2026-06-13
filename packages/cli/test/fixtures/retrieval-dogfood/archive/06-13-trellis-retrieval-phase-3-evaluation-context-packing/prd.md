# Trellis Retrieval Phase 3 - Evidence Evaluation and Context Packing

## Goal

Turn Phase 2 retrieval recommendations and evidence manifests into a bounded, reviewable context package that downstream agents can use without re-reading every source or over-trusting weak evidence.

## User Value

Agents should be able to answer "what context should I load, why, and how much?" from Trellis runtime evidence instead of manually juggling artifact search, session memory, Smart Search, and codebase candidate evidence.

## Confirmed Facts

- Phase 2 added explicit Smart Search evidence manifests through `run_smart_search.py`.
- Phase 2 added local session memory search through `search_memory.py`.
- Phase 2 added additive `retrievalGuide.recommendations` in context loading.
- Phase 2 preserved side-effect-free context loading: no automatic Smart Search, network, or codebase scans.
- Current retrieval recommendations expose source, priority, confidence, reason, action, and reference, but they do not yet normalize evidence quality or produce bounded context packs.

## Requirements

- Split implementation into three independently reviewable child tasks:
  - `06-13-retrieval-evidence-scoring`
  - `06-13-retrieval-context-pack-builder`
  - `06-13-retrieval-eval-harness`
- Define a staged-parallel execution model:
  - Evidence scoring runs first and publishes the score contract.
  - Context pack builder can implement after the scoring contract is reviewed.
  - Evaluation harness can begin fixture/harness work after the scoring contract is reviewed and can run in parallel with pack builder, but final acceptance must include pack-builder behavior.
- Keep all new runtime behavior additive and side-effect free by default.
- Preserve the Phase 2 source boundaries:
  - Smart Search evidence is consumed through manifests, not raw Smart Search internals.
  - Session memory is consumed through stable result metadata, not journal parser internals unless the child owns that boundary.
  - Codebase evidence remains candidate evidence until confirmed by current source, Git, or validation.
- The current Codex session is parent planner/reviewer only. Implementation will be performed by other agents.
- Child agents must produce `verify.md` and `handoff.md`; the parent reviewer accepts/integrates child results.

## Acceptance Criteria

- [ ] Parent task map records staged-parallel topology and child dependencies.
- [ ] Each child has complete `prd.md`, `design.md`, and `implement.md`.
- [ ] Child artifacts clearly state execution boundaries, handoff contract, and validation expectations.
- [ ] Parent plan identifies which child tasks can run in parallel and which cannot.
- [ ] Parent reviewer responsibilities are explicit: receive results, inspect evidence, run or review validation, then integrate child outputs.
- [ ] No Phase 3 child is started by this planning session.

## Out Of Scope

- Implementing code in this session.
- Starting execution approval for any child.
- Changing Smart Search provider behavior.
- Changing global Codex, MCP, or credential configuration.
- Adding automatic network or external retrieval during context loading.

## Parallelization Summary

- First stage: `retrieval-evidence-scoring` only.
- Second stage after scoring contract is accepted:
  - `retrieval-context-pack-builder` can run.
  - `retrieval-eval-harness` can run in parallel for fixtures and harness structure.
- Final eval-harness acceptance should wait for pack-builder output so tests can cover the complete scoring-to-pack flow.
