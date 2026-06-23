# Cursor retrieval capability probe — manual prompts (Phase 1)

> **Purpose:** Measure retrieval capabilities that require a live agent session
> (MCP tools, built-in semantic search, LSP). Run each probe in **both**
> environments and record results in `retrieval_probe_matrix_template.json`.
>
> **Environment A (Native):** ccursor proxy OFF (or `byokMode=0`).
> **Environment B (BYOK):** ccursor proxy ON, `byokMode=1`.

## How to use this file

1. Switch to the target environment (Native or BYOK) in Cursor.
2. Copy the **probe block** (from `--- PROBE` to the next `---`) into a fresh
   Cursor Agent chat. Use the same block in both environments.
3. The agent answers with a structured reply; copy its answer into the matching
   `native`/`byok` slot of the matrix JSON.
4. Do **not** coach the agent. It must use whichever tools it actually has.
5. Record the **actual tool name** the agent called (from its tool-use output),
   not the name we asked for — this is the BYOK detection signal.

## Deterministic known answers

Every probe has a verifiable answer derived from the `D:\MyHarness` workspace.
The agent either returns the right answer (pass) or does not (fail/degraded).

---

--- PROBE P-03: codegraph MCP — codegraph_search (symbol lookup)

You are a retrieval capability probe. Do NOT read any files directly. Use ONLY
the **codegraph_search** MCP tool to answer.

Task: Call `codegraph_search` with the query `patch_wpelc8` and report:
1. The file path(s) returned (expected to contain `patch_wpelc8.py` under
   `.trellis/local/cursor2plus/`).
2. The symbol kind (expected: `function`).
3. The exact tool name you invoked (from your tool-use record).

Reply in this exact format:

```
P-03 RESULT
tool_invoked: <exact tool name from your tool-use record>
file_path: <path returned>
symbol_kind: <kind returned>
verdict: pass  # pass if patch_wpelc8.py appears, else fail
notes: <anything notable>
```

---

--- PROBE P-04: codegraph MCP — codegraph_callers (caller chain)

You are a retrieval capability probe. Do NOT read any files directly. Use ONLY
the **codegraph_callers** MCP tool to answer.

Task: Call `codegraph_callers` with the symbol `route_codebase_retrieval` and
report:
1. The list of caller sites returned (expected: at least one caller in
   `route_codebase_retrieval.py` under `.trellis/scripts/`).
2. The count of callers.
3. The exact tool name you invoked.

Reply in this exact format:

```
P-04 RESULT
tool_invoked: <exact tool name from your tool-use record>
caller_count: <number>
caller_sites: <semicolon-separated file:line list, or "none">
verdict: pass  # pass if at least 1 caller found, else fail
notes: <anything notable>
```

---

--- PROBE P-06: fast-context MCP — semantic search

You are a retrieval capability probe. Do NOT read any files directly. Use ONLY
the **fast-context** MCP tool (fast_context_search) to answer.

Task: Call the fast-context semantic search with the query:
`Cursor++ BYOK subagent model routing patch`

Report:
1. Whether the tool returned any results.
2. If so, the top file path (expected to contain something under
   `.trellis/local/cursor2plus/` or `.trellis/spec/guides/cursor-subagent-policy.md`).
3. The exact tool name you invoked.

Reply in this exact format:

```
P-06 RESULT
tool_invoked: <exact tool name from your tool-use record>
result_count: <number>
top_file: <path or "none">
verdict: pass  # pass if tool executed and returned results, else fail
notes: <anything notable>
```

---

--- PROBE D-01: Experiment D — codebase semantic tool inventory (manual)

**Experiment D** documents why **Cursor++ BYOK** often lacks built-in **SemanticSearch**
(P-08 `tool_invoked: none`) and why **fast_context_search** is the designed Primary.

Before running P-08, inventory what **this Agent session** can use for **codebase-wide
concept recall** (not Grep on a known string). Do **not** invoke tools yet — list from
your **available tool table / MCP list** only.

