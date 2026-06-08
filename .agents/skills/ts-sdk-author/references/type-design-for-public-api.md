# Type Design for SDK Public API

Type design for a published SDK is not the same job as type design for application code. An app's types are consumed by the team that wrote them; an SDK's types are consumed by strangers reading auto-generated `.d.ts` on first encounter. Three constraints follow:

1. **Don't leak internals.** Every exported symbol becomes API — helper unions, "convenience" aliases, re-exports all count.
2. **Stay evolvable.** Each exported type is a contract. Generic params need defaults, options bags need optional fields, discriminated unions need an escape valve.
3. **Be inferable.** Users should not have to manually annotate generics for 80% of calls. If `client.users.get('123')` requires `client.users.get<User>('123')`, the design failed.

---

## 1. Branded Types for Domain Modeling

Motivation: prevent callers from passing a raw `string` where you meant `UserId`, or swapping `UserId` and `OrderId`. The compiler treats them as the same primitive otherwise.

```typescript
// Phantom (compile-time only) brand. No runtime cost.
type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId  = Brand<string, "UserId">;
export type OrderId = Brand<number, "OrderId">;
export type Email   = Brand<string, "Email">;
export type Url     = Brand<string, "Url">;

// Smart constructors validate at the boundary, then cast inside.
export function toUserId(id: string): UserId {
  if (!/^usr_[a-z0-9]{12}$/.test(id)) throw new TypeError("Invalid UserId");
  return id as UserId;
}
export function toEmail(s: string): Email {
  if (!s.includes("@")) throw new TypeError("Invalid Email");
  return s as Email;
}

// Type-guard variant — narrow without throwing.
export function isUserId(v: string): v is UserId {
  return /^usr_[a-z0-9]{12}$/.test(v);
}

declare function getOrder(userId: UserId, orderId: OrderId): Promise<unknown>;
// getOrder("abc" as string, 1 as number) — type error: neither is branded.
```

**Phantom vs runtime tag.** The `__brand` field is phantom only — doesn't exist at runtime, zero bytes, serializes cleanly to JSON. A runtime tag (`{ value: string; kind: "UserId" }`) catches more bugs but breaks JSON interop and forces unwrapping. SDKs should prefer phantom brands and validate at deserialization boundaries.

