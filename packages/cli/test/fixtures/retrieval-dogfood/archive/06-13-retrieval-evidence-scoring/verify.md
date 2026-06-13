# Verification: Retrieval Evidence Scoring

## Status

Implementation verified locally. Ready for parent review. No parent integration performed.

Validation Evidence: focused scoring/template tests, typecheck, focused ESLint, Python compile, dogfood/template sync check, related retrieval regression tests, and parent code review passed.
Final acceptance evidence: parent review accepted this child using `verify.md`, `handoff.md`, and ref `working-tree-diff`; parent `task-map.md` marks the child integrated.
Durable Learning: no `.trellis/spec/` update is needed; existing Trellis Python template runtime, template generation, and validation specs already cover this pattern.

Review watchpoint: `status: missing` items are availability or omission signals even when their score is high. Downstream pack builder and eval harness must filter by `status` / `validationState` before treating an item as body evidence.

## Scope Delivered

- Added pure scoring module `common/retrieval_evidence.py` (dogfood + template).
- Registered template export in `packages/cli/src/templates/trellis/index.ts`.
- Added focused integration tests in `packages/cli/test/scripts/retrieval-evidence.integration.test.ts`.
- Updated template registration tests in `packages/cli/test/templates/trellis.test.ts`.

## Validation Commands

```powershell
cd D:\MyHarness\Trellis
pnpm --filter @mindfoldhq/trellis exec vitest run test/scripts/retrieval-evidence.integration.test.ts
pnpm --filter @mindfoldhq/trellis exec vitest run test/templates/trellis.test.ts
pnpm --filter @mindfoldhq/trellis typecheck
pnpm --filter @mindfoldhq/trellis exec eslint test/scripts/retrieval-evidence.integration.test.ts test/templates/trellis.test.ts src/templates/trellis/index.ts
python -m py_compile .trellis\scripts\common\retrieval_evidence.py packages\cli\src\templates\trellis\scripts\common\retrieval_evidence.py
```

## Results

| Command | Result |
| --- | --- |
| `vitest run test/scripts/retrieval-evidence.integration.test.ts` | pass |
| `vitest run test/templates/trellis.test.ts` | pass |
| `pnpm typecheck` | pass |
| `eslint` (focused files) | pass |
| `py_compile` (dogfood + template) | pass |

## Behavioral Checks

- Mixed-source bundle scores task artifacts, artifact search, session memory, Smart Search manifest, and codebase candidate evidence.
- Failed / `not_configured` / `degraded` Smart Search manifests are scored as availability or lower-confidence evidence, not positive proof.
- Session memory is scored as historical context with `validationState: unverified`.
- Codebase evidence remains `validationState: candidate`.
- Empty bundle returns `{ version: 1, total: 0, items: [] }`.
- Repeated scoring with the same bundle preserves ordering and scores.

## Side-Effect Boundary

Scoring is pure-function only:

- Does not call `run_smart_search.py`.
- Does not call `search_memory.py`.
- Does not call `search_artifacts.py`.
- Does not invoke network, MCP, or codebase search tools.

## Out Of Scope (Confirmed)

- Context pack builder.
- Eval harness.
- Auto-running scoring from `get_context.py`.
- Parent integration.
