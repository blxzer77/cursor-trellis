# Workspace and Layout

## 1. Overview

This reference covers how to lay out a pnpm-based workspace for a TypeScript SDK project: which top-level directories to use (`apps/`, `packages/`, `tools/`), where the SDK itself lives, how to create internal workspace packages with `workspace:*` deps, and how to migrate from a multi-repo setup. Build orchestration (`turbo.json`), the `exports` field, and npm publishing are intentionally out of scope — see `turborepo-for-sdk.md` and the publishing references for those topics.

---

## 2. Workspace Top-Level Layout

A pnpm workspace for an SDK project should converge on three top-level directories. Start here unless you have a strong reason not to:

```text
repo/
├── apps/
│   └── cli/
├── packages/
│   ├── sdk-core/
│   ├── adapter-openai/
│   ├── shared-types/
│   ├── eslint-config/
│   └── typescript-config/
├── tools/
│   └── dev-scripts/
├── package.json
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

### Core principles

1. **`apps/` contains deployables or executables.** CLIs, web apps, desktop apps, services — anything you actually run — belong here.
2. **`packages/` contains reusable logic.** Anything imported by another package belongs here. **This is where your SDK lives.**
3. **`tools/` contains repo-local utilities.** Code generators, release helpers, migration scripts, local maintenance commands. Not runtime SDK code.
4. **One purpose per package.** Each package answers one clear question.
5. **No nested catch-all workspaces.** Avoid `packages/**`.
6. **Root is orchestration only.** Repo tooling belongs in root; application logic does not.

### When to use each

| Directory   | Holds                                       | Examples                                       | Don't put here                          |
|-------------|---------------------------------------------|------------------------------------------------|-----------------------------------------|
| `apps/`     | Executables, deployables, app shells        | `apps/cli`, `apps/web`, `apps/desktop`         | Anything imported by another package    |
| `packages/` | Reusable libraries (SDK, types, adapters)   | `packages/sdk-core`, `packages/adapter-openai` | A bundle of unrelated utilities         |
| `tools/`    | Repo-local scripts not consumed at runtime  | `tools/dev-scripts`, `tools/codegen`           | Anything the SDK imports                |

**Rule of thumb:** If the published SDK or any app imports it at runtime, it belongs in `packages/`. If you only run it locally to maintain the repo, it belongs in `tools/`.

### `pnpm-workspace.yaml`

The minimum configuration:

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"
```

For npm/yarn/bun-style workspaces (if you must), put the same globs under the root `package.json`:

```json
{
  "workspaces": ["apps/*", "packages/*", "tools/*"]
}
```

Use extra globs only when you intentionally group packages by concern:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "packages/config/*"      # grouped configs
  - "packages/features/*"    # feature packages
```

**Avoid** recursive globs:

```yaml
# BAD: ambiguous discovery, encourages accidental nesting
packages:
  - "packages/**"
```

### Root `package.json`

```json
{
  "name": "my-sdk-repo",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

**Root rules:**

- `private: true` is required (you never publish the root).
- `packageManager` pins pnpm version across contributors.
- Scripts only delegate to the orchestrator — no actual build logic.
- Root dependencies are repo tools only (`turbo`, `husky`, `changesets`, etc.).
- App/SDK dependencies stay in the packages that use them.

**Bad** — runtime deps at the root:

```json
{
  "dependencies": {
    "openai": "^4",
    "chalk": "^5",
    "zod": "^3"
  }
}
```

**Good** — only tooling at the root:

```json
{
  "devDependencies": {
    "turbo": "latest",
    "husky": "latest"
  }
}
```

---

## 3. Where the SDK Package Lives

**The SDK always lives under `packages/`.** It is, by definition, a thing other code imports.

### Naming patterns

There is no single "right" name. Three common conventions:

| Pattern                         | Example                  | When to use                                                                 |
|---------------------------------|--------------------------|-----------------------------------------------------------------------------|
| `packages/<name>` (the SDK name) | `packages/stripe`        | The repo is the SDK; one obvious package; matches the public scoped name.   |
| `packages/core`                 | `packages/core`          | SDK is split into core + adapters; `core` is the entry point.               |
| `packages/<name>-core`          | `packages/sdk-core`      | Multiple SDK-flavored packages share a prefix; disambiguates from adapters. |
| `packages/sdk`                  | `packages/sdk`           | Repo hosts the SDK plus unrelated apps; `sdk` is the obvious folder.        |

Pick one and stay consistent. The folder name does **not** have to match the published name — the published name comes from `package.json#name` (e.g. `@acme/sdk`).

### SDK + CLI co-existence (the wrangler pattern)

Many SDKs ship a companion CLI for scaffolding, debugging, or invoking the SDK from a shell. Keep them as separate packages — the SDK in `packages/`, the CLI in `apps/`:

```text
repo/
├── apps/
│   └── cli/                # @acme/cli — the executable, depends on the SDK
├── packages/
│   ├── sdk-core/           # @acme/sdk — the library people import
│   ├── adapter-node/       # @acme/adapter-node — runtime adapter
│   └── shared-types/       # @acme/shared-types — type-only contracts
```

The CLI depends on the SDK via `workspace:*`:

```json
// apps/cli/package.json
{
  "name": "@acme/cli",
  "private": true,
  "bin": {
    "acme": "./dist/bin.js"
  },
  "dependencies": {
    "@acme/sdk": "workspace:*",
    "@acme/shared-types": "workspace:*"
  }
}
```

**Why split them:**

- The SDK can be consumed in environments where a CLI makes no sense (browsers, edge functions, other Node libraries).
- The CLI can take heavyweight dependencies (`chalk`, `commander`, `prompts`) without polluting the SDK's install size.
- Versioning, release cadence, and changelogs decouple naturally.

### Library packages, generally

Good shape of `packages/` for an SDK-centered repo:

```text
packages/
├── sdk-core/             # main SDK surface
├── adapter-openai/       # concrete adapter implementation
├── adapter-node/         # runtime-specific adapter
├── shared-types/         # types-only contracts
├── eslint-config/        # shared lint config
└── typescript-config/    # shared tsconfig presets
```

**Bad** — vague catch-alls that become dumping grounds:

```text
packages/
├── shared/
├── core/                 # contains everything
└── utils/                # contains anything that didn't fit elsewhere
```

```text
packages/
└── shared/
    ├── commands/
    ├── tools/
    ├── providers/
    ├── prompts/
    └── session/
```

A "shared" mega-package destroys ownership boundaries and forces every consumer to pull in unrelated transitive code.

---

## 4. Internal Package Creation Pattern

When you need a new internal workspace package, follow this checklist:

1. **Create the directory** under `packages/<name>/`.
2. **Add `package.json`** with a scoped name (`@<org>/<name>`), `version`, `private: true`, and an entry point.
3. **Add source code** in `src/`.
4. **Add `tsconfig.json`** (typically extending a shared config package).
5. **Install it as a dependency** in consuming packages using `workspace:*`.
6. **Run `pnpm install`** to update the lockfile.

### Step-by-step

```bash
# 1. Create the directory
mkdir -p packages/sdk-core/src

# 2. Initialize package.json (edit by hand or via pnpm init)
cd packages/sdk-core
cat > package.json <<'EOF'
{
  "name": "@acme/sdk",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "scripts": {
    "build": "tsc",
    "lint": "eslint .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
EOF

# 3. Write your code
cat > src/index.ts <<'EOF'
export function createClient(config: { apiKey: string }) {
  return { apiKey: config.apiKey };
}
EOF

# 4. Extend a shared tsconfig
cat > tsconfig.json <<'EOF'
{
  "extends": "@acme/typescript-config/library.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
EOF

# 5. From a consuming app, declare the dep
cd ../../apps/cli
pnpm add @acme/sdk@workspace:*

# 6. Install resolves the link
cd ../..
pnpm install
```

### `workspace:*` protocol

In pnpm and bun, internal workspace deps use the `workspace:` protocol:

```json
// apps/cli/package.json
{
  "name": "@acme/cli",
  "dependencies": {
    "@acme/sdk":         "workspace:*",   // always use whatever is in the workspace
    "@acme/shared-types": "workspace:^",  // local; respect ^semver when published
    "@acme/utils":        "workspace:~"   // local; respect ~semver when published
  }
}
```

| Specifier      | Effect                                                                        |
|----------------|-------------------------------------------------------------------------------|
| `workspace:*`  | Always use the local version. Rewritten to the published version on release.  |
| `workspace:^`  | Local in-tree. Published as `^X.Y.Z` matching the current local version.      |
| `workspace:~`  | Local in-tree. Published as `~X.Y.Z`.                                         |

For npm/yarn, the wire syntax is different — use `"*"` for internal deps:

```json
// npm/yarn workspaces — DO NOT use workspace: prefix
{ "@acme/sdk": "*" }
```

**Wrong:** mixing the prefixes:

```json
// BAD: npm/yarn workspaces don't understand "workspace:*"
{ "@acme/sdk": "workspace:*" }
```

### Installing into a specific package

Never install into the root for runtime deps. Filter installs by package:

```bash
# Add a runtime dep to one package
pnpm --filter @acme/adapter-openai add openai

# Add a dev dep to one package
pnpm --filter @acme/sdk add -D vitest

# Add a shared dev dep (turbo, husky) to the root only
pnpm add -D turbo -w
```

---

## 5. `package.json` Skeleton for Internal Packages

This is the **pre-publish** skeleton — i.e. a workspace-internal package consumed only by other workspace packages. The published-package skeleton (with full `exports` conditions, `files`, `publishConfig`) is covered in a separate reference.

### Minimal JIT package (TypeScript source as the entry point)

```json
{
  "name": "@acme/sdk",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  }
}
```

Use this when the package is consumed only by modern bundlers or by a build step that handles TypeScript. No build is required for downstream usage inside the workspace.

### Minimal compiled package (emits `dist/`)

```json
{
  "name": "@acme/sdk",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

Use this when:

- The package is consumed by Node directly.
- You want build caching.
- The package may be consumed by tests, bundlers, or other apps with different toolchains.

### Minimum directory layout

JIT:

```text
packages/sdk-core/
├── package.json
├── src/
│   └── index.ts
└── tsconfig.json
```

Compiled:

```text
packages/sdk-core/
├── package.json
├── src/
│   ├── index.ts
│   └── client.ts
├── dist/
└── tsconfig.json
```

### Per-package scripts, not root scripts

Each package defines its own lifecycle:

```json
// packages/adapter-openai/package.json
{
  "name": "@acme/adapter-openai",
  "scripts": {
    "build": "tsc",
    "lint": "eslint .",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

**Avoid** sequential root scripts that hard-code package order:

```json
// BAD
{
  "scripts": {
    "build": "cd packages/shared-types && tsc && cd ../sdk-core && tsc && cd ../../apps/cli && tsc"
  }
}
```

```json
// BAD: doesn't parallelize, can't be filtered
{
  "scripts": {
    "lint": "eslint apps/cli && eslint packages/sdk-core && eslint packages/adapter-openai"
  }
}
```

Per-package tasks let the orchestrator parallelize, cache, and filter precisely. See `turborepo-for-sdk.md` for the orchestration layer.

---

## 6. Type-Only vs Runtime Deps

A workspace-internal package can appear in three different dependency fields depending on what the consumer needs from it. Get this right or you'll ship phantom deps to npm later.

| Field              | When to use for an internal package                                                                                  |
|--------------------|----------------------------------------------------------------------------------------------------------------------|
| `dependencies`     | Consumer imports runtime values (functions, classes, constants) from the package and expects them at execution time. |
| `devDependencies`  | Consumer needs the package at build/test/lint time only (e.g. a shared eslint config, test fixtures, codegen).        |
| `peerDependencies` | Consumer uses the package's types but expects the host (the app embedding it) to provide the runtime instance.        |

### `dependencies` — the default for SDK internals

```json
// apps/cli/package.json
{
  "dependencies": {
    "@acme/sdk":           "workspace:*",
    "@acme/shared-types":  "workspace:*"
  }
}
```

If the CLI's compiled output `require`s or `import`s anything from `@acme/sdk` at runtime, this is the correct field.

### `devDependencies` — config and tooling packages

Shared config packages are consumed by the package manager and toolchain, not by runtime code:

```json
// packages/sdk-core/package.json
{
  "devDependencies": {
    "@acme/eslint-config":      "workspace:*",
    "@acme/typescript-config":  "workspace:*"
  }
}
```

These never appear in the runtime bundle — they're only used by `eslint`, `tsc`, etc.

### `peerDependencies` — type-only / host-provided

Use `peerDependencies` when:

1. The internal package exports **types only**, and the runtime instance comes from somewhere else.
2. The internal package is a plugin/adapter that requires a specific version of a core package the host already installed.

```json
// packages/adapter-openai/package.json
{
  "peerDependencies": {
    "@acme/sdk":  "workspace:*",
    "openai":     "^4"
  },
  "devDependencies": {
    "@acme/sdk":  "workspace:*",
    "openai":     "^4"
  }
}
```

Pattern: list as `peerDependencies` for the install contract, and as `devDependencies` so it resolves locally during dev/test.

### Type-only deps

If a package is consumed **purely for its types** (no runtime imports), TypeScript 5+ lets you use `import type`:

```ts
import type { ClientConfig } from "@acme/shared-types";
```

In that case the dep can live in `devDependencies` (build-only) when the consumer is itself the final app, or `peerDependencies` when the consumer is a library that re-exports those types to its own callers.

**Rule of thumb:**

- App imports a package's runtime ⇒ `dependencies`.
- Library expects host to provide the runtime ⇒ `peerDependencies` (plus `devDependencies` for local resolution).
- Build-time only (config, codegen, test fixtures) ⇒ `devDependencies`.

---

## 7. Multi-Repo → Monorepo Migration

Folding several existing repos into a single pnpm workspace is a one-time operation. Do it carefully — you only have one chance to preserve git history.

### Outline

```bash
# Step 1 — Create the monorepo scaffold
mkdir my-monorepo && cd my-monorepo
pnpm init
cat > pnpm-workspace.yaml <<'EOF'
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"
EOF
mkdir -p apps packages tools
git init && git add -A && git commit -m "chore: init monorepo scaffold"

# Step 2 — For each repo, rewrite its history into the target subdirectory
# Option A: git filter-repo (recommended, requires `pip install git-filter-repo`)
git clone https://github.com/acme/web-app /tmp/web-app
cd /tmp/web-app
git filter-repo --to-subdirectory-filter apps/web
cd -

# Bring the rewritten history into the monorepo
git remote add web-app /tmp/web-app
git fetch web-app --tags
git merge web-app/main --allow-unrelated-histories -m "chore: import web-app history"
git remote remove web-app

# Option B: git subtree (no extra tooling, but slower and noisier history)
# git subtree add --prefix=apps/web https://github.com/acme/web-app main

# Repeat for each repo you're importing (packages/sdk-core, packages/adapter-openai, etc.)

# Step 3 — Rename packages to scoped names
# In each imported package.json:
#   "name": "web"  ->  "name": "@acme/web"
#   "name": "sdk"  ->  "name": "@acme/sdk"

# Step 4 — Replace cross-repo registry deps with workspace:*
# apps/web/package.json:
#   "@acme/sdk": "1.2.3"   ->   "@acme/sdk": "workspace:*"

# Step 5 — Hoist shared configs
# Move eslint, prettier, tsconfig presets into packages/eslint-config, packages/typescript-config
# Update each package to extend the shared config:
#   { "extends": "@acme/typescript-config/library.json" }

# Step 6 — Install the orchestrator (turbo, nx, etc.) — see turborepo-for-sdk.md
pnpm add -D turbo -w

# Step 7 — Verify
pnpm install
pnpm -r run build
pnpm -r run test
pnpm -r run lint

# Step 8 — Unified CI (see your CI reference)
```

### Lessons learned

- **Use `git filter-repo`, not `git filter-branch`.** `filter-branch` is deprecated, slow, and has subtle correctness issues.
- **Import history before touching content.** Resist the urge to "clean up" old repos before merging — every modification before import bloats the rewrite.
- **Rename packages in one commit per package.** Makes the eventual `git log --follow` story readable.
- **Lockfile churn is unavoidable.** Delete every per-repo lockfile during import and regenerate `pnpm-lock.yaml` at the monorepo root once.
- **Tags collide.** Two repos with a `v1.0.0` tag will conflict. Prefix tags during import: `git filter-repo --tag-rename '':'web-'`.
- **CI is not free.** You will need to re-evaluate every workflow, secret, and protected branch — old `.github/workflows/*.yml` files come along with the history, often unwanted.

---

## 8. Anti-Patterns

### A. Root tasks pollution

Wrong — runtime deps and ad-hoc scripts at the root:

```json
{
  "name": "my-sdk-repo",
  "dependencies": {
    "openai": "^4",
    "chalk": "^5"
  },
  "scripts": {
    "build:sdk": "cd packages/sdk-core && tsc",
    "build:cli": "cd apps/cli && tsc"
  }
}
```

Right — root delegates only, deps live in the packages that import them:

```json
{
  "name": "my-sdk-repo",
  "private": true,
  "scripts": {
    "build": "turbo run build"
  },
  "devDependencies": {
    "turbo": "latest"
  }
}
```

### B. Deep `apps/foo/lib/` business code

Wrong — reusable logic buried inside an app:

```text
apps/cli/src/
├── bin.ts
├── shared/        # actually reused — should be a package
├── providers/     # actually reused — should be a package
└── runtime/       # the entire SDK lives here
```

Right — extract anything another package would import:

```text
apps/cli/
└── src/
    └── bin.ts                # only the CLI shell

packages/
├── sdk-core/                 # the runtime
├── adapter-openai/           # the providers
└── shared-types/             # the shared types
```

**Heuristic:** if a second app would copy/paste a folder from the first app, that folder is a package.

### C. Circular workspace dependencies

Wrong — `@acme/sdk` depends on `@acme/adapter-openai`, which depends back on `@acme/sdk`:

```json
// packages/sdk-core/package.json
{ "name": "@acme/sdk", "dependencies": { "@acme/adapter-openai": "workspace:*" } }
```

```json
// packages/adapter-openai/package.json
{ "name": "@acme/adapter-openai", "dependencies": { "@acme/sdk": "workspace:*" } }
```

Right — invert the dependency. Adapters depend on contracts; the core depends on contracts; neither depends on the other:

```json
// packages/sdk-core/package.json
{ "dependencies": { "@acme/shared-types": "workspace:*" } }
```

```json
// packages/adapter-openai/package.json
{ "dependencies": { "@acme/shared-types": "workspace:*" } }
```

If the SDK needs to instantiate adapters, accept them at runtime via dependency injection, not as build-time imports.

### D. Mixing app and library concerns

Wrong — `apps/` directory contains things nothing executes:

```text
apps/
├── cli/         # actual app
├── shared/      # not an app — a library
├── providers/   # not an app — a library
└── runtime/     # not an app — a library
```

Right — only executables go in `apps/`:

```text
apps/
├── cli/
├── desktop/
└── tui/

packages/
├── sdk-core/
├── adapter-openai/
└── shared-types/
```

### E. Cross-package file imports

Wrong — reaching into another package's internals:

```ts
import { runQuery } from "../../packages/sdk-core/src/internals/runner";
```

Right — go through the package's public name:

```ts
import { runQuery } from "@acme/sdk";
```

This forces you to maintain a real public surface and keeps refactors local.

### F. Recursive workspace globs

Wrong:

```yaml
packages:
  - "packages/**"
```

This silently picks up any future nested folder containing a `package.json`, including `node_modules` symlinks under exotic conditions. Be explicit:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "tools/*"
```

### G. Mega-package "core"

Wrong — one package owns everything:

```text
packages/
└── sdk/
    ├── client/
    ├── adapters/
    ├── prompts/
    ├── storage/
    └── cli-helpers/
```

This creates hidden internal coupling, prevents independent versioning, and forces every consumer to install everything.

Right — split by concern:

```text
packages/
├── sdk-core/
├── adapter-openai/
├── adapter-anthropic/
├── shared-types/
└── storage/
```

---

## Decision Checklist

Before you commit a layout, run through this list:

- Is every executable in `apps/`?
- Is every reusable unit in `packages/`?
- Does the root only delegate and pin tooling?
- Does every package have one clear purpose?
- Are internal dependencies declared with `workspace:*` (pnpm/bun) or `*` (npm/yarn)?
- Can each package build, test, and lint independently?
- Are there zero cross-package file imports (no `../../packages/...`)?
- Are there zero circular workspace deps?
- Is `pnpm-workspace.yaml` listing concrete globs, not `packages/**`?
