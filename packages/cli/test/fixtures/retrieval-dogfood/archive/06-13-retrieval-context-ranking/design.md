# Design

## Goal

Add a deterministic retrieval recommendation layer to Trellis context loading. The layer should rank the next evidence actions an agent should consider for the selected task, without executing retrieval commands automatically.

## Evidence And Constraints

- `session_context.py` already owns text and JSON context loading.
- `retrievalGuide` already exposes commands for artifact search, session memory, Smart Search evidence, and codebase evidence guidance.
- Smart Search evidence is explicit and writes manifests only when `run_smart_search.py` is invoked by the user or agent.
- Session memory search is local-only and exposes stable JSON results through `search_memory.py`.
- Existing context-loading tests cover text and JSON retrieval guide output.

## Runtime Boundary

Implement ranking inside `session_context.py` as a small deterministic helper:

```text
selected task + artifact presence -> retrievalGuide.recommendations[]
```

The helper should not import or call `artifact_search.py`, `session_memory.py`, `run_smart_search.py`, MCP tools, Git commands beyond existing context collection, or codebase search tools.

## Recommendation Contract

Each recommendation is an additive JSON object:

```json
{
  "source": "artifact-search",
  "priority": 90,
  "confidence": "high",
  "reason": "Selected task has planning artifacts; search durable Trellis context first.",
  "action": "python3 ./.trellis/scripts/search_artifacts.py --query \"retrieval context ranking\" --json",
  "reference": ".trellis/tasks/06-13-retrieval-context-ranking"
}
```

Required fields:

- `source`: one of `task-artifacts`, `artifact-search`, `session-memory`, `smart-search`, `codebase-evidence`.
- `priority`: integer sorting key, higher is more important.
- `confidence`: `high`, `medium`, or `low`.
- `reason`: short explanation for display.
- `action`: concrete command or instruction.
- `reference`: selected task path, task artifact path, command, or evidence location.

## Ranking Rules

- If there is no selected task, return an empty recommendation list and do not print a text recommendations block.
- If selected task planning artifacts exist, rank task artifacts first.
- Recommend artifact search for durable Trellis task/spec/research context using a query derived from selected task title, name, and package.
- Recommend session memory for prior decisions and recent related work using the same derived query.
- Recommend Smart Search only as an explicit external-evidence action, with medium or low priority depending on whether selected task research exists.
- Recommend codebase evidence as candidate evidence that must be confirmed by source, Git, or validation.
- Sort by `priority` descending and keep output compact.

## Compatibility

- Existing `retrievalGuide` fields remain unchanged.
- JSON adds `retrievalGuide.recommendations`.
- Text output adds a `Retrieval recommendations:` block only when recommendations exist.
- No changes to journal writes, task records, Smart Search manifests, or artifact search result contracts.

## Tradeoffs

- Recommendation-only ranking is less powerful than auto-running local searches, but it preserves context-loading performance and avoids hidden side effects.
- The query derivation is intentionally simple. Future work can feed actual artifact/session result scores into the same recommendation contract.
