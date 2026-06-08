# Design

## Decision Frame

This task decides the retrieval architecture that Trellis should route for the user's personal workflow. It must not collapse all retrieval into one tool. Different retrieval surfaces answer different questions.

The target architecture has three retrieval layers:

1. **Semantic/RAG retrieval**: fuzzy code understanding and file discovery.
2. **Exact retrieval**: deterministic keyword, symbol, config, path, Git, and file-content search.
3. **Graph retrieval**: persistent relationship, architecture, community, path, and memory retrieval.

The core design problem is assigning user intent to the right layer, then defining when layers must be chained.

## Retrieval Surfaces

### fast-context-mcp

Candidate role: live semantic code search.

Strengths:

- natural-language search over a local project;
- relevant file paths and line ranges;
- suggested grep keywords;
- low-friction during implementation;
- already part of the user's current MCP/tooling set.

Limits to verify:

- not a persistent architecture graph;
- semantic retrieval can miss exact renamed symbols or dynamic config keys;
- result quality depends on indexing/model behavior;
- must be validated with exact file reads or `rg` before edits.

### Exact Search (`rg`, grep-like commands, Git, local reads)

Candidate role: precision and verification layer.

Strengths:

- exact term/symbol/config matching;
- reproducible output;
- no dependency/index freshness risk;
- good for call sites, imports, env keys, test names, route names, package scripts, and file discovery;
- required before changing high-risk behavior.

Limits:

- weak for conceptual or synonym queries;
- cannot infer architecture communities;
- can produce noisy results for common terms;
- does not preserve cross-session memory.

### Graphify

Candidate role: persistent architecture graph/wiki/memory layer.

Evidence already recorded in `research/graphify-evidence.md`.

Current subdecision:

- artifact-first for `graphify-out/wiki/index.md` and `graphify-out/GRAPH_REPORT.md`;
- future `trellis-graphify` routing Skill for consent and operation selection;
- external `graphifyy` runtime for build/update;
- optional Graphify MCP for existing `graph.json` traversal;
- do not vendor upstream 47 KB Claude Skill unchanged.

Known strengths:

- persistent `graphify-out/graph.json`;
- `GRAPH_REPORT.md`;
- agent-crawlable wiki;
- communities and god nodes;
- path/neighborhood queries through MCP;
- mixed corpus support: code, docs, papers, images.

Known limits:

- build/update workflow is Claude Skill-oriented and not a simple CLI API in observed `__main__.py`;
- semantic extraction depends on agent/subagent orchestration;
- runtime dependencies are heavier than exact search or MCP-only tooling;
- global MCP config is awkward because graph paths are project-local.

### CodeGraph

Candidate role: code-specific graph retrieval layer.

Status: researched as a CodeGraph-like category with several concrete repositories.

"CodeGraph" can mean multiple things:

- a repository/project literally named CodeGraph;
- a code property graph engine;
- a code dependency/call graph extractor;
- a code graph RAG framework;
- a language-server/tree-sitter based symbol graph;
- a specific MCP or CLI tool.

Evidence was collected for:

- `colbymchenry/codegraph`;
- `codegraph-ai/CodeGraph`;
- `optave/ops-codegraph-tool`;
- `CodeGraphContext/CodeGraphContext`;
- `Bikach/codegraph-landing`.

Decision:

- CodeGraph-like tools are better than Graphify for code-level structural retrieval.
- `colbymchenry/codegraph` is the first smoke-test candidate for personal Trellis because it explicitly supports Codex CLI, project-local `.codegraph/`, and focused MCP/CLI tools for agent workflows.
- `optave/ops-codegraph-tool` is the future candidate for richer structural governance and CI gates.
- `codegraph-ai/CodeGraph` is the future candidate for a broader Rust MCP/LSP platform with memory/docs store.
- Trellis should not bundle a runtime until a separate approved smoke-test task verifies install, indexing, query grounding, freshness, telemetry/network behavior, and MCP overhead.

## Intent Routing Matrix

| User intent | Primary layer | Secondary layer | Why |
| --- | --- | --- | --- |
| "Where is X implemented?" | `fast-context-mcp` | `rg` + file reads | Semantic discovery, then exact validation. |
| "Find every usage of X" | `rg`/exact search | Graph layer if relationship context matters | Exact recall matters more than semantic ranking. |
| "What imports/calls/defines X?" | CodeGraph-like structural graph | `rg` + file reads | Symbol relationships need deterministic backing. |
| "What concepts connect A and B?" | Graphify for concepts; CodeGraph for code symbols | file reads / exact search | Choose graph layer by whether the nodes are architecture concepts or code symbols. |
| "What are core architectural modules?" | Graphify report/wiki; CodeGraph communities if code-only | `fast-context-mcp` for implementation details | Communities/god nodes are graph-native, but Graphify is stronger for narrative architecture memory. |
| "What should I inspect before refactor?" | graph layer + `fast-context-mcp` | `rg` for validation | Architecture first, then file/line discovery. |
| "Search docs/API/current web" | `smart-search-cli` | exact fetch/file checks | Outside local code retrieval; keep separate. |
| "Verify a key exists/config used" | `rg`/exact search | file reads | Semantic tools are unnecessary and risk false negatives. |
| "Recall architecture from previous sessions" | graph artifacts/wiki | `fast-context-mcp` for fresh code | Persistent memory, then fresh implementation lookup. |

## Layer Chaining Rules

1. Semantic results are candidates, not proof. Verify with file reads or exact search before edits.
2. Exact search is proof for literal presence, not proof of architecture meaning.
3. Graph retrieval explains relationships, but every important claim must remain traceable to graph source metadata or raw files.
4. Graph artifacts should be read before starting Graphify MCP because they are cheap and stable.
5. Build/update/index operations require approval because they write artifacts and may be expensive.
6. MCP configuration changes require approval and should be project-scoped when graph paths are project-local.

## Evaluation Criteria

For each candidate graph layer, score:

- **Grounding**: file path, line range, source metadata.
- **Relationship quality**: calls/imports/uses/data flow/concept links.
- **Query quality**: path, neighbor, community, broad graph search.
- **Index freshness**: update cost and stale index risk.
- **Operational fit**: CLI/MCP/library/artifacts, cross-platform behavior.
- **Workflow fit**: whether Trellis can route it without hidden setup.
- **Dependency weight**: runtime size and installation complexity.
- **Safety**: no hidden network, no credential exposure, no source execution.
- **Complementarity**: whether it adds value beyond `fast-context-mcp` and `rg`.

## Decision Outputs

The final decision should state:

```text
Semantic retrieval owner: <surface>
Exact retrieval owner: <surface>
Graph retrieval owner: <Graphify|CodeGraph|hybrid|none>
Graph build/update owner: <surface>
Graph query owner: <surface>
Trellis bundled asset: <skill/profile/docs>
Runtime dependency policy: <external|managed>
MCP policy: <none|optional|recommended|required>
Validation chain: <how semantic/graph claims are verified>
Next implementation task: <exact task>
```

## Final Design Decision

Use a hybrid retrieval architecture:

- `fast-context-mcp`: semantic discovery.
- `rg`/grep/Git/local reads: exact and validation layer.
- CodeGraph-like structural graph: code-level relationships and refactor impact.
- Graphify: persistent architecture graph/wiki/mixed-corpus memory.

The future Trellis asset should be a routing skill/profile, tentatively `trellis-code-retrieval`, not a runtime dependency. It should route intent, check for existing indexes/artifacts, ask before install/index/build/watch/MCP setup, and require exact verification before edits.
