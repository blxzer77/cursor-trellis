# Retrieval daily guide (Cursor-first)

> **Purpose:** Choose the right tool; do not confuse **search** with **retrieval-pack scoring**.

## Web research rule (smart-search is mandatory first)

For **external / current / web facts**, **smart-search** (`run_smart_search.py`) is the **mandatory first choice**. Platform built-in web tools (Cursor `WebSearch` / `WebFetch`) are **downgrade-only**: use them solely when smart-search is unavailable (`doctor` not ok, `not_configured` / `failed`, or timeout). Never reach for built-in web search while smart-search is healthy. This rule overrides any general "use available tools" instinct — web retrieval strength is routed inside Trellis, not left to the platform default.

## External-knowledge gate (search-or-not)

Ask: *If this answer were wrong because the world or a third-party API moved, would that matter?*

| Decision | Action |
| --- | --- |
| **YES** (freshness / third-party surface) | Run `run_smart_search.py` — prefer `docs` / `official-source` / `broad-search` when cheap; use `deep-research` when multi-source or claim-risk is high |
| **NO** (truth lives in this workspace) | Use rg / codegraph / `.cstl/spec` / task artifacts only — do **not** default to web |
| **Ambiguous** | Prefer a **cheap** external probe over guessing; do not skip solely to save a call |

**YES examples:** library/SDK current API or version; changelog / release notes; CVE / GitHub issue status; pricing / product status; live URLs; industry practice when designing policy.  
**NO examples:** symbol location / call chains; in-repo Trellis contracts; behavior of the code you are editing; pure rename/lint inside known files.  
After search: persist under `{TASK}/research/` with a **provider label**; treat hits as candidates until corroborated (repo, test, or second source).

## Primary source preference

Prefer **primary sources** — official docs, source code, first-party API references, release notes, standards text. Mark blog posts, aggregators, and unverified second-hand summaries as **secondary** until corroborated against a primary source or the repo. This layers on top of "hits as candidates until corroborated": it ranks *which* candidates to trust first, and does not change the smart-search mandatory-first rule above.

## Prefer / Adapt / Own (code intelligence)

| Need | **Prefer** (Cursor native) | **Adapt** | **Own** (codegraph / MCP) |
| --- | --- | --- | --- |
| Exact literal / path | **Grep** (`rg`) | — | — |
| Named-symbol definition | **Grep → Read** | Path hints from semantic when file unknown | codegraph when trap/overload/blast context |
| IDE diagnostics | **ReadLints** | — | — |
| Conceptual discovery | **@codebase** / built-in semantic (Native) | **fast_context_search** (BYOK) | — |
| Caller chain / blast radius | Grep gap-fill | — | **codegraph** MCP |
| Cross-package trap / extension | Grep scoped | — | **codegraph** MCP |
| Raw LSP / GO_TO_DEFINITION | **Not in Agent tool table** — re-probe before claiming Prefer | — | codegraph product fallback |

**Rollback:** restore pre-P1 codegraph-first definition rows in this guide + `.cursor/rules/retrieval-routing.mdc`; keep codegraph MCP enabled.

**Evidence (2026-08-05):** `research/cursor-code-intel-external.md` — official Agent tools = search/read/edit (no LSP); semantic (@codebase) ≠ LSP; Agents Window LSP gap staff-confirmed on forum.

## Quick matrix

| Need | Tool | Notes |
| --- | --- | --- |
| Exact string / path / log line | **rg** (Grep) | Fast literal match in repo |
| Named-symbol definition | **Grep → Read** (Prefer); **codegraph** when trap/blast | Native first; structure when ambiguous |
| IDE diagnostics | **ReadLints** | Cursor-native linter/diagnostic surface |
| Symbol, callers, edit blast radius | **codegraph** MCP | Own layer: structure-first for caller/trap/extension intents |
| Unknown keywords, semantic discovery | **@codebase** (Cursor Native) / **fast-context** (Cursor++ BYOK) | Native: built-in semantic; BYOK: `fast_context_search` MCP (see `cursorEnv` in plans) |
| External / current facts | **smart-search-cli** | **Mandatory first** — built-in web tools are downgrade-only (see rule above) |
| Trellis durable docs | **artifact-search** | `search_artifacts.py` |
| Past sessions | **session-memory** | Historical; verify against tasks/spec |
| Intent hint for code questions | **router** | `route_codebase_retrieval.py` — plan JSON + `agentInstructions`; `--instructions` for steps only |
| Agent follows retrieval policy on Cursor | **`.cursor/rules/retrieval-routing.mdc`** + **`route_codebase_retrieval.py`** | Rules enforce default tool order; `beforeSubmitPrompt` hook is telemetry-only (no plan injection); sessionStart is session-level orientation |
| Score collected evidence | **retrieval-pack** | `get_context.py --mode retrieval-pack` — does **not** search |

