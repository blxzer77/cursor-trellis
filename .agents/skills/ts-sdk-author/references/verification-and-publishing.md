# Verification & Publishing — End-to-End SDK Release Engineering

This reference covers everything between "the build succeeded on my machine" and "users can `npm install` it without a paper cut." It is opinionated, code-heavy, and tool-by-tool.

For `exports` field shape, see `package-json-exports.md`. For bundler config (tsdown / tsup / unbuild), see `tsdown-bundling.md`. This document assumes the build already produced `dist/`.

---

## 1. Overview — The Three Pillars

A defensible SDK release rests on three pillars. Skip any one and you ship paper cuts.

| Pillar                              | Tooling                                  | Question Answered                                                  |
| ----------------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| **(a) Build artifact verification** | `publint`, `@arethetypeswrong/cli`, smoke tests | "Does the tarball actually work in Node CJS / Node ESM / bundlers / Deno / Bun?" |
| **(b) Version & changelog mgmt**    | `changesets`, semver, npm `dist-tag`     | "What changed since the last release, and what version reflects it?" |
| **(c) Publish flow**                | GitHub Actions, `changesets/action`, npm provenance | "How does the package reach users from a green CI build, attestably?" |

Everything below maps to one of these three pillars. CI must enforce **all** of them — local discipline is necessary but not sufficient.

The minimum gate for any production SDK:

```bash
pnpm build           # produce dist/
pnpm test            # unit + integration
pnpm publint         # static checks on package.json + dist/
pnpm attw --pack     # types resolution across runtimes/resolvers
pnpm pack --dry-run  # show what ships
```

Then `changesets` orchestrates (b) and `changesets/action` orchestrates (c).

---

## 2. Pre-Publish Verification: `publint`

**One-liner:** `publint` is a static linter for the package you are about to publish. It catches misconfigurations in `package.json` and `dist/` that npm will accept but consumers will hit at install time.

It does not run code. It reads `package.json`, walks the `exports`/`main`/`module`/`types` map, opens each referenced file, and applies a rule catalog.

### Wiring

```jsonc
// package.json
{
  "scripts": {
    "lint:publish": "publint --strict",
    "prepublishOnly": "pnpm build && pnpm lint:publish && pnpm attw --pack"
  },
  "devDependencies": {
    "publint": "^0.3.0"
  }
}
```

`prepublishOnly` runs automatically on `npm publish` and `pnpm publish`. **It does not run on `yarn publish` before yarn 4** — so don't rely on it as your only gate; gate in CI too.

### Key commands

| Command                            | What it does                                                                |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `publint`                          | Lint the current package; report warnings + errors                          |
| `publint --strict`                 | Treat warnings as errors (use this in CI and `prepublishOnly`)              |
| `publint ./packages/foo`           | Lint a specific package in a monorepo                                       |
| `publint --pack pnpm`              | Use `pnpm pack` to materialize the tarball before linting (most accurate)   |
| `npx publint <pkg-name>`           | Lint a published package from the registry (auditing a dependency)         |

### Rule catalog

The full rule set lives at <https://publint.dev/rules>. The high-value rules grouped by severity:

**Errors (must fix before publishing):**

- `IMPLICIT_INDEX_JS_INVALID_FORMAT` — `main` resolves to `index.js` but file content's format mismatches `type` field.
- `FILE_DOES_NOT_EXIST` — `main`/`module`/`types` points at a file not in the tarball. Most common cause: forgot to list `dist` in `files`.
- `FILE_INVALID_FORMAT` — file uses CJS but `type: "module"` (or vice-versa).
- `EXPORTS_VALUE_INVALID` — `exports` value doesn't start with `./`.
- `EXPORTS_GLOB_NO_MATCHED_FILES` — pattern like `"./components/*": "./dist/components/*.js"` matches zero files.
- `USE_EXPORTS_BROWSER` — using top-level `browser` field; should be a condition inside `exports`.
- `USE_TYPE_MODULE` — package contains `.js` ESM files but has no `type: "module"` (Node will treat them as CJS).

**Warnings (should fix):**

- `TYPES_NOT_EXPORTED` — `exports` exposes a runtime file but no `types` condition; consumers get `any`.
- `EXPORTS_TYPES_INVALID_FORMAT` — `types` condition order wrong (`types` must come **first** in each condition object).
- `MODULE_SHOULD_BE_ESM` — `module` field exists but points at CJS.
- `FIELD_INVALID_VALUE_TYPE` — `keywords` is a string, `files` is missing, etc.
- `DEPRECATED_FIELD_JSNEXT` — uses `jsnext:main` (long-deprecated).

### Common failures and fixes

```jsonc
//  WRONG — types condition out of order, will silently break TS consumers
"exports": {
  ".": {
    "import": "./dist/index.mjs",
    "types": "./dist/index.d.ts"   //  must be first
  }
}

//  RIGHT
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.cjs"
  }
}
```

```jsonc
//  WRONG — dist/ not shipped
"files": ["src", "README.md"]

//  RIGHT
"files": ["dist", "README.md", "LICENSE"]
```

**Verify what `npm publish` will actually upload** before publishing:

```bash
npm pack --dry-run
# Lists every file, prints unpacked size.
# Anything not in this list will NOT reach consumers.
```

---

## 3. Pre-Publish Verification: `@arethetypeswrong/cli` (attw)

**One-liner:** `attw` simulates how every major TS resolver — Node10, Node16/NodeNext (CJS), Node16/NodeNext (ESM), bundler — resolves your package's types and runtime, and tells you where they disagree.

