# Fix semantic retrieval stack capability adapters

## Goal

Replace Trellis' tool-name-centered semantic retrieval capability design with a codebase retrieval pipeline built around exact search, AST/structure, LSP navigation, semantic/vector recall, and explicit evidence verification.

## Requirements

- Introduce `codebase-retrieval` as the primary code retrieval capability model.
- Model retrieval by role instead of vendor/tool name:
  - exact search: `rg` / grep-compatible literal and regex search.
  - AST and structural graph: CodeGraph when available.
  - LSP navigation: definition, references, workspace symbols, implementation lookup, hover/signature where available.
  - semantic/vector recall: fast-context MCP initially, with room for a future true vector index.
  - verification: direct file reads, `rg`, Git evidence, and tests.
- Research and document the real capabilities of `fast-context-mcp` and `@colbymchenry/codegraph` before implementation.
- Drop Graphify from the primary codebase retrieval path unless new evidence proves it belongs there.
- Keep generated project files credential-free and project-local.
- Do not start MCP servers, build indexes, refresh graph artifacts, or mutate global agent configuration from ordinary `init` / `update`.
- Preserve explicit user approval boundaries for indexing, MCP startup, and remote actions.
- Update capability markdown/specs so agents follow a retrieval evidence chain, not a list of optional MCP names.
- Add focused tests for parsing, readiness planning, generated capability files, and adapter command shapes.

## Acceptance Criteria

- [ ] `fast-context-mcp` and CodeGraph capability research is captured in task research with concrete package/CLI evidence.
- [ ] Trellis capability registry exposes `codebase-retrieval` or an equivalent role-based model.
- [ ] Generated capability docs describe the exact -> AST -> LSP -> semantic -> fusion -> verification flow.
- [ ] Graphify is removed from the primary retrieval stack and not presented as required codebase retrieval infrastructure.
- [ ] CodeGraph command shapes are represented accurately, including `status <path>` versus `--path <path>` commands.
- [ ] Readiness distinguishes required exact search from optional AST/LSP/semantic adapters.
- [ ] Existing `fast-context-mcp`, `codegraph`, and `graphify` selections are migrated or handled compatibly.
- [ ] Tests cover capability parsing, generated `.trellis/capabilities.*`, generated MCP config where applicable, and readiness fallback text.
- [ ] Validation records include at least targeted tests and a build/typecheck pass or documented blocker.

## Notes

- The OpenClaw benchmark with fast-context included scored `86.0 / 300` main, `88.5` final. This is enough to prove connectivity, not retrieval quality.
- The previous CodeGraph + scoped Graphify baseline scored `15.0 / 300` main, `15.5` final.
- `fast-context-mcp` should be treated as semantic recall, not as proof and not as a local vector database.
- CodeGraph should be treated as the current AST/structure adapter.
- LSP is a required design slot even if the first implementation ships a minimal TypeScript-oriented adapter or readiness placeholder.
