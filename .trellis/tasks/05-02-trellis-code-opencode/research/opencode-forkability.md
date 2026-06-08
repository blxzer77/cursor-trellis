# Research: OpenCode Forkability for Trellis Code

- Query: Research whether OpenCode is easy to fork/heavily modify for a product like Trellis Code, focusing on upstream source architecture, module boundaries, build/release packaging, binary distribution, extension points vs core internals, likely high-friction areas, and a 1-5 forkability rating.
- Scope: mixed
- Date: 2026-05-02

## Findings

### Bottom Line

OpenCode is forkable, but not "easy" in the sense of a small CLI library. It is a fast-moving Bun monorepo with a real runtime, TUI, web/desktop surfaces, local server, SDK, plugin system, provider/auth stack, SQLite/session state, and a native binary packaging matrix.

Forkability rating: **3/5**.

- 4/5 for legal/source availability and initial rebrand feasibility: MIT license, TypeScript source, clear package layout, existing build/publish scripts, and existing public CLI/SDK/plugin surfaces.
- 3/5 for a narrow Trellis Code fork: rebrand the CLI/package, add Trellis runtime manifests/events, move current Trellis context injection into core, and keep upstream UI/provider/session machinery mostly intact.
- 2/5 for heavy core rewrites: prompt assembly, LLM stream processing, tool execution, session state, config precedence, server routing, embedded UI, and binary release packaging are all coupled enough that broad changes will create a high-maintenance fork.

The practical answer is: **yes, feasible for Trellis Code if the fork delta is kept narrow and explicitly owned; no, not cheap if Trellis wants to deeply reshape OpenCode internals from day one.**

### Current Upstream Snapshot

- Canonical repo: <https://github.com/anomalyco/opencode>
- Default branch: `dev`
- HEAD inspected: `a849812e9f2ea3089cea45673ec10ecc80d93136`, committed 2026-05-02T13:09:14Z: <https://github.com/anomalyco/opencode/commit/a849812e9f2ea3089cea45673ec10ecc80d93136>
- Latest GitHub release observed: `v1.14.31`, published 2026-05-01: <https://github.com/anomalyco/opencode/releases/tag/v1.14.31>
- npm latest observed on 2026-05-02:
  - `opencode-ai`: `1.14.31`
  - `@opencode-ai/plugin`: `1.14.31`
  - `@opencode-ai/sdk`: `1.14.31`
- Repo metadata observed: MIT license, pushed 2026-05-02T13:09:15Z.

### Files Found

