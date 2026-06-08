# Module Boundaries and Plugins

Use this reference to organize a TypeScript SDK package so it stays coherent as code grows, consumers multiply, and third-party plugins start arriving. The patterns here apply to any SDK whose surface area is wider than a single function: HTTP clients with adapter backends, agent/runtime SDKs with provider pluggability, queue libraries with broker drivers, build tools with loader plugins, etc.

This file focuses on:

- the four-layer mental model that keeps a TypeScript SDK shippable
- the `modules/api/internal` boundary inside `src/`
- runtime layering and one-way dependency direction
- the provider/adapter pattern for swappable integrations
- the plugin extension model and its lifecycle
- enforcement with eslint-plugin-boundaries, dependency-cruiser, and Turborepo `boundaries`
- the most common boundary anti-patterns
- a verification checklist you can run in CI

---

## 1. Overview: The Four-Layer Mental Model

A TypeScript SDK that intends to be embedded, extended, and version-bumped over years should resolve into exactly four conceptual layers. Anything else collapses into one of these four when you squint.

```text
+----------------------------------------------------------+
|  L1  Public API                                          |
|      src/api/* re-exported from src/index.ts             |
|      The only surface a consumer is allowed to import.   |
+----------------------------------------------------------+
|  L2  Internal Logic                                      |
|      src/internal/*, modules/*/internal/*                |
|      Orchestration, state machines, policy. No SDK or    |
|      transport code here.                                |
+----------------------------------------------------------+
|  L3  Providers / Adapters                                |
|      Concrete implementations of ports defined by L2.    |
|      Imported by the composition root, never by L2.      |
+----------------------------------------------------------+
|  L4  Extension Points                                    |
|      Plugin contracts, registries, lifecycle hooks.      |
|      The supported way third parties add capabilities.   |
+----------------------------------------------------------+
```

**Key invariants across the four layers:**

- L1 (Public API) re-exports a curated subset of L2 and the **types** of L3/L4. It never re-exports concrete adapters.
- L2 (Internal Logic) depends only on its own ports plus shared types. It must not import L3 concrete packages or L1 barrel files.
- L3 (Adapters) depends on L2 ports and external SDKs. **Adapters MUST NOT import from `internal/`.**
- L4 (Extension Points) is reached through a `PluginContext` object. Plugins MUST NOT reach across into other plugins' internals.

If you only remember one rule: **layers point downward; types may flow upward; concrete code must not.**

### Architecture Signal Guide

When you look at someone else's SDK source tree, the folder names tell you what architecture they were aiming for:

| Signal | Suggests |
|--------|----------|
| `controllers/`, `services/`, `repositories/` | layered architecture |
| `domain/`, `ports/`, `adapters/` | hexagonal architecture |
| `domain/entities/`, `use_cases/`, `infrastructure/` | clean architecture |
| `modules/<name>/api` + `internal` | modular monolith |

If your `src/` contains all of these simultaneously without a documented rule, the boundaries are accidental and you are mixing patterns. Pick one and rewrite the strays.

---

## 2. The `src/` Boundary: modules/api/internal

For most SDK packages, a modular monolith inside `src/` is the right default. You do not need to publish ten packages to get clean boundaries.

### Recommended Internal Structure

```text
packages/sdk-core/
└── src/
    ├── api/                  # public surface barrel
    │   └── index.ts
    ├── modules/
    │   ├── sessions/
    │   │   ├── api/
    │   │   │   ├── create-session.ts
    │   │   │   ├── load-session.ts
    │   │   │   └── index.ts
    │   │   ├── internal/
    │   │   │   ├── session-reducer.ts
    │   │   │   ├── session-store.ts
    │   │   │   └── state.ts
    │   │   └── index.ts
    │   ├── execution/
    │   │   ├── api/
    │   │   ├── internal/
    │   │   └── index.ts
    │   └── tools/
    │       ├── api/
    │       ├── internal/
    │       └── index.ts
    ├── internal/             # package-level internal (do not touch)
    ├── shared/               # local cross-cutting helpers
    └── index.ts              # top-level public barrel
```

### Folder Semantics

