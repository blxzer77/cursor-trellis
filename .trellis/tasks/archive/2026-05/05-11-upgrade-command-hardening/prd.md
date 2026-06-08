# Harden trellis upgrade command

## Goal

Make `trellis upgrade` reliable and understandable across common npm global install environments before the next beta release.

## Problem

The first implementation correctly routes Trellis CLI self-upgrade through npm, but online research surfaced common failure modes for npm-backed self-updaters:

- Windows `.cmd` launch behavior differs from POSIX process spawning.
- Global npm installs can fail with permission, prefix, PATH, file lock, or existing-bin conflicts.
- A successful npm install can update a different global prefix than the `trellis` binary currently resolved by the shell.
- npm dist-tags are just mutable labels, so failed or surprising channel installs need clear diagnostics.

## Requirements

- `trellis upgrade` must keep using npm global install as the only upgrade backend.
- Windows execution must use a command shape that can run npm's command shim reliably.
- POSIX execution must not use shell execution for normal npm invocation.
- Invalid `--tag` input must continue to be rejected before spawning npm.
- Failure output must give users actionable next checks without automatically running `sudo`, `--force`, prefix rewrites, or destructive cleanup.
- Success output must tell users how to verify that the shell resolves the upgraded `trellis` binary.
- The implementation must preserve current channel inference:
  - stable CLI versions install `@latest`
  - beta CLI versions install `@beta`
  - RC CLI versions install `@rc`
- Existing hints that point users from stale CLI/project versions to `trellis upgrade` must keep working.

## Out of Scope

- Building a package-manager detector for pnpm, Homebrew, Volta, proto, nvm, or asdf.
- Querying npm dist-tags before install.
- Automatically elevating permissions.
- Automatically forcing bin overwrite or deleting existing files.
- Publishing a release.

## Acceptance Criteria

- [x] Windows command construction is covered by tests and does not rely on directly spawning `npm.cmd` as a plain executable.
- [x] POSIX command construction remains shell-free.
- [x] `--dry-run` prints the same command shape that a real run would execute.
- [x] Failure messages include permission, PATH/prefix, and manual command guidance.
- [x] Success messages include a version check and platform-appropriate binary-resolution check.
- [x] Existing upgrade tests still cover tag inference, explicit tag override, invalid tag rejection, dry-run, success, and non-zero npm exit.
- [x] CLI `lint`, `typecheck`, `test`, and `build` pass.