| Path | Description |
|---|---|
| `.trellis/tasks/05-02-trellis-code-opencode/prd.md` | Trellis Code PRD; now explicitly prefers a direct OpenCode fork and defines Trellis-owned runtime/event expectations. |
| `.trellis/tasks/05-02-trellis-code-opencode/research/opencode-runtime-architecture.md` | Prior research on OpenCode run/server/session/event surfaces and why Trellis GUI should consume a Trellis-owned runtime contract. |
| `.trellis/tasks/05-02-trellis-code-opencode/research/opencode-extension-surfaces.md` | Prior research on plugins, hooks, agents, skills, MCP, permissions, provider/auth config, and version skew. |
| `.trellis/tasks/05-02-trellis-code-opencode/research/opencode-distribution-feasibility.md` | Prior distribution research; wrapper-first recommendation is superseded by the user's fork-first direction, but source/package facts remain useful. |
| `.trellis/spec/cli/backend/platform-integration.md` | Trellis spec for AI platform integrations; includes OpenCode as the JS plugin pattern, with one stale note about `collectTemplates`. |
| `.trellis/spec/cli/backend/workflow-state-contract.md` | Trellis spec for workflow-state breadcrumbs and OpenCode class-1 push-hook behavior. |
| `packages/cli/src/templates/opencode/` | Current Trellis OpenCode integration: agents, skills, commands, JS plugins, and shared JS helpers. |
| `packages/cli/src/configurators/opencode.ts` | Trellis configurator that writes `.opencode/` assets and collects OpenCode templates. |
| Upstream `package.json` | Bun workspace root with package manager, workspaces, shared catalog deps, repo, and MIT license. Source: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/package.json>. |
| Upstream `packages/opencode/package.json` | Primary private runtime package with `bin`, source exports, Bun/Node import variants, and large runtime dependency surface. Source: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/package.json>. |
| Upstream `packages/opencode/src/index.ts` | Main CLI entry; registers TUI/run/serve/web/session/plugin/debug/etc. commands and one-time DB migration. Source: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/index.ts>. |
| Upstream `packages/opencode/src/cli/cmd/run.ts` | Headless `opencode run`; handles JSON event emission, session creation, attach mode, permissions, and SDK calls. Source: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/cli/cmd/run.ts>. |
| Upstream `packages/opencode/src/server/server.ts` | Local HTTP/server runtime with Hono and experimental Effect backend routes. Source: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/server/server.ts>. |
| Upstream `packages/opencode/src/session/processor.ts` | Core assistant/tool stream processor; maps LLM events into message parts, tool state, snapshots, retries, compaction, and status. Source: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/session/processor.ts>. |
| Upstream `packages/opencode/src/session/llm.ts` | Core LLM request assembly; merges provider/model/agent options, system prompts, plugins, tools, headers, and AI SDK streaming. Source: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/session/llm.ts>. |
| Upstream `packages/opencode/src/session/session.ts` | Session storage/service model over SQLite/sync events/message parts. Source: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/session/session.ts>. |
| Upstream `packages/opencode/src/config/config.ts` | Config schema/loader/precedence; merges global/project/inline/managed config, loads agents/plugins/tools, and installs plugin deps. Source: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/config/config.ts>. |
| Upstream `packages/opencode/src/plugin/index.ts` | Runtime plugin service; loads internal/external plugins, exposes hook trigger path, publishes plugin errors. Source: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/plugin/index.ts>. |
| Upstream `packages/plugin/src/index.ts` | Public `@opencode-ai/plugin` hook/type surface. Source: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/plugin/src/index.ts>. |
| Upstream `packages/opencode/script/build.ts` | Bun compile build matrix for platform binaries and release artifacts. Source: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/script/build.ts>. |
| Upstream `packages/opencode/script/publish.ts` | npm binary-package, wrapper, Docker, AUR, and Homebrew publishing script. Source: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/script/publish.ts>. |
| Upstream `packages/opencode/bin/opencode` | Public npm wrapper executable; resolves platform binary package, `OPENCODE_BIN_PATH`, cached link, AVX2/baseline, musl, Windows. Source: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/bin/opencode>. |
| Upstream `packages/sdk/js/src/server.ts` | Public SDK server/TUI launcher; shells to `opencode` on PATH and passes config via `OPENCODE_CONFIG_CONTENT`. Source: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/sdk/js/src/server.ts>. |

### Upstream Source Architecture

OpenCode is a Bun workspace, not a single package. The root `package.json` is private, uses `packageManager: bun@1.3.13`, and includes workspaces for `packages/*`, `packages/console/*`, `packages/sdk/js`, and `packages/slack`. It depends on workspace packages `@opencode-ai/plugin`, `@opencode-ai/script`, and `@opencode-ai/sdk`.

Top-level package shape under `packages/`:

- `packages/opencode` - primary CLI/runtime package.
- `packages/core` - shared runtime primitives used by the runtime package.
- `packages/plugin` - public `@opencode-ai/plugin` package.
- `packages/sdk/js` - public `@opencode-ai/sdk` package.
- `packages/app`, `packages/web`, `packages/desktop`, `packages/desktop-electron`, `packages/console/*`, `packages/ui` - UI/product surfaces.
- `packages/mcp`, `packages/script`, `packages/identity`, `packages/enterprise`, `packages/extensions`, `packages/slack` - adjacent integrations/support packages.

The primary runtime package has a large internal surface. At the inspected commit, `packages/opencode/src/` had 546 source blobs. First-level file counts show the rough coupling map:

- `cli`: 186 files
- `server`: 79 files
- `tool`: 39 files
- `util`: 33 files
- `provider`: 32 files
- `session`: 32 files
- `config`: 22 files
- `plugin`: 10 files
- `effect`: 10 files
- `project`: 8 files
- `storage`: 7 files
- `agent`: 6 files
- `pty`: 6 files
- smaller modules for MCP, permission, LSP, command, bus, sync, etc.

The CLI entry point is centralized. `src/index.ts` sets the script name/version/options, initializes logging and env flags, performs a one-time DB migration if `Global.Path.data/opencode.db` is missing, then registers commands including `run`, `serve`, `web`, `attach`, `session`, `plugin`, `debug`, `mcp`, `models`, `stats`, `export`, and `import`: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/index.ts#L69-L179>.

