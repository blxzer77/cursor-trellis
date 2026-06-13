# Design

## Goal

Connect Trellis to Smart Search through a stable evidence handoff while keeping `smartsearch-private` as an independent CLI-backed service.

## Evidence

- `smart-search-cli` defines the local wrapper contract and requires `smart-search` to resolve from PATH.
- `smart-search config path --format json` exposes `resolved_evidence_dir`.
- `smart-search doctor --format json` is the parseable availability and configuration check.
- `smart-search research ... --format json --output PATH` exposes `research_plan`, `evidence_items`, `citations`, `gap_check`, `provider_attempts`, `fallback_used`, `degraded`, `route_policy_version`, and `evidence_dir`.
- Provider commands support `--output PATH`, which gives Trellis a durable reference without needing to copy large result bodies into task artifacts.

## Proposed Runtime Boundary

Add a Trellis-owned Smart Search evidence layer that shells out to the `smart-search` CLI and records a compact manifest under the active task, for example:

```json
{
  "version": 1,
  "source": "smart-search",
  "query": "user or task query",
  "intent": "deep-research|docs|official-source|broad-search|fetch",
  "command": "smart-search research ... --format json --output ...",
  "outputPath": ".trellis/tasks/<task>/research/smart-search/<run>/research.json",
  "evidenceDir": ".trellis/tasks/<task>/research/smart-search/<run>",
  "status": "ok|degraded|failed|not_configured",
  "createdAt": "ISO-8601",
  "summary": "short result summary",
  "citations": [
    {"title": "optional", "url": "https://example.com", "evidencePath": "..."}
  ],
  "gapCheck": {},
  "providerAttempts": []
}
```

The manifest is the public contract for downstream context ranking. Ranking should not parse Smart Search internals unless fields are copied into this contract.

## Trellis Surface

Prefer a local Trellis script or command wrapper rather than changing `smartsearch-private`:

- Preflight: `smart-search doctor --format json`.
- Evidence root: active task `research/smart-search/<timestamp-or-slug>/`, not the global Smart Search evidence root, when a Trellis task exists.
- Execution: run `smart-search research` for deep research or source-backed investigation; use command recipes for narrower docs/official/fetch flows if Phase 2 chooses command recommendations instead of direct execution.
- Output: write a compact manifest in task research artifacts and optionally include a pointer from `get_context.py` retrieval guidance.

## Failure Behavior

- Missing CLI or failed `doctor`: record `status=not_configured` or `failed` with masked diagnostic summary and recovery command. Do not fall back to native web search.
- Network timeout: preserve structured result JSON when available; record retry guidance from the Smart Search contract.
- Degraded research: keep `degraded=true` and `gap_check`; downstream ranking can still surface it with lower confidence.

## Compatibility

- No dependency on Python imports from `smartsearch-private`.
- No committed credentials or raw config.
- Existing `smart-search-cli` skill remains the detailed operator guide; Trellis only owns task evidence capture and context handoff.
