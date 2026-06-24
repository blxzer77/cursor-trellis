# Commands And Configurators

## Command Pattern

CLI commands live under `packages/cli/src/commands/`. The local pattern is:

- Parse command options at the command boundary.
- Use utilities under `packages/cli/src/utils/` for shared behavior.
- Keep template/platform writes routed through configurators and `writeFile`.
- Use explicit guards for high-impact operations such as homedir init, update overwrite, uninstall, and worktree integration.

`packages/cli/src/commands/init.ts` is the reference for a large command that coordinates detection, prompts, readiness, templates, hashes, and bootstrap task creation.

## Configurator Pattern

Platform configurators live under `packages/cli/src/configurators/`.

Rules:

- Keep platform-specific paths and command references in the configurator layer.
- Put shared placeholder logic in `configurators/shared.ts`.
- Add or update tests under `packages/cli/test/configurators/` and `packages/cli/test/templates/`.
- Do not special-case one platform inside unrelated platform code.

## User Interaction

- Non-interactive mode must not hang waiting for prompts.
- User-modified managed files need force/skip/create-new behavior, not silent overwrite.
- Errors should name the file or capability that blocks progress.

## Evidence

Reference files:

- `packages/cli/src/commands/init.ts`
- `packages/cli/src/commands/update.ts`
- `packages/cli/src/configurators/index.ts`
- `packages/cli/src/configurators/shared.ts`
- `packages/cli/test/commands/init.integration.test.ts`

