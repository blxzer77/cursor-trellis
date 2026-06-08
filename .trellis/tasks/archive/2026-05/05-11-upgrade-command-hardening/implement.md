# Implement: Harden trellis upgrade command

## Checklist

- [x] Read `.trellis/spec/cli/backend/index.md`.
- [x] Read `.trellis/spec/cli/backend/commands-upgrade.md`.
- [x] Read `research/npm-self-upgrade-pitfalls.md`.
- [x] Update `packages/cli/src/commands/upgrade.ts`.
  - [x] Replace `npmBinary()` with a command plan helper that returns command, args, display command, and platform verification command.
  - [x] Keep POSIX npm execution shell-free.
  - [x] Use `cmd.exe /d /s /c npm ...` on Windows.
  - [x] Add failure troubleshooting text without running recovery commands.
  - [x] Add platform-appropriate success verification output.
- [x] Update `packages/cli/test/commands/upgrade.test.ts`.
  - [x] Cover POSIX command plan.
  - [x] Cover Windows command plan.
  - [x] Cover dry-run display output if practical.
  - [x] Cover non-zero exit message includes troubleshooting guidance.
- [x] Update `.trellis/spec/cli/backend/commands-upgrade.md` if the command-plan contract changes.
- [x] Decide beta docs do not need changes because command usage is unchanged.

## Validation Commands

```bash
pnpm --dir packages/cli exec vitest run test/commands/upgrade.test.ts
pnpm --dir packages/cli test
pnpm --dir packages/cli typecheck
pnpm --dir packages/cli lint
pnpm --dir packages/cli build
```

If docs change:

```bash
pnpm --dir docs-site lint
```

## Review Gates

- Do not run a real global `npm install -g` until the containing release has been published to npm.
- Do not add privilege escalation, `--force`, or package-manager auto-detection during this task.
- Do not start implementation before artifact review.

## Rollback

Revert the changes in `packages/cli/src/commands/upgrade.ts`, its tests, and any docs/spec edits. The previously shipped `trellis upgrade` command remains a simple npm global install wrapper.