Also run locally (or ask the user to confirm):
`python .\.trellis\scripts\cursor_retrieval_probe.py --json` and note `env.env`,
`mcp_config.fast_context_configured`, and auto `D-01` status.

Reply in this exact format:

```
D-01 RESULT
cursor_env: native|byok|unknown  # from probe JSON env.env or your knowledge of ccursor/BYOK
builtin_semantic_tools: <comma-separated names, or "none">  # e.g. SemanticSearch, @codebase
fast_context_mcp_listed: yes|no
fast_context_search_listed: yes|no
auto_d01_status: pass|fail|degraded|not_run  # from probe auto_results D-01 if you ran it
verdict: pass|fail|degraded
notes: <BYOK expects builtin none + fast-context; Native expects SemanticSearch or equivalent>
```

verdict rules:
- **Native:** pass if `builtin_semantic_tools` includes SemanticSearch or equivalent built-in codebase semantic.
- **BYOK:** pass if `builtin_semantic_tools` is `none` (or empty) **and** `fast_context_search_listed` is yes **and** auto D-01 is pass when mcp.json has fast-context+codegraph.
- **degraded:** BYOK with fast-context MCP missing from config/list, or Native without built-in semantic but fast-context present.
- **fail:** cannot determine tool table, or BYOK with neither builtin nor fast-context path.

Pair with **P-08** (actual concept question) and **P-08-SA** (fast-context only).

---

--- PROBE P-08: @codebase semantic search (Cursor built-in)

You are a retrieval capability probe. Do NOT use Grep, Read, or any MCP tool.
Use ONLY Cursor's **built-in codebase / semantic search** (the `@codebase`
capability or any built-in semantic search tool the host exposes) to answer.

The question below is deliberately written with NO literal file names, symbol
names, or paths — it can only be answered by semantic understanding of the
codebase, not by literal string matching.

Semantic question:
> "Where does the system decide which model a background sub-agent will run on
> when the user is routing their own API keys through a local proxy instead of
> the official cloud?"

Expected answer (for verification, do NOT reveal this to the solver path):
the relevant logic lives in `.trellis/local/cursor2plus/patch_wpelc8.py` (the
`WPeLc8` function patch) and is documented in
`.trellis/spec/guides/cursor-subagent-policy.md` and
`.trellis/spec/guides/cursor-subagent-reverse-engineering-report.md`.

Reply in this exact format:

```
P-08 RESULT
tool_invoked: <exact tool name from your tool-use record — e.g. @codebase, codebase_search, SemanticSearch, or "none">
answer: <your answer to the semantic question>
matched_expected: yes|no  # yes if answer references patch_wpelc8.py or cursor-subagent-policy.md
verdict: pass|fail|degraded
notes: <did the tool execute at all? any error? did you fall back to another tool?>
```

verdict rules:
- pass: built-in semantic tool executed AND answer references the expected files.
- degraded: tool executed but answer wrong, OR you had to fall back to Grep/codegraph.
- fail: built-in semantic tool did not execute / not available / errored out.

---

--- PROBE P-08-SA: Concept probe — fast-context only (BYOK Primary path)

You are a retrieval capability probe. Answer the semantic question below using
**only** the fast-context MCP tool **`fast_context_search`** (CallMcpTool on the
fast-context server). Do NOT use Grep, Read, SemanticSearch, @codebase,
codegraph_*, Task subagent, or WebSearch.

Use a natural-language query in English (add Chinese business terms only if helpful).
Set `project_path` to the workspace root (e.g. D:\MyHarness).

Semantic question (same as P-08 — no literal file/symbol/path clues in your query):
> "Where does the system decide which model a background sub-agent will run on
> when the user is routing their own API keys through a local proxy instead of
> the official cloud?"

Expected (for verification only — do not paste paths into fast_context_search query):
Top hits should include `.trellis/local/cursor2plus/patch_wpelc8.py` and/or
`.trellis/spec/guides/cursor-subagent-policy.md`.

Reply in this exact format:

