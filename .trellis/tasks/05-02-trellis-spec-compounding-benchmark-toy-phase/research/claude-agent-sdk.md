# Research: Claude Agent SDK (TS + Python) for Trellis benchmark harness

- **Query**: Drive Haiku 4.5 (`claude-haiku-4-5-20251001`) and Opus 4.6 (`claude-opus-4-6`) through coding tasks autonomously, with strict tool control, MCP attachment, sandboxing, budget caps, and telemetry.
- **Scope**: external (official docs + npm tarball + PyPI source + GitHub READMEs)
- **Date**: 2026-05-02
- **Versions inspected**:
  - TypeScript: `@anthropic-ai/claude-agent-sdk@0.2.126` (npm latest, published "a day ago"), Node.js `>=18.0.0`, `main: sdk.mjs`, `types: sdk.d.ts`
  - Python: `claude-agent-sdk==0.1.72` (PyPI latest), Python `>=3.10`, status "3 - Alpha"

---

## Naming note (was "Claude Code SDK")

Both packages were renamed from the **Claude Code SDK** to the **Claude Agent SDK** on/around 2025-09-27. Migration is essentially a rename:

- TS: `@anthropic-ai/claude-code` → `@anthropic-ai/claude-agent-sdk`
- Python: `claude-code-sdk` → `claude-agent-sdk` (Python options class: `ClaudeCodeOptions` → `ClaudeAgentOptions`)
- Imports change but all top-level exports (`query`, `tool`, `createSdkMcpServer`) keep their names.
- Source: https://docs.claude.com/en/docs/claude-code/sdk/migration-guide

