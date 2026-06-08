# Research: OpenCode Distribution Feasibility

- Query: Research OpenCode source/package feasibility for building a Trellis-owned distribution or wrapper. Focus on license, package layout, executable distribution, whether to depend on upstream CLI vs fork, API/internal stability, release cadence, and concrete wrapper/fork trade-offs.
- Scope: mixed
- Date: 2026-05-02

## Findings

### Summary Recommendation

Trellis should start with a wrapper/distribution layer around the upstream OpenCode CLI, not a fork.

The practical MVP is:

1. `trellis code doctor` verifies OpenCode resolution, exact version, plugin compatibility, auth/config paths, MCP availability, and Trellis session identity.
2. `trellis code run` shells to a pinned or explicitly resolved `opencode run --format json`, with Trellis-owned config/agent/plugin material and normalized JSONL output.
3. A later `trellis-code` package can depend on a pinned `opencode-ai` release once the wrapper contract stabilizes.
4. A fork should be deferred until a measured upstream limitation blocks Trellis behavior that cannot be handled with CLI flags, SDK/server control, config, or plugins.

The key reason is that OpenCode already exposes the surfaces Trellis needs: non-interactive CLI runs, a headless server, a typed JS SDK, plugin hooks, project-local agents/plugins, MCP config, permission controls, and JSON event output. A fork would buy deeper runtime control, but it would also inherit a fast-moving Bun monorepo, binary release pipeline, native packaging matrix, and plugin/schema churn.

### Files Found

| File Path | Description |
|---|---|
| `.trellis/tasks/05-02-trellis-code-opencode/prd.md` | Trellis Code planning PRD; already assumes wrapper-first and names `trellis code doctor`, `trellis code run`, and interactive launcher. |
| `.trellis/tasks/05-02-trellis-code-opencode/research/opencode-foundation.md` | Prior local research recommending a curated OpenCode-backed runtime before considering a fork. |
| `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md` | Prior driver research verifying `opencode run --format json`, provider config, permissions, telemetry, and XDG isolation on `opencode 1.14.30`. |
| `packages/cli/src/cli/index.ts` | Trellis CLI entry point; current command surface only registers `init`, `update`, and `uninstall`, so `trellis code` would be a new command branch. |
| `packages/cli/src/configurators/opencode.ts` | Current Trellis OpenCode installer; walks `packages/cli/src/templates/opencode/`, writes `.opencode/`, adds common commands and skills, and tracks templates via `collectOpenCodeTemplates()`. |
| `packages/cli/src/templates/opencode/package.json` | Generated OpenCode project package manifest; currently pins `@opencode-ai/plugin` to `1.1.40`. |
| `packages/cli/src/templates/opencode/plugins/session-start.js` | OpenCode plugin that prepends Trellis session-start context into the first message and skips when `OPENCODE_NON_INTERACTIVE=1`. |
| `packages/cli/src/templates/opencode/plugins/inject-workflow-state.js` | OpenCode per-turn breadcrumb plugin using `chat.message`; also skips when `OPENCODE_NON_INTERACTIVE=1`. |
| `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js` | OpenCode plugin that injects PRD/spec JSONL context into supported sub-agent prompts through `tool.execute.before`. |
| `packages/cli/src/templates/opencode/lib/trellis-context.js` | JS resolver for OpenCode session-scoped current-task state, mirroring Trellis Python active-task behavior. |
| `.trellis/spec/cli/backend/platform-integration.md` | Relevant platform integration spec for OpenCode plugin/session identity/sub-agent context behavior. |

### Local Code Patterns

Trellis already treats OpenCode as a supported platform in the registry: `AI_TOOLS.opencode` has `configDir: ".opencode"`, `cliFlag: "opencode"`, `agentCapable: true`, and `hasPythonHooks: false` (`packages/cli/src/types/ai-tools.ts:167`).

The current OpenCode configurator includes the real `.opencode/package.json` because it declares the runtime plugin dependency:

```ts
// packages/cli/src/configurators/opencode.ts
const EXCLUDE_PATTERNS = [
  ".d.ts",
  ".d.ts.map",
  ".js.map",
  "__pycache__",
  "node_modules",
  "bun.lock",
  ".gitignore",
];
```

