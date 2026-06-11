# Implementation Plan

## Development Strategy Contract

execution_mode: inline
isolation: main-worktree
verification_profile: architecture
retrieval_profile: semantic
optional_capabilities:
  - fast-context-mcp
  - codegraph
quality_gates:
  mode: profile
  profile: architecture

## Checklist

1. Research and document existing fast-context and CodeGraph capabilities.
2. Update task requirements and technical design around `codebase-retrieval`.
3. Refactor the project capability model from retrieval tool ids to retrieval roles.
4. Add compatibility aliases/migrations for old selected ids.
5. Remove Graphify from the primary retrieval stack and generated retrieval guidance.
6. Add adapter metadata for exact search, CodeGraph AST, LSP, and semantic recall.
7. Update readiness logic to distinguish required exact search from optional adapters.
8. Update generated `.trellis/capabilities.json` and `.trellis/capabilities.md` output.
9. Update platform MCP config generation only where an adapter truly needs MCP configuration.
10. Add or update tests for capability parsing, generated files, readiness text, and update behavior.
11. Run focused tests for project capabilities/configurators.
12. Run build/typecheck or document blockers.
13. Record `verify.md` with validation evidence and remaining benchmark implications.

## Review Gates

- Requirements review before `start-execution --approved`.
- Architecture review before implementation if the capability state schema changes.
- Code review after implementation.

## Validation Commands

- `pnpm --filter @mindfoldhq/trellis test test/configurators/platforms.test.ts test/configurators/index.test.ts`
- `pnpm --filter @mindfoldhq/trellis test test/commands/init.integration.test.ts`
- `pnpm --filter @mindfoldhq/trellis build`
- `python ./.trellis/scripts/task.py validate 06-11-semantic-retrieval-stack-design-fixes`

## Rollback

- Revert capability registry and generated capability output changes.
- Keep research artifacts even if implementation direction changes.