Both SDKs **bundle the Claude Code CLI binary** as part of the package; you do not need to install Claude Code separately. The SDK is essentially a typed wrapper that spawns the CLI as a subprocess and speaks a JSON control protocol over stdio (Python's `cli_path` / TS `pathToClaudeCodeExecutable` lets you swap the binary).

---

## 1. TS vs Python SDK — which is more mature for headless agent loops?

| Aspect | TypeScript | Python |
|---|---|---|
| Package | `@anthropic-ai/claude-agent-sdk` | `claude-agent-sdk` |
| Repo | https://github.com/anthropics/claude-agent-sdk-typescript | https://github.com/anthropics/claude-agent-sdk-python |
| Docs | https://docs.claude.com/en/api/agent-sdk/typescript | https://docs.claude.com/en/api/agent-sdk/python |
| Latest version (this query) | 0.2.126 | 0.1.72 |
| Release cadence | Daily-ish ("published a day ago" at v0.2.126 implies ~hundreds of releases) | Slower, still on 0.1.x |
| Status | Considered the reference implementation | Marked "3 - Alpha" on PyPI |
| Install | `npm install @anthropic-ai/claude-agent-sdk` | `pip install claude-agent-sdk` |
| Runtime requirement | Node 18+ (Bun/Deno also detected via `executable` option) | Python 3.10+ |
| Source-of-truth types | `sdk.d.ts` (5500+ lines, hand-curated, includes JSDoc) | `src/claude_agent_sdk/types.py` (1900 lines, dataclasses + TypedDict) |
| API surface | `query()` (async generator), `Query` (controllable handle with `interrupt()`, `setPermissionMode()`, `setMcpServers()`, `rewindFiles()`), `tool()`, `createSdkMcpServer()` | `query()` (async iterator), `ClaudeSDKClient` (interactive context manager, supports custom tools + hooks), `tool()`, `create_sdk_mcp_server()` |

**Recommendation for a headless coding-agent benchmark:** TypeScript SDK is more mature — newer features land there first, version count is far higher, type definitions are richer, and the `Query` handle exposes more programmatic controls (`setPermissionMode`, `setMcpServers`, `rewindFiles`, `interrupt`). Python SDK is functionally equivalent for the basics we need (model + allowed tools + MCP + cwd + max_turns + result message), is still actively maintained (v0.1.72), and is friendlier if the rest of the harness is Python-native. Both share the same wire protocol via the bundled CLI, so capabilities are aligned even where the API names differ.

---

## 2. Tool allow / deny — exact option names and semantics

Important nuance: there are **two separate option families** that look similar:

1. **`tools`** (TS) / `tools` (Python) — selects the *base set of available built-in tools* the CLI exposes to the model at all. Pass `[]` to disable every built-in.
2. **`allowedTools`** (TS) / `allowed_tools` (Python) — a **permission allowlist** of tools that auto-approve without prompting. Listed tools auto-execute; *unlisted* tools fall through to `permissionMode` and the `canUseTool` callback.
3. **`disallowedTools`** (TS) / `disallowed_tools` (Python) — hard deny: those tools are removed from the model's context and cannot be called even if otherwise allowed.

From `sdk.d.ts` (TS):

```typescript
allowedTools?: string[];
disallowedTools?: string[];
tools?: string[] | { type: 'preset'; preset: 'claude_code' };
permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk' | 'auto';
canUseTool?: CanUseTool;  // async callback returning { behavior: 'allow' | 'deny', ... }
```

From `claude_agent_sdk/types.py` (Python `ClaudeAgentOptions`):

```python
tools: list[str] | ToolsPreset | None = None
allowed_tools: list[str] = field(default_factory=list)
disallowed_tools: list[str] = field(default_factory=list)
permission_mode: PermissionMode | None = None  # same literals as TS
can_use_tool: CanUseTool | None = None
```

**`PermissionMode` literal values** (TS line 1807; Python line 24):

| Mode | Behavior |
|---|---|
| `default` | Standard prompts for dangerous ops |
| `acceptEdits` | Auto-accept file edits |
| `bypassPermissions` | Bypass everything (TS requires `allowDangerouslySkipPermissions: true`) |
| `plan` | Plan mode, no tool execution |
| `dontAsk` | **Deny by default if not pre-approved** — this is the strict mode we want for benchmarks |
| `auto` | Use a model classifier to decide |

**Permission evaluation order** (per Python README and SDK docs): `disallowed_tools` deny → `allowed_tools` auto-approve → `permission_mode` decides → `can_use_tool` callback gets last word.

### Minimal "spawn coding agent with ONLY Read/Edit/Bash/Glob/Grep + 2 MCP servers" snippet

**TypeScript:**

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const msg of query({
  prompt: "Solve the task in /workspace following AGENTS.md.",
  options: {
    model: "claude-haiku-4-5-20251001",       // or "claude-opus-4-6"
    cwd: "/tmp/run-001",                       // sandbox dir
    // Strict toolset: only these built-ins are even visible to the model.
    tools: ["Read", "Edit", "Bash", "Glob", "Grep"],
    // Auto-approve every tool we want it to use (incl. MCP tools by full name).
    allowedTools: [
      "Read", "Edit", "Bash", "Glob", "Grep",
      "mcp__abcoder",      // wildcard-style: pre-approves any tool from server "abcoder"
      "mcp__gitnexus",
    ],
    // Hard-deny anything else that might sneak in via skills/agents.
    disallowedTools: ["Write", "WebFetch", "WebSearch", "Task"],
    permissionMode: "dontAsk",                 // never prompt; deny if not in allowedTools
    mcpServers: {
      abcoder:  { type: "stdio", command: "abcoder",  args: ["--mcp"] },
      gitnexus: { type: "stdio", command: "gitnexus", args: ["mcp"] },
    },
    maxTurns: 40,
    maxBudgetUsd: 1.50,
    settingSources: [],                         // SDK-isolation mode: ignore ~/.claude/, .claude/
  },
})) {
  if (msg.type === "result") console.log(msg);
}
```

**Python (equivalent):**

```python
import anyio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    options = ClaudeAgentOptions(
        model="claude-haiku-4-5-20251001",
        cwd="/tmp/run-001",
        tools=["Read", "Edit", "Bash", "Glob", "Grep"],
        allowed_tools=[
            "Read", "Edit", "Bash", "Glob", "Grep",
            "mcp__abcoder", "mcp__gitnexus",
        ],
        disallowed_tools=["Write", "WebFetch", "WebSearch", "Task"],
        permission_mode="dontAsk",
        mcp_servers={
            "abcoder":  {"type": "stdio", "command": "abcoder",  "args": ["--mcp"]},
            "gitnexus": {"type": "stdio", "command": "gitnexus", "args": ["mcp"]},
        },
        max_turns=40,
        max_budget_usd=1.50,
        setting_sources=[],   # ignore filesystem settings
    )
    async for msg in query(prompt="Solve the task...", options=options):
        print(msg)

