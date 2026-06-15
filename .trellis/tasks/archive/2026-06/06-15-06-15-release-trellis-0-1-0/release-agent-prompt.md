# Release Agent Prompt

Selected task: `.trellis/tasks/06-15-06-15-release-trellis-0-1-0`

You are the release executor for Trellis. Work in `D:\MyHarness\Trellis`.

Goal: prepare and, only after explicit user approval, publish the first complete personal Trellis workflow-framework release:

- `@blxzer/trellis-core@1.0.0`
- `@blxzer/trellis@1.0.0`

This release must be install-and-use oriented: users should get the Trellis CLI, project templates, workflow scripts, migration manifests, bundled skills, and Smart Search wrapper/source in the npm package.

Read first:

- `.trellis/workflow.md`
- `.trellis/tasks/06-15-06-15-release-trellis-0-1-0/prd.md`
- `.trellis/tasks/06-15-06-15-release-trellis-0-1-0/design.md`
- `.trellis/tasks/06-15-06-15-release-trellis-0-1-0/implement.md`
- `packages/core/package.json`
- `packages/cli/package.json`
- `packages/cli/scripts/release-preflight.js`
- `packages/cli/scripts/check-cli-pack-files.js`
- `packages/cli/scripts/smart-search-vendor-utils.js`
- `packages/cli/scripts/postinstall.js`
- `packages/cli/bin/smart-search.js`

Required behavior:

1. Do not publish, tag, push, unpublish, or mutate remotes until preflight evidence is written and the user explicitly approves exact publish commands.
2. Set both publishable package versions to `1.0.0` and keep lockfile/dependency metadata consistent.
   - Keep `packages/cli/package.json` dependency on `@blxzer/trellis-core` as `workspace:*` for local development.
   - Use `pnpm pack` / `pnpm publish` to prove and perform the release dependency rewrite to exact `1.0.0`.
3. Confirm non-archive runtime/config paths do not still use `@mindfoldhq/trellis` where release tooling expects `@blxzer/trellis`.
4. Preserve the Smart Search vendor allowlist packaging fix.
5. Ensure the CLI package includes all install-and-use assets:
   - `dist/**`
   - `bin/trellis.js`
   - `bin/smart-search.js`
   - `scripts/postinstall.js`
   - `dist/templates/**`
   - `dist/migrations/manifests/**`
   - `README.md`
   - `LICENSE`
   - explicit Smart Search vendor files under `vendor/smart-search/**`
6. Ensure the Smart Search package path includes:
   - `vendor/smart-search/pyproject.toml`
   - `vendor/smart-search/package.json`
   - `vendor/smart-search/npm/bin/smart-search.js`
   - `vendor/smart-search/npm/scripts/postinstall.js`
   - `vendor/smart-search/src/smart_search/cli.py`
   - `vendor/smart-search/src/smart_search/service.py`
   - `vendor/smart-search/src/smart_search/providers/*.py`
   - `vendor/smart-search/skills/smart-search-cli/SKILL.md`
   - `vendor/smart-search/src/smart_search/assets/skills/smart-search-cli/SKILL.md`
7. Ensure the CLI package excludes generated or local-only artifacts:
   - `.smart-search-python`
   - `vendor/smart-search/build`
   - `vendor/smart-search/dist`
   - `node_modules`
   - `__pycache__`
   - `.pyc`
   - `.egg-info`
8. Run and record validation:
   - `pnpm install --offline`
   - `pnpm --filter @blxzer/trellis-core build`
   - `pnpm --filter @blxzer/trellis build`
   - `pnpm typecheck`
   - `pnpm --filter @blxzer/trellis-core test`
   - `pnpm --filter @blxzer/trellis exec vitest run test/runtime/smart-search-vendor.test.ts`
   - from `packages/cli`: `pnpm run check:pack-files`
   - `node packages/cli/scripts/release-preflight.js check-versions`
   - `node packages/cli/scripts/release-preflight.js verify-packed-cli`
   - `node packages/cli/scripts/release-preflight.js publish-plan`
   - `npm pack --dry-run --json` for both `packages/core` and `packages/cli`
9. Check npm identity and registry availability:
   - `npm whoami`
   - `npm view @blxzer/trellis-core@1.0.0 version`
   - `npm view @blxzer/trellis@1.0.0 version`
10. Write `.trellis/tasks/06-15-06-15-release-trellis-0-1-0/verify.md` before requesting publish approval.
11. After approval, publish core first, then CLI:
   - `pnpm publish --access public` from `packages/core`
   - `pnpm publish --access public` from `packages/cli`
12. Record final npm view results in `verify.md`.

Stop and report a blocker if:

- either `1.0.0` package version already exists,
- npm auth is unavailable,
- pack contents miss required Trellis runtime/template/Smart Search files,
- pack contents include generated Smart Search artifacts,
- preflight/build/typecheck/focused tests fail,
- the CLI packed package would depend on an unpublished or invalid core version,
- publish requires provenance, OTP, or registry settings that are not configured.

Do not run unrelated refactors or broad test repairs. Keep the release diff minimal.