**Symbol brands** are stricter (two libraries can't collide by accident):

```typescript
declare const userIdBrand: unique symbol;
export type UserId = string & { readonly [userIdBrand]: void };
```

**Anti-pattern:** exporting the `Brand<T,B>` helper publicly. It becomes API and any change is breaking. Keep `Brand` internal; export only concrete branded aliases.

---

## 2. Generic API Surfaces

Generics are how SDK types stay useful across the universe of user schemas you don't know yet. Goal: **maximum inference, minimum annotation.**

### Generic client with schema parameter

```typescript
export interface SchemaShape {
  readonly [resource: string]: { readonly [op: string]: unknown };
}

export function createClient<Schema extends SchemaShape>(baseUrl: string) {
  return {
    call<R extends keyof Schema, O extends keyof Schema[R]>(
      resource: R,
      op: O,
      input: Schema[R][O],
    ): Promise<unknown> {
      return fetch(`${baseUrl}/${String(resource)}/${String(op)}`, {
        method: "POST",
        body: JSON.stringify(input),
      }).then((r) => r.json());
    },
  };
}

type MySchema = {
  users:  { get: { id: string }; create: { name: string } };
  orders: { list: { userId: string } };
};
const client = createClient<MySchema>("https://api.example.com");
client.call("users", "get",    { id: "u1" });    // OK
client.call("users", "get",    { name: "bad" }); // type error
client.call("users", "delete", { id: "u1" });    // type error
```

### Generic defaults prevent breaking changes

```typescript
// V1
export type ApiResponse<T> = { ok: true; data: T } | { ok: false; error: string };

// V2 BREAKING — required new param.
export type ApiResponse<T, E> = { ok: true; data: T } | { ok: false; error: E };

// V2 NON-BREAKING — defaulted new param.
export type ApiResponse<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; error: E };
```

**Rule:** every generic added after 1.0 needs a default. Adding a required generic is a major-version break.

### Generic constraints

```typescript
export interface Entity { readonly id: string }

export interface Repository<T extends Entity> {
  find(id: T["id"]): Promise<T | null>;
  findAll(): Promise<readonly T[]>;
  create(data: Omit<T, "id">): Promise<T>;
  update(id: T["id"], data: Partial<Omit<T, "id">>): Promise<T>;
  delete(id: T["id"]): Promise<void>;
}

export function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
```

### Inference tradeoffs

| Pattern | Inferred? |
|---|---|
| `fn<T>(x: T)` | yes — from argument |
| `fn<T>(): T` | no — user must annotate |
| `fn<T>(x: { value: T })` | yes — inside argument |
| `fn<T extends string>(x: T)` | yes — preserves literal |
| `class C<T> {}` | no — must be set at `new C<T>()` |

Put generics on call sites, not construct sites, when you want zero-annotation usage:

```typescript
// BAD — annotation required per call.
export class Store<T> { get(key: string): T { /* ... */ return null as never } }
new Store<User>().get("k");

// GOOD — generic on method, inferred from a runtime carrier.
export class TypedStore {
  get<T>(key: string, schema: Schema<T>): T { /* ... */ return null as never }
}
typedStore.get("k", UserSchema); // inferred
```

---

## 3. Conditional & Mapped Types

These derive user-facing types from a single source of truth — a schema, a route table, a function signature.

### Conditional types & `infer`

```typescript
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
type R1 = UnwrapPromise<Promise<User>>; // User

// Distributive — applies per union member.
type ToArray<T> = T extends unknown ? T[] : never;
type X = ToArray<string | number>; // string[] | number[]

// Non-distributive — wrap in tuple to pin to single union.
type ToArrayMono<T> = [T] extends [unknown] ? T[] : never;
type Y = ToArrayMono<string | number>; // (string | number)[]

// Recursive flatten.
type Flatten<T> =
  T extends Array<infer U>
    ? U extends Array<unknown> ? Flatten<U> : U
    : T;
type F = Flatten<string[][][]>; // string
```

### Mapped types & key remapping

```typescript
export type Frozen<T> = { readonly [K in keyof T]: T[K] };

type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };
type UG = Getters<{ name: string; age: number }>;
// { getName: () => string; getAge: () => number }

export type PickByType<T, U> = {
  [K in keyof T as T[K] extends U ? K : never]: T[K];
};
```

### Template literal types for URL parsing

```typescript
export type ExtractRouteParams<S extends string> =
  S extends `${string}/:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & ExtractRouteParams<`/${Rest}`>
    : S extends `${string}/:${infer Param}`
      ? { [K in Param]: string }
      : {};

type P = ExtractRouteParams<"/users/:id/posts/:postId">;
// { id: string; postId: string }

export function get<Path extends string>(
  path: Path,
  params: ExtractRouteParams<Path>,
): Promise<unknown> {
  let url = path as string;
  for (const [k, v] of Object.entries(params)) url = url.replace(`:${k}`, v as string);
  return fetch(url).then((r) => r.json());
}

get("/users/:id", { id: "u1" });   // OK
get("/users/:id", { wrong: "x" }); // type error
```

### Full type-safe REST client

```typescript
type ApiEndpoints = {
  "/users": {
    GET:  { response: User[] };
    POST: { body: CreateUserDto; response: User };
  };
  "/users/:id": {
    GET:    { params: { id: string }; response: User };
    PUT:    { params: { id: string }; body: UpdateUserDto; response: User };
    DELETE: { params: { id: string }; response: void };
  };
};

type Options<S> =
  & (S extends { body:   infer B } ? { body:   B } : unknown)
  & (S extends { params: infer P } ? { params: P } : unknown)
  & (S extends { query:  infer Q } ? { query:  Q } : unknown);

export class ApiClient {
  request<P extends keyof ApiEndpoints, M extends keyof ApiEndpoints[P]>(
    method: M, path: P, options: Options<ApiEndpoints[P][M]>,
  ): Promise<ApiEndpoints[P][M] extends { response: infer R } ? R : never> {
    return null as never;
  }
}
const c = new ApiClient();
await c.request("GET",  "/users", {});                                   // User[]
await c.request("GET",  "/users/:id", { params: { id: "1" } });          // User
await c.request("POST", "/users", { body: { name: "n", email: "e" } });  // User
```

---

## 4. Type Guards & Discriminated Unions

Public type guards define how users branch on your data. Design them deliberately.

### Result type — the SDK's universal return shape

```typescript
export type Result<T, E = SdkError> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: E };

