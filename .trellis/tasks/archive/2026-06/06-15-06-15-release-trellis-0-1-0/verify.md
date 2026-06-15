# Verification — Release Trellis 1.0.0

Status: **published** — `@blxzer/trellis-core@1.0.0` and `@blxzer/trellis@1.0.0` are on npm registry tag `latest` (verified 2026-06-15).

Publish used granular access token via user `~/.npmrc` (Bypass 2FA). Commands: `pnpm publish --access public --no-git-checks` from `packages/core` then `packages/cli` (CLI `prepublishOnly` ran tests + build on first publish).

## Version State

| Package | Current |
| --- | --- |
| `@blxzer/trellis-core` | `1.0.0` |
| `@blxzer/trellis` | `1.0.0` |

The CLI source dependency on `@blxzer/trellis-core` remains `workspace:*` for local development. Published CLI manifest pins `@blxzer/trellis-core` to exact `1.0.0` (confirmed via registry version document and `release-preflight.js verify-npm`).

## Validation Results

| Command | Result |
| --- | --- |
| `pnpm --filter @blxzer/trellis-core build` | PASS |
| `pnpm --filter @blxzer/trellis build` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm --filter @blxzer/trellis-core test` | PASS (`279` tests) |
| `pnpm --filter @blxzer/trellis exec vitest run test/runtime/smart-search-vendor.test.ts` | PASS (`7` tests) |
| `pnpm --filter @blxzer/trellis exec node scripts/check-cli-pack-files.js` | PASS |
| `pnpm --filter @blxzer/trellis exec node scripts/check-release-pack-contents.js` | PASS (`776` CLI files; required runtime assets present; generated Smart Search artifacts absent) |
| `node --check packages/cli/scripts/release-preflight.js` | PASS |
| `node packages/cli/scripts/release-preflight.js check-versions` | PASS (`@blxzer/trellis-core@1.0.0 = @blxzer/trellis@1.0.0`) |
| `node packages/cli/scripts/release-preflight.js verify-packed-cli` | PASS (packed CLI pins `@blxzer/trellis-core` to exact `1.0.0`) |
| `node packages/cli/scripts/release-preflight.js npm-tag` | PASS (`latest`) |
| `node packages/cli/scripts/release-preflight.js publish-plan` | PASS (`publish` for both packages, tag `latest`) |
| `git -c safe.directory=D:/MyHarness/Trellis diff --check` | PASS (line-ending warnings only) |

## Install / Lockfile Evidence

| Command | Result |
| --- | --- |
| `pnpm install --offline --frozen-lockfile --ignore-scripts` | PASS (`Lockfile is up to date`) |
| `pnpm install --offline` | BLOCKED in current shell: repeated no-output timeout; residual pnpm processes were stopped. Earlier preflight in this task completed once and Smart Search postinstall repaired the package-local runtime, but the current final gate uses the frozen lockfile substitute above. |

## Pack Dry-Run Evidence

| Package | Command / Result |
| --- | --- |
| `@blxzer/trellis-core` | `npm pack --dry-run --json` with repo-local npm cache: PASS; `201` files; required `dist/index`, `dist/channel`, `dist/mem`, `dist/task`, and `dist/testing` entries present. |
| `@blxzer/trellis` | `npm pack --dry-run --json` with repo-local npm cache: PASS; `776` files; required bins, CLI dist, Trellis templates/scripts, retrieval router/adapter scripts, README/LICENSE, and Smart Search vendor files present. |

CLI forbidden artifact check: `.smart-search-python`, `vendor/smart-search/build`, `vendor/smart-search/dist`, `__pycache__`, `.egg-info`, `.pyc`, and `.pyo` are absent from release pack checks.

## Registry / Auth / Publish

| Check | Result |
| --- | --- |
| `npm whoami --registry=https://registry.npmjs.org/` | PASS (`blxzer`) |
| `pnpm publish` `@blxzer/trellis-core@1.0.0` | PASS |
| `pnpm publish` `@blxzer/trellis@1.0.0` | PASS (`prepublishOnly` on first publish) |
| `npm view @blxzer/trellis-core@1.0.0 version` | PASS (`1.0.0`) |
| `npm view @blxzer/trellis@1.0.0 version` | PASS (`1.0.0`) |
| `node packages/cli/scripts/release-preflight.js verify-npm --package all` | PASS (both on tag `latest`) |
| `npm install -g @blxzer/trellis@1.0.0` | PASS with `--force` (local `EEXIST` on global `tl` shim without `--force`; registry install succeeds) |

Note: Shortly after CLI publish, package root `GET /@blxzer/trellis` and `npm view` could lag while version-specific metadata and tarball were already available; index caught up before final `verify-npm`.

## Durable Learning Decision

No separate spec update made. The release-specific lesson is captured in this task's `design.md` / `implement.md`: this workspace must use `pnpm pack` / `pnpm publish` for release dependency rewrite, while `npm pack --dry-run --json` remains useful for package-content inspection. Granular npm tokens must enable **Bypass two-factor authentication** for non-interactive publish when account 2FA policy applies.

## Archive evidence

Validation commands: `npm view @blxzer/trellis-core@1.0.0 version` — `1.0.0`; `npm view @blxzer/trellis@1.0.0 version` — `1.0.0`; `node packages/cli/scripts/release-preflight.js verify-npm --package all` — PASS; `npm install -g @blxzer/trellis@1.0.0 --force` — PASS; `trellis --version` — `1.0.0`.

Final acceptance evidence: Both `@blxzer/trellis-core@1.0.0` and `@blxzer/trellis@1.0.0` published to npm tag `latest`; published CLI depends on exact `@blxzer/trellis-core@1.0.0`; global install runs CLI at 1.0.0. Accepted by user: blxzer77 (2026-06-15, publish + archive request).

Durable learning decision: no durable learning for this task scope (release lessons remain in task `design.md` / `implement.md` and verify Registry section above).
