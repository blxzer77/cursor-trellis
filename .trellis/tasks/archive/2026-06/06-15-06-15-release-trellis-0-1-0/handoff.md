# Handoff — Release Trellis 1.0.0

**State:** **completed** — `@blxzer/trellis-core@1.0.0` and `@blxzer/trellis@1.0.0` published to npm tag `latest` (2026-06-15). See `verify.md` for command evidence.

No git tag or remote repo push was part of this task unless separately requested.

## Prepared Release

| Package | Version | Publish tag |
| --- | --- | --- |
| `@blxzer/trellis-core` | `1.0.0` | `latest` |
| `@blxzer/trellis` | `1.0.0` | `latest` |

`node packages/cli/scripts/release-preflight.js publish-plan` reports both packages should publish; registry `npm view` returns `E404` for both `1.0.0` versions.

## Important Release Rule

Use `pnpm publish --access public`, not direct `npm publish` from the source package directories.

Reason: `packages/cli/package.json` intentionally keeps `@blxzer/trellis-core` as `workspace:*` for local development. `pnpm pack` verified that the packed CLI manifest rewrites this to exact `@blxzer/trellis-core@1.0.0`; direct `npm pack` does not rewrite it and is only used for content dry-run checks.

## Validation Summary

- Build: core PASS, CLI PASS
- Typecheck: PASS
- Core tests: PASS (`279`)
- Smart Search vendor tests: PASS (`7`)
- CLI pack allowlist: PASS
- Release pack content: PASS (`776` CLI files, forbidden Smart Search runtime/build/cache artifacts absent)
- Packed CLI dependency: PASS (`@blxzer/trellis-core` exact `1.0.0`)
- Core dry-run pack: PASS (`201` files)
- CLI dry-run pack: PASS (`776` files)
- Registry availability: PASS for publishability (`E404` for both `1.0.0`)
- Auth: FAIL (`npm whoami` -> `E401 Unauthorized`)
- Execution gate: updated `requirements-review` PASS recorded; stale approval was cleared, `start-execution --check` passed, and fresh user approval was recorded with `task.py start-execution --approved`.

Full command evidence is in `verify.md`.

## Resume Steps

1. Authenticate npm on the machine/session that will publish.

```powershell
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
```

2. Re-run the final local gates if the worktree changed.

```powershell
cd D:\MyHarness\Trellis
pnpm --filter @blxzer/trellis-core build
pnpm --filter @blxzer/trellis build
pnpm typecheck
node packages/cli/scripts/release-preflight.js verify-packed-cli
node packages/cli/scripts/release-preflight.js publish-plan
```

3. After explicit user approval, publish core first, then CLI.

```powershell
cd D:\MyHarness\Trellis\packages\core
pnpm publish --access public

cd D:\MyHarness\Trellis\packages\cli
pnpm publish --access public
```

4. Verify registry visibility.

```powershell
npm view @blxzer/trellis-core@1.0.0 version --registry=https://registry.npmjs.org/
npm view @blxzer/trellis@1.0.0 version --registry=https://registry.npmjs.org/
npm view @blxzer/trellis dist-tags --registry=https://registry.npmjs.org/
node packages/cli/scripts/release-preflight.js verify-npm --package all
```

## Known Caveats

- Full `pnpm install --offline` lifecycle currently times out in this shell. The frozen lockfile substitute passes: `pnpm install --offline --frozen-lockfile --ignore-scripts`.
- `npm pack --dry-run --json` may need a repo-local `npm_config_cache` under sandboxed execution because the default user npm cache is not writable.
- The Trellis worktree is heavily dirty from previous framework tasks; review `git -c safe.directory=D:/MyHarness/Trellis status --short` before committing or tagging.
