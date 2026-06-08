# Bundling TypeScript Libraries in 2026

How to pick and configure a bundler for a TypeScript library that will be published to npm. The TL;DR is: **use `tsdown`** unless you have a specific reason not to. This document explains why, shows a real working config, and surveys the alternatives.

This file is scoped to *bundler choice and configuration*. It does **not** cover:

- `package.json#exports` shape → see `package-json-exports.md`
- `publint` / `@arethetypeswrong/cli` → see `verification-and-publishing.md`

---

## 1. Why a Library Needs a Bundler At All

Pure `tsc` works for a library — and several mature libraries (Zod, TanStack Query historically) prove it. But "just run `tsc`" has real costs the moment your library is non-trivial:

- **Multi-file output, uncompressed.** `tsc` emits one `.js` per `.ts`. Every `import` in source becomes a runtime `require`/`import` at consumption time. For a library with 200 source files, that's 200 round trips through the consumer's bundler.
- **No tree-shaking at publish time.** `tsc` ships everything you wrote, including dead branches. A bundler with tree-shaking removes unreachable code *before* publish, so consumers without bundlers (Deno, Bun scripts, Node ESM directly) also benefit.
- **No dual output.** `tsc` emits either CJS or ESM, not both. Library consumers in 2026 are split: a meaningful percentage of the ecosystem is ESM-only, but plenty of large apps and toolchains are still CJS. Shipping dual is still the polite default.
- **No source preprocessing.** JSX, decorators, `import.meta.env`, CSS-in-JS — `tsc` won't transform any of this. A bundler will.
- **No code splitting / shared chunks.** When you ship subpath entries (e.g. `./plugin`, `./testing`), `tsc` emits duplicated helpers in every entry. A bundler hoists them into a shared chunk.

The counter-argument — "let the consumer's bundler do this" — is partially valid and is exactly the case `zshy` (§7) makes. But most library authors should still bundle, because most consumers either don't bundle (Node servers, scripts, REPLs) or bundle naively (zero-config Next.js, Vite library mode).

---

## 2. The 2026 Landscape

| Tool          | Engine      | Status (2026)                                                | Mind-share    | Notes                                                                 |
| ------------- | ----------- | ------------------------------------------------------------ | ------------- | --------------------------------------------------------------------- |
| **tsdown**    | Rolldown    | **Active, recommended**                                      | Rising fast   | tsup's own README now says "use tsdown instead"                       |
| tsup          | esbuild     | **Unmaintained** (Egoist stepped back; README points to tsdown) | Declining     | Still works; massive existing footprint; safe to stay on short-term   |
| `tsc` only    | TypeScript  | Stable, always works                                         | Stable niche  | Fine for zero-runtime-dep utility libs (e.g. type-only packages)      |
| unbuild       | Rollup      | Active inside UnJS                                           | UnJS-only     | UnJS itself is experimenting with `obuild` (Rolldown-based successor) |
| tshy          | TypeScript  | Maintained by isaacs                                         | Niche         | Dual-emit via `tsc` twice; "no bundler, but generates `exports`"      |
| zshy          | TypeScript  | Active (used by Zod 4)                                       | Niche, rising | "tsc + extension rewriting + auto-generated `exports`"                |
| rolldown      | Rolldown    | Stable, but lower-level                                      | Bundler-builders | Use directly only if tsdown's abstractions get in your way         |

Concrete signals driving the verdict:

- tsup's own GitHub README (verbatim): *"This project is not actively maintained anymore. Please consider using `tsdown` instead. Read more in the migration guide."* Source: `github.com/egoist/tsup/blob/main/README.md`.
- tRPC migrated `packages/server` to tsdown (see §4 for the verbatim config).
- Inngest migrated `packages/inngest` to tsdown.
- tsdown is published by VoidZero (the Vite/Rolldown organization), so its long-term alignment with Vite-ecosystem tooling is structural, not coincidental.

---

## 3. Recommended: tsdown

**tsdown is the right default in 2026.**

