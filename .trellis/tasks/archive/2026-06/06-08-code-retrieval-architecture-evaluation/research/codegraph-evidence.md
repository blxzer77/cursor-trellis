# CodeGraph Evidence

Research date: 2026-06-08

This evidence document studies CodeGraph-like code graph projects relevant to Trellis retrieval routing. No install, execution, MCP startup, dependency install, or Trellis source implementation was performed.

## Evidence Sources Read

- `codegraph-ai/CodeGraph`
  - `README.md`
  - `Cargo.toml`
  - `mcp-package/package.json`
  - `crates/codegraph-server/src/`
  - `crates/codegraph-server/src/mcp/`
- `colbymchenry/codegraph`
  - `README.md`
  - `package.json`
  - `src/mcp/`
  - `src/mcp/server-instructions.ts`
- `optave/ops-codegraph-tool`
  - `README.md`
  - `package.json`
  - `src/mcp/`
  - `src/mcp/tool-registry.ts`
- `CodeGraphContext/CodeGraphContext`
  - `README.md`
  - `pyproject.toml`
  - `docs/CLI_COMPLETE_REFERENCE.md`
- `Bikach/codegraph-landing`
  - `README.md`

## `colbymchenry/codegraph`

Repository: `https://github.com/colbymchenry/codegraph`

README facts:

- Describes CodeGraph as "Semantic Code Intelligence" for Claude Code, Cursor, Codex, OpenCode, Hermes Agent, Gemini, Antigravity, and Kiro.
- Advertises local operation, no API keys, no external services, and a SQLite database.
- Install paths include a PowerShell installer and `npm i -g @colbymchenry/codegraph`.
- Agent wiring command: `codegraph install`.
- Per-project setup: `codegraph init -i`.
- Project index directory: `.codegraph/`.
- CLI reference includes `init`, `uninit`, `index`, `sync`, `status`, `query`, `files`, `callers`, `callees`, `impact`, `affected`, `serve --mcp`, and `upgrade`.
- MCP tools include `codegraph_explore`, `codegraph_search`, `codegraph_callers`, `codegraph_callees`, `codegraph_impact`, `codegraph_node`, `codegraph_files`, and `codegraph_status`.
- `codegraph_explore` is described as the primary tool that can answer broad questions, flows, and surveys by returning relevant symbols' verbatim source grouped by file.
- The README says the MCP server auto-syncs using OS file watchers and surfaces a staleness banner when referenced files are pending re-index.
- Supported languages include TypeScript, JavaScript, Python, Go, Rust, Java, C#, PHP, Ruby, C, C++, Objective-C, Swift, Kotlin, Scala, Dart, Svelte, Vue, Liquid, Pascal/Delphi, Lua, and Luau.

Manifest facts:

- `package.json` name: `@colbymchenry/codegraph`.
- Version read: `0.9.9`.
- CLI binary: `codegraph`.
- Runtime language: TypeScript output to `dist`.
- Engine: `node >=20.0.0 <25.0.0`.
- Dependencies include CLI and parsing support such as `commander`, `ignore`, `jsonc-parser`, `picomatch`, `tree-sitter-wasms`, and `web-tree-sitter`.
- Tests use Vitest.

MCP instruction facts:

- `src/mcp/server-instructions.ts` says Codegraph is a SQLite knowledge graph of every symbol, edge, and file in the workspace.
- It instructs agents to use Codegraph before raw file reads for both questions and edits.
- It says `codegraph_explore` can be a Read-equivalent for relevant symbols.
- It maps intent to tools:
  - broad "how does X work" or "what/where is X" -> `codegraph_explore`;
  - location -> `codegraph_search`;
  - callers/callees/impact -> `codegraph_callers`, `codegraph_callees`, `codegraph_impact`;
  - named symbol before edit -> `codegraph_node`;
  - directory contents -> `codegraph_files`;
  - index readiness -> `codegraph_status`.
- It warns that cross-file resolution is best-effort and ambiguous calls may return multiple candidates.

Trellis implication:

`colbymchenry/codegraph` is the best immediate CodeGraph candidate for the user's personal agent workflow. Its fit is code-level structural retrieval, not general semantic web research and not mixed-corpus architecture wiki generation.

Trellis should not copy its "do not re-verify with grep" instruction as-is. Trellis requires graph claims to remain verifiable by exact search, source reads, tests, or type/lint/build checks before edits.

## `codegraph-ai/CodeGraph`

Repository: `https://github.com/codegraph-ai/CodeGraph`

