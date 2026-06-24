# Template Generation

## Template Ownership

Generated platform and workflow files live under `packages/cli/src/templates/` and are copied to `dist/templates/` during build.

Important source areas:

- `packages/cli/src/configurators/` writes platform-specific files.
- `packages/cli/src/configurators/shared.ts` resolves Python command and platform placeholders.
- `packages/cli/src/utils/template-hash.ts` tracks managed-file hashes.
- `packages/cli/src/utils/manifest-prune.ts` and uninstall scrubbers protect user-owned files.
- `packages/cli/src/templates/trellis/scripts/` is the generated Python runtime.

## Rules

- Treat templates as user-facing runtime artifacts. Update tests when output changes.
- Do not edit `dist/` as source; run build when a task needs distributable output refreshed.
- Preserve `{{PYTHON_CMD}}`, `{{CMD_REF:*}}`, and conditional placeholder semantics.
- Use neutral placeholder resolution for shared `.agents/skills/` files to avoid last-writer-wins collisions across platforms.
- Never let update/uninstall delete user-created files that are outside managed manifest scope.

## Tests

Good targeted tests:

- `packages/cli/test/templates/*.test.ts`
- `packages/cli/test/configurators/*.test.ts`
- `packages/cli/test/utils/template-hash.test.ts`
- `packages/cli/test/commands/update.integration.test.ts`
- `packages/cli/test/commands/uninstall.integration.test.ts`

## Evidence

Reference files:

- `packages/cli/src/configurators/shared.ts`
- `packages/cli/src/configurators/index.ts`
- `packages/cli/src/utils/template-hash.ts`
- `packages/cli/src/templates/trellis/workflow.md`

