# Handoff — CLI pack Smart Search exclusions

## Summary

`@blxzer/trellis` npm pack no longer recursively includes everything under `vendor/smart-search/`. Packaging mirrors the vendor sync allowlist via explicit `package.json` `files` entries and guard scripts.

## Changed files

| Path | Change |
| --- | --- |
| `packages/cli/package.json` | `files`: 36 explicit vendor paths + static entries; `check:pack-files` / `sync:pack-files` scripts |
| `packages/cli/scripts/smart-search-vendor-utils.js` | `npmPackVendorFileEntries`, `expectedCliPackageFiles`, `compareCliPackageFiles` |
| `packages/cli/scripts/check-cli-pack-files.js` | Drift guard for pack allowlist |
| `packages/cli/scripts/sync-cli-pack-files.js` | Regenerate `files` from vendor utils |
| `packages/cli/test/runtime/smart-search-vendor.test.ts` | Pack dry-run regression + updated `files` expectations |
| `.trellis/scripts/common/tasks.py` | Restored missing helpers so `task.py` runs (prerequisite for Trellis workflow) |

## Behavior

- **Before:** `files` contained `vendor/smart-search` → npm packed local venv (`.smart-search-python`), `build/`, `__pycache__`, `.pyc`, `.egg-info`.
- **After:** Only listed source files ship; postinstall still installs Python runtime from vendored `pyproject.toml` + `npm/scripts/postinstall.js` on consumer install.

## Maintainer workflow

After `pnpm run sync:smart-search`, run `pnpm run sync:pack-files` then `pnpm run check:pack-files` in `packages/cli`.

## Residual risks

- New Smart Search vendor files require `sync:pack-files` or `check:pack-files` will fail (intentional).
- Local `vendor/smart-search` may still contain `.smart-search-python` from dev postinstall; that is OK as long as it is not in `files` (verified by test + dry-run).
- `task.py select` / `start-execution --approved` failed in this session (no persisted session identity); task status set manually to `in_progress`.

## Not done

- No npm publish, git tag, push, or version bump.