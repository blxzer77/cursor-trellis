# Create Migration Manifest

Create a migration manifest for a new patch/minor release based on commits since the last release.

## Arguments

- `$ARGUMENTS` — Target version (e.g., `0.3.1`). If omitted, ask the user.

## Steps

### Step 1: Identify Last Release

```bash
# Find the last release tag and its commit
git tag --sort=-v:refname | head -5
```

Pick the most recent release tag (e.g., `v0.3.0`).

### Step 2: Gather Changes

```bash
# Show all commits since last release
git log <last-release-tag>..HEAD --oneline

# Show src/ changes only (skip .trellis/, docs, chore)
git log <last-release-tag>..HEAD --oneline -- src/
```

### Step 3: Analyze Each Commit

For each commit that touches `src/`:
1. Read the diff: `git diff <parent>...<commit> -- src/ --stat`
2. Classify: `feat` / `fix` / `refactor` / `chore`
3. Write a one-line changelog entry in conventional commit style

### Step 4: Draft Changelog

Organize entries into sections:

```
**Enhancements:**
- feat(scope): description

**Bug Fixes:**
- fix(scope): description
```

### Step 5: Determine Manifest Fields

| Field | How to decide |
|-------|---------------|
| `breaking` | Any breaking API/behavior change? Default `false` for patch |
| `recommendMigrate` | Any file rename/delete migrations? Default `false` for patch |
| `migrations` | List of `rename`/`rename-dir`/`delete` actions. Usually `[]` for patch |
| `notes` | Brief guidance for users (e.g., "run `trellis update` to sync") |

### Step 6: Create Manifest

```bash
node scripts/create-manifest.js -y \
  --version "<version>" \
  --description "<short description>" \
  --changelog "<changelog>" \
  --notes "<notes>"
```

**IMPORTANT**: The `-y` flag passes `\n` as literal backslash-n through the shell. After creation, **always read the file and fix double-escaped `\\n` → `\n`** if needed using the Edit tool.

### Step 7: Review and Confirm

1. Read the generated file: `src/migrations/manifests/<version>.json`
2. Verify the JSON is valid and `\n` renders as actual newlines
3. Show the final manifest to the user for confirmation

## Notes

- Patch versions (`X.Y.Z`) typically have `migrations: []` and `breaking: false`
- Only add `migrationGuide` and `aiInstructions` for breaking changes
- Changelog should cover ALL `src/` changes, not just the latest commit
