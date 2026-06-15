# Verification

Validation evidence: build, typecheck, focused Vitest, npm pack dry-run, pack-files guard, and verify-packed-cli are recorded below.
Final acceptance: acceptance criteria from prd.md (no runtime artifacts in pack; postinstall source retained; preflight passes).
Durable learning: no durable learning — packaging allowlist is enforced by `check:pack-files` and tests; no spec update required for this one-off cleanup.

## Validation results

| Command | Result |
| --- | --- |
| `pnpm --filter @blxzer/trellis build` | PASS |
| `pnpm --filter @blxzer/trellis typecheck` | PASS |
| `pnpm --filter @blxzer/trellis test test/runtime/smart-search-vendor.test.ts` | PASS (7 tests) |
| `npm pack --dry-run` (filtered: `.smart-search-python`, `egg-info`, `__pycache__`, `.pyc`, `vendor/smart-search/build`) | 0 matches |
| `node scripts/check-cli-pack-files.js` | PASS |
| `node scripts/release-preflight.js verify-packed-cli` | PASS |

## Acceptance

- `package.json` `files` uses explicit `vendor/smart-search/...` allowlist (41 entries), not broad `vendor/smart-search`.
- Packed tarball still includes `vendor/smart-search/pyproject.toml` and `vendor/smart-search/npm/scripts/postinstall.js`.
- No publish, tag, push, or version bump performed.