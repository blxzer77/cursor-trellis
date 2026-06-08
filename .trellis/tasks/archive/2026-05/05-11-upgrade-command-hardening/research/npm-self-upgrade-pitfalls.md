# Research: npm-backed CLI self-upgrade pitfalls

## Sources

- npm global permissions: https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally/
- npm global folders and prefix behavior: https://docs.npmjs.com/cli/v11/configuring-npm/folders/
- npm dist-tags: https://docs.npmjs.com/cli/v8/commands/npm-dist-tag/
- Node child_process Windows `.bat` / `.cmd` behavior: https://nodejs.org/api/child_process.html
- cross-spawn Windows spawn pitfalls: https://www.npmjs.com/package/cross-spawn

## Findings

### Windows npm command shims

Node's process spawning behavior treats Windows `.bat` and `.cmd` files differently from native executables. A direct `spawnSync("npm.cmd", ...)` path can work in some environments but is less robust than routing through `cmd.exe` or using a dedicated cross-platform spawn shim.

For Trellis, using `cmd.exe /d /s /c npm install -g ...` on Windows is the smallest fix because it avoids adding a dependency and keeps POSIX execution shell-free.

### Permission and prefix failures

Global npm installs commonly fail when the npm prefix points to a protected system directory or when the user mixes Node installations. Trellis should not try to recover by running `sudo`, changing prefix, or forcing overwrite. The command should surface the npm failure and show the checks users need:

- `npm config get prefix`
- `trellis --version`
- `which trellis` on POSIX
- `where trellis` on Windows

### PATH mismatch after successful install

An npm global install can succeed while the user's shell still resolves a different `trellis` binary first. This happens when multiple Node managers, npm prefixes, or old binaries are on PATH. Success output should explicitly ask users to verify both the version and binary path.

### Dist-tag behavior

npm dist-tags are mutable labels. `latest`, `beta`, and `rc` are package-publisher conventions, not npm-enforced release channels. Trellis can keep channel inference, but failed installs should be treated as npm install failures rather than as Trellis migration problems.

### Bin conflicts and file locks

Existing binaries, antivirus/file locks, or concurrent npm operations can produce EEXIST, EPERM, EBUSY, or generic non-zero exits. Trellis should not default to `--force`; users can decide whether force is appropriate after reading npm's error.