The runtime is service-oriented around Effect layers and `InstanceState`. Examples:

- `cli/bootstrap.ts` wraps a command in `Instance.provide()` and disposes the instance afterward: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/cli/bootstrap.ts#L4-L15>.
- `config/config.ts` defines a large canonical config schema, then provides a service with `get`, `getGlobal`, `update`, `invalidate`, `directories`, and dependency wait operations: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/config/config.ts#L102-L296>.
- `session/session.ts` exposes a session service with list/create/fork/message/part/diff/update/remove operations: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/session/session.ts#L402-L448>.
- `session/processor.ts` composes `Session`, `Config`, `Bus`, `Snapshot`, `Agent`, `LLM`, `Permission`, `Plugin`, `SessionSummary`, and `SessionStatus` services: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/session/processor.ts#L80-L93>.
- `tool/registry.ts` composes config, plugin, question, todo, agent, skill, session, provider, LSP, instruction, filesystem, bus, HTTP, process spawning, ripgrep, formatting, and truncation services: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/tool/registry.ts#L71-L91>.

Implication for Trellis Code: the source has recognizable modules, but heavy core work requires understanding Effect service composition and instance lifecycle. This is maintainable if Trellis makes small, well-named changes, but expensive if Trellis tries to flatten or bypass the runtime.

### Module Boundaries That Matter

#### CLI/headless boundary

`opencode run` is the cleanest upstream source pattern for a Trellis headless runner.

- The command exposes `--model`, `--agent`, `--format default|json`, `--file`, `--attach`, `--dir`, `--variant`, `--thinking`, and `--dangerously-skip-permissions`: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/cli/cmd/run.ts#L205-L294>.
- It creates or reuses a session and can fork from `--continue`/`--session`: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/cli/cmd/run.ts#L370-L383>.
- It emits newline JSON when `--format json` is set: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/cli/cmd/run.ts#L420-L426>.
- It maps streamed server events into `tool_use`, `step_start`, `step_finish`, `text`, `reasoning`, and `error` JSON events: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/cli/cmd/run.ts#L447-L520>.
- It auto-approves permission prompts only under `--dangerously-skip-permissions`, otherwise it auto-rejects: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/cli/cmd/run.ts#L531-L550>.
- It attaches to an existing server when `--attach` is present, otherwise it bootstraps an in-process server app through `Server.Default().app.fetch`: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/cli/cmd/run.ts#L651-L670>.

For Trellis Code, this is high leverage: keep upstream run mechanics, but add Trellis-owned run IDs, context assembly, manifests, and normalized event output.

#### Server/GUI boundary

`opencode serve` and the server module are a viable GUI base, but the route/runtime shape is non-trivial.

- `serve.ts` starts a headless server and warns when `OPENCODE_SERVER_PASSWORD` is not set: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/cli/cmd/serve.ts#L6-L18>.
- `server/server.ts` can select a Hono backend or experimental Effect HTTP API backend: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/server/server.ts#L54-L69>.
- The Hono server mounts global, control-plane, workspace, instance, and UI routes: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/server/server.ts#L99-L135>.
- OpenAPI generation is available through `openapi()`: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/server/server.ts#L138-L155>.

For Trellis Code GUI, this argues for adding a Trellis runtime/event route beside upstream routes, not parsing OpenCode storage or forking the whole UI immediately.

#### SDK boundary

The JS SDK is useful but not self-contained.

- `createOpencodeServer()` shells to `opencode serve` using `cross-spawn`: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/sdk/js/src/server.ts#L22-L40>.
- It waits for stdout text that starts with `opencode server listening`: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/sdk/js/src/server.ts#L43-L71>.
- It passes inline config via `OPENCODE_CONFIG_CONTENT`: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/sdk/js/src/server.ts#L35-L40>.

For Trellis Code, SDK usage still requires owning binary resolution/PATH/package install. The SDK is a client/control helper, not an alternative to runtime packaging.

#### Config boundary

Config is powerful but has high precedence complexity.

- The config schema includes server, commands, skills, plugins, provider, MCP, instructions, permissions, tools legacy compatibility, agents, provider enable/disable, compaction, and experimental flags: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/config/config.ts#L102-L260>.
- Config loading merges remote config, global config, `OPENCODE_CONFIG`, project files, `.opencode` dirs, `OPENCODE_CONFIG_CONTENT`, managed config, macOS managed preferences, and env permission overrides: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/config/config.ts#L492-L666>.
- `.opencode` directories trigger background installation of `@opencode-ai/plugin` pinned to `InstallationVersion` unless running local: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/config/config.ts#L540-L575>.

