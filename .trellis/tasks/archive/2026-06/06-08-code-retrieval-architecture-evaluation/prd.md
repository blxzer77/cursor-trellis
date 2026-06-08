# Evaluate Personal Code Retrieval Architecture

## Goal

Determine the best retrieval architecture for the user's personal Trellis workflow. The question is broader than Graphify: Trellis needs a clear routing model for semantic retrieval, graph/code-relationship retrieval, and exact keyword/symbol search.

Target model under evaluation:

```text
semantic/RAG retrieval: fast-context-mcp or equivalent
graph retrieval: Graphify vs CodeGraph or another code graph layer
exact retrieval: rg/grep/git/search primitives
workflow owner: Trellis routing skills and task policy
```

This task is research and decision work only. It does not implement runtime integration.

## Background

The user's original idea was:

- use RAG-like services for semantic retrieval;
- use `grep`/`rg` for exact keyword search;
- use Graphify as a persistent graph/wiki layer;
- evaluate whether CodeGraph or a CodeGraph-like system is better than Graphify for graph-oriented code retrieval.

Graphify has already been deeply researched in `research/graphify-evidence.md`. Current Graphify subdecision: Graphify is best treated as a hybrid optional capability: artifact-first, Skill/library for build/update, optional MCP for existing graph traversal, external runtime initially.

The broader question is now answered as a hybrid model: Graphify is not the right owner for code-specific relationship retrieval, but it remains useful for architecture/wiki/mixed-corpus memory. CodeGraph-like tools are better for code-level structural graph retrieval. Both must compose with `fast-context-mcp` and exact search inside Trellis.

## Research Questions

- What retrieval type should own each user intent?
- When is semantic search better than exact search?
- When is graph retrieval better than semantic search?
- Is Graphify or CodeGraph better for persistent code graph retrieval?
- Should Trellis route graph retrieval through Skill, MCP, CLI/library, artifacts, or a hybrid?
- How should Trellis avoid duplicated or stale retrieval layers?

## Requirements

- Compare at least these retrieval surfaces:
  - `fast-context-mcp` semantic code search;
  - exact keyword/symbol search using `rg`, grep-like commands, Git inspection, and local file reads;
  - Graphify as persistent architecture graph/wiki/memory;
  - CodeGraph or the specific CodeGraph project selected for evaluation.
- Treat "CodeGraph" as an ambiguous project name; record the concrete repositories and API surfaces evaluated before recommending a first smoke-test candidate.
- Evaluate quality by intent:
  - "where is X implemented?";
  - "find every usage of X";
  - "what concepts connect A and B?";
  - "what are the core architectural communities?";
  - "what changed recently?";
  - "what should I inspect before refactor?";
  - "retrieve exact definitions/callers/imports";
  - "navigate project memory across sessions."
- Evaluate tradeoffs:
  - precision and recall;
  - line-level grounding;
  - graph/path explainability;
  - index freshness;
  - runtime and dependency weight;
  - MCP configuration complexity;
  - Windows compatibility;
  - project-local vs global configuration;
  - setup and approval boundaries;
  - whether results can be validated with exact search.
- Preserve `fast-context-mcp` as the default live semantic code search candidate unless evidence proves another semantic layer is better.
- Preserve `rg`/grep as the exact-search baseline and final verification layer.
- Do not install, execute, vendor, or configure Graphify or CodeGraph in this task.
- Do not modify Trellis source templates in this task.
- Do not change MCP configuration in this task.

## Non-Goals

- No bundled `trellis-graphify` or `trellis-codegraph` implementation yet.
- No Graphify or CodeGraph runtime dependency added to Trellis.
- No graph generation on the local Trellis repo.
- No MCP server registration.
- No workflow rewrite.
- No claim that CodeGraph is better or worse until source evidence is collected.

## Acceptance Criteria

- [x] The task has been renamed from Graphify-only ownership to code retrieval architecture evaluation.
- [x] Existing Graphify evidence is preserved as a sub-research artifact.
- [x] A CodeGraph evidence document identifies the exact CodeGraph project evaluated and records source-backed facts.
- [x] A retrieval taxonomy compares semantic, exact, and graph retrieval.
- [x] A decision matrix maps user intents to preferred retrieval surfaces.
- [x] The final recommendation states whether Graphify, CodeGraph, both, or neither should become Trellis graph-layer capability.
- [x] The recommendation explains how `fast-context-mcp` and `rg`/grep complement the graph layer.
- [x] The recommendation states missing smoke tests before implementation.
- [x] Parent task documents point to this renamed child task.

## Current Working Model

Do not treat one search layer as universally best.

Final routing:

- Use `fast-context-mcp` for semantic "where should I look?" discovery.
- Use `rg`/grep/Git for exact term, symbol, config, and validation search.
- Use a CodeGraph-like layer for code-specific structure: definitions, callers, callees, imports, paths, impact, and affected tests.
- Use Graphify for persistent architecture/wiki/mixed-corpus memory: reports, communities, god nodes, conceptual links, and cross-session architecture context.
- Bundle a future Trellis routing skill/profile, not Graphify or CodeGraph runtimes, until smoke tests and approval justify runtime management.
