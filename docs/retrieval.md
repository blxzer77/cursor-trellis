# Retrieval layer design

English | [简体中文](retrieval.zh-CN.md)

Trellis routes codebase and external-fact questions through a deliberate **retrieval layer** instead of relying on a single tool. This document explains the adapter stack, the routing envelope, how context reaches the Cursor agent, and the evidence/scoring rules that gate what can be claimed.

This is the public design doc. The canonical, agent-facing guide inside an initialized project is `.trellis/spec/guides/retrieval-daily-guide.md`; the Cursor rule that enforces it is `.cursor/rules/retrieval-routing.mdc` (`alwaysApply: true`).

## Why a retrieval layer

A single tool cannot cover every question:

- **Literal search** (Grep) is fast but floods context on large repos and cannot follow call chains.
- **Semantic search** is good for "how does X work" but weak at exact-call-site enumeration.
- **Structural queries** (callers, blast radius, cross-package traps) need an indexed graph, not a string match.
- **External / current facts** require web retrieval, not codebase search.
- **Durable project knowledge** lives in specs, archived tasks, and journals — a separate index from source code.

Trellis classifies the **intent** of a question, then routes to the most token-economical adapter for that intent. Evidence is layered: a path candidate is not a verified claim until confirmed by Read, Git, or tests.

## Adapter stack

Seven adapters, grouped into three layers:

