# Handoff: Smart Search Evidence Integration

## Status

Implementation verified and ready for parent review.

## Downstream Contract

`run_smart_search.py` writes a compact manifest at:

```text
.trellis/tasks/<task>/research/smart-search/<run-id>/manifest.json
```

When no selected or explicit task exists, it falls back to:

```text
.trellis/workspace/smart-search/<run-id>/manifest.json
```

Manifest fields for `retrieval-context-ranking`:

```json
{
  "version": 1,
  "source": "smart-search",
  "query": "React docs",
  "intent": "deep-research",
  "command": "smart-search research ... --format json --output ...",
  "outputPath": ".trellis/tasks/<task>/research/smart-search/<run>/deep_research.json",
  "evidenceDir": ".trellis/tasks/<task>/research/smart-search/<run>",
  "manifestPath": ".trellis/tasks/<task>/research/smart-search/<run>/manifest.json",
  "status": "ok",
  "createdAt": "2026-06-13T00:00:00Z",
  "summary": "short normalized summary",
  "citations": [
    {"title": "Example", "url": "https://example.com", "provider": "jina"}
  ],
  "gapCheck": {},
  "providerAttempts": [],
  "degraded": false,
  "routePolicyVersion": "research-router-v1",
  "doctor": {
    "ok": true,
    "config_status": "ok",
    "minimum_profile_ok": true,
    "capability_status": {},
    "resolved_evidence_dir": "masked-or-safe-path",
    "config_dir_source": "default"
  }
}
```

Allowed `status` values:

- `ok`
- `degraded`
- `failed`
- `not_configured`

Context ranking should treat:

- `ok` as usable source-backed external evidence.
- `degraded` as usable with lower confidence and visible gap explanation.
- `failed` and `not_configured` as availability signals, not evidence.

## Command Surface

Default deep research:

```powershell
python .\.trellis\scripts\run_smart_search.py "question" --intent deep-research --json
```

Supported intents:

- `deep-research`
- `broad-search`
- `docs`
- `official-source`
- `fetch`

## Notes For Parent Integration

- This child does not change session memory ranking.
- Live Smart Search checks were not run; tests use a mocked CLI to avoid credentials and network.
- `retrieval-context-ranking` should consume `manifest.json` instead of parsing Smart Search raw output directly.
