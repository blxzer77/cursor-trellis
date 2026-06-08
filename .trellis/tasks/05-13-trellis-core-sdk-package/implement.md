# Implementation Plan

## Phase 1 — Package Skeleton

1. [x] Add `packages/core`.
2. [x] Add `@mindfoldhq/trellis-core` package metadata, ESM-only exports, `files`, scripts, and tsconfig.
3. [x] Keep `exports` branches ordered as `types`, `import`, `default`; include `"./package.json"`.
4. [x] Set `publishConfig.access: "public"`, `publishConfig.provenance: true`, and `sideEffects: false`.
5. [x] Add library tsconfig flags: `declaration`, `declarationMap`, `stripInternal`, `isolatedModules`. `verbatimModuleSyntax` and `isolatedDeclarations` deferred — the current re-export-heavy public surface conflicts with both; revisit once API stabilizes.
6. [x] Add root scripts for `core` build/test/typecheck (and aggregate scripts that build core before CLI).
7. [x] Add `packageManager` to root `package.json`.
8. [x] Add `@mindfoldhq/trellis-core@workspace:*` dependency to `packages/cli`.

## Phase 2 — Channel Data Core

1. [x] Define the `@mindfoldhq/trellis-core/channel` public API lock before moving code.
2. [x] Export public APIs for create/send/post/read/watch, thread list/show, context add/delete/list, thread rename, channel title set/clear, `reduceThreads`, and `reduceChannelMetadata`.
3. [x] Do not export `internal/store/*`, `appendEvent`, path helpers, lock helpers, `readLastSeq`, or seq sidecar helpers.
4. [x] Move/copy channel event types, schema, context parsing with legacy `linkedContext` read support, CSV parsing, filter, and thread reducer into core.
5. [x] Move/copy storage helpers behind internal boundaries: paths, lock, events, watch.
6. [x] Implement `.seq` sidecar inside the channel lock with lazy rebuild and corruption repair before finalizing `appendEvent`.
7. [x] Add `reduceChannelMetadata(events)` covering create metadata, legacy `linkedContext`, channel-level context add/delete, title set/clear, and legacy `type:"thread"` projection to `threads`.
8. [x] Add `context` event schema and reducer projection for both channel-level and thread-level context add/delete/list.
9. [x] Add thread rename projection semantics: conflict rejection, alias-chain resolution, old-key lookup, late-event mapping, `lastSeq` / `updatedAt`, and public `aliases` field on `ThreadState`.
10. [x] Add channel display title rename projection semantics.
11. [x] Add `--type threads` as the structural type and reject `--type thread` with a clear migration error.
12. [x] Keep formatting helpers in CLI; core returns structured projected state and does not export `formatThreadBoard`.
13. [x] Keep internal store paths hidden behind package exports.

## Phase 3 — CLI Adapter Migration

1. [x] Convert `channel create` to call core and write `context`, `origin`, and `meta` using the new event schema. New `--context-file` / `--context-raw` flags accepted; legacy `--linked-context-*` aliases kept as deprecated input.
2. [x] Convert `channel send` to call core.
3. [x] Convert `channel post / threads / thread` to call core.
4. [x] Add `channel context add/delete/list` as thin CLI wrappers over core channel/thread context APIs.
5. [x] Add `channel title set/clear` as thin CLI wrappers over core title APIs.
6. [x] Add `channel thread rename` as a thin CLI wrapper over core `renameThread`.
7. [x] Convert `channel messages` read/filter/reducer paths to call core (`readChannelMetadata` now uses `reduceChannelMetadata`).
8. [x] Convert `channel list` to use `reduceChannelMetadata(events)` instead of create-only metadata.
9. [x] Keep CLI-specific formatting in CLI package.
10. [~] CLI still owns local `store/lock.ts`, `store/paths.ts`, `store/watch.ts`, and a legacy `appendEvent` for supervisor/spawn/kill/wait runtime code. Those callers migrate in Phase 5 (per design). The local primitives share the channel lock with core; core's sidecar self-repairs from any drift.

## Phase 4 — Task API