| Layer | Adapter | Tool / surface | Best for |
| --- | --- | --- | --- |
| **Core** | Grep | `rg` (Cursor Grep tool) | Exact string / path / log line |
| **Core** | artifact-search | `search_artifacts.py` | Durable Trellis specs, prior task PRDs/design/verify, research notes, journals |
| **Core** | source-git-tests | Git log/blame + test runs | Proving current vs historical behavior with source, Git, or test evidence |
| **Enhance** | codegraph | `codegraph` MCP (`codegraph_explore`, `codegraph_search`, `codegraph_node`) | Callers, blast radius, cross-package trap disambiguation, extension symbols, definition/reference (replaces unavailable Agent LSP) |
| **Enhance** | platform-semantic | Native `@codebase` **or** `fast_context_search` MCP (Cursor-env dependent — see [Semantic routing](#semantic-routing-cursor)) | Conceptual "how does X work", wide semantic discovery |
| **Enhance** | smart-search | `run_smart_search.py` → `@blxzer/smart-search` CLI | External / current / web facts (**mandatory first**; built-in web tools are downgrade-only) |
| **Enhance** | session-memory | `search_memory.py` | Reusable prior decisions, recent work recorded in workspace journals |
| **Placeholder** | mcp/browser/network | envelope-only | Reserved for future MCP adapters; currently metadata-only, not search backends |

**Core** adapters are always available. **Enhance** adapters are optional and gated by `.trellis/capabilities.json`. **Placeholder** entries reserve intent slots without executing searches.

## Router envelope

`route_codebase_retrieval.py` is the intent router. It takes a natural-language question and emits a structured plan:

```bash
python ./.trellis/scripts/route_codebase_retrieval.py "<question>" --json
python ./.trellis/scripts/route_codebase_retrieval.py "<question>" --instructions
```

The JSON envelope contains:

| Field | Meaning |
| --- | --- |
| `intent` | Classified question type (e.g. `caller-chain`, `trap-package-disambiguation`, `env-config-literal`, `conceptual`) |
| `routes` | Ordered list of adapter suggestions with `tokenEconomy` labels |
| `agentInstructions` | Numbered, agent-executable steps using Cursor-native tool names |
| `cursorEnv` | `native` or `byok` — determines the `platform-semantic` backend (see below) |

**Router vs execution.** The router returns **intent and route suggestions** — it does not search. Adapter output is **candidate** evidence until confirmed by Read/Git/tests. `--instructions` prints only the step list (no JSON), suitable for direct agent consumption.

## Cursor dual injection channel

On Cursor, retrieval plans reach the agent through **two complementary channels**. This is a deliberate workaround for a known Cursor limitation (`sessionStart` hook `additional_context` is unreliable — Cursor issue #158452).

### Channel 1: Per-query plan injection (`beforeSubmitPrompt`)

When the user message looks like a codebase question, the `beforeSubmitPrompt` hook runs `inject-retrieval-plan.py`, which calls the router and prepends a `## 代码库检索计划` (or `## Codebase retrieval plan`) block to the user prompt. This block contains ordered, mandatory steps tailored to that specific question.

### Channel 2: Always-on policy rule (`.cursor/rules/retrieval-routing.mdc`)

`retrieval-routing.mdc` is shipped with `alwaysApply: true`. It defines:

- The **default tool order** when no plan block is present (Grep for literals → codegraph for callers → semantic for concepts → smart-search for external).
- **Plan-block execution rules**: when a `## 代码库检索计划` block is present, its steps are mandatory tooling, not suggestions.
- **Semantic routing policy** (see below).
- **Result-layer ranking** triggers.

**Why not `sessionStart`?** The `sessionStart` hook's `additional_context` field is documented but does not reliably reach the agent context (#158452). Trellis therefore puts durable retrieval policy in an always-on rule and per-query plans in `beforeSubmitPrompt` — neither depends on `sessionStart` injection.

## Evidence scoring

Adapter output is **not** proof. Trellis layers evidence into three tiers:

| Tier | Meaning | Example |
| --- | --- | --- |
| **candidate** | A path/symbol returned by an adapter; not yet confirmed | codegraph returns `AuthService.loginUser` as a caller |
| **corroborated candidate** | Two independent adapters agree, or one adapter + Read confirms the location | codegraph + Grep both point to the same call site |
| **verified claim** | Confirmed by current source (Read), Git blame, or a passing test | Read shows the call at line 42; test asserts the path |

`get_context.py --mode retrieval-pack` **scores** collected evidence JSON; it does **not** search. Workflow: collect candidates (Grep/codegraph/semantic/artifact) → optionally run `retrieval-pack --input evidence.json` → cite `contextPack.selected` / `scoredEvidence` in `verify.md`.

## Result-layer ranking (B / E / D)

After adapters produce **path candidates**, reorder before picking Top-1 / Top-5. The router appends a **结果层排序** block to `agentInstructions` when these intents appear:

| Intent | Ranking rule |
| --- | --- |
| `caller-chain` | Boost concrete call sites; demote facade/barrel/runtime/registry **assembly-only** files |
| `trap-package-disambiguation` | Demote snapshot/registry/`src/agents/` trap paths unless Read confirms the asked layer |
| `env-config-literal` | Prefer `scripts/`, `e2e/`, `bench/`, `test/` over generic `src/auth` / `src/paths` |

Offline reorder:

```bash
python ./.trellis/scripts/rank_retrieval_candidates.py --candidates fixtures.json --intents caller-chain --top-k 5 --pretty
```

## Token economy

Each route in the router output carries a `tokenEconomy` label:

| Label | Meaning | Typical tools |
| --- | --- | --- |
| `high` | Low token cost per correct answer (~80–200 tokens) | codegraph callers/search, platform-semantic |
| `medium` | Moderate token cost (~200–700 tokens) | codegraph explore, smart Grep, fast-context |
| `low` | High token cost per answer (~3000+ tokens) | Naive Grep with unconstrained output |

**Large-repo promotion:** when `projectFileCount > 2000`, the router promotes structural (codegraph) routes ahead of Grep routes for better token efficiency. File count defaults to `auto` (`git ls-files` when `.git` exists, else a bounded walk); override with `--project-file-count 5000` for large non-git trees.

## smart-search: external facts first

For **external / current / web facts**, `run_smart_search.py` (wrapping the `@blxzer/smart-search` CLI) is the **mandatory first choice**. This rule overrides any general "use available tools" instinct — web retrieval strength is routed inside Trellis, not left to the platform default.

**Downgrade-only fallback.** Cursor's built-in `WebSearch` / `WebFetch` are used **solely** when smart-search is unavailable:

- `doctor` command reports not ok
- `run_smart_search.py` status is `not_configured` or `failed`
- Search timeout

When falling back, persist results to `{TASK}/research/` with `source: cursor-web-fallback` in frontmatter.

**CLI discovery order:**

```
TRELLIS_SMART_SEARCH_COMMAND  →  smart_search.command setting
        ↓ (not set)
PATH smart-search  →  project node_modules/.bin/smart-search
```

The agent entrypoint is always `./.trellis/scripts/run_smart_search.py`, never the raw CLI binary.

## Semantic routing (Cursor)

`platform-semantic` backend depends on **`cursorEnv`**, resolved from `TRELLIS_CURSOR_BYOK` or `~/.ccursor/routes.json` `byokMode`:

| `cursorEnv` | Backend | Rule |
| --- | --- | --- |
| `native` | Built-in `@codebase` / agent semantic search (`platformNative: true`) | **Do not** use fast-context MCP as Primary |
| `byok` | `fast_context_search` (fast-context MCP) (`semanticBackend: fast-context-mcp`) | Built-in `@codebase` is **not** available in the agent tool list; fast-context is **required** for concept retrieval |

The router envelope always includes `cursorEnv` so the agent knows which semantic backend to call. This is the same signal that drives dual-environment subagent dispatch — see [Cursor integration](cursor.md).

## CLI command reference

| Command | Purpose |
| --- | --- |
| `python ./.trellis/scripts/search_artifacts.py --query "<topic>" --json` | Durable Trellis specs, tasks, research, journals |
| `python ./.trellis/scripts/search_memory.py --query "<topic>" --json` | Prior decisions in workspace journals |
| `python ./.trellis/scripts/run_smart_search.py "<question>" --intent deep-research --json` | External web facts (mandatory first; writes manifest under `{TASK}/research/smart-search/`) |
| `python ./.trellis/scripts/route_codebase_retrieval.py "<question>" --json` | Intent + routes envelope (includes `agentInstructions`) |
| `python ./.trellis/scripts/route_codebase_retrieval.py "<question>" --instructions` | Agent-executable steps only |
| `python ./.trellis/scripts/get_context.py --mode retrieval-pack --json --input evidence.json` | Score collected evidence (does **not** search) |
| `python ./.trellis/scripts/codegraph_session_smoke.py --json` | Verify a `.codegraph/` index exists for the workspace |
| `python ./.trellis/scripts/rank_retrieval_candidates.py --candidates fixtures.json --intents caller-chain --top-k 5 --pretty` | Offline result-layer reordering |

## codegraph-only value

Use codegraph for **call chains**, **cross-package trap disambiguation**, **extension symbol resolution**, **impact / blast radius**, and **definition/reference** (it replaces the Agent's unavailable GO_TO_DEFINITION / LSP). Do **not** use codegraph for:

- Pure literal search — use Grep.
- BYOK concept Primary — use `fast_context_search`.

## See also

- [Cursor integration](cursor.md) — dual-environment dispatch, retrieval injection channels
- [Workflow in Cursor](workflow.md) — where retrieval fits in Phase 1 Discovery and Phase 2 Execute
- [Architecture](architecture.md) — high-level structure and smart-search integration
- [Project README](../README.md)
