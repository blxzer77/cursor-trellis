# Fast Context And CodeGraph Capability Research

## Purpose

This task must not redesign Trellis retrieval around assumptions. It should use the real capability boundaries of `fast-context-mcp` and `@colbymchenry/codegraph`, then decide what belongs in the new codebase retrieval stack.

## Evidence Sources

- Local package cache: `fast-context-mcp@1.4.3`
- Local package cache / npm execution: `@colbymchenry/codegraph@0.9.9`
- OpenClaw retrieval benchmark report: `D:\MyHarness\openclaw-retrieval-eval\runs\trellis-semantic-stack-fast-context-20260611.md`
- Current Trellis implementation: `packages/cli/src/utils/project-capabilities.ts`
- Current Trellis spec: `.trellis/spec/cli/backend/project-capabilities.md`

## Benchmark Baseline

The OpenClaw full-50 benchmark with fast-context included produced:

- Main score: `86.0 / 300`
- Bonus: `+2.5`
- Final: `88.5`
- Main percent: `28.7%`
- `fast_context_error`: `0` across 50 queries

The previous CodeGraph + scoped Graphify baseline without fast-context produced:

- Main score: `15.0 / 300`
- Bonus: `+0.5`
- Final: `15.5`

Interpretation:

- `fast-context-mcp` connectivity is not the immediate blocker.
- Current Trellis retrieval quality is poor because it lacks a retrieval pipeline, evidence fusion, and source-level verification discipline.
- Graphify did not contribute enough in this benchmark to justify keeping it in the primary codebase retrieval path.

## Fast Context MCP

Package facts:

- Package: `fast-context-mcp@1.4.3`
- Description: `AI-driven semantic code search MCP server (Node.js)`
- Binary: `fast-context-mcp -> src/server.mjs`
- Dependencies include `@modelcontextprotocol/sdk`, `@vscode/ripgrep`, `tree-node-cli`, `sql.js`, `scule`, and `zod`.

Actual tool surface:

- `fast_context_search`
- `extract_windsurf_key`

`fast_context_search` parameters:

- `query`: natural language search query.
- `project_path`: required absolute project root.
- `tree_depth`: `0..6`; supports auto depth.
- `max_turns`: `1..5`.
- `max_results`: `1..30`.
- `exclude_paths`: list of directory/file patterns.
- `include_code_snippets`: optional code snippets toggle.

Actual internal behavior:

- It is not a local vector database.
- It maps a project to `/codebase`, builds a repo map, sends query + repo map to the Windsurf Devstral / SWE-grep protocol, receives tool calls, executes local tools, and loops for N turns.
- Local tools include bundled `rg`, `readfile`, `tree`, `ls`, and `glob`.
- It collects suggested grep keywords and returns relevant files with line ranges.
- It can auto-discover a Windsurf API key or use `WINDSURF_API_KEY`.

Trellis interpretation:

- Keep it as a semantic recall adapter.
- Do not name it the vector layer unless Trellis introduces a true embedding/vector index abstraction.
- It is valuable for concept recall and generating search keywords.
- It must not be final evidence. Results need confirmation by direct file reads, `rg`, Git, or tests.
- Trellis should support two access modes:
  - host-provided MCP tool already available in the current agent session;
  - project-local MCP command config when the host needs it.

## CodeGraph

Package facts:

- Package: `@colbymchenry/codegraph@0.9.9`
- Description: `Local-first code intelligence for AI agents (MCP). Self-contained - bundles its own runtime.`
- Binary: `codegraph -> npm-shim.js`
- It can be used through `npx -y @colbymchenry/codegraph`.

Actual CLI surface:

- `init [path]`
- `uninit [path]`
- `index [path]`
- `sync [path]`
- `status [path]`
- `query <search>`
- `files`
- `serve`
- `unlock [path]`
- `callers <symbol>`
- `callees <symbol>`
- `impact <symbol>`
- `affected [files...]`
- `install`
- `uninstall`

