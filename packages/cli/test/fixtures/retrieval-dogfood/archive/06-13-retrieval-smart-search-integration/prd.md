# Integrate Smart Search evidence flow into Trellis retrieval

## Goal

Define and implement Trellis-to-smartsearch-private retrieval boundaries, evidence capture, and task artifact handoff.

## Requirements

- Confirmed evidence from `smart-search-cli`:
  - `smart-search config path --format json` reports `resolved_evidence_dir`.
  - `smart-search doctor --format json` reports masked config, capability status, and `minimum_profile_ok`.
  - `smart-search research ... --format json --output PATH` returns `research_plan`, `evidence_items`, `citations`, `gap_check`, `provider_attempts`, `fallback_used`, `degraded`, `route_policy_version`, and `evidence_dir`.
  - `search`, `fetch`, `exa-search`, `context7-*`, and `map` all support `--format json|markdown|content` and `--output PATH`.
- Define when Trellis should recommend or invoke `smartsearch-private` instead of local artifact, memory, or codebase retrieval.
- Preserve `smartsearch-private` as a separate service/package while making Trellis evidence capture explicit and repeatable.
- Store or reference search evidence in task artifacts so later agents can cite what was fetched and why.
- Expose a stable handoff shape for downstream context ranking without requiring ranking code to know Smart Search internals.
- Keep network, credentials, and service startup under explicit user/workflow control.
- Prefer invoking the existing `smart-search` CLI rather than importing Python internals from `smartsearch-private`.

## Acceptance Criteria

- [ ] Planning identifies the Trellis command/script or workflow surface that owns Smart Search evidence capture.
- [ ] Evidence output includes source, query, timestamp or run identity, and artifact location/reference.
- [ ] Behavior degrades cleanly when Smart Search is unavailable.
- [ ] Tests or smoke checks cover the evidence handoff path.
- [ ] Child handoff documents the contract consumed by `retrieval-context-ranking`.
- [ ] No API key, raw config secret, or credential-bearing environment value is written to Trellis artifacts.

## Notes

- This child may run in parallel with `06-13-retrieval-session-memory`.
- It must not modify session memory ranking policy except through an agreed public evidence contract.
- Open product decision: whether Phase 2 should only generate recommended `smart-search` commands, or also add a Trellis wrapper command that executes them. Recommended default is wrapper command with explicit user/network execution.