This is the single highest-leverage tool for hybrid CJS+ESM packages. If you publish dual-format and you do not run `attw` in CI, you will ship broken types.

### Install + wire

```bash
pnpm add -D @arethetypeswrong/cli
```

```jsonc
{
  "scripts": {
    "attw": "attw --pack . --profile node16",
    "prepublishOnly": "pnpm build && publint --strict && pnpm attw"
  }
}
```

### Key commands

| Command                                       | What it does                                                                          |
| --------------------------------------------- | ------------------------------------------------------------------------------------- |
| `attw --pack .`                               | Run `npm pack`, then check the tarball (most accurate — checks what ships)            |
| `attw --pack . --profile node16`              | Use the Node16 / NodeNext profile (modern; what most apps now use)                    |
| `attw --pack . --profile esm-only`            | If your package is ESM-only, assert no CJS resolution paths exist                     |
| `attw your-pkg@1.2.3`                         | Check a published version from npm                                                    |
| `attw --pack . --ignore-rules cjs-resolves-to-esm` | Suppress a specific rule (use only with reasoning, e.g., intentional ESM-only) |
| `attw --pack . --format json`                 | Machine-readable; feed into CI annotations                                            |

### Resolution modes attw simulates

| Mode               | Used by                                            | Reads which field/condition                  |
| ------------------ | -------------------------------------------------- | -------------------------------------------- |
| **node10**         | TS `moduleResolution: "node"` (old default)        | `main`, `types`, and `typesVersions`         |
| **node16-cjs**     | TS `moduleResolution: "node16"`, CJS importer      | `exports[".".require.types]` then `.require` |
| **node16-esm**     | TS `moduleResolution: "node16"`, ESM importer      | `exports[".".import.types]` then `.import`   |
| **bundler**        | TS `moduleResolution: "bundler"` (Vite, webpack)   | `exports[".".types]` + first matching cond.  |

### Common failure modes

The full catalog: <https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/README.md>

| Problem                        | Symptom                                                                              | Fix                                                                                              |
| ------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ |
| **Masquerading as CJS**        | File extension `.js` + `type: "commonjs"` but contains ESM (`import` keyword)        | Build to `.mjs` for ESM output, OR set `type: "module"` + build CJS to `.cjs`                    |
| **Masquerading as ESM**        | File extension `.js` + `type: "module"` but contains `require()` calls               | Build CJS to `.cjs` extension                                                                    |
| **FalseCJS** / **FalseESM**    | Types say one thing, runtime delivers another (e.g., `.d.ts` exports class, `.js` exports default + class but bundled wrong) | Use `.d.cts` for CJS types and `.d.mts` for ESM types; let bundler emit both                 |
| **Missing Resolution**         | `exports` has a `require` condition but no `.cjs` types alongside                    | Add a `.d.cts` next to every `.cjs`                                                              |
| **NoResolution**               | A resolver can't find the package entry at all                                       | Add the missing condition (`require` for CJS consumers, `import` for ESM)                        |
| **CJS-only / ESM-only types**  | You publish both runtimes but only one type file                                     | Emit both `.d.cts` and `.d.mts` (tsdown/tsup do this with `dts: true` + dual format)              |
| **Internal-resolution errors** | Your `dist/index.mjs` imports `./utils.js` but only `./utils.mjs` exists             | Match extensions in bundler output; modern bundlers handle this if configured correctly          |

### Reading attw output

```
┌───────────────────┬──────────────────────────────────────────┐
│                   │ "my-sdk"                                 │
├───────────────────┼──────────────────────────────────────────┤
│ node10            │ 🟢                                       │
│ node16 (from CJS) │ 🟢 (CJS)                                 │
│ node16 (from ESM) │ 🟢 (ESM)                                 │
│ bundler           │ 🟢                                       │
└───────────────────┴──────────────────────────────────────────┘
```

All green = ship it. Any red = consumer breakage. Yellow (⚠️) = warning, often Masquerading; investigate.

---

## 4. Build Output Smoke Tests

Static checks miss runtime issues. Run smoke tests against the actual tarball.

### In-tree smoke tests

```bash
# After pnpm build:
node --print "require('./dist/index.cjs').myFunction"
node --input-type=module -e "import('./dist/index.mjs').then(m => console.log(m.myFunction))"
```

Each command should print something other than `undefined`. If it prints `undefined`, your `exports` map or your bundler's named-export emission is broken.

### Out-of-tree tarball test (the gold standard)

```bash
# 1. Pack
pnpm pack
# Produces my-sdk-1.0.0.tgz

# 2. Install in a throwaway directory
mkdir /tmp/smoke-test && cd /tmp/smoke-test
npm init -y
npm install /path/to/my-sdk-1.0.0.tgz

# 3. CJS consumer
node --print "require('my-sdk').myFunction.toString().slice(0, 50)"

# 4. ESM consumer
cat > test.mjs << 'EOF'
import { myFunction } from 'my-sdk';
console.log('OK:', typeof myFunction);
EOF
node test.mjs

# 5. TypeScript consumer
cat > test.ts << 'EOF'
import { myFunction } from 'my-sdk';
const x: ReturnType<typeof myFunction> = myFunction();
EOF
npx tsc --noEmit --strict --moduleResolution node16 --module nodenext test.ts
```

If any of these fail, **do not publish**. The published artifact will fail for users in exactly the same way.

### Automate in CI