README facts:

- Describes CodeGraph as cross-language code intelligence for AI agents and developers.
- Builds a semantic graph of functions, classes, imports, and call chains.
- Exposes MCP tools, a VS Code extension, and a persistent memory layer.
- Parses 38 languages via tree-sitter according to README language section.
- MCP server can run with `codegraph-server --mcp`.
- Server flags include:
  - `--workspace <path>`;
  - `--exclude <dir>`;
  - `--embedding-model <model>`;
  - `--full-body-embedding`;
  - `--max-files <n>`;
  - `--profile <name>`;
  - `--graph-only`;
  - `--run-tool <name>`.
- Tool profiles include `all`, `core`, `graph`, `memory`, and `security`.
- Tool categories include code analysis, code navigation, indexing, memory, PR/change analysis, and documentation.
- README claims persistence to `~/.codegraph/graph.db` using RocksDB.
- README says embeddings are stored alongside the graph and a model is auto-downloaded on first run.
- README describes `codegraph_pr_context` for PR review in CI through `--run-tool`.
- README distinguishes community tools from CodeGraph Pro tools.

Manifest facts:

- Root `Cargo.toml` is a Rust workspace.
- Version read: `0.18.5`.
- Workspace members include parser crates for many languages, `codegraph-memory`, and `codegraph-server`.
- Dependencies include RocksDB, `tokio`, `tower-lsp`, `notify`, `clap`, and parser crates.
- `mcp-package/package.json` publishes `@astudioplus/codegraph-mcp`.
- MCP package binaries include `codegraph-mcp`, `codegraph-daemon`, and `codegraph-mcp-install-hooks`.
- MCP package supports `darwin`, `linux`, and `win32`, and `x64`/`arm64`.
- MCP package has a `postinstall` script and a `posthog-node` dependency.

Source tree facts:

- `crates/codegraph-server/src/` includes modules for indexing, watching, memory, runtime dependencies, telemetry, and MCP.
- `crates/codegraph-server/src/mcp/` includes MCP `server.rs`, `tools.rs`, protocol, resources, file watcher, and transport modules.

Trellis implication:

`codegraph-ai/CodeGraph` is a strong but broader platform candidate. It may be attractive if Trellis wants a single structural code graph plus memory/docs store and PR context. It is less obviously the first personal integration because tool count, embeddings, Pro/community boundary, telemetry behavior, and model download behavior all require smoke testing and explicit approval.

## `optave/ops-codegraph-tool`

Repository: `https://github.com/optave/ops-codegraph-tool`

README facts:

- Describes `codegraph` as a function-level dependency graph that stays current with incremental rebuilds.
- Advertises an MCP server, CLI, CI gates, and programmatic API.
- Quick start: `npm install -g @optave/codegraph`, `codegraph build`.
- MCP start command: `codegraph mcp`.
- CLI commands include `build`, `watch`, `query`, `deps`, `map`, `where`, `stats`, `roles`, `context`, `brief`, `audit`, `fn-impact`, `path`, `diff-impact`, `branch-compare`, `co-change`, `structure`, `triage`, `complexity`, `communities`, and more.
- Features include hybrid BM25 plus semantic search, dataflow, CFG, AST querying, architecture boundaries, CI checks, CODEOWNERS mapping, graph snapshots, and graph export.
- README states local operation and zero network calls by default.
- README provides self-measured performance, resolution precision/recall tables, and limitations.

Manifest facts:

- `package.json` name: `@optave/codegraph`.
- Version read: `3.11.2`.
- CLI binary: `codegraph`.
- Engine: `node >=22.12.0`.
- Dependencies include `better-sqlite3`, `commander`, and `web-tree-sitter`.
- Optional dependencies include `@modelcontextprotocol/sdk` and platform-specific native packages.
- `@huggingface/transformers` is an optional peer dependency for semantic search.

MCP registry facts:

`src/mcp/tool-registry.ts` defines tools including:

- `query`;
- `path`;
- `file_deps`;
- `brief`;
- `file_exports`;
- `impact_analysis`;
- `find_cycles`;
- `module_map`;
- `fn_impact`;
- `context`;
- `symbol_children`;
- `where`;
- `diff_impact`;
- `semantic_search`;
- `export_graph`;
- `list_functions`;
- `structure`;
- `node_roles`;
- `co_changes`;
- `execution_flow`;
- `sequence`;
- `complexity`;
- `communities`;
- `code_owners`;
- `audit`;
- `batch_query`;
- `triage`;
- `branch_compare`;
- `cfg`;
- `dataflow`;
- `check`;
- `implementations`;
- `interfaces`;
- `ast_query`.