anyio.run(main)
```

**MCP tool naming convention** (from Python README example): MCP-served tools have names of the form `mcp__<server_name>__<tool_name>`. So pre-approving everything from the `abcoder` server means listing each individual tool, or the server-prefix `mcp__abcoder__*` (the README pre-approves `mcp__tools__greet` as a concrete example, line 125 of Python README). The "pre-approve everything from a server" pattern is documented but check exact wildcard syntax against the live CLI version — older CLI versions required listing each tool by full name.

### Caveats

- `allowedTools` only **silences the prompt**; it does not by itself restrict what tools exist. To really lock the model down to 5 tools, **set `tools` (the base set), not just `allowedTools`** (the auto-approve list). The Python README spells this out: *"`allowed_tools` is a permission allowlist: listed tools are auto-approved... It does not remove tools from Claude's toolset. To block specific tools, use `disallowed_tools`."*
- Use `setting_sources=[]` (Python) / `settingSources: []` (TS) to put the SDK in **isolation mode** — otherwise it will load `~/.claude/settings.json`, project `.claude/settings.json`, and `CLAUDE.md` files which can silently widen permissions or change the system prompt across benchmark arms.
- For truly headless runs, prefer `permissionMode: "dontAsk"` over `bypassPermissions`. `dontAsk` denies by default — perfect for benchmarks because if the model tries to call something we didn't whitelist, the tool call fails fast and shows up in `permission_denials` on the result message instead of silently executing.

---

## 3. MCP server attachment — programmatic, no config file needed

MCP servers are attached **programmatically via the `mcpServers` option** (TS `Record<string, McpServerConfig>`; Python `dict[str, McpServerConfig]`). No filesystem MCP config file is required — the SDK forwards the dict to the bundled CLI directly. Python also accepts a string/Path pointing at an MCP config JSON file (`mcp_servers: dict[str, McpServerConfig] | str | Path`).

**Four transport types** (from `sdk.d.ts` lines 934–1058 and `types.py` lines 549–584):

```typescript
// Stdio (subprocess) — the most common for local tools like ABCoder/GitNexus
type McpStdioServerConfig = {
  type?: 'stdio';            // optional, default
  command: string;
  args?: string[];
  env?: Record<string, string>;
  alwaysLoad?: boolean;       // bypass tool-search lazy loading
};

// Streamable HTTP
type McpHttpServerConfig = {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
  alwaysLoad?: boolean;
};

// SSE (legacy, still supported)
type McpSSEServerConfig = {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
};