The comment directly above says the template directory has a real package manifest that "IS user-facing and must be shipped" (`packages/cli/src/configurators/opencode.ts:15`).

`collectOpenCodeTemplates()` is already the Trellis-side file-set boundary for generated OpenCode assets: it walks the platform template directory, then adds common commands under `.opencode/commands/trellis/` and skills under `.opencode/skills` (`packages/cli/src/configurators/opencode.ts:86`). This is useful for a wrapper because the first implementation can reuse the same rendered assets rather than inventing a second OpenCode integration path.

OpenCode plugins are already version-sensitive in this repo. Local plugin comments note that "OpenCode 1.2.x expects plugins to be factory functions" (`packages/cli/src/templates/opencode/plugins/session-start.js:16`, `packages/cli/src/templates/opencode/plugins/inject-workflow-state.js:104`). That argues for pinning and compatibility checks rather than tracking `latest`.

For non-interactive wrapper runs, existing Trellis plugins intentionally skip main-session context injection when `OPENCODE_NON_INTERACTIVE=1` (`packages/cli/src/templates/opencode/plugins/session-start.js:46`, `packages/cli/src/templates/opencode/plugins/inject-workflow-state.js:114`). A deterministic `trellis code run` should probably set this and inject exactly the context it wants in the prompt/config. An interactive `trellis code` launcher should not set it.

OpenCode session identity is special in Trellis. The spec says OpenCode should use `OPENCODE_RUN_ID` when available, otherwise plugin `sessionID`, and should prefix Bash commands with a shell-aware `TRELLIS_CONTEXT_ID` when needed (`.trellis/spec/cli/backend/platform-integration.md:329`). The local resolver implements that precedence through `TRELLIS_CONTEXT_ID`, `OPENCODE_RUN_ID`, and plugin session identifiers (`packages/cli/src/templates/opencode/lib/trellis-context.js:83`).

Sub-agent context injection is already a first-class OpenCode pattern: the spec lists OpenCode as hook-inject via JS plugin `tool.execute.before` with `args.prompt` mutation (`.trellis/spec/cli/backend/platform-integration.md:763`, `.trellis/spec/cli/backend/platform-integration.md:774`), and the local plugin reads `implement.jsonl` / `check.jsonl` before appending PRD content (`packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:20`, `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:45`).

The Trellis CLI currently has no `code` command. The command registration file imports `init`, `update`, and `uninstall` only (`packages/cli/src/cli/index.ts:5`) and registers those three command branches (`packages/cli/src/cli/index.ts:61`, `packages/cli/src/cli/index.ts:115`, `packages/cli/src/cli/index.ts:146`). A wrapper can therefore be added without colliding with an existing command.

### Upstream License

OpenCode upstream is MIT licensed:

- GitHub repo metadata for `anomalyco/opencode` reports `license: MIT` and `html_url: https://github.com/anomalyco/opencode`.
- The upstream `LICENSE` is the standard MIT license and requires retaining the copyright and permission notice in copies/substantial portions.
- Upstream root `package.json`, `packages/opencode/package.json`, `@opencode-ai/sdk`, and `@opencode-ai/plugin` all report MIT in the observed package/source metadata.
- The published `opencode-ai@1.14.31` npm tarball includes a `LICENSE` file.

This is compatible with a Trellis-owned wrapper or bundled distribution from a licensing standpoint. Trellis itself is currently `AGPL-3.0-only` (`packages/cli/package.json`), so the main operational requirement is preserving upstream MIT notices if Trellis redistributes OpenCode binaries, source, or substantial copied code.

### Upstream Source And Package Layout

Current canonical upstream resolved through GitHub is `anomalyco/opencode`:

- Repo: https://github.com/anomalyco/opencode
- Docs: https://opencode.ai/docs/
- Npm CLI wrapper: https://www.npmjs.com/package/opencode-ai
- Npm SDK: https://www.npmjs.com/package/@opencode-ai/sdk
- Npm plugin package: https://www.npmjs.com/package/@opencode-ai/plugin

The root source is a Bun workspace. Observed root `package.json`:

