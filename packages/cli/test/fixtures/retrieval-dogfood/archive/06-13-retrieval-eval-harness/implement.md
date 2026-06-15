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
2. Create fixture builders for Trellis temp projects and evidence payloads.
3. Add scoring eval cases:
   - multi-source ordering;
   - degraded/failed Smart Search;
   - session memory as historical context;
   - codebase candidate evidence.
4. After pack-builder handoff is available, add pack eval cases:
   - budget trimming;
   - omitted reasons;
   - deterministic ties;
   - empty input.
5. Add no-side-effect assertions around generated evidence directories and manifests.
6. Keep all tests local and credential-free.
7. Write `verify.md` and `handoff.md`.

## Candidate Files

- `Trellis/packages/cli/test/scripts/retrieval-eval.integration.test.ts`
- `Trellis/packages/cli/test/scripts/retrieval-evidence.integration.test.ts`
- `Trellis/packages/cli/test/scripts/context-pack.integration.test.ts`
- Shared test helpers only if duplication becomes meaningful.

## Validation

```powershell
pnpm --filter @blxzer/trellis exec vitest run test/scripts/retrieval-eval.integration.test.ts
pnpm --filter @blxzer/trellis exec vitest run test/scripts/retrieval-evidence.integration.test.ts test/scripts/context-pack.integration.test.ts
pnpm --filter @blxzer/trellis typecheck
pnpm --filter @blxzer/trellis exec eslint test/scripts/retrieval-eval.integration.test.ts
```

Adjust commands if implementation updates different focused test files.

## Required Handoff

`handoff.md` must document:

- fixture coverage matrix;
- no-side-effect guarantees tested;
- which contracts are protected;
- remaining gaps or future eval dimensions.
