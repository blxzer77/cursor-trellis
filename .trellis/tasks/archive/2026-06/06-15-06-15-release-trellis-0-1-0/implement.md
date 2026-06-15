# Implement

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

Scope: release preparation and publish for `@blxzer/trellis-core@1.0.0` and `@blxzer/trellis@1.0.0`.

Risk: high, because npm registry publish is remote and irreversible for a version.

Stop point: stop after preflight and dry-run evidence, then request explicit user approval before running `pnpm publish`.

## Steps

1. Inspect current release state.
   - `git -c safe.directory=D:/MyHarness/Trellis status --short`
   - `Get-Content packages/core/package.json`
   - `Get-Content packages/cli/package.json`
   - Review any `0.1.0` handoff notes to avoid retrying a partial old release.

2. Update versions to `1.0.0`.
   - Update `packages/core/package.json`.
   - Update `packages/cli/package.json`.
   - Update task artifacts from the old `0.1.0` contract to `1.0.0`.
   - Update lockfile consistently with `pnpm install --offline` if needed.
   - Verify no stale `@mindfoldhq/trellis` release references remain in non-archive runtime/config paths.

3. Confirm package content rules.
   - From `packages/cli`: `pnpm run sync:pack-files` if Smart Search allowlist drift exists.
   - From `packages/cli`: `pnpm run check:pack-files`.
   - Confirm CLI package `files` includes `dist`, `bin`, `scripts/postinstall.js`, README, LICENSE, and explicit Smart Search vendor files.
   - Confirm CLI package `files` does not include broad `vendor/smart-search` or generated artifacts.

4. Run preflight validation.
   - `pnpm install --offline`
   - If full lifecycle install is environment-blocked, `pnpm install --offline --frozen-lockfile --ignore-scripts` is acceptable as the lockfile consistency substitute, but record the lifecycle blocker.
   - `pnpm --filter @blxzer/trellis-core build`
   - `pnpm --filter @blxzer/trellis build`
   - `pnpm typecheck`
   - `pnpm --filter @blxzer/trellis-core test`
   - `pnpm --filter @blxzer/trellis exec vitest run test/runtime/smart-search-vendor.test.ts`
   - `node packages/cli/scripts/release-preflight.js check-versions`
   - `node packages/cli/scripts/release-preflight.js verify-packed-cli`

5. Run pack dry-runs.
   - For core: `npm pack --dry-run --json` from `packages/core`.
   - For CLI: `npm pack --dry-run --json` from `packages/cli`.
   - Confirm CLI pack contains key install-and-use assets:
     - `bin/trellis.js`
     - `bin/smart-search.js`
     - `dist/cli/index.js`
     - `dist/templates/trellis/scripts/task.py`
     - `dist/templates/trellis/scripts/get_context.py`
     - `dist/templates/trellis/scripts/common/retrieval_pack.py`
     - `dist/templates/trellis/scripts/common/codebase_retrieval_router.py`
     - `dist/templates/trellis/workflow.md`
     - `dist/migrations/manifests/*.json`
     - `vendor/smart-search/pyproject.toml`
     - `vendor/smart-search/npm/scripts/postinstall.js`
     - `vendor/smart-search/src/smart_search/cli.py`
     - `vendor/smart-search/src/smart_search/providers/base.py`
     - `vendor/smart-search/skills/smart-search-cli/SKILL.md`
   - Confirm forbidden artifacts are absent:
     - `.smart-search-python`
     - `vendor/smart-search/build`
     - `vendor/smart-search/dist`
     - `__pycache__`
     - `.pyc`
     - `.egg-info`

6. Check npm registry and identity.
   - `npm whoami`
   - `npm view @blxzer/trellis-core@1.0.0 version`
   - `npm view @blxzer/trellis@1.0.0 version`
   - If either version exists, stop and document the blocker.

7. Write `verify.md`.
   - Include exact version diff, validation commands, registry results, pack content summary, and pending publish commands.

8. Request explicit publish approval.
   - The approval request must name the exact package versions and commands.
   - Do not run publish until approval is granted after preflight.

9. Publish after approval.
   - Publish core first.
   - Publish CLI second.
   - Use explicit `pnpm publish --access public` from each package so `workspace:*` is rewritten to the exact release version in the published manifest.

10. Post-publish verification.
   - `npm view @blxzer/trellis-core@1.0.0 version`
   - `npm view @blxzer/trellis@1.0.0 version`
   - `npm view @blxzer/trellis dist-tags`
   - Record final status in `verify.md`.

11. Finish task.
   - Record learning decision.
   - Archive only after validation/publish evidence is complete.

## Quality Gates

- Release preflight evidence must exist before publish approval request.
- Pack contents must be inspected before publish.
- Smart Search must be source-packaged and repairable by the Trellis wrapper/postinstall path.
- Publish must be serial: core before CLI.
- Any registry, auth, provenance, or package-content mismatch is a blocker, not a warning.

## Rollback Points

- Before version edits: no-op rollback by leaving task in planning.
- After version edits but before publish: revert or amend local version changes if required.
- After first package publish: no automatic rollback; stop, document partial publish, and ask user.