For Trellis Code, embedding Trellis defaults in the fork is easier than fighting config precedence from the outside, but doctor/reporting must show effective config and never print secrets.

#### Agent/tool/LLM boundary

This is where heavy Trellis modifications would cost most.

- Agents have names, modes, prompts, permission rules, model options, and steps: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/agent/agent.ts#L28-L48>.
- OpenCode default agents are assembled in code, then merged with config agents: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/agent/agent.ts#L90-L265>.
- The tool registry loads built-in tools, project/global tool files, and plugin-defined tools, then filters/describes them per agent/provider/model: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/tool/registry.ts#L100-L181> and <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/tool/registry.ts#L275-L314>.
- LLM request assembly combines agent prompt, provider prompt, custom system text, last-user system text, plugin transforms, provider/model/agent/variant options, permission-filtered tools, headers, and AI SDK `streamText`: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/session/llm.ts#L103-L179> and <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/session/llm.ts#L336-L415>.
- Session processing maps provider stream events into persisted parts, tool states, snapshots, retries, compaction triggers, session errors, and status transitions: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/session/processor.ts#L216-L460> and <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/session/processor.ts#L539-L587>.

For Trellis Code, the first core changes should be additive around these boundaries: a Trellis context builder before LLM invocation, a Trellis event normalizer after session events/CLI JSON, and a Trellis default agent. Avoid large changes to generic tool execution and provider transforms until there is a measured blocker.

### Extension Points vs Core Internals

Strong extension points:

- CLI commands and flags through `opencode run`, `opencode serve`, `opencode attach`, `opencode session`, `opencode export`, and `opencode debug`.
- Project/global config: `opencode.json`, `.opencode/agents`, `.opencode/commands`, `.opencode/plugins`, `.opencode/skills`, `.opencode/tools`.
- Public plugin package `@opencode-ai/plugin`.
- Plugin hook surface:
  - `chat.message`
  - `chat.params`
  - `chat.headers`
  - `permission.ask`
  - `command.execute.before`
  - `tool.execute.before`
  - `tool.execute.after`
  - `shell.env`
  - `tool.definition`
  - experimental transforms/compaction hooks
  Source: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/plugin/src/index.ts#L222-L333>.
- Runtime plugin service loads internal plugins, waits for dependency install, loads external plugins, calls config hooks, subscribes to bus events, and triggers hooks sequentially: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/plugin/index.ts#L152-L183> and <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/plugin/index.ts#L213-L274>.
- Plugin loader separates install, entrypoint, compatibility, and import stages, and runs external plugin loading in parallel while preserving successful result order: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/plugin/loader.ts#L65-L115> and <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/src/plugin/loader.ts#L184-L215>.

Core internals that should be treated as fork-owned, not stable public APIs:

- `packages/opencode/src/session/llm.ts` - LLM stream request assembly and provider-specific behavior.
- `packages/opencode/src/session/processor.ts` - event-to-state processor.
- `packages/opencode/src/session/session.ts` and SQL/storage modules - session/message persistence.
- `packages/opencode/src/config/config.ts` - schema and precedence behavior.
- `packages/opencode/src/tool/registry.ts` and individual tools - tool availability, descriptions, execution wrappers.
- `packages/opencode/src/server/routes/**` - local API route implementation.
- `packages/opencode/src/cli/cmd/run.ts` - CLI JSON event shape.
- `packages/opencode/script/**` and `packages/opencode/bin/opencode` - binary/release distribution machinery.

Product implication: Trellis Code should use extension points as prototypes and compatibility shims, but move product-critical behavior into small fork-owned modules with a stable Trellis contract. Current Trellis plugin behavior is a good test fixture for what the fork must make first-class.

### Build, Release, And Binary Distribution

The build and packaging stack is significant.

Source build:

