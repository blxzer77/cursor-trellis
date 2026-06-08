# Research: OpenCode Plugin API

- **Query**: OpenCode plugin mechanism — complete API for Trellis trace + memory plugin adapter
- **Scope**: mixed (internal Trellis plugins + external OpenCode docs/source)
- **Date**: 2026-04-20
- **Target OpenCode versions**: covers 1.0.x → 1.3.x, with explicit notes on 1.2.x breaking change

---

## 1. Executive Summary

OpenCode (sst/opencode, now mirrored at anomalyco/opencode) ships a first-class plugin API exported as `@opencode-ai/plugin`. A plugin is a factory function that returns a `Hooks` object. Hooks cover:

- **Lifecycle events** via `event` hook (session.created, session.idle, session.compacted, message.*, file.*, permission.*, lsp.*, todo.updated, tui.*, command.executed, tool.execute.*)
- **Chat intercepts** (`chat.message`, `chat.params`, `chat.headers`, `experimental.chat.system.transform`)
- **Tool intercepts** (`tool.execute.before`, `tool.execute.after`, `tool.definition`)
- **Command / shell / permission hooks** (`command.execute.before`, `shell.env`, `permission.ask`)
- **Compaction** (`experimental.session.compacting`)
- **Registration** (`tool`, `auth`, `provider`, `config`)

