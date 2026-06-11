# Codebase Retrieval Improvement Roadmap

## Baseline

- Benchmark target: `D:\MyHarness\openclaw`
- Evaluation harness: `D:\MyHarness\openclaw-retrieval-eval`
- Runner: `scripts/run-trellis-codebase-retrieval-stack.mjs`
- Report: `runs/trellis-codebase-retrieval-stack-20260611.md`
- Raw results: `runs/artifacts/trellis-codebase-retrieval-stack-20260611/results.json`
- Result: `128 / 300 = 42.7%`; final score with bonus: `131.0`
- Perfect cases: `4 / 50`
- Zero-score cases: `16 / 50`
- fast-context runtime errors: `0`
- CodeGraph index: `17462 files`, `304607 nodes`, `823750 edges`
- Graphify: intentionally excluded from the current design.

## Observed Weaknesses

1. The current runner is a heuristic fusion script, not a real retrieval orchestrator.
2. Chinese natural-language questions are not reliably converted into identifiers, constants, modules, file hints, or language hints.
3. CodeGraph is indexed, but the benchmark mostly uses shallow candidate lookup instead of structured traversal such as definitions, callers, callees, impact, and affected paths.
4. fast-context provides useful semantic recall, but it often over-ranks broad docs, changelog, package metadata, and configuration files for implementation-focused questions.
5. Ranking is not query-intent aware. Source, tests, docs, config, schema, and history files need different priors depending on the question type.
6. There is no LSP layer, so definition/reference/type navigation is approximated by text search and graph data.
7. Evidence scoring is too shallow: a candidate file can rank highly without snippet-level verification that it answers the question.
8. The benchmark harness does not yet run ablations, so it cannot isolate `rg`, CodeGraph, fast-context, LSP, and fusion contributions.

## Improvement Direction

1. Add a query-understanding layer.
   - Classify query type: symbol, call chain, architecture, config/schema, cross-language, tests, migration/history, implementation detail.
   - Extract identifiers, constants, file hints, module names, language hints, and likely path prefixes.
   - Generate tool-specific queries instead of sending one generic prompt to every tool.

2. Strengthen exact search.
   - Run `rg` first for extracted identifiers, strings, config keys, route names, and file hints.
   - Split Chinese questions into likely code tokens before searching.
   - Add path priors and penalties: source files should outrank docs for implementation questions; docs should outrank source only for documentation questions.
   - Penalize `CHANGELOG.md`, docs, generated files, and package metadata unless the query asks for history, release notes, or configuration.

3. Use CodeGraph structurally.
   - Use `query` for initial symbol discovery, then follow with callers, callees, impact, and affected-path traversal.
   - Map graph nodes back to implementation files and line ranges.
   - Treat CodeGraph as high-confidence structure evidence when exact symbol matches exist.

4. Reposition fast-context as semantic recall.
   - Use fast-context to recover candidates missed by exact search and graph traversal.
   - Constrain prompts with extracted identifiers and path exclusions for source questions.
   - Verify fast-context candidates with exact snippets before final ranking.

5. Add an LSP adapter.
   - Use definition, references, hover/type, implementation, and workspace symbol queries after exact/graph candidates are found.
   - Prioritize LSP for TypeScript, Python, Kotlin, Swift, and other languages where symbol relations are richer than text matches.

6. Build a retrieval orchestrator.
   - Plan per query: exact search -> graph traversal -> semantic recall -> LSP/source verification.
   - Normalize all candidates into one evidence model: file, line range, matched terms, symbol relation, semantic reason, snippet proof.
   - Rank with intent-aware weights and produce Top-5 with explainable evidence.

7. Improve the benchmark harness.
   - Move the runner and reports into a Git-tracked evaluation location.
   - Save per-tool raw output for reproducibility.
   - Add ablations: `rg-only`, `CodeGraph-only`, `fast-context-only`, `rg+CodeGraph`, `rg+fast-context`, full orchestrator.
   - Track category-level deltas so each change shows where it helped or hurt.

## Design Decision

Graphify should remain removed unless a concrete benchmark case proves it provides unique recall or relationship evidence that cannot be covered by CodeGraph, fast-context, LSP, and exact search. Its current cost is extra configuration and tool-routing complexity without demonstrated retrieval gain.