export const ok  = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// User narrows cleanly with one branch:
const r = await sdk.users.get(id);
if (r.ok) r.value.email; else r.error.code;
```

The SDK never throws for *expected* failures — it returns `Result`. Throw only for programmer errors (bad arguments, invariant violations).

### Exhaustiveness helper

```typescript
export function assertNever(x: never): never {
  throw new Error(`Unhandled: ${JSON.stringify(x)}`);
}

type Event =
  | { kind: "open" }
  | { kind: "message"; data: string }
  | { kind: "close"; reason: string };

function handle(e: Event) {
  switch (e.kind) {
    case "open":    return;
    case "message": return e.data;
    case "close":   return e.reason;
    default:        return assertNever(e); // catches new variants at compile time
  }
}
```

Ship `assertNever` publicly — users will need it when branching on your unions.

### Type predicates & assertion functions

```typescript
// Predicate — narrows via return type.
export function isError<T>(r: Result<T>): r is { ok: false; error: SdkError } {
  return r.ok === false;
}
export function isNonEmpty<T>(arr: readonly T[]): arr is readonly [T, ...T[]] {
  return arr.length > 0;
}

// Assertion form — narrows via `asserts`, throws otherwise.
export function assertIsDefined<T>(v: T): asserts v is NonNullable<T> {
  if (v === null || v === undefined) throw new Error("Expected value");
}
export function assertIsEmail(s: string): asserts s is Email {
  if (!s.includes("@")) throw new TypeError("Not an email");
}
```

**Pitfall:** assertion functions require an *explicit* `asserts` return-type annotation; TS will not infer it. Forgetting it breaks narrowing silently.

---

## 5. The Builder Pattern for Config

SDKs commonly expose a config builder: `createClient().withRetry(3).withTimeout(5000).build()`. Use `this`-typing for fluency.

```typescript
interface RequestOptions {
  url: string;
  method: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
}

export class RequestBuilder {
  private data: Partial<RequestOptions> = {};
  url(u: string):    this { this.data.url = u; return this }
  method(m: RequestOptions["method"]): this { this.data.method = m; return this }
  body(b: unknown):  this { this.data.body = b; return this }
  timeout(ms: number): this { this.data.timeoutMs = ms; return this }
  build(): RequestOptions {
    if (!this.data.url || !this.data.method) throw new Error("url and method required");
    return this.data as RequestOptions;
  }
}
```

### Compile-time required fields (advanced)

```typescript
type Builder<T, Set extends keyof T = never> = {
  [P in Exclude<keyof T, Set> as `set${Capitalize<string & P>}`]:
    (v: T[P]) => Builder<T, Set | P>;
} & {
  build: [Exclude<keyof T, Set>] extends [never] ? () => T : never;
};
```

Trade-off: heavy types, ugly tooltips. For most SDKs, runtime checks on a `Partial<Config>` are friendlier. Reserve type-tracked builders for genuinely critical config (e.g., security keys).

### Pre-defined profiles often beat builders

```typescript
export const presets = {
  fast:   { timeoutMs: 1_000,  retries: 0 },
  robust: { timeoutMs: 30_000, retries: 5 },
} as const;

export function createClient(opts: {
  apiKey: string;
  preset?: keyof typeof presets;
  overrides?: Partial<typeof presets["robust"]>;
}) { /* ... */ }
```

Use the simplest tool that fits.

---

## 6. Utility Types: What to Ship, What to Keep Internal

Built-ins (`Partial`, `Pick`, `Omit`, `Awaited`, `ReturnType`, `Parameters`, `NonNullable`) are in the lib — use them freely inside your code. The question is which *custom* ones to re-export.

| Utility | Built-in | Ship? | Reason |
|---|---|---|---|
| `Partial<T>`, `Pick`, `Omit`, `Awaited` | yes | n/a | Already in lib |
| `DeepPartial<T>` | no | maybe | Useful for config diffing |
| `DeepReadonly<T>` | no | maybe | If you return frozen objects |
| `Prettify<T>` | no | NO | Tooltip cosmetic; internal only |
| `RequireAtLeastOne<T>` | no | yes | Express "at least one of" options |
| `RequireExactlyOne<T>` | no | yes | Express "exactly one of" / XOR options |
| `Mutable<T>` | no | rare | Mostly internal |
| `Brand<T, B>` | no | NO | Keep internal; export concrete brands |
| `ValueOf<T>` | no | yes | Useful for enum-like consts |
| `Nullable<T>` | no | yes | Common enough to standardize one form |

```typescript
export type DeepReadonly<T> = T extends (...a: never[]) => unknown
  ? T
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;