- `private: true`
- `packageManager: bun@1.3.13`
- workspaces include `packages/*`, `packages/console/*`, `packages/sdk/js`, and `packages/slack`
- dependencies include workspace references to `@opencode-ai/plugin`, `@opencode-ai/script`, and `@opencode-ai/sdk`
- repository points at `https://github.com/anomalyco/opencode`
- license is MIT

Relevant top-level packages observed under `packages/`:

- `packages/opencode` - primary CLI/runtime package.
- `packages/sdk/js` - published `@opencode-ai/sdk`.
- `packages/plugin` - published `@opencode-ai/plugin`.
- `packages/app`, `packages/web`, `packages/desktop`, `packages/desktop-electron`, `packages/console/*` - UI surfaces.
- `packages/core`, `packages/script`, `packages/mcp`, `packages/server`-adjacent source directories under `packages/opencode/src/*` - runtime internals.

`packages/opencode/package.json` is private but declares the CLI bin:

- `name: "opencode"`
- `private: true`
- `bin: { "opencode": "./bin/opencode" }`
- `exports: { "./*": "./src/*.ts" }`
- imports for Bun/Node variants of storage, PTY, and Hono adapters
- large runtime dependency set including AI SDK providers, MCP SDK, Hono, OpenTelemetry, TUI, watchers, tree-sitter, PTY, and snapshot/storage packages

The public CLI npm package is not the monorepo package itself. `opencode-ai@1.14.31` is a thin wrapper package:

- `name: opencode-ai`
- `bin: { "opencode": "bin/opencode" }`
- tarball unpacked size observed: 8,961 bytes
- tarball files: `LICENSE`, `bin/opencode`, `package.json`, `postinstall.mjs`
- `optionalDependencies` point to platform binary packages such as `opencode-darwin-arm64`, `opencode-linux-x64`, `opencode-linux-x64-musl`, `opencode-windows-x64`, and baseline x64 variants, all pinned to the same version
- `postinstall` is `bun ./postinstall.mjs || node ./postinstall.mjs`

The published wrapper's `bin/opencode` resolves a platform binary from optional dependency packages, honors `OPENCODE_BIN_PATH`, supports AVX2/baseline selection on x64, handles musl Linux, and then `spawnSync`s the real binary. This is a good fit for Trellis if Trellis depends on `opencode-ai`, but `doctor` must detect package-manager edge cases such as skipped optional dependencies or skipped postinstall scripts.

### Executable Distribution

Official install paths documented by OpenCode include:

- install script: `curl -fsSL https://opencode.ai/install | bash`
- npm/Bun/pnpm/Yarn global install of `opencode-ai`
- Homebrew via `anomalyco/tap/opencode`
- Arch packages
- Windows via WSL recommendation, Chocolatey, Scoop, npm, Mise
- Docker image `ghcr.io/anomalyco/opencode`
- direct binaries from GitHub Releases

The upstream build script compiles binaries with Bun for a matrix covering Linux glibc/musl, macOS, Windows, arm64/x64, and baseline x64 variants. The publish script then:

- publishes every platform binary package
- publishes the wrapper package as `opencode-ai`
- builds/pushes Docker images
- generates AUR and Homebrew packaging metadata
- writes package metadata with `optionalDependencies` for the binaries

For Trellis, there are three realistic distribution choices:

| Choice | What Trellis Ships | Pros | Cons |
|---|---|---|---|
| Existing `trellis code` wrapper in `@mindfoldhq/trellis` | No bundled OpenCode; resolves system `opencode` or a configured path | Smallest change, no binary redistribution, fastest dogfood path | Version skew; users must install OpenCode; global config/auth can leak into runs unless isolated |
| Separate `@mindfoldhq/trellis-code` package depending on pinned `opencode-ai` | Trellis bin plus pinned upstream wrapper/binary optional deps | Trellis controls tested OpenCode version and onboarding; still avoids a fork | Inherits optional-dependency/postinstall failure modes; larger install; must preserve MIT notices |
| Full fork or vendored binary build | Trellis builds and publishes modified OpenCode binaries | Maximum runtime/UI control | Owns Bun build matrix, binary packaging, upstream merges, security fixes, and fast release churn |

