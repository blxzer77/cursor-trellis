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

1. Inspect Phase 2 handoffs:
   - Smart Search evidence manifest contract.
   - Session Memory result contract.
   - Retrieval recommendation contract.
2. Add or update a generated-runtime scoring module with pure functions.
3. Define scored evidence dataclass/dict conversion and stable JSON fields.
4. Implement source-specific normalization:
   - recommendations;
   - Smart Search manifests;
   - session memory results;
   - artifact search results;
   - codebase candidate evidence.
5. Add deterministic sorting by score, source, reference.
6. Add focused tests for normal, degraded, missing, and no-source cases.
7. Update template registration/tests if a new generated script is added.
8. Write `verify.md` and `handoff.md`.

## Candidate Files

- `Trellis/.trellis/scripts/common/retrieval_evidence.py`
- `Trellis/packages/cli/src/templates/trellis/scripts/common/retrieval_evidence.py`
- `Trellis/packages/cli/src/templates/trellis/index.ts`
- `Trellis/packages/cli/test/scripts/retrieval-evidence.integration.test.ts`
- `Trellis/packages/cli/test/templates/trellis.test.ts`

## Validation

```powershell
pnpm --filter @blxzer/trellis exec vitest run test/scripts/retrieval-evidence.integration.test.ts
pnpm --filter @blxzer/trellis exec vitest run test/templates/trellis.test.ts
pnpm --filter @blxzer/trellis typecheck
pnpm --filter @blxzer/trellis exec eslint test/scripts/retrieval-evidence.integration.test.ts test/templates/trellis.test.ts src/templates/trellis/index.ts
python -m py_compile .trellis\scripts\common\retrieval_evidence.py packages\cli\src\templates\trellis\scripts\common\retrieval_evidence.py
```

Adjust commands if implementation updates different focused test files.

## Required Handoff

`handoff.md` must document:

- scored evidence JSON contract;
- accepted source/status/validation values;
- sorting rules;
- how pack builder should consume scores;
- side-effect boundary.
