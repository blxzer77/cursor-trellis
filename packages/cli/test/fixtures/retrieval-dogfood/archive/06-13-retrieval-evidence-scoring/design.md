# Design

## Runtime Boundary

Add a small generated-runtime scoring module that can be reused by context loading, pack building, and tests.

Candidate module:

```text
.trellis/scripts/common/retrieval_evidence.py
packages/cli/src/templates/trellis/scripts/common/retrieval_evidence.py
```

The module should expose pure functions only. It should not read external network state or execute retrieval commands.

## Contract Shape

Recommended output shape:

```json
{
  "version": 1,
  "source": "smart-search",
  "kind": "external-evidence",
  "reference": ".trellis/tasks/<task>/research/smart-search/<run>/manifest.json",
  "title": "React docs",
  "status": "ok",
  "trust": "high",
  "confidence": "medium",
  "relevance": 82,
  "freshness": 70,
  "sourceAuthority": 90,
  "validationState": "unverified",
  "score": 78,
  "reasons": [
    "source-backed external evidence",
    "manifest status ok",
    "current source validation still required"
  ],
  "warnings": []
}
```

Allowed `source` values should align with Phase 2:

- `task-artifacts`
- `artifact-search`
- `session-memory`
- `smart-search`
- `codebase-evidence`

Suggested `validationState` values:

- `verified`
- `unverified`
- `candidate`
- `unavailable`
- `failed`

## Scoring Policy

- Start with source-specific baseline trust.
- Add relevance when upstream result/recommendation score or priority exists.
- Add freshness for recency-bearing sources such as session memory or Smart Search manifests.
- Penalize degraded evidence.
- Exclude or heavily demote failed/not-configured Smart Search manifests from positive evidence.
- Keep reasons display-safe and short.

## Integration Points

The implementation may add:

- scorer unit/integration tests under `packages/cli/test/scripts/`;
- template registration if a new generated runtime file is added;
- context-loading use only if it remains additive and side-effect free.

## Compatibility

- Do not change existing Phase 2 result contracts.
- Do not require live Smart Search.
- Do not require current codebase retrieval tools.
- Dogfood/template copies must remain synchronized if new generated scripts are added.
