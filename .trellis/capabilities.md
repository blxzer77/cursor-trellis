# Trellis Project Capabilities

This file records selected project capabilities for the Trellis workflow. It does not store credentials and does not prove readiness by itself.

## Selected

- codebase-retrieval: Role-based local code retrieval through exact search, CodeGraph structure, definition/reference via codegraph on Cursor Agent, semantic recall by cursorEnv, and verification.
- github-mcp: GitHub repository, issue, pull request, and review operations.
- playwright-mcp: Browser automation, frontend behavior checks, screenshots, and UI smoke verification.

## Routing Rules

- Unselected, unavailable, skipped, or uninvoked capabilities must not be reported as used.
- Capability output that affects task decisions must be recorded in task research or verify evidence.
- `codebase-retrieval` routes by retrieval role, not by tool brand: exact search, intent-gated policy/document-first routing for C-class questions, other intent-gated branches when the question class matches, AST/structure, definition/reference via codegraph on Cursor Agent, semantic recall by cursorEnv, then verification.
- Policy, architecture, boundary, and storage-policy questions must inspect `AGENTS.md`, `.trellis/spec/**`, and README/contributing/architecture docs before semantic implementation search.
- Intent-gated branches (policy/document, caller-chain, trap demotion, extension disambiguation, env/config literals) must not override exact-symbol or F/G protocol routes.
- Exact `rg` search and direct source reads are the baseline for current-code claims.
- CodeGraph output is structural guidance until index freshness and current source/Git evidence are confirmed.
- fast-context output is semantic recall only and must be converted into exact source checks before final claims; on Cursor BYOK it is the compliant Primary for concept recall.
- On **Cursor**, semantic recall follows **cursorEnv** (Native built-in vs BYOK fast-context). See **Semantic recall (Cursor)** under codebase-retrieval.
- On Cursor, per-query tool order also lives in `.cursor/rules/retrieval-routing.mdc` (`alwaysApply`).
- GitHub MCP uses the GitHub API server package; remote writes require explicit user intent and the host's credential/tool posture must be clear.
- Playwright MCP should be used for rendered UI evidence only when browser verification is part of the task.

## Policy and Document-First Routing (intent-gated)

Apply this branch when the question is about architecture, responsibility, ownership, boundaries, project or package policy, storage or persistence policy, conventions, or where behavior is allowed, forbidden, or defined in instructions—not when the question names an exact symbol, protocol constant, schema path, platform file, or version literal (those stay symbol/path-first for strong A/G/F/J routes).

Trigger signals include: 规定 / 边界 / 为什么不能 / storage policy / persistence / sidecar / import boundaries / transport-only / project instructions / AGENTS conventions.

Evidence order for policy/document queries:

1. Root and nested `AGENTS.md`, then `.trellis/spec/**`, `README.md`, `CONTRIBUTING.md`, architecture or design docs, and package-level policy or contract instruction files.
2. Exact `rg` on policy phrases and boundary terms scoped to those paths (for example `Storage default: SQLite only`, `sidecar`, `SQLite only`, transport-only, import boundary).
3. Read matched policy sections with direct source reads before ranking implementation files as Top-1.
4. Use AST/CodeGraph or semantic recall only to corroborate policy claims or locate related implementation; do not let SQLite/state/cache modules outrank root policy docs when the question asks what is allowed or forbidden.
5. Verify with source reads before final claims; optional adapters remain optional.

### Storage and persistence policy (benchmark C03 pattern)

When the question asks how storage is chosen, why sidecar files for cache or queue are forbidden, or SQLite vs JSON/JSONL policy: inspect root `AGENTS.md` (and nested `**/AGENTS.md`) before `src/state/*`, Kysely, or other storage implementation modules. Target Top-1 policy evidence such as `Storage default: SQLite only`, `state/openclaw.sqlite`, and `Kysely` cited from instruction docs, not from implementation adjacency alone. OpenClaw audit acceptance target for this query class: `>= 4/6` when agents follow this route.

## Codebase Retrieval Workflow

