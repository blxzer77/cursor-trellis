# Handoff: Retrieval Context Pack Builder

## Status

Implementation verified and ready for Agent 3 (`retrieval-eval-harness`) and parent integration review. Do not redefine scoring or pack semantics in downstream children.

## Primary API

Import from generated runtime:

```python
from common.context_pack import build_context_pack
```

Example:

```python
from common.retrieval_evidence import score_evidence_bundle
from common.context_pack import build_context_pack

scored = score_evidence_bundle(bundle)
pack = build_context_pack(scored, max_items=8, max_estimated_tokens=4000)
```

Explicit CLI:

```bash
python ./.trellis/scripts/build_context_pack.py --input scored.json --max-items 8 --json
```

## Context Pack JSON Contract

```json
{
  "version": 1,
  "source": "retrieval-context-pack",
  "budget": {
    "maxItems": 8,
    "maxEstimatedTokens": 4000,
    "estimatedTokens": 1800,
    "itemsUsed": 5
  },
  "selected": [
    {
      "source": "task-artifacts",
      "reference": ".trellis/tasks/example/prd.md",
      "title": "Example PRD",
      "score": 92,
      "status": "ok",
      "validationState": "verified",
      "estimatedTokens": 420,
      "metadataOnly": false,
      "reason": "selected as highest-ranked usable evidence"
    }
  ],
  "omitted": [
    {
      "source": "session-memory",
      "reference": ".trellis/workspace/dev/journal-1.md:42",
      "title": "Prior session note",
      "score": 41,
      "status": "ok",
      "validationState": "unverified",
      "reason": "outside budget after higher-ranked evidence"
    }
  ],
  "warnings": [],
  "summary": {
    "totalInput": 9,
    "selectedCount": 5,
    "omittedCount": 4,
    "budgetExceeded": true
  }
}
```

## Budget Semantics

| Input | Effect |
| --- | --- |
| `max_items` | Caps `selected` length. Additional selectable items move to `omitted` with budget reason. |
| `max_estimated_tokens` | Caps summed `estimatedTokens` across selected items. |
| `include_diagnostics` | When true, failed/unavailable evidence may enter `selected` if budget allows. Default false. |

Token estimation is conservative:

- Uses `content`, `summary`, `snippet`, or `snippets[]` when present.
- Metadata-only items use a fixed `80` token estimate.
- Content-bearing items use `max(40, len(text)//4 + 20)`.

## Selection Rules

1. Consume `score_evidence_bundle()` output in existing score order.
2. Select only `status` in `ok` / `degraded` unless `include_diagnostics=true`.
3. Exclude `failed`, `not_configured`, `missing`, and `validationState` `failed` / `unavailable` from body evidence by default.
4. `validationState: candidate` items are selectable only when status is `ok` or `degraded`.
5. Record every skipped item in `omitted` with an explicit `reason`.

### Omission Reasons

- `unavailable evidence excluded from pack body: status <status>`
- `unavailable evidence excluded from pack body: validationState <state>`
- `outside budget after higher-ranked evidence`
- `candidate evidence skipped due to budget`
- `diagnostic-only evidence excluded from pack body`

## How Eval Harness Should Consume Packs

- Assert `version: 1` and `source: retrieval-context-pack`.
- Assert budget trimming with `max_items` reduces `selected` and populates `omitted`.
- Assert empty scored input returns empty `selected` / `omitted`.
- Assert repeated builds preserve selected `reference` ordering.
- Assert no filesystem mutation during in-memory pack builds.

## Side-Effect Boundary

Pack building is read-only over in-memory scored evidence:

- Does not run Smart Search.
- Does not run session memory search.
- Does not run artifact search.
- Does not perform network, MCP, or codebase retrieval.
- Does not mutate manifests, journals, or task artifacts.

## Module Locations

- Dogfood: `.trellis/scripts/common/context_pack.py`, `.trellis/scripts/build_context_pack.py`
- Template: `packages/cli/src/templates/trellis/scripts/common/context_pack.py`, `packages/cli/src/templates/trellis/scripts/build_context_pack.py`

## Tests

Focused coverage lives in:

```text
packages/cli/test/scripts/context-pack.integration.test.ts
```

Cases covered: empty input, mixed sources, budget trimming, deterministic ordering, no side effects.
