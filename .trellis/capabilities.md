# Trellis Project Capabilities

This file records selected project capabilities for the Trellis workflow. It does not store credentials and does not prove readiness by itself.

## Selected

- codebase-retrieval: Role-based local code retrieval through exact search, AST/structure, LSP expansion, semantic recall, and verification.
- github-mcp: GitHub repository, issue, pull request, and review operations.
- playwright-mcp: Browser automation, frontend behavior checks, screenshots, and UI smoke verification.

## Routing Rules

- Unselected, unavailable, skipped, or uninvoked capabilities must not be reported as used.
- Capability output that affects task decisions must be recorded in task research or verify evidence.
- `codebase-retrieval` routes by retrieval role, not by tool brand: exact search, AST/structure, LSP navigation, semantic recall, then verification.
- Exact `rg` search and direct source reads are the baseline for current-code claims.
- CodeGraph output is structural guidance until index freshness and current source/Git evidence are confirmed.
- fast-context output is semantic recall only and must be converted into exact source checks before final claims.
- GitHub MCP uses the GitHub API server package; remote writes require explicit user intent and the host's credential/tool posture must be clear.
- Playwright MCP should be used for rendered UI evidence only when browser verification is part of the task.

## Codebase Retrieval Workflow

1. Extract exact identifiers, literals, path hints, error text, config keys, and test names from the question.
2. Run exact `rg` search first and keep file/range candidates tied to source evidence.
3. Use AST/CodeGraph only when available to resolve symbols, imports, callers, callees, impact, and affected files.
4. Use LSP navigation only after candidate files or symbols exist; do not use it as the broad first-pass search.
5. Use semantic recall for conceptual or poorly named areas, then turn returned files/ranges into exact follow-up checks.
6. Fuse candidates by source proximity, tests, current Git state, and adapter freshness.
7. Read files and run task-appropriate validation before making final behavior or impact claims.

## Adapter Roles

### exact

- Provider: rg
- Required: yes
- Purpose: Find identifiers, literals, paths, protocol constants, error codes, config keys, and test names.
- Readiness: `rg` is available on PATH.
- Evidence status: High-confidence candidate evidence, still confirmed by direct source reads before final claims.

### ast

- Provider: codegraph
- Required: no
- Purpose: Resolve symbols, definitions, imports, callers, callees, impact, affected files, and structural relationships.
- Readiness: `npx -y @colbymchenry/codegraph` is available and index freshness is confirmed through status/query smoke or source/Git checks.
- Evidence status: Structural candidate and impact guidance until confirmed with current source, Git, or tests.

### lsp

- Provider: language-server
- Required: no
- Purpose: Expand high-confidence candidates through definitions, references, implementations, hover, and workspace symbols.
- Readiness: A project-appropriate language server is configured by the host; Trellis does not start it during init/update.
- Evidence status: Navigation candidate until the exact file and range are verified by source reads.

### semantic

- Provider: fast-context-mcp
- Required: no
- Purpose: Recall conceptual or poorly named code areas and return candidate files, ranges, and follow-up grep terms.
- Readiness: `npx -y fast-context-mcp` is available to the host and a project-scoped smoke search is confirmed outside ordinary init/update.
- Evidence status: Recall candidate only; never final proof without source/Git/test verification.

### verification

- Provider: source-git-tests
- Required: yes
- Purpose: Prove final claims with direct source reads, exact search confirmation, Git evidence, and focused validation.
- Readiness: Repository files are readable and task-appropriate validation commands are available or blockers are recorded.
- Evidence status: Required proof layer for final technical claims.

## CLI Automation Guidance

### codebase-retrieval

- Run these commands only after the capability is selected and readiness/freshness has been verified or explicitly reported as unverified.
- Treat adapter output as planning guidance until current source, Git, or tests confirm the claim.
- `rg <pattern> <path>`: Start with exact identifiers, literals, path hints, errors, config keys, and test names before broader semantic recall.
- `codegraph status <path> --json`: Check initialization, graph size, languages, backend, and pending changes before relying on graph output.
- `codegraph query <symbol-or-search> --path <path> --json`: Resolve candidate symbols, kinds, files, and line ranges before running impact or relationship commands.
- `codegraph callers <symbol> --path <path> --json`: Find direct upstream callers that may need edits or focused tests.
- `codegraph callees <symbol> --path <path> --json`: Find downstream calls and dependencies that constrain a safe change.
- `codegraph impact <symbol> --path <path> --depth <n> --json`: Estimate blast radius for a resolved symbol before editing or reviewing a refactor.
- `codegraph affected <changed-files...> --path <path> --json`: Map changed source files to affected tests when preparing validation scope.

## Readiness Expectations

- codebase-retrieval: Required exact search (`rg`) is available. Optional CodeGraph, LSP, and fast-context adapters are reported as available or unavailable without startup side effects.
- github-mcp: Configured GitHub API MCP package is visible and `GITHUB_TOKEN` or `GITHUB_PERSONAL_ACCESS_TOKEN` is present in the agent host environment before remote actions are claimed.
- playwright-mcp: Configured server and browser runtime are available without silently starting unrelated browsing sessions.

## Fallback Guidance

### codebase-retrieval

- Install or expose `rg` on PATH before claiming codebase retrieval readiness.
- Ensure `npx -y fast-context-mcp` and `npx -y @colbymchenry/codegraph serve` can launch before generated MCP adapter entries are claimed as usable.
- If CodeGraph, LSP, or fast-context adapters are not verified, continue with exact search and direct file reads; do not claim missing adapter output.
- Run indexing, host MCP smoke checks, or language-server startup only after explicit user approval.

### github-mcp

- Expose `GITHUB_TOKEN` or `GITHUB_PERSONAL_ACCESS_TOKEN` to the MCP server environment or configure the agent host explicitly.
- Ensure `npx -y @modelcontextprotocol/server-github` can launch before selecting this capability.
- Without a verified credential posture, use local Git only and do not claim GitHub remote actions.

### playwright-mcp

- Verify the Playwright MCP package and browser runtime in the selected host before claiming rendered UI evidence.
- If browser automation is unavailable, record the missing runtime and fall back to static checks or manual user verification.

