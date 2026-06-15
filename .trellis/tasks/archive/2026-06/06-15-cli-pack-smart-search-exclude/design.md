# Design: CLI pack allowlist for vendored Smart Search

## Approach

Replace broad `files` entry `vendor/smart-search` with an **explicit allowlist** of paths derived from the same contract as vendor sync (`smartSearchRootFiles` + `smartSearchRootDirs` walk with exclusions in `smart-search-vendor-utils.js`).

## Rationale

- npm `files` globs on a directory recurse into all on-disk children, including local venvs created by dev postinstall.
- Vendor sync already defines the canonical source file set; packaging should mirror that set, not the working tree directory.

## Implementation

1. Export `npmPackVendorFileEntries(packageRoot)` from `smart-search-vendor-utils.js` → `vendor/smart-search/<relative>`.
2. Update `packages/cli/package.json` `files`: keep `dist`, `bin`, `scripts/postinstall.js`, `README.md`, `LICENSE`; replace `vendor/smart-search` with the allowlist entries.
3. Add `scripts/check-cli-pack-files.js` to fail CI/dev if `package.json` allowlist drifts from vendor utils (run after vendor sync).
4. Extend `test/runtime/smart-search-vendor.test.ts` with `npm pack --dry-run --json` assertions for forbidden paths.

## Risks

- Allowlist must be updated when vendor sync adds new root files/dirs — mitigated by `check-cli-pack-files.js` and test calling the same helper.

## Validation

See `implement.md`.