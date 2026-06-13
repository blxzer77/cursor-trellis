# Design

## Harness Shape

Prefer Vitest integration tests that materialize temporary Trellis projects using generated templates, matching the existing script integration test style.

Recommended fixture model:

```text
temp project
  .trellis/tasks/<task>/prd.md
  .trellis/tasks/<task>/research/smart-search/<run>/manifest.json
  .trellis/workspace/<developer>/journal-1.md
  scored-evidence fixture payloads
```

The harness should use direct Python runtime scripts/modules where possible and avoid network or credential-bearing operations.

## Eval Dimensions

- Source coverage:
  - artifact search/task artifacts
  - session memory
  - Smart Search manifests
  - codebase candidate evidence
- State coverage:
  - ok
  - degraded
  - failed
  - not_configured
  - empty/missing
- Behavior coverage:
  - score ordering
  - context pack budget trimming
  - omission reasons
  - deterministic tie-breaks
  - no implicit retrieval execution

## Side-Effect Checks

Tests should assert that context loading/eval utilities do not create:

- new Smart Search evidence directories;
- unexpected manifest files;
- network-dependent outputs;
- modified journal files unless the test explicitly seeds them.

## Compatibility

- Reuse existing test helpers and generated template registration patterns.
- Do not rely on a local `smart-search` binary.
- Do not require live API keys.
- Keep test data ASCII and compact.

## Parallel Execution Notes

After evidence scoring handoff is accepted, this child can build fixtures and scoring assertions while pack builder runs. It should leave final pack-builder assertions pending until pack-builder handoff is available.
