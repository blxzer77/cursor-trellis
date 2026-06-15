# Verify

## Summary

Implemented additive retrieval recommendations in Trellis context loading.

Validation Evidence: focused context-loading tests, combined retrieval regression tests, Python compile, typecheck, changed-file ESLint, whitespace check, task artifact validation, and manual code review passed.
Final acceptance evidence: this child is ready for parent review using `verify.md`, `handoff.md`, and ref `working-tree-diff`.
Durable Learning: no `.trellis/spec/` update is needed; existing Trellis Python template runtime, template generation, and validation specs already cover this pattern.

## Changed Areas

- Updated:
  - `Trellis/.trellis/scripts/common/session_context.py`
  - `Trellis/packages/cli/src/templates/trellis/scripts/common/session_context.py`
  - `Trellis/packages/cli/test/scripts/context-loading.integration.test.ts`
- Added deterministic `retrievalGuide.recommendations` JSON output.
- Added text `Retrieval recommendations:` output only when a selected task exists.
- Kept retrieval guide commands side-effect free; context loading still does not invoke Smart Search, session memory, artifact search, or codebase search automatically.

## Validation

Run from `Trellis/`:

```powershell
pnpm --filter @blxzer/trellis exec vitest run test/scripts/context-loading.integration.test.ts
```

Result: PASS, 1 file, 4 tests.

```powershell
pnpm --filter @blxzer/trellis exec vitest run test/scripts/context-loading.integration.test.ts test/templates/trellis.test.ts test/scripts/session-memory.integration.test.ts test/scripts/smart-search-evidence.integration.test.ts
```

Result: PASS, 4 files, 30 tests.

```powershell
pnpm --filter @blxzer/trellis typecheck
```

Result: PASS.

```powershell
pnpm --filter @blxzer/trellis exec eslint test/scripts/context-loading.integration.test.ts src/templates/trellis/index.ts
```

Result: PASS.

```powershell
python -m py_compile .trellis\scripts\common\session_context.py packages\cli\src\templates\trellis\scripts\common\session_context.py
```

Result: PASS.

```powershell
git -c safe.directory=D:/MyHarness/Trellis diff --check
```

Result: PASS.

```powershell
python .\.trellis\scripts\task.py validate .trellis\tasks\06-13-retrieval-context-ranking
```

Result: PASS.

Additional checks:

- Dogfood/template `session_context.py` diff reviewed; only existing platform defaults differ (`python` vs `python3`).
- Codegraph review confirmed recommendation generation stays inside `session_context.py` and does not call retrieval scripts.

## Acceptance Criteria

- [x] Implementation starts only after upstream Smart Search and session memory handoff contracts are reviewed or the parent contract is explicitly updated.
- [x] Ranked recommendations include source type, reason, confidence or priority, and a concrete next action/reference.
- [x] JSON output remains backward compatible with additive ranking fields.
- [x] Tests cover ranking with multiple sources, missing sources, and no relevant matches.
- [x] Parent final verification confirms ranking connects the Phase 2 retrieval sources coherently.
- [x] Context loading remains read-only and does not invoke network, Smart Search, or codebase search commands automatically.

## Compatibility

- Existing `retrievalGuide.artifactSearch`, `sessionMemory`, `smartSearchEvidence`, `codebaseEvidence`, `evidenceSinks`, and `selectedTaskArtifacts` fields remain unchanged.
- New JSON field: `retrievalGuide.recommendations`.
- No changes were made to task records, journal writes, Smart Search manifests, or artifact/session search result contracts.

## Durable Learning Decision

No new spec update is needed. This reinforces existing guidance: generated runtime-template changes must stay additive, dogfood/template copies must remain synchronized, and focused Vitest plus Python compile are the correct verification shape.
