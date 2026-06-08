# Turborepo for SDK Monorepos

How to configure Turborepo when the monorepo is centered on an SDK package (`@acme/sdk`) plus consuming apps (`@acme/example-app`, docs site, e2e harness) and shared tooling. Turborepo is a **task orchestrator with content-addressed caching** — it does not replace your bundler (tsdown, tsup, Vite, etc.). It tells the bundler *when* to run.

---

## 1. Why Turborepo for an SDK Monorepo

An SDK monorepo has a classic asymmetric graph: one library at the root of the dependency tree, many things downstream of it.

| Pain point                                                       | What Turborepo gives you                                                         |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Rebuilding the SDK every time you touch an app                   | Content-addressed cache — SDK rebuild is skipped when `src/**` unchanged         |
| Running tests in every package on every PR                       | `--affected` runs only changed packages + their dependents                       |
| Forgetting to build the SDK before testing the example app       | `dependsOn: ["^build"]` enforces build order automatically                       |
| Slow CI because builds are sequential                            | Parallel execution across the dependency graph                                   |
| Watch loops that double-bundle (SDK watch + app dev rebundle)    | `persistent: true` task semantics + the `with` key for coordinated dev pipelines |

Turborepo does **not**:

- Compile or bundle code (your `build` script does that)
- Watch files itself for rebuilds (your `tsc --watch` / `tsdown --watch` does that — `turbo watch` re-invokes one-shot tasks)
- Replace package manager workspaces (it sits on top of pnpm / npm / yarn / bun workspaces)

---

## 2. Minimum Viable `turbo.json` for an SDK Monorepo

