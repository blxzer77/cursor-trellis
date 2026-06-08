# Retrieval Architecture Decision

Status: research conclusion. No implementation performed.

Evidence base:

- `.trellis/tasks/06-08-code-retrieval-architecture-evaluation/research/graphify-evidence.md`
- `.trellis/tasks/06-08-code-retrieval-architecture-evaluation/research/codegraph-candidates.md`
- `.trellis/tasks/06-08-code-retrieval-architecture-evaluation/research/codegraph-evidence.md`
- `.trellis/tasks/06-08-code-retrieval-architecture-evaluation/research/retrieval-taxonomy.md`
- `.trellis/tasks/06-08-code-retrieval-architecture-evaluation/research/smart-search-verification.md`

## Final Decision Summary

```text
Semantic retrieval owner: fast-context-mcp
Exact retrieval owner: rg/Git/local file reads
Graph retrieval owner: hybrid
Code structural graph owner: CodeGraph-like tool, first smoke-test candidate colbymchenry/codegraph
Architecture graph/wiki owner: Graphify optional artifacts plus optional Graphify MCP
Graph build/update owner: external runtime, user-approved
Graph query owner: artifact-first, then optional MCP/CLI depending on layer
Trellis bundled asset: future trellis-code-retrieval routing skill/profile
Runtime dependency policy: external until smoke tests prove value
MCP policy: optional/recommended for indexed graph traversal, never auto-configured
Validation chain: semantic/graph -> source metadata -> exact search/file reads -> tests/typecheck/build when relevant
Next implementation task: Add bundled trellis-code-retrieval routing skill/profile with no runtime install or MCP config changes
```

## Direct Answer

For code retrieval, a CodeGraph-like structural index is better than Graphify. It is the better owner for definitions, callers, callees, imports, shortest code paths, impact analysis, affected tests, and edit preflight.

For architecture memory, Graphify is still valuable. It is the better owner for persistent architecture reports, wiki-style navigation, mixed corpus analysis, conceptual communities, god nodes, and broad "what connects these concepts?" questions that span code plus docs or other artifacts.

The right Trellis architecture is therefore not Graphify vs CodeGraph. It is:

```text
fast-context-mcp for semantic discovery
rg/Git/file reads for exact proof
CodeGraph-like layer for code structure and refactor impact
Graphify for persistent architecture/wiki/mixed-corpus memory
```

## CodeGraph Candidate Decision

"CodeGraph" is ambiguous. The candidates studied were:

- `codegraph-ai/CodeGraph`;
- `colbymchenry/codegraph`;
- `optave/ops-codegraph-tool`;
- `CodeGraphContext/CodeGraphContext`;
- `Bikach/codegraph-landing`.

For this user's personal Trellis workflow, `colbymchenry/codegraph` is the best first smoke-test candidate because its README and MCP server instructions explicitly target AI coding agents including Codex CLI, and its project-local `.codegraph/` model fits Trellis worktrees. It exposes a focused CLI/MCP surface for `explore`, `search`, `callers`, `callees`, `impact`, `node`, `files`, and `status`.

`optave/ops-codegraph-tool` is the best candidate if Trellis later needs structural governance, CI gates, dataflow, CFG, communities, co-change, and architecture boundaries.

`codegraph-ai/CodeGraph` is the best candidate if Trellis later wants a larger Rust MCP/LSP platform with memory, docs indexing, PR context, and tool profiles.

`CodeGraphContext/CodeGraphContext` is viable but less attractive for the first integration because its Python dependency and graph database setup are heavier.

## Graphify Subdecision Summary

```text
Build/update owner: Trellis bundled trellis-graphify routing Skill + external graphifyy runtime/library, user-approved
Existing-graph query owner: artifact-first, then optional Graphify MCP for structured graph traversal
Trellis bundled asset: future concise trellis-graphify Skill with a small reference file, not upstream graphify skill.md
Runtime dependency: external initially; Trellis does not install or manage graphifyy by default
MCP status: optional but recommended for existing graph path/neighbor/community queries after smoke testing
fast-context relationship: fast-context-mcp remains live semantic code search; Graphify is persistent architecture graph/wiki memory
Next implementation task: Add bundled trellis-graphify Skill and artifact-first routing policy; keep runtime and MCP setup opt-in
```

