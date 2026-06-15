# Design

## Release Boundary

This task releases the Trellis monorepo packages intended for npm consumption:

- `packages/core` -> `@blxzer/trellis-core`
- `packages/cli` -> `@blxzer/trellis`

The root workspace package remains private and is not published.

## Versioning Contract

The requested public version is `1.0.0`. Both publishable packages must use the exact same version. The final published artifacts must expose `1.0.0`.

The packed CLI package must depend on exact `@blxzer/trellis-core@1.0.0`. The source manifest may keep `workspace:*` for local development if `pnpm pack` rewrites it correctly; release preflight must inspect the packed `package.json`.

## Package Contents Contract

The CLI npm package is the user-facing workflow framework package. Its tarball must contain the assets needed for install-and-use:

- JS runtime: `dist/**`
- CLI bins: `bin/trellis.js`, `bin/smart-search.js`
- Trellis project templates: `dist/templates/**`
- Migration manifests: `dist/migrations/manifests/**`
- Smart Search setup bridge: `scripts/postinstall.js`
- Smart Search vendored source/wrapper: explicit `vendor/smart-search/...` allowlist
- Documentation/license: `README.md`, `LICENSE`

The Smart Search vendor packaging remains allowlist-based. It must include source, wrapper scripts, provider modules, and skill assets, while excluding cache/runtime/build artifacts. This gives users a package-local `smart-search` command that can repair its Python runtime via postinstall without requiring the separate `@konbakuyomu/smart-search` npm package.

## Smart Search Runtime Boundary

Smart Search is source-packaged inside Trellis. On install, Trellis runs `scripts/postinstall.js`, which delegates to `vendor/smart-search/npm/scripts/postinstall.js` and creates a package-local `.smart-search-python` runtime.

This release does not vendor Python dependency wheels. It requires Python 3.10+ and normal pip access during postinstall unless the user sets `TRELLIS_SKIP_SMART_SEARCH_POSTINSTALL=1`. The CLI wrapper attempts repair if the runtime is missing.

## Publish Contract

Publishing requires a two-step gate:

1. Preflight, dry-run, and pack-content evidence is written to `verify.md`.
2. The user explicitly approves the exact publish commands.

Do not publish on the basis of the initial task request alone. The preflight evidence must be available before requesting approval.

Use `pnpm publish --access public` for the two workspace packages, not direct `npm publish` from the source package directories. The CLI source manifest keeps `@blxzer/trellis-core` as `workspace:*` for local development; `pnpm pack` / `pnpm publish` rewrites that dependency to the exact release version in the published manifest. Direct `npm pack` does not perform that rewrite and is only used for package-content dry-run inspection, not for dependency-rewrite proof.

## Registry And Dist-Tag

Verify registry state before publishing:

- `npm whoami`
- `npm view @blxzer/trellis-core@1.0.0 version`
- `npm view @blxzer/trellis@1.0.0 version`

If either `1.0.0` version exists, stop and document the blocker. For `1.0.0`, the expected dist-tag is `latest`.

## Rollback / Failure Behavior

npm package versions cannot be overwritten after publish. If core publishes and CLI fails, document the partial state and stop before retrying. Do not unpublish unless the user gives a separate explicit approval.

No git tag or push should be created in this task unless the user expands the scope.