```yaml
- name: "smoke test tarball"
  run: |
    pnpm build
    pnpm pack
    mkdir /tmp/smoke && cd /tmp/smoke
    npm init -y
    npm install $GITHUB_WORKSPACE/*.tgz
    node --print "require('my-sdk').version"
    node --input-type=module -e "import('my-sdk').then(m => { if (!m.version) process.exit(1); })"
```

---

## 5. Semver Refresher for SDK Authors

Semver: **MAJOR.MINOR.PATCH** plus optional **pre-release identifier** and **build metadata**.

```
1.2.3                  stable release
1.2.3-alpha.0          pre-release (alpha line)
1.2.3-beta.5           pre-release (beta line)
1.2.3-rc.1             pre-release (release candidate)
1.2.3+sha.abc1234      build metadata (ignored for precedence)
0.0.0-pr-123-sha-abc   ephemeral / snapshot release
```

### The MAJOR.MINOR.PATCH contract

| Bump  | When                                                                | Examples                                                              |
| ----- | ------------------------------------------------------------------- | --------------------------------------------------------------------- |
| MAJOR | Backwards-incompatible API change                                   | Removed an export, changed a function signature, raised Node min      |
| MINOR | Backwards-compatible feature addition                               | New optional parameter, new export, expanded enum                     |
| PATCH | Backwards-compatible bug fix                                        | Fixed wrong calculation, fixed type narrowing, perf improvement       |

**Internal-only "refactor" without observable change → no bump.** A changeset with bump type `none` (changesets supports the `---` empty-body form, but most teams just skip writing one).

### Pre-release identifiers

`1.0.0-alpha.0` precedes `1.0.0`. Precedence order:

```
1.0.0-alpha.0 < 1.0.0-alpha.1 < 1.0.0-beta.0 < 1.0.0-beta.5 < 1.0.0-rc.0 < 1.0.0
```

**Subtle:** `1.0.0-alpha` < `1.0.0-alpha.0` (no identifier < numeric identifier 0). Always include the trailing `.N` so the precedence is total.

### The `0.x` regime

Per semver §4: **anything `0.x.y` MAY break at any time.** Convention:

- `0.x.0` → breaking change (MINOR-position acts as MAJOR)
- `0.x.y` → non-breaking (PATCH-position acts as MINOR + PATCH combined)

This is what tools like `changesets` actually implement: in `0.x`, a "major" bump only bumps minor.

**ZeroVer (`0ver.org`)**: a movement to stay on `0.x` forever to avoid the social commitment of `1.0`. Popular projects on `0.x` for years: `npm`, `bun` (until 1.0), `htop`, `streamlit`. Don't follow this without intent — staying on `0.x` signals to enterprise users that the API is unstable.

**Bump to `1.0.0` when**: the public API is documented, the test surface is high, and you commit to semver discipline for breaking changes.

---

## 6. Pre-Release Channels & npm dist-tags

A **dist-tag** is a named pointer (like a git tag for npm) that resolves to a specific version. Every package has at least `latest`.

### The `latest` tag

`npm install pkg` resolves to `pkg@latest`. By default, `npm publish` writes to `latest`. **This is dangerous for pre-releases.**

### Convention tags

| Tag            | Meaning                                                      | Example consumer command                  |
| -------------- | ------------------------------------------------------------ | ----------------------------------------- |
| `latest`       | Current stable                                                | `npm install next`                        |
| `next`         | Next major's pre-release line                                 | `npm install @trpc/server@next`           |
| `beta`         | Beta channel of next major                                    | `npm install ai@beta`                     |
| `rc`           | Release candidate                                             | `npm install next@rc`                     |
| `canary`       | Bleeding-edge, every-commit                                   | `npm install next@canary`                 |
| `alpha`        | Earliest pre-release                                          | `npm install ai@alpha`                    |
| `experimental` | Off-roadmap experiments (React uses this)                     | `npm install react@experimental`          |
| `nightly`      | Daily build (less common in npm; common in Rust/CI)           | `npm install some-pkg@nightly`            |
| `snapshot`     | Ephemeral, per-PR / per-commit                                | `npm install ai@snapshot`                 |

### How resolution works

```bash
npm install pkg            # → pkg@latest
npm install pkg@beta       # → version pointed to by `beta` dist-tag
npm install pkg@1.2.3      # → exact version
npm install pkg@^1.2.3     # → highest 1.x.y >= 1.2.3 (and NOT pre-release)
```

**Critical:** npm's range matchers (`^`, `~`, `>=`) by default exclude pre-release versions. `^1.0.0` will NOT install `1.5.0-beta.0`. This is intentional and good — keeps stable users away from pre-releases.

### Managing dist-tags

```bash
# List current tags
npm dist-tag ls my-pkg
# latest: 1.4.2
# beta: 2.0.0-beta.3
# canary: 2.0.0-canary.47

# Add a tag (point it at an existing version)
npm dist-tag add my-pkg@1.4.1 stable-legacy

# Remove a tag (does NOT unpublish the version)
npm dist-tag rm my-pkg beta

# Publish with a non-latest tag
npm publish --tag beta
pnpm publish --tag canary --no-git-checks
```

### **Never publish a pre-release to `latest`**

```bash
# WRONG — publishes 2.0.0-beta.0 as `latest`, every `npm install pkg` now gets a beta
npm publish

# RIGHT
npm publish --tag beta
```

**Recovery** if you accidentally tagged a pre-release as `latest`:

