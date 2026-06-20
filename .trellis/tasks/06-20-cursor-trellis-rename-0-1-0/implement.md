# Implement: @blxzer/cursor-trellis rename + 0.1.0

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

Scope: rename npm packages to `@blxzer/cursor-trellis` / `@blxzer/cursor-trellis-core`, reset to `0.1.0`, isolate legacy migration manifests, validate publish artifacts.

Risk: medium-high — wide repo rename plus irreversible npm publish at Phase 6.

Stop point: complete Phases 1–5 and preflight evidence; **request explicit user approval** before `pnpm release:publish`.

- **Single repo:** `Trellis/` monorepo only.
- **Mechanical rename first**, then manifest reset, then docs/tests, then validation gate.
- **No npm publish** in this task until user approves after preflight evidence in `verify.md`.
- Prefer scripted replace for import paths; hand-review release scripts and README.

## Checklist

### Phase 1 — Rename + version reset

- [ ] Set `packages/core/package.json`: `@blxzer/cursor-trellis-core` @ `0.1.0`
- [ ] Set `packages/cli/package.json`: `@blxzer/cursor-trellis` @ `0.1.0`, dependency on new core
- [ ] Update `Trellis/package.json` filter scripts
- [ ] Replace `@blxzer/trellis-core` → `@blxzer/cursor-trellis-core` in `packages/cli/src`, `packages/core`, `packages/cli/test`, `packages/core/test`
- [ ] Update release scripts: `publish-packages.js`, `release-preflight.js`, `check-manifest-continuity.js`, `create-manifest.js`, `bump-versions.js`, `release.js` (comments + any hardcoded names)
- [ ] Update `.trellis/config.yaml` (`default_package`, `packages.trellis` keys if renamed)
- [ ] Run `pnpm install` at `Trellis/` to refresh lockfile

### Phase 2 — Migration manifest reset

- [ ] Move `packages/cli/src/migrations/manifests/*.json` → `packages/cli/src/migrations/manifests-legacy/`
- [ ] Add `manifests-legacy/README.md` explaining archive purpose
- [ ] Create `packages/cli/src/migrations/manifests/0.1.0.json` (baseline manifest)
- [ ] Trim `KNOWN_GAPS` in `check-manifest-continuity.js` for new package (empty or minimal)
- [ ] Confirm `copy-templates.js` only copies `manifests/` (not `manifests-legacy/`)

### Phase 3 — Docs + templates

- [ ] Reset/prepend `packages/cli/CHANGELOG.md` with 0.1.0 entry
- [ ] Update `packages/cli/README.md` npm badge + install
- [ ] Update `Trellis/README.md`, `README_CN.md`, `AGENTS.md`
- [ ] Update shipped template strings (grep `@blxzer/trellis` under `packages/cli/src/templates`, skip historical migration JSON in legacy folder)
- [ ] Update `upgrade.test.ts` and any tests asserting old package name

### Phase 4 — Validation

- [ ] `pnpm test`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `node packages/cli/scripts/check-manifest-continuity.js`
- [ ] `node packages/cli/scripts/release-preflight.js check-versions`
- [ ] `node packages/cli/scripts/release-preflight.js verify-packed-cli`
- [ ] `pnpm release:publish:dry`
- [ ] Record outputs in `verify.md`

### Phase 5 — Git tag (pre-publish, after validation)

- [ ] Commit with message e.g. `chore(release): rename to @blxzer/cursor-trellis@0.1.0`
- [ ] Tag `v0.1.0`
- [ ] Push to `private` remote (user approval for push)

### Phase 6 — Publish (explicit user approval only)

- [ ] `npm login` verified
- [ ] `pnpm release:publish` from `packages/cli`
- [ ] `node packages/cli/scripts/release-preflight.js verify-npm`
- [ ] Smoke: `npm install -g @blxzer/cursor-trellis@0.1.0` && `trellis --version`

## Validation commands

```bash
cd Trellis
pnpm install
pnpm test
pnpm typecheck
pnpm lint
node packages/cli/scripts/check-manifest-continuity.js
node packages/cli/scripts/release-preflight.js check-versions
node packages/cli/scripts/release-preflight.js verify-packed-cli
pnpm --filter @blxzer/cursor-trellis release:publish:dry
```

## Rollback points

- After Phase 1–3, before commit: `git checkout -- .`
- After tag, before publish: do not run `release:publish`; delete local tag if needed
- After publish: forward-only; document in verify.md