### CLI, SDK, Server, And Plugin Surfaces

OpenCode CLI docs explicitly support programmatic use: running `opencode` without args starts the TUI, while commands like `opencode run "..."` can be scripted. The `run` command is documented for non-interactive mode and supports:

- `--model` in provider/model form
- `--agent`
- `--file`
- `--format default|json`
- `--dir`
- `--attach` to a running server
- `--port`
- `--variant`
- `--thinking`
- `--dangerously-skip-permissions`

The upstream `run.ts` source confirms that `--format json` emits newline-delimited JSON events for `tool_use`, `step_start`, `step_finish`, `text`, `reasoning`, and `error`, and that `--dangerously-skip-permissions` replies `once` to permission prompts while default behavior auto-rejects (`https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/cli/cmd/run.ts`).

OpenCode also exposes `opencode serve`, a headless HTTP server. Docs state that it provides API access without the TUI and can use `OPENCODE_SERVER_PASSWORD` for basic auth. This matters for a future Trellis GUI because the GUI can either:

- shell to `opencode run --format json` for simple one-shot execution, or
- start/attach to an OpenCode server and consume the SDK/API for richer session UX.

The public SDK is useful but does not remove the CLI dependency. `@opencode-ai/sdk` exposes `createOpencode()`, `createOpencodeClient()`, and `createOpencodeServer()`. Docs say `createOpencode()` starts both a server and client. Source shows `createOpencodeServer()` uses `cross-spawn` to launch `opencode serve` on PATH and passes inline config through `OPENCODE_CONFIG_CONTENT` (`https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/server.ts`). Therefore an SDK-first Trellis runtime still needs a resolvable OpenCode binary unless Trellis also controls `PATH` / `OPENCODE_BIN_PATH` / local `node_modules/.bin`.

The plugin package is a real public API surface. Docs show TypeScript plugins importing `Plugin` from `@opencode-ai/plugin`, and the package exports types for server plugins plus hooks including `chat.message`, `tool.execute.before`, `tool.execute.after`, `shell.env`, `permission.ask`, and experimental transform hooks (`https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/index.ts`). Trellis already relies on `chat.message` and `tool.execute.before`, so wrapper compatibility must include plugin smoke tests.

### API And Internal Stability

Use the CLI and SDK/plugin packages as the supported boundary. Avoid importing OpenCode runtime internals directly.

Stable-enough surfaces for a wrapper:

- `opencode run --format json` for headless execution.
- `opencode serve` plus `@opencode-ai/sdk` for long-lived local server control.
- `opencode.json` config, project-local `.opencode/plugins/`, project-local agents, and MCP config.
- `@opencode-ai/plugin` types for hook implementations.

Risky surfaces:

- `packages/opencode/src/*` internals. They are exposed through the private workspace package's source export pattern, but this is not a library stability guarantee.
- Plugin hook payload details. Trellis local comments already encode a version-specific plugin factory expectation for OpenCode 1.2.x.
- Experimental config and plugin hooks. OpenCode docs explicitly warn that experimental config options may change or be removed without notice.
- JSON event details from `opencode run --format json`. They are implemented in source and verified locally, but Trellis should still normalize them behind its own event schema rather than exposing raw OpenCode events as the product contract.

Practical stability rule: Trellis Code should expose a Trellis-owned runtime contract and treat OpenCode as an adapter behind it. That contract should include a normalized run input shape, normalized JSONL/event output, version info, and explicit diagnostics. Do not make future GUI code depend on OpenCode raw event names or private storage layout.

### Release Cadence

OpenCode is moving very quickly.

Observed on 2026-05-02:

- GitHub latest release: `v1.14.31`, published 2026-05-01.
- Recent releases from `v1.14.17` through `v1.14.31` occurred between 2026-04-19 and 2026-05-01, often daily or multiple times per day.
- `npm view opencode-ai versions` returned 8,284 versions, with latest `1.14.31`.
- `npm view @opencode-ai/plugin versions` returned 6,478 versions, with latest `1.14.31`.
- `npm view @opencode-ai/sdk versions` returned 6,540 versions, with latest `1.14.31`.
- Local machine currently resolves `/opt/homebrew/bin/opencode` at version `1.14.30`.
- Trellis generated `.opencode/package.json` currently pins `@opencode-ai/plugin` to `1.1.40`, while npm latest observed is `1.14.31`.