export type RequireAtLeastOne<T, K extends keyof T = keyof T> =
  Omit<T, K> &
  { [P in K]-?: Required<Pick<T, P>> & Partial<Pick<T, Exclude<K, P>>> }[K];

export type RequireExactlyOne<T, K extends keyof T = keyof T> =
  Omit<T, K> &
  { [P in K]-?: Required<Pick<T, P>> & Partial<Record<Exclude<K, P>, never>> }[K];

export type ValueOf<T> = T[keyof T];
export type Nullable<T> = T | null | undefined;

// Internal only — never export.
type Prettify<T> = { [K in keyof T]: T[K] } & {};
```

Anti-pattern: re-exporting `Prettify`. It's a TS-compiler-version-sensitive cosmetic; users would depend on intersection-flattening behavior.

---

## 7. tsconfig for Libraries

A library tsconfig differs from an app tsconfig. Goal: **emit clean, portable, fast-to-consume `.d.ts`.**

### Core library tsconfig.json

```jsonc
{
  "compilerOptions": {
    // Target — the lowest you support. ES2020 is safe.
    "target": "ES2020",
    "lib": ["ES2020"],

    // Module — match your package.json "type" and consumer environments.
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,

    // Strictness — non-negotiable for library code.
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,

    // Emit — libraries always emit declarations.
    "declaration": true,
    "declarationMap": true,         // go-to-def into your source
    "sourceMap": true,
    "removeComments": false,         // keep JSDoc in .d.ts
    "stripInternal": true,           // omit /** @internal */ from .d.ts
    "outDir": "./dist",
    "rootDir": "./src",

    // Isolation — required for fast tools (esbuild, swc).
    "isolatedModules": true,
    "verbatimModuleSyntax": true,    // TS 5.0+: explicit type/value imports
    "isolatedDeclarations": true,    // TS 5.5+: explicit annotations on exports

    "incremental": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts", "**/*.spec.ts"]
}
```

### Flag reference for libraries

| Flag | Purpose |
|---|---|
| `declaration: true` | Emit `.d.ts` — mandatory |
| `declarationMap: true` | Source-map `.d.ts` back to source |
| `sourceMap: true` | Debug into your sources from node_modules |
| `composite: true` | Project references; implies `declaration` + `incremental` |
| `incremental: true` | Cache type info between builds |
| `stripInternal: true` | Omit `/** @internal */` symbols from emitted `.d.ts` |
| `isolatedModules: true` | Catch code bundlers can't transpile per-file |
| `verbatimModuleSyntax: true` | TS 5.0+: force `import type` discipline |
| `isolatedDeclarations: true` | TS 5.5+: every export must have explicit type |
| `skipLibCheck: true` | Skip checking other libs' `.d.ts` — much faster |
| `exactOptionalPropertyTypes: true` | `foo?: T` excludes `undefined` from value |
| `noUncheckedIndexedAccess: true` | `arr[0]` becomes `T \| undefined` — safer surface |

### `verbatimModuleSyntax` (TS 5.0+)

Forces explicit type-vs-value imports. With `isolatedModules`, mixed imports break under modern bundlers and ESM-only environments.

```typescript
// WRONG under verbatimModuleSyntax
import { User, getUser } from "./users";

// RIGHT
import type { User } from "./users";
import { getUser } from "./users";
// or combined
import { type User, getUser } from "./users";

// Re-exports must also discriminate.
export type { User } from "./users";
export { getUser } from "./users";
```

If you accidentally value-import a type, TS emits a runtime reference to a non-existent export. The flag forces correctness.

### `isolatedDeclarations` (TS 5.5+)

Requires every exported symbol to carry an explicit type annotation. `.d.ts` generation becomes deterministic and parallelizable via tools like `swc` and `oxc`. Library builds get dramatically faster.

```typescript
// REJECTED — return type inferred.
export function getUser(id: string) { return db.users.find(id); }

// ACCEPTED — explicit.
export function getUser(id: string): Promise<User | null> { return db.users.find(id); }

// Class fields too.
export class Client {
  baseUrl = "https://api.example.com";              // BAD
  baseUrl: string = "https://api.example.com";      // GOOD
}
```

Trade-off: more typing. Benefit: parallel `.d.ts` emit; signatures become self-documenting. **For libraries published to npm, set `isolatedDeclarations: true`.**

### Project references for monorepos

```jsonc
// repo/tsconfig.json — solution-style root.
{ "files": [], "references": [
  { "path": "./packages/core" },
  { "path": "./packages/transport" },
  { "path": "./packages/sdk" }
] }

// repo/packages/sdk/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "composite": true, "outDir": "./dist", "rootDir": "./src" },
  "references": [{ "path": "../core" }, { "path": "../transport" }],
  "include": ["src/**/*"]
}
```

Build with `tsc --build`. Each package gets independent `.d.ts` emit; incremental builds skip untouched graphs.

---

## 8. API Evolution Patterns

### Deprecation markers

```typescript
/**
 * @deprecated Use {@link createClient}. Removed in v3.
 */
export function makeClient(opts: ClientOptions): Client { return null as never }

export interface ClientOptions {
  apiKey: string;
  /** @deprecated ignored as of v2.4 */
  legacy?: boolean;
}
```

`@deprecated` is read by the TS language service — editors render struck-through.

### Versioned subpaths

```jsonc
// package.json
{
  "name": "@example/sdk",
  "exports": {
    ".":   { "types": "./dist/index.d.ts",    "default": "./dist/index.js" },
    "./v1":{ "types": "./dist/v1/index.d.ts", "default": "./dist/v1/index.js" },
    "./v2":{ "types": "./dist/v2/index.d.ts", "default": "./dist/v2/index.js" }
  }
}
```

Users opt in: `import { Client } from "@example/sdk/v2"`. Allows side-by-side migration.

### Open discriminated unions

Closed unions break consumers' exhaustive switches when you extend them.

```typescript
// V1 — closed; V2 adds "error" → all switches break.
export type Event = { kind: "open" } | { kind: "close" };

// Mitigations:
// (a) document that the union is open; require a `default` branch.
// (b) include an escape-hatch variant from day one:
export type Event2 =
  | { kind: "open" }
  | { kind: "close" }
  | { kind: string; [key: string]: unknown };
```

Trade-off: loss of exhaustiveness in the open case. Document the policy.

### Interfaces vs type aliases for public types

```typescript
// Interface — augmentable by users via module augmentation.
export interface ClientOptions { apiKey: string; }

// User-side plugin:
declare module "@example/sdk" {
  interface ClientOptions { pluginOption?: string; }
}

// Type alias — cannot be augmented.
export type ClientOptionsT = { apiKey: string };
```

**Rule of thumb:**
- `interface` for object shapes plugins may augment (transport options, request context, error metadata).
- `type` for unions, conditionals, tuples, mapped types — anything that isn't a plain object shape.
- `interface` also performs better for large object types (TS caches them more aggressively).

---

## 9. Anti-Patterns

### Leaking internal types

```typescript
// BAD — internal helper accidentally exported.
export type _InternalMapHelper<K, V> = Map<K, V> & { __magic: true };

// GOOD — keep unexported and use stripInternal.
type InternalMapHelper<K, V> = Map<K, V> & { __magic: true };
export class Cache<K, V> {
  /** @internal */ store!: InternalMapHelper<K, V>;
}
```

### Over-generic helpers inferring to `unknown`

If a generic helper's return type appears as `unknown` in user code, the help is gone. Either tighten the constraints or drop the generic.

```typescript
// BAD
export function pipe<T>(...fns: ((x: any) => any)[]): (x: T) => unknown { /* ... */ return null as never }

// GOOD — recursive tuple types preserve the chain end.
type LastReturn<F extends readonly unknown[]> =
  F extends readonly [...unknown[], (...a: never) => infer R] ? R : never;
export function pipe<T, F extends readonly ((x: never) => unknown)[]>(
  ...fns: F
): (x: T) => LastReturn<F> { return null as never }
```

### `any` in public signatures

```typescript
// BAD — `any` poisons everything downstream.
export function call(method: string, args: any): any { return null as never }

// GOOD — `unknown` forces user narrowing.
export function call(method: string, args: unknown): unknown { return null as never }

// BETTER — generic with default.
export function call<T = unknown>(method: string, args: Record<string, unknown>): Promise<T> { return null as never }
```

### Return types depending on `--strict`

```typescript
// BAD — inferred return narrows under strict, widens otherwise.
export function findUser(id: string) { return db.find(id); }

// GOOD — always explicit.
export function findUser(id: string): User | undefined { return db.find(id); }
```

Users may have `strict: false`. Your public types should not shift shape based on their tsconfig.

### Exporting type aliases where interfaces belong

```typescript
// BAD — users cannot augment.
export type Hooks = {
  beforeRequest?: (req: Req) => void;
  afterResponse?: (res: Res) => void;
};

// GOOD — plugins can augment.
export interface Hooks {
  beforeRequest?: (req: Req) => void;
  afterResponse?: (res: Res) => void;
}
```

### Default export of class for SDK entry

```typescript
// BAD — composes poorly with named exports, barrels, verbatimModuleSyntax.
export default class Sdk {}

// GOOD — named exports compose and tree-shake better.
export class Sdk {}
export type { SdkOptions, SdkResult };
export { createClient, presets };
```

### `enum`

```typescript
// BAD — runtime behavior, bundler pitfalls, reverse-mappings.
export enum Status { Pending, Active, Closed }

// GOOD — const object + `as const` + ValueOf.
export const Status = { Pending: "pending", Active: "active", Closed: "closed" } as const;
export type Status = typeof Status[keyof typeof Status];
// "pending" | "active" | "closed"
```

`enum` is one of TS's most regretted features. Avoid in public SDK API.

---

## 10. Putting It Together — Minimal SDK Skeleton

```typescript
// src/types.ts ---------------------------------------------------------------
type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, "UserId">;
export type Email  = Brand<string, "Email">;

export function toUserId(s: string): UserId { return s as UserId }
export function toEmail(s: string): Email {
  if (!s.includes("@")) throw new TypeError("Bad email");
  return s as Email;
}

export interface User {
  readonly id: UserId;
  readonly email: Email;
  readonly createdAt: string;
}

export type Result<T, E = SdkError> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: E };