- `packages/opencode/script/build.ts` generates code first, optionally builds an embedded web UI bundle, then compiles native binaries with Bun: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/script/build.ts#L15-L80>.
- Build targets cover Linux arm64/x64, Linux x64 baseline, Linux arm64/x64 musl, Linux x64 baseline musl, macOS arm64/x64/baseline, Windows arm64/x64/baseline: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/script/build.ts#L82-L143>.
- It uses `Bun.build({ compile: ... })` with platform target, embedded files, source maps optional, and defines version/migrations/channel/libc constants: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/script/build.ts#L196-L225>.
- It smoke-tests the current-platform binary with `--version`: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/script/build.ts#L227-L238>.
- Release mode uploads zip/tar artifacts to GitHub Releases with `gh release upload`: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/script/build.ts#L256-L265>.

Publishing:

- `publish.ts` packs and publishes every platform binary package, then publishes the wrapper package as `opencode-ai`: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/script/publish.ts#L26-L63>.
- It builds and pushes Docker images: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/script/publish.ts#L64-L72>.
- It generates AUR package metadata and pushes to AUR using git commands: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/script/publish.ts#L80-L127>.
- It generates and pushes Homebrew formula updates requiring `GITHUB_TOKEN`: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/script/publish.ts#L129-L196>.

npm wrapper:

- Published `opencode-ai@1.14.31` is a thin wrapper with unpacked size 8,961 bytes, `bin: { "opencode": "bin/opencode" }`, MIT license, and `postinstall: "bun ./postinstall.mjs || node ./postinstall.mjs"`.
- It declares 12 platform optional dependencies pinned to `1.14.31`: `opencode-linux-arm64-musl`, `opencode-darwin-x64`, `opencode-windows-arm64`, `opencode-linux-x64-musl`, `opencode-darwin-x64-baseline`, `opencode-linux-x64-baseline`, `opencode-darwin-arm64`, `opencode-windows-x64-baseline`, `opencode-linux-arm64`, `opencode-windows-x64`, `opencode-linux-x64`, `opencode-linux-x64-baseline-musl`.
- The wrapper executable honors `OPENCODE_BIN_PATH`, checks a cached `.opencode`, detects platform/arch, handles x64 AVX2/baseline and Linux musl, then finds a binary under ancestor `node_modules`: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/bin/opencode#L20-L31>, <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/bin/opencode#L34-L149>, and <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/bin/opencode#L151-L179>.
- `postinstall.mjs` finds the platform package, links or copies its binary to `bin/.opencode`, and chmods it on non-Windows: <https://github.com/anomalyco/opencode/blob/a849812e9f2ea3089cea45673ec10ecc80d93136/packages/opencode/script/postinstall.mjs#L50-L93>.

Fork implication: Trellis can reuse this machinery, but rebranding from `opencode` to `trellis-code` is not just package.json text. It touches compiled binary names, wrapper binary names, optional dependency names, Docker image names, release artifact names, Homebrew/AUR formula metadata, install docs, environment variables, server output parsing, and possibly SDK launcher assumptions.

### Likely High-Friction Areas

1. **Release packaging and binary naming.** The npm wrapper, platform optional dependencies, GitHub release artifacts, Docker image, AUR, Homebrew, `bin/opencode`, postinstall cache path, and SDK launcher all assume the `opencode` binary/package naming.
2. **Fast upstream cadence.** Latest release `v1.14.31` was published 2026-05-01; repo `dev` moved again on 2026-05-02. Prior research observed many releases and thousands of npm versions. A fork needs a regular upstream sync discipline and an explicit conflict budget.
3. **Core runtime coupling.** The most valuable Trellis changes live around prompt/context assembly, event stream normalization, permissions, and session state. Those touch `agent`, `llm`, `processor`, `tool`, `session`, `config`, and `server` modules.
4. **Effect service graph.** OpenCode internals are modular but not shallow. Many modules are Effect layers that assume `InstanceState`, `Config`, `Bus`, `Permission`, `Plugin`, and storage services exist.
5. **Config precedence.** Global, project, env, inline, managed, `.opencode`, remote, and macOS managed preference config sources can override each other. Trellis Code should own effective defaults and diagnostics rather than assuming project-local config wins.
6. **Plugin API stability.** The public plugin package is useful, but Trellis already has local evidence of version-sensitive plugin shapes. The hook surface includes experimental hooks and mutable output objects.
7. **Storage/session schema.** OpenCode now has SQLite/session tables, sync events, JSON migrations, snapshots, and message parts. A GUI should not depend on these internal layouts. A fork should expose normalized Trellis events/manifests.
8. **TUI/web/desktop embedding.** Build embeds web UI assets into binaries. Deep UI modifications can cascade into `packages/app`, `packages/web`, `packages/desktop*`, `packages/console*`, and build scripts.
9. **Provider/auth handling.** The provider stack carries credentials, OAuth/API auth, custom providers, and AI SDK quirks. Trellis Code must not read, print, or migrate secrets, and should avoid deep provider rewrites initially.
10. **Platform compatibility.** musl/glibc, Windows, AVX2/baseline, arm64/x64, package-manager optional dependency behavior, and postinstall/link behavior all need verification if Trellis redistributes binaries.
11. **Generated SDK/API contract.** OpenAPI/SDK generation is useful, but adding Trellis GUI-facing APIs means deciding whether Trellis extends upstream generated clients, ships a separate Trellis SDK, or wraps upstream events.
12. **Upstream identity assumptions.** The code and docs include `opencode` string assumptions: script name, env vars (`OPENCODE_*`), binary name, server status text, package names, Docker/image paths, config file names, and user-agent.