Implication: do not depend on unpinned upstream `latest` for a Trellis-owned runtime. Use exact supported OpenCode versions, maintain a compatibility matrix, and make `trellis code doctor` fail or warn clearly when the resolved `opencode` or `@opencode-ai/plugin` version falls outside the tested range.

### Depend On Upstream CLI Vs Fork

Depend on the upstream CLI for MVP.

Reasons:

- The public CLI already provides the required runtime loop: `opencode run`, `--format json`, `--agent`, `--model`, `--dir`, `--attach`, and permission auto-approval.
- The SDK/server path gives a GUI migration route without owning runtime internals immediately.
- Plugins cover Trellis context injection and sub-agent prompt rewriting today.
- MIT license allows redistribution when needed.
- The upstream binary/package release work is non-trivial and already solved by OpenCode.

Do not use only the SDK unless Trellis also controls how the `opencode` executable is resolved. The SDK launches `opencode` via PATH, so "SDK dependency" is not a self-contained runtime dependency.

Fork only if a concrete blocker appears, such as:

- Required event/session data is impossible to obtain via CLI JSON, SDK, server API, or plugin hooks.
- Trellis must alter core prompt/tool assembly for token or policy reasons and upstream hooks cannot do it.
- OpenCode plugin/config compatibility churn becomes costlier than carrying a fork.
- Product needs UI/runtime behavior that upstream will not accept or expose.

### Concrete Wrapper Design Notes

For `trellis code run`:

- Resolve OpenCode in this order: explicit `--opencode-bin`, `OPENCODE_BIN_PATH`, Trellis-managed dependency binary, then PATH `opencode`.
- Print only version/path diagnostics, never secrets.
- Set isolated `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_CACHE_HOME`, and `XDG_STATE_HOME` when deterministic runs matter.
- Generate or point to Trellis-managed `.opencode/` assets using the existing OpenCode template renderer.
- Use a slim primary agent for Trellis workflows/benchmarks to avoid default-token overhead.
- Use `opencode run --format json --dir <workspace> --agent <agent> ...`.
- Set `OPENCODE_NON_INTERACTIVE=1` when Trellis owns prompt/context injection for headless runs.
- Normalize raw OpenCode JSON events into Trellis-owned JSONL before exposing them to benchmarks or GUI code.

For interactive `trellis code`:

- Do not set `OPENCODE_NON_INTERACTIVE=1`; let Trellis OpenCode plugins inject session-start and workflow-state context.
- Preserve upstream TUI behavior and delegate to `opencode`.
- Prefer project-local `.opencode/` assets so the wrapper does not mutate user-global OpenCode config unexpectedly.

For `trellis code doctor`:

- Check `opencode --version`, `opencode debug paths` if available, package manager path, plugin package version, and whether `.opencode/package.json` can install `@opencode-ai/plugin`.
- Verify the Trellis OpenCode plugin hooks load against the resolved OpenCode version.
- Check that provider auth exists without reading or printing API keys.
- Check MCP server names/tool availability when a run profile requires them.
- Check session identity propagation: `OPENCODE_RUN_ID` / plugin sessionID / `TRELLIS_CONTEXT_ID` bridge.

### External References