// In-process SDK MCP server (no subprocess; tools defined as TS/Python functions)
type McpSdkServerConfigWithInstance = {
  type: 'sdk';
  name: string;
  instance: McpServer;        // from @modelcontextprotocol/sdk
};
```

**Attaching ABCoder + GitNexus** (assumed they run as stdio MCP servers — verify their actual transports):

```typescript
mcpServers: {
  abcoder:  { type: "stdio", command: "abcoder",  args: ["--mcp"], env: { LOG_LEVEL: "warn" } },
  gitnexus: { type: "stdio", command: "gitnexus", args: ["mcp"]   },
}
```

If either is exposed over HTTP instead, swap to `{ type: "http", url: "...", headers: {...} }`.

**Server-name-to-tool-name mapping**: tools from server `abcoder` named `query_ast` become `mcp__abcoder__query_ast` in `allowedTools` / `disallowedTools` lists.

**Runtime control**: The TS `Query` handle additionally exposes `setMcpServers(servers)` (line 2201) for hot-swap, and `mcp_reconnect`/`mcp_toggle` control requests (Python `SDKControlMcpReconnectRequest`, `SDKControlMcpToggleRequest`). For the benchmark we don't need these — declarative mounting at spawn time is cleanest.

**Status inspection**: `Query.getMcpStatus()` (TS) / `client.get_mcp_status()` (Python) returns connection status per server (`connected | failed | needs-auth | pending | disabled`) plus the tool list — useful at the top of each attempt to fail-fast if an MCP server didn't come up.

---

## 4. Working-directory control / sandboxing

Two complementary knobs:

### a. `cwd` — the agent's primary working directory

- TS: `options.cwd?: string` (line 1203)
- Python: `ClaudeAgentOptions(cwd: str | Path | None)` (line 1568)

Defaults to `process.cwd()` / Python `os.getcwd()`. **This is what you want per attempt** — point it at a fresh per-attempt scratch directory and the agent's Read/Edit/Bash all operate there.

### b. `additionalDirectories` (TS) / `add_dirs` (Python) — extra readable directories

- TS: `options.additionalDirectories?: string[]` (line 1148)
- Python: `ClaudeAgentOptions(add_dirs: list[str | Path])` (line 1585)
- Equivalent of the Claude Code CLI's `--add-dir` flag. Paths must be absolute.

Use this if the benchmark needs the agent to *read* (e.g.) the spec dir or a frozen reference repo without being able to *write* to it (combined with `disallowedTools: ["Edit", "Write"]` or path-scoped permission rules).

### c. Bash command sandbox (separate concept from `cwd`)

For network/filesystem isolation of `Bash` commands (macOS sandbox-exec / Linux bubblewrap), there's a `sandbox` option (TS line 1589, Python line 1682). Filesystem and network restrictions are configured **via permission rules** (`Read`/`Edit`/`WebFetch` allow/deny rules), not directly in `sandbox`. The `sandbox` block controls things like `enabled`, `excludedCommands`, `allowLocalBinding`. For our benchmark this is overkill if we already use disposable cwd dirs — just make sure each attempt runs in its own throwaway path and keep `WebFetch`/`WebSearch` in `disallowedTools`.

### Recommended pattern for benchmark isolation

```typescript
// Per attempt, create a fresh dir, copy the starter repo into it, run there.
const attemptDir = `/tmp/bench/${arm}/${seed}/${attempt}`;
await fs.cp(starterRepo, attemptDir, { recursive: true });