1. [x] Identified Trellis task record sources: CLI SOT lived in `packages/cli/src/utils/task-json.ts`; Python writer is `.trellis/scripts/common/task_store.py::cmd_create`. The 24-field shape and field order are now centralized in core.
2. [x] Defined `TrellisTaskRecord` in `packages/core/src/task/schema.ts` as the canonical `task.json` shape; CLI `TaskJson` / `emptyTaskJson` re-export the core types for backwards compatibility.
3. [x] `writeTaskRecord` validates and canonicalizes supplied records, then merges canonicalized known fields with existing on-disk JSON so unknown fields survive read/write round-trips. Verified by `test/task/records.test.ts::preserves unknown on-disk fields`, `validates the supplied record before writing`, and `writeTaskRecord rejects incomplete records before touching disk`.
4. [x] Added zero-dep `taskRecordSchema` (`parse` / `safeParse`), `emptyTaskRecord`, `loadTaskRecord`, `writeTaskRecord`, `validateTaskDirName`, `isValidTaskDirName`, and `inferTaskPhase` exports under `@mindfoldhq/trellis-core/task`. The root barrel `@mindfoldhq/trellis-core` re-exports the same surface.
5. [x] `inferTaskPhase` derives phase from `status` only — `planning → plan`, `in_progress → implement`, `review → review`, `completed | done → completed`, anything else → `unknown`. There is no `current_phase` field.
6. [x] Tests: `packages/core/test/task/{schema,records,paths,phase}.test.ts` (32 tests) covering canonical factory, schema parse/safeParse, required-field validation, dir name validation including `00-bootstrap-guidelines` / `00-join-*`, unknown-field preservation, corrupt existing-file overwrite refusal, write-time validation, and phase inference.

## Phase 5 — Runtime APIs

1. [ ] Extract `wait` once storage/watch APIs are stable.
2. [ ] Extract `spawn/kill/supervisor/adapters` after wait is stable.
3. [ ] Preserve kill ladder, terminal event invariants, and provider session persistence.

## Phase 6 — Versioning and Release Wiring

1. [x] Keep `@mindfoldhq/trellis-core` version synchronized with `@mindfoldhq/trellis` via shared `packages/cli/scripts/bump-versions.js` (computes next version, writes both `package.json` files atomically, refuses to run if they start out of sync).
2. [x] Updated CLI release scripts (`release`, `release:minor`, `release:major`, `release:beta`, `release:rc`, `release:promote`) to thin wrappers over `packages/cli/scripts/release.js`, which calls `bump-versions.js` once and stages both `packages/cli/package.json` and `packages/core/package.json`. Root `package.json` exposes the matching `release*` wrappers plus `release:check` / `release:plan` for ad-hoc preflight.
3. [x] Packed CLI depends on the exact `@mindfoldhq/trellis-core` version: source keeps `workspace:*`, pnpm rewrites it during `pnpm pack` / `pnpm publish` to the literal current version. `release-preflight.js verify-packed-cli` enforces this in CI (packs the CLI, extracts `package.json`, asserts `dependencies["@mindfoldhq/trellis-core"]` equals the shared version, fails on `workspace:*` or a range).
4. [x] Concurrent release tracks preserved: `release-preflight.js npm-tag` derives the npm dist-tag from the shared version suffix (`*-beta.*` → `beta`, `*-rc.*` → `rc`, `*-alpha.*` → `alpha`, otherwise `latest`). `publish-plan` reuses the same value so core and CLI always publish under the same tag.
5. [x] `.github/workflows/publish.yml` builds core then CLI via `pnpm build`, then publishes core first and CLI second, both using the dist-tag from `publish-plan`.
6. [x] `.github/workflows/ci.yml` path filters include `packages/core/**`, `pnpm-workspace.yaml`, and root `package.json`. CI now runs `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build` (root aggregates that cover both packages), pins pnpm to the root `packageManager` version (`10.32.1`), and verifies `dist` output for both core (`dist/index.js`, `dist/channel/index.js`, `dist/task/index.js`) and CLI (`dist/index.js`).
7. [x] Added `permissions.id-token: write` to the publish job and `NPM_CONFIG_PROVENANCE=true` env on each publish step; core `publishConfig.provenance` was already on.
8. [x] Manifest continuity (`check-manifest-continuity.js`) and docs-site changelog (`check-docs-changelog.js`) checks remain wired only into the CLI release scripts. Core has no migration manifests of its own. `check-docs-changelog.js` imports `computeNext` from `bump-versions.js` so the docs guard checks the same target version that the bump script will write.
9. [x] Same as (3): `verify-packed-cli` is the reusable preflight; it works for any version because it reads the shared version from `packages/cli/package.json`.
10. [x] `release-preflight.js check-versions --require-tag` fails publish unless `packages/core/package.json`, `packages/cli/package.json`, and the git tag derived from `GITHUB_REF` / `GITHUB_REF_NAME` (v0.6.0-beta.12 → 0.6.0-beta.12) all match.
11. [x] One npm dist-tag computed in `publish-plan` (via `computeNpmTag`) and exported through `$GITHUB_OUTPUT.tag`; both publish steps consume the same `steps.plan.outputs.tag`.
12. [x] Publish is idempotent: `publish-plan` queries `npm view <pkg>@<version> version` for each package and emits `core_publish` / `cli_publish` booleans. Already-published versions are skipped with a log line; mismatches still fail loudly in `check-versions` before the plan step runs. A rerun for the same tag with core already on npm continues to publish CLI without republishing core.
13. [x] Kept both `release.published` and `push.tags: v*` triggers — idempotency from (12) plus publish workflow concurrency on the tag makes duplicate triggers safe; the workflow header documents the rationale.
14. [x] Added `release-preflight.js verify-npm --package all|core|cli` as the CI post-publish public registry visibility gate. It validates the exact published package version and computed npm dist-tag for both `@mindfoldhq/trellis-core` and `@mindfoldhq/trellis`.
15. [x] `.github/workflows/publish.yml` now runs `verify-npm --package all` after publish/skip steps so registry visibility issues fail in CI instead of being repaired by local publication.
16. [x] `release.js` excludes both `docs-site` and `marketplace` from the automatic pre-release staging commit, matching the documented submodule commit ordering.
17. [x] Added `.trellis/spec/cli/backend/trellis-core-sdk.md` and refreshed `release-process.md`, `directory-structure.md`, and backend `index.md` with core/CLI boundaries, CI-only publishing, dual-package versioning, beta/rc/GA lifecycle, and release preflight rules.
18. [x] Synced `.codex/skills/create-manifest/SKILL.md` and `.claude/commands/trellis/create-manifest.md` so manifest creation now analyzes `packages/cli/src/` and `packages/core/src/`, records dual-package release rules, and forbids local npm publishing.