| Folder | Purpose |
|--------|---------|
| `src/api/` | Curated public exports. Consumers' entry point. |
| `src/index.ts` | Re-exports from `src/api/`. The only file `package.json`'s `"exports"` points at. |
| `src/internal/` | Package-scope private utilities. Never re-exported. |
| `src/modules/<name>/api/` | Module-scoped public functions; sibling modules import here. |
| `src/modules/<name>/internal/` | Implementation details of one module. **Other modules MUST NOT import from here.** |
| `src/modules/<name>/index.ts` | The module barrel; re-exports only its own `api/`. |
| `src/shared/` | Local helpers not yet worth promoting to a package. |

### Barrel Files: What They Are and Why They Matter

A **barrel file** is an `index.ts` whose only job is to re-export selected symbols from sibling files. Barrels function as gatekeepers: anything not re-exported is, by convention, private.

```ts
// src/modules/sessions/index.ts
export { createSession } from "./api/create-session";
export { loadSession } from "./api/load-session";
// Note: nothing from ./internal/ is re-exported.
```

```ts
// src/api/index.ts (package-level public surface)
export { createSession, loadSession } from "../modules/sessions";
export { runTask } from "../modules/execution";
export type { Session, SessionId, TaskResult } from "../shared/types";
// Adapter concrete classes are NOT re-exported here.
// Only adapter *interfaces* are.
export type { ModelPort, ToolRegistryPort } from "../ports";
```

```ts
// src/index.ts (the root barrel)
export * from "./api";
```

Then in `package.json`:

```json
{
  "name": "@acme/sdk-core",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"]
}
```

A single entry in `"exports"` means consumers can only `import { ... } from "@acme/sdk-core"`. Deep imports like `@acme/sdk-core/src/internal/...` are blocked by the module resolver. This is the cheapest, strongest boundary you can buy.

### The Public API Rule

**Modules communicate only through public API, never by importing internal files.**

Good:

```ts
import { createSession } from "../sessions/api";
import { executeTurn } from "../execution";
```

Bad:

```ts
import { reduceSessionState } from "../sessions/internal/session-reducer";
import { buildToolCall } from "../tools/internal/build-tool-call";
```

The bad pattern creates hidden dependencies and makes future extraction much harder. The fact that TypeScript will happily resolve the import is exactly why you need a lint rule to forbid it (see §6).

### Concrete Module Example

```ts
// src/modules/sessions/api/create-session.ts
import type { SessionId, SessionState } from "@acme/shared-types";
import { initializeState } from "../internal/state";

export function createSession(id: SessionId): SessionState {
  return initializeState(id);
}
```

```ts
// src/modules/sessions/internal/state.ts
import type { SessionId, SessionState } from "@acme/shared-types";

export function initializeState(id: SessionId): SessionState {
  return {
    id,
    status: "idle",
    history: [],
    metadata: {},
  };
}
```

### Two Boundary Levels

There are two distinct boundary levels in any SDK that lives in a workspace:

1. **Module API** inside a package (the `modules/<name>/api` vs `internal` split)
2. **Package API** across the workspace (`src/api/index.ts` vs `src/internal`)

```text
consumer import
  -> @acme/sdk-core
     -> package public API   (src/api/index.ts)
        -> module public API (src/modules/<name>/api)
           -> internal implementation
```

Each level exposes **less** than the one below it. If your package public API re-exports things that should have been module-internal, the next refactor will be painful.

### When To Promote A Module Into Its Own Package

Promote a module only when it satisfies at least one:

- another consumer needs it independently
- it has independent runtime dependencies (e.g., a native module)
- it needs a distinct release cadence or semver contract
- it has enough complexity that isolated tests/builds are valuable

Do not promote because a folder feels large. Promote when **ownership and dependency direction** become clearer as a package.

Bad workspace shape:

```text
packages/shared/
├── prompts/
├── types/
├── utils/
├── providers/
└── commands/
```

Good workspace shape:

```text
packages/shared-types/
packages/prompt-assets/
packages/command-core/
```

A `packages/shared/` mega-package is a dumping-ground; it almost always grows circular dependencies within six months.

---

## 3. Runtime Layering

The boundary work in §2 is structural. This section is about **dependency direction**: which layer is allowed to call which.

### The Core Problem

SDKs that wrap external systems naturally accumulate concerns:

- request/response assembly
- transport invocation (HTTP client, model SDK, queue broker)
- side-effect execution (tool calling, file I/O, retries)
- session/state persistence
- output formatting
- retry, fallback, circuit-breaking

If all of these live in the consumer-facing entry function, the SDK becomes impossible to evolve.

### Recommended Dependency Direction