await query({
  prompt,
  options: {
    cwd: attemptDir,
    additionalDirectories: [specDir],  // read-only reference, optional
    settingSources: [],                 // CRITICAL: ignore host ~/.claude
    // disallowedTools forbid network + Write outside cwd:
    disallowedTools: ["WebFetch", "WebSearch"],
    // ... other options
  },
});
```

The `settingSources: []` ("SDK isolation mode") is essential — without it the SDK loads the host's `~/.claude/settings.json` and `CLAUDE.md`, which would leak the developer's permissions and personality across benchmark arms.

---

## 5. Turn budget / stop conditions

Three independent caps, all on the same options object:

| Knob | TS | Python | Stop signal |
|---|---|---|---|
| Conversation turns | `maxTurns?: number` | `max_turns: int \| None` | Result message with `subtype: 'error_max_turns'` |
| USD spend | `maxBudgetUsd?: number` | `max_budget_usd: float \| None` | Result message with `subtype: 'error_max_budget_usd'` |
| Token budget (model-aware) | `taskBudget?: { total: number }` | `task_budget: TaskBudget \| None` | Model is told its remaining budget so it paces itself; sent as `output_config.task_budget` with beta header `task-budgets-2026-03-13` |
| Wall-clock timeout | not a built-in option | not a built-in option | Use `AbortController` (TS `options.abortController`) or `asyncio.wait_for` around the iterator |
| Hard interrupt | `Query.interrupt()` | `client.interrupt()` | Cancels the in-flight turn |

For our 240-attempt benchmark, the cleanest "fair budget across arms" recipe is:

```typescript
options: {
  maxTurns: 40,                         // kill long loops
  maxBudgetUsd: 1.50,                   // kill expensive runs
  taskBudget: { total: 100_000 },       // give the model token-pacing awareness
  abortController: AbortSignal.timeout(20 * 60 * 1000),  // 20-min wall clock
}
```

The `result` message at the end carries `subtype` ∈ `{ "success", "error_during_execution", "error_max_turns", "error_max_budget_usd", "error_max_structured_output_retries" }` (line 3121) so each attempt's terminal state is machine-readable.

---

## 6. Cost / usage telemetry

The `result` message (always emitted last) carries everything we need. From `sdk.d.ts` lines 3119–3162 and `types.py` lines 1077–1095:

```typescript
type SDKResultSuccess = {
  type: 'result';
  subtype: 'success';
  duration_ms: number;            // total wall-clock for this query
  duration_api_ms: number;        // time spent in API calls
  num_turns: number;              // turn count consumed
  total_cost_usd: number;         // pre-computed cost
  usage: NonNullableUsage;        // aggregate token counts
  modelUsage: Record<string, ModelUsage>;  // per-model breakdown
  permission_denials: SDKPermissionDenial[];
  result: string;                 // final assistant text
  // ...
};

type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
  costUSD: number;
  contextWindow: number;
  maxOutputTokens: number;
};
```

That gives us, per attempt: total wall-clock, API time, turn count, USD spent (overall + per model), input/output tokens including cache hits, plus the count of denied permission requests (great signal that the model tried to use a forbidden tool).

**Tool-call count** is *not* directly aggregated on the result message — you compute it by counting `ToolUseBlock`s in the assistant message stream (or counting `tool_use_id`s seen). The Python types include `TaskUsage` with `total_tokens`, `tool_uses`, `duration_ms` (line 994) which is emitted on `task_progress`/`task_notification` system messages, but those are for sub-agents.

For our benchmark recorder, accumulate as you iterate:

```python
tool_calls = 0
async for msg in query(prompt=..., options=...):
    if isinstance(msg, AssistantMessage):
        for block in msg.content:
            if isinstance(block, ToolUseBlock):
                tool_calls += 1
                # log block.name, block.input
    elif isinstance(msg, ResultMessage):
        record = {
            "duration_ms": msg.duration_ms,
            "duration_api_ms": msg.duration_api_ms,
            "num_turns": msg.num_turns,
            "total_cost_usd": msg.total_cost_usd,
            "usage": msg.usage,
            "model_usage": msg.model_usage,
            "permission_denials": msg.permission_denials,
            "tool_calls": tool_calls,
            "stop_reason": msg.stop_reason,
            "subtype": msg.subtype,
        }
```

There's also a `RateLimitEvent` (Python `RateLimitInfo`/`RateLimitEvent`, TS `SDKRateLimitEvent`) emitted whenever the rate-limit status changes — log this so back-pressure events are visible in the benchmark trace.

---

## 7. Scriptability for batch (240 attempts non-interactively)

### How

`query()` is a one-shot async generator that yields messages and completes when the agent emits its `result` message. Each call spawns a fresh subprocess. So 240 attempts is just 240 sequential or bounded-parallel calls. The Python README example (lines 21–31) is exactly the headless skeleton.

```python
import anyio
from claude_agent_sdk import query, ClaudeAgentOptions, AssistantMessage, ToolUseBlock, ResultMessage

