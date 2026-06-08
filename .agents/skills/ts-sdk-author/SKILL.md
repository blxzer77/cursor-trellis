---
name: ts-sdk-author
description: >
  Design, build, verify, and publish production-grade TypeScript SDKs as npm
  packages inside a pnpm monorepo. Covers workspace layout, public API and
  module boundaries, plugin extension points, branded types and library-tuned
  tsconfig, tsdown bundling (vs tsup/tsc-only/unbuild), package.json exports
  with dual ESM+CJS and isomorphic conditions (browser/workers/RN/deno),
  Turborepo pipelines, publint and @arethetypeswrong/cli verification,
  changesets pre-release mode, npm dist-tags (latest/next/beta/rc/canary),
  and the alpha→beta→rc→stable release lifecycle. Triggers on: build a TS
  SDK, extract core library, package.json exports, dual ESM CJS, tsdown
  config, tsup vs tsdown, publint, attw, changesets prerelease, npm
  dist-tag, beta to rc, canary release, pnpm workspace SDK, isomorphic SDK,
  tsconfig library, npm provenance, shipping a TypeScript library.
license: MIT
metadata:
  author: oh-my-openclaw
  version: "1.0"
  composed_from:
    - agent-cli-architecture
    - typescript-pro
    - turborepo
    - monorepo-navigator
  sources:
    - code-architecture-refactoring
    - architecture-patterns
    - turborepo
    - fastify
    - Jeffallan/claude-skills (typescript-pro)
    - turborepo (official docs)
    - monorepo-navigator
    - publint.dev (rule catalog)
    - arethetypeswrong.github.io (problem catalog)
    - tsdown.dev (official docs)
    - changesets/changesets (prerelease + dist-tags docs)
    - GitHub package.json originals — tRPC, vercel/ai, Inngest, Sanity client, Hono, Zustand, TanStack query-core
---

# TypeScript SDK Author

End-to-end workflow for shipping a TypeScript SDK as a standalone npm package
from inside a pnpm monorepo: workspace layout, public API design, build
configuration, distribution shape, monorepo pipeline, verification, and the
full release lifecycle including beta / rc / canary channels.

The seven references hold the depth. This file is the unified workflow plus
a quick-reference for the patterns you reach for daily.

---

## When to Use This Skill

- Extracting a core library (e.g. `packages/core`, `packages/sdk`) out of an
  existing CLI or app inside a pnpm workspace
- Designing the public API surface of a TypeScript library that strangers will
  consume — branded types, generic clients, plugin extension points
- Choosing a build tool — tsdown vs tsup vs tsc-only vs unbuild
- Authoring the `package.json` `exports` field with dual ESM+CJS, isomorphic
  runtime conditions, and subpath plugin entries
- Configuring Turborepo so the SDK rebuilds only when its inputs change and
  downstream apps consume the SDK's build output (or raw `src` via a custom
  condition)
- Wiring `publint --strict` and `attw --pack` into `prepublishOnly` or CI
- Managing pre-release channels — `canary` per commit, `next` for the upcoming
  major, `beta` / `rc` for stabilization, `latest` for stable — and the
  transitions between them (`beta.N` → `rc.0` → `1.0.0` → `1.1.0-beta.0`)
- Setting up changesets with GitHub Actions `changesets/action@v1` plus
  npm provenance

---

## Execution Workflow

A single TS SDK build flows through these seven phases. Skip any phase and
something will break later — the dependencies between phases are real.

### Phase 1 — Workspace & Package Skeleton

Lay down the monorepo and create the empty SDK package.

Core moves:

1. Adopt `apps/` + `packages/` + optional `tools/` at the workspace root
2. Place the SDK in `packages/<sdk-name>/` (or `packages/core/`)
3. Give it a scoped name (`@<org>/<sdk-name>`)
4. Wire workspace-internal deps with the `workspace:*` protocol
5. Decide BEFORE anything else: this package will eventually be published,
   so design the boundary and naming with that in mind