## Semantic routing (Cursor)

The planner emits **`platform-semantic`** with backend chosen by **`cursorEnv`** (`native` | `byok` from `~/.ccursor/routes.json` or `TRELLIS_CURSOR_BYOK`):

- **native:** built-in `@codebase` / agent semantic search — **do not** use fast-context as Primary.
- **byok:** **fast-context MCP** (`fast_context_search`) — built-in semantic is not in the agent tool list.

Definition / reference jumps (Agent): **Prefer Grep → Read** for named symbols; **codegraph** when trap/blast/ambiguity. **Not** raw LSP: `GO_TO_DEFINITION` absent from [Agent tool overview](https://cursor.com/docs/agent/overview.md) (2026-08-05). Semantic / `@codebase` is a separate Prefer path for concepts (embedding index), not LSP. IDE Editor F12 ≠ Agent tool routing.

## Token economy signals

Each route in the router output includes a `tokenEconomy` label:

| Label | Meaning | Typical tools |
| --- | --- | --- |
| `high` | Low token cost per correct answer (~80-200 tokens) | codegraph callers/search, platform-semantic |
| `medium` | Moderate token cost (~200-700 tokens) | codegraph explore, smart rg, fast-context |
| `low` | High token cost per answer (~3000+ tokens) | naive rg (unconstrained output) |

When `projectFileCount > 2000`, the router promotes structural (codegraph) routes ahead of rg routes for better token efficiency on large codebases.

**Project file count default:** `route_codebase_retrieval.py` and `get_context.py --mode retrieval-pack` default `--project-file-count` to **`auto`** — they count files under the repo root (`git ls-files` when `.git` exists, else a bounded walk). Override with an integer (e.g. `5000`) for large non-git trees or eval fixtures.

## Commands

```powershell
python ./.cstl/scripts/search_artifacts.py --query "<topic>" --json
python ./.cstl/scripts/search_memory.py --query "<topic>" --json
python ./.cstl/scripts/run_smart_search.py "<question>" --intent deep-research --json
python ./.cstl/scripts/route_codebase_retrieval.py "<question>" --json
python ./.cstl/scripts/route_codebase_retrieval.py "<question>" --instructions
python ./.cstl/scripts/get_context.py --mode retrieval-pack --json --input evidence.json
python ./.cstl/scripts/codegraph_session_smoke.py --json
```

## Codegraph session readiness (eval / dogfood)

Before a **cold benchmark** or structural-heavy run:

1. **MCP**: In Cursor project MCP settings, enable the **codegraph** server for the workspace (or eval checkout).
2. **Index on disk**: Run `python ./.cstl/scripts/codegraph_session_smoke.py` (exit 0 = at least one `.codegraph/` under workspace root or a top-level subproject). Use `--root <eval-checkout>` when the agent root is not the harness.
3. **Live MCP smoke** (manual): one `codegraph_search` with a known symbol in that repo; stale-index banner → re-read affected files.

Paste into the **run report header** (markdown):

| Field | Example |
| --- | --- |
| `codegraph_mcp` | `configured` / `off` / `unknown` |
| `codegraph_index_path` | from smoke JSON `codegraph_index_paths[0]` |
| `codegraph_smoke_at` | ISO8601 UTC |
| `codegraph_smoke_ok` | `true` / `false` |

## smart-search fallback

When `smart-search doctor` is not ok or `run_smart_search.py` status is `not_configured` / `failed` (including **search timeout**), use **Cursor WebSearch/WebFetch**, then persist to `{TASK}/research/` with `source: cursor-web-fallback` in frontmatter. See `smart-search-cli` skill §4b.

**CLI discovery (Cursor):** `TRELLIS_SMART_SEARCH_COMMAND` / `smart_search.command` → PATH `smart-search` → project `node_modules/.bin/smart-search` (when installed as a dependency). Agent entrypoint is always `./.cstl/scripts/run_smart_search.py`.

**Research flags (smart-search ≥ 0.2.0; flags also on 0.1.15+):** pass through `run_smart_search.py` for `--intent deep-research`:

| Flag | Values | Use |
| --- | --- | --- |
| `--locale-scope` | `cn`, `en`, `both` (CLI default) | Skip bilingual discovery when cost matters |
| `--dry-run` | flag | Plan + routing preview only; no live providers |
| `--progress` | flag | `[research]` stage logs to stderr |

Research JSON may include `output_schema_version: 1` and structured `citations` (`id`, `source_type`, `verified`, `content_len`). Trellis manifests preserve those fields when present.

**Cursor skill surface:** `smart-search-cli` is an internal workflow name — it is **not** installed under `.cursor/skills/` (commands-only policy). On Cursor, follow this guide + `run_smart_search.py`; bundled skill assets ship for Codex/Gemini via `.agents/skills/` only.

## Router vs execution

`route_codebase_retrieval.py` returns **intent + route suggestions** and **`agentInstructions`** (numbered steps with Cursor-native tool names). **codebase-evidence** is **candidate** until confirmed by Read/Git/tests.

On **Cursor**, retrieval policy lives in **`.cursor/rules/retrieval-routing.mdc`** (`alwaysApply`) plus on-demand **`route_codebase_retrieval.py`**. The **`beforeSubmitPrompt`** hook is **telemetry-only** (no plan injection). `sessionStart` delivers session-level orientation (dashboard, workflow summary). Do **not** rely on end-of-turn **retrieval-pack** for plans — retrieval-pack **scores** collected evidence; it does not search.

### Result-layer ranking (B / E / D — REC-05)

After Grep/codegraph/semantic produce **path candidates**, reorder before choosing Top-1 / Top-5:

| Intent | Rule |
| --- | --- |
| `caller-chain` | Expanded pool first; boost concrete call sites; demote facade/barrel/runtime/registry **assembly-only** files. |
| `trap-package-disambiguation` | Demote snapshot/registry/`src/agents/` trap paths unless Read confirms the asked layer. |
| `env-config-literal` | Prefer `scripts/`, `e2e/`, `bench/`, `test/` over generic `src/auth` / `src/paths`. |

- **Agent plans**: `render_agent_instructions` / `route_codebase_retrieval.py --instructions` append a **结果层排序** block when these intents appear.
- **Offline reorder**: `python ./.cstl/scripts/rank_retrieval_candidates.py --candidates fixtures.json --intents caller-chain --top-k 5 --pretty`
- **Library**: `common/retrieval_result_ranking.py` (Python mirror used by router and rank script).

Do **not** claim aggregate openclaw score gains from ranking alone without fresh telemetry (`candidate_pool_recall` vs final Top-K).

### Structural-first routing (v2)

For structural intents (caller-chain, trap-package-disambiguation, extension-shared-symbol), the router now suggests **codegraph before rg**. This reflects codegraph's superior token economy for structural queries (~80-150 tokens/answer vs rg's ~3557 for naive grep). The agent should still use rg to fill gaps codegraph misses (dynamic dispatch, string-based callsites).