```text
consumer apps
  -> application services      (public API entrypoints)
    -> core runtime            (orchestration loop, state, policy)
      -> ports                 (contracts for external interactions)
        -> adapters            (concrete implementations)
          -> infrastructure    (env, wiring, bootstrap)
```

### What Each Layer Owns

| Layer | Owns | Must Not Own |
|-------|------|--------------|
| Consumer surface | args, config object, display | transport SDK code |
| Application services | user-intent entrypoints (`executeTask`, `listTools`) | terminal rendering, transport |
| Core runtime | state machine, planning loop, decision rules | direct vendor SDK imports |
| Ports | interface contracts for integrations | concrete implementations |
| Adapters | provider/tool/storage implementations | orchestration policy |
| Infrastructure | wiring, env, bootstrapping | domain decisions |

### Example Runtime Layout

```text
packages/sdk-core/
└── src/
    ├── application/
    │   ├── execute-task.ts
    │   ├── resume-session.ts
    │   └── list-tools.ts
    ├── domain/
    │   ├── task-state.ts
    │   ├── execution-policy.ts
    │   └── turn.ts
    ├── ports/
    │   ├── model-port.ts
    │   ├── tool-registry-port.ts
    │   ├── session-store-port.ts
    │   └── prompt-store-port.ts
    ├── adapters/
    │   ├── testing/
    │   └── composition/
    └── index.ts
```

Concrete provider packages such as `provider-openai` live **outside** this package. The orchestration layer owns only contracts and internal policy.

### Core Runtime Types

```ts
export type RunMode = "plan" | "build";

export interface RunTask {
  prompt: string;
  mode: RunMode;
  sessionId?: string;
}

export interface RunResult {
  sessionId: string;
  status: "completed" | "failed" | "interrupted";
  output: string;
  toolCalls: number;
}

export interface RuntimeContext {
  now: () => Date;
  logger: Logger;
  config: RuntimeConfig;
}
```

### Application Service Example

Application services are stable entrypoints used by consumers (and exposed via the public API barrel).

```ts
// src/application/execute-task.ts
import type { ModelPort } from "../ports/model-port";
import type { ToolRegistryPort } from "../ports/tool-registry-port";
import type { SessionStorePort } from "../ports/session-store-port";
import { RunLoop } from "../domain/run-loop";

export interface ExecuteTaskDeps {
  model: ModelPort;
  tools: ToolRegistryPort;
  sessions: SessionStorePort;
  context: RuntimeContext;
}

export async function executeTask(
  task: RunTask,
  deps: ExecuteTaskDeps,
): Promise<RunResult> {
  const loop = new RunLoop(deps.model, deps.tools, deps.sessions, deps.context);
  return loop.run(task);
}
```

The consumer calls `executeTask`. It does not know which model SDK or tool storage implementation is behind the ports.

### Runtime Core Example

```ts
export class RunLoop {
  constructor(
    private readonly model: ModelPort,
    private readonly tools: ToolRegistryPort,
    private readonly sessions: SessionStorePort,
    private readonly context: RuntimeContext,
  ) {}

  async run(task: RunTask): Promise<RunResult> {
    const sessionId = task.sessionId ?? crypto.randomUUID();
    const state = createInitialState(sessionId, task);

    const response = await this.model.generate({
      messages: state.messages,
      tools: this.tools.list(),
    });

    for (const toolCall of response.requestedTools) {
      const result = await this.tools.execute(toolCall);
      state.toolHistory.push({ name: toolCall.name, output: result.output });
    }

    state.finalOutput = response.text;
    await this.sessions.save(state);

    return {
      sessionId,
      status: "completed",
      output: state.finalOutput,
      toolCalls: state.toolHistory.length,
    };
  }
}
```

The point is not the loop's contents. The point is the dependency direction:

- `RunLoop` knows only ports
- consumers know only application services
- adapters know SDKs and external systems

### Composition Root

Wiring belongs in **one** place:

```ts
// src/adapters/composition/build-runtime.ts
import OpenAI from "openai";
import { OpenAIModelAdapter } from "@acme/provider-openai";
import { FileSessionStore } from "@acme/session-store-file";
import { createDefaultToolRegistry } from "@acme/tool-pack-default";
import { executeTask } from "../../application/execute-task";

export async function buildRuntime() {
  const model = new OpenAIModelAdapter(
    new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
    process.env.MODEL_ID ?? "gpt-4.1",
  );

  const tools = createDefaultToolRegistry();
  const sessions = new FileSessionStore(process.env.SESSION_DIR ?? ".sessions");

  return {
    executeTask: (task: RunTask) =>
      executeTask(task, {
        model,
        tools,
        sessions,
        context: {
          now: () => new Date(),
          logger: console,
          config: loadRuntimeConfig(),
        },
      }),
  };
}
```

