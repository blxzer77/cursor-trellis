# Implementation Plan

## Development Strategy Contract

execution_mode: inline
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
- `scope`: local Trellis session memory retrieval only
- `parallel_eligibility`: may run in parallel with `06-13-retrieval-smart-search-integration` in a prepared child worktree or separate session
- `dependency`: none for implementation; must publish a handoff contract for `06-13-retrieval-context-ranking`
- `boundary`: parse `.trellis/workspace/` journals and indexes; do not call Smart Search
- `safety`: read-only retrieval over workspace memory, no changes to journal write behavior unless explicitly justified in planning
- `quality_bar`:
  - no implementation before `task.py start-execution --check` passes and the user explicitly approves execution;
  - preserve `add_session.py` journal write and rotation behavior;
  - add no network, credential, MCP, or Smart Search requirement;
  - keep parser tolerant of older journal entries;
  - keep dogfood and template script copies synchronized if scripts are added.

## Candidate Files

- `Trellis/.trellis/scripts/common/session_memory.py` for parser/search helper.
- `Trellis/.trellis/scripts/search_memory.py` for user/agent-facing command.
- `Trellis/packages/cli/src/templates/trellis/scripts/common/session_memory.py` for scaffolded copy.
- `Trellis/packages/cli/src/templates/trellis/scripts/search_memory.py` for scaffolded copy.
- `Trellis/packages/cli/src/templates/trellis/index.ts` for template registration.
- `Trellis/packages/cli/test/scripts/` for parser/search integration tests.
- `Trellis/packages/cli/test/templates/trellis.test.ts` for template registration checks.

## Steps

1. Inspect workspace journal examples and existing `add_session.py` output assumptions.
2. Implement a parser that yields session memory entries from journals.
3. Implement query scoring with matched fields and reasons.
4. Add a script interface:
   - `--query`
   - `--developer`
   - `--limit`
   - `--json`
   - optional filters for task/package/branch/date.
5. Ensure no-match output is explicit and parseable.
6. Add template copies and registration.
7. Add tests for parsing, ranking, missing workspace, old journal entries, and JSON output.
8. Write child `verify.md` and `handoff.md` with the contract consumed by context ranking.

## Validation

```powershell
pnpm --filter @blxzer/trellis exec vitest run test/scripts/<session-memory-test>.test.ts
pnpm --filter @blxzer/trellis exec vitest run test/templates/trellis.test.ts
pnpm --filter @blxzer/trellis typecheck
python .\.trellis\scripts\task.py validate .trellis\tasks\06-13-retrieval-session-memory
python .\.trellis\scripts\task.py archive .trellis\tasks\06-13-retrieval-session-memory --check
```

## Handoff Contract

The child must produce a documented result contract with:

- `source`
- `developer`
- `title`
- `date`
- `task`
- `package`
- `branch`
- `commits`
- `summary`
- `matchedSections`
- `path`
- `line`
- `score`
- `reason`
