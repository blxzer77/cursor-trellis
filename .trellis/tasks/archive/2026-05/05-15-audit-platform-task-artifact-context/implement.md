# Platform Task Artifact Context Implementation Plan

## Checklist

- [x] Update check agent cards for claude, cursor, codebuddy, opencode, droid,
  gemini, and qoder.
- [x] Update Pi implement/check cards to name task artifacts alongside jsonl
  manifests.
- [x] Update Kiro check JSON prompt with the same artifact-review contract.
- [x] Extend regression tests for class-1 markdown agents and Kiro JSON.
- [x] Add regression coverage for Gemini, Qoder, and Pi agent cards.
- [x] Run focused CLI regression tests.

## Verification Results

```bash
pnpm --filter @mindfoldhq/trellis test -- regression.test.ts
pnpm --filter @mindfoldhq/trellis exec vitest run test/regression.test.ts -t "sub-agent context injection fallback"
pnpm --filter @mindfoldhq/trellis typecheck
git diff --check
```

## Check Review

Trellis channel check agent `check-artifact-context` returned `[VERDICT] ship`.
It strengthened `regression.test.ts` by centralizing the artifact contract
assertion and checking optional semantics:

- `prd.md` must not be marked optional.
- `design.md` must be marked `if present` or `if exists`.
- `implement.md` must be marked `if present` or `if exists`.

## Spec Update

No code-spec edit is needed for this task. The existing workflow and
`platform-integration.md` spec already define the contract: lightweight tasks
may be PRD-only, complex tasks require `design.md` / `implement.md`, and
consumers load `design.md` / `implement.md` only if present. This change brings
agent cards and regression tests back into that existing contract.

## Validation Commands

```bash
pnpm --filter @mindfoldhq/trellis test -- regression.test.ts
```

If the focused command is unsupported, run the closest package-level test command
listed in `packages/cli/package.json`.