Capability parity with Claude Code is strong but asymmetric: OpenCode gives richer in-process mutation (args/output/params/system-prompt are all mutable), but has weaker "block and have LLM reconsider" semantics (no native `agent`-spawning hook, see issue #20387). Conversation transcripts persist to `~/.local/share/opencode/storage/` as per-session JSON files, analogous to Claude Code's `~/.claude/projects/` JSONL — but with a different schema (session/message/part split across three directories).

---

## 2. Plugin Lifecycle & Loading

### 2.1 Discovery sources and priority

From docs `https://dev.opencode.ai/docs/plugins` and `packages/opencode/src/config/config.ts` (`deduplicatePlugins`):

Load precedence (low → high, later wins for dedupe by canonical name):

1. Remote `.well-known/opencode` (org defaults)
2. Global config `~/.config/opencode/opencode.json{,c}` → `plugin: []` array
3. Project config `./opencode.json{,c}` → `plugin: []` array
4. Global plugin directory `~/.config/opencode/plugins/` (auto-scan)
5. Project plugin directory `./.opencode/plugins/` (auto-scan, highest priority)

Note: docs sometimes write `.opencode/plugin/` (singular) but current docs + source show `.opencode/plugins/` (plural). Both the Trellis repo and the public docs use the **plural** form.

Dedup: `deduplicatePlugins()` reverses, keeps first occurrence per canonical name, restores order. Local overrides npm overrides global.

### 2.2 Load mechanism

Source: `packages/opencode/src/plugin/index.ts` (anomalyco/opencode dev branch).

```ts
// simplified
const INTERNAL_PLUGINS: PluginInstance[] = [
  CodexAuthPlugin, CopilotAuthPlugin, GitlabAuthPlugin, PoeAuthPlugin
]
// 1) run built-ins
for (const plugin of INTERNAL_PLUGINS) hooks.push(await plugin(input))

// 2) run external plugins. For each loaded module:
for (const [_name, fn] of Object.entries<PluginInstance>(mod)) {
  if (seen.has(fn)) continue
  seen.add(fn)
  hooks.push(await fn(input))     // <-- every export must be callable
}
```

Key takeaways:

- OpenCode iterates **every export** of a plugin module and invokes it with the shared `PluginInput`. Non-function exports throw `TypeError: fn is not a function`.
- Deduped by identity: the same function reference is skipped if re-exported.
- For npm-installed plugins, `bun install` runs at startup; packages cached under `~/.cache/opencode/node_modules/`.
- Load order within a single directory was **nondeterministic** prior to the fix in PR #14531 (sort glob results) — relevant for any plugin that mutates a shared output array such as `system`/`context`. OpenCode 1.2.10 reportedly still has this bug.
- Known bug #15591: in 1.2.15 only the last plugin in `opencode.json`'s `plugin` array is loaded; workaround is to use the `.opencode/plugins/` directory instead.

### 2.3 Plugin factory shape — the 1.2.x breaking change

**Before 1.2.x** (approximately): several community plugins shipped an object form:

```js
export default { id: "my-plugin", server: async (input) => hooks }
```

Some OpenCode builds detected `.server` via `readV1Plugin(load.mod, load.spec, "server", "detect")` and called it. This "v1" detection still exists in `applyPlugin()` on the dev branch.

**Starting 1.2.x** (confirmed by Trellis commit `5fbf961` + GitHub source `anomalyco/opencode/blob/7daea69e/packages/opencode/src/plugin/index.ts`), the main loader iterates `Object.entries(mod)` and invokes each export:

```ts
for (const [_name, fn] of Object.entries<PluginInstance>(mod)) {
  const init = await fn(input)     // plugin must be callable
  hooks.push(init)
}
```

So the only guaranteed-compatible shape is the **factory function**:

```js
// WORKS on 1.2.x
export default async ({ directory, client, project, worktree, $, serverUrl }) => {
  return {
    "chat.message": async (input, output) => { /* ... */ },
    "tool.execute.before": async (input, output) => { /* ... */ },
  }
}
```

This matches the `@opencode-ai/plugin` type: `Plugin = (input: PluginInput) => Promise<Hooks>`.

Trellis has all three plugins on this shape. See `.opencode/plugins/inject-subagent-context.js:263`, `.opencode/plugins/inject-workflow-state.js:111`, `.opencode/plugins/session-start.js:436`.

### 2.4 PluginInput context

Source: `packages/plugin/src/index.ts` (dev branch):

```ts
export type PluginInput = {
  client: ReturnType<typeof createOpencodeClient>
  project: Project
  directory: string
  worktree: string
  serverUrl: URL
  $: BunShell                 // Bun.$, used for shell commands
}

export type PluginOptions = Record<string, unknown>
export type Plugin = (input: PluginInput, options?: PluginOptions) => Promise<Hooks>
```

- `client`: SDK client; can call `client.session.messages({ path: { id: sessionID } })` etc. — used by Trellis for dedupe.
- `project`: project metadata (id, root, etc.)
- `directory`: current working directory for the session
- `worktree`: git worktree root
- `serverUrl`: OpenCode server HTTP URL (defaults to `http://localhost:4096`)
- `$`: Bun's shell helper (e.g., `$`cmd`.text()`)
- `options` (second arg): passed when a plugin is configured as `["name", {opts}]` in `opencode.json`

### 2.5 `INTERNAL_PLUGINS`

Loaded before any user plugin:

- `CodexAuthPlugin`
- `CopilotAuthPlugin`
- `GitlabAuthPlugin`
- `PoeAuthPlugin`

These use the `auth` hook (not relevant for memory/trace plugins, but shows the pattern).

---

## 3. Complete Hooks Interface

Full signature from `packages/plugin/src/index.ts` (reconstructed from multiple commits; see Caveats for version gaps).

```ts
export interface Hooks {
  // ---- Registration hooks (called once at load) ----
  tool?: { [toolID: string]: ToolDefinition }
  auth?: AuthHook
  provider?: ProviderHook
  config?: (input: Config) => Promise<void>

  // ---- Firehose ----
  event?: (input: { event: Event }) => Promise<void>

  // ---- Chat lifecycle (mutable output) ----
  "chat.message"?: (
    input: {
      sessionID: string
      agent?: string
      model?: { providerID: string; modelID: string }
      messageID?: string
      variant?: string
    },
    output: { message: UserMessage; parts: Part[] },
  ) => Promise<void>

  "chat.params"?: (
    input: { sessionID: string; agent: string; model: Model; provider: ProviderContext; message: UserMessage },
    output: { temperature: number; topP: number; topK: number; options: Record<string, any> },
  ) => Promise<void>

  "chat.headers"?: (
    input: { sessionID: string; agent: string; model: Model; provider: ProviderContext; message: UserMessage },
    output: { headers: Record<string, string> },
  ) => Promise<void>

  "experimental.chat.system.transform"?: (
    input: { /* empty {} in 1.2.x; PRs propose sessionID, model, userMessage */ },
    output: { system: string[] },
  ) => Promise<void>

  // ---- Compaction ----
  "experimental.session.compacting"?: (
    input: { sessionID: string; model: Model; /* ... */ },
    output: { context: string[]; prompt?: string },
  ) => Promise<void>

  // ---- Tool lifecycle ----
  "tool.definition"?: (
    input: { toolID: string },
    output: { description: string; parameters: any },
  ) => Promise<void>

  "tool.execute.before"?: (
    input: { tool: string; sessionID: string; callID: string },  // messageID proposed in #15933
    output: { args: any },
  ) => Promise<void>

  "tool.execute.after"?: (
    input: { tool: string; sessionID: string; callID: string; args: any },
    output: { title: string; output: string; metadata: any },
  ) => Promise<void>

  // ---- Command / shell / permission ----
  "command.execute.before"?: (
    input: { command: string; sessionID: string; arguments: string },
    output: { parts: Part[] },
  ) => Promise<void>

  "shell.env"?: (
    input: { cwd: string; sessionID?: string; callID?: string },
    output: { env: Record<string, string> },
  ) => Promise<void>

  "permission.ask"?: (
    input: Permission,
    output: { status: "ask" | "deny" | "allow" },
  ) => Promise<void>
}
```

### Notes on mutability

`Plugin.trigger(name, input, output)` in `packages/opencode/src/plugin/index.ts` passes both `input` and `output` by reference to every registered plugin in sequence, returning the (possibly mutated) `output`. Hooks must **mutate in place**; returning a new object is ignored.

Trellis's `inject-subagent-context.js:332-334` explicitly notes this:

```js
// Mutate args in-place — whole-object replacement does NOT work for the task tool
// because the runtime holds a local reference to the same args object.
args.prompt = newPrompt
```

---

## 4. Event Firehose — complete event type list

Source: `dev.opencode.ai/docs/plugins` + `packages/sdk/go/event.go` + community gist.

| Category | Event types |
|---|---|
| Command | `command.executed` |
| File | `file.edited`, `file.watcher.updated` |
| Installation | `installation.updated` |
| IDE | `ide.installed` |
| LSP | `lsp.client.diagnostics`, `lsp.updated` |
| Message | `message.updated`, `message.removed`, `message.part.updated`, `message.part.removed` |
| Permission | `permission.updated`, `permission.replied` |
| Session | `session.created`, `session.deleted`, `session.idle`, `session.error`, `session.compacted`, `session.diff` |
| Shell | `shell.env` |
| Todo | `todo.updated` |
| Tool | `tool.execute.before`, `tool.execute.after` (also firehosed through `event`) |
| TUI | `tui.prompt.append`, `tui.command.execute`, `tui.toast.show` |

### `session.compacted` payload (used by Trellis)

Trellis `.opencode/plugins/session-start.js:442-455` handles it:

```js
event: ({ event }) => {
  if (event?.type === "session.compacted" && event?.properties?.sessionID) {
    const sessionID = event.properties.sessionID
    contextCollector.clear(sessionID)   // re-inject after compaction
  }
}
```

So the shape is `{ type: "session.compacted", properties: { sessionID: string, ... } }`.

### Missing from event firehose (known gaps)

- `session.stopping` (lifecycle hook for Stop equivalent) — proposed in #16598 / #16626, not yet shipped.
- Agent/subagent lifecycle events (e.g., when Task tool spawns a child session) — inferred via `tool.execute.before` on the `task` tool, no dedicated event.

---

## 5. Hook Capability Matrix: what can plugins actually DO?

| Capability | Available? | Via which hook | Notes |
|---|---|---|---|
| Read session state | ✓ | PluginInput `client` | `client.session.messages()` etc. |
| Inject text into user message (persisted) | ✓ | `chat.message` mutate `output.parts` | Trellis uses this for session-start + breadcrumbs |
| Inject text into system prompt | ✓ | `experimental.chat.system.transform` push into `output.system` | Per-LLM-call; not persisted to transcript |
| Modify tool call arguments | ✓ | `tool.execute.before` mutate `output.args` | e.g., shescape bash input |
| Block a tool call | ✓ | `tool.execute.before` throw | LLM sees error, decides next step |
| Modify tool result | ✓ | `tool.execute.after` mutate `output.output/title/metadata` | e.g., truncate, redact |
| Spawn sub-agent from hook | ✗ | (proposed #20387) | Key gap vs Claude Code's `agent` type |
| Change LLM params per call | ✓ | `chat.params` | temperature, topP, topK, provider options |
| Add custom HTTP headers | ✓ | `chat.headers` | Observability tracing headers |
| Register a new tool | ✓ | `tool` hook | Uses `tool()` helper + Zod schema |
| Register auth/provider | ✓ | `auth` / `provider` | Used by internal Codex/Copilot/GitLab/Poe |
| Inject env vars for shell tool | ✓ | `shell.env` mutate `output.env` | Added in 1.1.65 |
| Modify tool definition sent to LLM | ✓ | `tool.definition` mutate `output.description/parameters` | Added in 1.1.65 |
| Modify slash command arguments | ✓ | `command.execute.before` | Added in 1.1.65 |
| Auto-allow/deny permission | ✓ | `permission.ask` mutate `output.status` | Has ask/deny/allow trichotomy |
| Hook compaction | ✓ | `experimental.session.compacting` mutate `output.context` or replace `output.prompt` | Inject cross-compaction memory |
| Observe everything | ✓ | `event` | Firehose for logging/trace |

### `chat.message` vs `experimental.chat.system.transform`

Important distinction for Trellis's trace/memory plugin:

- **`chat.message`** fires once per user message; mutating `output.parts` persists the mutation to the transcript (messages are saved by `updateMessage`/`updatePart` after hooks run). Trellis uses this so its breadcrumbs show up in history.
- **`experimental.chat.system.transform`** fires on every LLM request before the system prompt is assembled. Mutation only affects the system prompt for that single LLM call; not persisted. Better for volatile context injection (memory recall per-turn without polluting history).

---

## 6. Transcript Persistence (Memory & Trace source of truth)

Source: `packages/opencode/src/storage/storage.ts` and forums summary.

### 6.1 File layout

Root: `~/.local/share/opencode/storage/` (XDG `$XDG_DATA_HOME`).

```
~/.local/share/opencode/storage/
├── session/<projectID>/<sessionID>.json     # Session metadata (summary, diffs)
├── message/<sessionID>/<messageID>.json     # Each message (user / assistant)
├── part/<messageID>/<partID>.json           # Each Part (text, tool-call, tool-result, etc.)
├── session_diff/<sessionID>.json            # Cumulative diffs for the session
├── share/<sessionID>.json                   # Share metadata (if /share was used)
└── tool-output/...                          # Raw tool outputs
```

### 6.2 Message / Part schema

From `packages/opencode/src/session/message-v2.ts`:

- `MessageV2.Info` = the message row: id, sessionID, plus a `data` blob with role/model/timestamps etc.
- `Part` is a **discriminated union** on `.type`:
  - `text` — plain text
  - `file` — file attachment (with `mime`)
  - `tool` — tool call + result
  - `snapshot` — session state snapshot
  - `patch` — patch applied
  - `agent` — subagent invocation
  - `retry` — retry marker
  - `compaction` — compaction boundary

This is what Trellis plugins append to via `output.parts.push({ type: "text", text: "..." })`.

### 6.3 Comparison to Claude Code `~/.claude/projects/`

| Dimension | Claude Code | OpenCode |
|---|---|---|
| Root | `~/.claude/projects/<project-slug>/` | `~/.local/share/opencode/storage/` |
| Unit of persistence | One JSONL per session (line-delimited) | Many small JSON files, split by entity |
| Message grouping | Single file, order-preserved | `message/<sessionID>/*.json`, sorted by MessageID |
| Structured parts | Parts are embedded in each JSONL line | `part/<messageID>/<partID>.json` — one file per part |
| Tool results | Embedded in assistant JSONL entry | Separate `tool-output/` entries + `part/*` of type `tool` |
| Project scoping | Project = directory; slug in path | `session/<projectID>/<sessionID>` — projectID is explicit |
| Export | Read JSONL directly | `opencode export [sessionID] [-f markdown|json]` or `/export` inside TUI |
| Community tooling | Many transcript viewers | `opencode-replay` (ramtinj95/opencode-replay) generates static HTML from storage dir |

**For a trace/memory adapter**: OpenCode's split-file layout is a double-edged sword. Reading transcripts means walking three directories (session → message → part). But it also makes streaming easier (watch `part/` for new files).

### 6.4 Related issues (open feature requests)

- **#14292** — save sessions in project folder instead of XDG data dir (open, "reasonable" per maintainer)
- **#16077** — persistent session memory / `--memory-file` (open)
- **#19017** — save conversation history locally (open)
- **#16765** — track session transcript across compactions (open; very relevant)
- **#22110** — add `opencode session prune` (open)

These indicate that **OpenCode has no built-in memory concept yet**, which is exactly the gap Trellis memory plugin would fill.

---

## 7. Claude Code ↔ OpenCode Hook Mapping

Sourced from `claude-plugins.dev/skills/.../creating-opencode-plugins` and cross-referenced with `@opencode-ai/plugin` types.

| Claude Code hook | OpenCode equivalent | Payload mapping | Capability parity |
|---|---|---|---|
| `SessionStart` | `event` with `event.type === "session.created"` | `{ sessionID, ... }` | ✓ Full |
| `UserPromptSubmit` | `chat.message` | input `{ sessionID, agent?, model?, messageID? }`; output `{ message, parts }` — mutate parts | ✓ Full (Trellis uses this) |
| (inject into system prompt per turn) | `experimental.chat.system.transform` | output `{ system: string[] }` | ✓ — OpenCode has a more targeted hook Claude Code lacks |
| `PreToolUse` | `tool.execute.before` | input `{ tool, sessionID, callID }`; output `{ args }` | ✓ Can throw to block; mutate args to rewrite |
| `PostToolUse` | `tool.execute.after` | input `{ tool, sessionID, callID, args }`; output `{ title, output, metadata }` | ✓ Can modify result |
| `PreToolUse` with `type: "agent"` | — | — | ✗ Not yet — proposed in #20387; workaround: `event` + external SDK call |
| `Stop` | — (no `session.stopping` yet) | — | ✗ Proposed #16598 / #16626; workaround: use `session.idle` event |
| `SubagentStop` | — | — | ✗ No dedicated hook; observe via `event` + message patterns |
| `Notification` | `event` with `tui.toast.show` (outbound only) | — | Partial — plugin can TRIGGER toasts but hook itself fires on toast render |
| `PreCompact` | `experimental.session.compacting` | output `{ context, prompt? }` | ✓ Richer — can both append context and replace entire compaction prompt |
| (permission prompt) | `permission.ask` | input `Permission`; output `{ status: "ask"|"deny"|"allow" }` | ✓ — auto allow/deny |
| (inject env into Bash) | `shell.env` | input `{ cwd, sessionID?, callID? }`; output `{ env }` | ✓ OpenCode-specific; Claude Code has no equivalent |
| SDK `beforeEach` / audit | `event` firehose | `{ event: Event }` | ✓ |

### Semantic gaps to document for Trellis adapter

1. **No Stop hook** — for "done talking, flush memory" triggers, use `session.idle` event. Not guaranteed to fire only once; fires after every assistant response.
2. **No agent-spawning from hook** — can't pause execution for LLM consultation inside a hook. Workarounds: either use `chat.message` to push a directive and let the main agent decide, or call `client.session.prompt` asynchronously via fire-and-forget (loses sync back).
3. **`messageID` missing from tool hooks** (issue #15933) — correlating tool calls to assistant messages requires additional indexing. `callID` is unique per call but doesn't group by message.
4. **`sessionID` missing from `experimental.chat.system.transform`** (issue #6142) — makes tracing plugins hard; currently workaround is to cache sessionID from a prior `chat.message` fire.

---

## 8. Trellis's existing usage (concrete examples)

### Plugin 1 — `session-start.js` (`UserPromptSubmit`-like behavior)

- Factory: `async ({ directory, client }) => Hooks`
- Subscribes: `event` (listens for `session.compacted` to clear dedupe), `chat.message`
- In `chat.message`:
  1. Skips if `OPENCODE_NON_INTERACTIVE === "1"`
  2. In-memory dedupe via `contextCollector`
  3. Persisted dedupe via `client.session.messages({ path: { id: sessionID } })` checking `part.metadata.trellis.sessionStart`
  4. Builds a context block (workflow state, spec paths, task status) and prepends to the first text part in `output.parts`
  5. Marks the part with `metadata.trellis.sessionStart = true`

### Plugin 2 — `inject-workflow-state.js` (per-turn breadcrumb)

- Subscribes: `chat.message` only
- No dedupe — fires every turn; prepends a small `<workflow-state>` block to the first text part
- Breadcrumb text sourced from `[workflow-state:STATUS]` blocks in `workflow.md`

### Plugin 3 — `inject-subagent-context.js` (`PreToolUse` on `task` tool)

- Subscribes: `tool.execute.before`
- Filters `input.tool === "task"` and `args.subagent_type ∈ {implement, check, research}`
- Mutates `args.prompt` in place with a larger templated prompt containing injected spec context

---

## 9. Code Patterns & Idioms

### 9.1 Canonical 1.2.x plugin skeleton

```js
// .opencode/plugins/example.js
export default async ({ directory, client, project, worktree, $, serverUrl }) => {
  // One-time setup (runs at load)
  const state = { /* plugin state */ }

  return {
    event: async ({ event }) => {
      if (event.type === "session.idle") {
        // write trace record
      }
    },

    "chat.message": async (input, output) => {
      // input: { sessionID, agent?, model?, messageID?, variant? }
      // output: { message, parts }
      // Mutate parts in place.
      output.parts.unshift({ type: "text", text: "Pre-context." })
    },

    "tool.execute.before": async (input, output) => {
      // input: { tool, sessionID, callID }
      // output: { args }
      if (input.tool === "bash" && /rm -rf/.test(output.args.command)) {
        throw new Error("Blocked by plugin.")
      }
    },

    "experimental.session.compacting": async (input, output) => {
      output.context.push("- Task in progress: <id>\n- Files edited: <list>")
    },
  }
}
```

### 9.2 Custom tool registration

```js
import { tool } from "@opencode-ai/plugin"

export default async () => ({
  tool: {
    memoryRecall: tool({
      description: "Recall relevant memory entries",
      args: { query: tool.schema.string() },
      async execute({ query }, ctx) {
        return await fetchMemory(query)
      },
    }),
  },
})
```

### 9.3 Debug logging pattern (Trellis idiom)

```js
// .opencode/lib/trellis-context.js:15-25
const DEBUG_LOG = "/tmp/trellis-plugin-debug.log"
function debugLog(prefix, ...args) {
  appendFileSync(DEBUG_LOG, `[${new Date().toISOString()}] [${prefix}] ${args.join(" ")}\n`)
}
```

Plugins run under OpenCode's Effect-based runtime; stdout is swallowed in TUI mode, so file-based logging is the practical debug channel.

---

## 10. Caveats / Not Found

- **Exact per-version hook schemas** — the `packages/plugin/src/index.ts` file has evolved rapidly (1.1.65 added `tool.definition`, `command.execute.before`, `shell.env`; dev branch adds `provider`). A full version table would require a per-tag diff walk on the GitHub repo. Not done here.
- **`Permission` object shape** — referenced in `permission.ask` but schema not inlined; need to read `packages/plugin/src/index.ts` import of `Permission` from SDK types.
- **`Part` discriminated union complete members** — enumerated above from `message-v2.ts` but may differ across versions.
- **`Event` type definition** — full list of `.type` values and their `.properties` payloads: have enumerated names but full payload schemas were not read. Source: `packages/sdk/go/event.go` (Go SDK mirror, referenced in rstacruz gist).
- **Plugin unload / hot reload** — not covered in docs; OpenCode appears to load once at server startup with no user-visible reload API.
- **Permission / security model for plugins** — no sandboxing documented; plugins run in the same Bun process with full filesystem + network access.
- **`agent-trace` spec signatories** — user mentioned OpenCode signed on but I did not locate a public reference implementation or dedicated trace hook beyond the generic `event` firehose.

---

## 11. Key External References

Primary sources:

- **Official docs**: `https://dev.opencode.ai/docs/plugins`, `https://open-code.ai/en/docs/plugins`
- **Anomalyco mirror docs**: `https://anomalyco-opencode.mintlify.app/plugins`
- **Plugin types (dev branch)**: `https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/index.ts`
- **Plugin loader (dev branch)**: `https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/plugin/index.ts`
- **Storage module**: `https://github.com/sst/opencode/blob/4695e685/packages/opencode/src/storage/storage.ts`
- **Message/Part schema**: `https://github.com/sst/opencode/blob/9ad6588f/packages/opencode/src/session/message-v2.ts`

Community guides:

- **Complete plugin reference gist**: `https://gist.github.com/johnlindquist/0adf1032b4e84942f3e1050aba3c5e4a`
- **Plugin dev walkthrough gist**: `https://gist.github.com/rstacruz/946d02757525c9a0f49b25e316fbe715`
- **Hook tutorial (zh)**: `https://learnopencode.com/en/5-advanced/12c-hooks` — lists version additions
- **OpenCode School lesson**: `https://opencode.school/lessons/plugins`
- **DEV.to extensibility guide**: `https://dev.to/einarcesar/does-opencode-support-hooks-a-complete-guide-to-extensibility-k3p`

Issues relevant to Trellis adapter design:

- **#20387** — feature: `agent` output in hooks (matches Claude Code's agent-spawning hook)
- **#15933** — add messageID to tool.execute.before/after
- **#6142** — add sessionID to experimental.chat.system.transform
- **#17637** — include user message in system.transform input
- **#14492** — nondeterministic plugin load order
- **#15591** — only last plugin in config array loads (1.2.15 bug)
- **#16077** — persistent session memory
- **#16765** — track transcript across compactions
- **#22110** — session prune / storage cleanup

Transcript tooling:

- **`opencode-replay`**: `https://github.com/ramtinj95/opencode-replay` — static HTML generator from `~/.local/share/opencode/storage/`; useful reference for reading the JSON schema.

---

## 12. Files Found (Internal — Trellis repo)

| File Path | Description |
|---|---|
| `.opencode/plugins/session-start.js` | Session start + per-session context injection; uses `chat.message` + `event` (for `session.compacted`) |
| `.opencode/plugins/inject-workflow-state.js` | Per-turn breadcrumb; `chat.message` only |
| `.opencode/plugins/inject-subagent-context.js` | `tool.execute.before` on `task` tool; mutates `args.prompt` |
| `.opencode/lib/trellis-context.js` | Shared utilities (file reading, JSONL parsing, debugLog, contextCollector) |
| `packages/cli/src/templates/opencode/plugins/*.js` | Template copies (same code, distributed via Trellis CLI) |
| `packages/cli/src/migrations/manifests/0.5.0-beta.7.json` | Migration that shipped the 1.2.x factory-function fix |

Key commit:

- `5fbf961` — `fix(opencode): plugin factory-function shape for OpenCode 1.2.x compat` (Trellis). Message spells out the `for ([_, fn] of Object.entries(mod)) await fn(input)` iteration that mandates callable exports.