## Overall Retrieval Ownership

| Retrieval type | Owner | Reason |
| --- | --- | --- |
| Semantic/RAG code discovery | `fast-context-mcp` | Already in the user's toolchain; best for natural-language file discovery and likely implementation areas. |
| Exact verification | `rg`, Git, and direct file reads | Deterministic, reproducible, no index freshness risk; required before behavior-changing edits. |
| Code structural graph | CodeGraph-like tool | Best for callers/callees/imports/path/impact/affected-test style questions. |
| Architecture graph/wiki | Graphify | Best for persistent architecture artifacts, communities, mixed-corpus reports, and conceptual relationship memory. |
| Web/docs/API research | `smart-search-cli` | Separate from local code retrieval. Verified usable with user-environment access; sandboxed Codex runs may need approval to read the user config and access network providers. |

## Why This Is the Right Ownership Split

Graphify is not only an MCP and not only a CLI. The upstream repository is a Python package plus a Claude Code Skill. `ARCHITECTURE.md` explicitly says the Skill orchestrates the library and the library can be used standalone. `pyproject.toml` exposes a `graphify` console script, but `graphify/__main__.py` only implements support commands such as `install`, `benchmark`, `hook`, `claude`, and `vscode`. The advertised `/graphify <path>`, `query`, `path`, and `explain` flows live in the Skill workflow, not in the observed CLI entrypoint.

Because of that, assigning all behavior to an MCP would be wrong. `graphify/serve.py` starts an MCP stdio server, but it only loads an existing `graphify-out/graph.json` and exposes query/traversal tools. It does not build, update, detect, extract, cluster, report, export, watch, or ingest. MCP is therefore a good query interface after a graph exists, not the owner of graph creation.

Assigning all behavior to a bundled Skill is also incomplete. A Skill can route and orchestrate, but the actual graph operations require the external `graphifyy` Python package and optional extras. Mixed-corpus semantic extraction also depends on agent/subagent behavior defined by the upstream Claude Skill. Trellis should not pretend this is available just because a Trellis Skill file exists.

The evidence supports a hybrid integration:

- artifact reading for cheap architecture preflight;
- Trellis routing Skill for consent, operation selection, and platform adaptation;
- external Graphify runtime for build/update/export;
- optional Graphify MCP for structured graph queries over existing `graph.json`.

## Operation Ownership Matrix

| Operation | Owner | Rationale |
| --- | --- | --- |
| Detect whether graph knowledge exists | `trellis-graphify` Skill / workflow artifact check | Check `graphify-out/wiki/index.md`, `GRAPH_REPORT.md`, and `graph.json` without runtime. |
| Architecture preflight | Artifact reading first | `wiki/index.md` and `GRAPH_REPORT.md` are designed for agent navigation and require no server. |
| First graph build | Trellis Skill route + external Graphify runtime | Build workflow is Skill/library orchestration, not MCP. Ask before running. |
| Incremental update | Trellis Skill route + external Graphify runtime | `detect_incremental`, cache, manifest, and update semantics require runtime and may use LLM/agent extraction. |
| Code-only auto rebuild | External Graphify `watch.py`/hook, opt-in only | Facts show code-only rebuild can avoid LLM, but watch/hooks are local automation and must be user-approved. |
| Query broad existing graph context | Artifact first; MCP when available | Report/wiki may be enough. MCP `query_graph` is better for structured traversal. |
| Shortest path | Graphify MCP preferred | MCP exposes `shortest_path(source, target, max_hops)`. |
| Node/neighborhood/community inspection | Graphify MCP preferred | MCP exposes `get_node`, `get_neighbors`, `get_community`, `god_nodes`, and `graph_stats`. |
| URL ingest | External Graphify runtime, explicit user action | Network fetch is allowed only for explicit ingest; Trellis should not hide it. |
| Neo4j push | External Graphify runtime, explicit user action | Requires credentials/service and is outside default workflow. |
| Trellis install/update | Bundle only routing Skill/reference | Do not install Python packages, start MCP, alter hooks, or mutate project artifacts by default. |