1. Extract exact identifiers, literals, path hints, policy phrases, command names, error text, config keys, env prefixes, extension ids, routes, event names, task names, and test names from the question.
2. Run exact `rg` search first when exact signals exist and keep file/range candidates tied to source evidence.
3. Classify intent (policy/document, caller-chain, trap/package, extension spread, env literal, protocol/platform) and apply **Policy and Document-First Routing** or the matching branch from **Query Intent Branches** when it fits; skip branches that do not match.
4. Use AST/CodeGraph when available and fresh enough to resolve symbols, imports, callers, callees, impact, and affected files.
5. Use codegraph_node / codegraph_search for definition and reference on Cursor Agent; Read to verify line ranges (GO_TO_DEFINITION is not a guaranteed Agent tool).
6. Use semantic recall for conceptual, poorly named, or cross-cutting areas, then turn returned files/ranges/keywords into exact follow-up checks; deprioritize semantic Top-1 for policy/storage-policy, env-literal, and extension-disambiguation questions until policy docs or `rg` narrow candidates.
7. Fuse candidates by source proximity, tests, current Git state, and adapter freshness.
8. Read files, inspect relevant Git evidence, and run task-appropriate validation before making final behavior, impact, or test-coverage claims.

## Codebase Evidence Levels

- Candidate: filenames, semantic recall, initial graph/LSP output, or incomplete exact search. Candidate evidence cannot support final claims.
- Corroborated candidate: current source reads or exact `rg` hits confirm the candidate exists in this checkout. Use it to plan deeper reads or tests.
- Verified claim: current source lines plus Git evidence or focused validation support the statement. Use this level for final answers and `verify.md`.
- Unverified / unavailable: adapter output is stale, skipped, unavailable, hidden from the host, or not invoked. Report it explicitly instead of claiming it.

## Evidence Persistence

- Record exploratory retrieval chains, adapter availability, freshness checks, and competing hypotheses in task `research/*.md`.
- Record final source/Git/test proof, validation commands, and unresolved adapter gaps in `verify.md`.
- Prefer reusable research frontmatter when the artifact should be rediscovered later: `doc_type`, `status`, `confidence`, `scope`, and `related_files`.

## Fallback Sequence

- If `rg` is missing, codebase retrieval readiness fails; install or expose `rg` before claiming readiness.
- If CodeGraph, LSP, or fast-context are unavailable or unverified, continue with exact search, direct source reads, Git evidence, and focused tests.
- Do not start MCP servers, initialize indexes, start language servers, or install tools without explicit user approval.

## Adapter Roles

### exact

- Provider: rg
- Required: yes
- Purpose: Find identifiers, literals, paths, protocol constants, error codes, config keys, policy phrases, env prefixes, extension ids, and test names.
- Readiness: `rg` is available on PATH.
- Evidence status: Corroborated candidate evidence when current file/range matches are captured; still not final proof without source/Git/test confirmation.

### ast

- Provider: codegraph
- Required: no
- Purpose: Resolve symbols, definitions, imports, callers, callees, impact, affected files, and structural relationships.
- Readiness: `npx -y @colbymchenry/codegraph serve --mcp` is available and index freshness is confirmed through status/query smoke or source/Git checks.
- Evidence status: Structural candidate and impact guidance only; stale or unverified graph output must be confirmed with current source, Git, or tests.

### lsp

- Provider: codegraph
- Required: no
- Purpose: Definition/reference navigation on Cursor Agent via codegraph_node and codegraph_search (GO_TO_DEFINITION not exposed in Agent tool table).
- Readiness: CodeGraph MCP/index available; corroborate with Read on returned line ranges.
- Evidence status: Structural navigation candidate until Read verifies file/range; do not claim LSP jump when only codegraph ran.

### semantic

- Provider: platform-semantic
- Required: no
- Purpose: Conceptual recall: Cursor Native uses built-in codebase semantic; Cursor++ BYOK uses fast-context MCP per router cursorEnv.
- Readiness: Native: host exposes built-in semantic/@codebase. BYOK: `npx -y fast-context-mcp` enabled in MCP config when codebase-retrieval is selected.
- Evidence status: Semantic recall candidate only; convert hits into rg/Read before final claims. BYOK fast-context is compliant Primary, not misuse.

### platform-semantic-native

- Provider: cursor-builtin
- Required: no
- Purpose: Cursor Native built-in semantic / @codebase when cursorEnv is native.
- Readiness: Agent session tool table includes codebase semantic or equivalent.
- Evidence status: Log actual host tool name for semantic_exec telemetry.

### verification

