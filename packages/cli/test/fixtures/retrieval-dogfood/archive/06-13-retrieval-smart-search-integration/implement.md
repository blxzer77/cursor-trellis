# Implementation Plan

## Development Strategy Contract

execution_mode: inline
isolation: git-worktree
verification_profile: standard
retrieval_profile: structure
optional_capabilities:
  - smart-search-cli
quality_gates:
  mode: profile
  profile: standard
  enabled:
    - requirements-review
    - code-review
  disabled: []

## Contract Notes

- `package`: Trellis
- `scope`: Smart Search evidence handoff only
- `parallel_eligibility`: may run in parallel with `06-13-retrieval-session-memory` in a prepared child worktree or separate session
- `dependency`: none for implementation; must publish a handoff contract for `06-13-retrieval-context-ranking`
- `boundary`: call `smart-search` CLI; do not import `smart_search` Python internals
- `safety`: no credential writes, no automatic network execution without explicit workflow/user action
- `quality_bar`:
  - no implementation before `task.py start-execution --check` passes and the user explicitly approves execution;
  - preserve `smartsearch-private` as a separate CLI-backed package;
  - keep live network and credential-bearing checks optional and explicitly approved;
  - keep evidence manifests compact and secret-free;
  - keep dogfood and template script copies synchronized if scripts are added.

## Candidate Files

- `Trellis/.trellis/scripts/` for local Trellis runtime scripts.
- `Trellis/.trellis/scripts/common/` for reusable manifest parsing helpers.
- `Trellis/packages/cli/src/templates/trellis/scripts/` for scaffolded copies.
- `Trellis/packages/cli/src/templates/trellis/index.ts` if a new script is added to templates.
- `Trellis/packages/cli/test/scripts/` for integration tests.
- `Trellis/packages/cli/test/templates/trellis.test.ts` for template registration checks.

## Steps

1. Inspect current Trellis script/template registration patterns from Phase 1 artifact search.
2. Decide wrapper mode:
   - Recommended: add a script that executes Smart Search only when the user explicitly runs it.
   - Alternate: add context guidance only, with no execution wrapper.
3. Define Smart Search manifest schema and result normalization.
4. Implement CLI preflight handling for missing executable, failed `doctor`, and successful availability.
5. Implement evidence output path selection under the active task `research/smart-search/`.
6. Add template copies and registration.
7. Add focused tests with mocked subprocess results; do not require live API keys.
8. Write child `verify.md` and `handoff.md` with the contract consumed by context ranking.

## Validation

```powershell
pnpm --filter @mindfoldhq/trellis exec vitest run test/scripts/<smart-search-test>.test.ts
pnpm --filter @mindfoldhq/trellis exec vitest run test/templates/trellis.test.ts
pnpm --filter @mindfoldhq/trellis typecheck
python .\.trellis\scripts\task.py validate .trellis\tasks\06-13-retrieval-smart-search-integration
python .\.trellis\scripts\task.py archive .trellis\tasks\06-13-retrieval-smart-search-integration --check
```

Live `smart-search doctor` or `smart-search research` smoke checks are optional and require explicit approval because they may use local credentials and network.

## Handoff Contract

The child must produce a documented manifest contract with:

- `source`
- `query`
- `intent`
- `command`
- `outputPath`
- `evidenceDir`
- `status`
- `createdAt`
- `summary`
- `citations`
- `gapCheck`
- `providerAttempts`
- `degraded`