### Low-Friction / Favorable Areas

- MIT license permits fork/rebrand/redistribution with notice preservation.
- Source is public TypeScript/Bun with explicit workspace/package boundaries.
- The public runtime already has TUI, headless run, local server, SDK, plugin hooks, agents, skills, MCP config, permissions, provider config, and JSON events.
- `opencode run --format json` gives Trellis a proven source pattern for first headless execution.
- `opencode serve` + SDK gives Trellis a source pattern for GUI/server embedding.
- `@opencode-ai/plugin` exposes enough hooks to prototype Trellis behavior before moving it into core.
- Existing Trellis `.opencode/` templates already define the behavior Trellis Code should make first-class.
- Build scripts are explicit rather than hidden in hosted infrastructure.

### Recommended Fork Strategy

1. Keep upstream mergeability as a design constraint. Avoid broad formatting, module renames, or UI rewrites in the initial fork.
2. Start from a fixed upstream commit/release pair, recording both Trellis Code version and upstream base SHA in runtime diagnostics.
3. Rebrand in layers:
   - user-facing binary/package/docs first (`trellis-code`),
   - internal `OPENCODE_*` env/config/storage names only when needed,
   - avoid rewriting every internal namespace immediately.
4. Add a Trellis runtime module rather than scattering Trellis logic:
   - context builder for task/workflow/spec/session identity,
   - run manifest writer,
   - normalized event schema,
   - doctor/version report,
   - optional Trellis server routes.
5. Leave provider/auth, generic tool execution, core session storage, TUI rendering, and desktop/web UI mostly upstream in the MVP.
6. Treat raw OpenCode JSON/events/storage as forensic artifacts; expose Trellis-owned events to benchmark/GUI consumers.
7. Maintain a small upstream sync checklist:
   - re-run build for current platform,
   - smoke-test `trellis-code --version`, interactive launch, `run --format json`, `serve`, SDK attach, plugin hooks, Task subagents, provider auth listing without secrets,
   - compare event schema changes,
   - inspect plugin/config/schema changes,
   - update Trellis runtime compatibility metadata.

### Rating Rationale

**Why not 4/5:** The repo is open and structured, but carrying a fork means owning a native binary matrix, multiple packages, generated SDK/API, UI bundles, provider/auth behavior, config precedence, storage migrations, and a fast upstream release stream.

**Why not 2/5:** The source is not opaque. OpenCode already has the product surfaces Trellis needs, and there are clear first-class modules for CLI, server, session, config, plugin, agent, tool, and SDK. A narrow fork can produce value without rewriting the runtime.

**Final rating: 3/5** because a narrow product fork is realistic and likely worth it for Trellis Code runtime ownership, but heavy modification will quickly become a maintenance program rather than a feature task.

### Code Patterns

