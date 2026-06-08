# CodeGraph Candidate Survey

Research date: 2026-06-08

This document records source-backed candidate identification for the ambiguous name "CodeGraph". No repository was installed, cloned, executed, or configured.

## Search Evidence

GitHub repository search and direct README/manifest reads found several plausible candidates. The name is ambiguous enough that a Graphify-vs-CodeGraph decision must state which CodeGraph is being evaluated.

## Candidate Table

| Candidate | Evidence read | Fit for Trellis retrieval | Initial classification |
| --- | --- | --- | --- |
| `codegraph-ai/CodeGraph` | `README.md`, root `Cargo.toml`, `mcp-package/package.json`, `crates/codegraph-server/src/`, `crates/codegraph-server/src/mcp/` | Strong. Rust server, MCP/LSP, 38 languages, persistent graph/memory/docs store, many graph and semantic tools. | Broad code-intelligence MCP/LSP platform. |
| `colbymchenry/codegraph` | `README.md`, `package.json`, `src/mcp/`, `src/mcp/server-instructions.ts` | Very strong for this user's agent workflow. Explicitly supports Codex CLI, Claude Code, Cursor, opencode, Gemini, Kiro; uses `.codegraph/` project index; tool guidance is agent-first. | Best immediate personal-agent fit. |
| `optave/ops-codegraph-tool` | `README.md`, `package.json`, `src/mcp/`, `src/mcp/tool-registry.ts` | Strong but heavier. Adds CI gates, architecture rules, dataflow, CFG, semantic search, co-change, communities, and rich MCP surface. | Best structural governance / CI candidate. |
| `CodeGraphContext/CodeGraphContext` | `README.md`, `pyproject.toml`, `docs/CLI_COMPLETE_REFERENCE.md` | Moderate. Python CLI/MCP with multiple graph DB backends and 55 CLI commands, but heavier DB/setup surface and alpha classifier. | Python graph database toolkit. |
| `Bikach/codegraph-landing` | `README.md` | Weak as implementation source. It is a landing/docs site, not the core code graph runtime. | Documentation/landing project only. |

## Primary Candidate For This Task

For the user's Trellis refactor, the most relevant "CodeGraph" evidence comes from `colbymchenry/codegraph`, because its README and MCP server instructions explicitly target AI coding agents including Codex CLI. It is also project-local (`.codegraph/`), local-only, and focused on reducing grep/read exploration by giving agents a pre-indexed code graph.

However, the final Trellis design should not hardcode only that implementation yet. The evidence suggests a broader category:

```text
CodeGraph-like structural code index:
  project-local index
  symbol/call/import graph
  CLI plus optional MCP
  callers/callees/impact/path/context queries
  freshness/status reporting
  exact file/source grounding
```

Within that category:

- `colbymchenry/codegraph` is the best immediate personal workflow candidate.
- `optave/ops-codegraph-tool` is worth a later deeper trial if Trellis needs CI gates, dataflow, CFG, communities, and architecture boundaries.
- `codegraph-ai/CodeGraph` is worth a later deeper trial if Trellis needs a larger MCP/LSP platform with memory and doc indexing.
- `CodeGraphContext/CodeGraphContext` is less attractive for the first Trellis integration because its Python graph database setup overlaps the operational complexity already seen with Graphify.

## Candidate-Specific Risks

### `colbymchenry/codegraph`

Strengths:

- README explicitly supports Codex CLI and other AI coding agents.
- CLI commands include `init`, `index`, `sync`, `status`, `query`, `files`, `callers`, `callees`, `impact`, `affected`, and `serve --mcp`.
- MCP tools include `codegraph_explore`, `codegraph_search`, `codegraph_callers`, `codegraph_callees`, `codegraph_impact`, `codegraph_node`, `codegraph_files`, and `codegraph_status`.
- Server instructions say `codegraph_explore` can return relevant source grouped by file.
- Local SQLite index at `.codegraph/codegraph.db`.
- README describes automatic file watching and staleness banners.

Risks:

- MCP instructions say "Trust codegraph's results - don't re-verify them with grep." Trellis must override this for high-risk edits: graph output is high-value context, not final proof.
- Static call resolution is best-effort and ambiguous calls may return multiple candidates.
- It is best for code structure, not mixed-corpus architecture notes, PDFs, or image-derived knowledge.

### `codegraph-ai/CodeGraph`

Strengths:

- Rust workspace with parser crates, server crate, memory crate, and MCP module.
- README advertises MCP, LSP, persistent memory, docs store, graph-only mode, one-shot `--run-tool`, tool profiles, semantic search, PR context, and 38 languages.
- `mcp-package/package.json` publishes `@astudioplus/codegraph-mcp`.

Risks:

- Broader operational footprint than the user's immediate need.
- README mentions embeddings and model auto-download on first run; this requires explicit approval in Trellis.
- `mcp-package/package.json` depends on `posthog-node`, and the server tree contains telemetry code; telemetry behavior must be smoke-tested before adoption.
- Some advertised counts differ across README/package text, so installed version must be checked before implementation claims.

### `optave/ops-codegraph-tool`

Strengths:

- README describes 30+ MCP tools, function-level dependency graph, CI gates, complexity, dataflow, CFG, semantic search, co-change, communities, and architecture boundaries.
- Tool registry confirms tools including `context`, `where`, `fn_impact`, `diff_impact`, `semantic_search`, `path`, `communities`, `dataflow`, `cfg`, `check`, and `batch_query`.
- Local SQLite graph and optional MCP.

Risks:

- Node engine requirement is `>=22.12.0`.
- The tool surface is much larger than a minimal personal retrieval router.
- Semantic search overlaps `fast-context-mcp`; Trellis should avoid duplicate default semantic owners.
- Governance/CI strength may become workflow noise if introduced too early.

### `CodeGraphContext/CodeGraphContext`

Strengths:

- Python package with `cgc` and `codegraphcontext` commands.
- CLI reference includes index/list/delete/stats/watch, callers/callees/chain/deps/tree/complexity/dead-code, find name/pattern/type/content, MCP setup/start/tools, and bundle export/import/load.
- Supports multiple DB backends including KuzuDB, LadybugDB, FalkorDB, Neo4j.

Risks:

- Python dependency stack and DB backend setup are heavier than a simple project-local index.
- Project classifier says alpha.
- MCP setup wizard can modify IDE/agent configuration; Trellis must not run it without explicit approval.

## Conclusion From Candidate Survey

"CodeGraph" should mean a structural code graph retrieval layer, not a replacement for every retrieval surface.

For the next Trellis design step, compare Graphify against the CodeGraph-like layer as follows:

- Graphify is the better candidate for persistent architecture artifacts, wiki/report output, mixed corpus, and conceptual community summaries.
- CodeGraph-like tools are better candidates for code-level graph retrieval: definitions, callers, callees, imports, shortest paths, impact analysis, affected tests, and edit preflight.
- Exact `rg`/Git/file reads remain the verification baseline.
- `fast-context-mcp` remains the semantic/RAG discovery owner unless a future smoke test proves a CodeGraph semantic mode is better for the user's repos.
