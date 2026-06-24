# Testing And Validation

## Test Layers

Use the smallest relevant check first:

- Core task/mem/channel types: `pnpm --filter @blaze/trellis-core test`.
- CLI source changes: focused Vitest files under `packages/cli/test/`.
- Template output: `packages/cli/test/templates/*.test.ts` and configurator tests.
- Init/update/uninstall behavior: integration tests under `packages/cli/test/commands/`.
- Type-only changes: `pnpm --filter @blaze/trellis typecheck`.

Broader checks:

```powershell
pnpm typecheck
pnpm test
pnpm build
```

## Local Test Style

- Use temp directories for integration tests.
- Mock external dependencies such as `figlet`, `inquirer`, `child_process`, and network registry probes.
- Assert exact generated files or key contract lines, not vague success.
- Keep regression tests close to the behavior they protect.
- When a template changes, assert both first install and update behavior if migration or hash tracking is involved.

## Known Risk Areas

- User-owned files vs managed manifest files.
- Platform-specific Python command resolution.
- Worktree and non-root Git repository handling.
- Capability config generation for multiple hosts.
- Smart Search vendor runtime cache accidentally entering package contracts.