Trellis implication:

`optave/ops-codegraph-tool` is the richest structural analysis candidate among the projects read. It is especially relevant if personal Trellis evolves toward impact gates, architecture boundary enforcement, PR analysis, and CI checks. For a first retrieval routing integration, it may be too broad unless the user explicitly wants those governance features early.

## `CodeGraphContext/CodeGraphContext`

Repository: `https://github.com/CodeGraphContext/CodeGraphContext`

README facts:

- Describes CodeGraphContext as an MCP server and CLI toolkit that indexes local code into a graph database.
- Supports CLI and MCP server modes.
- Supports 22 languages according to the README table.
- Database options include KuzuDB, LadybugDB, FalkorDB Lite, FalkorDB Remote, Nornic DB, and Neo4j.
- Install command: `pip install codegraphcontext`.
- CLI examples include `codegraphcontext index .`, `codegraphcontext list`, `codegraphcontext analyze callers my_function`, `codegraphcontext analyze complexity --threshold 10`, `codegraphcontext analyze dead-code`, and `codegraphcontext watch .`.
- MCP setup command: `codegraphcontext mcp setup`.
- MCP start command: `codegraphcontext mcp start`.
- `.cgcignore` is used for ignoring files.
- README says `codegraphcontext mcp setup` can detect and configure multiple tools including ChatGPT Codex and OpenCode.

Manifest facts:

- `pyproject.toml` package name: `codegraphcontext`.
- Version read: `0.4.16`.
- Classifier: development status alpha.
- Scripts: `cgc` and `codegraphcontext`.
- Python requirement: `>=3.10`.
- Dependencies include `neo4j`, `watchdog`, `typer`, `rich`, `inquirerpy`, `python-dotenv`, `tree-sitter`, `tree-sitter-language-pack`, `pathspec`, `falkordb`, `kuzu`, `ladybug`, `mcp`, `fastapi`, and `uvicorn`.

CLI reference facts:

- `docs/CLI_COMPLETE_REFERENCE.md` lists 55 commands.
- Core groups include project management, watching, code analysis, discovery/search, setup/config, bundle management, registry, and utilities.
- Commands include `cgc index`, `cgc watch`, `cgc analyze callers`, `cgc analyze chain`, `cgc analyze deps`, `cgc find name`, `cgc find content`, `cgc mcp setup`, `cgc mcp start`, and `cgc bundle export/import/load`.

Trellis implication:

This is a viable graph database toolkit, but not the most lightweight first fit. The database backend matrix and Python dependencies make it operationally closer to Graphify in setup weight than to a simple project-local code index.

## Comparison Against Graphify

Graphify and CodeGraph-like tools solve different retrieval problems.

Graphify evidence shows:

- mixed corpus support;
- architecture report and wiki outputs;
- community/god-node/concept connection focus;
- optional MCP over an existing `graphify-out/graph.json`;
- build/update workflow primarily encoded as a Skill/library orchestration;
- runtime package `graphifyy` with Python dependencies.

CodeGraph-like evidence shows:

- code-specific structural indexing;
- project-local source graph or database;
- direct callers/callees/imports/definitions/impact/path queries;
- MCP/CLI surfaces designed for agents;
- stronger edit preflight and refactor support;
- less emphasis on mixed documents, diagrams, and architecture wiki artifacts.

Therefore:

```text
Graphify is better for architecture memory and mixed-corpus explanation.
CodeGraph-like tools are better for code-level structural retrieval.
Neither replaces fast-context-mcp semantic discovery or rg exact verification.
```

## Missing Smoke Tests Before Adoption

Do not implement based on README claims alone. Before Trellis adopts a specific CodeGraph runtime, run a separate approved smoke-test task:

1. Install the candidate in an isolated environment.
2. Confirm the exact installed version and CLI help.
3. Index a tiny TypeScript/Python fixture and this Trellis repo if allowed.
4. Verify output path, database path, ignored files, and Windows behavior.
5. Query definitions, callers, callees, imports, shortest path, impact, status, and freshness after edits.
6. Check whether returned source is exact enough to base edits on.
7. Compare graph results against `rg` and direct file reads.
8. Confirm no unexpected telemetry, network calls, credential reads, or global config writes.
9. Confirm MCP startup and project-scoped configuration path.
10. Measure tool schema size and prompt overhead.