- https://opencode.ai/docs/ - Official OpenCode docs. Confirms OpenCode is open source and available as terminal UI, desktop app, or IDE extension; install paths include install script, npm `opencode-ai`, Homebrew tap, Arch, Windows options, Docker, and GitHub Releases.
- https://opencode.ai/docs/cli/ - Official CLI docs. Confirms scriptable `opencode run`, `--format json`, `--agent`, `--model`, `--dir`, `--attach`, `--dangerously-skip-permissions`, `serve`, `stats`, `export`, and other commands.
- https://opencode.ai/docs/sdk/ - Official SDK docs. Confirms `@opencode-ai/sdk`, `createOpencode()`, client/server creation, inline config, and generated TypeScript types from OpenAPI.
- https://opencode.ai/docs/plugins/ - Official plugin docs. Confirms local and npm plugins, Bun-based plugin dependency install/cache, TypeScript plugin types from `@opencode-ai/plugin`, and event/hook names.
- https://opencode.ai/docs/config/ - Official config docs. Confirms config sections for providers/models, permissions, MCP, plugins, disabled/enabled providers, variables, and experimental stability warning.
- https://opencode.ai/docs/mcp-servers/ - Official MCP docs. Confirms local/remote MCP support and warns that MCP servers add context, which is relevant to Trellis token discipline.
- https://github.com/anomalyco/opencode - Upstream source repo. Observed repo metadata on 2026-05-02: MIT license, default branch `dev`, latest push on 2026-05-02.
- https://github.com/anomalyco/opencode/blob/dev/package.json - Root Bun workspace package.
- https://github.com/anomalyco/opencode/blob/dev/packages/opencode/package.json - Private runtime/CLI package.
- https://github.com/anomalyco/opencode/blob/dev/packages/opencode/bin/opencode - Published npm wrapper entry script source.
- https://github.com/anomalyco/opencode/blob/dev/packages/opencode/script/postinstall.mjs - Postinstall binary linker.
- https://github.com/anomalyco/opencode/blob/dev/packages/opencode/script/publish.ts - Upstream npm/binary/Docker/Homebrew/AUR publish script.
- https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/cli/cmd/run.ts - `opencode run` implementation and JSON event emission.
- https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/cli/cmd/serve.ts - `opencode serve` implementation.
- https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/server.ts - SDK server launcher; shells to `opencode serve`.
- https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/index.ts - Public plugin type definitions and hook names.
- https://www.npmjs.com/package/opencode-ai - Public CLI wrapper package, observed latest `1.14.31`, MIT.
- https://www.npmjs.com/package/@opencode-ai/sdk - Public SDK package, observed latest `1.14.31`, MIT.
- https://www.npmjs.com/package/@opencode-ai/plugin - Public plugin package, observed latest `1.14.31`, MIT.

### Related Specs

- `.trellis/spec/cli/backend/platform-integration.md` - Defines OpenCode as a JS plugin platform, session identity handling, sub-agent context injection, and per-turn workflow-state injection.
- `.trellis/spec/guides/cross-platform-thinking-guide.md` - Relevant to wrapper executable resolution, XDG/env handling, shell prefixes, Windows/WSL behavior, and POSIX logical path keys.
- `.trellis/spec/cli/backend/directory-structure.md` - Relevant if a new `packages/cli/src/commands/code.ts` or runtime helper module is added later.
- `.trellis/spec/cli/backend/error-handling.md` and `.trellis/spec/cli/backend/quality-guidelines.md` - Relevant for `doctor` diagnostics and command failure behavior in implementation.

## Caveats / Not Found

- The active task pointer was empty (`task.py current --source` returned none). The user gave an exact research target path, so this research used `.trellis/tasks/05-02-trellis-code-opencode/` as the task boundary and wrote only under its `research/` directory.
- `fd` is not installed in this environment; local file discovery used `rg --files` instead.
- No code was modified. This is research only.
- The upstream `opencode-ai` package is a wrapper plus platform optional dependencies, not a full JS library runtime. Trellis must verify optional deps/postinstall/path resolution before relying on it as a bundled dependency.
- `@opencode-ai/sdk` starts `opencode serve`; it is not a replacement for having the CLI binary available.
- Trellis local OpenCode template pins `@opencode-ai/plugin` at `1.1.40`, while upstream latest observed is `1.14.31`. This may be fine, but a Trellis-owned wrapper needs compatibility tests before choosing a supported version range.
- `.trellis/spec/cli/backend/platform-integration.md` still says OpenCode has "no `collectTemplates`" and update does not track OpenCode template files (`.trellis/spec/cli/backend/platform-integration.md:92`), but current code does export `collectOpenCodeTemplates()` (`packages/cli/src/configurators/opencode.ts:86`). This is a spec/code mismatch to handle in the implementation/spec-update phase, not in this research pass.
- The research did not audit every upstream internal module. It focused on distribution/package/runtime surfaces relevant to wrapper vs fork decisions.
