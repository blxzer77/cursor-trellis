# Codebase Retrieval Pipeline Design

## Problem

The current Trellis project capability design exposes optional tools as first-class concepts: `fast-context-mcp`, `codegraph`, `graphify`, `github-mcp`, and `playwright-mcp`. That is too shallow for codebase retrieval. It encourages generated docs and agents to route by tool name instead of retrieval role, evidence quality, freshness, and verification.

The OpenClaw benchmark showed that adding fast-context raised the score from `15.0 / 300` to `86.0 / 300`, but the result is still weak. The missing piece is a retrieval pipeline, not another MCP entry.

## Target Model

Introduce a role-based `codebase-retrieval` capability:

```text
query
  -> exact search candidates
  -> AST/structure candidates
  -> LSP navigation expansion
  -> semantic/vector recall candidates
  -> fusion and rerank
  -> source/Git/test verification
  -> evidence output
```

## Adapter Roles

### Exact Search

Required baseline.

- Preferred implementation: `rg`.
- Purpose: exact identifiers, literals, path hints, protocol constants, error codes, config keys, and test names.
- Evidence status: high, but still requires direct source read for final claims.

### AST / Structure

Optional but strongly recommended.

- Initial implementation: CodeGraph CLI / MCP.
- Purpose: symbols, kinds, definitions, imports, callers, callees, impact, affected tests, route nodes, and cross-language structural bridges.
- Required freshness evidence: status JSON, pending changes, worktree mismatch, and index metadata.
- Evidence status: structural candidate / impact guidance until confirmed with source reads or tests.

### LSP Navigation

Optional adapter slot in the first implementation; should be part of the public design now.

- Initial likely target: TypeScript / JavaScript through `tsserver` or a language-server wrapper.
- Purpose: definition, references, workspace symbols, implementations, hover/signature.
- Best use: expand high-confidence candidates from exact/AST/semantic stages rather than broad first-pass discovery.
- Evidence status: navigation candidate until source reads verify the exact file/range.

### Semantic / Vector Recall

Optional adapter role.

- Initial implementation: host-provided `fast-context-mcp` or project-local `fast-context-mcp` MCP config.
- Current limitation: fast-context is not a local vector index. It is a Windsurf-powered semantic search loop that generates local `rg/readfile/tree/ls/glob` tool calls and returns files/line ranges plus grep keywords.
- Future implementation: true local embedding/vector index can plug into this role without changing the public capability model.
- Evidence status: recall candidate only.

### Verification

Required final proof layer.

- Direct source reads.
- `rg` confirmation for identifiers/literals.
- Git diff/status where freshness matters.
- Test/build/typecheck evidence where behavior is changed.

## Graphify Decision

Graphify is removed from the primary codebase retrieval stack.

Reasons:

- The generated `graphify --mcp` command is not compatible with the observed working package shape.
- The benchmark only had a scoped smoke graph and did not show Graphify as a reliable retrieval contributor.
- Graphify maps better to architecture-memory or artifact navigation, not exact codebase retrieval.

If Graphify remains in Trellis, it should be a separate future capability outside this task.

## Capability Registry Shape

Replace or supersede the current separate retrieval-related ids:

- old: `fast-context-mcp`
- old: `codegraph`
- old: `graphify`

with:

- new: `codebase-retrieval`

The generated state should represent selected adapters:

```json
{
  "id": "codebase-retrieval",
  "adapters": {
    "exact": { "provider": "rg", "required": true },
    "ast": { "provider": "codegraph", "required": false },
    "lsp": { "provider": "typescript-language-server", "required": false },
    "semantic": { "provider": "fast-context-mcp", "required": false }
  }
}
```

Compatibility handling can accept old flags and map them:

- `fast-context-mcp` -> `codebase-retrieval` with semantic adapter enabled.
- `codegraph` -> `codebase-retrieval` with AST adapter enabled.
- `graphify` -> warn or map to a non-primary future/legacy capability, not to codebase retrieval.
- `all` should select `codebase-retrieval`, `github-mcp`, and `playwright-mcp`; it should not silently reintroduce Graphify into retrieval.

## Readiness Model

Readiness must be a plan, not a startup side effect.

- Required:
  - `rg` available, or a bundled fallback is available.
- Optional:
  - CodeGraph command available through PATH or `npx -y @colbymchenry/codegraph`.
  - CodeGraph index status is readable when the project has `.codegraph/`.
  - LSP adapter command is available or explicitly marked unavailable.
  - fast-context host MCP is visible or project-local command config can be generated.

Ordinary `init` / `update` must not:

- run `codegraph init`, `index`, or `sync`;
- start CodeGraph MCP;
- start fast-context MCP;
- start an LSP server;
- write global agent configuration;
- write credentials.

## Generated Documentation

`.trellis/capabilities.md` should guide agents through retrieval roles:

1. Extract exact identifiers and path hints.
2. Run exact `rg` first.
3. Use AST/CodeGraph to resolve symbols and relationships when available.
4. Use LSP to expand precise references/definitions when available.
5. Use semantic recall for conceptual or poorly named areas.
6. Fuse candidates with source/test priority.
7. Read files and verify before final claims.

The document should explicitly say which adapters are unavailable or unverified.

## Testing Strategy

- Unit test capability parsing and alias migration.
- Unit test generated capabilities JSON/Markdown.
- Unit test command-shape rendering for CodeGraph.
- Integration test `init`/`update` generated files for selected `codebase-retrieval`.
- Regression test that Graphify is not described as part of the primary retrieval pipeline.

