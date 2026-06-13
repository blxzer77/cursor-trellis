# Handoff: Retrieval Context Ranking

## Status

Implementation verified and ready for parent review.

## Downstream Contract

`get_context.py --json` now includes an additive field:

```json
{
  "retrievalGuide": {
    "recommendations": [
      {
        "source": "task-artifacts",
        "priority": 100,
        "confidence": "high",
        "reason": "Selected task has local planning or evidence artifacts; read them first.",
        "action": "Read selected task prd.md, design.md, implement.md, research/*.md, and verify.md as present.",
        "reference": ".trellis/tasks/06-13-context"
      }
    ]
  }
}
```

Recommendation fields:

- `source`: `task-artifacts`, `artifact-search`, `session-memory`, `smart-search`, or `codebase-evidence`.
- `priority`: integer sort key, higher first.
- `confidence`: `high`, `medium`, or `low`.
- `reason`: display-safe explanation.
- `action`: concrete command or instruction.
- `reference`: selected task path, evidence directory, workspace path, or source tree reference.

## Ranking Behavior

- No selected task: `recommendations` is `[]`, and text output does not print a recommendation block.
- Selected task with local artifacts: `task-artifacts` ranks first.
- Artifact search and session memory recommendations use a compact query derived from selected task title, name, package, and description.
- Smart Search is recommended only as an explicit action. It is lower priority when selected-task research artifacts already exist.
- Codebase evidence is always marked as candidate evidence that must be confirmed against current source, Git state, or validation.

## Side-Effect Boundary

Context loading remains read-only:

- Does not call `search_artifacts.py`.
- Does not call `search_memory.py`.
- Does not call `run_smart_search.py`.
- Does not write Smart Search manifests.
- Does not invoke network, MCP, or codebase search tools.

## Notes For Parent Integration

This child connects the two upstream handoffs:

- `source: "session-memory"` is local historical context.
- `source: "smart-search"` is explicit external evidence capture.
- Durable task artifacts and current source validation still outrank memory and candidate codebase evidence.