```
my-repo/
├── pnpm-workspace.yaml
├── package.json          # root: only devDeps + workspace scripts
├── apps/
│   └── example-app/      # consumer of the SDK
└── packages/
    ├── sdk/              # ← the SDK
    └── shared-tsconfig/  # internal-only, never published
```

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Read next:** `references/workspace-and-layout.md` — §2 layout, §3 SDK naming
patterns, §4 internal package creation, §5 `package.json` skeleton, §7 multi
-repo → monorepo migration.

### Phase 2 — Public API Surface

Before writing any code, decide what the SDK's public face looks like.

Two parallel concerns:

**A. Module boundaries.** The `src/` tree splits cleanly into `api/` (what
gets re-exported and is part of the contract) and `internal/` (do not import
from outside the package). The `package.json` `exports` field is your
cheapest enforcement mechanism — anything not listed there cannot be
imported by consumers.

```
packages/sdk/src/
├── index.ts          # barrel — re-exports from api/
├── api/
│   ├── client.ts
│   └── types.ts
└── internal/
    ├── transport.ts  # NOT exported
    └── state.ts      # NOT exported
```

**B. Type design.** SDK types are consumed by strangers, must not leak
internals, must be evolvable. Use:

- **Branded types** for opaque IDs: `type UserId = Brand<string, "UserId">`
- **Generic clients** with sensible defaults so adding type params later is
  non-breaking: `createClient<Schema = DefaultSchema>(...)`
- **Discriminated unions** for result types: `Result<T, E>` with
  `{ ok: true; value: T } | { ok: false; error: E }`
- **Builder pattern** for type-safe configuration when option combinations
  matter
- **Interfaces** (not type aliases) when users may need to extend the type
  via declaration merging

**Read next:**

- `references/module-boundaries-and-plugins.md` — §2 `src/` boundary,
  §3 runtime layering, §4 provider/adapter, §5 plugin extension, §6 boundary
  enforcement, §7 patterns vs anti-patterns
- `references/type-design-for-public-api.md` — §1 branded types, §2 generic
  surfaces, §3 conditional/mapped types, §4 type guards, §5 builder, §6
  utility types ship/internal, §7 tsconfig for libraries, §8 API evolution

### Phase 3 — Build Configuration

You need (a) a `tsconfig.json` tuned for library output, and (b) a bundler
that produces the actual `dist/`.

**tsconfig for libraries** — the critical flags:

