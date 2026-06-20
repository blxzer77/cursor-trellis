# Verify — @blxzer/cursor-trellis@0.1.0 rename (2026-06-20)

## Status

**Implementation complete — awaiting commit, tag, and npm publish approval.**

## Package identity

| Package | Version |
|---------|---------|
| `@blxzer/cursor-trellis` | `0.1.0` |
| `@blxzer/cursor-trellis-core` | `0.1.0` |

Repository: https://github.com/blxzer77/cursor-trellis (public, `main`)

## Validation (2026-06-20)

| Check | Result |
|-------|--------|
| `pnpm test` | **PASS** — 1403 passed, 9 skipped |
| `pnpm typecheck` | **PASS** |
| `pnpm lint` | **FAIL** — 10 pre-existing errors in retrieval v2 utils (unused helpers in `codebase-retrieval-router.ts`, style in telemetry/ranking); not introduced by rename |
| `check-manifest-continuity.js` | **PASS** — 1 local manifest, 0 npm versions |
| `release-preflight.js check-versions` | **PASS** |
| `release-preflight.js verify-packed-cli` | **PASS** — pins `@blxzer/cursor-trellis-core@0.1.0` |
| `check_router_copy_sync.py` | **PASS** (requires built `dist/`) |
| `publish-packages.js --dry-run` | **PASS** (after adding root `README.md` for `copy:release-assets`) |

## Key changes

- Renamed npm packages from `@blxzer/trellis*` → `@blxzer/cursor-trellis*`
- Reset semver to `0.1.0`
- Moved 130 legacy migration manifests → `manifests-legacy/` (not shipped)
- New baseline `manifests/0.1.0.json`
- Added `packages/cli/README.md`, root `README.md` (minimal), refreshed `CHANGELOG.md`
- Tests: `test/helpers/legacy-migrations.ts` for archived manifest regression coverage

## Publish approval

**Not approved.** When ready:

```powershell
cd d:\MyHarness\Trellis\packages\cli
npm whoami
pnpm release:publish
node scripts/release-preflight.js verify-npm --package all
npm install -g @blxzer/cursor-trellis@0.1.0
trellis --version
```

Order: **core first**, then cli (`publish-packages.js`).

## Git (Phase 5 — pending user OK)

```powershell
cd d:\MyHarness\Trellis
git add -A
git commit -m "chore(release): rename to @blxzer/cursor-trellis@0.1.0"
git tag v0.1.0
git push private main --tags
```