## Graphify Implementation Shape

Add a future bundled skill:

```text
packages/cli/src/templates/common/bundled-skills/trellis-graphify/
  SKILL.md
  references/graphify-routing.md
```

The Skill should be concise and Trellis-native. It should not copy upstream `graphify/skill.md` wholesale because that file is large, Claude-specific, Unix-command-heavy, and contains auto-install behavior that conflicts with Trellis approval boundaries.

`SKILL.md` should do only routing:

1. If `graphify-out/wiki/index.md` exists, read it first for architecture questions.
2. Else if `graphify-out/GRAPH_REPORT.md` exists, read it for god nodes, communities, surprising connections, and suggested questions.
3. Else if `graphify-out/graph.json` exists and the request is path/neighbor/community/stat/traversal, prefer Graphify MCP when configured.
4. Else use `fast-context-mcp` for live code search and ask whether the user wants to build Graphify output.
5. Before build/update/watch/hook/ingest/MCP config/runtime install, ask for explicit approval.
6. Never claim Graphify has been run unless artifacts or command output prove it.

`references/graphify-routing.md` should hold the operation table, artifact meanings, safe commands, and known upstream mismatches. Keep it much smaller than upstream `skill.md`.

## MCP Policy

Graphify MCP should be supported as optional, not bundled into global Trellis configuration.

Reasons:

- It requires an existing project-local `graphify-out/graph.json`.
- It requires the optional `mcp` Python dependency.
- A static global MCP config must hardcode one graph path, which does not fit multiple Trellis projects.
- Trellis cannot safely change MCP configuration without explicit user approval.

Recommended future behavior:

- Document a project-scoped MCP launch recipe after smoke testing.
- Treat MCP as recommended for graph traversal once graph output exists.
- Keep artifact reading as the default first step even when MCP is available.

## Relationship With fast-context-mcp

`fast-context-mcp` remains the default live code-search tool. It answers "where is this implemented?", returns file paths and line ranges, and suggests grep keywords for follow-up.

Graphify is a persistent architecture graph/wiki layer. It answers "what are the god nodes?", "what connects these concepts?", "which communities exist?", "what are surprising cross-file relationships?", and "what should we inspect before a refactor?"

CodeGraph-like tools are structural code graph layers. They answer "who calls this?", "what does this call?", "which files import this?", "what breaks if this changes?", "what is the shortest code path from A to B?", and "which tests are likely affected?"

They should be chained, not substituted:

1. Use Graphify artifacts for broad architecture shape when they exist.
2. Use CodeGraph-like tools for code-level relationship and impact questions when an index exists.
3. Use `fast-context-mcp` to locate implementation files when exact terms are unknown.
4. Use `rg`, Git, direct file reads, tests, typecheck, lint, or build to verify before editing.

## Trellis Implementation Shape

Add a future bundled skill/profile:

```text
packages/cli/src/templates/common/bundled-skills/trellis-code-retrieval/
  SKILL.md
  references/retrieval-routing.md
```

The Skill should route intent only. It should not install Graphify, install CodeGraph, start MCP servers, create indexes, edit global config, or change MCP configuration by default.

Routing rules:

1. For semantic "where should I look?" code questions, use `fast-context-mcp`.
2. For literal keys, symbols, config, route strings, package scripts, and final verification, use `rg`, Git, and file reads.
3. For code graph questions, check whether an approved CodeGraph-like project index exists; if not, ask before indexing.
4. For architecture/wiki/mixed-corpus questions, check Graphify artifacts first:
   - `graphify-out/wiki/index.md`;
   - `graphify-out/GRAPH_REPORT.md`;
   - `graphify-out/graph.json`.