Important command-shape detail:

- `status` uses a positional project path: `codegraph status <path> --json`.
- `query`, `files`, `callers`, `callees`, `impact`, and `affected` use `--path <path>`.
- Trellis must encode these command-shape differences instead of storing a single generic command string.

Actual MCP surface from README:

- `codegraph_explore`
- `codegraph_search`
- `codegraph_callers`
- `codegraph_callees`
- `codegraph_impact`
- `codegraph_node`
- `codegraph_files`
- `codegraph_status`

Actual storage and extraction behavior:

- Uses tree-sitter extraction for AST nodes and edges.
- Stores symbols, edges, files, and FTS5 full-text data in local SQLite at `.codegraph/codegraph.db`.
- Supports file watcher auto-sync when running as MCP.
- Surfaces pending sync / staleness information.
- Supports 20+ languages, including TypeScript, JavaScript, Python, Go, Rust, Java, Swift, Kotlin, C/C++, C#, Ruby, PHP, Dart, Lua, Svelte, Liquid, Pascal/Delphi, XML, YAML, and properties.
- Adds framework-aware route nodes and cross-language iOS / React Native / Expo bridges.

OpenClaw smoke evidence:

- `codegraph status D:\MyHarness\openclaw-trellis-eval --json` returned initialized state with:
  - `fileCount`: `17496`
  - `nodeCount`: `305269`
  - `edgeCount`: `825418`
  - `backend`: `node-sqlite`
  - `journalMode`: `wal`
  - `pendingChanges`: added/modified/removed all `0`
- `codegraph query buildToolPlan --path ... --json` found `src/tools/planner.ts` line `40` as a function, plus related type/import/property nodes.
- `codegraph callees buildToolPlan --path ... --json` found `assertUniqueNames`, `evaluateToolAvailability`, and type aliases.
- `codegraph impact buildToolPlan --path ... --depth 2 --json` returned the function and file node.
- `codegraph affected src/tools/planner.ts --path ... --json` returned no affected tests for that example.

Trellis interpretation:

- Keep CodeGraph as the AST / structure / impact adapter.
- Prefer CLI automation for Trellis-controlled harnesses because it has stable JSON output and avoids assuming MCP startup.
- Use MCP only when an agent host already has a CodeGraph server or when the user explicitly opts into project-local MCP config.
- Encode freshness as a first-class evidence field: initialized, pending changes, worktree mismatch, backend, and index size.
- Treat CodeGraph output as structural candidates and impact guidance, not final proof without source reads/tests.

## Graphify

Observed issues:

- The Trellis-generated `graphify --mcp` command does not match the working local package shape observed during benchmark work.
- The working package was Python `graphifyy`, with serving closer to `python -m graphify.serve graphify-out/graph.json`.
- Full-repo graph extraction did not complete within the prior benchmark window; only a scoped smoke graph existed.
- Benchmark contribution was insufficient for codebase retrieval quality.

Decision:

- Drop Graphify from the primary codebase retrieval stack.
- Do not model it as an AST, vector, LSP, or exact-search layer.
- If Trellis keeps Graphify at all, treat it as a separate future `architecture-memory` capability for explicit graph artifact workflows, not as part of `codebase-retrieval`.

## New Retrieval Stack Direction

The new first-class capability should be `codebase-retrieval`, with adapters by retrieval role rather than by vendor/tool name:

- `exact`: `rg` / grep-compatible literal and regex search.
- `ast`: CodeGraph CLI/MCP where available.
- `lsp`: language-server navigation for definition, references, workspace symbols, implementations, hover/signature.
- `semantic`: fast-context MCP initially; future local vector index can plug into the same role.
- `verification`: direct file reads, `rg` confirmation, Git evidence, and tests.

This makes `fast-context-mcp` and CodeGraph implementation details, not the public design center.

