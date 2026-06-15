# Implementation Plan — CLI pack Smart Search exclusions

## Development Strategy Contract

execution_mode: inline
isolation: main-worktree
verification_profile: standard
retrieval_profile: structure
optional_capabilities: []
quality_gates:
  mode: profile
  profile: standard
  enabled: []
  disabled: []

## Steps

1. Add `npmPackVendorFileEntries` / `compareCliPackageFiles` in `smart-search-vendor-utils.js`.
2. Regenerate/update `package.json` `files` vendor entries (allowlist).
3. Add `scripts/check-cli-pack-files.js` and `sync-cli-pack-files.js`; wire `check:pack-files` / `sync:pack-files`.
4. Extend `test/runtime/smart-search-vendor.test.ts` with `npm pack --dry-run --json` assertions.
5. Run validation commands; record `verify.md` and `handoff.md`.

## Commands

```powershell
cd D:\MyHarness\Trellis
pnpm --filter @blxzer/trellis build
pnpm --filter @blxzer/trellis typecheck
pnpm --filter @blxzer/trellis test test/runtime/smart-search-vendor.test.ts

cd D:\MyHarness\Trellis\packages\cli
npm pack --dry-run
node scripts\check-cli-pack-files.js
node scripts\release-preflight.js verify-packed-cli
```

## Out of scope

Publish, version bump, vendor content sync from smartsearch-private.