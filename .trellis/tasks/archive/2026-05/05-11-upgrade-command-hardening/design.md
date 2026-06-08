# Design: Harden trellis upgrade command

## Current Shape

`packages/cli/src/commands/upgrade.ts` owns the command behavior:

- resolve target npm tag from current CLI version or `--tag`
- build `npm install -g @mindfoldhq/trellis@<tag>`
- run it with `spawnSync`
- report npm failures

`packages/cli/src/cli/index.ts` only wires Commander options into `upgrade()`.

## Proposed Command Model

Keep a single implementation module with pure helpers and one side-effecting entry point:

```text
upgrade(options, runner)
  -> buildUpgradePlan(options, platform)
  -> print plan
  -> dry-run exits early
  -> runner(plan.command, plan.args, plan.spawnOptions)
  -> normalize failure/success output
```

The important contract is that tests can inspect the generated command plan without running npm.

## Platform Execution

### POSIX

Use direct spawning:

```text
command: npm
args: install -g @mindfoldhq/trellis@<tag>
options: { stdio: "inherit", shell: false }
```

This preserves the current shell-injection boundary.

### Windows

Use `cmd.exe` to run the npm command shim:

```text
command: cmd.exe
args: /d /s /c npm install -g @mindfoldhq/trellis@<tag>
options: { stdio: "inherit", shell: false }
```

This avoids relying on direct `.cmd` launching semantics while still avoiding a hand-built shell command on POSIX. `--tag` remains restricted to simple npm dist-tags or versions, so the Windows command string does not receive untrusted shell syntax.

## Output Contract

### Plan / Dry Run

Print a human-readable command:

```text
Run: npm install -g @mindfoldhq/trellis@beta
```

For Windows, the display command should stay user-facing (`npm ...`), even if the internal process is `cmd.exe /d /s /c ...`.

### Success

Print:

```text
Trellis CLI upgrade completed
Run: trellis --version
Run: which trellis   # POSIX
Run: where trellis   # Windows
```

This addresses the common "install succeeded but shell still finds an older binary" class of bugs.

### Failure

Keep the original exit/signal/error reason, then append a compact troubleshooting block:

```text
Troubleshooting:
- Check npm global prefix and PATH: npm config get prefix
- If this is a permissions error, fix your Node/npm install or prefix; Trellis does not run sudo.
- If another trellis binary is earlier on PATH, check which trellis / where trellis.
- Manual command: npm install -g @mindfoldhq/trellis@beta
```

The command must not add `sudo`, `--force`, or automatic cleanup. Those are user-controlled recovery choices.

## Boundaries

- `trellis upgrade` upgrades the globally installed CLI package only.
- `trellis update` continues to sync project-local `.trellis/` and platform files.
- No schema, manifest, migration, or task artifact changes are needed.

## Compatibility

- Existing users keep the same `trellis upgrade`, `--tag`, and `--dry-run` surface.
- Existing update hints remain `trellis upgrade`.
- The Windows command plan change is internal and should not change user-facing docs beyond any troubleshooting copy.

## References

See `research/npm-self-upgrade-pitfalls.md`.