The composition root may import concrete packages. The core runtime must not.

---

## 4. Provider / Adapter Pattern

Adapters exist so that the orchestration layer can stay vendor-agnostic.

### Port Design

Define ports as **plain TypeScript interfaces** in the core package. Keep them minimal; the smaller the port surface, the easier the substitution.

```ts
// src/ports/model-port.ts
export interface ModelRequest {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  tools?: Array<{ name: string; description: string; inputSchema: object }>;
}

export interface ModelResponse {
  text: string;
  requestedTools: Array<{
    name: string;
    input: unknown;
  }>;
}

export interface ModelPort {
  generate(request: ModelRequest): Promise<ModelResponse>;
}
```

```ts
// src/ports/tool-registry-port.ts
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: object;
}

export interface ToolExecution {
  name: string;
  input: unknown;
}

export interface ToolResult {
  ok: boolean;
  output: string;
}

export interface ToolRegistryPort {
  list(): ToolDefinition[];
  execute(call: ToolExecution): Promise<ToolResult>;
}
```

```ts
// src/ports/session-store-port.ts
export interface SessionStorePort {
  save(state: TaskSessionState): Promise<void>;
  load(sessionId: string): Promise<TaskSessionState | null>;
}
```

### Concrete Adapter

```ts
// packages/provider-openai/src/index.ts
import OpenAI from "openai";
import type { ModelPort, ModelRequest, ModelResponse } from "@acme/provider-contracts";

export class OpenAIModelAdapter implements ModelPort {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string,
  ) {}

  async generate(request: ModelRequest): Promise<ModelResponse> {
    const completion = await this.client.responses.create({
      model: this.model,
      input: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    return {
      text: completion.output_text ?? "",
      requestedTools: [],
    };
  }
}
```

The core runtime imports `ModelPort`, not `OpenAIModelAdapter`.

### In-Memory Adapter for Tests

```ts
export interface Tool {
  definition: ToolDefinition;
  execute(input: unknown): Promise<string>;
}

export class InMemoryToolRegistry implements ToolRegistryPort {
  constructor(private readonly tools: Map<string, Tool>) {}

  list(): ToolDefinition[] {
    return [...this.tools.values()].map((tool) => tool.definition);
  }

  async execute(call: ToolExecution): Promise<ToolResult> {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return { ok: false, output: `Unknown tool: ${call.name}` };
    }

    return {
      ok: true,
      output: await tool.execute(call.input),
    };
  }
}
```

### Factory Injection (vs Class Hierarchies)

Prefer **factory functions** that receive ports as arguments over class hierarchies that inherit ports. Factories compose; inheritance traps you.

```ts
export function createSessionService(deps: {
  store: SessionStorePort;
  now: () => Date;
}) {
  return {
    async create(id: string) {
      const session = { id, createdAt: deps.now() };
      await deps.store.save(session);
      return session;
    },
  };
}
```

### Testing With Fakes

```ts
const fakeStore: SessionStorePort = {
  async save() {},
  async load() {
    return null;
  },
};

const fixedNow = new Date("2030-01-01T00:00:00Z");
const service = createSessionService({ store: fakeStore, now: () => fixedNow });
```

You never need to mock the OpenAI client to test orchestration policy. That alone justifies the port indirection.

---

## 5. Plugin Extension Model

An SDK grows new capabilities through plugins. A plugin model **helps** when it gives you modular registration, controlled dependencies, isolated failure boundaries, and extension without deep imports. It **hurts** when it becomes a magical loader with no contract.

### Design Principles

1. **Encapsulation by default** — a plugin exposes only what it registers.
2. **Explicit dependencies** — declared in metadata, not implicit.
3. **Shared capabilities only by contract** — no cross-plugin imports.
4. **Deterministic registration order** — sorted by dependency, not by list position.
5. **Plugins testable in isolation** — without booting the SDK.

### Minimal Plugin Contract

```ts
export interface SdkPlugin {
  name: string;
  version: string;
  dependsOn?: string[];
  capabilities?: {
    commands?: string[];
    tools?: string[];
    providers?: string[];
  };
  register(ctx: PluginContext): Promise<void> | void;
  dispose?(): Promise<void> | void;
}
```