5. For Graphify existing graph traversal, use optional Graphify MCP only when configured.
6. Ask before install/index/build/update/watch/hook/MCP setup/global config changes.
7. Never claim a graph has been run or is fresh unless artifacts, status output, or command output prove it.

## CodeGraph Smoke Tests Required Before Implementation Claims

Do not implement these in the current task. They define the next evidence gate.

1. Install the selected CodeGraph candidate in an isolated test environment with explicit approval.
2. Confirm installed CLI version and `--help`.
3. Index a tiny fixture and verify output paths, ignored files, and Windows behavior.
4. Query definitions, callers, callees, imports, shortest path, impact, and status.
5. Edit a file and verify index freshness/staleness behavior.
6. Compare graph answers against `rg` and direct file reads.
7. Confirm no unexpected telemetry, network calls, credential reads, or global config writes.
8. Start MCP only with approval and verify tool schema size and prompt overhead.
9. Run the same fixture through Graphify only if the user wants a direct runtime comparison.
10. Record whether CodeGraph semantic search, if present, adds value beyond `fast-context-mcp`.

## Approval Boundaries

The future Trellis Skill must ask before:

- `pip install graphifyy` or any dependency install;
- first graph build;
- incremental update if it may process docs/papers/images;
- starting `python -m graphify.serve`;
- editing MCP configuration;
- starting `python -m graphify.watch`;
- running `graphify hook install`;
- URL ingest;
- Neo4j export push;
- writing project-local `CLAUDE.md`, `.github/copilot-instructions.md`, or other agent config.

Safe without approval:

- reading existing `graphify-out/wiki/index.md`;
- reading existing `graphify-out/GRAPH_REPORT.md`;
- reading existing `graphify-out/graph.json` metadata if the user asks for Graphify context;
- reporting that no graph artifacts exist.

## Known Upstream Mismatches To Preserve

Trellis docs and Skill text should explicitly avoid relying on these until smoke tested:

- `graphify ./raw` is advertised in `worked/httpx/README.md`, but `graphify/__main__.py` as read does not implement a path command.
- README slash-command usage is real as a Claude Skill contract, but not equivalent to a portable CLI API.
- Upstream Skill auto-installs with `pip install graphifyy`; Trellis must not auto-install.
- Upstream Skill uses Claude `Agent tool`; Trellis must adapt for Codex/multi-platform behavior.
- Upstream examples use Unix commands; Trellis must avoid hardcoding them into Windows-facing guidance.

## Graphify Smoke Tests Required Before Implementation Claims

Do not implement these in the current task. They define the next evidence gate.

1. Install Graphify in an isolated test environment with explicit approval.
2. Run `graphify --help` and verify the actual top-level CLI commands.
3. Confirm whether installed package version supports `graphify <path>` despite current `__main__.py`.
4. Build a tiny code-only graph through Python module calls or the supported upstream path.
5. Verify output files: `graphify-out/GRAPH_REPORT.md`, `graphify-out/graph.json`, optionally `graphify-out/wiki/index.md`.
6. Start MCP against the test graph and call `graph_stats`, `get_node`, `get_neighbors`, and `shortest_path`.
7. Compare MCP query output against direct artifact reading for the same questions.
8. Test Windows command portability.
9. Confirm graph path validation behavior when the graph path is absolute and under the project `graphify-out/`.

## Recommended Next Task

Create the final implementation task:

```text
Add bundled trellis-code-retrieval routing skill/profile
```

Potential acceptance criteria for that future task:

- bundled `trellis-code-retrieval` asset exists;
- semantic retrieval routes to `fast-context-mcp`;
- exact retrieval routes to `rg`/grep/Git/local reads;
- code structural graph retrieval routes to approved CodeGraph-like layer when indexed;
- architecture/mixed-corpus graph retrieval routes to Graphify artifacts/MCP when available;
- graph build/update preserves approval gates;
- no runtime dependency is added unless explicitly chosen;
- no MCP config is changed by default;
- tests assert bundled assets install into Trellis skill roots.