```jsonc
// tsconfig.build.json — library build config
{
  "compilerOptions": {
    "target": "es2022",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "declaration": true,             // emit .d.ts
    "declarationMap": true,          // sourcemap from .d.ts → .ts
    "sourceMap": true,
    "verbatimModuleSyntax": true,    // TS 5.0+ — strict import elision
    "isolatedDeclarations": true,    // TS 5.5+ — explicit return types on public API
    "composite": true,               // enable project references
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

**Bundler choice in 2026:** `tsdown`. tRPC and Inngest migrated to it from
tsup; tsup's own README now says *"This project is not actively maintained
anymore. Please consider using tsdown instead."*

Minimum viable `tsdown.config.ts`:

```ts
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/plugin/index.ts", "src/testing/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  treeshake: true,
  clean: true,
  outExtensions: ({ format }) => ({
    js: format === "esm" ? ".mjs" : ".cjs",
    dts: format === "esm" ? ".d.mts" : ".d.cts",
  }),
});
```

**Alternatives:**

- `tsc-only` / `zshy` — small SDK with no runtime deps, source-faithful publish
- `unbuild` — only when already in UnJS ecosystem
- `tsup` — community familiarity but losing mind-share; viable for inertia

**Read next:**

- `references/tsdown-bundling.md` — §3 verdict, §4 working config, §6–§8
  alternatives, §11 selection decision tree
- `references/type-design-for-public-api.md` §7 — full library tsconfig
  walkthrough

### Phase 4 — Distribution Shape (`package.json` `exports`)

This is where most TS SDK bugs live. Five invariants:

1. `types` **must** be first inside each `import` / `require` branch
2. `default` **must** be last
3. Dual ESM+CJS needs **separate** `.d.mts` and `.d.cts` (TS 5.0+)
4. Always include `"./package.json": "./package.json"` (lets publint/attw introspect)
5. `module` before `require` if you use both

The canonical dual shape (verbatim from `@trpc/server`):

```json
{
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "import": {
        "types": "./dist/index.d.mts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types": "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    }
  }
}
```

Add subpaths for plugin entry points so they version separately from the
root barrel:

```json
{
  "exports": {
    ".":          { "import": { ... }, "require": { ... } },
    "./plugin":   { "import": { ... }, "require": { ... } },
    "./testing":  { "import": { ... }, "require": { ... } }
  }
}
```

For isomorphic SDKs (browser / workers / RN / edge), runtime conditions
come **before** `import` / `require`:

```json
{
  ".": {
    "browser":      { "import": "./dist/browser.mjs" },
    "workerd":      { "import": "./dist/workerd.mjs" },
    "react-native": { "import": "./dist/rn.mjs" },
    "deno":         { "import": "./dist/deno.mjs" },
    "import":       { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
    "require":      { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
  }
}
```

**Read next:** `references/package-json-exports.md` — §3 the five rules,
§4 tRPC dual pattern annotated, §5 ESM-only pattern, §6 subpath plugins,
§7 isomorphic conditions (Sanity client pattern), §9 common mistakes
bad → fixed → why.

### Phase 5 — Monorepo Pipeline (Turborepo)

Once the SDK builds in isolation, wire it into the workspace so:

- Apps rebuild only when SDK output changes (caching)
- Local dev rebuilds SDK in watch mode while the app reloads
- CI builds only affected packages on PRs

Minimum viable `turbo.json`:

```json
{
  "$schema": "https://turborepo.com/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig*.json", "tsdown.config.ts", "package.json"],
      "outputs": ["dist/**"]
    },
    "test":      { "dependsOn": ["^build"], "inputs": ["src/**", "test/**"] },
    "lint":      { "inputs": ["src/**"] },
    "typecheck": { "dependsOn": ["^build"], "inputs": ["src/**", "tsconfig*.json"] },
    "dev":       { "persistent": true, "cache": false }
  }
}
```

Daily `--filter` patterns:

```bash
pnpm turbo run build --filter=@acme/sdk                   # SDK alone
pnpm turbo run dev   --filter=@acme/sdk... --filter=@acme/example-app
pnpm turbo run test  --filter=...@acme/sdk                # affected-by-SDK
pnpm turbo run lint  --filter=[HEAD^1]                    # affected since last commit
```

**Critical rules:** put scripts in **each** package's `package.json`, not in
root. Root only delegates `turbo run X`.

**Read next:** `references/turborepo-for-sdk.md` — §2 minimum viable
`turbo.json`, §3 per-package vs root, §4 `dependsOn`, §5 caching
inputs/outputs, §6 `--filter` patterns, §7 boundaries field, §8 CI patterns,
§9 dev mode with watch.

### Phase 6 — Verification

Before publish, two static checks + one runtime check are non-negotiable:

```bash
# After pnpm build:
pnpm exec publint --strict                   # static lint of package.json
pnpm exec attw --pack .                      # simulate Node/Bun/Deno/bundler resolution

# Then pack + install in a sandbox dir
pnpm pack
cd /tmp/sandbox && npm init -y && npm install /path/to/your-pkg-1.0.0.tgz
node -e "console.log(require('@acme/sdk'))"                          # CJS reaches
node --input-type=module -e "import('@acme/sdk').then(console.log)"  # ESM reaches
```

Wire all three into `prepublishOnly`:

```json
{
  "scripts": {
    "prepublishOnly": "pnpm build && pnpm exec publint --strict && pnpm exec attw --pack ."
  }
}
```

**Why both publint and attw?** publint statically checks `package.json`
shape; attw actually simulates how each consumer runtime resolves your
tarball. The most common attw failure is **Masquerading ESM** — a `.js`
file that contains ESM but is exposed under `require` — which publint
cannot catch.

**Read next:** `references/verification-and-publishing.md` — §2 publint
rules + 3 common failures, §3 attw resolution-mode table + 7 failure modes,
§4 smoke tests (tarball → fresh dir).

### Phase 7 — Release Lifecycle

This is where most SDK projects accumulate debt. Get it right from day 1.

**Semver + pre-release identifiers:**

```
0.x.y           # pre-1.0 — breaking changes allowed in minors
1.0.0-alpha.0   # internal feature spike
1.0.0-beta.0    # feature-complete, API may still shift
1.0.0-rc.0      # frozen, blocker-only fixes
1.0.0           # stable
1.0.1           # patch on stable
1.1.0-beta.0    # next minor's beta cycle while 1.0.x ships patches
```

**npm dist-tags — never publish a pre-release to `latest`:**

```bash
# Publish a beta under the `beta` tag (NOT `latest`)
npm publish --tag beta

