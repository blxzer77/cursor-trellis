# Project Capabilities

Selectable project capabilities are project-local Trellis workflow surfaces for optional MCP/browser integrations and retrieval guidance. They are not global client mutations and they are not proof that a capability is ready.

## Registry

The v2 registry lives in `packages/cli/src/utils/project-capabilities.ts`.

Canonical capability ids:

| Id | Purpose |
| --- | --- |
| `codebase-retrieval` | Role-based local code retrieval through exact search, AST/structure, LSP expansion, semantic recall, and verification. |
| `github-mcp` | GitHub repository, issue, PR, and review operations. |
| `playwright-mcp` | Browser automation and UI verification evidence. |

`trellis init --capability <id>` is repeatable and also accepts comma-separated values, `all`, `none`, and documented aliases. No optional capability is enabled by default.

Legacy retrieval tool ids are aliases, not separate capabilities:

| Alias | Canonical id |
| --- | --- |
| `fast-context-mcp` / `fast-context` / `fast_context` | `codebase-retrieval` |
| `codegraph` / `colbymchenry/codegraph` / `colbymchenry-codegraph` | `codebase-retrieval` |

Unknown stored selections in existing `.trellis/capabilities.json` are ignored during update so removed legacy entries do not prevent known selected capabilities from regenerating.

## Codebase Retrieval Model

`codebase-retrieval` is a pipeline, not a tool brand:

```text
query
  -> exact search candidates
  -> AST/structure candidates
  -> LSP navigation expansion
  -> semantic recall candidates
  -> fusion and rerank
  -> source/Git/test verification
  -> evidence output
```

Adapter roles:

| Role | Provider | Required | Contract |
| --- | --- | :---: | --- |
| `exact` | `rg` | yes | Baseline for identifiers, literals, paths, config keys, error text, and test names. |
| `ast` | `codegraph` | no | Structural symbols, imports, callers, callees, impact, and affected-file guidance. |
| `lsp` | host language server | no | Precise definitions, references, implementations, hover, and workspace symbols after candidates exist. |
| `semantic` | `fast-context-mcp` | no | Conceptual recall that returns candidate files/ranges and follow-up grep terms. |
| `verification` | source/Git/tests | yes | Final proof layer for behavior, impact, and task evidence. |

Semantic and structural adapter output remains candidate evidence. Final claims require source reads, exact confirmation, Git evidence where freshness matters, and task-appropriate validation.

## Generated Files

When at least one optional capability is selected, init writes:

| File | Contract |
| --- | --- |
| `.trellis/capabilities.json` | Stable machine-readable selected capability state. No timestamps or credentials. Schema version 2 records capability adapters and generated MCP server templates. |
| `.trellis/capabilities.md` | Human-readable routing, no-capability-hallucination, readiness expectations, fallback guidance, and retrieval workflow instructions. |
| `.codex/config.toml` | Project-local `[mcp_servers.<name>]` blocks inside the Trellis capability marker block, only when Codex is configured. |
| `.mcp.json` | Claude Code project-local `mcpServers`, only when Claude Code is configured. |
| `.cursor/mcp.json` | Cursor project-local `mcpServers`, only when Cursor is configured. |

Update uses `.trellis/capabilities.json` to reconstruct generated templates. This keeps capability files hash-tracked and idempotent without enabling unselected optional capabilities.

Selecting `codebase-retrieval` may generate MCP server templates for the optional adapters that expose MCP surfaces. Generated MCP entries must use package-runner commands that can be verified from a fresh host, not undeclared global binaries:

- `fast-context` -> `npx -y fast-context-mcp`
- `codegraph` -> `npx -y @colbymchenry/codegraph serve`
- `github` -> `npx -y @modelcontextprotocol/server-github`

Ordinary init/update only writes project-local templates. It does not start these servers.

## Safety Rules