```bash
# 1. Re-point latest at the previous stable
npm dist-tag add my-pkg@1.4.2 latest

# 2. Re-tag the pre-release where it belongs
npm dist-tag add my-pkg@2.0.0-beta.0 beta

# 3. Communicate (Twitter, Discord, GitHub release notes) — installs between
#    the bad publish and the fix may have pulled the beta as latest.
```

You **cannot** unpublish (with rare exceptions, see §12). You can only re-point tags and `npm deprecate` the bad version.

---

## 7. The Full Lifecycle: alpha → beta → rc → stable → next-cycle

### Stage definitions

| Stage      | Purpose                                              | API stability      | Audience               | Soak time before next |
| ---------- | ---------------------------------------------------- | ------------------ | ---------------------- | --------------------- |
| **alpha**  | Internal / feature-spike, dogfood                    | None — anything moves | Maintainers, design partners | Days to weeks         |
| **beta**   | Feature-complete; gathering real-world feedback      | API may shift on signal | Early adopters         | Weeks                 |
| **rc**     | Frozen; blocker-only fixes                            | Locked              | Production-curious users | 1–2 weeks typical     |
| **stable** | Production-ready (`latest` tag)                       | Locked              | Everyone               | Until next major      |
| **patch**  | Bug fixes on the stable line                          | Locked              | Everyone               | Continuous            |

### State diagram

```
                ┌────────────────────────────────────────────────┐
                │  v1.0.0 stable line                            │
                │                                                │
                │   1.0.0 ──► 1.0.1 ──► 1.0.2 ──► 1.1.0 ──► …   │
                │                                                │
                └─────────────────┬──────────────────────────────┘
                                  │
                          new major branch
                                  │
                                  ▼
   2.0.0-alpha.0 ─► 2.0.0-alpha.5 ─┐
                                   │ feature freeze
                                   ▼
   2.0.0-beta.0 ─► 2.0.0-beta.7 ─┐
                                 │ API freeze
                                 ▼
   2.0.0-rc.0 ─► 2.0.0-rc.2 ─┐
                             │ blocker-free + soak passed
                             ▼
   2.0.0  ────────────────► (tag `latest` → 2.0.0)
                             │
                             ▼
   2.0.0 ──► 2.0.1 ──► 2.0.2 ──► 2.1.0 ──► …  (new stable line, repeat)


   Parallel:                            (Meanwhile, on `release/1.x` branch)
   1.0.2 ──► 1.0.3 ──► 1.0.4 ──► …      patches on previous stable
```

### Transition triggers

| Transition          | Trigger                                                                          |
| ------------------- | -------------------------------------------------------------------------------- |
| alpha → beta        | Feature freeze: all planned features merged; no new API surface                  |
| beta → rc           | API freeze: no more design changes; only blocker bugs                            |
| rc → stable         | Zero P0/P1 open + minimum soak period (commonly 7–14 days for the same rc.N)     |
| stable → stable.+1  | Bug fix, internal change, dependency security update                             |
| stable → next-cycle | New breaking change required → cut a new major-version branch, start alphas       |

### Branching strategy for multiple active lines

When `2.0.0` ships, you don't stop supporting `1.x` immediately. Use long-lived release branches:

```
main                  ← active development (next major: 3.0.0-alpha)
release/2.x           ← current stable line; patches: 2.0.1, 2.1.0
release/1.x           ← LTS / previous stable; patches: 1.4.5
```

Changesets on each branch:

- `main`: `pre enter alpha` for the new major.
- `release/2.x`: stable mode; bumps produce `2.0.1`, `2.1.0`, etc.
- `release/1.x`: stable mode; bumps produce `1.4.5`, etc. Set `baseBranch: "release/1.x"` in `.changeset/config.json` on this branch.

CI publishes from each branch with a different `--tag`:

- `main` → `--tag alpha` or `--tag canary`
- `release/2.x` → `--tag latest`
- `release/1.x` → `--tag lts` (or `1-lts`, `v1`, etc.)

---

## 8. Real-World SDK Release Cadence — Case Studies

All version numbers below are pulled from the npm registry as of 2026-05-13. `npm view <pkg> versions --json` and `npm view <pkg> dist-tags` confirm them.

### 8.1 Next.js (`next`)

**Strategy:** every-commit canary, weekly stable, parallel LTS branches.

- **Tags:** `latest`, `canary`, `rc`, `beta`, `backport`, plus historical lines (`next-15-3`, `next-14`, `next-13`, etc. — one per supported minor)
- Recent canary run (sample): `16.3.0-canary.0` → `16.3.0-canary.1` → … → `16.3.0-canary.19` (current)
- Stable cadence: `16.2.1` → `16.2.2` → `16.2.3` → `16.2.4` → `16.2.5` → `16.2.6` (`latest`)
- Pre-major: `15.0.0-rc.1`, current `16.0.0-beta.0`
- Install commands:
  ```bash
  npm install next             # 16.2.6 (latest)
  npm install next@canary      # 16.3.0-canary.19 (today's canary)
  npm install next@rc          # 15.0.0-rc.1
  npm install next@beta        # 16.0.0-beta.0
  npm install next@next-14     # 14.2.35 (LTS line)
  ```

Vercel's release script publishes a canary on **every merge to main**, then promotes a recent canary to stable weekly.

### 8.2 vercel/ai

**Strategy:** alpha + beta + canary triple-pre-release, snapshot per PR, parallel `ai-v5` and `ai-v6` major lines.