async def run_attempt(arm, seed, prompt) -> dict:
    options = ClaudeAgentOptions(
        model=arm["model"],
        cwd=make_attempt_dir(arm, seed),
        tools=arm["tools"],
        allowed_tools=arm["allowed_tools"],
        disallowed_tools=arm["disallowed_tools"],
        permission_mode="dontAsk",
        mcp_servers=arm["mcp_servers"],
        max_turns=arm["max_turns"],
        max_budget_usd=arm["max_budget_usd"],
        setting_sources=[],
    )
    record = {"tool_calls": 0, "messages": []}
    async for msg in query(prompt=prompt, options=options):
        if isinstance(msg, AssistantMessage):
            for b in msg.content:
                if isinstance(b, ToolUseBlock):
                    record["tool_calls"] += 1
        elif isinstance(msg, ResultMessage):
            record.update(asdict(msg))
    return record

async def main():
    # Bounded concurrency so we don't melt the rate limit:
    sem = anyio.Semaphore(4)
    async def bounded(arm, seed, prompt):
        async with sem:
            return await run_attempt(arm, seed, prompt)
    # Fan out 240 attempts under the semaphore...
```

### Caveats

- **Rate limits**: The SDK exposes rate-limit status via `RateLimitEvent` messages (TS `SDKRateLimitEvent`, Python `RateLimitEvent`). Listen for `status: "allowed_warning"` and back off; on `status: "rejected"` pause until `resets_at`. Limit windows are `five_hour | seven_day | seven_day_opus | seven_day_sonnet | overage`. For a 240-attempt run with Opus + Haiku mixed, schedule Opus arms across the `seven_day_opus` window.
- **Session state**: Each `query()` call creates a fresh session by default. To prevent any cross-contamination across attempts, set `persistSession: false` (TS) — sessions then aren't written to `~/.claude/projects/` and can't be resumed. Important for benchmark hygiene. The TS option is documented at sdk.d.ts line 1328; Python equivalent is reached via `extra_args={"no-persist-session": None}` since it isn't exposed as a typed field on `ClaudeAgentOptions` in 0.1.72.
- **Concurrency**: Each `query()` spawns its own CLI subprocess. RAM/CPU is the practical ceiling. 4–8 in parallel is typical for a workstation; tune via the rate-limit events.
- **CLI version drift**: The CLI is bundled in the SDK package, so version-pin the SDK in your benchmark harness (e.g. `claude-agent-sdk==0.1.72`) to keep the CLI version stable across the 240 attempts. The Python build supports `python scripts/build_wheel.py --cli-version 2.0.0` if you need a specific bundled CLI.
- **Auth**: API key via `ANTHROPIC_API_KEY` env var (or `CLAUDE_CODE_OAUTH_TOKEN`); pass through `options.env` if you want each attempt isolated from your shell.
- **Stderr / debug**: Wire `options.stderr` (callback, both SDKs) to a per-attempt log file. The `debug: true` flag (TS) gives verbose logging when something goes sideways.

---

## Model IDs (verified)

From https://docs.anthropic.com/en/docs/about-claude/models/whats-new-claude-4-5:

| Model | Claude API ID | Alias |
|---|---|---|
| Opus 4.7 | `claude-opus-4-7` | `claude-opus-4-7` |
| Opus 4.6 | `claude-opus-4-6` | `claude-opus-4-6` (still listed in `BetaManagedAgentsModel`) |
| Sonnet 4.6 | `claude-sonnet-4-6` | `claude-sonnet-4-6` |
| Haiku 4.5 | `claude-haiku-4-5-20251001` | `claude-haiku-4-5` |

Both forms are accepted by `options.model`. Pinned dated IDs are recommended for benchmark reproducibility.

---

## Recommended choice for our benchmark + why

**Go with the TypeScript SDK.** Reasons:

1. **Maturity**: 0.2.126 vs 0.1.72-alpha. TS is the lead implementation; new features (e.g. `taskBudget`, `setMcpServers`, `rewindFiles`) appear there first. Python tracks behind.
2. **Richer programmatic control**: The `Query` handle exposes `interrupt()`, `setPermissionMode()`, `setMcpServers()`, `getMcpStatus()`, `rewindFiles()` — useful if a benchmark arm needs hot-swap of toolchains or fault-injection mid-run. Python's `ClaudeSDKClient` covers most of this but with fewer edges polished.
3. **Type definitions**: 5500-line `sdk.d.ts` with extensive JSDoc is a much better contract for writing a long-lived harness than the Python dataclasses (which are still good, just less documented inline).
4. **Concurrency**: Node's event loop + `Promise.all` with a `p-limit`-style semaphore composes nicely with 240 attempts; Python's `anyio` works too but requires more care around subprocess fan-out.
5. **Both speak the same wire protocol** to the bundled CLI, so capability gap is small. **If the rest of our harness is already Python**, use Python — capability difference for our 7 needs is negligible. The TS edge matters most for ambitious harness features (rewind, hot-swap MCP, custom `spawnClaudeCodeProcess` for VM execution).

**Pinned harness skeleton:**

- `@anthropic-ai/claude-agent-sdk@0.2.126` (Node 18+)
- One `query()` call per attempt
- `cwd` = per-attempt scratch dir
- `tools` = strict whitelist (5 builtins for our case)
- `allowedTools` = same whitelist + `mcp__<server>__*` per attached MCP
- `disallowedTools` = `["WebFetch", "WebSearch", "Task"]` and anything else off-spec
- `permissionMode: "dontAsk"`
- `settingSources: []` (isolation)
- `mcpServers`: `{ abcoder: {...stdio...}, gitnexus: {...stdio...} }`
- `maxTurns: 40`, `maxBudgetUsd: 1.50`, `taskBudget: { total: 100_000 }`, `abortController: AbortSignal.timeout(...)`
- `model`: `"claude-haiku-4-5-20251001"` or `"claude-opus-4-6"` (pinned dated IDs)
- Iterate messages → on `result` message, record `usage`, `modelUsage`, `total_cost_usd`, `num_turns`, `duration_ms`, `permission_denials`, plus a running tool-call counter

---

## Caveats / Not Found

- **MCP wildcard pre-approval syntax** (e.g. `mcp__abcoder__*`) is widely cited in community examples but I did not find a normative line in the SDK type defs. The safe fallback is to enumerate each MCP tool name explicitly in `allowedTools` after a first run prints what `getMcpStatus()` returns. The Python README example uses an exact name (`mcp__tools__greet`).
- **`persistSession` on Python**: not present as a typed field on `ClaudeAgentOptions` v0.1.72; achievable via `extra_args` passthrough to the CLI flag. Verify against the CLI's `--help`.
- I did not test ABCoder/GitNexus actual MCP transport — assumed stdio. Confirm by running each tool with `--help` or its `mcp` subcommand.
- The `options.tools` "base set" semantics is explicit in the JSDoc (TS line 1211) but the Python README emphasizes only `allowed_tools` / `disallowed_tools`. Both fields work in both SDKs (`tools` is in `ClaudeAgentOptions` at types.py line 1463) — if you want the model to literally not see a tool exists, set `tools` to the strict list, not just `allowedTools`.
- `claude-opus-4-6` is still listed in current model enums (e.g. `BetaManagedAgentsModel`) but Anthropic's "what's new" page now leads with Opus 4.7 (`claude-opus-4-7`). Check whether the benchmark really wants 4.6 or should track to 4.7.

## External References

- TS SDK reference: https://docs.claude.com/en/api/agent-sdk/typescript
- Python SDK reference: https://docs.claude.com/en/api/agent-sdk/python
- Overview: https://docs.claude.com/en/api/agent-sdk/overview
- Migration guide: https://docs.claude.com/en/docs/claude-code/sdk/migration-guide
- TS GitHub: https://github.com/anthropics/claude-agent-sdk-typescript
- Python GitHub: https://github.com/anthropics/claude-agent-sdk-python
- npm: https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk (v0.2.126)
- PyPI: https://pypi.org/project/claude-agent-sdk/ (v0.1.72)
- Claude 4.5 model IDs: https://docs.anthropic.com/en/docs/about-claude/models/whats-new-claude-4-5
- Haiku 4.5 launch: https://www.anthropic.com/news/claude-haiku-4-5 (Oct 15, 2025)
