# Release Trellis 1.0.0

## Goal

Publish Trellis as the first complete personal workflow-framework release under the current package scope:

- `@blxzer/trellis@1.0.0`
- `@blxzer/trellis-core@1.0.0`

The release should be installable and usable immediately for the normal Trellis workflow: `trellis` / `tl`, project init/update templates, task scripts, retrieval pack/router scripts, and the bundled `smart-search` command.

## Requirements

- Treat this as a Full Task because it changes package versions and performs a remote npm registry publish.
- Keep the root workspace package private; publish only `packages/core` and `packages/cli`.
- Preserve package names as `@blxzer/trellis` and `@blxzer/trellis-core`.
- Update version metadata consistently across package manifests and lockfile.
- Package all Trellis runtime assets required for user projects:
  - CLI `dist/` output
  - `bin/trellis.js`, `bin/smart-search.js`
  - `dist/templates/**` for Trellis, platform adapters, bundled skills, task templates, and markdown specs
  - `dist/migrations/manifests/**`
  - `scripts/postinstall.js`
  - package `README.md` and `LICENSE`
- Package Smart Search so the CLI can set up and repair the runtime from the npm package:
  - Smart Search npm wrapper and postinstall script
  - Python package source under `vendor/smart-search/src/smart_search/**`
  - provider modules and skill assets
  - `pyproject.toml`, `package.json`, README files, and license
- Exclude generated or local runtime artifacts from the tarball:
  - `.smart-search-python`
  - `build/`
  - `dist/` inside `vendor/smart-search`
  - `node_modules/`
  - `__pycache__/`
  - `*.pyc`
  - `*.egg-info`
- Verify local Trellis runtime metadata no longer points at the old `@mindfoldhq/trellis` package where it affects release or task tooling.
- Do not tag, push, publish, unpublish, or otherwise mutate remote resources until release preflight passes and the user explicitly approves exact publish commands.
- Record exact commands, outputs, package versions, npm identity/status checks, pack summaries, and publish results in `verify.md`.

## Acceptance Criteria

- [ ] `packages/cli/package.json` is versioned as `1.0.0`.
- [ ] `packages/core/package.json` is versioned as `1.0.0`.
- [ ] Workspace lockfile/version references are updated consistently.
- [ ] Packed `@blxzer/trellis` depends on exact `@blxzer/trellis-core@1.0.0`, not `workspace:*`.
- [ ] `pnpm install --offline` or an equivalent lockfile validation passes.
- [ ] `pnpm run check:pack-files` passes from `packages/cli`.
- [ ] `pnpm typecheck` passes.
- [ ] `pnpm --filter @blxzer/trellis-core test` passes.
- [ ] Focused CLI release/pack tests pass, including Smart Search vendor pack checks.
- [ ] `pnpm --filter @blxzer/trellis build` and `pnpm --filter @blxzer/trellis-core build` pass.
- [ ] `npm pack --dry-run --json` for core confirms `dist` exports are included.
- [ ] `npm pack --dry-run --json` for CLI confirms required Trellis runtime files, templates, migrations, bins, Smart Search files, README, and LICENSE are included.
- [ ] `npm pack --dry-run --json` for CLI confirms forbidden generated/runtime artifacts are excluded.
- [ ] Registry checks confirm `@blxzer/trellis@1.0.0` and `@blxzer/trellis-core@1.0.0` are publishable, or a precise blocker is documented before any publish attempt.
- [ ] User explicitly approves publish after preflight evidence is written.
- [ ] Publish completes for both packages, or a precise blocker and no-op/partial-publish state is documented.
- [ ] Post-publish `npm view` verifies both packages and dist-tag visibility.

## Non-Goals

- No GitHub release, git tag, git push, or website deployment unless separately approved.
- No unrelated feature work or broad cleanup.
- No package rename beyond the current `@blxzer` scope.
- No attempt to vendor third-party Python dependency wheels into the npm tarball in this task. Smart Search remains source-packaged and uses package-local postinstall to create its Python runtime.

## Notes

- Previous `0.1.0` release work was interrupted and may have partially published `@blxzer/trellis-core@0.1.0`; this task supersedes it with `1.0.0`.
- Publishing is remote, credential-bearing, and irreversible for a version. Stop before `pnpm publish` and request explicit approval with the exact package/version commands to run.
