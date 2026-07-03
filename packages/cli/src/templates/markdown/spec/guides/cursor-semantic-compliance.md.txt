# Cursor semantic compliance (REC-06)

## Plan vs exec

| Layer | What counts |
| --- | --- |
| **Plan** | Router route `platform-semantic` (`platformNative: true`) or injected plan step「内置代码库语义搜索」 |
| **Exec (Cursor)** | Tool log matches **platform semantic** patterns only — see `retrieval_tool_classification` |
| **Not semantic exec on Cursor** | `fast_context_search`, pure Grep/Read/codegraph |

## Classifying tool names from session logs

Use the same patterns as telemetry:

```powershell
python -c "from common.retrieval_tool_classification import classify_tool_calls; print(classify_tool_calls(['Grep','codebase_search'], platform='cursor'))"
```

(Run from `.cstl/scripts` with `PYTHONPATH` set to that directory.)

On **cursor**, `semantic_executed` = `platform_semantic_executed`. Track `fast_context_count` and `cursor_fast_context_misuse` separately.

## Per-query checklist

When `platform-semantic` is in the route list, verify in the session tool log:

- `plan_block_in_prompt` — visible `## 代码库检索计划` (or equivalent) before code search
- `tools_called` — verbatim tool names from Cursor
- `platform_semantic_executed` / `fast_context_count` — from `classify_tool_calls(..., platform=cursor, cursor_env=...)`

Plan-level presence does not imply execution-level use.

## Agent instructions

When `platform-semantic` is in the route list, `render_agent_instructions` appends **语义合规（Cursor）** requiring one built-in semantic search before Top-1 and logging the host tool name.

## Native live proof (OC-15, 2026-07-02)

Controlled main-session run (`07-02-child-oc15-semantic-proof`): 3/3 conceptual queries with router `platform-semantic` executed host tool **`SemanticSearch`** → `platform_semantic_executed=true` (`cursor_env=native`). See `research/native-semantic-execution-proof.md`.

**Caveat:** Proves observability + compliant-agent behavior; does not guarantee all sessions follow the plan (historical evals show Grep-only gaps when agents skip semantic).