```
P-08-SA RESULT
tool_invoked: fast_context_search|none|other
top_paths: <comma-separated paths from fast_context_search results, or "none">
matched_expected: yes|no  # yes if top_paths includes patch_wpelc8.py or cursor-subagent-policy.md
verdict: pass|fail|degraded
notes: <errors, empty results, or if you had to use another tool>
```

verdict rules:
- pass: fast_context_search executed AND matched_expected yes.
- degraded: executed but wrong/empty top paths.
- fail: did not invoke fast_context_search, or tool missing in this session.

**Native:** optional control — pass confirms MCP works; Primary for concept recall
remains built-in SemanticSearch (P-08). **BYOK:** required — this is the designed
Primary when P-08 reports `tool_invoked: none`. Pair with D-01 inventory and P-08.

---

--- PROBE P-09: DEEP_SEARCH / wide cross-cutting semantic explore

You are a retrieval capability probe. Use Cursor's **DEEP_SEARCH** capability
(or the equivalent wide cross-cutting semantic explore tool the host exposes)
to answer. Do NOT use Grep or Read until after you have attempted DEEP_SEARCH.

Semantic question (no literal clues):
> "How does the workspace stitch together per-query retrieval plans, agent
> execution policy, and per-turn hook injection across Cursor, given that one
> of the injection channels is known-broken?"

Expected (for verification only): the answer should weave together
`.cursor/hooks/inject-retrieval-plan.py` (beforeSubmitPrompt injection),
`.cursor/rules/retrieval-routing.mdc` (alwaysApply policy), and the
`sessionStart` bug #158452 noted in `.trellis/spec/guides/cursor-context-injection-guide.md`.

Reply in this exact format:

```
P-09 RESULT
tool_invoked: <exact tool name — DEEP_SEARCH, Explore subagent, or "none">
answer: <your answer>
matched_expected: yes|no  # yes if answer references at least 2 of: inject-retrieval-plan.py, retrieval-routing.mdc, sessionStart bug #158452
verdict: pass|fail|degraded
notes: <did DEEP_SEARCH run? did you fall back to subagent explore / Grep?>
```

verdict rules:
- pass: DEEP_SEARCH (or equivalent) executed AND answer references >=2 expected anchors.
- degraded: fell back to Explore subagent / codegraph / Grep, or answer partial.
- fail: no wide explore tool executed.

---

--- PROBE P-10: Definition / reference (codegraph — Agent LSP not exposed)

Cursor Agent does **not** expose GO_TO_DEFINITION in the tool table (Native/BYOK).
Trellis routes definition/reference to **codegraph**. This probe measures the
**product path**, not raw LSP.

You are a retrieval capability probe. Use **codegraph_node** or **codegraph_search**
as the **primary** path. Do NOT use Grep as the first step. Use **Read** only to
confirm line numbers after codegraph returns a definition.

Task: Locate the **definition** of `route_codebase_retrieval` (Python function).

Expected: definition in `.trellis/scripts/common/codebase_retrieval_router.py`
(`def route_codebase_retrieval(`).

Reply in this exact format:

```
P-10 RESULT
tool_invoked: <exact tool name — codegraph_node, codegraph_search, or "none">
definition_file: <path>
definition_line: <line number or "unknown">
verdict: pass|fail|environment_limitation
notes: <if you tried GO_TO_DEFINITION and it was unavailable, say so; pass when codegraph + Read confirm def>
```

verdict rules:
- **pass**: codegraph (or equivalent MCP) returned the correct `def route_codebase_retrieval` file.
- **environment_limitation**: only when codegraph MCP/index is missing; not when LSP is missing.
- **fail**: wrong file or no structural tool executed.

---

## After running all probes

For each probe, fill the matching `native` and `byok` objects in
`retrieval_probe_matrix_template.json`:

```json
"native": { "status": "pass", "evidence": "<answer excerpt>", "actual_tool": "<tool_invoked>", "probed_at": "<ISO8601>" }
```

Then set `verdict.summary`, `verdict.degraded_capabilities` (list of probe IDs
where byok differs from native), and `verdict.probed_at`.

Degraded capabilities drive Phase 2 code adaptations — only those that actually
differ between environments get changed.
