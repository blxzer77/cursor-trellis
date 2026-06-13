# Design

## Runtime Boundary

Add a pure context-pack module or script that consumes already-scored evidence. It should not call retrieval sources.

Candidate module:

```text
.trellis/scripts/common/context_pack.py
packages/cli/src/templates/trellis/scripts/common/context_pack.py
```

An optional command surface may be added only if it remains explicit:

```text
.trellis/scripts/build_context_pack.py --input scored-evidence.json --max-items 8 --json
```

## Pack Contract

Recommended JSON shape:

```json
{
  "version": 1,
  "source": "retrieval-context-pack",
  "budget": {
    "maxItems": 8,
    "maxEstimatedTokens": 4000,
    "estimatedTokens": 1800
  },
  "selected": [
    {
      "source": "artifact-search",
      "reference": ".trellis/tasks/example/prd.md",
      "score": 92,
      "estimatedTokens": 420,
      "reason": "highest trusted task artifact"
    }
  ],
  "omitted": [
    {
      "source": "session-memory",
      "reference": ".trellis/workspace/dev/journal-1.md:42",
      "score": 41,
      "reason": "outside budget after higher-ranked evidence"
    }
  ],
  "warnings": []
}
```

## Packing Rules

- Sort by scored evidence score descending.
- Tie-break by source preference, then reference path.
- Always preserve omission reasons.
- Keep unavailable/failed evidence out of selected items unless the caller explicitly asks for diagnostics.
- Estimate size conservatively from summary/snippet/content fields when available.
- If only metadata exists, use a small fixed estimate and mark it metadata-only.

## Integration Points

- May integrate with `retrievalGuide` as an optional additive field only after contract is stable.
- Should be reusable by eval harness without invoking Trellis CLI subprocesses where possible.

## Compatibility

- Existing Phase 2 commands remain valid.
- No automatic context packing during normal context loading unless explicitly scoped.
- Dogfood/template copies must stay synchronized for generated runtime files.
