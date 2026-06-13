# Implementation Plan

## Development Strategy Contract

execution_mode: child-task
isolation: git-worktree
verification_profile: standard
retrieval_profile: structure
optional_capabilities: []
quality_gates:
  mode: profile
  profile: standard
  enabled:
    - requirements-review
    - code-review
  disabled: []

## Steps

1. Read `retrieval-evidence-scoring/handoff.md`.
2. Implement pack builder as pure generated-runtime module.
3. Define pack budget and item estimate helpers.
4. Implement deterministic selected/omitted partitioning.
5. Add optional explicit CLI wrapper only if useful and tested.
6. Add focused tests for:
   - mixed scored sources;
   - budget trimming;
   - tie-breaking;
   - empty input;
   - failed/unavailable evidence handling.
7. Update template registration/tests if new generated files are added.
8. Write `verify.md` and `handoff.md`.

## Candidate Files

- `Trellis/.trellis/scripts/common/context_pack.py`
- `Trellis/.trellis/scripts/build_context_pack.py`
- `Trellis/packages/cli/src/templates/trellis/scripts/common/context_pack.py`
- `Trellis/packages/cli/src/templates/trellis/scripts/build_context_pack.py`
- `Trellis/packages/cli/src/templates/trellis/index.ts`
- `Trellis/packages/cli/test/scripts/context-pack.integration.test.ts`
- `Trellis/packages/cli/test/templates/trellis.test.ts`

## Validation

```powershell
pnpm --filter @mindfoldhq/trellis exec vitest run test/scripts/context-pack.integration.test.ts
pnpm --filter @mindfoldhq/trellis exec vitest run test/templates/trellis.test.ts
pnpm --filter @mindfoldhq/trellis typecheck
pnpm --filter @mindfoldhq/trellis exec eslint test/scripts/context-pack.integration.test.ts test/templates/trellis.test.ts src/templates/trellis/index.ts
python -m py_compile .trellis\scripts\common\context_pack.py packages\cli\src\templates\trellis\scripts\common\context_pack.py
```

Adjust commands if implementation updates different focused test files.

## Required Handoff

`handoff.md` must document:

- context pack JSON contract;
- budget semantics;
- selected/omitted sorting and tie-break rules;
- expected consumer behavior for eval harness;
- side-effect boundary.