- Never write user-level/global MCP or client config from ordinary init/update.
- Never store credentials, API keys, tokens, or local private config values in generated capability templates.
- Do not start MCP servers, browser sessions, indexing jobs, watchers, language servers, or remote operations from ordinary init/update.
- Unselected, unavailable, skipped, or uninvoked capabilities and adapters must not be reported as used.
- Capability output that affects task decisions belongs in task research or `verify.md`, not only in chat.
- `codebase-retrieval` must route by retrieval role rather than tool name.
- Exact `rg` search and direct source reads are the baseline for current-code claims.
- `fast-context-mcp` semantic results must be confirmed with exact search, Git, or direct file reads before final evidence claims.
- CodeGraph index markers are only freshness hints. Graph-derived impact or relationship claims require a host-level status/query smoke or confirmation through Git/source reads/tests.
- GitHub MCP uses the GitHub API server package, not a local Git-operation wrapper. Remote writes require explicit user intent and clear credential/tool posture.
- Playwright MCP should be claimed only after rendered browser evidence is actually gathered.

## Readiness and Fallback Boundary

Selected capability readiness is checked only for capabilities recorded in the current init selection or in `.trellis/capabilities.json` during update. Projects with no selected optional capabilities do not run optional capability probes.

The readiness check is deliberately lightweight:

- It checks command runner availability with a PATH lookup and may check generated `npx` package existence without starting MCP servers.
- For `codebase-retrieval`, missing `rg` is a hard failure because exact search is the required baseline.
- For `codebase-retrieval`, missing LSP is a warning because Trellis does not configure host language servers. Missing generated MCP adapter launchability is a hard failure because a successful install must not leave broken MCP server entries.
- Where a selected capability exposes a safe non-starting command surface, it may run a bounded host-level command visibility smoke such as `<command> --help`.
- For generated `npx` MCP servers, readiness may verify package existence with `npm view <package> bin --json` without starting the MCP server.
- Capability paths that may download packages, start MCP servers, open browsers, refresh indexes, run language servers, or perform remote actions are not run by ordinary init/update; they remain explicit user-approved smoke work.
- It may check project-local CodeGraph index markers, but markers are freshness hints only.
- It may check credential posture only by presence/absence, never by printing values. For the generated GitHub API MCP server, Trellis treats `GITHUB_TOKEN` or `GITHUB_PERSONAL_ACCESS_TOKEN` as the readiness credential variables; `GH_TOKEN` may be useful elsewhere but does not prove this server can authenticate.
- It reports host-level smoke gaps as warnings when Trellis cannot safely prove them from the CLI process.

Hard failures, such as unavailable required commands or missing GitHub credential posture, fail init/update before project writes or update backups. The error must name the failing capability, report concise reasons, include fallback guidance from the registry, and show the relevant `--skip-readiness` repair/debug bypass.

`--skip-readiness` bypasses Smart Search and selected capability checks, but skipped capabilities are not ready and must not be claimed as used. Readiness checks must not mutate global MCP/client config, start browsers, start MCP servers, refresh indexes, run language servers, or perform remote GitHub actions.

## CodeGraph CLI Automation Guidance

When `codebase-retrieval` is selected, `.trellis/capabilities.md` may include CodeGraph CLI automation under the retrieval capability. The section is routing help only; ordinary init/update must not initialize, refresh, or mutate a CodeGraph index.

Impact routing:

- `codegraph status <path> --json` - check initialization, graph size, languages, backend, and pending changes before relying on graph output.
- `codegraph query <symbol-or-search> --path <path> --json` - resolve candidate symbols, kinds, files, and line ranges before running impact or relationship commands.
- `codegraph callers <symbol> --path <path> --json` - find direct upstream callers that may need edits or focused tests.
- `codegraph callees <symbol> --path <path> --json` - find downstream calls and dependencies that constrain a safe change.
- `codegraph impact <symbol> --path <path> --depth <n> --json` - estimate blast radius for a resolved symbol before editing or reviewing a refactor.
- `codegraph affected <changed-files...> --path <path> --json` - map changed source files to affected tests when preparing validation scope.

CodeGraph automation output remains advisory unless index freshness is confirmed. Current source reads, Git evidence, and task validation are still required before final impact or affected-test claims.
