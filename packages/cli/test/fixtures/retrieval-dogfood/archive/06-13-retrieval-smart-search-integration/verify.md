# Verify

## Summary

Implemented a Trellis-owned Smart Search evidence handoff layer.

Validation Evidence: focused Smart Search evidence wrapper tests, context-loading tests, template tests, Python compile, typecheck, ESLint, dogfood/template sync checks, and secret keyword scan all passed.
Final acceptance evidence: this child is ready for parent review using `verify.md`, `handoff.md`, and ref `working-tree-diff`.
Durable Learning: no additional `.trellis/spec/` update is needed; existing Trellis template-generation and capability/readiness specs already cover this pattern.

## Changed Areas

- Added generated runtime scripts:
  - `Trellis/.trellis/scripts/common/smart_search_evidence.py`
  - `Trellis/.trellis/scripts/run_smart_search.py`
  - `Trellis/packages/cli/src/templates/trellis/scripts/common/smart_search_evidence.py`
  - `Trellis/packages/cli/src/templates/trellis/scripts/run_smart_search.py`
- Registered new scripts in `Trellis/packages/cli/src/templates/trellis/index.ts`.
- Added Smart Search evidence guidance to `session_context.py` text and JSON retrieval guide.
- Added integration coverage for:
  - mocked Smart Search execution and manifest writing;
  - missing `smart-search` behavior;
  - context-loading guide output;
  - template script registration.

## Validation

Run from `Trellis/`:

```powershell
pnpm --filter @blxzer/trellis exec vitest run test/scripts/smart-search-evidence.integration.test.ts
```

Result: PASS, 2 tests.

```powershell
pnpm --filter @blxzer/trellis exec vitest run test/scripts/context-loading.integration.test.ts test/templates/trellis.test.ts test/scripts/smart-search-evidence.integration.test.ts
```

Result: PASS, 3 files, 25 tests.

```powershell
pnpm --filter @blxzer/trellis typecheck
```

Result: PASS.

```powershell
pnpm --filter @blxzer/trellis exec eslint test/scripts/smart-search-evidence.integration.test.ts test/scripts/context-loading.integration.test.ts test/templates/trellis.test.ts src/templates/trellis/index.ts
```

Result: PASS.

```powershell
python -m py_compile .trellis\scripts\common\smart_search_evidence.py .trellis\scripts\run_smart_search.py packages\cli\src\templates\trellis\scripts\common\smart_search_evidence.py packages\cli\src\templates\trellis\scripts\run_smart_search.py
```

Result: PASS.

Additional checks:

- Dogfood and template `smart_search_evidence.py` files match by `git diff --no-index`.
- Dogfood and template `run_smart_search.py` files match by `git diff --no-index`.
- Secret keyword scan over new Smart Search evidence code and tests found no `API_KEY`, `SECRET`, `TOKEN`, `OPENAI_COMPATIBLE_API_KEY`, `config_file`, or `config_sources` matches.

## Acceptance Criteria

- [x] Planning identifies the Trellis command/script or workflow surface that owns Smart Search evidence capture.
- [x] Evidence output includes source, query, timestamp/run identity, and artifact location/reference.
- [x] Behavior degrades cleanly when Smart Search is unavailable.
- [x] Tests cover the evidence handoff path.
- [x] Child handoff documents the contract consumed by `retrieval-context-ranking`.
- [x] No API key, raw config secret, or credential-bearing environment value is written to Trellis artifacts.

## Compatibility

- `smartsearch-private` remains a separate CLI-backed package.
- Trellis invokes `smart-search` only when the user/agent explicitly runs `run_smart_search.py`; context loading only prints guidance.
- JSON context changes are additive through `retrievalGuide.smartSearchEvidence`.
- The wrapper uses mocked Smart Search in tests; no live credentials or network were used.

## Durable Learning Decision

No new global spec update is needed. Existing template-generation and capability/readiness specs already cover the relevant rules: generated scripts must be registered, dogfood/template copies must stay synchronized, and external credential-bearing checks remain explicit.
