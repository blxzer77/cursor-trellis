# Handoff: Retrieval Evidence Scoring

## Status

Implementation verified and ready for Agent 2 (`retrieval-context-pack-builder`) and Agent 3 (`retrieval-eval-harness`). Do not redefine scoring in downstream children.

## Primary API

Import from generated runtime:

```python
from common.retrieval_evidence import score_evidence_bundle
```

Input bundle keys (all optional):

| Key | Phase 2 contract |
| --- | --- |
| `recommendations` | `retrievalGuide.recommendations[]` |
| `selectedTaskArtifacts` | `retrievalGuide.selectedTaskArtifacts` |
| `artifactSearchResults` | `search_artifacts.py` result objects |
| `sessionMemoryResults` | `search_memory.py` `results[]` |
| `smartSearchManifests` | Smart Search `manifest.json` objects |
| `codebaseCandidates` | candidate evidence objects from adapter guidance |

Example:

```python
payload = score_evidence_bundle({
    "recommendations": retrieval_guide["recommendations"],
    "selectedTaskArtifacts": retrieval_guide.get("selectedTaskArtifacts"),
    "artifactSearchResults": artifact_results,
    "sessionMemoryResults": memory_results,
    "smartSearchManifests": manifests,
    "codebaseCandidates": candidates,
})
```

## Scored Evidence JSON Contract

Bundle output:

```json
{
  "version": 1,
  "total": 3,
  "items": []
}
```

Each `items[]` entry:

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

### Field Semantics

| Field | Meaning |
| --- | --- |
| `source` | Evidence origin (see allowed values below). |
| `kind` | `local-artifact`, `historical-context`, `external-evidence`, or `candidate-evidence`. |
| `reference` | Stable path or locator for pack inclusion / omission notes. |
| `title` | Display-safe label. |
| `status` | Evidence availability state (see enum below). |
| `trust` | `high`, `medium`, or `low`. |
| `confidence` | Upstream recommendation confidence when present. |
| `relevance` | 0–100 normalized match/priority signal. |
| `freshness` | 0–100 recency signal. |
| `sourceAuthority` | 0–100 source-type authority baseline. |
| `validationState` | Proof posture (see enum below). |
| `score` | Final deterministic priority score (0–100). |
| `reasons` | Short explainable scoring notes. |
| `warnings` | Display-safe caution strings. |

## Allowed `source` Values

- `task-artifacts`
- `artifact-search`
- `session-memory`
- `smart-search`
- `codebase-evidence`

## Allowed `status` Values

- `ok` — usable evidence item.
- `degraded` — usable with lower confidence; Smart Search gaps expected.
- `failed` — availability signal only; not positive evidence.
- `not_configured` — Smart Search unavailable; not positive evidence.
- `missing` — recommendation exists but no evidence payload was supplied.

## Allowed `validationState` Values

- `verified` — durable local artifact evidence (task artifacts, artifact search).
- `unverified` — usable but requires confirmation (session memory, ok/degraded Smart Search).
- `candidate` — codebase retrieval until current source/Git/validation confirms it.
- `unavailable` — missing or not-configured evidence.
- `failed` — failed Smart Search or equivalent hard failure.

## Sorting Rules

`score_evidence_bundle()` returns `items` sorted deterministically by:

1. `score` descending
2. `source` precedence: `task-artifacts` → `artifact-search` → `session-memory` → `smart-search` → `codebase-evidence`
3. `reference` ascending
4. `title` ascending

Downstream pack builder should preserve this order unless budget trimming requires explicit omission records.

## Scoring Policy Summary

| Source | Trust baseline | Validation default | Notes |
| --- | --- | --- | --- |
| `task-artifacts` | high | `verified` | Highest authority when artifacts exist. |
| `artifact-search` | high | `verified` | Durable markdown matches. |
| `session-memory` | medium | `unverified` | Historical context, not authoritative proof. |
| `smart-search` ok | high | `unverified` | External evidence; still needs current validation. |
| `smart-search` degraded | medium | `unverified` | Score penalty + warning. |
| `smart-search` failed / `not_configured` | low | `failed` / `unavailable` | Score capped; warnings required. |
| `codebase-evidence` | medium | `candidate` | Always requires confirmation. |

Final score formula (deterministic):

```text
score = clamp(
  relevance * 0.45
  + sourceAuthority * 0.25
  + freshness * 0.15
  + trustWeight * 0.15
  - statusPenalty,
  0,
  100
)
```

`trustWeight`: high=100, medium=70, low=40. Failed / not_configured Smart Search uses `scoreCap` (8 / 12).

## How Pack Builder Should Consume Scores

1. Call `score_evidence_bundle()` with already-collected Phase 2 payloads. Do not execute retrieval commands inside scoring.
2. Iterate `payload["items"]` in order.
3. Select high-scoring `ok` / `degraded` evidence first.
4. Treat `failed`, `not_configured`, and `missing` as omission or warning candidates, not pack body evidence.
5. Keep `validationState: candidate` items only when budget allows and emit omission reason when skipped.
6. Record omitted items with the item `reference`, `status`, `validationState`, and top `warnings`/`reasons`.

## How Eval Harness Should Consume Scores

- Assert stable field presence on `items[]`.
- Assert deterministic ordering for fixture bundles.
- Assert Smart Search `failed` / `not_configured` never outrank `task-artifacts` / `artifact-search` on equal-fixture runs.
- Assert session memory never receives `validationState: verified`.
- Assert codebase evidence remains `validationState: candidate`.

## Side-Effect Boundary

Scoring is read-only over in-memory contracts:

- Does not run Smart Search.
- Does not run session memory search.
- Does not run artifact search.
- Does not perform network, MCP, or codebase retrieval.
- Does not mutate manifests, journals, or task artifacts.

Upstream collectors remain responsible for producing Phase 2 payloads before scoring.

## Module Locations

- Dogfood: `.trellis/scripts/common/retrieval_evidence.py`
- Template: `packages/cli/src/templates/trellis/scripts/common/retrieval_evidence.py`

## Tests

Focused coverage lives in:

```text
packages/cli/test/scripts/retrieval-evidence.integration.test.ts
```

Cases covered: empty bundle, mixed sources, degraded/failed/not_configured Smart Search, missing recommendation signals, deterministic ordering.
