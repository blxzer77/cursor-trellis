# Research: OpenTelemetry Semantic Conventions for Model Context Protocol (MCP)

- **Query**: Concrete schema of OTel MCP semconv — spans, attributes, events, maturity, adoption
- **Scope**: External (OTel repos, MCP SDK repos, vendor instrumentation)
- **Date**: 2026-04-22

---

## TL;DR Verdict

**MCP semconv exists, is merged, and is officially documented — but status is `Development`, not Stable.** First landed in PR [open-telemetry/semantic-conventions#2083](https://github.com/open-telemetry/semantic-conventions/pull/2083) on 2025-04-10 (author: @lmolkova, Microsoft), and has been iterated since. Current spec lives at [`docs/gen-ai/mcp.md`](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/mcp.md) and [`model/mcp/*.yaml`](https://github.com/open-telemetry/semantic-conventions/tree/main/model/mcp) on main.

Key facts:
- Defines **2 spans** (client / server), **4 metrics** (client+server × operation+session), **4 MCP-namespaced attributes** (+ reused GenAI, jsonrpc, network.* attrs), and a `params._meta` W3C trace-context propagation scheme.
- **NOT events-based** — body capture uses span attributes (`gen_ai.tool.call.arguments`, `gen_ai.tool.call.result`) at `Opt-In` level; there are **no dedicated MCP OTel events**.
- **Opt-in required via `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`** (same gate as the broader GenAI semconv family).
- **Covers all transports** via `network.transport` (pipe/tcp/quic) + `network.protocol.name` (http/websocket) — stdio, Streamable HTTP, HTTP+SSE, websockets, and gRPC are all explicitly mapped.
- **Ecosystem adoption (as of 2026-04-22)**:
  - **Official Python SDK** — basic OTel tracing **merged** on 2026-03-31 (PR [#2381](https://github.com/modelcontextprotocol/python-sdk/pull/2381), commit `37891f4`). `opentelemetry-api` is now a mandatory dep; no-op tracer by default.
  - **Official C# SDK** — tracing via `ActivitySource("Experimental.ModelContextProtocol")`, follows semconv. Referenced by SDK authors as the template.
  - **Official TypeScript SDK** — no built-in OTel yet; instrumentation is external (Shinzo, Traceloop, Harithsa packages).
  - **Sentry** — implements a "close to semconv" variant (`mcp.server` op, `mcp.method.name`, `mcp.tool.name`, `mcp.request.id`).
- Propagation mechanism (`traceparent` in JSON-RPC `params._meta`) is explicitly flagged as **likely to change** pending MCP spec decision in [modelcontextprotocol#246](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/246) / [#414](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/414).

**Practical implication for Trellis Trace plugin:** the MCP semconv gives us a stable naming convention (`tools/call {tool_name}`, `mcp.method.name`, `mcp.session.id`) that we can safely adopt today even though the OTel label says "Development" — the schema has shipped and major SDKs are implementing it. The main risk area is trace-context propagation format, not attribute/span names.

---

## Spans

### Overview

The spec defines **two spans**, both tied to the same common attribute set (`trace.mcp.common.attributes` → `mcp.common.attributes`). They are intentionally symmetric — the distinction is *who created the span*, not *who initiated the MCP request* (which can go either direction: server → client for `sampling/createMessage`, `elicitation/create`, `roots/list`).

| Span ID | Kind | Who reports it | Source |
|---|---|---|---|
| `span.mcp.client` | `CLIENT` | MCP client when it sends a request/notification, **or** MCP server when it initiates a server→client request | `model/mcp/spans.yaml` L18-56 |
| `span.mcp.server` | `SERVER` | MCP server when it processes an incoming request, **or** MCP client when it processes a server-initiated request | `model/mcp/spans.yaml` L58-84 |

### Span naming

```
{mcp.method.name} {target}
```

Where `{target}` SHOULD be `{gen_ai.tool.name}` for `tools/call`, `{gen_ai.prompt.name}` for `prompts/get`, etc. If no low-cardinality target is available, the span name SHOULD fall back to just `{mcp.method.name}` (e.g. `"initialize"`, `"resources/list"`).

`{mcp.resource.uri}` as target is **opt-in** (high-cardinality risk).

### Span status

- `ERROR` when `error.type` attribute is present.
- Status description SHOULD mirror `JSONRPCError.message` when available.
- On a successful JSON-RPC response that contains an embedded error (`CallToolResult.isError = true`), `error.type` SHOULD be set to the literal string `"tool_error"`.

### Relationship with GenAI `execute_tool` span

This is the most important interaction detail and directly answers the research question:

> "MCP tool call execution spans are compatible with GenAI `execute_tool` spans. If the MCP instrumentation can reliably detect that outer GenAI instrumentation is already tracing the tool execution, it SHOULD NOT create a separate span. Instead, it SHOULD add MCP-specific attributes to the existing tool execution span."
> — [`docs/gen-ai/mcp.md`](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/mcp.md#client) (autogenerated from `model/mcp/spans.yaml` L28-36)

So the canonical trace tree for a Claude → MCP tool call looks like:

```
invoke_agent weather-forecast-agent       (INTERNAL)
├── chat {model}                          (CLIENT)   # GenAI model call
├── tools/call get-weather                (CLIENT)   # MCP client span
│   └── tools/call get-weather            (SERVER)   # MCP server span (parent via _meta traceparent)
└── chat {model}                          (CLIENT)   # GenAI model reply
```

When GenAI instrumentation already emits an `execute_tool` span, the MCP client span is **merged into it** rather than duplicated — but the spec gives no detection protocol; implementations must provide an opt-in flag.

---

## Attribute Table

Sourced from [`model/mcp/registry.yaml`](https://github.com/open-telemetry/semantic-conventions/blob/main/model/mcp/registry.yaml), [`model/mcp/common.yaml`](https://github.com/open-telemetry/semantic-conventions/blob/main/model/mcp/common.yaml), and [`model/mcp/spans.yaml`](https://github.com/open-telemetry/semantic-conventions/blob/main/model/mcp/spans.yaml).

### MCP-namespaced attributes (`mcp.*`)

| Attribute | Type | Stability | Requirement | Description |
|---|---|---|---|---|
| `mcp.method.name` | string (enum) | Development | **Required** on both spans | JSON-RPC method name. Enum of 24 well-known values (see below). |
| `mcp.session.id` | string | Development | Recommended (when session-scoped) | MCP session identifier. Example: `191c4850af6c49e08843a3f6c80e5046` |
| `mcp.resource.uri` | string | Development | Conditionally Required (for `resources/read`, `resources/subscribe`, `resources/unsubscribe`, `notifications/resources/updated`) | URI of the resource. Example: `postgres://database/customers/schema` |
| `mcp.protocol.version` | string | Development | Recommended | MCP spec version. Example: `2025-06-18` |

### Reused GenAI attributes (`gen_ai.*`)

| Attribute | Type | Stability | Requirement on MCP span | Notes |
|---|---|---|---|---|
| `gen_ai.operation.name` | string | Development | Recommended — SHOULD be `"execute_tool"` when method is `tools/call`, omitted otherwise | Bridges to GenAI semconv |
| `gen_ai.tool.name` | string | Development | Conditionally Required (when tool-related) | e.g. `"get-weather"` |
| `gen_ai.prompt.name` | string | Development | Conditionally Required (when prompt-related) | e.g. `"analyze-code"` |
| `gen_ai.tool.call.arguments` | any (object, JSON-serializable) | Development | **Opt-In** | Warning: may contain sensitive data |
| `gen_ai.tool.call.result` | any (object, JSON-serializable) | Development | **Opt-In** | Warning: may contain sensitive data |

### Reused JSON-RPC & network attributes

| Attribute | Type | Stability | Requirement | Notes |
|---|---|---|---|---|
| `jsonrpc.request.id` | string | Development | Conditionally Required (when request has an id; NOT for notifications) | Captures `id` as string even when original is numeric. Omit when `id` is `null`/missing. |
| `jsonrpc.protocol.version` | string | Development | Recommended when ≠ `"2.0"` | |
| `rpc.response.status_code` | string | Release Candidate | Conditionally Required (when response carries an error code) | e.g. `-32602` |
| `error.type` | string | Stable | Conditionally Required (on failure) | JSON-RPC error code as string, or `"tool_error"` for `CallToolResult.isError=true` |
| `network.transport` | string | Stable | Recommended | `pipe` (stdio), `tcp`/`quic` (HTTP), etc. |
| `network.protocol.name` | string | Stable | Recommended when applicable | `http`, `websocket` |
| `network.protocol.version` | string | Stable | Recommended when applicable | `1.1`, `2` |
| `server.address` / `server.port` | string/int | Stable | Recommended (client span only) | |
| `client.address` / `client.port` | string/int | Stable | Recommended (server span only) | |

### `mcp.method.name` enum values (24 total)

Lifecycle / session: `initialize`, `notifications/initialized`, `notifications/cancelled`, `notifications/progress`, `ping`, `notifications/message`, `logging/setLevel`

Resources: `resources/list`, `resources/templates/list`, `resources/read`, `resources/subscribe`, `resources/unsubscribe`, `notifications/resources/list_changed`, `notifications/resources/updated`

Prompts: `prompts/list`, `prompts/get`, `notifications/prompts/list_changed`

Tools: `tools/list`, `tools/call`, `notifications/tools/list_changed`

Sampling / completion / elicitation / roots: `sampling/createMessage`, `completion/complete`, `elicitation/create`, `roots/list`, `notifications/roots/list_changed`

All at `Development` stability. Custom values are allowed if not in the enum.

---

## Events

**None.** The MCP semconv does not define any OTel events (as of 2026-04-22).

Input/output bodies are recorded as **span attributes** (`gen_ai.tool.call.arguments`, `gen_ai.tool.call.result`), both at `Opt-In` requirement level, both flagged with sensitive-data warnings. The broader GenAI semconv has a separate event `gen_ai.client.inference.operation.details` for capturing LLM prompts/responses, but MCP does NOT piggyback on that — it uses direct attribute capture.

---

## Metrics

Four histogram metrics, all at `Development` stability, defined in [`model/mcp/metrics.yaml`](https://github.com/open-telemetry/semantic-conventions/blob/main/model/mcp/metrics.yaml):

| Metric | Unit | Scope | Attributes |
|---|---|---|---|
| `mcp.client.operation.duration` | s | Per-request, client-side | common attrs + `server.address`, `server.port` |
| `mcp.server.operation.duration` | s | Per-request, server-side | common attrs |
| `mcp.client.session.duration` | s | Per-session, client-side | session attrs (protocol version, transport) + `server.address` |
| `mcp.server.session.duration` | s | Per-session, server-side | session attrs |

---

## Maturity & Opt-In Requirements

- **Document status**: `Development` (lowest maturity tier after "planned"; higher than stable-track: Development → Release Candidate → Stable).
- **Opt-in flag**: Inherits from GenAI semconv umbrella:
  ```
  OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental
  ```
  Instrumentations supporting this flag SHOULD default to v1.36.0 legacy schema and only emit the latest MCP conventions when the flag is set.
  Source: [`docs/gen-ai/README.md`](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/README.md) § "Transition Plan"
- **When will it be stable?** No ETA. The README says the transition plan "will be updated to include stable version before the GenAI conventions are marked as stable."
- **What's blocking stability?**
  1. Context propagation format (`params._meta.traceparent`) is provisional — depends on MCP spec PR [#414](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/414).
  2. Ambiguity between `mcp.tool.name` vs `gen_ai.tool.name` (flagged in original PR review; resolved by adopting `gen_ai.tool.name`, but still "Development").
  3. Broader GenAI semconv itself not stable.

---

## Interaction with GenAI Semconv

### Operation-level overlap

| Scenario | MCP span emitted? | GenAI span emitted? |
|---|---|---|
| Standalone MCP call (no GenAI framework) | Yes (`tools/call ...`) | No |
| GenAI framework manages tool invocation, but doesn't emit `execute_tool` span for MCP tools | Yes | Framework emits `chat`, `invoke_agent` but NOT `execute_tool` |
| GenAI framework emits `execute_tool` and wraps MCP call | **No** — MCP instrumentation SHOULD merge its attributes into the existing `execute_tool` span | Yes (`execute_tool {tool_name}`) enriched with `mcp.*` attrs |

The last row is the "opinionated" behavior. It's opt-in via configuration flag, and the spec doesn't define how to detect "outer GenAI instrumentation is already tracing" — this is left to implementations.

### Attribute bridge

`gen_ai.operation.name = "execute_tool"` + `mcp.method.name = "tools/call"` lets a trace consumer treat both kinds of spans uniformly. Example canonical `tools/call` span attributes:

```yaml
span_name: "tools/call get-weather"
span_kind: CLIENT
mcp.method.name: "tools/call"
gen_ai.operation.name: "execute_tool"
gen_ai.tool.name: "get-weather"
gen_ai.tool.call.arguments: {location: "SF", date: "..."}   # opt-in
gen_ai.tool.call.result: {temperature: ...}                 # opt-in
jsonrpc.request.id: "3"
mcp.session.id: "8267461134f24305af708e66b8eda71a"
mcp.protocol.version: "2025-06-18"
network.transport: "pipe"
```

---

## Transport Coverage

Defined in [`docs/gen-ai/mcp.md`](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/mcp.md#recording-mcp-transport) § "Recording MCP transport":

| MCP transport | `network.transport` | `network.protocol.name` | `network.protocol.version` | `mcp.protocol.version` | Notes |
|---|---|---|---|---|---|
| **stdio** | `pipe` | — | — | any | |
| **Streamable HTTP** | `tcp` (or `quic`) | `http` | `2` | `2025-06-18` or newer | `mcp.protocol.version` distinguishes from SSE |
| **HTTP + SSE (legacy)** | `tcp` | `http` | `1.1` or `2` | `2024-11-05` or older | |
| **Custom: websockets** | `tcp` | `websocket` | — | any | |
| **Custom: gRPC** | `tcp` | `http` | `2` | any | Also see gRPC semconv |

Applications MAY also enable underlying HTTP/gRPC instrumentation alongside MCP for transport-level detail (HTTP status codes, retries, etc.).

**Both server-side and client-side spans are covered** — the spec is symmetric. Server→client requests (sampling, elicitation, roots/list) are explicitly accommodated: the MCP client emits the `CLIENT`-kind span when it originates, regardless of which TCP endpoint it sits on.

---

## Context Propagation

From [`docs/gen-ai/mcp.md`](https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/mcp.md#context-propagation):

> Instrumentations SHOULD propagate trace context inside MCP request `params._meta` property bag.

Example:

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "get-weather",
    "_meta": {
      "traceparent": "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
      "tracestate": "rojo=00f067aa0ba902b7"
    }
  },
  "id": 1
}
```

**Caveat flagged in spec:**
> The propagation format defined here is likely to change. Please check out context propagation discussions in MCP repository: modelcontextprotocol#246 and modelcontextprotocol#414.

Server-side behavior: SHOULD use `_meta` context as parent, SHOULD link the ambient transport context (e.g. parent HTTP span) — not make it the parent. This handles the "one HTTP request serves multiple MCP messages" case.

---

## Ecosystem Adoption

### Official MCP SDKs

| SDK | Status | Reference |
|---|---|---|
| **Python** | **Merged 2026-03-31** (PR [#2381](https://github.com/modelcontextprotocol/python-sdk/pull/2381), commit `37891f4`). Adds `opentelemetry-api` as mandatory dep, no-op tracer by default. Emits `MCP send {method} {tool}` CLIENT spans and server-side SERVER spans. W3C `_meta` propagation per SEP-414. Attributes: `mcp.method.name`, `jsonrpc.request.id`. Setup: any OTel SDK (Logfire, Jaeger, OTLP). | [`src/mcp/shared/_otel.py`](https://github.com/modelcontextprotocol/python-sdk/blob/main/src/mcp/shared/_otel.py) |
| **TypeScript** | **No built-in OTel** as of 2026-04. External packages fill the gap. | — |
| **C#** | Built-in via `ActivitySource("Experimental.ModelContextProtocol")`. Referenced as prior art in Python PR #2093 (propagation). | [`src/ModelContextProtocol.Core/Diagnostics.cs`](https://github.com/modelcontextprotocol/csharp-sdk/blob/v0.8.0-preview.1/src/ModelContextProtocol.Core/Diagnostics.cs#L64) |
| **Java** | Community discussion (modelcontextprotocol/java-sdk discussion [#321](https://github.com/orgs/modelcontextprotocol/discussions/321)); status unclear. | — |

### Third-party instrumentation packages (Node.js / TS)

| Package | Style | Notes |
|---|---|---|
| [`@shinzolabs/instrumentation-mcp`](https://www.npmjs.com/package/@shinzolabs/instrumentation-mcp) | Server-wrapping (`instrumentServer(server, config)`) | Follows semconv naming; PII sanitization; data processors. Published 2025-07. |
| [`@theharithsa/opentelemetry-instrumentation-mcp`](https://registry.npmjs.org/@theharithsa/opentelemetry-instrumentation-mcp) | Auto-instrumentation (InstrumentationBase) | Spans named `mcp.tool:{toolName}` — NOT semconv-compliant (`mcp.tool:` prefix doesn't match `tools/call {name}` format). Parent-child stitching helper. Published 2025-08. |
| [`@traceloop/instrumentation-mcp`](https://registry.npmjs.org/@traceloop/instrumentation-mcp) | Auto-instrumentation | Depends on `@opentelemetry/semantic-conventions@^1.38.0` which includes MCP conventions. Published 2025-11. |

### Vendor implementations (non-standard but close)

| Vendor | Notes |
|---|---|
| **Sentry** | [`develop.sentry.dev/sdk/expected-features/mcp-instrumentation/tracing`](https://develop.sentry.dev/sdk/expected-features/mcp-instrumentation/tracing) — "follows the draft OpenTelemetry MCP Semantic Conventions as closely as possible, with some opinionated additions". Uses `mcp.server` / `mcp.client` as `op`, `mcp.method.name`, `mcp.tool.name`, `mcp.request.id`, `mcp.transport`. |
| **Dynatrace** (via Harithsa instrumentation) | Packaged as an OTLP-compatible exporter target. |

### Key PRs / commits to cite

- 2025-04-01: [semantic-conventions#2045](https://github.com/open-telemetry/semantic-conventions/pull/2045) — original proposal (samsp-msft, Microsoft). Debated whether to namespace as `mcp.*` or generalize to `gen_ai.integration.*`; chose `mcp.*`.
- 2025-04-10: [semantic-conventions#2083](https://github.com/open-telemetry/semantic-conventions/pull/2083) **merged** — the actual landing PR (lmolkova, Microsoft).
- 2026-02-18: [python-sdk#2093](https://github.com/modelcontextprotocol/python-sdk/pull/2093) — Python SDK `_meta` inject (aabmass, Google).
- 2026-03-31: [python-sdk#2381](https://github.com/modelcontextprotocol/python-sdk/pull/2381) **merged** — full client+server OTel tracing (Kludex, Pydantic/Logfire).
- 2025-11-28: [python-sdk#1693](https://github.com/modelcontextprotocol/python-sdk/pull/1693) — alternative token-based pluggable instrumentation interface (closed/superseded).

---

## Open Questions / Gaps

1. **Context propagation format is provisional.** `params._meta.traceparent` could change before stable. Two active specs: [modelcontextprotocol#246](https://github.com/modelcontextprotocol/modelcontextprotocol/issues/246), [#414](https://github.com/modelcontextprotocol/modelcontextprotocol/pull/414).
2. **No detection protocol** for "outer GenAI instrumentation already traced this tool call" — implementations must expose a config flag; interop between frameworks is undefined.
3. **No events defined.** If you want full prompt/response capture with separate sampling, you must roll your own or wait for a future event schema.
4. **TypeScript SDK has no official OTel yet** — every current TS instrumentation (Shinzo, Traceloop, Harithsa) is third-party and uses slightly different attribute sets.
5. **Sampling/elicitation tracing semantics:** server→client requests emit a `CLIENT`-kind MCP span on the *server* process and `SERVER`-kind on the *client* process. This may confuse consumers that assume kind == process role. Spec acknowledges this but doesn't give a disambiguation attribute.
6. **Metric attribute cardinality risk:** `mcp.session.id` is Recommended at span level but excluded from metric attribute groups — correctly low-cardinality at metric level. `gen_ai.tool.name` is common attr on operation metrics, which can explode cardinality for dynamic tool names.
7. **`OTEL_SEMCONV_STABILITY_OPT_IN` mechanics for MCP specifically** are not called out separately from GenAI — instrumentations might default to NOT emitting MCP spans without the flag, which affects zero-config UX.

---

## Reference Links

**Authoritative spec (semantic-conventions repo, main branch):**
- Human-readable doc: https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/mcp.md
- Rendered version: https://opentelemetry.io/docs/specs/semconv/gen-ai/mcp/
- Attribute registry: https://opentelemetry.io/docs/specs/semconv/registry/attributes/mcp/
- Span YAML: https://github.com/open-telemetry/semantic-conventions/blob/main/model/mcp/spans.yaml
- Registry YAML: https://github.com/open-telemetry/semantic-conventions/blob/main/model/mcp/registry.yaml
- Common YAML: https://github.com/open-telemetry/semantic-conventions/blob/main/model/mcp/common.yaml
- Metrics YAML: https://github.com/open-telemetry/semantic-conventions/blob/main/model/mcp/metrics.yaml

**GenAI umbrella:**
- https://opentelemetry.io/docs/specs/semconv/gen-ai/
- https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/README.md
- https://github.com/open-telemetry/semantic-conventions/blob/main/docs/gen-ai/gen-ai-spans.md (covers `execute_tool`)

**Landing PRs:**
- https://github.com/open-telemetry/semantic-conventions/pull/2045 (proposal)
- https://github.com/open-telemetry/semantic-conventions/pull/2083 (merged)

**MCP SDK integration:**
- Python: https://github.com/modelcontextprotocol/python-sdk/pull/2381
- Python propagation precursor: https://github.com/modelcontextprotocol/python-sdk/pull/2093
- C# reference: https://github.com/modelcontextprotocol/csharp-sdk/blob/v0.8.0-preview.1/src/ModelContextProtocol.Core/Diagnostics.cs

**Third-party instrumentation:**
- https://www.npmjs.com/package/@shinzolabs/instrumentation-mcp
- https://registry.npmjs.org/@theharithsa/opentelemetry-instrumentation-mcp
- https://registry.npmjs.org/@traceloop/instrumentation-mcp
- https://develop.sentry.dev/sdk/expected-features/mcp-instrumentation/tracing

**MCP spec context propagation discussions:**
- https://github.com/modelcontextprotocol/modelcontextprotocol/issues/246
- https://github.com/modelcontextprotocol/modelcontextprotocol/pull/414

**Secondary analysis:**
- https://techbytes.app/posts/opentelemetry-genai-agent-semconv-cheat-sheet-2026/ (2026-04-17 cheat sheet covering v1.40.0 MCP+GenAI)
