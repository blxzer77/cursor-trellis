# release manifest for 0.5.0-beta.17

## Goal

Create the `0.5.0-beta.17` migration manifest and docs-site changelog following `.claude/commands/trellis/create-manifest.md`.

## What I already know

* Current CLI package version is `0.5.0-beta.16`.
* Latest release tag and latest manifest are both `v0.5.0-beta.16` / `0.5.0-beta.16.json`.
* Target version is inferred as `0.5.0-beta.17`.
* The current branch has commits after `v0.5.0-beta.16` covering:
  * init completion output cleanup;
  * task slug date-prefix docs;
  * bundled built-in `trellis-meta` skill installation;
  * Pi subagent launcher/config hardening;
  * subagent context wiring improvements;
  * task archive and journal housekeeping.

## Assumptions

* This beta release is non-breaking.
* No rename/delete migration entries are required; new template files should land through normal update/template hash tracking.
* Docs-site English and Chinese changelog pages must be added and linked from `docs-site/docs.json`.

## Requirements

* Create `packages/cli/src/migrations/manifests/0.5.0-beta.17.json` with:
  * `breaking: false`
  * `recommendMigrate: false`
  * `migrations: []`
  * technical changelog entries based on commits since `v0.5.0-beta.16`
* Create docs-site changelog pages:
  * `docs-site/changelog/v0.5.0-beta.17.mdx`
  * `docs-site/zh/changelog/v0.5.0-beta.17.mdx`
* Update `docs-site/docs.json` changelog nav/list entries.
* Keep changelog voice technical and greppable, matching the command file rules.

## Acceptance Criteria

* [x] Manifest JSON is valid and created through `packages/cli/scripts/create-manifest.js`.
* [x] Manifest and docs-site changelog cover all non-housekeeping source/template changes since `v0.5.0-beta.16`.
* [x] English and Chinese changelog files have matching structure.
* [x] `docs-site/docs.json` points navbar/latest changelog to `v0.5.0-beta.17`.
* [x] Relevant manifest/changelog validation tests pass.

## Definition of Done

* Tests or validation commands run and pass.
* Task context is valid.
* Work is committed only after review/verification.

## Out of Scope

* Bumping package versions.
* Tagging or publishing the release.
* Creating migrationGuide/aiInstructions, unless a breaking migration is discovered.

## Technical Notes

* Release workflow source: `.claude/commands/trellis/create-manifest.md`
* Manifest script: `packages/cli/scripts/create-manifest.js`
* Existing manifests: `packages/cli/src/migrations/manifests/`
* Docs-site changelog source: `docs-site/changelog/` and `docs-site/zh/changelog/`