- **Engine.** Built on [Rolldown](https://rolldown.rs), the Rust rewrite of Rollup. Speed comparable to esbuild, but with Rollup's plugin model and superior code-splitting heuristics.
- **Designed for libraries.** Where tsup was "bundle a Node CLI", tsdown is "ship an npm package". Defaults are library-shaped: `dts: true`, dual emit, `target: 'node18'`, sourcemaps off until you ask.
- **Zero-config baseline.** With just `src/index.ts` and a `package.json` declaring entries, `npx tsdown` produces correct dual output.
- **First-class `outExtensions`.** Unlike older tools, tsdown understands that `.mjs` files need `.d.mts` declarations and `.cjs` files need `.d.cts`. This matters for `@arethetypeswrong/cli` passing.
- **AI-aware docs.** tsdown.dev publishes `/guide.md` (a markdown-optimized version of the same page) explicitly for LLM consumers. The doc nav literally says "Are you an LLM? You can read better optimized documentation at /guide.md".
- **Migration path from tsup.** tsdown ships a `migrate-from-tsup` guide and accepts most tsup options as-is.

The verdict: **use tsdown for new libraries; migrate to tsdown when you next touch an existing tsup config.**

---

## 4. A Working `tsdown.config.ts`

Verbatim from `github.com/trpc/trpc`, `packages/server/tsdown.config.ts` (commit on `main` as of writing):

```ts
import { defineConfig } from 'tsdown';

export const input = [
  'src/adapters/aws-lambda/index.ts',
  'src/adapters/express.ts',
  'src/adapters/fastify/index.ts',
  'src/adapters/fetch/index.ts',
  'src/adapters/next-app-dir.ts',
  'src/adapters/next.ts',
  'src/adapters/node-http/index.ts',
  'src/adapters/standalone.ts',
  'src/adapters/ws.ts',
  'src/http.ts',
  'src/index.ts',
  'src/observable/index.ts',
  'src/rpc.ts',
  'src/shared.ts',
  'src/unstable-core-do-not-import.ts',
];

export default defineConfig({
  target: ['node18', 'es2017'],
  entry: input,
  dts: {
    sourcemap: true,
    tsconfig: './tsconfig.build.json',
  },
  // unbundle: true,
  format: ['cjs', 'esm'],
  outExtensions: (ctx) => ({
    dts: ctx.format === 'cjs' ? '.d.cts' : '.d.mts',
    js: ctx.format === 'cjs' ? '.cjs' : '.mjs',
  }),
  onSuccess: async () => {
    const start = Date.now();
    const { generateEntrypoints } = await import(
      '../../scripts/entrypoints.js'
    );
    await generateEntrypoints(input);
    console.log(`Generated entrypoints in ${Date.now() - start}ms`);
  },
});
```

Source: `https://github.com/trpc/trpc/blob/main/packages/server/tsdown.config.ts`

And, for contrast, the Inngest SDK config — same tool, very different philosophy (note `unbundle: true`):

```ts
// github.com/inngest/inngest-js/blob/main/packages/inngest/tsdown.config.ts
import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  dts: true,
  entry: [
    "src/astro.ts",
    "src/bun.ts",
    "src/cloudflare.ts",
    "src/connect.ts",
    "src/deno/fresh.ts",
    "src/digitalocean.ts",
    "src/edge.ts",
    "src/express.ts",
    "src/fastify.ts",
    "src/h3.ts",
    "src/hono.ts",
    "src/index.ts",
    "src/koa.ts",
    "src/lambda.ts",
    "src/next.ts",
    "src/nitro.ts",
    "src/node.ts",
    "src/nuxt.ts",
    "src/react.ts",
    "src/remix.ts",
    "src/sveltekit.ts",
    "src/types.ts",
    "src/components/connect/strategies/workerThread/runner.ts",
    "!src/test/**/*",
    "!src/**/*.test.*",
  ],
  format: ["cjs", "esm"],
  outDir: "dist",
  tsconfig: "tsconfig.build.json",
  target: "node20",
  platform: "neutral",
  sourcemap: true,
  failOnWarn: true,
  minify: false,
  report: true,
  unbundle: true,            // file-to-file transpile, no chunking
  copy: ["package.json", "LICENSE.md", "README.md", "CHANGELOG.md"],
  skipNodeModulesBundle: true,
});
```

Key options worth understanding (from `tsdown.dev/reference/api/Interface.UserConfig.md`):

| Option           | What it does                                                                 |
| ---------------- | ---------------------------------------------------------------------------- |
| `entry`          | Array (or object) of source entrypoints. Glob-aware; `!` excludes.            |
| `format`         | `'esm'`, `'cjs'`, or both. Drives `outExtensions`.                            |
| `outExtensions`  | Function returning `{ js, dts }` per format. Required for ATTW-clean dual.    |
| `dts`            | `true` for boolean, or object: `{ sourcemap, tsconfig, isolatedDeclarations }`. |
| `sourcemap`      | Boolean / `'inline'` / `'hidden'`. Default is off.                            |
| `treeshake`      | Default `true`. Pass an object for advanced tuning.                           |
| `clean`          | Wipe `outDir` before build. Default `false`. Set `true` in CI.                |
| `external`       | Regex / glob / array — keep imports unresolved (peer deps, runtime deps).     |
| `platform`       | `'node'` / `'browser'` / `'neutral'`. Changes default externals + shims.      |
| `target`         | `'node18'`, `'es2022'`, etc. Lowering = more transpilation.                   |
| `unbundle`       | When true, one-output-file-per-input-file. Disables chunking.                 |
| `report`         | Print per-chunk size table after build.                                       |

A new project's first config can be much smaller:

```ts
// tsdown.config.ts — minimal dual-emit library
import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  outExtensions: (ctx) => ({
    js: ctx.format === 'cjs' ? '.cjs' : '.mjs',
    dts: ctx.format === 'cjs' ? '.d.cts' : '.d.mts',
  }),
});
```

Source: composed from `tsdown.dev/guide/getting-started` and `tsdown.dev/options/output-format`.

---

## 5. Bundler-Generated Subpath Outputs

When you list multiple entries, tsdown preserves the source-relative path under `outDir`:

```
src/index.ts           ->  dist/index.{mjs,cjs}      dist/index.d.{mts,cts}
src/plugin/index.ts    ->  dist/plugin/index.{mjs,cjs}
src/testing/index.ts   ->  dist/testing/index.{mjs,cjs}
src/adapters/node.ts   ->  dist/adapters/node.{mjs,cjs}
```

Verify shapes after first build:

```bash
$ npx tsdown
$ find dist -maxdepth 3 -name '*.mjs' -o -name '*.cjs' -o -name '*.d.*ts' | sort
```

These on-disk files become the targets of your `package.json#exports`. The exact shape of that field — including `types` ordering, `import`/`require` conditions, and wildcard subpaths — is covered in **`package-json-exports.md`**. From this side, all you need is to know which files exist.

Two anti-patterns to avoid:

- **Don't ship `dist/index.js` and let the consumer pick.** Ambiguous `.js` extensions force consumers' Node to guess based on the nearest `package.json#type`. ATTW will fail. Always use `.mjs` / `.cjs`.
- **Don't co-locate `.d.ts` next to dual `.mjs`/`.cjs`.** TypeScript resolves `.d.ts` for both, which lies about the runtime shape. Use `.d.mts` and `.d.cts`.

---

## 6. Alternative: tsup (still common but in decline)

**What it is.** Predecessor of tsdown, also by Egoist. esbuild-powered, zero-config-for-CLIs. Was the de-facto standard from 2021 through 2025.

**Config snippet** (typical library shape):

```ts
// tsup.config.ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/plugin/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  treeshake: true,
  outExtension: ({ format }) => ({
    js: format === 'cjs' ? '.cjs' : '.mjs',
  }),
});
```

Source: `tsup.egoist.dev/#configuration-file`.

**Pros.**

- Massive existing footprint — many of the libraries you use are still on tsup.
- esbuild is fast and battle-tested.
- Plenty of Stack Overflow / blog answers; LLMs know it cold.

**Cons.**

- README at `github.com/egoist/tsup` explicitly states the project is no longer maintained.
- `.d.ts` generation relies on a separate path and historically has been a source of ATTW failures around `outExtension`.
- esbuild's tree-shaking is good but not Rollup-class for libraries with deep re-exports.

**Verdict.** Don't start new libraries on tsup. For existing libraries: migrate when you next touch the build config — the migration is usually 5-15 lines of diff.

**Migration path (tsup → tsdown), at a glance:**

```diff
- import { defineConfig } from 'tsup';
+ import { defineConfig } from 'tsdown';

  export default defineConfig({
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
-   outExtension: ({ format }) => ({
+   outExtensions: (ctx) => ({
-     js: format === 'cjs' ? '.cjs' : '.mjs',
+     js: ctx.format === 'cjs' ? '.cjs' : '.mjs',
+     dts: ctx.format === 'cjs' ? '.d.cts' : '.d.mts',
    }),
  });
```

Full migration guide: `tsdown.dev/guide/migrate-from-tsup`.

---

## 7. Alternative: tsc-only / zshy (no bundler)

**What it is.** Skip bundling entirely. Run `tsc` (or `tsc` twice for dual). Tools like `zshy` and `tshy` wrap this with extension rewriting and `exports` generation.

**zshy config** (lives in `package.json`, no separate config file):

```jsonc
// package.json
{
  "name": "my-pkg",
  "type": "module",
  "scripts": { "build": "zshy" },
  "zshy": {
    "exports": {
      ".": "./src/index.ts",
      "./utils": "./src/utils.ts",
      "./plugins/*": "./src/plugins/*",
      "./components/**/*": "./src/components/**/*"
    }
  },
  "devDependencies": { "zshy": "^1.0.0" }
}
```

Source: `github.com/colinhacks/zshy/blob/main/README.md`.

zshy then runs `tsc` twice (once for ESM, once for CJS with extension rewriting to `.cjs`/`.d.cts`) and **writes the `exports` map directly into your `package.json`** based on the entrypoints. No bundler at all.

**Pros.**

- Output is one-to-one with source. Stack traces map cleanly to your code without a sourcemap.
- Cognitive load is near-zero: it's just `tsc`.
- Used in production by [Zod 4](https://zod.dev) — proves it works for a large, popular library.
- Plays well with consumer bundlers that already do their own tree-shaking.

**Cons.**

- No bundling means consumers see your full file tree (200 files, 200 imports). Most modern bundlers handle this fine, but it can surface long-import-chain bugs.
- No code splitting or shared chunks across entries — helpers are duplicated.
- Slower at install time (more files to read).
- "It's slow" — quoting the zshy README directly.

**Verdict.** Right call when (a) you have zero or near-zero runtime dependencies, (b) you want source-faithful published output, and (c) you don't need to ship pre-tree-shaken output to non-bundling consumers. Wrong call when you need code splitting or have a complex preprocessing pipeline (JSX + CSS + decorators).

Minimal vanilla-`tsc` workflow (no zshy):

```jsonc
// tsconfig.build.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noEmit": false
  },
  "include": ["src"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts"]
}
```

```jsonc
// package.json
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json"
  }
}
```

This is the "I will deal with exports manually" path. Workable; cross-reference `package-json-exports.md` for the resulting `exports` field.

---

## 8. Alternative: unbuild

**What it is.** Rollup-based bundler by the UnJS team. Tightly integrated with Nuxt/Nitro/H3. Note: UnJS themselves are now experimenting with `obuild` (Rolldown-based successor); the README says so verbatim.

**Config snippet:**

```ts
// build.config.ts
import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  entries: [
    './src/index',
    {
      builder: 'mkdist',
      input: './src/components/',
      outDir: './dist/components',
    },
  ],
  declaration: true,
  rollup: {
    emitCJS: true,
  },
});
```

Source: `github.com/unjs/unbuild/blob/main/README.md`.

Unique features:

- **`--stub` mode** — instead of building, writes shim files that re-export from `src/` directly via `jiti`. Lets you `pnpm link` without rebuilding on every change.
- **mkdist builder** — file-to-file transpilation (like zshy/tsc, but Rollup-driven), useful for component libraries.
- **Auto-config from `package.json`** — infers entries.

**Pros.** Excellent monorepo DX via `--stub`. Strong Rollup ecosystem. Built-in dependency auditing (warns about missing/unused deps and fails CI).

**Cons.** Niche outside UnJS. Slower than tsdown. Future is hazy given `obuild` development.

**Verdict.** Use it if you're already in the UnJS ecosystem (Nuxt module, Nitro plugin, H3 middleware). Otherwise use tsdown.

---

## 9. Side-Effects, Tree-Shaking, and `sideEffects`

The bundler's `treeshake` option (on by default in tsdown) removes unreachable code. But it cannot remove module-level *evaluation* unless the package opts in.

In `package.json`:

```json
{
  "sideEffects": false
}
```

This claim — "no module in this package has top-level side effects" — gives the *consumer's* bundler permission to drop the entire module if no symbols from it are imported. It is read by webpack, Vite, Rollup, and tsdown alike.

If your library has some files that do have side effects (CSS imports, polyfill registrations, monkey-patches), narrow the claim:

```json
{
  "sideEffects": ["./dist/polyfills.cjs", "./dist/polyfills.mjs", "*.css"]
}
```

Common pitfalls:

- **Importing a CSS file at the top of `index.ts`** is a side effect. If `sideEffects: false` is set, consumers will drop the CSS, silently breaking styling.
- **Polyfills via top-level `if`** are side effects. Same risk.
- **Setting a global** (`globalThis.__MY_LIB__ = ...`) is the canonical side-effect example.

When in doubt, omit `sideEffects` entirely. The default ("might have side effects") is safe but loses tree-shaking precision for consumers.

---

## 10. Watch & Dev Mode

tsdown's watch mode is `--watch` (or `tsdown -w`):

```bash
$ npx tsdown --watch
```

In a monorepo, prefer scoping the watch via the workspace manager rather than running multiple watchers:

```bash
$ pnpm --filter @your-org/core --filter @your-org/plugin run dev
# where each package's "dev" script is "tsdown --watch"
```

**The "consume raw `src` in-monorepo" trick.** Pioneered by TanStack and used in `tanstack/query`'s `packages/query-core/package.json`: define a custom export condition that points at `src/` for development, and the built `dist/` for production. Vite and webpack will honor it inside the monorepo, so you never need to rebuild dependencies during dev.

```jsonc
// packages/query-core/package.json
{
  "exports": {
    ".": {
      "source": "./src/index.ts",       // for tsconfig paths + vite
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.mts"
    }
  }
}
```

Combined with a `vite.config.ts`:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    conditions: ['source', 'import', 'module', 'default'],
  },
});
```

Now dev = no build step ever, and your watcher is just `tsc --watch --noEmit` for type checking. Production publish still uses tsdown.

Reference: TanStack Query's monorepo at `github.com/TanStack/query`.

---

## 11. Bundler Selection Decision Tree

Use this in order. Stop at the first match.

```
1. Are you publishing to npm and want consumers to be able to use the package
   without their own bundler (CLI tools, Node scripts, edge functions)?
   YES → continue
   NO  → (you're shipping a TS source-only package, e.g. a code-mod or
          internal monorepo lib) → go to 6 (tsc-only)

