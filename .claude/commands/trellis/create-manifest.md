# Create Migration Manifest

Create a migration manifest for a new patch, beta, rc, or minor release based on commits since the previous release.

## Arguments

- `$ARGUMENTS` - Target version, for example `0.5.15` or `0.6.0-beta.14`. If omitted, ask the user.

## Package release model

Trellis currently publishes two npm packages from the same git tag:

- `@mindfoldhq/trellis`
- `@mindfoldhq/trellis-core`

Both packages must always share the exact same version and npm dist-tag. Source uses `workspace:*`; the packed CLI must depend on the exact published core version.

Official npm publishing is CI-only. Never use local `npm publish` or `pnpm publish` to compensate for a failed or partial release. Local verification may use `pnpm pack`, `release-preflight`, tests, lint, typecheck, and `npm view`.

## Step 1: Identify Last Release

```bash
git tag --sort=-v:refname | head -5
```

Pick the most recent release tag on the current release line, for example `v0.5.14` or `v0.6.0-beta.13`.

## Step 2: Gather Changes

```bash
git log <last-release-tag>..HEAD --oneline
git log <last-release-tag>..HEAD --oneline -- packages/cli/src/ packages/core/src/
git log <last-release-tag>..HEAD --oneline -- packages/cli/scripts/ .github/workflows/ package.json packages/*/package.json pnpm-lock.yaml
```

User-facing changelog coverage should focus on source behavior under `packages/cli/src/` and `packages/core/src/`. Release wiring, workflow, or package dependency changes belong in `Internal` only when users can observe the behavior, for example install/update reliability or multi-package availability.

## Step 3: Analyze Each Relevant Commit

For each commit that touches relevant source or release behavior:

1. Read the diff:
   ```bash
   git diff <parent>...<commit> -- packages/cli/src/ packages/core/src/ --stat
   git diff <parent>...<commit> -- packages/cli/scripts/ .github/workflows/ package.json packages/*/package.json pnpm-lock.yaml --stat
   ```
2. Classify as `feat`, `fix`, `refactor`, or `chore`.
3. Write a one-line changelog entry in conventional commit style.

Drop pure spec edits, mechanical refactors, and internal-only cleanup unless they materially change what users observe.

## Step 4: Draft Changelog

Voice: technical reference doc. Short, clear, plain. Not a story, not a sales pitch. Follow `.trellis/spec/docs-site/docs/style-guide.md` -> "Changelog / Release Notes Voice".

Do:

- Lead each `###` section with one sentence stating what changed. Then table, code, or bullets. Done.
- Use feature names as headings, for example `### Joiner onboarding task`.
- Include grep-able identifiers: file paths, function names, flag names, migration entries.
- Mirror English and Chinese 1:1 in docs-site changelogs: same sections, same tables, same code blocks; only prose translated.

Do not:

- Add "Why", "Background", or "Rationale" paragraphs.
- Add a Tests section or test counts.
- Add Internal entries unless users can observe the behavior.
- Use rhetorical questions, emotional framing, filler adverbs, or marketing voice.
- Use outcome-phrased headings that age badly or are not grep-able.

Length cap: each `###` section should stay under about 120 words.

Allowed top-level sections, ordered:

1. `Enhancements`
2. `Bug Fixes`
3. `Internal` only if user-observable
4. `Upgrade`

Skip empty sections.

Manifest `changelog` field:

- Use one string with real `\n` separators.
- Group with bold prefixes: `**Enhancements:**`, `**Bug Fixes:**`, `**Internal:**`.
- Keep it shorter than the MDX changelog because it prints in terminal during `trellis update`.

## Step 5: Determine Manifest Fields

| Field | How to decide |
|---|---|
| `breaking` | Any breaking API or behavior change. Default `false` for patch/prerelease fixes. |
| `recommendMigrate` | Any rename/delete migration the user should run. Default `false` for patch fixes. When `breaking=true` and `recommendMigrate=true`, `trellis update` exits 1 without `--migrate`. |
| `migrations` | List of `rename`, `rename-dir`, `delete`, or `safe-file-delete` actions. Usually `[]` for patch fixes. |
| `migrationGuide` | Mandatory when `breaking=true` and `recommendMigrate=true`. Human migration guide inserted into the generated migration task PRD. |
| `aiInstructions` | Strongly recommended with `migrationGuide`. Instructions for AI migration assistance. |
| `notes` | Brief terminal guidance shown during update. |

Breaking releases without `migrationGuide` produce a broken upgrade experience. `packages/cli/scripts/create-manifest.js` validates this.

## Step 5a: Per-Migration Entry Fields