- **Tags:** `latest` (6.0.180), `alpha` (5.0.0-alpha.15), `beta` (7.0.0-beta.116), `canary` (7.0.0-canary.133), `snapshot` (0.0.0-bf6e4b15-20260402200305), `ai-v5` (5.0.188), `ai-v6` (6.0.132)
- Recent beta sequence: `7.0.0-beta.103` → `7.0.0-beta.104` → … → `7.0.0-beta.116`
- Then they cut canary: `7.0.0-canary.117` → `7.0.0-canary.118` → … → `7.0.0-canary.133`
- **Snapshot pattern:** PR-driven preview versions named `0.0.0-{sha}-{timestamp}` — installable as `npm install ai@0.0.0-bf6e4b15-20260402200305`. This lets PR authors test changes in real apps before merge.
- Install commands:
  ```bash
  npm install ai                # 6.0.180 (latest, v6 stable)
  npm install ai@ai-v5          # 5.0.188 (v5 LTS)
  npm install ai@beta           # 7.0.0-beta.116 (next major)
  npm install ai@canary         # 7.0.0-canary.133 (every-PR build)
  ```

### 8.3 tRPC (`@trpc/server`)

**Strategy:** `next` for major prereleases, alpha-tagged feature branches, parallel v10 LTS.

- **Tags:** `latest` (11.17.0), `next` (11.13.0), `canary` (11.16.1-canary.20), `v10` (10.45.4), plus feature-branch alphas like `tmp-main` (10.46.0-alpha-tmp-0202-nosideeffects-main.26)
- Recent cadence: `11.13.0` → `11.13.1` → `11.13.2` → `11.13.3` → `11.13.4` → `11.13.5-canary.0` → `11.13.5-canary.1` → … → `11.14.0` → `11.14.1-canary.0` → `11.14.1` → … → `11.17.0`
- Note the pattern: stable `11.X.0` ships, then `11.X.1-canary.N` accumulates, then stable `11.X.1` ships, then a new minor `11.(X+1).0` starts.
- They used `changesets pre enter beta` historically for v11; now use `next` tag for ongoing pre-releases.
- Install:
  ```bash
  npm install @trpc/server         # 11.17.0
  npm install @trpc/server@next    # 11.13.0 (next major preview / large feature)
  npm install @trpc/server@v10     # 10.45.4 (LTS)
  ```

### 8.4 Storybook

**Strategy:** `next` for the upcoming major, per-PR canaries, plus a tag-per-major LTS.

- **Tags:** `latest` (10.3.6), `next` (10.4.0-alpha.19), `canary` (`0.0.0-pr-34569-sha-67fab295`), plus `v7` (7.6.24), `v8` (8.6.18), `v9` (9.1.20), and per-major canaries (`v7-canary`, `v8-canary`, `v9-canary`).
- Recent next-line: `10.4.0-alpha.0` → `10.4.0-alpha.1` → … → `10.4.0-alpha.19`
- Recent stable: `10.3.0-beta.1` → `10.3.0-beta.2` → `10.3.0-beta.3` → `10.3.0` → `10.3.1` → … → `10.3.6` (current `latest`)
- The triple-track means users can stay on `latest`, opt into `next` for upcoming features, or pin to a major LTS tag.

### 8.5 Stripe Node SDK

**Strategy:** hand-rolled (no changesets), strict semver-major for breaking, monthly cadence.

- Single channel: `latest` only. No `beta` / `rc` / `canary`. Pre-releases are exceptional.
- Major bumps tied to Stripe API versions (e.g., when Stripe API ships a breaking change, the SDK bumps major).
- Lesson: if your SDK wraps an external API with its own versioning, your semver tracks **the SDK's surface**, not the API. Breaking changes to the wrapped API are MINOR if your SDK gates them behind opt-in, MAJOR if mandatory.

### Case study comparison

| Project    | Channels                                  | Per-PR builds        | LTS branches             | Tooling                  |
| ---------- | ----------------------------------------- | -------------------- | ------------------------ | ------------------------ |
| Next.js    | `latest`, `canary`, `rc`, `beta`          | No (canary = main)   | Yes (`next-15-3` etc.)   | Custom                   |
| vercel/ai  | `latest`, `alpha`, `beta`, `canary`, `snapshot` | Yes (`0.0.0-{sha}`)  | Yes (`ai-v5`, `ai-v6`)   | changesets               |
| tRPC       | `latest`, `next`, `canary`, `v10`         | Yes (canary)         | Yes (`v10`)              | changesets               |
| Storybook  | `latest`, `next`, `canary`, `v7..v9`      | Yes (`0.0.0-pr-N`)   | Yes (one tag per major)  | Custom + changesets-like |
| Stripe     | `latest` only                             | No                   | None public              | Hand-rolled              |

---

## 9. Changesets in Pre-Release Mode

**One-liner:** changesets is a workflow where each PR adds a small markdown file describing its impact, and a release pipeline aggregates those files into a version bump + changelog entry.

### Stable-mode flow (recap)

```bash
# 1. Author writes a changeset alongside their PR
pnpm changeset
# Interactive: pick affected packages, pick semver bump, write user-facing summary
# Produces .changeset/some-name.md:
#   ---
#   "@myorg/sdk": minor
#   ---
#   Added support for X
git add .changeset && git commit -m "feat: add X"

# 2. Release time (on main, in CI)
pnpm changeset version    # bump package.json versions + write CHANGELOG.md + delete .md files
pnpm changeset publish    # publish all bumped packages to npm
```