- Provider: source-git-tests
- Required: yes
- Purpose: Prove final claims with direct source reads, exact search confirmation, Git evidence, and focused validation.
- Readiness: Repository files are readable and task-appropriate validation commands are available or blockers are recorded.
- Evidence status: Required proof layer for final technical claims and verification evidence.

## Semantic recall (Cursor)

Semantic routing is **split by `cursorEnv`** (see `cursor_retrieval_env` / `~/.ccursor/routes.json` `byokMode`): **Native** → built-in `platform-semantic`; **BYOK** → **fast-context MCP** (`fast_context_search`) as Primary. **codebase-retrieval** is an **optional** init capability — when selected, init/update writes **fast-context** and **codegraph** into `.cursor/mcp.json`; BYOK local concept retrieval should select it.

Prefer `.cursor/rules/retrieval-routing.mdc` and `retrieval-daily-guide.md` for tool names.

## Query Intent Branches (intent-gated)

Apply these branches only when the question matches the intent class. Do not reorder the global workflow for F/G protocol queries, platform file paths, or questions with a single named symbol or constant—keep exact `rg` and symbol-scoped CodeGraph first.

### Caller and assembly chain (B-class)

- Use when the question asks who calls, which modules invoke, where behavior is wired, or which facade modules delegate work.
- Do not treat facade-runtime, loader, barrel, plugin-registry-snapshot, or a single deliver/helper file as sufficient Top-1 evidence when the rubric expects many concrete call sites.
- After exact hits on the helper or symbol, run `codegraph callers` with a raised limit (or repeat with `rg` references/imports) until concrete callee modules appear; follow assembly nodes (`*-runtime`, `server-runtime-services`, registry entry vs snapshot) with `codegraph callees` or targeted `rg`.
- Rank concrete call-site files above the file that only defines or loads the helper.

### Cross-cutting / conceptual discovery

- Use when the question has no named symbol, path, or protocol constant but asks how behavior works, spans modules/packages, or uses conceptual phrasing (for example English *how does* / *across packages*, or Chinese 如何 / 机制 / 跨).
- The deterministic router emits intent `cross-cutting-discovery` and promotes semantic recall to plan order 1–2 (after `policy-docs-rg` when policy intent also matches); follow with exact `rg` on returned keywords and paths.
- **On Cursor (Native, `cursorEnv: native`)**: router `platform-semantic` — built-in codebase / semantic search (e.g. SemanticSearch); see `.cursor/rules/retrieval-routing.mdc`.
- **On Cursor++ BYOK (`cursorEnv: byok`)**: concept recall Primary is **fast_context_search** (fast-context MCP); built-in semantic is often absent (Experiment D). Select **codebase-retrieval** at init to generate `.cursor/mcp.json` entries for fast-context and codegraph.
- **On Codex, Claude Code, and other non-Cursor hosts**: router `semantic-fast-context` — invoke `fast_context_search` when semantic recall is required after uncorroborated exact `rg`.
- When exact-symbol or F/G preserve intents match, keep exact `rg` primary; do not apply this branch.

### Trap demotion and package boundary (E-class)

- Use when similarly named files exist in a different package or layer (for example `src/agents/*` vs `packages/*-core`).
- Parse path and package hints in the query; demote trap candidates until an export, protocol type, or corroborating call site matches the asked layer.
- Prefer `packages/<name>/` evidence when the question names a core library; demote spawn/runtime overlay traps that share a prefix but live in agent glue code.
- Do not promote a trap file to Top-1 without reading exports and at least one confirming reference.

### Extension and shared-symbol disambiguation (A-class)

- Use when one symbol (for example `legacyConfigRules`) appears across many `extensions/` trees.
- Run exact `rg` across `extensions/` first; filter by extension id or directory named in the question.
- Prefer the first non-empty export with a real implementation over stub or empty `doctor-contract-api` paths; demote traps listed in eval/query context when present.
- Run CodeGraph explore only after the extension candidate set is narrowed—not as an unscoped global symbol search.

### Environment and config literals (D-class)

- Use when the question names env vars, `OPENCLAW_*` prefixes, benchmark startup, or e2e script configuration.
- Run exact `rg` on `scripts/`, `test/`, `e2e/`, and `bench/` (or project equivalents) before `src/` auth, token, or runtime conflict modules.
- Prefer files that assign or read the literal in scripts over implementation files that only mention the prefix in error handling.
- Use CodeGraph after literal hits exist; do not let auth/runtime implementation outrank script evidence for env-inventory questions.