### Plugin Context

The `PluginContext` is the **only** supported way for plugins to interact with the host.

```ts
export interface PluginContext {
  commands: CommandRegistry;
  tools: ToolRegistry;
  providers: ProviderRegistry;
  config: ConfigStore;
  logger: Logger;
  has(name: string): boolean;
}
```

Plugins should not import each other directly. If two plugins share state, they share it through a registry on the context.

### Host Registries

Each extension point gets one registry. This is much better than a single giant mutable global map.

```ts
export interface CommandRegistry {
  register(name: string, command: CommandHandler): void;
  get(name: string): CommandHandler | undefined;
}

export interface ToolRegistry {
  register(name: string, tool: Tool): void;
  list(): Tool[];
}

export interface ProviderRegistry {
  register(name: string, provider: ModelPort): void;
  get(name: string): ModelPort | undefined;
}
```

### Plugin Factory Pattern

Use factories when plugins need host configuration:

```ts
export interface FilesystemToolPluginOptions {
  rootDir: string;
  readOnly?: boolean;
}

export function filesystemToolPlugin(
  options: FilesystemToolPluginOptions,
): SdkPlugin {
  return {
    name: "tool-filesystem",
    version: "1.0.0",
    register(ctx) {
      ctx.tools.register("read_file", createReadFileTool(options));
      if (!options.readOnly) {
        ctx.tools.register("write_file", createWriteFileTool(options));
      }
    },
  };
}
```

Factories are usually better than global env lookups inside random plugin files.

### Dependency Declarations and Registration Order

A plugin system without ordering rules eventually breaks in non-obvious ways.

Good:

```ts
export async function registerPlugins(plugins: SdkPlugin[], ctx: PluginContext) {
  const ordered = topologicalSortByDependency(plugins);

  for (const plugin of ordered) {
    await plugin.register(ctx);
  }
}
```

Bad:

```ts
for (const plugin of plugins) {
  await plugin.register(ctx);
}
```

The bad version silently relies on list order and eventually becomes fragile.

Declaration metadata:

```ts
export const openAIProviderPlugin = (): SdkPlugin => ({
  name: "provider-openai",
  version: "1.0.0",
  dependsOn: ["provider-contracts"],
  capabilities: {
    providers: ["openai"],
  },
  register(ctx) {
    ctx.providers.register("openai", buildOpenAIProvider());
  },
});
```

Rules:

- dependencies are declared by **plugin name**, not by import
- keep dependency trees shallow
- fail fast on missing dependencies
- surface cycles as startup errors

### Lifecycle Hook Order

| Order | Hook | Purpose |
|-------|------|---------|
| 1 | host calls `topologicalSortByDependency(plugins)` | resolve order |
| 2 | per-plugin: validate metadata | duplicate names, missing deps |
| 3 | per-plugin: `register(ctx)` | declare capabilities, attach handlers |
| 4 | (runtime) calls registered handlers | normal operation |
| 5 | per-plugin: `dispose()` in reverse order | close resources |

If plugins own handles such as file watchers or network clients, give them `dispose`. The host closes plugins in reverse registration order.

### Autoload vs Explicit Registration

| Strategy | Predictability | Flexibility | Recommendation |
|----------|----------------|-------------|----------------|
| Explicit list | high | medium | default |
| Manifest-driven | medium-high | high | use after core stabilizes |
| Filesystem autoload | low-medium | very high | only with strict validation |

Explicit:

```ts
await registerPlugins(
  [
    coreCommandsPlugin(),
    filesystemToolPlugin({ rootDir: process.cwd(), readOnly: false }),
    openAIProviderPlugin(),
  ],
  ctx,
);
```

Manifest-driven (package declares its plugin entrypoint):

```json
{
  "name": "@acme/provider-openai",
  "exports": { ".": "./dist/index.js" },
  "sdkPlugin": {
    "entry": "./dist/plugin.js",
    "tags": ["provider"]
  }
}
```

Filesystem autoload (use sparingly, always validate metadata before calling `register`):

```ts
const discovered = await discoverPluginsFromDirectory(pluginDir);
await registerPlugins(discovered, ctx);
```

### Capability Matrix

A capability matrix is the table you publish so plugin authors know which extension points exist and which are stable.

