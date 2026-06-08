# Implementation Plan

This is a research/decision subtask. Do not implement retrieval integration here.

## Phase 0: Task Rename and Scope Correction

- [x] Rename task directory to `06-08-code-retrieval-architecture-evaluation`.
- [x] Update task metadata title/name/id.
- [x] Update parent task `children`.
- [x] Update runtime session current task pointer.
- [x] Rewrite `prd.md` from Graphify-only ownership to retrieval architecture evaluation.
- [x] Rewrite `design.md` around semantic/exact/graph retrieval layers.
- [x] Update parent task docs to reference the renamed task and broader scope.

## Phase 1: Preserve Graphify Evidence

- [x] Record README evidence:
  - package purpose;
  - output files;
  - advertised commands;
  - install requirements.
- [x] Record `pyproject.toml` evidence:
  - package name;
  - dependencies;
  - optional extras;
  - script entrypoint.
- [x] Record architecture evidence:
  - pipeline;
  - extraction schema;
  - confidence labels.
- [x] Record Skill evidence:
  - full slash-command workflow;
  - build/update/query/path/explain behavior;
  - subagent dependence;
  - cost and consent boundaries.
- [x] Record CLI evidence:
  - actual `__main__.py` command dispatch;
  - gap between advertised slash-command behavior and observed CLI entrypoint.
- [x] Record MCP evidence:
  - tool list;
  - required existing `graph.json`;
  - graph path validation;
  - query limitations.
- [x] Record security evidence:
  - no network listener;
  - explicit URL ingest only;
  - sensitive file skipping;
  - path and label guards.
- [x] Preserve Graphify subdecision in `decision.md`.

## Phase 2: Identify CodeGraph Target

- [x] Search for likely CodeGraph projects.
- [x] Identify the exact CodeGraph repository/project the user likely means.
- [x] If multiple plausible projects exist, record candidates before final comparison.
- [x] Create `research/codegraph-candidates.md`.

## Phase 3: CodeGraph Evidence Collection

After the target CodeGraph project is identified:

- [x] Record README evidence.
- [x] Record install/runtime requirements.
- [x] Record CLI/MCP/library/API surfaces.
- [x] Record graph schema and output artifacts.
- [x] Record supported languages and parsing/indexing approach.
- [x] Record query capabilities:
  - definitions;
  - callers/callees;
  - imports/dependencies;
  - paths;
  - semantic search if present;
  - line-level grounding.
- [x] Record update/index freshness behavior.
- [x] Record security and local/remote data handling.
- [x] Record test/CI evidence where visible in docs/manifests.
- [x] Create `research/codegraph-evidence.md`.

## Phase 4: Retrieval Taxonomy and Matrix

- [x] Create `research/retrieval-taxonomy.md`.
- [x] Compare:
  - `fast-context-mcp`;
  - exact search with `rg`/grep/Git/local reads;
  - Graphify;
  - CodeGraph.
- [x] Map user intents to retrieval layers.
- [x] Define validation chains:
  - semantic -> exact;
  - graph -> source metadata -> exact;
  - exact -> file reads/tests.
- [x] Identify freshness and setup risks.

## Phase 5: Final Decision

- [x] Update `decision.md` from Graphify subdecision to full retrieval architecture decision.
- [x] State:
  - semantic retrieval owner;
  - exact retrieval owner;
  - graph retrieval owner;
  - graph build/update owner;
  - graph query owner;
  - Trellis bundled asset;
  - runtime dependency policy;
  - MCP policy;
  - validation chain;
  - next implementation task.
- [x] Explicitly answer whether Graphify, CodeGraph, both, or neither should be integrated.
- [x] State missing smoke tests before implementation.
- [x] Update parent task docs with final recommendation.

## Phase 6: Validation

- [x] Run `python ./.trellis/scripts/task.py validate 06-08-code-retrieval-architecture-evaluation`.
- [x] Validate parent task if parent docs changed.
- [x] Run `rg` checks for stale old task path.
- [x] Review `git status --short --branch`.
- [x] Do not run Graphify, CodeGraph, install dependencies, start MCP servers, or edit Trellis source.

## Current Decision Shape

```text
Semantic retrieval owner: fast-context-mcp
Exact retrieval owner: rg/grep/Git/local file reads
Graph retrieval owner: hybrid
Graphify role: optional architecture graph/wiki/mixed-corpus memory layer
CodeGraph role: CodeGraph-like structural code graph, first smoke-test candidate colbymchenry/codegraph
Validation chain: semantic/graph claims must be verified by exact search, file reads, and relevant tests/checks before edits
```