### Preserve strong routes (F / G / exact symbol)

- Platform paths (`apps/ios`, `apps/android`, Swift/Kotlin trees), `packages/gateway-protocol`, contract/schema globs, and named constants: exact `rg` plus symbol-scoped `codegraph_search` stay primary.
- Do not run policy-first, trap demotion, or env-before-`src/` passes ahead of exact symbol discovery for those queries.

## CLI Automation Guidance

### codebase-retrieval

- Run these commands only after the capability is selected and readiness/freshness has been verified or explicitly reported as unverified.
- Treat adapter output as planning guidance until current source, Git, or tests confirm the claim.
- `rg <pattern> <path>`: Start with exact identifiers, literals, path hints, policy phrases, errors, config keys, and test names before broader semantic recall.
- `rg -i "storage default|sidecar|sqlite only" AGENTS.md "**/AGENTS.md" README.md CONTRIBUTING.md .trellis/spec`: For architecture, boundary, or storage/persistence policy questions (OpenClaw benchmark C-class, especially storage-policy queries), search project instruction and policy docs before implementation modules such as SQLite or state DB files.
- `Get-Content <file> | Select-Object -First <n>`: Read current source around candidate file ranges before turning retrieval output into a claim.
- `git diff -- <path>`: Check current worktree changes before claiming behavior, impact, or test scope.
- `codegraph status <path> --json`: Check initialization, graph size, languages, backend, and pending changes before relying on graph output.
- `codegraph query <symbol-or-search> --path <path> --json`: Resolve candidate symbols, kinds, files, and line ranges before running impact or relationship commands.
- `codegraph callers <symbol> --path <path> --json`: Find upstream callers; raise result limits or paginate with rg when the question asks which modules/files invoke a facade, loader, or helper (do not stop at the helper definition file).
- `rg <env-prefix> scripts test e2e bench`: For env/config literal questions, search scripts, e2e, benchmark, and test trees before auth or runtime implementation modules under src/.
- `rg <symbol> extensions/`: For shared extension exports, list every extension hit, then disambiguate by extension id in the query and non-empty export bodies before global semantic explore.
- `codegraph callees <symbol> --path <path> --json`: Find downstream calls and dependencies that constrain a safe change.
- `codegraph impact <symbol> --path <path> --depth <n> --json`: Estimate blast radius for a resolved symbol before editing or reviewing a refactor.
- `codegraph affected <changed-files...> --path <path> --json`: Map changed source files to affected tests when preparing validation scope.

## Readiness Expectations

- codebase-retrieval: Required exact search (`rg`) is available. CodeGraph and fast-context MCP are required for full BYOK retrieval on Cursor when this capability is selected; Native relies on built-in semantic when available. LSP/GO_TO_DEFINITION is not a guaranteed Agent tool — definition/reference via codegraph.
- github-mcp: Configured GitHub API MCP package is visible and `GITHUB_TOKEN` or `GITHUB_PERSONAL_ACCESS_TOKEN` is present in the agent host environment before remote actions are claimed.
- playwright-mcp: Configured server and browser runtime are available without silently starting unrelated browsing sessions.

## Fallback Guidance

### codebase-retrieval

- Install or expose `rg` on PATH before claiming codebase retrieval readiness.
- Ensure `npx -y fast-context-mcp` and `npx -y @colbymchenry/codegraph serve --mcp` can launch before generated MCP adapter entries are claimed as usable.
- If CodeGraph, LSP, or fast-context adapters are unavailable, skipped, stale, or uninvoked, label that adapter evidence as unverified and continue with exact search plus direct file reads.
- Record exploratory retrieval chains in task `research/*.md`; record final source/Git/test proof and unresolved adapter gaps in `verify.md`.
- Run indexing, host MCP smoke checks, or language-server startup only after explicit user approval.

### github-mcp

- Expose `GITHUB_TOKEN` or `GITHUB_PERSONAL_ACCESS_TOKEN` to the MCP server environment or configure the agent host explicitly.
- Ensure `npx -y @modelcontextprotocol/server-github` can launch before selecting this capability.
- Without a verified credential posture, use local Git only and do not claim GitHub remote actions.

### playwright-mcp

- Verify the Playwright MCP package and browser runtime in the selected host before claiming rendered UI evidence.
- If browser automation is unavailable, record the missing runtime and fall back to static checks or manual user verification.

