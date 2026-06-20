# Design: @blxzer/cursor-trellis package rename

## Problem

`@blxzer/trellis` already has seven published versions (1.0.0–1.1.2) from internal testing. npm forbids publishing semver-lower versions on the same name. Path B: new package identity with a clean 0.1.0 baseline.

## Package mapping

| Role | Old name | New name |
|------|----------|----------|
| CLI | `@blxzer/trellis` | `@blxzer/cursor-trellis` |
| Core SDK | `@blxzer/trellis-core` | `@blxzer/cursor-trellis-core` |
| Version (both) | `1.1.2` | `0.1.0` |

Binaries unchanged: `trellis`, `tl`, `smart-search`.

## Migration manifest isolation

**Risk:** `copy-templates.js` copies all of `src/migrations/manifests/` → `dist/migrations/manifests/`. Legacy files like `0.2.0.json`, `1.0.0.json` share version numbers the new line may reuse with different content. `trellis update` applies manifests where `installed < v <= current`; shipping legacy files would apply wrong migrations.

**Decision:**

1. Move existing manifest JSON files to `packages/cli/src/migrations/manifests-legacy/` (repo archive, **not** copied to dist).
2. Update `copy-templates.js` to copy only `src/migrations/manifests/` (now containing new-line files only).
3. Add `src/migrations/manifests/0.1.0.json` — baseline for `@blxzer/cursor-trellis` (description, changelog, notes that this is the first public cursor-trellis release; no breaking migrations from a prior npm line).

**`KNOWN_GAPS` in `check-manifest-continuity.js`:** Reset or replace — the gate queries `@blxzer/cursor-trellis` on npm. First publish returns `[]`; historical gaps for old package are irrelevant. Remove old-package gap entries to avoid confusion; document old gaps in `manifests-legacy/README.md` if needed.

## Code change surface

### Must change (runtime / publish)

| Area | Change |
|------|--------|
| `packages/cli/package.json` | name, version, dependency |
| `packages/core/package.json` | name, version |
| `Trellis/package.json` | `--filter` targets |
| `pnpm-lock.yaml` | regenerate |
| `packages/cli/src/**/*.ts` imports | `@blxzer/cursor-trellis-core` |
| `packages/core/test/**` imports | same |
| Release scripts | package name strings + comments |
| Tests (`upgrade.test.ts`, etc.) | expected npm targets |
| `.trellis/config.yaml` | `default_package`, package registry keys |

### Should change (user-facing)

| Area | Change |
|------|--------|
| `packages/cli/README.md`, `CHANGELOG.md` | install + fresh 0.1.0 entry |
| `Trellis/README.md`, `README_CN.md`, `AGENTS.md` | filter names, install hints |
| Shipped templates (`workflow.md`, release task templates, bundled skills) | npm package references where users see install commands |

### Do not bulk-edit

- Archived Trellis task artifacts under `.trellis/tasks/archive/`
- Historical `manifests-legacy/` content (frozen)
- Test fixtures under `retrieval-dogfood/archive/` (historical evidence)

## Old-package user migration (documentation only)

```
npm uninstall -g @blxzer/trellis
npm install -g @blxzer/cursor-trellis
# In each project: trellis update (templates refresh from new CLI)
```

Optional later: `npm deprecate @blxzer/trellis@"*"` with message pointing to `@blxzer/cursor-trellis`.

## Publish flow (unchanged mechanics, new names)

1. Preflight: `pnpm release:check`, `pnpm release:plan`, manifest continuity, pack verify.
2. Git: manual version already `0.1.0` → tag `v0.1.0`, push `private` remote (no `release.js` bump needed for initial 0.1.0 unless using a dedicated first-release script).
3. npm: `pnpm release:publish` — **core first**, then cli (`publish-packages.js`).

**First-release note:** `release.js` expects bump from current version; for 0.1.0 reset, set versions manually, commit, tag `v0.1.0`, then publish. Subsequent releases use normal `pnpm release:patch` etc.

## Rollback

- Before npm publish: revert git commits.
- After npm publish: npm versions are immutable; only forward semver + optional deprecate.

## Tradeoffs

| Choice | Pro | Con |
|--------|-----|-----|
| New scoped names under `@blxzer` | Matches org; both names available | Users must learn new install string |
| Archive vs delete legacy manifests | Preserves history in repo | Extra folder + copy-templates guard |
| Keep `trellis` binary name | No shell habit change | Package name ≠ binary name (common pattern) |