### Pre-release mode

`changesets pre enter <tag>` flips the repo into pre-release mode. While in pre-release mode, `changeset version` emits versions of the form `X.Y.Z-tag.N`.

```bash
# Enter beta mode
pnpm changeset pre enter beta
# Creates .changeset/pre.json — must be committed!

# Now write changesets as usual
pnpm changeset            # → .changeset/blue-cats-jump.md

# Version + publish
pnpm changeset version    # bumps "1.0.0" → "1.0.0-beta.0"
pnpm changeset publish    # auto-publishes with --tag beta (uses pre.json's tag)

# More changes → more changesets → next bump is 1.0.0-beta.1
# ...

# Exit pre-release mode
pnpm changeset pre exit
# Deletes .changeset/pre.json
git add .changeset && git commit -m "chore: exit beta"
# Next `pnpm changeset version` produces 1.0.0 (stable)
```

### `.changeset/pre.json` (the state file)

```json
{
  "mode": "pre",
  "tag": "beta",
  "initialVersions": {
    "@myorg/sdk": "0.9.4",
    "@myorg/utils": "0.9.4"
  },
  "changesets": ["blue-cats-jump", "wise-mountains-sing"]
}
```

This file tracks: the current pre-release tag, the initial version each package was at when pre mode started, and which changesets have already been applied. **Commit it. Do not edit it by hand** (changesets manages it).

### The canonical "beta → rc" transition

When beta-5 is feature-complete and API-frozen, cut `rc.0`:

```bash
pnpm changeset pre exit              # leave beta mode
pnpm changeset pre enter rc          # enter rc mode
pnpm changeset version               # bumps 1.0.0-beta.5 → 1.0.0-rc.0
pnpm changeset publish               # publishes with --tag rc
```

The version number resets the pre-release counter (`.5 → .0`) but keeps the underlying `1.0.0` target. Consumers on `@beta` are unaffected; new users must explicitly opt into `@rc`.

### The rc → stable transition

```bash
pnpm changeset pre exit              # leave rc mode
pnpm changeset version               # bumps 1.0.0-rc.2 → 1.0.0 (stable!)
pnpm changeset publish               # publishes with --tag latest
```

### GOTCHAs

- **Forgetting `pre exit` before stable.** Symptom: you wanted `1.0.0` but got `1.0.0-beta.6`. Recovery: `pnpm changeset pre exit`, then `pnpm changeset version` again. If you already published, delete the bad pre-release with `npm dist-tag rm` (the version stays in registry but is no longer pointed at).
- **Adding `pre enter` mid-PR.** Don't. Land `pre enter`/`pre exit` as their own commits so reviewers see the mode change.
- **Multi-package mismatch.** If one package is at `1.0.0-beta.3` and another at `0.5.2-beta.0`, that's fine — pre.json tracks each independently. But mixing modes (one in pre, one not) is impossible because pre.json is repo-wide.
- **Changing pre tag mid-cycle.** To go from `alpha` to `beta`, you must `pre exit` then `pre enter beta`. There is no `pre switch`.
- **Snapshot releases**: `changeset version --snapshot pr-123` emits versions like `0.0.0-pr-123-20260513120000` without consuming changesets — perfect for ephemeral per-PR builds. See §10.

---

## 10. GitHub Actions Release Pipeline

The `changesets/action` GitHub Action implements a "version PR" pattern: when there are pending changesets on `main`, it opens (or updates) a PR that bumps versions and writes the changelog. Merging that PR triggers publish.

### Minimal working pipeline

Source: <https://github.com/changesets/action> (README, verbatim shape):

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    branches:
      - main

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    name: Release
    runs-on: ubuntu-latest
    permissions:
      contents: write   # push commits / tags
      pull-requests: write   # open Version PR
      id-token: write   # npm provenance (see §11)
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0   # need full history for changesets

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
          registry-url: https://registry.npmjs.org

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Build
        run: pnpm build

      - name: Verify
        run: |
          pnpm publint --strict
          pnpm attw --pack

      - name: Create Release PR or Publish
        id: changesets
        uses: changesets/action@v1
        with:
          publish: pnpm changeset publish
          version: pnpm changeset version
          commit: "chore: version packages"
          title: "chore: version packages"
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### How the Version PR pattern works

1. Dev opens PR → adds `.changeset/foo.md` → merges to `main`.
2. Workflow runs on `main`. `changesets/action` sees a pending changeset and **no version PR exists**, so it opens one.
3. The Version PR's diff: bumps `package.json` version, updates `CHANGELOG.md`, deletes `.changeset/foo.md`.
4. More PRs land → workflow runs → updates the Version PR (it stays open and absorbs new changesets).
5. When you're ready, merge the Version PR. Workflow runs again — this time `.changeset/*.md` is empty, so `changeset publish` runs and pushes to npm.

The Version PR is your release approval gate — code review the changelog and version bumps before they ship.

### Pre-release mode in CI

For a long-running beta line, set up a separate branch:

```yaml
# .github/workflows/release-beta.yml
on:
  push:
    branches:
      - "release/2.x"   # or whatever your beta branch is called
```

Make sure `.changeset/pre.json` is **committed on that branch** so the workflow sees it.

### Snapshot releases (per-PR installable previews)

This is the pattern vercel/ai uses for `0.0.0-{sha}-{timestamp}` versions.