| Capability | Registry | Stability | Notes |
|------------|----------|-----------|-------|
| `commands` | `CommandRegistry` | stable | name-collision detection on register |
| `tools` | `ToolRegistry` | stable | input schema validated at register time |
| `providers` | `ProviderRegistry` | stable | one default per `kind`; explicit name otherwise |
| `renderers` | `RendererRegistry` | experimental | may be reshaped in next minor |
| `hooks:pre-run` | `HookBus` | stable | runs in registration order |
| `hooks:post-run` | `HookBus` | stable | runs in reverse order |

**Safe vs unsafe extension points:**

- **Safe**: registries with explicit `register(name, handler)` — collisions detected, types enforced.
- **Unsafe**: mutating shared mutable state inside `ctx.config`, monkey-patching another plugin's tool. Forbid these contractually.

### Scoped Registration

Some plugins should affect only one area. Model scope explicitly:

```ts
ctx.commands.register("x:trace", traceCommand, { scope: "experimental" });
ctx.tools.register("delete_file", deleteFileTool, { scope: "build" });
```

If scope matters but the system does not model it, users eventually get surprising behavior.

### Isolation Testing

Every plugin should be testable without booting the full SDK.

```ts
import { describe, it } from "node:test";

describe("provider-openai plugin", () => {
  it("registers the openai provider", async (t) => {
    const ctx = createTestPluginContext();
    await openAIProviderPlugin().register(ctx);

    t.assert.ok(ctx.providers.get("openai"));
  });
});
```

What to test:

- required capabilities registered
- dependency failures are explicit
- optional capabilities behave correctly
- no duplicate registration side effects
- plugin can shut down cleanly if it owns resources

---

## 6. Module Boundary Enforcement

Architecture that depends on memory and discipline alone will not hold. Catch these failures before they ship:

- consumer code importing provider internals
- core runtime importing UI or CLI code
- packages using undeclared dependencies
- modules importing sibling `internal/` files
- plugin registration order silently breaking

### Tool Choice

| Tool | Layer | What it catches |
|------|-------|-----------------|
| TypeScript `paths` + `exports` in `package.json` | resolver | deep imports across package boundaries |
| `eslint-plugin-boundaries` | source files | import paths violating tag rules |
| `dependency-cruiser` | import graph | cycles, forbidden module-to-module edges |
| Turborepo `boundaries` field | workspace | undeclared package deps, untagged crossings |

You typically want **at least two** layers: `exports` (cheap) plus one of `eslint-plugin-boundaries` or `dependency-cruiser` (deep).

### eslint-plugin-boundaries

Tag your files by directory, then forbid forbidden edges.

```js
// eslint.config.js (flat config)
import boundaries from "eslint-plugin-boundaries";

export default [
  {
    plugins: { boundaries },
    settings: {
      "boundaries/elements": [
        { type: "public-api", pattern: "src/api/**" },
        { type: "module-api", pattern: "src/modules/*/api/**" },
        { type: "module-internal", pattern: "src/modules/*/internal/**" },
        { type: "ports", pattern: "src/ports/**" },
        { type: "adapters", pattern: "src/adapters/**" },
        { type: "internal", pattern: "src/internal/**" },
      ],
    },
    rules: {
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "public-api", allow: ["module-api", "ports"] },
            { from: "module-api", allow: ["module-internal", "ports", "internal"] },
            { from: "module-internal", allow: ["internal", "ports"] },
            { from: "adapters", allow: ["ports", "internal"] },
            { from: "ports", allow: [] },
          ],
        },
      ],
      "boundaries/no-private": ["error", { allowUncles: false }],
    },
  },
];
```

Key invariants this encodes:

- **`module-api` may not import a sibling module's `internal/`**
- **`adapters` may import `ports/` but never `module-internal/`**
- **`ports/` is a sink: it imports nothing in-package**

### dependency-cruiser

Use this when you want a *graph-based* view, not just per-file linting.

```json
// .dependency-cruiser.json (excerpt)
{
  "forbidden": [
    {
      "name": "no-cross-module-internal",
      "severity": "error",
      "from": { "path": "^src/modules/([^/]+)/" },
      "to":   {
        "path": "^src/modules/(?!\\1)([^/]+)/internal/"
      }
    },
    {
      "name": "ports-have-no-deps",
      "severity": "error",
      "from": { "path": "^src/ports/" },
      "to":   { "pathNot": "^src/ports/|^src/shared/types" }
    },
    {
      "name": "no-circular",
      "severity": "error",
      "from": {},
      "to": { "circular": true }
    }
  ]
}
```