### Semantic routing on Cursor (plans)

Envelopes include **`cursorEnv`**. `platform-semantic` uses **`platformNative: true`** on native and **`semanticBackend: fast-context-mcp`** on BYOK. Native: `@codebase` / built-in search; BYOK: `fast_context_search`.

### Semantic dual metrics (openclaw / eval)

| Metric | Meaning |
| --- | --- |
| `semantic_plan_rate` | Share of queries whose routing envelope lists a semantic route |
| `semantic_exec_rate` | Share of queries with ≥1 semantic search tool call |

On **Cursor**, `semantic_exec_rate` uses `classify_tool_calls(..., platform=cursor, cursor_env=...)`: **native** counts built-in semantic only; **byok** counts `fast_context_search` as semantic exec. `cursor_fast_context_misuse` applies only when **native** (or non-byok) uses fast-context while the plan has `platform-semantic`. See `cursor-semantic-compliance.md`.

Plan-level presence does not imply execution-level use (see parent research `06-19` OQ-1 双轨).

### Execution telemetry (schema v2)

When recording eval or audit runs, store **one JSON object per query** in JSONL (`schema_version: 2`). Split scores:

| Field | Owner | Meaning |
| --- | --- | --- |
| `answer_score` | Human rubric | Top-1 / Recall@5 / answer quality (0–6 per query in main-50) |
| `compliance_score` | Derived | Plan vs exec layer compliance (0–1); structural/codegraph, semantic, read verify |

Key exec fields (fill from session tool log): `tools_called`, `grep_count`, `read_count`, `codegraph_executed`, `semantic_executed`, `router_cli_invoked`, `plan_block_in_prompt`, `read_verification_done`. Classify tool names with `common/retrieval_tool_classification.py` (see `cursor-semantic-compliance.md`).

## retrieval-pack

Default `get_context.py --json` returns **retrievalGuide** only. Run `--mode retrieval-pack` after you have collected evidence JSON / smart-search manifests under `{TASK}/research/smart-search/`.

## Adapters (optimization #9)

Core: rg, task-artifacts, artifact-search, source-git-tests. Enhance: codegraph (structural-first), platform-semantic (Cursor `@codebase`), smart-search, session-memory. Placeholders: mcp/browser/network envelope only.