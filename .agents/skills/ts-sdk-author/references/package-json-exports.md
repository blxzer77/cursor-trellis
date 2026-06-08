# `package.json` `exports` — Designing Dual-Format, Multi-Runtime Entry Maps

Audience: TypeScript SDK authors shipping a single package to Node (ESM + CJS), browsers, edge workers, React Native, Bun, and Deno — with one or more subpath entries for plugins/adapters.

This reference covers field design only. For *generating* the matching `dist/` artifacts, see `tsdown-bundling.md`. For *validating* the shape (`publint`, `attw --pack`), see `verification-and-publishing.md`.

---

## 1. Why `exports` Matters

Before Node 12 / TypeScript 4.7, package entry resolution was a mess: `main` for CJS, `module` for bundlers, `browser` for browser bundlers, `types` for TypeScript, plus `typesVersions` for subpaths. Each tool implemented a slightly different fallback chain. A consumer's import could land on the wrong file silently, leading to duplicate React copies, missing source maps, or "ReferenceError: require is not defined."

The `exports` field, defined by [Node's resolution spec](https://nodejs.org/api/packages.html#conditional-exports), is now the single source of truth:

| Consumer / tool | What it reads from `exports` |
| --- | --- |
| Node ESM (`import`)          | `"import"` branch (or `"node"` then `"import"`) |
| Node CJS (`require`)         | `"require"` branch (or `"node"` then `"require"`) |
| TypeScript (`moduleResolution: bundler`, `node16`, `nodenext`) | `"types"` key — but **only inside the matching `import`/`require` branch** |
| Webpack / Rollup / Vite / esbuild | `"browser"` / `"import"` / custom user-configured conditions |
| Cloudflare Workers, Vercel Edge | `"workerd"`, `"worker"`, `"edge-light"` |
| React Native / Metro          | `"react-native"` |
| Deno                          | `"deno"` then `"import"` |
| Bun                           | `"bun"` then `"import"` |
| [`publint`](https://publint.dev) / [`@arethetypeswrong/cli`](https://arethetypeswrong.github.io) | Walks the entire tree and validates every leaf |

If `exports` exists, Node **ignores** `main`, `module`, and `browser` for resolution (they remain only as fallbacks for legacy tooling that hasn't implemented `exports` yet). It also blocks deep imports: consumers can only import what `exports` whitelists. This is a feature — it gives you a real public API surface.

---

## 2. Anatomy of an `exports` Entry

```jsonc
"exports": {
  "<subpath>": {
    "<condition>": "<path>" | { ...nested conditions },
    ...
  }
}
```

- **Subpath** — a string starting with `"."`. `"."` is the package root; `"./client"` is `pkg-name/client`; `"./package.json"` exposes the manifest itself; `"./adapters/*"` is a wildcard. Subpaths cannot resolve outside the package.
- **Condition** — a string key matched against the consumer's *condition set*. Conditions include `"import"`, `"require"`, `"types"`, `"node"`, `"browser"`, `"deno"`, `"bun"`, `"worker"`, `"workerd"`, `"edge-light"`, `"react-native"`, `"react-server"`, `"development"`, `"production"`, `"module-sync"`, and an always-matching `"default"`.
- **Fallthrough rule** — within a single object, conditions are tried *in declaration order*. The **first match wins**, and the resolver does not look further once a leaf string is returned. This is the most important behavioural fact about the `exports` field.

A leaf is either a string (a relative file path inside the package) or `null` (explicitly forbid a target — e.g. block CJS from accidentally getting an ESM file).

---

## 3. The Five Rules That Catch 90% of `exports` Bugs

These are non-negotiable invariants. Linters (`publint`, `attw`) will flag violations.

### 3.1. Rule 1 — `"types"` MUST come first inside each branch

```jsonc
// CORRECT
"import": {
  "types": "./dist/index.d.mts",   // <-- first
  "default": "./dist/index.mjs"
}
```

```jsonc
// BROKEN — TypeScript may resolve `default` before seeing `types`,
// leading to a missing-types error in strict resolvers.
"import": {
  "default": "./dist/index.mjs",
  "types": "./dist/index.d.mts"
}
```

Because first-match-wins, if a runtime condition matches before `types`, the resolver returns a `.js` path and the TS-aware fallback is never consulted. (`publint` rule [`types-should-be-first-in-conditional-exports`](https://publint.dev/rules).)

### 3.2. Rule 2 — `"default"` MUST be last

`"default"` matches every condition set. Anything declared after it is unreachable.

```jsonc
// BROKEN — the `node` branch will never be selected
"import": {
  "default": "./dist/index.mjs",
  "node": "./dist/index.node.mjs"  // unreachable
}
```

### 3.3. Rule 3 — Separate `.d.mts` and `.d.cts` for dual packages (TS 5.0+)

A single `.d.ts` file cannot accurately describe both ESM and CJS shapes — they differ on `export =`, `import.meta`, and default-export interop. Emit two declaration files and reference them from the matching branch:

```jsonc
".": {
  "import":  { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
  "require": { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
}
```

TypeScript needs `moduleResolution: "node16" | "nodenext" | "bundler"` on the consumer side to honour these. `publint` flags the [`types-resolved-through-fallback`](https://publint.dev/rules) issue when one declaration file is reused across both formats incorrectly.

### 3.4. Rule 4 — Include `"./package.json": "./package.json"`

Many tools (Yarn PnP, Rollup, the TypeScript `pkg-pr-new` flow, `attw`) read your own `package.json` at runtime to introspect `version`, `peerDependencies`, etc. Without an explicit entry, those reads fail with `ERR_PACKAGE_PATH_NOT_EXPORTED`. The cost of including it is one line.

### 3.5. Rule 5 — If you use the `"module"` condition, it must precede `"require"`

`"module"` is a non-standard bundler condition (used by Webpack/Rollup) that means "give me the ESM build even though I would normally use `require`". Put it before `"require"` so bundlers see it first; Node ignores `"module"` and falls through to `"require"`. Most modern SDKs skip `"module"` entirely now that `"import"` is universally supported.

---

## 4. The Standard Dual Shape — tRPC Pattern

This is the canonical shape for a Node-first SDK that ships both ESM and CJS with separate declaration files for each.

```jsonc
// from trpc/trpc @ packages/server/package.json
// https://github.com/trpc/trpc/blob/main/packages/server/package.json
{
  "name": "@trpc/server",
  "type": "module",
  "sideEffects": false,
  "main":    "./dist/index.cjs",       // legacy fallback for non-exports-aware tools
  "module":  "./dist/index.mjs",       // legacy fallback for older bundlers
  "types":   "./dist/index.d.cts",     // legacy fallback for TS pre-4.7
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "import": {
        "types":   "./dist/index.d.mts",
        "default": "./dist/index.mjs"
      },
      "require": {
        "types":   "./dist/index.d.cts",
        "default": "./dist/index.cjs"
      }
    },
    "./adapters/aws-lambda": {
      "import":  { "types": "./dist/adapters/aws-lambda/index.d.mts", "default": "./dist/adapters/aws-lambda/index.mjs" },
      "require": { "types": "./dist/adapters/aws-lambda/index.d.cts", "default": "./dist/adapters/aws-lambda/index.cjs" }
    },
    "./adapters/express": {
      "import":  { "types": "./dist/adapters/express.d.mts",  "default": "./dist/adapters/express.mjs" },
      "require": { "types": "./dist/adapters/express.d.cts",  "default": "./dist/adapters/express.cjs" }
    },
    "./adapters/fastify": {
      "import":  { "types": "./dist/adapters/fastify/index.d.mts", "default": "./dist/adapters/fastify/index.mjs" },
      "require": { "types": "./dist/adapters/fastify/index.d.cts", "default": "./dist/adapters/fastify/index.cjs" }
    },
    "./adapters/fetch": {
      "import":  { "types": "./dist/adapters/fetch/index.d.mts", "default": "./dist/adapters/fetch/index.mjs" },
      "require": { "types": "./dist/adapters/fetch/index.d.cts", "default": "./dist/adapters/fetch/index.cjs" }
    },
    "./adapters/next-app-dir": {
      "import":  { "types": "./dist/adapters/next-app-dir.d.mts", "default": "./dist/adapters/next-app-dir.mjs" },
      "require": { "types": "./dist/adapters/next-app-dir.d.cts", "default": "./dist/adapters/next-app-dir.cjs" }
    },
    "./adapters/next": {
      "import":  { "types": "./dist/adapters/next.d.mts", "default": "./dist/adapters/next.mjs" },
      "require": { "types": "./dist/adapters/next.d.cts", "default": "./dist/adapters/next.cjs" }
    },
    "./adapters/node-http": {
      "import":  { "types": "./dist/adapters/node-http/index.d.mts", "default": "./dist/adapters/node-http/index.mjs" },
      "require": { "types": "./dist/adapters/node-http/index.d.cts", "default": "./dist/adapters/node-http/index.cjs" }
    },
    "./adapters/standalone": {
      "import":  { "types": "./dist/adapters/standalone.d.mts", "default": "./dist/adapters/standalone.mjs" },
      "require": { "types": "./dist/adapters/standalone.d.cts", "default": "./dist/adapters/standalone.cjs" }
    },
    "./adapters/ws": {
      "import":  { "types": "./dist/adapters/ws.d.mts", "default": "./dist/adapters/ws.mjs" },
      "require": { "types": "./dist/adapters/ws.d.cts", "default": "./dist/adapters/ws.cjs" }
    },
    "./http": {
      "import":  { "types": "./dist/http.d.mts", "default": "./dist/http.mjs" },
      "require": { "types": "./dist/http.d.cts", "default": "./dist/http.cjs" }
    },
    "./observable": {
      "import":  { "types": "./dist/observable/index.d.mts", "default": "./dist/observable/index.mjs" },
      "require": { "types": "./dist/observable/index.d.cts", "default": "./dist/observable/index.cjs" }
    },
    "./rpc": {
      "import":  { "types": "./dist/rpc.d.mts", "default": "./dist/rpc.mjs" },
      "require": { "types": "./dist/rpc.d.cts", "default": "./dist/rpc.cjs" }
    },
    "./shared": {
      "import":  { "types": "./dist/shared.d.mts", "default": "./dist/shared.mjs" },
      "require": { "types": "./dist/shared.d.cts", "default": "./dist/shared.cjs" }
    },
    "./unstable-core-do-not-import": {
      "import":  { "types": "./dist/unstable-core-do-not-import.d.mts", "default": "./dist/unstable-core-do-not-import.mjs" },
      "require": { "types": "./dist/unstable-core-do-not-import.d.cts", "default": "./dist/unstable-core-do-not-import.cjs" }
    }
  }
}
```

Why it's the gold standard:

- `"type": "module"` makes bare `.js` files inside the package ESM by default; `.cjs` / `.mjs` extensions explicitly disambiguate the dual outputs.
- Every entry obeys Rules 1–5: `types` first, `default` last, separate `.d.mts` / `.d.cts`, `./package.json` exported, no `module` condition.
- Top-level `main` / `module` / `types` remain as a *belt-and-braces* fallback for tools that haven't implemented `exports` (Jest pre-29, some IDEs).
- An "unstable-" prefixed subpath signals private API while still being importable for monorepo siblings.

---

## 5. The Minimal ESM-Only Shape — Vercel AI v7 Pattern

If you're targeting Node 20+ and modern bundlers exclusively, you can skip CJS entirely. This drops half the build steps and half the declaration files.

```jsonc
// from vercel/ai @ packages/ai/package.json
// https://github.com/vercel/ai/blob/main/packages/ai/package.json
{
  "name": "ai",
  "type": "module",
  "sideEffects": false,
  "main":   "./dist/index.js",
  "types":  "./dist/index.d.ts",
  "source": "./src/index.ts",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "types":   "./dist/index.d.ts",
      "import":  "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./internal": {
      "types":   "./dist/internal/index.d.ts",
      "import":  "./dist/internal/index.js",
      "default": "./dist/internal/index.js"
    },
    "./test": {
      "types":   "./dist/test/index.d.ts",
      "import":  "./dist/test/index.js",
      "default": "./dist/test/index.js"
    }
  },
  "engines": { "node": ">=18" }
}
```

Annotations:

- No `require` branch — consumers in CJS land get a clear `ERR_REQUIRE_ESM` instead of a broken require-of-ESM. Node 22.12+ supports `require(esm)` natively, so the friction is decreasing.
- A single `.d.ts` is fine because there's only one runtime format. The `types` key sits next to `import` at the same depth (not nested) since both branches resolve to the same artifact.
- `"./internal"` is a deliberate escape hatch — semver-volatile but importable.
- `"./test"` ships test doubles (mock streams, fixtures); consumers' tests can `import { simulateReadableStream } from 'ai/test'`.

---

## 6. Subpath Exports for Plugin Entry Points

When your SDK has framework adapters, optional plugins, or per-runtime entry files, each gets its own subpath. There are three patterns:

### 6.1. Flat enumerated subpaths (Inngest)

```jsonc
// from inngest/inngest-js @ packages/inngest/package.json
// https://github.com/inngest/inngest-js/blob/main/packages/inngest/package.json
"exports": {
  ".": {
    "types":   { "import": "./index.d.ts",        "require": "./index.d.cts" },
    "import":  "./index.js",
    "require": "./index.cjs"
  },
  "./astro":      { "types": { "import": "./astro.d.ts",      "require": "./astro.d.cts" },      "import": "./astro.js",      "require": "./astro.cjs" },
  "./bun":        { "types": { "import": "./bun.d.ts",        "require": "./bun.d.cts" },        "import": "./bun.js",        "require": "./bun.cjs" },
  "./cloudflare": { "types": { "import": "./cloudflare.d.ts", "require": "./cloudflare.d.cts" }, "import": "./cloudflare.js", "require": "./cloudflare.cjs" },
  "./edge":       { "types": { "import": "./edge.d.ts",       "require": "./edge.d.cts" },       "import": "./edge.js",       "require": "./edge.cjs" },
  "./express":    { "types": { "import": "./express.d.ts",    "require": "./express.d.cts" },    "import": "./express.js",    "require": "./express.cjs" },
  "./fastify":    { "types": { "import": "./fastify.d.ts",    "require": "./fastify.d.cts" },    "import": "./fastify.js",    "require": "./fastify.cjs" },
  "./h3":         { "types": { "import": "./h3.d.ts",         "require": "./h3.d.cts" },         "import": "./h3.js",         "require": "./h3.cjs" },
  "./next":       { "types": { "import": "./next.d.ts",       "require": "./next.d.cts" },       "import": "./next.js",       "require": "./next.cjs" },
  "./remix":      { "types": { "import": "./remix.d.ts",      "require": "./remix.d.cts" },      "import": "./remix.js",      "require": "./remix.cjs" },
  "./sveltekit":  { "types": { "import": "./sveltekit.d.ts",  "require": "./sveltekit.d.cts" },  "import": "./sveltekit.js",  "require": "./sveltekit.cjs" },
  "./hono":       { "types": { "import": "./hono.d.ts",       "require": "./hono.d.cts" },       "import": "./hono.js",       "require": "./hono.cjs" }
  // ... 20+ more adapters
}
```

Why interesting: Inngest demonstrates the "types-by-condition" inverted layout — `types` is the *outer* key, with `import`/`require` nested *inside* it. This shape is equivalent to the tRPC shape (TS sees the right `.d.ts` per consumer mode) but reads top-down by concern (types | runtime). Both are valid; `publint` accepts either as long as `types` is encountered first in any matching chain.

Hono follows the same flat-enumeration approach with even more entries (~120 subpaths) — every middleware (`./cors`, `./jwt`, `./logger`, `./cache`, `./csrf`, ...) and every preset is its own importable entry. Each plugin gets a dedicated `dist/cjs/...` mirror so the require branch always lands on a `.js` file (not `.cjs` — Hono uses extension-less ESM with sibling `dist/cjs/` for require). See `tsdown-bundling.md` for the matching build-side configuration.

### 6.2. Wildcard subpath (Zustand)

```jsonc
// from pmndrs/zustand @ package.json
// https://github.com/pmndrs/zustand/blob/main/package.json
"exports": {
  "./package.json": "./package.json",
  ".": {
    "react-native": { "types": "./index.d.ts",       "default": "./index.js" },
    "import":       { "types": "./esm/index.d.mts",  "default": "./esm/index.mjs" },
    "default":      { "types": "./index.d.ts",       "default": "./index.js" }
  },
  "./*": {
    "react-native": { "types": "./*.d.ts",       "default": "./*.js" },
    "import":       { "types": "./esm/*.d.mts",  "default": "./esm/*.mjs" },
    "default":      { "types": "./*.d.ts",       "default": "./*.js" }
  }
}
```

The `"./*"` pattern lets consumers `import { shallow } from 'zustand/shallow'` without enumerating every middleware. The `*` on the left captures one path segment; the `*` on the right is substituted into each target. This is great for libraries with many small modules, but has tradeoffs:

- Every file inside `dist/` becomes publicly importable — your private internals leak unless you exclude them via `files` or a more constrained pattern (`./middleware/*` rather than `./*`).
- `attw --pack` cannot enumerate wildcard entries, so coverage of the validator is partial.

Most SDK authors prefer enumeration (Inngest, tRPC, Hono) over wildcards (Zustand) for these reasons.

### 6.3. Per-runtime subpath split

When a single plugin needs different code per runtime (e.g. `./cloudflare` uses `caches.default`, `./node` uses `node:fs`), give each its own subpath and let the user pick. Don't try to express runtime forking *inside* a single subpath unless the implementations are tiny shims — see §7 for when runtime conditions are appropriate.

---

## 7. Isomorphic Conditions — Sanity Client Pattern

When the *same* import (`@sanity/client`) must resolve to different code per runtime — browser uses `fetch`, Node uses `http`, edge uses Fetch-with-no-keepalive — use runtime conditions inside a single subpath:

```jsonc
// from sanity-io/client @ package.json
// https://github.com/sanity-io/client/blob/main/package.json
"exports": {
  ".": {
    "source":           "./src/index.ts",
    "browser": {
      "source":  "./src/index.browser.ts",
      "import":  "./dist/index.browser.js",
      "require": "./dist/index.browser.cjs"
    },
    "react-native": {
      "import":  "./dist/index.browser.js",
      "require": "./dist/index.browser.cjs"
    },
    "sanity-function": "./dist/index.browser.js",
    "react-server":    "./dist/index.browser.js",
    "bun":             "./dist/index.browser.js",
    "deno":            "./dist/index.browser.js",
    "edge":            "./dist/index.browser.js",
    "edge-light":      "./dist/index.browser.js",
    "worker":          "./dist/index.browser.js",
    "import":          "./dist/index.js",
    "require":         "./dist/index.cjs",
    "default":         "./dist/index.js"
  },
  "./csm": {
    "source":  "./src/csm/index.ts",
    "import":  "./dist/csm.js",
    "require": "./dist/csm.cjs",
    "default": "./dist/csm.js"
  },
  "./stega": {
    "source":  "./src/stega/index.ts",
    "browser": {
      "source":  "./src/stega/index.ts",
      "import":  "./dist/stega.browser.js",
      "require": "./dist/stega.browser.cjs"
    },
    "import":  "./dist/stega.js",
    "require": "./dist/stega.cjs",
    "default": "./dist/stega.js"
  },
  "./media-library": {
    "source":  "./src/media-library.ts",
    "import":  "./dist/media-library.js",
    "require": "./dist/media-library.cjs",
    "default": "./dist/media-library.js"
  },
  "./package.json": "./package.json"
}
```

Reading order — for the root entry `.`, with first-match-wins semantics:

1. A bundler with `"source"` in its condition set (some plugin pipelines) sees raw TS.
2. A browser bundler matches `"browser"` — nested `import`/`require` picks ESM vs CJS within the browser build.
3. React Native's Metro matches `"react-native"`.
4. Sanity Functions runtime matches `"sanity-function"`.
5. React Server Components match `"react-server"` (the same browser bundle works because RSC has no Node-only APIs).
6. Bun, Deno, Edge (Vercel/Cloudflare), Workers all match their respective conditions and get the browser bundle.
7. Only after *every* alternate runtime has been ruled out does Node ESM (`import`) get `./dist/index.js`, and Node CJS (`require`) get `./dist/index.cjs`.

This is the canonical *isomorphic* shape. A few discipline points:

- **Most-specific runtimes go first.** `"react-server"` and `"workerd"` are more specific than `"browser"`; put them earlier. `"node"` is the catch-all for backend and goes near the end.
- **`"default"` is always last.** Note that Sanity uses `"./dist/index.js"` for `default` (matching ESM `import`) — this guards Deno-style consumers that send no specific condition.
- **`"source"` is unofficial** but widely used by Metro, some Vite plugins, and `tsup`'s dev pipeline to map back to TS. Safe to include; safe to omit.

### 7.1. Condition matching cheat-sheet

| Runtime / tool | Conditions presented (in order) |
| --- | --- |
| Node 20+ ESM        | `node`, `import`, `module-sync`*, `default` |
| Node 20+ CJS        | `node`, `require`, `default` |
| Cloudflare Workers (Wrangler) | `workerd`, `worker`, `browser`, `import`, `default` |
| Vercel Edge Runtime | `edge-light`, `worker`, `browser`, `import`, `default` |
| Bun                 | `bun`, `node`, `import`, `default` |
| Deno (npm:)         | `deno`, `node`, `import`, `default` |
| React Native (Metro)| `react-native`, `browser`, `import`, `default` |
| Vite (SSR)          | `node`, `import`, `default` |
| Vite (client)       | `browser`, `import`, `default` |
| Webpack 5 (web)     | `browser`, `module`, `import`, `default` |
| Webpack 5 (node)    | `node`, `module`, `import`, `default` |
| Next.js RSC server  | `react-server`, `node`, `import`, `default` |
| TypeScript          | `types` (plus the matching runtime conditions per `module` setting) |

\* `module-sync` is presented only when the consumer is CJS and the package opts in — see §8.

---

## 8. `module-sync` and Other Modern Conditions

Node 22.10 introduced [`module-sync`](https://nodejs.org/api/packages.html#conditional-exports), a condition designed to let a CJS consumer synchronously `require()` an ESM module if (and only if) that module has no top-level `await`. Pattern:

```jsonc
".": {
  "import":      { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
  "module-sync": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" },
  "require":     { "types": "./dist/index.d.cts", "default": "./dist/index.cjs" }
}
```

Should you adopt it? In late 2026, the equation is:

- **Yes, if** you ship dual ESM+CJS already and your ESM build has no top-level `await`. It costs one extra key and lets Node 22.12+ consumers skip a CJS round-trip — important for cold-start-sensitive workloads.
- **No, if** you're ESM-only — `require(esm)` works without `module-sync` on Node 22.12+, and earlier versions can't use the feature anyway.
- **Skip if uncertain** — the rest of the ecosystem (bundlers, older Node) ignores `module-sync` gracefully.

Other modern conditions worth knowing:

- `"development"` / `"production"` — gated builds; React, Preact, MobX use these for dev-only warnings. Less common in SDKs.
- `"react-server"` — Next.js / React 19 RSC marker. Set this if your package has a server-only entry that uses `React.cache`, `next/headers`, etc.
- `"workerd"` — Cloudflare Workers' V8 isolate runtime (specifically `workerd`, the open-source runtime under Wrangler). More specific than `"worker"`.
- `"edge-light"` — Vercel's flag for Edge Functions and Edge Middleware. Used by `next/server`, `vercel`.

---

## 9. Common Mistakes — Bad → Fixed → Why

### 9.1. Wrong condition order

```jsonc
// BAD
".": {
  "default": "./dist/index.mjs",
  "node":    "./dist/index.node.mjs",
  "browser": "./dist/index.browser.mjs"
}
```

```jsonc
// FIXED
".": {
  "browser": "./dist/index.browser.mjs",
  "node":    "./dist/index.node.mjs",
  "default": "./dist/index.mjs"
}
```

Why: First-match-wins means `default` short-circuits everything declared after it. Place specific runtimes first, `default` last.

### 9.2. Masquerading ESM (`.js` containing ESM in a CJS package)

```jsonc
// BAD — package without "type": "module" but ESM contents in .js
{
  "exports": { ".": { "import": "./dist/index.js" } }   // <-- .js, not .mjs
  // "type" missing, defaults to "commonjs"
}
// Result: Node treats ./dist/index.js as CJS, parser fails on `import` statements.
```

```jsonc
// FIXED — either:
{ "type": "module", "exports": { ".": { "import": "./dist/index.js" } } }
// or:
{ "exports": { ".": { "import": "./dist/index.mjs" } } }
```

Why: Node's parser mode is determined by the *nearest `package.json`'s `"type"` field*, not by the file path inside `exports`. `attw` flags this as `FalseESM` / `FalseCJS`.

### 9.3. Missing `node10` types fallback

```jsonc
// BAD — TS with `moduleResolution: "node"` (old style) sees no types
{
  "exports": { ".": { "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" } } }
}
// Result: consumer on `moduleResolution: node` gets "Could not find a declaration file."
```

```jsonc
// FIXED — add top-level `types` as the legacy fallback
{
  "types":   "./dist/index.d.ts",
  "exports": { ".": { "import": { "types": "./dist/index.d.mts", "default": "./dist/index.mjs" } } }
}
```

Why: `moduleResolution: "node"` (TS pre-4.7 default) doesn't read `exports`; it falls back to the top-level `types`/`typings` field. Keep both — the `exports` types for modern TS, the top-level `types` for legacy.

### 9.4. Stale `typesVersions` from the pre-`exports` era

```jsonc
// BAD — typesVersions duplicates and contradicts exports
{
  "exports": { "./plugin": { "types": "./dist/plugin.d.ts", "import": "./dist/plugin.js" } },
  "typesVersions": { "*": { "plugin": ["./dist/plugin/legacy.d.ts"] } }   // contradicts!
}
```

```jsonc
// FIXED — delete typesVersions once exports covers every subpath
{
  "exports": { "./plugin": { "types": "./dist/plugin.d.ts", "import": "./dist/plugin.js" } }
}
```

Why: `typesVersions` was the pre-4.7 workaround for "TypeScript can't find types for subpath imports." It's now redundant if your `exports` types are correctly placed. Keep `typesVersions` only if you must support TS < 4.7.

### 9.5. Forgetting `./package.json`

```jsonc
// BAD — Yarn PnP, attw, pkg-pr-new all fail with ERR_PACKAGE_PATH_NOT_EXPORTED
{ "exports": { ".": { ... } } }
```

```jsonc
// FIXED
{
  "exports": {
    "./package.json": "./package.json",
    ".": { ... }
  }
}
```

Why: Any tool that programmatically reads your `package.json` (to print the version, lint peer deps, etc.) needs the entry. Cost: one line. Benefit: avoids cryptic resolution errors in CI for downstream consumers.

### 9.6. `null` to block accidental matches

Subtle case: if your package has *no* CJS at all, explicitly null-out the `require` branch so a CJS consumer gets a clean error instead of the ESM file (which would then fail to parse):

```jsonc
".": {
  "import":  "./dist/index.mjs",
  "require": null
}
```

`attw` flags this as `MissingExportEquals` if you do this *and* still have a top-level `main`. Decide: either ESM-only with no `main`, or dual with both branches.

---

## 10. Validation Workflow

Three local checks should pass before every publish:

1. **Resolve manually with Node** — fast smoke test, no install needed:

   ```bash
   # Inside the package root (or after `npm pack && cd <extracted>`):
   node --conditions=import --print "require.resolve('./dist/index.mjs')"
   node --input-type=module -e "import('./dist/index.mjs').then(m => console.log(Object.keys(m)))"
   node -e "console.log(Object.keys(require('./dist/index.cjs')))"
   ```

   If any of those throws `ERR_PACKAGE_PATH_NOT_EXPORTED` or `ERR_REQUIRE_ESM`, your `exports` map is wrong.

2. **Pack-and-unpack test in a sandbox** — confirms the *published tarball* (not just your workspace) resolves correctly:

   ```bash
   npm pack
   mkdir -p /tmp/exports-check && cd /tmp/exports-check
   npm init -y && npm install /path/to/your-pkg-x.y.z.tgz
   node -e "console.log(require('your-pkg'))"
   node --input-type=module -e "import('your-pkg').then(m => console.log(m))"
   ```

3. **Run `publint` and `attw --pack`** — these tools walk every leaf of `exports`, run a TS type-resolution simulation per module mode, and report violations against the rules in §3 and §9. See `verification-and-publishing.md` for the exact flags, CI integration, and how to interpret each diagnostic.

---

## Further Reading

- Node.js docs — Conditional exports: https://nodejs.org/api/packages.html#conditional-exports
- `publint` rule index: https://publint.dev/rules
- Are The Types Wrong? FAQ: https://arethetypeswrong.github.io/?p=faq
- Modern Guide to Packaging JS Libraries: https://github.com/frehner/modern-guide-to-packaging-js-library
- TypeScript 4.7 release notes (the `exports` `types` condition): https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-7.html#packagejson-exports-imports-and-self-referencing

For matching the `exports` map to actual `dist/` artifacts, including how to emit paired `.mjs`/`.cjs` and `.d.mts`/`.d.cts`, see `tsdown-bundling.md`. For pre-publish validation, see `verification-and-publishing.md`.