# Recover from a mistaken latest:
npm dist-tag add @acme/sdk@1.0.0 latest      # repoint latest to stable
npm dist-tag rm  @acme/sdk beta              # if no longer needed
```

Convention tags: `latest` (stable), `next` (upcoming major prerelease),
`beta`, `rc`, `canary` (per-commit), `alpha`, `experimental`, `nightly`.

**changesets pre-release mode — the canonical transitions:**

```bash
# Cut beta line
pnpm changeset pre enter beta
pnpm changeset                  # write a changeset
pnpm changeset version          # bumps to 1.0.0-beta.0
pnpm changeset publish

# Feature-complete; move beta → rc
pnpm changeset pre exit
pnpm changeset pre enter rc
pnpm changeset version          # bumps to 1.0.0-rc.0
pnpm changeset publish

# RC stable; ship 1.0.0
pnpm changeset pre exit
pnpm changeset version          # bumps to 1.0.0
pnpm changeset publish

# Open next minor's beta line
pnpm changeset pre enter beta
pnpm changeset version          # bumps to 1.1.0-beta.0
```

**npm provenance** — turn it on:

```json
{
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

Pair with `id-token: write` permission in the GitHub Actions release job;
npm will display a verified attestation on the package page.

**Read next:** `references/verification-and-publishing.md` — §5 semver
refresher, §6 dist-tag rules, §7 full lifecycle state diagram, §8 case
studies (Next.js / vercel-ai / tRPC / Storybook / Stripe with real version
sequences), §9 changesets pre-release flow, §10 GitHub Actions release
workflow, §11 provenance, §12 yank vs deprecate, §13 strategy decision tree.

---

## Quick Reference

### File / Field Cheat Sheet

| File | Owns | Quick check |
|---|---|---|
| `pnpm-workspace.yaml` | Which dirs are packages | `apps/*` + `packages/*` |
| Root `package.json` | Workspace devDeps + `turbo run` delegates | No package-level build script in root |
| Package `package.json` | `name`, `version`, `type`, `exports`, `files`, `sideEffects`, `bin`, `scripts.prepublishOnly` | Run `publint --strict` |
| Package `tsconfig.json` | Editor + `tsc --noEmit` | `strict: true` + `declaration: true` |
| `tsconfig.build.json` | Library build config | `isolatedDeclarations: true` if you want fast `.d.ts` |
| `tsdown.config.ts` | Bundling | `format: ['esm', 'cjs']` + dual `outExtensions` |
| `turbo.json` | Task pipeline | `dependsOn: ['^build']` for compile order |
| `.changeset/config.json` | Release policy | `commit: false`, `access: public` |

### Bundler Selection at a Glance

| Situation | Choice |
|---|---|
| Modern TS SDK, dual ESM+CJS, plugin subpaths | **tsdown** |
| Zero runtime deps, want raw source-faithful publish | `tsc` only / `zshy` |
| Existing project on tsup that works | Stay on tsup; plan tsdown migration |
| UnJS / Nuxt ecosystem | unbuild |
| Need bundle-splitting + advanced rollup config | Direct `rolldown` |

### Module-Format Decision

| Situation | Recommendation |
|---|---|
| Default for new SDK in 2026 | **dual ESM + CJS** |
| Library has stable consumer base ≥ Node 22 | ESM-only is defensible |
| Library is internal-only inside a Node app | ESM-only |
| Library is consumed by Jest, older Next.js, Lambda CJS | **dual** is mandatory |

### Release Tag at a Glance

| Tag | Meaning | `npm install pkg@?` resolves |
|---|---|---|
| `latest` | The current stable | `npm install pkg` |
| `next` | Upcoming major prerelease | `npm install pkg@next` |
| `beta` | Feature-complete stabilization | `npm install pkg@beta` |
| `rc` | Frozen, blocker-only | `npm install pkg@rc` |
| `canary` | Per-commit/per-PR snapshot | `npm install pkg@canary` |
| `experimental` | Unstable spike | `npm install pkg@experimental` |

### One-Liner Snippets You'll Type Often

```bash
# Add the SDK as a workspace-internal dep
pnpm add @acme/sdk@workspace:* --filter @acme/example-app

# Build SDK + everything that depends on it
pnpm turbo run build --filter=...@acme/sdk

# Pre-publish gate
pnpm build && pnpm exec publint --strict && pnpm exec attw --pack .

# Cut a snapshot release for a PR (vercel/ai pattern)
pnpm changeset version --snapshot pr-123
pnpm publish --tag pr-123 --no-git-checks
```

---

## Pre-Publish Checklist

Run through this once per release. Skipping any item is how broken SDKs
ship.

### Build artifact

- [ ] `pnpm build` produces `dist/` with both `.mjs` and `.cjs` (if dual) or just `.mjs` (if ESM-only)
- [ ] `.d.mts` and `.d.cts` exist for dual, OR `.d.ts` only for ESM-only
- [ ] Source maps emitted (`.mjs.map`, `.d.mts.map`)
- [ ] `dist/` size is reasonable (`du -sh dist/` — sanity check, no surprise bloat)

### package.json

- [ ] `name` is scoped (`@org/name`) — required if you'll ever go private later
- [ ] `version` matches what you're about to publish
- [ ] `type` matches your default format (`"module"` for ESM-default, omit for CJS-default)
- [ ] `exports` has `"./package.json": "./package.json"`
- [ ] Every `exports` branch has `types` first, `default` last
- [ ] `files` lists `dist` (and `src` if shipping sources for IDE jump-to-def)
- [ ] `sideEffects: false` (unless you genuinely have top-level side effects)
- [ ] `publishConfig.access: "public"` for first scoped publish
- [ ] `publishConfig.provenance: true`

### Verification

- [ ] `publint --strict` passes
- [ ] `attw --pack .` passes (or only has expected `node10` warnings)
- [ ] Smoke test: pack + install in `/tmp` + CJS + ESM + TS consumer all resolve

### Release

- [ ] Correct dist-tag chosen (`latest` only for stable)
- [ ] If pre-release: `pnpm changeset pre enter <tag>` was run BEFORE `version`
- [ ] If stable: `pnpm changeset pre exit` was run if previously in pre-mode
- [ ] CHANGELOG.md reflects the change
- [ ] Git tag matches version (e.g. `v1.0.0-beta.3`)
- [ ] Provenance attestation visible on npm package page

---

## Common Mistakes

| Mistake | What goes wrong | Fix |
|---|---|---|
| `types` not first inside `exports` branch | TS picks up `.js` as type source → cascade of errors at consumer | Move `types` to top of each `import` / `require` branch (publint will flag) |
| Single `.d.ts` for dual ESM+CJS | TS resolves the `.d.ts` against the wrong module mode | Emit `.d.mts` + `.d.cts` (TS 5.0+); tsdown does this automatically |
| Missing `"./package.json": "./package.json"` in exports | publint/attw cannot introspect your package | Always include it |
| Publishing pre-release to `latest` | Every `npm install pkg` user gets your beta | Use `npm publish --tag beta`; recover via `npm dist-tag add pkg@stable latest` |
| Forgetting `pnpm changeset pre exit` before stable release | Stable version comes out as `1.0.0-beta.N` instead of `1.0.0` | Always `pre exit` before final |
| Root `package.json` containing the actual build script | Defeats Turborepo parallelism + caching | Per-package scripts; root only delegates via `turbo run` |
| Deep imports into `dist/internal/...` from consumers | Consumers couple to internals; your refactors break them | Don't list internals in `exports`; use ESLint `no-restricted-imports` |
| Leaking internal types into public API surface | Users see types they shouldn't depend on | Re-export only from `src/api/*.ts`; don't `export *` from internals |
| Missing `sideEffects: false` with no side effects | Bundlers can't tree-shake your library | Add `"sideEffects": false` or list the actual side-effecting files |
| Forgetting `id-token: write` permission for provenance | Provenance attestation fails silently in CI | Add `permissions: { id-token: write, contents: read }` to release job |
| Mixing watch + build in same Turbo task | Cache invalidates constantly; watch never settles | Separate `build` (cacheable) and `dev` (`persistent: true, cache: false`) |
| `exports` with both `module` and unrelated runtime conditions in wrong order | Edge runtime picks the wrong file | Runtime conditions (`browser`, `workerd`) → `module` → `import` → `require` → `default` |
| Using `enum` in public API types | Forces consumers into TS-only land, breaks erasable syntax | Use union of string literals or `as const` objects |
| Using `default` export from the SDK root | Breaks tree-shaking + interop story | Always named exports |

---

## Reference Files

| File | Use when |
|---|---|
| `references/workspace-and-layout.md` | Setting up `apps/` + `packages/` + `tools/`; naming the SDK package; creating internal packages; choosing dep field (`dependencies` / `peerDependencies` / `devDependencies`); migrating from multi-repo |
| `references/module-boundaries-and-plugins.md` | Splitting `src/` into `api/` vs `internal/`; designing the orchestration layer vs adapters vs tools; building a plugin extension model with lifecycle hooks; enforcing boundaries via eslint-plugin-boundaries / dependency-cruiser / Turbo `boundaries` |
| `references/type-design-for-public-api.md` | Branded types; generic clients; conditional + mapped types; type-safe builders; which utility types to ship vs keep internal; tsconfig flags for libraries (`verbatimModuleSyntax`, `isolatedDeclarations`, `composite`); API evolution patterns |
| `references/package-json-exports.md` | Authoring the `exports` field; dual ESM+CJS with separate `.d.mts`/`.d.cts`; subpath plugin entries; isomorphic runtime conditions (`browser`, `workerd`, `react-native`, `deno`, `edge-light`); fixing common `exports` bugs |
| `references/tsdown-bundling.md` | Choosing tsdown vs tsup vs tsc-only vs unbuild; minimum-viable `tsdown.config.ts`; subpath output mapping; side-effects + tree-shaking; watch & dev mode; bundler selection decision tree |
| `references/turborepo-for-sdk.md` | Writing `turbo.json` for an SDK monorepo; `dependsOn: ['^build']`; caching `inputs`/`outputs`; `--filter` patterns for SDK dev; the `boundaries` field; CI with remote cache + affected-only builds; dev mode with `persistent: true` |
| `references/verification-and-publishing.md` | publint + attw setup; tarball smoke tests; semver + pre-release identifiers; npm dist-tags; the full beta → rc → stable → next-cycle state machine; changesets pre-release mode; the canonical `beta → rc` transition command sequence; GitHub Actions release workflow with snapshot PRs; npm provenance; yank vs deprecate; release-strategy decision tree |

---

## Source Skills

This skill was composed from four source skills inside `oh-my-openclaw`:

- **`agent-cli-architecture`** (architect-claw) — workspace structure, module
  boundaries, runtime layering, plugin extension patterns. Generalized from
  "agent CLI" framing to general "SDK + supporting CLI".
- **`typescript-pro`** (frontend-claw) — branded types, generics, conditional
  types, type guards, utility types, tsconfig deep dive. Reframed toward
  library/SDK-author concerns.
- **`turborepo`** (frontend-claw) — task pipelines, caching, `--filter`,
  `boundaries`. Heavily trimmed to SDK-monorepo-relevant subset.
- **`monorepo-navigator`** (architect-claw) — pnpm workspaces, changesets,
  publishing, migration.

Plus original research on `package.json exports`, dual ESM/CJS in 2026,
the tsdown landscape, publint + attw, and the alpha→beta→rc→stable
lifecycle, with verbatim examples from the GitHub `package.json` of
tRPC, vercel/ai, Inngest, Sanity client, Hono, Zustand, and TanStack
query-core.