```yaml
# .github/workflows/snapshot.yml
name: Snapshot Release

on:
  pull_request:
    types: [labeled]   # only when someone adds the "snapshot" label

jobs:
  snapshot:
    if: github.event.label.name == 'snapshot'
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          registry-url: https://registry.npmjs.org

      - run: pnpm install --frozen-lockfile
      - run: pnpm build

      - name: Snapshot version + publish
        run: |
          pnpm changeset version --snapshot pr-${{ github.event.number }}
          pnpm changeset publish --tag pr-${{ github.event.number }} --no-git-checks
        env:
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Comment on PR
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              owner: context.repo.owner,
              repo: context.repo.repo,
              issue_number: context.issue.number,
              body: `Snapshot published! \n\`\`\`\nnpm install my-sdk@pr-${{ github.event.number }}\n\`\`\``
            })
```

Output version looks like `0.0.0-pr-123-20260513120000`. Consumer installs it via `npm install my-sdk@pr-123` (the dist-tag) or pins to the exact version.

### Branching summary

| Branch          | Workflow         | Outcome                                         |
| --------------- | ---------------- | ----------------------------------------------- |
| `main`          | release.yml      | Open Version PR or publish stable → `latest`    |
| `release/N.x`   | release-beta.yml | Publish pre-release → `beta` / `rc` / `next`    |
| PR with label   | snapshot.yml     | Publish snapshot → `pr-{N}` dist-tag            |

---

## 11. npm Provenance

**One-liner:** Provenance is a signed attestation that this exact tarball was built from this exact git commit, in a specified GitHub Actions workflow run.

Provenance ties the npm release to a verifiable build pipeline. Consumers can check it; supply-chain auditors love it.

### Enable in `package.json`

```jsonc
{
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

### Requirements

1. Publishing must happen from a public CI provider that supports OIDC (currently npm officially supports GitHub Actions and GitLab CI).
2. Repository must be **public** OR you're on an npm paid plan.
3. Workflow needs `permissions: id-token: write`.
4. Must use npm CLI 9.5+ (`npm publish`) or pnpm 8+ (`pnpm publish`).

### What gets attested

- The git repository URL
- The exact commit SHA
- The workflow file path and the workflow run ID
- The build environment (runner OS, Node version)
- A hash of the tarball contents

### Consumer-side verification

```bash
# Show provenance info for a package version
npm view my-sdk@1.2.3

# Or use the audit signature command
npm audit signatures
# Verifies provenance attestations of all installed packages
```

npm's website also shows a "Provenance" badge on each version's page, linking back to the GitHub Actions run that produced it.

### Common pitfall

Forgetting `permissions: id-token: write` in the workflow. Symptom: `npm publish` fails with `Unable to authenticate, need: OIDC token, OIDC ID token request failed`. Fix: add the permission block.

---

## 12. Yanking & Deprecation

You shipped a broken version. What now?

### `npm deprecate` — the right tool, 99% of the time

```bash
npm deprecate my-sdk@1.2.3 "Critical regression in fetch wrapper; upgrade to 1.2.4"
# Adds a deprecation warning shown on every install of that version
# Does NOT remove the version — old lockfiles still work
```

Wildcard supported:

```bash
npm deprecate my-sdk@"<1.2.4" "Multiple bugs fixed in 1.2.4"
```

To un-deprecate:

```bash
npm deprecate my-sdk@1.2.3 ""
# Empty message clears the deprecation
```

### `npm unpublish` — last resort

```bash
npm unpublish my-sdk@1.2.3 --force
```

**Restrictions:**

- Allowed within 72 hours of publish, no questions asked.
- After 72 hours, only if: no other packages depend on this version AND fewer than 300 weekly downloads AND only one maintainer.
- Otherwise: file a support ticket with npm.
- Unpublishing **breaks** lockfiles that reference the removed version. This is why deprecation is preferred.

### Choosing yank vs supersede for pre-releases

- **Buggy stable release**: deprecate the bad version, ship a patch superseding it. Never unpublish.
- **Buggy pre-release version (beta.5 with show-stopper bug)**: deprecate AND `npm dist-tag rm` so `@beta` doesn't resolve to it, then immediately publish `beta.6` with the fix.
- **Pre-release that exposed a security issue**: deprecate, then publish the fix to a new pre-release.
- **Snapshot/canary version with a vulnerable transitive dep**: usually fine to leave alone (snapshots aren't pinned in production lockfiles), but deprecate if it survives in a downstream lockfile.

---

## 13. Decision Tree: Picking Your Release Strategy

```
Q1: Is your library < 1.0?
   ├─ Yes → stay on `0.x.y`. Breaking changes bump MINOR (changesets handles this).
   │        Single `latest` tag is enough until 1.0.
   │        Skip to Q4.
   └─ No → continue

Q2: Do you have paying / enterprise users on the current major?
   ├─ Yes → mandatory rc + soak period (≥1 week of rc.N before stable)
   │        Maintain LTS branch (`release/N.x`) for at least one major back.
   │        Use 4 channels: `latest`, `next`, `rc`, `beta`.
   │        Continue to Q3.
   └─ No → 2 channels is enough: `latest` + `beta` (or `next`).

Q3: Do you ship code on every PR merge?
   ├─ Yes → add `canary` (or `next`) channel: publish on every push to main.
   │        Optionally add `snapshot` for per-PR previews.
   └─ No → weekly or biweekly release cadence; no canary needed.

Q4: Does your library have plugin / extension authors?
   ├─ Yes → in each release's changelog, explicitly call out plugin-API
   │        breaking changes under their own heading.
   │        Consider a separate plugin-compat tag (e.g., `compat-v3`).
   └─ No → standard changelog is fine.

Q5: Do you target multiple runtimes (Node, Bun, Deno, browser)?
   ├─ Yes → attw `--pack` and a smoke test PER runtime in CI.
   │        Bun: `bun add ./tarball.tgz && bun test`
   │        Deno: `deno run --allow-all npm:my-sdk@1.0.0`
   │        Browser: build a min repro in StackBlitz / use Playwright.
   └─ No → attw in `node16-cjs` + `node16-esm` modes is enough.
```

---

## 14. Anti-Patterns

| Anti-pattern                                                              | Why bad                                                              | Fix                                                                          |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Publishing a pre-release to `latest`                                      | `npm install pkg` now gives users a beta they didn't ask for         | Always `--tag <pre>`. Set `publishConfig.tag` in changeset for pre branches  |
| Breaking change in a PATCH bump                                           | Violates semver; consumers' `^x.y.z` ranges silently break           | Bump MAJOR; if you forgot, deprecate and re-release as MAJOR                 |
| First publish of a scoped package without `--access public`               | npm refuses to publish (scoped defaults to private = paid)           | `"publishConfig": { "access": "public" }` in package.json                    |
| Forgetting `pnpm changeset pre exit` before stable                        | Stable release becomes another beta version                          | Always `pre exit` as its own commit before the stable Version PR             |
| No `attw --pack` in CI                                                    | Type errors shipped for half your consumers                          | Wire `attw` into `prepublishOnly` AND CI; treat warnings as errors           |
| Editing `.changeset/pre.json` by hand                                     | State drift between local and remote; future bumps misbehave         | Only manage via `pre enter` / `pre exit`                                     |
| `npm unpublish` as a first response                                       | Breaks lockfiles downstream; relationship damage                     | `npm deprecate` + ship a patch superseding the bad version                   |
| Releasing without `publint`                                               | `exports` map silently broken for 30% of users                       | `publint --strict` in `prepublishOnly` and CI                                |
| Auto-publishing on every commit to main without a Version PR              | No human approval gate; changelog mistakes ship                      | Use `changesets/action` Version PR pattern                                   |
| Missing `permissions: id-token: write` in workflow with provenance enabled | Publish fails with cryptic OIDC error                                | Add the permissions block; double-check in the publish step's job context    |
| Not pinning `pnpm`/`npm` version in `packageManager` field                | CI uses one version locally, another version in Actions; lockfile churn | Set `"packageManager": "pnpm@9.x.x"` in root package.json                |
| Treating `0.x` as production-safe                                         | Consumers think `^0.5.0` is stable; you ship breaking 0.6.0          | Either commit to semver (cut 1.0) or be explicit in README about 0.x policy  |

---

## 15. Quick Reference Card

```bash
# === Pre-publish verification ===
pnpm build
pnpm publint --strict
pnpm attw --pack
pnpm pack --dry-run                       # what will ship?

# === Out-of-tree smoke test ===
pnpm pack
( cd /tmp && rm -rf st && mkdir st && cd st && npm init -y && \
  npm install $OLDPWD/*.tgz && \
  node --print "require('my-sdk').default" )

# === Changesets — stable ===
pnpm changeset                            # author a changeset
pnpm changeset version                    # apply bumps + write changelog
pnpm changeset publish                    # publish to npm

# === Changesets — pre-release ===
pnpm changeset pre enter beta             # enter beta mode
pnpm changeset                            # write changeset
pnpm changeset version                    # bumps to X.Y.Z-beta.N
pnpm changeset publish                    # publishes --tag beta
pnpm changeset pre exit                   # exit pre-mode
pnpm changeset version                    # next bump is stable

# === Snapshot release (per-PR) ===
pnpm changeset version --snapshot pr-${PR}
pnpm changeset publish --tag pr-${PR} --no-git-checks

# === Dist-tag management ===
npm dist-tag ls my-pkg
npm dist-tag add my-pkg@1.2.3 latest
npm dist-tag rm my-pkg beta
npm publish --tag beta
npm publish --tag canary --provenance

# === Yank / fix ===
npm deprecate my-pkg@1.2.3 "Use 1.2.4+"
npm dist-tag add my-pkg@1.2.4 latest      # repoint if mis-tagged
```

---

## References

- publint rules: <https://publint.dev/rules>
- attw problem catalog: <https://github.com/arethetypeswrong/arethetypeswrong.github.io/blob/main/docs/problems/README.md>
- changesets pre-releases: <https://github.com/changesets/changesets/blob/main/docs/prereleases.md>
- changesets dist-tags: <https://github.com/changesets/changesets/blob/main/docs/dist-tags.md>
- changesets snapshot releases: <https://github.com/changesets/changesets/blob/main/docs/snapshot-releases.md>
- npm dist-tag CLI: <https://docs.npmjs.com/cli/v10/commands/npm-dist-tag>
- npm deprecate CLI: <https://docs.npmjs.com/cli/v10/commands/npm-deprecate>
- npm provenance: <https://docs.npmjs.com/generating-provenance-statements>
- changesets/action: <https://github.com/changesets/action>
- vercel/ai release workflow: <https://github.com/vercel/ai/tree/main/.github/workflows>
- tRPC changesets config: <https://github.com/trpc/trpc/blob/main/.changeset/config.json>
- Semver spec: <https://semver.org/>
- ZeroVer: <https://0ver.org/>
