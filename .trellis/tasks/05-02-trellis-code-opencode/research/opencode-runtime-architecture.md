# Research: OpenCode Runtime Architecture for Trellis Code

- Query: Research OpenCode runtime architecture for Trellis Code, focusing on CLI run modes, interactive vs headless execution, JSON/event streams, session/state storage, process lifecycle, and what a future GUI app could consume.
- Scope: mixed
- Date: 2026-05-02

## Findings

OpenCode is architected around a local runtime/server that can be reached through several entry points:

- `opencode` starts the interactive TUI. Official CLI docs describe it as starting the terminal UI with optional `--print-logs`, `--log-level`, `--model`, `--agent`, `--port`, `--hostname`, `--session`, `--continue`, `--prompt`, and file attachment flags: https://opencode.ai/docs/cli
- `opencode run` is the headless entry point. Official CLI docs list `--format` with `json` for raw JSON events, `--session`/`--continue` for session continuity, `--model`, `--agent`, `--file`, `--port`, `--attach`, and `--dangerously-skip-permissions`: https://opencode.ai/docs/cli
- `opencode serve` starts a headless HTTP server. Official server docs state that when you run the TUI, it automatically starts a local server, and that a standalone server can be started with `opencode serve`: https://opencode.ai/docs/server
- `opencode web` starts the server and opens a web UI. Official CLI docs list `web` as a command separate from TUI and run mode: https://opencode.ai/docs/cli
- `opencode attach` connects a terminal UI to a running server. Official CLI docs expose `attach <server>` and `run --attach <server>`: https://opencode.ai/docs/cli
- `opencode session list --format json` provides a CLI-facing, storage-independent way to enumerate sessions. Upstream source formats JSON with `id`, `title`, `updated`, `created`, `projectId`, and `directory`: https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/opencode/src/cli/cmd/session.ts

For Trellis Code, the practical split is:

1. Interactive mode: `trellis code` should spawn `opencode` with Trellis-managed project config, plugins, env, and current-task/session identity.
2. Headless mode: `trellis code run` should spawn `opencode run --format json` and capture stdout as newline-delimited event data, with Trellis adding its own run manifest and normalized event schema.
3. GUI/server mode: the future GUI should run or attach to `opencode serve`, call the local HTTP API/SDK, and subscribe to events rather than scraping the terminal.

### CLI Run Modes

Official CLI docs expose a useful set of primitives:

- `opencode` for TUI.
- `opencode run [message..]` for non-interactive task execution.
- `opencode serve` for standalone server.
- `opencode web` for browser UI.
- `opencode attach <server>` for attaching a TUI to a server.
- `opencode session` for session management.
- `opencode export`, `opencode import`, and `opencode stats` for storage-independent session artifacts and usage summaries.
- `opencode debug` for config, paths, agent, and MCP diagnostics.

Existing benchmark research verified the run-mode details on `opencode 1.14.30`: `opencode run --format json --dangerously-skip-permissions <prompt>` returns clean JSONL on stdout, creates a new session unless `--session`/`--continue` is used, and starts an embedded local server per invocation unless attached to another server. See `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md:14`, `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md:25`, and `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md:49`.

### Interactive vs Headless Execution

Interactive execution is plugin-friendly. The existing Trellis OpenCode integration depends on OpenCode plugin hooks:

- `session-start.js` injects Trellis session context on the first `chat.message` event and persists it into conversation history. It skips when `OPENCODE_NON_INTERACTIVE=1`: `packages/cli/src/templates/opencode/plugins/session-start.js:38`, `packages/cli/src/templates/opencode/plugins/session-start.js:46`, and `packages/cli/src/templates/opencode/plugins/session-start.js:62`.
- `inject-workflow-state.js` injects a workflow breadcrumb on every `chat.message`, also skipping `OPENCODE_NON_INTERACTIVE=1`: `packages/cli/src/templates/opencode/plugins/inject-workflow-state.js:109`, `packages/cli/src/templates/opencode/plugins/inject-workflow-state.js:112`, and `packages/cli/src/templates/opencode/plugins/inject-workflow-state.js:114`.
- `inject-subagent-context.js` hooks `tool.execute.before` and mutates Task-tool prompts to include task JSONL, PRD, and spec context: `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:323`, `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:354`, `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:376`, and `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:397`.

