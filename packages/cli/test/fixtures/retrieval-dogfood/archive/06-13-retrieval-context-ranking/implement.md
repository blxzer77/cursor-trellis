# Implementation Plan

## Development Strategy Contract

execution_mode: inline
isolation: main-worktree
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
- `scope`: deterministic retrieval recommendations in Trellis context loading
- `dependency`: upstream Smart Search evidence and Session Memory handoff contracts are integrated and archived
- `boundary`: recommend retrieval actions only; do not auto-run Smart Search, session memory, artifact search, or codebase search from context loading
- `safety`: additive JSON/text output; no network, credential, MCP, or manifest writes
- `quality_bar`:
  - no implementation before `task.py start-execution --check` passes and the user explicitly approves execution;
  - preserve existing retrieval guide fields;
  - keep recommendations deterministic and explainable;
  - keep dogfood and template script copies synchronized.

## Candidate Files

- `Trellis/.trellis/scripts/common/session_context.py`
- `Trellis/packages/cli/src/templates/trellis/scripts/common/session_context.py`
- `Trellis/packages/cli/test/scripts/context-loading.integration.test.ts`

## Steps

1. Add helper functions to derive a compact selected-task query from task title, name, package, and description.
2. Add `_get_retrieval_recommendations()` returning sorted recommendation dictionaries.
3. Add `recommendations` to `retrievalGuide` JSON output.
4. Add text output for recommendations when non-empty.
5. Update context-loading integration tests for:
   - multiple ranked recommendation sources;
   - no selected task returning no recommendations;
   - missing selected-task artifacts still producing safe fallback recommendations.
6. Sync dogfood and template copies of `session_context.py`.
7. Write `verify.md` and parent handoff evidence after validation.

## Validation

Run from `Trellis/`:

```powershell
pnpm --filter @blxzer/trellis exec vitest run test/scripts/context-loading.integration.test.ts
pnpm --filter @blxzer/trellis typecheck
pnpm --filter @blxzer/trellis exec eslint test/scripts/context-loading.integration.test.ts
python -m py_compile .trellis\scripts\common\session_context.py packages\cli\src\templates\trellis\scripts\common\session_context.py
git -c safe.directory=D:/MyHarness/Trellis diff --no-index -- .trellis\scripts\common\session_context.py packages\cli\src\templates\trellis\scripts\common\session_context.py
python .\.trellis\scripts\task.py validate .trellis\tasks\06-13-retrieval-context-ranking
python .\.trellis\scripts\task.py archive .trellis\tasks\06-13-retrieval-context-ranking --check
```

## Handoff Contract

The parent final integration should verify:

- `retrievalGuide.recommendations` exists in JSON output.
- Text output displays ranked recommendations when a selected task exists.
- Recommendations connect the upstream sources:
  - artifact search for durable Trellis artifacts;
  - session memory for local historical decisions;
  - Smart Search for explicit external evidence;
  - codebase evidence for candidate source validation.