export interface SdkError {
  readonly code: "network" | "auth" | "not_found" | "validation" | "server";
  readonly message: string;
  readonly status?: number;
}

// src/client.ts --------------------------------------------------------------
export interface ClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
}

export class Client {
  constructor(private readonly opts: ClientOptions) {}

  async getUser(id: UserId): Promise<Result<User>> {
    try {
      const res = await fetch(`${this.opts.baseUrl ?? "https://api"}/users/${id}`, {
        headers: { authorization: `Bearer ${this.opts.apiKey}` },
      });
      if (res.status === 404) return { ok: false, error: { code: "not_found", message: "no such user" } };
      if (!res.ok)             return { ok: false, error: { code: "server",    message: res.statusText, status: res.status } };
      return { ok: true, value: (await res.json()) as User };
    } catch (e) {
      return { ok: false, error: { code: "network", message: (e as Error).message } };
    }
  }
}

export function createClient(opts: ClientOptions): Client { return new Client(opts) }

// src/index.ts ---------------------------------------------------------------
export type { User, UserId, Email, Result, SdkError, ClientOptions };
export { Client, createClient, toUserId, toEmail };
```

```jsonc
// tsconfig.build.json
{
  "compilerOptions": {
    "target": "ES2020", "module": "NodeNext", "moduleResolution": "NodeNext",
    "strict": true, "noUncheckedIndexedAccess": true, "exactOptionalPropertyTypes": true,
    "isolatedModules": true, "verbatimModuleSyntax": true, "isolatedDeclarations": true,
    "declaration": true, "declarationMap": true, "sourceMap": true, "stripInternal": true,
    "outDir": "./dist", "rootDir": "./src", "skipLibCheck": true, "incremental": true
  },
  "include": ["src/**/*"],
  "exclude": ["**/*.test.ts"]
}
```

```jsonc
// package.json (excerpt)
{
  "name": "@example/sdk",
  "version": "1.0.0",
  "type": "module",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": { "typescript": ">=5.5" }
}
```

What this skeleton demonstrates:

- Branded `UserId`/`Email` enforce domain integrity at API boundaries.
- `Result<T, E>` discriminated union — users branch, never `try/catch` for expected failures.
- `interface` for `ClientOptions` and `User` — augmentable by plugin authors.
- `type` for `Result` and `SdkError` — unions / not for augmentation.
- Named exports only; no default.
- `isolatedDeclarations` forces explicit return types on every public function.
- `verbatimModuleSyntax` keeps imports honest.
- Single entry point, single bundle, deterministic `.d.ts`.

Two hundred lines of TypeScript and one tsconfig. Most published SDKs that do nothing more than this are already in the top quartile for developer experience.