Headless execution should not rely on chat-message injection. The current Trellis plugins deliberately suppress session-start/workflow-state injection under `OPENCODE_NON_INTERACTIVE=1`, so a deterministic Trellis runner should inject task context through explicit prompt construction, a generated runner agent, or a Trellis-owned context file rather than assuming the interactive plugin path fires.

The one piece that is already robust across modes is session identity propagation into Bash. `inject-subagent-context.js` prefixes Bash commands with `TRELLIS_CONTEXT_ID` from the OpenCode session input, using POSIX export syntax or PowerShell syntax on Windows: `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:267`, `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:293`, and `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:297`.

### JSON and Event Streams

There are two event surfaces worth treating as first-class:

1. CLI JSONL from `opencode run --format json`.
2. Server/SDK events from a running OpenCode server.

Official CLI docs describe `run --format json` as raw JSON events: https://opencode.ai/docs/cli. Existing local benchmark research verified observed JSONL event types:

- `step_start`
- `text`
- `tool_use`
- `step_finish`
- `error`

Useful fields include `sessionID`, event timestamp, assistant text, tool call input/output/status/metadata, token counters, cache counters, cost, and finish reason. See `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md:54`, `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md:155`, and `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md:159`.

For a GUI, the richer surface is the server API:

- Official server docs expose an OpenAPI spec and generated TypeScript client: https://opencode.ai/docs/server
- The SDK docs show a typed client with `client.event.subscribe()` using Server-Sent Events and examples for sessions/messages: https://opencode.ai/docs/sdk
- Server docs list REST-style actions for sessions, messages, prompts, abort, status, diffs, files, LSP, MCP, config, app info, and instance disposal: https://opencode.ai/docs/server
- Upstream server source builds a Hono/Efffect HTTP API and routes global, control-plane, workspace, instance, and UI surfaces through a shared server runtime: https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/opencode/src/server/server.ts

Trellis Code should treat OpenCode event objects as raw upstream events and wrap them in a stable Trellis event envelope. A minimal GUI-consumable stream should include:

- `run.started`: Trellis run id, mode, cwd, task id, model, agent, OpenCode version, server/attach mode, env keys used but not secret values.
- `opencode.event`: raw upstream JSON event plus normalized fields when available.
- `session.created`: upstream `sessionID` and selected session metadata.
- `assistant.text`: text deltas or final text chunks.
- `tool.started` / `tool.finished`: tool name, call id, status, elapsed time, exit metadata, output path if output is too large.
- `step.finished`: token/cost/finish reason.
- `run.finished`: exit code, reason, artifact paths, summary counters, final session id.
- `run.error`: process, permission, model/provider, server, plugin, or parse failure.

The wrapper should preserve raw OpenCode JSONL as a forensic artifact and derive normalized Trellis events as the product contract.

### Session and State Storage

OpenCode has user-visible storage commands and internal storage layouts. Trellis Code should prefer the user-visible interfaces.

Known external interfaces:

- `opencode session list --format json` for recent sessions: https://opencode.ai/docs/cli
- `opencode export <sessionID>` and `opencode import <file>` for portable session artifacts: https://opencode.ai/docs/cli
- HTTP/SDK session and message APIs: https://opencode.ai/docs/server and https://opencode.ai/docs/sdk
- `opencode debug paths` for active config/data/cache/state paths: https://opencode.ai/docs/cli