## Verification

1. [x] `pnpm --filter @mindfoldhq/trellis-core test -- test/task` — 56 tests pass (24 channel + 32 task; Vitest still ran the core suite).
2. [x] `pnpm --filter @mindfoldhq/trellis-core typecheck` — clean.
3. [x] `pnpm --filter @mindfoldhq/trellis-core lint` — clean (run via local `./node_modules/.bin/eslint` to avoid the host shell's global ESLint 8 binary).
4. [x] `pnpm --filter @mindfoldhq/trellis-core build` — emits dist + d.ts.
5. [ ] `pnpm --dir packages/core exec publint --strict` — deferred (publint not installed).
6. [ ] `pnpm --dir packages/core exec attw --pack . --profile esm-only` — deferred (attw not installed).
7. [x] `pnpm --dir packages/cli exec vitest run test/commands/channel.test.ts` — channel test file passes (9/9).
8. [x] `pnpm --filter @mindfoldhq/trellis typecheck` — clean.
9. [x] `cd packages/cli && pnpm exec eslint src/commands/channel test/commands/channel.test.ts` — clean for touched CLI channel files.
10. [x] `pnpm --filter @mindfoldhq/trellis build` — emits dist.
11. [x] `rg -n "@mindfoldhq/trellis-core/.*/internal|packages/core/src/.*/internal" packages/cli/src` — no deep imports of core internals from CLI.
12. [x] `pnpm --filter @mindfoldhq/trellis-core pack --pack-destination /tmp` — run indirectly via `release-preflight.js verify-packed-cli`; core tarball builds during root `pnpm build` step in the publish workflow.
13. [x] `pnpm --filter @mindfoldhq/trellis pack --pack-destination /tmp/trellis-pack-test` — produces `mindfoldhq-trellis-0.6.0-beta.12.tgz`.
14. [x] Inspect the packed CLI `package.json`: `dependencies["@mindfoldhq/trellis-core"]` resolves to the exact `0.6.0-beta.12`, not `workspace:*`. Encoded as automated check in `node packages/cli/scripts/release-preflight.js verify-packed-cli`.
15. [ ] Crash simulation: append succeeds but `.seq` update is skipped; next append repairs and does not duplicate seq.
16. [x] Corrupt `.seq` repair: non-integer sidecar rebuilds from JSONL.
17. [x] Ahead `.seq` repair: sidecar higher than JSONL tail does not create a seq gap.
18. [x] Normal append path does not full-read `events.jsonl`; test/code review asserts tail-read helper usage.
19. [x] `origin` accepts only `cli | api | worker`; `meta` must be a plain JSON object and reject null, arrays, and primitives.
20. [x] Review fix: core no longer exposes legacy `LinkedContextEntry` or `metadataFromCreateEvent` through `@mindfoldhq/trellis-core/channel`.
21. [x] Review fix: thread rename rejects missing source threads; thread read/context APIs reject non-threads channels.
22. [x] Review fix: CLI context/title commands default `--as` to `main`, matching design examples while preserving explicit attribution.
23. [x] Phase 4 follow-up: `packages/cli/src/utils/task-json.ts` re-exports from `@mindfoldhq/trellis-core/task` instead of defining a duplicate SOT; CLI typecheck remains clean and existing `init` / `update` integration tests (81 tests) pass.
24. [x] Phase 6: `node packages/cli/scripts/release-preflight.js check-versions` — passes (core and CLI both `0.6.0-beta.12`).
25. [x] Phase 6: `node packages/cli/scripts/release-preflight.js npm-tag` — prints `beta`.
26. [x] Phase 6: `node packages/cli/scripts/release-preflight.js verify-packed-cli` — packs CLI, asserts `@mindfoldhq/trellis-core` is pinned to `0.6.0-beta.12` (no `workspace:*` leak).
27. [x] Phase 6: `node packages/cli/scripts/release-preflight.js publish-plan` — emits per-package publish/skip decision against npm (correctly skipped CLI which is already on npm, would publish core). `publish-plan --json` keeps stdout as pure JSON.
28. [x] Phase 6: `pnpm typecheck` — root aggregate clean (core + CLI).
29. [x] Phase 6: `computeNext` unit-style check covering patch/minor/major/beta/rc/promote, stable→prerelease seeding, track-switch (rc→beta), and seed-format lift (`X.Y.Z-N` → `X.Y.Z-beta.0`) — all 10 cases pass.
30. [x] Phase 6: `pnpm test` — root aggregate clean (core 56/56, CLI 1191/1191).
31. [x] Phase 6: `pnpm lint` — root aggregate clean (core + CLI).
32. [x] Phase 6: `pnpm build` — root aggregate clean and emits both package `dist/` trees.
33. [x] Phase 6: `GITHUB_REF_NAME=v0.6.0-beta.12 node packages/cli/scripts/release-preflight.js check-versions --require-tag` — passes; mismatched tag `v0.6.0-beta.13` fails before publish.
34. [x] Phase 6: `python3 .trellis/scripts/task.py validate .trellis/tasks/05-13-trellis-core-sdk-package` — context manifests valid.
35. [x] Phase 6: `node --check packages/cli/scripts/{bump-versions.js,release-preflight.js,release.js}` — syntax clean for all release scripts.
36. [x] Phase 6: `node --check packages/cli/scripts/check-docs-changelog.js` — syntax clean after reusing `computeNext` from `bump-versions.js`.
37. [x] Phase 6 follow-up: `node --check packages/cli/scripts/release-preflight.js && node --check packages/cli/scripts/release.js` — syntax clean after adding `verify-npm` and excluding `marketplace`.
38. [x] Phase 6 follow-up: `node packages/cli/scripts/release-preflight.js verify-npm --package all` — confirms `@mindfoldhq/trellis-core@0.6.0-beta.13` and `@mindfoldhq/trellis@0.6.0-beta.13` are visible on public npm under `beta`.
39. [x] Phase 6 follow-up: `diff -u <(sed '1,5d' .codex/skills/create-manifest/SKILL.md) .claude/commands/trellis/create-manifest.md` — confirms the Codex skill body and Claude slash command body are identical apart from Codex frontmatter.
40. [x] Phase 6 follow-up: `pnpm typecheck` — root aggregate clean after spec/release-preflight changes.
41. [x] Phase 6 follow-up: `pnpm lint` — root aggregate clean.
42. [x] Phase 6 follow-up: `pnpm test` — root aggregate clean (core 56/56, CLI 1191/1191).
43. [x] Phase 6 follow-up: `trellis channel run release-spec-check --agent check --timeout 10m --stdin` — check agent verdict `[VERDICT] ship`, no blocking or major issues.
44. [ ] Phase 6: end-to-end publish workflow run on a future real tag — deferred until the next version tag because official npm publishing must stay CI-only.

## Deferred

- Dual ESM/CJS tsdown build.
- Turborepo migration.
- Browser/isomorphic exports.
- StorageAdapter.
- Managed resident agents.
- External product identity model.
- Channel address rename / directory move.
- Channel metadata mutation beyond title.
- Single comment deletion.
- Single thread hard delete.
- Changesets migration.
