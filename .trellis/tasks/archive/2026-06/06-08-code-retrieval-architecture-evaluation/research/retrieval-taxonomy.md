# Retrieval Taxonomy

Research date: 2026-06-08

This document defines the retrieval routing model for the user's personal Trellis workflow. It compares semantic/RAG retrieval, exact search, Graphify, and CodeGraph-like structural code graphs.

## Retrieval Layers

### 1. Semantic/RAG Retrieval

Primary owner: `fast-context-mcp`

Best for:

- "Where should I look for this concept?"
- "Which files are relevant to this behavior?"
- "Find implementation areas for a natural-language description."
- Early exploration when exact terms are unknown.

Limits:

- Semantic hits are candidates, not proof.
- May miss exact renamed symbols, config keys, and string literals.
- Must be verified with exact search and file reads before edits.

### 2. Exact Retrieval

Primary owner: `rg`, grep-like tools, Git inspection, and local file reads.

Best for:

- exact symbol, string, config key, route, env var, file path, and package-script searches;
- "find every usage";
- validating semantic and graph claims;
- checking what changed in Git;
- final grounding before code edits.

Limits:

- Weak for synonyms, architectural concepts, and indirect relationships.
- No persistent memory or relationship graph.

### 3. Structural Code Graph Retrieval

Primary owner: CodeGraph-like tool, pending smoke test.

Best for:

- callers/callees;
- imports/dependencies;
- definitions and symbol context;
- shortest path between code symbols;
- impact analysis before refactor;
- affected test discovery;
- execution flow or dependency traversal;
- index-backed source context for agent workflows.

Best candidate for first evaluation:

```text
colbymchenry/codegraph
```

Reason: strongest evidence for immediate personal agent workflow fit, with Codex support, project-local `.codegraph/`, CLI plus MCP, and focused tools.

Other candidates:

- `optave/ops-codegraph-tool` if Trellis needs richer structural governance, CI gates, dataflow, CFG, communities, and architecture boundaries.
- `codegraph-ai/CodeGraph` if Trellis needs a broader MCP/LSP platform with memory and docs store.

Limits:

- Graphs can be stale.
- Static analysis is best-effort for dynamic code.
- Some candidates have heavy dependencies, telemetry/model-download questions, or large MCP tool surfaces.
- Graph output still needs exact verification for high-risk edits.

### 4. Architecture Graph / Wiki Retrieval

Primary owner: Graphify, optional.

Best for:

- persistent architecture reports;
- `graphify-out/wiki/index.md`;
- `GRAPH_REPORT.md`;
- god nodes and communities;
- surprising cross-file or cross-document relationships;
- mixed corpus: code, docs, papers, PDFs, screenshots, diagrams;
- conceptual "what connects A and B?" questions across more than source code.

Limits:

- Not the best owner for exact callers/callees/imports.
- Build/update workflow is Skill/library-oriented and heavier than exact search.
- MCP only queries an existing graph artifact.
- Runtime install and graph generation require approval.

## Intent Routing Matrix

| Intent | First tool/layer | Follow-up | Reason |
| --- | --- | --- | --- |
| "Where is X implemented?" | `fast-context-mcp` | `rg` + file reads | Semantic discovery finds candidate files; exact search validates. |
| "Find every usage of X" | `rg` | CodeGraph if relationship context matters | Exact recall is primary. |
| "Who calls X?" | CodeGraph-like structural graph | `rg` + file reads | Call graph is graph-native; exact search checks suspicious misses. |
| "What does X call?" | CodeGraph-like structural graph | file reads | Callee traversal is graph-native. |
| "What imports this module?" | CodeGraph-like structural graph or `rg` | file reads | Use graph if index exists; exact search is fallback and validation. |
| "What breaks if I change X?" | CodeGraph-like impact | tests/typecheck/lint + `rg` | Impact analysis is the graph layer's strongest edit-preflight use. |
| "What files changed recently?" | Git commands | CodeGraph diff impact if indexed | Git is authoritative for history; graph adds blast radius. |
| "What concepts connect A and B?" | Graphify artifacts/MCP or CodeGraph path, depending on concept type | file reads | Code symbols use CodeGraph; broad architecture/docs concepts use Graphify. |
| "What are the core architecture communities?" | Graphify report/wiki or CodeGraph communities if available | source reads | Graphify is better for narrative architecture; CodeGraph is better for code-only communities. |
| "Search web/docs/API/current sources" | `smart-search-cli` | fetched evidence | Separate from local code retrieval. Verified usable with user-environment access; sandboxed runs may need approval to read config and access providers. |
| "Verify a config key exists" | `rg` | file reads | Semantic/graph search is unnecessary. |
| "Remember architecture across sessions" | Graphify artifacts or CodeGraph memory/docs if adopted | Trellis task/spec docs | Persistent artifacts beat transient chat context. |

## Quality Model

No single retrieval tool is "better" globally. Quality depends on the query:

- Semantic retrieval optimizes discovery from ambiguous language.
- Exact retrieval optimizes literal recall and reproducibility.
- CodeGraph-like structural retrieval optimizes code relationships and edit impact.
- Graphify optimizes architecture-level persistence, reports, and mixed-corpus relationship memory.

## Recommended Trellis Routing Policy

Trellis should bundle a routing skill/profile, not hardwire runtimes.

Future bundled asset:

```text
trellis-code-retrieval
```

Responsibilities:

1. Classify the retrieval intent.
2. Route semantic code discovery to `fast-context-mcp`.
3. Route exact verification to `rg`, Git, and file reads.
4. Route code-relationship queries to an approved CodeGraph-like layer when indexed.
5. Route architecture/wiki/mixed-corpus queries to Graphify artifacts or optional Graphify MCP when artifacts exist.
6. Ask before install, index, build, watch, hook, MCP config, or global config changes.
7. Require exact verification before edits when a claim affects behavior.

## Recommended Decision

```text
Semantic retrieval owner: fast-context-mcp
Exact retrieval owner: rg/Git/local file reads
Code structural graph owner: CodeGraph-like tool, first candidate colbymchenry/codegraph
Architecture graph/wiki owner: Graphify optional artifacts plus optional MCP
Graph build/update owner: external runtime, user-approved
Graph query owner: artifact-first, then optional MCP/CLI depending on layer
Trellis bundled asset: trellis-code-retrieval routing skill/profile
Runtime dependency policy: external until smoke tests prove value
MCP policy: optional/recommended for indexed graph traversal, never auto-configured
Validation chain: semantic/graph -> source metadata -> exact search/file reads -> tests/typecheck/build when relevant
```

## Answer To "Graphify Or CodeGraph?"

For code retrieval, CodeGraph-like structural indexing is better than Graphify.

For architecture memory, mixed-corpus wiki/report generation, and conceptual communities, Graphify remains useful and should not be discarded.

The best Trellis architecture is not Graphify vs CodeGraph. It is:

```text
fast-context-mcp for semantic discovery
rg/Git/file reads for exact proof
CodeGraph-like layer for code structure and refactor impact
Graphify for persistent architecture/wiki/mixed-corpus memory
```

## Validation Requirements Before Runtime Integration

Before Trellis can claim support for a specific CodeGraph or Graphify runtime:

- run the candidate on a tiny fixture;
- verify Windows commands and path behavior;
- verify output/source grounding;
- compare results against `rg` and direct reads;
- inspect index freshness after edits;
- confirm no unexpected network/telemetry/global config changes;
- measure prompt/tool schema overhead;
- document approval prompts for install/index/watch/MCP setup.
