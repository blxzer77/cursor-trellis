# Smart Search Verification

Research date: 2026-06-08

This document corrects the earlier smart-search availability finding. The earlier "missing providers" result was caused by Codex sandbox access to the user config path, not by missing provider configuration.

## Commands Run

Configuration and availability:

```powershell
smart-search --version
smart-search doctor --format json
```

Evidence collection:

```powershell
smart-search exa-search "CodeGraph MCP Codex codegraph Graphify code retrieval GitHub" --num-results 8 --include-highlights --format json --output C:\tmp\smart-search-evidence\20260608-code-retrieval\01-exa-codegraph-graphify.json
smart-search exa-search "colbymchenry codegraph Codex CLI MCP codegraph_explore" --num-results 6 --include-highlights --format json --output C:\tmp\smart-search-evidence\20260608-code-retrieval\02-exa-colbym-codegraph.json
smart-search search "Graphify vs CodeGraph for AI agent code retrieval MCP semantic exact search" --validation balanced --extra-sources 2 --timeout 90 --format json --output C:\tmp\smart-search-evidence\20260608-code-retrieval\03-search-graphify-vs-codegraph.json
smart-search fetch "https://github.com/colbymchenry/codegraph" --format json --output C:\tmp\smart-search-evidence\20260608-code-retrieval\04-fetch-colbym-codegraph.json
smart-search fetch "https://github.com/safishamsi/graphify?tab=readme-ov-file" --format json --output C:\tmp\smart-search-evidence\20260608-code-retrieval\05-fetch-graphify.json
smart-search fetch "https://github.com/optave/ops-codegraph-tool" --format json --output C:\tmp\smart-search-evidence\20260608-code-retrieval\06-fetch-optave-codegraph.json
```

No secrets were written to Trellis task files.

## Availability Finding

`smart-search --version` returned `0.1.14`.

When run under normal sandbox permissions, `smart-search doctor --format json` reported missing providers because it could not read the user config file under `C:\Users\blaze\.config\smart-search\config.json`.

When run with user-environment access, `doctor` returned:

- `ok: true`;
- `config_status: ok`;
- `minimum_profile_ok: true`;
- `main_search`: configured through OpenAI-compatible provider;
- `docs_search`: configured through Context7 and Exa;
- `web_fetch`: configured through Tavily and Firecrawl;
- `web_search`: configured through Zhipu, Tavily, and Firecrawl.

Zhipu returned HTTP 429 during the check, but the minimum profile remained usable because other configured providers were healthy.

## Search Finding

The smart-search rerun supports the same architecture conclusion as the GitHub MCP research:

- `colbymchenry/codegraph` is a strong CodeGraph candidate for personal AI-agent code retrieval because it targets Codex CLI and exposes project-local MCP tools such as `codegraph_explore`, `codegraph_search`, `codegraph_callers`, `codegraph_callees`, `codegraph_impact`, `codegraph_node`, `codegraph_files`, and `codegraph_status`.
- `optave/ops-codegraph-tool` is a richer structural-governance candidate with a function-level dependency graph, 30+ MCP tools, CI gates, impact analysis, complexity, architecture boundaries, and hybrid semantic search.
- Graphify is broader than code structure: its README describes mapping code, docs, PDFs, images, and videos into `graphify-out/` outputs such as `graph.html`, `GRAPH_REPORT.md`, and `graph.json`, with optional MCP access over the graph.

Therefore the final retrieval model remains:

```text
fast-context-mcp for semantic discovery
rg/Git/file reads for exact proof
CodeGraph-like layer for code structure and refactor impact
Graphify for persistent architecture/wiki/mixed-corpus memory
smart-search-cli for external web/docs/API research
```

## Operational Note

Future Codex sessions that need smart-search from this sandbox may require user-environment approval because the provider config is outside the workspace. This is an execution-permission issue, not a provider setup issue.