Run it in CI:

```bash
depcruise --config .dependency-cruiser.json src
```

### Turborepo `boundaries`

For a workspace with multiple SDK packages, tag-based rules at the workspace level give you the strongest guarantee that, e.g., `sdk-core` never imports `provider-openai`.

```bash
turbo boundaries
```

Tag packages:

```json
// packages/provider-openai/turbo.json
{ "tags": ["adapter", "provider"] }
```

```json
// packages/sdk-core/turbo.json
{ "tags": ["runtime", "core"] }
```

Configure root rules:

```json
{
  "boundaries": {
    "tags": {
      "core": {
        "dependencies": {
          "deny": ["provider", "tool-pack", "cli"]
        }
      },
      "cli": {
        "dependencies": {
          "allow": ["runtime", "command", "shared", "provider", "tool-pack"]
        }
      }
    }
  }
}
```

Practical tag model:

| Tag | Meaning |
|-----|---------|
| `cli` | executable shell or consumer UI |
| `runtime` | orchestration core |
| `provider` | model/provider adapters |
| `tool-pack` | tool/operation implementations |
| `shared` | pure shared contracts or types |
| `command` | command registries or contracts |

The most important rule is usually: **core runtime depends on contracts, not on concrete providers or tool packs**.

### Dependency Declaration Hygiene

A package must declare every package it imports.

Good:

```json
{
  "name": "@acme/sdk-core",
  "dependencies": {
    "@acme/provider-contracts": "workspace:*",
    "@acme/tool-contracts": "workspace:*",
    "@acme/shared-types": "workspace:*"
  }
}
```

Bad: importing `@acme/provider-openai` without a declared dependency, or by deep relative import like `../../packages/provider-openai/src`.

### Coupling Heuristics

Lightweight warning signs before architecture drifts:

| Metric | Good | Warning | Bad |
|--------|------|---------|-----|
| Fan-out per module | `<= 5` | `6-10` | `> 10` |
| Circular dependencies | `0` | `1-2` | `> 2` |
| Files over 500 lines | `0` | low % | common |

These are heuristics, not laws. But if multiple warnings fire together, boundaries are eroding.

---

## 7. Patterns vs Anti-Patterns

### Patterns

**Facade exports.** A single `src/index.ts` re-exporting from a curated `src/api/index.ts`. Consumers cannot reach internals because they aren't exported.

**Factory injection.** Application services accept their dependencies as a `deps` object. Tests pass fakes; production passes real adapters.

**Sealed interfaces.** Ports are interfaces in the core package. Concrete classes live in adapter packages. The core never `import`s an adapter class.

**One composition root.** Every concrete adapter is constructed in exactly one file (`build-runtime.ts`). Nothing else `new`s an OpenAI client.

**Registry per extension point.** `CommandRegistry`, `ToolRegistry`, `ProviderRegistry` are distinct. No `globalRegistry` mega-object.

**Plugin context as the only host handle.** Plugins receive a `PluginContext`. They never `import` another plugin.

### Anti-Patterns

**Deep imports into internal paths.**

```ts
// Bad
import { reducer } from "@acme/sdk-core/dist/internal/sessions/reducer";
```

The fact that this works at runtime means your `package.json` `"exports"` is too permissive. Lock it down.

**Leaking provider types into public API.**

```ts
// Bad: re-exports concrete vendor types
export type { ChatCompletion } from "openai/resources";
```

Now you can never upgrade `openai` without a major version bump.

**Plugins reaching into internals.**

```ts
// Bad
import { internalToolRegistry } from "@acme/sdk-core/internal";
```

If a plugin can do this, the plugin system is decorative.

**Cross-module internal imports.** Fastest way to make boundaries fake.

**Consumer code owning runtime logic.** If a consumer's calling code decides retry policy, tool arbitration, or provider fallback, it has absorbed orchestration concerns that belong inside the SDK.

**Providers pulling in consumer types.** Adapters should not know about user-facing flags or terminal renderer objects.

**Hidden global singletons.** A giant mutable registry imported everywhere. Prefer explicit context.

**Runtime importing concrete packages.**

```ts
// Bad, inside src/domain or src/application
import { OpenAIModelAdapter } from "@acme/provider-openai";
```

**Hidden side effects during import.**

```ts
// Bad
import "./register-everything";
```