2. Do you have any of: JSX, CSS imports, decorators, asset imports,
   non-TS source files, or `import.meta.env` substitution?
   YES → tsdown (rolldown handles all of these natively)
   NO  → continue

3. Is your library zero-runtime-deps (pure TS, no `dependencies` field)
   AND do you value source-faithful output AND OK with consumer bundlers
   doing the tree-shaking?
   YES → zshy (or vanilla tsc)
   NO  → continue

4. Are you in the UnJS ecosystem (Nuxt module, Nitro plugin, H3 utility)?
   YES → unbuild
   NO  → continue

5. Do you already have a working tsup config and the cost of touching it
   exceeds the cost of staying?
   YES → keep tsup for now; migrate next time you touch the build
   NO  → tsdown

6. tsc-only path:
   - Set `"main": "./dist/index.js"`, `"types": "./dist/index.d.ts"`
   - Single-format only (pick one of ESM or CJS based on consumers)
   - For dual-emit without a bundler: use zshy or tshy
```

A condensed version as a table:

| If you...                                              | Use                  |
| ------------------------------------------------------ | -------------------- |
| Are starting a new TS library in 2026                  | **tsdown**           |
| Have an existing tsup config that works                | tsup → tsdown later  |
| Want zero-dep, source-faithful output (Zod-style)      | zshy                 |
| Build a Nuxt module / UnJS package                     | unbuild              |
| Ship a TS-source-only package (no transpilation)       | `tsc` only           |
| Need full Rollup plugin API control                    | rolldown directly    |

---

## Build Output Verification (Brief)

After your first build with any of the above, verify the on-disk shape before publishing:

```bash
$ ls -la dist/
$ node -e "require('./dist/index.cjs')"        # CJS smoke test
$ node --input-type=module -e "import('./dist/index.mjs').then(m => console.log(Object.keys(m)))"
$ npx tsc --noEmit --strict scratch.ts          # consume .d.ts from a fresh project
```

Deeper verification (`publint`, `@arethetypeswrong/cli`, `node --experimental-vm-modules`) is covered in `verification-and-publishing.md`. This file's job ends when `dist/` contains the right files in the right shape.

---

## Source Citations

- tsdown guide: `https://tsdown.dev/guide/`
- tsdown config reference: `https://tsdown.dev/reference/api/Interface.UserConfig.md`
- tsdown LLM-optimized guide: `https://tsdown.dev/guide.md`
- tRPC server config: `https://github.com/trpc/trpc/blob/main/packages/server/tsdown.config.ts`
- Inngest SDK config: `https://github.com/inngest/inngest-js/blob/main/packages/inngest/tsdown.config.ts`
- tsup README (unmaintained notice): `https://github.com/egoist/tsup/blob/main/README.md`
- tsup → tsdown migration: `https://tsdown.dev/guide/migrate-from-tsup`
- zshy README: `https://github.com/colinhacks/zshy/blob/main/README.md`
- unbuild README: `https://github.com/unjs/unbuild/blob/main/README.md`
- Anthony Fu on ESM-only: `https://antfu.me/posts/move-on-to-esm-only`
- TanStack Query `source` condition pattern: `https://github.com/TanStack/query`