| Field | Purpose | Required |
|---|---|---|
| `type` | `rename`, `rename-dir`, `delete`, or `safe-file-delete` | yes |
| `from` | Source path relative to project root | yes |
| `to` | Target path | yes for renames |
| `description` | What the migration does, shown in the confirm prompt | recommended |
| `reason` | Version-specific context for modified-file prompts | optional |
| `allowed_hashes` | Known-pristine SHA256 hashes for safe deletion | required for `safe-file-delete` |

`rename` uses the project-local `.trellis/.template-hashes.json`; it does not use manifest `allowed_hashes`.

Use:

- `rename` when a file moved and has a replacement path.
- `safe-file-delete` when a file was removed and has no replacement.
- `safe-file-delete` plus `notes` when a removed file was folded into another command.

## Step 6: Create Manifest

Pipe JSON through stdin:

```bash
cat <<'EOF' | node packages/cli/scripts/create-manifest.js
{
  "version": "<version>",
  "description": "<short description>",
  "breaking": false,
  "recommendMigrate": false,
  "changelog": "<changelog text with real newlines>",
  "notes": "<notes>",
  "migrations": []
}
EOF
```

For breaking releases with many rename entries, generate the entries with a small temporary Node script and pipe the final JSON into `create-manifest.js`.

## Step 7: Create Docs-Site Changelogs

This step is mandatory for every release.

Create both files:

1. `docs-site/changelog/v<version>.mdx`
2. `docs-site/zh/changelog/v<version>.mdx`

Use the format from recent changelog files. English and Chinese structure must match 1:1.

Update `docs-site/docs.json`:

- Add `"changelog/v<version>"` to the English changelog pages list at the top.
- Add `"zh/changelog/v<version>"` to the Chinese changelog pages list at the top.
- Update navbar changelog links to the new version.

When a `<Note>` or `<Warning>` block contains a markdown list, the closing tag must start at column 0:

```mdx
<Note>
- bullet
</Note>
```

## Step 8: Docs Lifecycle

The docs-site root path is stable. Development cycles live under `beta/` or `rc/`.

| Transition | Script | When |
|---|---|---|
| Start a new beta | `docs-site/scripts/docs-beta-start.sh` | Before the first beta of a new minor/major, for example `0.6.0-beta.0`. |
| Beta to RC | `docs-site/scripts/docs-beta-to-rc.sh` | Before the first rc, for example `0.6.0-rc.0`. |
| RC to GA | `docs-site/scripts/docs-promote.sh` | Before `pnpm release:promote`. |

Per-patch releases (`-beta.1`, `-rc.1`, `0.5.1`) do not run lifecycle scripts. Write changelog MDX, update `docs.json`, commit/push docs-site, then bump the main repo submodule pointer.

Full reference: `.trellis/spec/docs-site/docs/release-lifecycle.md`.

## Step 9: Preflight Before Release

Run local verification only; do not publish locally.

```bash
node packages/cli/scripts/check-docs-changelog.js --type <beta|rc|promote>
node packages/cli/scripts/release-preflight.js check-versions
node packages/cli/scripts/release-preflight.js verify-packed-cli
node packages/cli/scripts/release-preflight.js publish-plan
pnpm lint
pnpm typecheck
pnpm test
```

Skip `check-docs-changelog` only for stable patch releases where that command is not required by the release type.

## Step 10: Review and Confirm

Verify:

1. `packages/cli/src/migrations/manifests/<version>.json` exists and has valid JSON.
2. Manifest `changelog` renders as real newlines.
3. Both docs-site changelog MDX files exist and match 1:1.
4. Docs-site submodule commit is pushed before the main repo pointer commit.
5. `@mindfoldhq/trellis` and `@mindfoldhq/trellis-core` versions still match.

## Step 11: Publish Through CI

Use the project release script so the tag starts CI:

```bash
pnpm release
pnpm release:beta
pnpm release:rc
pnpm release:promote
```

After CI succeeds, verify public npm:

```bash
npm view @mindfoldhq/trellis@<version> version dist-tags --json --registry=https://registry.npmjs.org/
npm view @mindfoldhq/trellis-core@<version> version dist-tags --json --registry=https://registry.npmjs.org/
```

If CI fails or npm visibility is wrong, fix the workflow/scripts and re-run the CI path. Do not use local publish to fill the gap.

## Dogfooding

Breaking releases must run end-to-end migration in a throwaway directory:

```bash
mkdir /tmp/migrate-test && cd /tmp/migrate-test && git init -q .
npx -y @mindfoldhq/trellis@<last-ga> init -y -u test --claude --cursor --<platforms>
node <repo>/packages/cli/dist/cli/index.js update --migrate --dry-run
yes | node <repo>/packages/cli/dist/cli/index.js update --migrate --force
yes | node <repo>/packages/cli/dist/cli/index.js update
```

Watch for orphan files, idempotency churn, and backup bloat.
