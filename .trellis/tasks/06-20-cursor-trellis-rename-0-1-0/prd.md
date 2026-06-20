# Rename npm packages to @blxzer/cursor-trellis and publish 0.1.0

## Goal

Ship Trellis as a **new npm product line** under fresh package names, starting at **0.1.0**, so prior `@blxzer/trellis` / `@blxzer/trellis-core` test releases do not constrain semver or user expectations.

Target packages:

- `@blxzer/cursor-trellis@0.1.0` — CLI (`trellis` / `tl` / bundled `smart-search`)
- `@blxzer/cursor-trellis-core@0.1.0` — core SDK consumed by the CLI

## Requirements

- Treat as **Full Task**: cross-package rename, publish contract, migration manifest reset, release scripts, tests, and user-facing docs.
- Keep the monorepo root workspace **private**; publish only `packages/core` and `packages/cli`.
- **Do not unpublish** or overwrite existing `@blxzer/trellis*` versions on npm.
- Reset both packages to version **0.1.0** in repo manifests and lockfile.
- Rename all workspace/runtime references from `@blxzer/trellis` → `@blxzer/cursor-trellis` and `@blxzer/trellis-core` → `@blxzer/cursor-trellis-core`.
- **Reset the shipped migration-manifest line** for the new package: legacy manifests from the old package era must not ship in the tarball (avoid version-number collisions on future `0.2.0`, etc.).
- Add a baseline **`0.1.0.json`** migration manifest describing the new package line.
- Update install/upgrade instructions in README, CHANGELOG (fresh 0.1.0 section), AGENTS.md, and shipped templates where they reference npm install targets.
- Update `.trellis/config.yaml` `default_package` and related package registry keys.
- Release scripts (`release-preflight.js`, `check-manifest-continuity.js`, `create-manifest.js`, `publish-packages.js`, root `package.json` filters) must reference the new names.
- Preserve existing CLI binary names (`trellis`, `tl`) — only the **npm package name** changes.
- **Do not publish, tag, push, or deprecate** on npm until preflight passes and the user explicitly approves exact commands.

## Out of Scope

- Migrating existing user projects from `@blxzer/trellis` automatically (document manual reinstall only).
- Deprecating old `@blxzer/trellis*` packages (optional follow-up; not required for 0.1.0 publish).
- Renaming the GitHub repo or `repository.url` field (may update in a later pass unless needed for npm metadata).

## Acceptance Criteria

- [ ] `packages/cli/package.json`: `name` = `@blxzer/cursor-trellis`, `version` = `0.1.0`, depends on `@blxzer/cursor-trellis-core@workspace:*`.
- [ ] `packages/core/package.json`: `name` = `@blxzer/cursor-trellis-core`, `version` = `0.1.0`.
- [ ] Root `Trellis/package.json` pnpm filters use new package names.
- [ ] `pnpm install` succeeds; lockfile references new names.
- [ ] All TypeScript imports resolve to `@blxzer/cursor-trellis-core/*` (no stale `@blxzer/trellis-core` imports in `packages/`).
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint` pass from `Trellis/`.
- [ ] `pnpm release:publish:dry` (or equivalent pack dry-run) shows tarball depends on exact `@blxzer/cursor-trellis-core@0.1.0`, not `workspace:*`.
- [ ] Shipped `dist/migrations/manifests/` contains **only** the new-line manifests (baseline `0.1.0.json`); legacy manifests archived outside the copy path.
- [ ] `check-manifest-continuity.js` queries `@blxzer/cursor-trellis` (empty npm on first publish → passes).
- [ ] README install command: `npm install -g @blxzer/cursor-trellis`.
- [ ] `verify.md` records preflight outputs and **awaiting publish approval** (no publish without explicit user OK).

## Notes

- npm registry confirms `@blxzer/cursor-trellis` and `@blxzer/cursor-trellis-core` are **unclaimed** (404 as of 2026-06-20).
- Old package `@blxzer/trellis` latest = `1.1.2`; `@blxzer/trellis-core` includes orphan `0.1.0` plus `1.x`.
- CLI `PACKAGE_NAME` is read from `package.json` at runtime — rename propagates to `trellis update` npm checks automatically once published.