- Trellis PRD now makes runtime ownership explicit: Trellis Code should be a fork, not only a plugin/wrapper (`.trellis/tasks/05-02-trellis-code-opencode/prd.md:5`, `:32`, `:34`, `:41`, `:73-79`).
- Trellis PRD already defines the stable-runtime direction: normalized events and manifests instead of GUI coupling to raw OpenCode state (`.trellis/tasks/05-02-trellis-code-opencode/prd.md:38-40`, `:83-88`, `:90-143`).
- Existing Trellis research confirms the GUI should consume a Trellis runtime boundary, not raw OpenCode internals (`.trellis/tasks/05-02-trellis-code-opencode/research/opencode-runtime-architecture.md:75-86`, `:88-108`, `:134-180`).
- Existing Trellis extension research shows current plugin behavior is version-sensitive and should become fork-owned where product-critical (`.trellis/tasks/05-02-trellis-code-opencode/research/opencode-extension-surfaces.md:38-48`, `:136-147`).
- Existing distribution research remains valid on source/package facts but not on product direction; its wrapper-first recommendation is superseded by the current fork-first PRD (`.trellis/tasks/05-02-trellis-code-opencode/research/opencode-distribution-feasibility.md:9-20`, `:219-238`).
- Upstream CLI command registration is centralized, making initial command/rebrand work understandable (`packages/opencode/src/index.ts:69-179` upstream).
- Upstream headless JSON output is centralized in `run.ts`, making event normalization tractable (`packages/opencode/src/cli/cmd/run.ts:420-520` upstream).
- Upstream LLM and tool assembly are not one-file-simple: core changes span `agent.ts`, `tool/registry.ts`, `session/llm.ts`, and `session/processor.ts`.
- Upstream packaging assumes `opencode` naming across build output, wrapper package, optional dependency names, postinstall link, release artifacts, Docker image, AUR, and Homebrew.

### External References

| Source | Relevance |
|---|---|
| <https://github.com/anomalyco/opencode> | Canonical upstream repository; observed MIT, default branch `dev`, pushed 2026-05-02. |
| <https://github.com/anomalyco/opencode/commit/a849812e9f2ea3089cea45673ec10ecc80d93136> | Exact source snapshot inspected. |
| <https://github.com/anomalyco/opencode/releases/tag/v1.14.31> | Latest release observed on 2026-05-02. |
| <https://www.npmjs.com/package/opencode-ai> | Published CLI wrapper package; latest observed `1.14.31`. |
| <https://www.npmjs.com/package/@opencode-ai/plugin> | Public plugin package; latest observed `1.14.31`. |
| <https://www.npmjs.com/package/@opencode-ai/sdk> | Public SDK package; latest observed `1.14.31`. |
| <https://opencode.ai/docs/cli> | Official CLI surface for TUI, run, serve, attach, session/export/import/stats/debug. |
| <https://opencode.ai/docs/server> | Official local server/API surface. |
| <https://opencode.ai/docs/sdk> | Official SDK surface. |
| <https://opencode.ai/docs/plugins> | Official plugin extension surface. |
| <https://opencode.ai/docs/config> | Official config, precedence, variable, provider, MCP, and plugin configuration surface. |
| <https://opencode.ai/docs/permissions> | Official permission model; relevant to Trellis default-deny/ask policy. |

### Related Specs

- `.trellis/spec/cli/backend/platform-integration.md` - relevant to OpenCode as Trellis's JS plugin platform, session identity propagation, and sub-agent context injection. Note: prior research found one stale line claiming OpenCode has no `collectTemplates`; current code has `collectOpenCodeTemplates()`.
- `.trellis/spec/cli/backend/workflow-state-contract.md` - relevant because OpenCode is class-1 push-hook today, while Trellis Code should make workflow-state/task context first-class inside the fork.
- `.trellis/spec/cli/backend/directory-structure.md` - relevant if Trellis adds a future `trellis code` wrapper or doctor in this repo before/alongside the fork.
- `.trellis/spec/cli/backend/error-handling.md` and `.trellis/spec/cli/backend/quality-guidelines.md` - relevant for future doctor/runtime diagnostics.
- `.trellis/spec/guides/cross-platform-thinking-guide.md` - relevant to binary resolution, shell/env behavior, Windows/musl/AVX, and path handling.

## Caveats / Not Found

- Active Trellis task pointer was empty (`task.py current --source` returned none). The user gave an exact target research path, so this artifact used `.trellis/tasks/05-02-trellis-code-opencode/` as the task boundary and wrote only under that task's `research/` directory.
- No secret files were read. Auth/provider findings are based on upstream source, public docs, npm metadata, and prior non-secret Trellis research.
- This pass inspected architecture and source boundaries, not every UI route or provider implementation.
- The rating assumes Trellis wants a product fork with a narrow initial delta. If Trellis wants to replace the TUI/web UI, provider stack, and session persistence immediately, the practical forkability drops to 2/5.
- GitHub `dev` branch links are mutable; file links in this research use the inspected commit SHA where possible.
- `fd` is unavailable in this environment; local file discovery used `rg --files`.
- No code or specs were modified; only this research artifact was written.