Existing benchmark research verified that OpenCode state can be isolated by setting `XDG_DATA_HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, and `XDG_STATE_HOME`, and that `--dir` controls the workspace independently. See `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md:18`, `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md:185`, and `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md:200`.

Upstream source confirms storage internals are implementation detail. Current `storage.ts` writes JSON files under `Global.Path.data/storage`, runs migrations, and exposes `read`, `write`, `update`, `remove`, and `list` over key arrays: https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/opencode/src/storage/storage.ts. Current `session.ts` also uses a SQL-backed session table and sync events for session/message state: https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/opencode/src/session/session.ts. This is a strong reason not to make Trellis GUI read OpenCode disk state directly.

For Trellis Code:

- Use XDG isolation for benchmark/headless attempts.
- Use OpenCode server/SDK or `opencode export` for GUI/session replay.
- Archive raw run JSONL, stderr logs, OpenCode export output, and a Trellis run manifest.
- Avoid coupling GUI code to `~/.local/share/opencode/storage` or any current SQLite/JSON layout.

### Process Lifecycle

A Trellis-owned runtime should model three lifecycle classes:

1. Single-shot headless process.
   - Spawn `opencode run --format json --dir <cwd> --agent <agent>`.
   - Capture stdout JSONL, stderr logs, exit code, and session id.
   - Use per-run XDG roots when isolation matters.
   - Set `TRELLIS_CONTEXT_ID` explicitly so Trellis scripts resolve session-scoped task state.

2. Interactive child process.
   - Spawn `opencode` and let OpenCode own the TUI lifecycle.
   - Ensure `.opencode/` project templates and plugin dependencies are installed before launch.
   - Do not set `OPENCODE_NON_INTERACTIVE=1`, because existing Trellis session-start/workflow plugins skip in that mode.

3. Managed local server for GUI.
   - Spawn `opencode serve --port <port> --hostname 127.0.0.1`.
   - Connect with OpenCode's generated SDK or raw HTTP API.
   - Subscribe to SSE events.
   - Create/send/abort sessions through server endpoints.
   - Shut down through process signal or server disposal endpoint when appropriate.

`opencode run --attach <server>` is important because it lets Trellis reuse a warm server while still presenting a headless run command. That is likely the best GUI bridge: the GUI owns the long-lived server, while background tasks are executed through attached headless runs that still produce JSONL and session ids.

### What a Future GUI Can Consume

The future GUI should consume a Trellis runtime boundary, not OpenCode internals directly. Recommended MVP contract:

Input file:

```json
{
  "version": 1,
  "mode": "headless",
  "cwd": "/path/to/workspace",
  "taskDir": ".trellis/tasks/05-02-trellis-code-opencode",
  "contextId": "trellis-code-...",
  "promptFile": "prompt.md",
  "agent": "trellis-runner",
  "model": "provider/model",
  "permissions": "default-deny",
  "server": {
    "mode": "ephemeral"
  }
}
```

Output manifest:

```json
{
  "version": 1,
  "runId": "trc_...",
  "mode": "headless",
  "opencodeVersion": "1.14.30",
  "sessionId": "ses_...",
  "pid": 12345,
  "startedAt": "2026-05-02T00:00:00.000Z",
  "finishedAt": "2026-05-02T00:00:10.000Z",
  "exitCode": 0,
  "artifacts": {
    "events": "events.jsonl",
    "normalizedEvents": "trellis-events.jsonl",
    "stderr": "stderr.log",
    "opencodeExport": "session.json",
    "summary": "summary.json"
  }
}
```

GUI consumption rules:

- Render live progress from normalized Trellis events.
- Link back to raw OpenCode event artifacts for debugging.
- Use OpenCode SDK/server for rich session inspection when a managed server is alive.
- Treat OpenCode export as the portable replay format.
- Never parse or mutate OpenCode auth/config/storage files directly.
- Never echo secret environment values in manifests or event streams.

## Files Found

- `.trellis/tasks/05-02-trellis-code-opencode/prd.md` — Defines the product goal: a Trellis-owned OpenCode-backed runtime for tasks, telemetry, and a future GUI app. Relevant lines: `.trellis/tasks/05-02-trellis-code-opencode/prd.md:5`, `.trellis/tasks/05-02-trellis-code-opencode/prd.md:25`, `.trellis/tasks/05-02-trellis-code-opencode/prd.md:30`, `.trellis/tasks/05-02-trellis-code-opencode/prd.md:62`, and `.trellis/tasks/05-02-trellis-code-opencode/prd.md:83`.
- `.trellis/tasks/05-02-trellis-code-opencode/research/opencode-foundation.md` — Prior local foundation analysis recommending an OpenCode-backed wrapper/distribution rather than a fork. Relevant lines: `.trellis/tasks/05-02-trellis-code-opencode/research/opencode-foundation.md:13`, `.trellis/tasks/05-02-trellis-code-opencode/research/opencode-foundation.md:20`, `.trellis/tasks/05-02-trellis-code-opencode/research/opencode-foundation.md:74`, and `.trellis/tasks/05-02-trellis-code-opencode/research/opencode-foundation.md:83`.
- `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md` — Verified `opencode run --format json`, JSONL telemetry, XDG isolation, and permission controls on a local OpenCode install. Relevant lines: `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md:14`, `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md:17`, `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md:175`, and `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md:185`.
- `packages/cli/src/configurators/opencode.ts` — Trellis installer/update logic for `.opencode/` templates, commands, skills, and plugin assets. Relevant lines: `packages/cli/src/configurators/opencode.ts:40`, `packages/cli/src/configurators/opencode.ts:86`, and `packages/cli/src/configurators/opencode.ts:106`.
- `packages/cli/src/templates/opencode/lib/trellis-context.js` — Resolves Trellis context identity from env or OpenCode hook input, reads `.trellis/.runtime/sessions/*.json`, and loads JSONL-referenced context files. Relevant lines: `packages/cli/src/templates/opencode/lib/trellis-context.js:83`, `packages/cli/src/templates/opencode/lib/trellis-context.js:107`, `packages/cli/src/templates/opencode/lib/trellis-context.js:120`, and `packages/cli/src/templates/opencode/lib/trellis-context.js:257`.
- `packages/cli/src/templates/opencode/lib/session-utils.js` — Builds the injected Trellis session-start payload and uses OpenCode client session history for dedupe. Relevant lines: `packages/cli/src/templates/opencode/lib/session-utils.js:204`, `packages/cli/src/templates/opencode/lib/session-utils.js:227`, `packages/cli/src/templates/opencode/lib/session-utils.js:352`, and `packages/cli/src/templates/opencode/lib/session-utils.js:412`.
- `packages/cli/src/templates/opencode/plugins/session-start.js` — OpenCode `chat.message` plugin for one-shot session-start context injection. Relevant lines: `packages/cli/src/templates/opencode/plugins/session-start.js:16`, `packages/cli/src/templates/opencode/plugins/session-start.js:38`, `packages/cli/src/templates/opencode/plugins/session-start.js:46`, and `packages/cli/src/templates/opencode/plugins/session-start.js:62`.
- `packages/cli/src/templates/opencode/plugins/inject-workflow-state.js` — OpenCode `chat.message` plugin for per-turn workflow breadcrumbs. Relevant lines: `packages/cli/src/templates/opencode/plugins/inject-workflow-state.js:104`, `packages/cli/src/templates/opencode/plugins/inject-workflow-state.js:109`, and `packages/cli/src/templates/opencode/plugins/inject-workflow-state.js:112`.
- `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js` — OpenCode `tool.execute.before` plugin for Task sub-agent context and Bash `TRELLIS_CONTEXT_ID` propagation. Relevant lines: `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:23`, `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:48`, `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:267`, `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:323`, and `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:395`.
- `packages/cli/src/templates/opencode/package.json` — Declares the OpenCode plugin dependency currently installed by Trellis. Relevant line: `packages/cli/src/templates/opencode/package.json:3`.
- `packages/cli/test/templates/opencode.test.ts` — Tests OpenCode session dedupe and Bash context propagation behavior. Relevant lines: `packages/cli/test/templates/opencode.test.ts:32`, `packages/cli/test/templates/opencode.test.ts:124`, and `packages/cli/test/templates/opencode.test.ts:138`.

## Code Patterns

- Trellis already treats OpenCode as a JS-plugin platform rather than a Python-hook platform. `.trellis/spec/cli/backend/platform-integration.md` defines the JS plugin pattern and notes OpenCode uses plugins, lib files, and package dependencies: `.trellis/spec/cli/backend/platform-integration.md:82`.
- The OpenCode configurator makes `configureOpenCode()` and `collectOpenCodeTemplates()` use the same file map, which is important for future `trellis code doctor` compatibility checks: `packages/cli/src/configurators/opencode.ts:86` and `packages/cli/src/configurators/opencode.ts:106`.
- Trellis session identity resolution is layered: `TRELLIS_CONTEXT_ID`, then `OPENCODE_RUN_ID`, then hook input `sessionID`, then conversation/transcript fallbacks: `packages/cli/src/templates/opencode/lib/trellis-context.js:83`.
- Active task state is read from `.trellis/.runtime/sessions/<contextKey>.json`, not from a global mutable pointer: `packages/cli/src/templates/opencode/lib/trellis-context.js:107` and `packages/cli/src/templates/opencode/lib/trellis-context.js:120`.
- Implement/check context injection reads `implement.jsonl` / `check.jsonl`, PRD, and optional info file at sub-agent call time: `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:20` and `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:45`.
- Existing interactive context plugins explicitly skip non-interactive mode, which should shape headless Trellis Code design: `packages/cli/src/templates/opencode/plugins/session-start.js:46` and `packages/cli/src/templates/opencode/plugins/inject-workflow-state.js:114`.
- Bash context propagation is already cross-platform-aware and should be reused by Trellis Code rather than reimplemented: `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:267`.
- Existing tests cover the important runtime assumption that OpenCode tool hooks can receive a session id and inject it into shell commands: `packages/cli/test/templates/opencode.test.ts:125`.

## External References

- OpenCode CLI docs: https://opencode.ai/docs/cli
- OpenCode server docs: https://opencode.ai/docs/server
- OpenCode SDK docs: https://opencode.ai/docs/sdk
- OpenCode config docs: https://opencode.ai/docs/config
- OpenCode permissions docs: https://opencode.ai/docs/permissions
- OpenCode plugin docs: https://opencode.ai/docs/plugins
- OpenCode upstream repo: https://github.com/sst/opencode and current redirected org https://github.com/anomalyco/opencode
- Upstream `run.ts`: https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/opencode/src/cli/cmd/run.ts
- Upstream `session.ts` CLI command: https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/opencode/src/cli/cmd/session.ts
- Upstream server runtime: https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/opencode/src/server/server.ts
- Upstream storage service: https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/opencode/src/storage/storage.ts
- Upstream session service: https://raw.githubusercontent.com/anomalyco/opencode/dev/packages/opencode/src/session/session.ts
- Prior Trellis OpenCode driver research with local CLI probe: `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md`

## Related Specs

- `.trellis/workflow.md` — The Trellis task system and persistence rule require research and decisions to land in task files; current-task state is session-scoped under `.trellis/.runtime/sessions/`.
- `.trellis/spec/cli/backend/index.md` — Backend spec index; points to platform-integration and workflow-state guidance.
- `.trellis/spec/cli/backend/platform-integration.md` — Relevant because Trellis Code extends the OpenCode platform integration into a first-party runtime.
- `.trellis/spec/cli/backend/workflow-state-contract.md` — Relevant if Trellis Code changes session identity, breadcrumb injection, or runtime state mechanics.
- `.trellis/spec/guides/cross-platform-thinking-guide.md` — Relevant for process spawning, environment variables, path normalization, and Windows shell differences.

## Caveats / Not Found

- OpenCode storage internals are moving. Previous local research observed JSON files under `$XDG_DATA_HOME/opencode/storage/`; current upstream source also shows SQL-backed session tables and sync events. Treat disk storage as non-contractual and use CLI export/session commands or server/SDK APIs.
- `opencode run --format json` is verified locally through prior research, but the exact event schema is still OpenCode-version-sensitive. Trellis Code should record `opencode --version` in every manifest and keep a compatibility parser with raw-event passthrough.
- Existing Trellis OpenCode plugins are interactive-first. `session-start.js` and `inject-workflow-state.js` skip non-interactive mode, so headless Trellis Code must inject context explicitly instead of relying on chat-message hooks.
- Server security details need a separate implementation-phase check. Official server docs mention password/CORS configuration; Trellis GUI should bind to loopback by default and avoid exposing the local server without explicit user configuration.
- I did not find a stable official promise that OpenCode's internal file layout will remain compatible across versions. The recommended stable GUI surface is SDK/HTTP/SSE plus exported session artifacts.
