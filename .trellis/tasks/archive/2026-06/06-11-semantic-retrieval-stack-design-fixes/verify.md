# Verification

## Summary

Implemented the role-based `codebase-retrieval` capability model for Trellis project capabilities.

Covered changes:

- Replaced separate retrieval tool capability ids with canonical `codebase-retrieval`.
- Kept legacy `fast-context-mcp` and `codegraph` user selections as aliases to `codebase-retrieval`.
- Generated adapter metadata for exact search, AST/CodeGraph, LSP, semantic recall, and verification.
- Generated MCP config for the selected retrieval adapters only: `fast-context` and `codegraph`.
- Removed the legacy architecture graph capability from generated capability docs, MCP config, readiness checks, and tests.
- Changed readiness so `rg` is the required codebase retrieval baseline; CodeGraph, LSP, and fast-context are optional adapter warnings.
- Updated `.trellis/spec/cli/backend/project-capabilities.md` with the durable role-based capability contract.

## Validation Evidence

Validation evidence: PASS - focused ESLint, typecheck, target capability/init/update tests, build, Trellis task validation, generated-output scans, and diff whitespace check passed as listed below.

Passed:

- `pnpm --filter @mindfoldhq/trellis exec eslint src/utils/project-capabilities.ts src/utils/readiness.ts test/utils/project-capabilities.test.ts test/commands/init.integration.test.ts test/commands/update.integration.test.ts`
- `pnpm --filter @mindfoldhq/trellis typecheck`
- `pnpm --filter @mindfoldhq/trellis test test/utils/project-capabilities.test.ts test/commands/init.integration.test.ts test/commands/update.integration.test.ts`
  - 3 files passed
  - 93 tests passed
- `pnpm --filter @mindfoldhq/trellis build`
- `python ./.trellis/scripts/task.py validate 06-11-semantic-retrieval-stack-design-fixes`
- `rg -n "graphify|Graphify" packages/cli/src packages/cli/test packages/cli/dist .trellis/spec/cli/backend/project-capabilities.md`
  - no matches
- `rg -n "codegraph status --json <path>" packages/cli/src packages/cli/test packages/cli/dist .trellis/spec/cli/backend/project-capabilities.md`
  - no matches
- `git -c safe.directory=D:/MyHarness/Trellis-v0.6.0-beta.22 diff --check -- <touched files>`
  - no whitespace errors
  - Git reported LF/CRLF normalization warnings only

Full lint status:

- `pnpm --filter @mindfoldhq/trellis lint` still fails on two pre-existing files outside this task's edit scope:
  - `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js`: unused `taskSource`
  - `packages/cli/test/regression.test.ts`: `Array<T>` style violation

## Acceptance Evidence

Final acceptance: PASS - implementation matches the approved `codebase-retrieval` design, removes the legacy architecture graph capability from generated capability surfaces, and preserves legacy fast-context/CodeGraph selection compatibility through aliases.

- `codebase-retrieval` is now the only code retrieval capability exposed by the registry.
- Generated `.trellis/capabilities.json` uses schema version 2 and records adapter roles.
- Generated `.trellis/capabilities.md` renders the exact -> AST -> LSP -> semantic -> verification workflow.
- `all` selects `codebase-retrieval`, `github-mcp`, and `playwright-mcp`.
- Existing stored `fast-context-mcp` and `codegraph` selections migrate to `codebase-retrieval`.
- Unknown stored legacy selections are ignored during update so known current selections can still regenerate.
- CLI/user input for unknown capability ids is still rejected rather than silently enabling removed behavior.

## Review

Self-review completed against:

- `.trellis/spec/cli/backend/project-capabilities.md`
- `.trellis/spec/cli/backend/quality-guidelines.md`
- `.trellis/spec/cli/unit-test/conventions.md`
- task `prd.md`, `design.md`, and `implement.md`

No implementation defects found after focused tests, typecheck, build, target-file ESLint, and generated-output scans.

## Durable Learning

Durable learning: `.trellis/spec/cli/backend/project-capabilities.md` now records the role-based project capability contract, adapter boundaries, and readiness rules.

Durable learning was recorded by updating `.trellis/spec/cli/backend/project-capabilities.md` with the new role-based capability contract and readiness boundaries.

## Remaining Risks

- This change improves Trellis capability design and generated guidance; it does not implement a full retrieval orchestrator, local vector index, or LSP adapter runtime.
- Full `pnpm lint` remains blocked by unrelated existing lint errors listed above.
- Full `pnpm test` was not run in this pass; the focused capability/init/update suite and build passed.
