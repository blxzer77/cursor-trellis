# Project Capabilities

Selectable project capabilities are project-local Trellis workflow surfaces for optional MCP/graph/browser integrations. They are not global client mutations and they are not proof that a capability is ready.

## Registry

The v1 registry lives in `packages/cli/src/utils/project-capabilities.ts`.

Canonical capability ids:

| Id | Purpose |
| --- | --- |
| `fast-context-mcp` | Semantic local code search and repository discovery. |
| `codegraph` | `colbymchenry/codegraph` structure, relationship, impact, and path queries. |
| `graphify` | Architecture graph/wiki/memory and graph artifact navigation. |
| `github-mcp` | GitHub repository, issue, PR, and review operations. |
| `playwright-mcp` | Browser automation and UI verification evidence. |

`trellis init --capability <id>` is repeatable and also accepts comma-separated values, `all`, and documented aliases. No optional capability is enabled by default.

## Generated Files

When at least one optional capability is selected, init writes:

| File | Contract |
| --- | --- |
| `.trellis/capabilities.json` | Stable machine-readable selected capability state. No timestamps or credentials. |
| `.trellis/capabilities.md` | Human-readable routing, no-capability-hallucination, readiness expectations, and fallback guidance. |
| `.codex/config.toml` | Project-local `[mcp_servers.<name>]` blocks inside the Trellis capability marker block, only when Codex is configured. |
| `.mcp.json` | Claude Code project-local `mcpServers`, only when Claude Code is configured. |
| `.cursor/mcp.json` | Cursor project-local `mcpServers`, only when Cursor is configured. |

Update uses `.trellis/capabilities.json` to reconstruct the same generated templates. This keeps capability files hash-tracked and idempotent without enabling unselected optional capabilities.

## Safety Rules

- Never write user-level/global MCP or client config from ordinary init/update.
- Never store credentials, API keys, tokens, or local private config values in generated capability templates.
- Do not start MCP servers, browser sessions, graph builds, watchers, or indexing jobs from ordinary init/update.
- Unselected, unavailable, skipped, or uninvoked capabilities must not be reported as used.
- Capability output that affects task decisions belongs in task research or `verify.md`, not only in chat.
- `fast-context-mcp` semantic results must be confirmed with `rg`, Git, or direct file reads before final evidence claims.
- CodeGraph index markers are only freshness hints. Graph-derived impact or relationship claims require a host-level status/query smoke or confirmation through Git/source reads/tests.
- Graphify is artifact-first: existing `graphify-out` artifacts can orient work, but they do not prove current-code behavior. Graph builds/updates and MCP startup require explicit approval.
- Graphify MCP query guidance may be generated for selected projects, but those tools are for querying an existing graph only. `query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`, `graph_stats`, and `shortest_path` must not be presented as evidence of current-code behavior until artifact freshness is confirmed and source/Git/test evidence supports the claim.

## Readiness and Fallback Boundary

Selected capability readiness is checked only for capabilities recorded in the current init selection or in `.trellis/capabilities.json` during update. Projects with no selected optional capabilities do not run optional capability probes.

The v1 readiness check is deliberately lightweight:

- It checks command availability with a PATH lookup rather than starting MCP servers.
- Where a selected capability exposes a safe non-starting command surface, it also runs a bounded host-level command visibility smoke such as `<command> --help`.
- Capability paths that may download packages, start MCP servers, open browsers, build graphs, refresh indexes, or perform remote actions are not run by ordinary init/update; they remain explicit user-approved smoke work.
- It may check project-local artifact posture such as Graphify artifacts or common CodeGraph index markers.
- CodeGraph readiness warns when common index markers are missing, and also warns that found markers are not proof of freshness.
- Graphify readiness allows artifact-only fallback when the runtime command is missing but known graph artifacts exist; those artifacts are orientation evidence only until freshness is confirmed.
- It may check credential posture only by presence/absence, never by printing values.
- It reports host-level smoke gaps as warnings when Trellis cannot safely prove them from the CLI process.

Hard failures, such as an unavailable selected capability command or missing GitHub credential posture, fail init/update before project writes or update backups. The error must name the failing capability, report concise reasons, include fallback guidance from the registry, and show the relevant `--skip-readiness` repair/debug bypass.

`--skip-readiness` bypasses Smart Search and selected capability checks, but skipped capabilities are not ready and must not be claimed as used. Readiness checks must not mutate global MCP/client config, start browsers, start MCP servers, build graph artifacts, refresh indexes, or perform remote GitHub actions.

## Graphify MCP Query Guidance

When `graphify` is selected, `.trellis/capabilities.md` may include a Graphify MCP query section. The section is routing help only; ordinary init/update still must not start the Graphify MCP server.

Tool routing:

- `query_graph` - broad architecture or concept discovery across an existing `graphify-out/graph.json`.
- `get_node` - inspect exact node metadata before citing a specific graph node.
- `get_neighbors` - inspect adjacent modules, files, concepts, or dependency relationships around a known node.
- `get_community` - read module/community context, labels, and architecture grouping for a known community.
- `god_nodes` - find high-centrality architecture hotspots for preflight, risk scanning, or refactor orientation.
- `graph_stats` - check graph coverage and health before relying on MCP query results.
- `shortest_path` - trace a relationship path between two concepts, files, modules, or graph nodes.

## CodeGraph CLI Automation Guidance

When `codegraph` is selected, `.trellis/capabilities.md` may include a CLI automation section. The section is routing help only; ordinary init/update must not initialize, refresh, or mutate a CodeGraph index.

Impact routing:

- `codegraph status --json <path>` - check initialization, graph size, languages, backend, and pending changes before relying on graph output.
- `codegraph query <symbol-or-search> --path <path> --json` - resolve candidate symbols, kinds, files, and line ranges before running impact or relationship commands.
- `codegraph callers <symbol> --path <path> --json` - find direct upstream callers that may need edits or focused tests.
- `codegraph callees <symbol> --path <path> --json` - find downstream calls and dependencies that constrain a safe change.
- `codegraph impact <symbol> --path <path> --depth <n> --json` - estimate blast radius for a resolved symbol before editing or reviewing a refactor.
- `codegraph affected <changed-files...> --path <path> --json` - map changed source files to affected tests when preparing validation scope.

CodeGraph automation output remains advisory unless index freshness is confirmed. Current source reads, Git evidence, and task validation are still required before final impact or affected-test claims.
