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

## Contract Notes

- `package`: Trellis
- `scope`: parent orchestration and review for Phase 3 retrieval quality/context packing
- `topology`: parallel-staged
- `parallel_stage_1`: `06-13-retrieval-evidence-scoring`
- `parallel_stage_2`: `06-13-retrieval-context-pack-builder` and `06-13-retrieval-eval-harness` after scoring contract acceptance
- `review_owner`: current Codex/main session receives child results and performs parent integration review
- `implementation_owner`: external agents assigned by the user
- `safety`: do not start execution or implement from this planning session

## Child Execution Order

1. Execute `retrieval-evidence-scoring`.
2. Parent reviewer reviews its `handoff.md` and score contract.
3. If accepted, `retrieval-context-pack-builder` and `retrieval-eval-harness` can run in parallel.
4. Parent reviewer reviews pack-builder handoff.
5. Eval harness final acceptance confirms scoring + packing behavior together.
6. Parent reviewer completes final integration evidence and archives Phase 3.

## Parent Reviewer Checklist

- Confirm each child stayed inside its boundary.
- Confirm changed files match the child scope.
- Confirm validation commands are relevant and actually passed.
- Check dogfood/template sync if generated Trellis scripts changed.
- Check JSON contracts are additive and documented.
- Check no child introduced automatic network, Smart Search, MCP, or codebase search during context loading.
- Mark child states only after reviewing `verify.md`, `handoff.md`, and code diff/ref.

## Validation Plan

Parent-level validation after all children:

```powershell
pnpm --filter @blxzer/trellis exec vitest run test/scripts/context-loading.integration.test.ts
pnpm --filter @blxzer/trellis exec vitest run test/scripts/session-memory.integration.test.ts test/scripts/smart-search-evidence.integration.test.ts
pnpm --filter @blxzer/trellis typecheck
python .\.trellis\scripts\task.py validate .trellis\tasks\06-13-trellis-retrieval-phase-3-evaluation-context-packing
python .\.trellis\scripts\task.py archive .trellis\tasks\06-13-trellis-retrieval-phase-3-evaluation-context-packing --check
```

Child-specific validation is defined in each child `implement.md`.

## Handoff Instructions For External Agents

Each child executor must return:

- summary of changed files;
- validation commands and results;
- `verify.md`;
- `handoff.md`;
- commit/ref or reviewed diff reference;
- explicit note of any unmet acceptance criteria, blockers, or contract changes.

If a child discovers it needs to change its contract, it must stop and return to planning before implementation continues.