Plugins should register via the host, not by mutating globals at import time.

**Plugins importing other plugins directly.**

```ts
// Bad, inside another plugin
import { openAIProviderPlugin } from "@acme/provider-openai";
```

Use dependency declarations and shared registries instead.

**Unvalidated autoload.** Loading files from disk without validating metadata, version, and dependency order makes debugging guesswork.

**Boundary rules only in docs.** If the rule is written but not checked, it will drift.

**Untagged packages.** If package roles are implicit, boundary rules become too weak to matter.

---

## 8. Verification Checklist

A small but disciplined CI sequence will keep all the above honest.

### CI Sequence

1. Boundary check (Turborepo `boundaries` + eslint-plugin-boundaries + dependency-cruiser)
2. Typecheck changed packages
3. Run affected tests
4. Run plugin isolation tests
5. Run a thin end-to-end smoke test

```bash
turbo boundaries
turbo run lint test typecheck --filter=...[origin/main]
```

### Import-Graph Check

Flag these patterns specifically:

```ts
// All of these should fail CI:
import { reducer } from "../sessions/internal/reducer";
import { renderTurn } from "../../apps/cli/src/ui/renderers";
import { OpenAIModelAdapter } from "../../packages/provider-openai/src";
```

### Exported Symbols Audit

For a stable public API, you want a known, reviewed list of exports.

```bash
# Snapshot the public surface
npx api-extractor run --local --verbose
```

Or, more minimally, write a test that imports `@acme/sdk-core` and asserts the keys of the namespace:

```ts
import * as sdk from "@acme/sdk-core";

const expected = new Set(["createSession", "loadSession", "executeTask"]);
const actual = new Set(Object.keys(sdk));

assert.deepEqual(actual, expected);
```

Any unintended export becomes a failing test, not a silent leak.

### Plugin Contract Conformance

Test missing-dependency behavior explicitly:

```ts
it("fails clearly when dependency is missing", async (t) => {
  const ctx = createTestPluginContext();

  await t.assert.rejects(
    () => authDependentPlugin().register(ctx),
    /requires database-plugin/,
  );
});
```

Test registration order:

```ts
it("registers dependencies before dependents", async (t) => {
  const ordered = topologicalSortByDependency([
    authPlugin(),
    databasePlugin(),
  ]);

  t.assert.equal(ordered[0].name, "database-plugin");
});
```

### Cross-Package Impact Rules

| Changed Package | Also Verify |
|-----------------|-------------|
| `shared-types` | all typecheck tasks |
| `provider-contracts` | core + all provider packages |
| `tool-contracts` | core + all tool packs |
| `sdk-core` | consumer app and session-related adapters |
| `apps/example` | only that app unless shared packages changed |

### Smoke Matrix

| Surface | What to Verify |
|---------|----------------|
| consumer -> public API | consumer calls application service, not transport directly |
| core -> provider | core uses `ModelPort` only |
| core -> tools | core uses registry/contract only |
| plugin load | deterministic order |
| provider swap | core tests still pass with fake provider |

### Test Factory Pattern

Build reusable harnesses instead of booting the full SDK in every test.

```ts
export async function buildTestRuntime() {
  const model = new FakeModelAdapter();
  const tools = new InMemoryToolRegistry(new Map());
  const sessions = new InMemorySessionStore();

  return {
    executeTask: (task: RunTask) =>
      executeTask(task, {
        model,
        tools,
        sessions,
        context: {
          now: () => new Date(),
          logger: console,
          config: defaultRuntimeConfig(),
        },
      }),
  };
}
```

If core runtime tests require terminal or transport setup, they are probably testing the wrong layer.

### Review Checklist (run before merging structural changes)

- Can this module be used without reaching into `internal/`?
- If I swap one provider package, does core runtime code change?
- If I remove the consumer shell, does the core runtime still work in tests?
- Is this a module concern or a new package concern?
- Did I introduce a `shared/` folder that is really several domains hiding together?
- Are all package imports declared in `package.json`?
- Are there any imports from another package's `src/` (deep import)?
- Do any modules reach into sibling `internal/` folders?
- Can core runtime tests run with fake adapters?
- Can each plugin register in isolation?
- Is plugin ordering deterministic?
- Is the exported symbol set the same as last release, or intentionally updated?
- Are boundary checks part of CI, not just local scripts?

If any answer is no, the architecture has already started to drift — fix it before the next feature lands on top.