This is the canonical starting point. Drop it at the repo root.

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "globalDependencies": ["tsconfig.base.json", ".env"],
  "globalEnv": ["NODE_ENV", "CI"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "package.json", "tsconfig.json", "tsdown.config.ts"],
      "outputs": ["dist/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig.json"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "test/**", "vitest.config.ts"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "inputs": ["src/**", ".eslintrc*", "eslint.config.*"],
      "outputs": []
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

Key choices for an SDK repo:

- `build` uses `^build` so apps wait for the SDK's `dist/**` before bundling.
- `typecheck` and `test` also depend on `^build` because consumers type-check against the SDK's emitted `.d.ts`.
- `dev` is `persistent: true` and `cache: false` — long-running, never cacheable.
- `outputs: []` is **explicit** for lint/typecheck so Turborepo still caches the *task result* (pass/fail + logs) even though no files are produced.

---

## 3. Per-Package Scripts vs Root Scripts

**The single most violated rule in SDK monorepos:** the root `package.json` must only delegate to `turbo run`. Task logic lives in each package.

### Wrong

```json
// Root package.json — defeats parallelization, no caching
{
  "scripts": {
    "build": "cd packages/sdk && tsdown && cd ../../apps/example-app && vite build",
    "test": "vitest run --project sdk --project example-app",
    "lint": "eslint packages/ apps/"
  }
}
```

### Right

```json
// Root package.json — pure delegation
{
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "dev": "turbo run dev"
  }
}
```

```json
// packages/sdk/package.json
{
  "name": "@acme/sdk",
  "scripts": {
    "build": "tsdown",
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "dev": "tsdown --watch"
  }
}
```

```json
// apps/example-app/package.json
{
  "name": "@acme/example-app",
  "scripts": {
    "build": "vite build",
    "test": "vitest run",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "dev": "vite"
  }
}
```

**Also always write `turbo run <task>`, not the `turbo <task>` shorthand**, anywhere the command is committed to source (package.json scripts, CI YAML, shell scripts). The shorthand is only for interactive terminal use.

---

## 4. `dependsOn` Semantics

The `^` prefix is the entire game.

| Form              | Meaning                                                       | When to use                                                      |
| ----------------- | ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `^build`          | Run `build` in this package's *dependencies* first            | SDK must build before app builds                                 |
| `build`           | Run `build` in the *same package* first (sequential in-pkg)   | `test` requires `dist/**` from the same package's `build`        |
| `@acme/sdk#build` | Run a specific task in a specific package                     | `deploy` task that depends on a single named package's build     |

The SDK pattern:

```json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test":  { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] }
  }
}
```

Why `test` depends on `^build` and not `build`: most SDK tests run against source (`src/**`) via Vitest's TS pipeline. They only need *upstream* packages built (so imports resolve to real `dist`), not their own package.

**Note:** `^build` only walks declared workspace dependencies. If `apps/example-app/package.json` doesn't list `"@acme/sdk": "workspace:*"`, Turborepo will not build the SDK first. Always declare the dependency — never use a `prebuild` script to manually build siblings.

---

## 5. Caching Inputs and Outputs

The cache key is `fingerprint(inputs) → stored outputs`. Get either wrong and you get either stale builds or cache misses.

### Rules

| Rule                                                            | Reason                                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `inputs` lists only files that *affect the build's result*      | Adding `dist/**` to inputs creates a self-invalidating loop              |
| `outputs` lists everything written to disk you want restored    | Missing `outputs` means the task runs but nothing is cached              |
| Env vars consumed at build time go in `env` (per task)          | Otherwise the hash misses them and you get stale builds across envs     |
| Use `outputs: []` for lint/typecheck                            | Explicit "no file outputs, but cache the pass/fail result"               |
| `globalDependencies` for files that affect *every* task         | Repo-root `tsconfig.base.json`, shared lint config                       |

### SDK package inputs/outputs

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": [
        "src/**",
        "package.json",
        "tsconfig.json",
        "tsdown.config.ts"
      ],
      "outputs": ["dist/**"]
    }
  }
}
```

### Common framework outputs

| Tool       | `outputs`                          |
| ---------- | ---------------------------------- |
| tsc / tsdown / tsup | `["dist/**"]`             |
| Vite / Rollup       | `["dist/**"]`             |
| Next.js             | `[".next/**", "!.next/cache/**"]` |
| Vitest coverage     | `["coverage/**"]`         |

### Hidden inputs — env vars

`API_URL` changes won't invalidate the cache unless declared:

```json
{
  "tasks": {
    "build": {
      "outputs": ["dist/**"],
      "env": ["API_URL", "SDK_RELEASE_CHANNEL"]
    }
  }
}
```

For variables that affect *every* task, use `globalEnv` instead of repeating per task.

---

## 6. `--filter` for SDK Development Workflow

The five patterns that cover ~95% of an SDK author's day:

| Command                                                              | What it does                                                                |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `turbo run build --filter=@acme/sdk`                                 | Build just the SDK (skip every app)                                         |
| `turbo run build --filter=@acme/sdk...`                              | Build the SDK and everything *it* depends on (transitive deps first)        |
| `turbo run test --filter=...@acme/sdk`                               | Test the SDK and every package that *depends on* it (the affected fan-out)  |
| `turbo run dev --filter=@acme/sdk --filter=@acme/example-app`        | Start dev mode for the SDK and the example app together                     |
| `turbo run lint --filter=...[HEAD^1]`                                | Lint changed packages since last commit, including their dependents         |

### Quick reference

| Syntax        | Selects                                                |
| ------------- | ------------------------------------------------------ |
| `pkg`         | Just `pkg`                                             |
| `pkg...`      | `pkg` + all packages `pkg` depends on                  |
| `...pkg`      | `pkg` + all packages that depend on `pkg`              |
| `...pkg...`   | `pkg` + its dependencies *and* dependents              |
| `^pkg...`     | Only dependencies of `pkg`, excluding `pkg`            |
| `...^pkg`     | Only dependents of `pkg`, excluding `pkg`              |
| `[ref]`       | Packages changed since git ref                         |
| `...[ref]`    | Changed packages + their dependents (same as `--affected`) |
| `!pkg`        | Exclusion (combine with another `--filter`)            |
| `./apps/*`    | Glob by directory                                      |
| `@acme/*`     | Glob by package scope                                  |

### Daily SDK loops

```bash
# Iterate on the SDK in isolation
turbo run build typecheck test --filter=@acme/sdk

# I changed the SDK — what downstream breaks?
turbo run test --filter=...@acme/sdk

# I changed the SDK — start the example app to eyeball it
turbo run dev --filter=@acme/sdk --filter=@acme/example-app

# What did this PR actually touch?
turbo run build test lint --affected
```

`--affected` is the recommended CI shortcut. It is equivalent to `--filter=...[<default-branch>]` and includes dependents automatically.

---

## 7. The `boundaries` Field (Turbo 2.x)

Turborepo's `boundaries` enforces that packages can only import what they declare. This is *complementary* to `eslint-plugin-boundaries` (see `module-boundaries-and-plugins.md`): `turbo boundaries` is a CLI check across the whole graph; the ESLint plugin runs inside the editor for individual files.

### What it catches

1. Imports of files *outside* the importing package's directory (e.g. `../../packages/sdk/src/internal.ts`)
2. Imports of packages not listed in `dependencies`

### Tag a package

```json
// packages/sdk-internal/turbo.json
{ "tags": ["internal"] }
```

```json
// packages/sdk/turbo.json
{ "tags": ["public"] }
```

### Configure rules in root turbo.json

```json
{
  "boundaries": {
    "tags": {
      "public": {
        "dependencies": {
          "deny": ["internal"]
        }
      },
      "internal": {
        "dependents": {
          "deny": ["@acme/example-app", "@acme/docs"]
        }
      }
    }
  }
}
```

This blocks the public SDK from importing internal-only packages, and blocks consumer apps from reaching into internal packages directly. Run with:

```bash
turbo boundaries
```

For per-file `import/export` restrictions inside a package, layer `eslint-plugin-boundaries` on top.

---

## 8. CI Patterns for SDK Repos

The CI recipe: remote cache + `--affected` on PRs + full matrix on `main`.

### Minimal GitHub Actions workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    env:
      TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
      TURBO_TEAM: ${{ vars.TURBO_TEAM }}

    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 2 # needed for --affected to find the merge base

      - uses: pnpm/action-setup@v3
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - name: Build, test, lint, typecheck (affected only on PRs)
        run: turbo run build test lint typecheck --affected
```

### Notes

- **Always `turbo run`, never `turbo`** in YAML — shorthand is for terminals only.
- **`fetch-depth: 2` minimum** so the merge base is reachable. Use `0` (full history) if PRs may target old commits.
- **Remote cache** via `TURBO_TOKEN` + `TURBO_TEAM` (Vercel Remote Cache or any self-hosted compatible server). Without it, each CI runner starts cold.
- **On `main`**, optionally drop `--affected` and run everything for nightly correctness:
  ```yaml
  - run: turbo run build test lint typecheck
  ```
- For environments where remote cache is unavailable, fall back to `actions/cache` keyed on `**/turbo.json` and the lockfile.

---

## 9. Dev Mode for SDK Authors

The "edit SDK src/, see the app re-render" loop has two viable shapes.

### Shape A: SDK watch builds dist, app consumes dist

```json
// turbo.json
{
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

```bash
turbo run dev --filter=@acme/sdk --filter=@acme/example-app
```

- `@acme/sdk` runs `tsdown --watch` → writes `dist/**`
- `@acme/example-app` runs `vite` → picks up `dist` changes via HMR
- Both processes are `persistent: true`, so Turborepo keeps them running in parallel without trying to cache them.

### Shape B: App consumes SDK src directly (no watch needed)

For in-monorepo consumers, you can point a custom export condition (e.g. `"source"`) at `./src/index.ts` so the consuming app's bundler reads TypeScript source directly. The SDK never rebuilds during development; you only build for publish.

Pros: no double-bundle, faster HMR. Cons: requires the consumer's bundler to support TS source and the configured condition. See `package-json-exports.md` for the full setup.

### Why `persistent: true` matters

A persistent task tells Turborepo: *this task never exits on its own*. Without it:

- Turborepo treats the dev server as a finished task whose stdout it caches — wrong.
- Other tasks may try to depend on its (never-arriving) "completion".

If you want dev servers to wait for one-shot prep tasks (e.g. generate types) first, use the `with` key or the `dependsOn` + transit-node pattern.

---

## 10. Anti-Patterns

| Anti-pattern                                                       | Why it's wrong                                                         | Fix                                                              |
| ------------------------------------------------------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Root `build` script that runs each package's build manually        | Bypasses Turborepo, no caching, no parallelism                         | `"build": "turbo run build"` only                                |
| Missing `outputs` for a file-producing task                        | Task runs but files aren't cached or restored                          | List `["dist/**"]` (or framework equivalent)                     |
| Missing `inputs` for a build with non-default sources              | Cache invalidates on unrelated file changes; or misses real changes   | List the actual source globs                                     |
| `dependsOn: ["^build"]` without declaring the workspace dep        | `^build` walks `dependencies` — no entry, no build order               | Add `"@acme/sdk": "workspace:*"`                                 |
| `dev` task without `persistent: true`                              | Turborepo treats long-running server as a stuck task                   | Set `persistent: true` and `cache: false`                        |
| `prebuild` script that builds sibling packages                     | Manual orchestration bypassing the task graph                          | Declare the dep + rely on `^build`                               |
| Env vars consumed at build time but not declared in `env`          | Stale builds: hash misses the env change                               | Add to per-task `env` or `globalEnv`                             |
| `inputs` containing `dist/**` or the task's own outputs            | Self-invalidating cache (output change → input change → re-run)        | Only list source files                                           |
| `--parallel` to "speed things up"                                  | Bypasses the dependency graph; builds may run out of order             | Configure `dependsOn` properly; let Turborepo parallelize        |
| `..` relative paths in `inputs`                                    | Reaches out of the package, breaks portability                         | Use `$TURBO_ROOT$/path/to/file`                                  |
| Root `.env` file shared by all packages                            | Implicit coupling, coarse cache invalidation                           | Per-package `.env`; use `globalEnv` only for genuinely shared    |
| `turbo build` (shorthand) in CI or package.json                    | Reserved for interactive terminal use                                  | Always `turbo run build`                                         |
