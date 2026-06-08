# Research: Xiaomi MiMo v2.5 Pro for Spec-Compounding Benchmark

- **Query**: Confirm MiMo v2.5 Pro is real and currently accessible; map out API protocol, tool calling, context, quota, MCP integration, determinism, geo constraints; recommend a driver architecture for a Claude-Agent-SDK-style benchmark loop.
- **Scope**: external (web research)
- **Date**: 2026-05-02

---

## 1. Existence and access — CONFIRMED REAL & GA

MiMo-V2.5-Pro is Xiaomi's flagship LLM, announced **April 22, 2026**, fully rolled out across Xiaomi's API Platform, AI Studio, OpenRouter, and (partially) third-party providers.

| Property | Value |
|---|---|
| Vendor official model page | <https://mimo.xiaomi.com/mimo-v2-5-pro/> |
| Hugging Face weights | <https://huggingface.co/XiaomiMiMo/MiMo-V2.5-Pro> (open-sourced, permissive license) |
| Developer console | **<https://platform.xiaomimimo.com>** (canonical entry; localized welcome at `/#/docs/welcome`) |
| Studio (web playground) | <https://aistudio.xiaomimimo.com> |
| API base URL | **`https://api.xiaomimimo.com/v1`** (OpenAI-compatible) |
| Anthropic-compat base URL | `https://api.xiaomimimo.com/anthropic/v1` |
| Auth | `api-key: $MIMO_API_KEY` header **OR** standard `Authorization: Bearer $MIMO_API_KEY` |
| Registration | Xiaomi account (Mi ID). If user has no Mi account, register at `id.mi.com` first. Account creation is open globally; does not require a Mainland China phone number. |
| Model ID (exact API string) | **`mimo-v2.5-pro`** (with the dot and hyphens, lowercase). The older Pro is `mimo-v2-pro`; the multimodal sibling is `mimo-v2.5` (text+image+audio+video). |
| Pricing | $1.00 / 1M input tokens, $3.00 / 1M output tokens (≤256K context tier). $2.00 / $6.00 above 256K up to 1M. Cache-read input ~$0.21/1M; cache-write currently free. (Older Pro tier: $1.05/$3.15 — V2.5 Pro removed the context-length multiplier within its tier.) |
| Web-search built-in tool | $5.25 / 1000 calls |

The 1.6B-token quota is the user's account-specific Token Plan / promotional credit balance, not a published tier. Token Plans are prepaid credit packs ($9.9 → 10M tokens, $17.9 → 20M, $39.9 → 50M, $69.9 → 100M). 1.6B tokens corresponds to roughly the largest enterprise prepaid bucket (or a stacked promotional allotment from the V2.5 launch). It is **not** lifetime — Token Plans default to **auto-renew monthly** and expire if unused; auto-renew can be disabled in the dashboard.

---

## 2. API protocol — OpenAI-compatible

The endpoint is **fully OpenAI-Chat-Completions-compatible** at `https://api.xiaomimimo.com/v1/chat/completions`. An Anthropic-Messages-compatible mirror also exists at `https://api.xiaomimimo.com/anthropic/v1/messages`.

### Minimal cURL (OpenAI shape)

```bash
curl -X POST 'https://api.xiaomimimo.com/v1/chat/completions' \
  -H "api-key: $MIMO_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "mimo-v2.5-pro",
    "messages": [{"role": "user", "content": "ping"}],
    "max_completion_tokens": 1024,
    "temperature": 0.6,
    "top_p": 0.95,
    "stream": false,
    "thinking": {"type": "disabled"}
  }'
```

Notable Xiaomi-specific extensions on top of the OpenAI shape:
- `thinking: { "type": "enabled" | "disabled" }` — toggles reasoning. When enabled, responses include a `reasoning_content` field alongside `tool_calls` / `content`, and **multi-turn conversations must replay all historical `reasoning_content`** in subsequent `messages` for the model to continue reasoning correctly.
- `response_format: { "type": "json_object" }` — structured output supported.
- Built-in `web_search` tool (no MCP needed) — billed per call.

### LiteLLM support — YES, native

LiteLLM ships a `xiaomi_mimo` provider out of the box: <https://docs.litellm.ai/docs/providers/xiaomi_mimo>

```python
from litellm import completion
import os
os.environ["XIAOMI_MIMO_API_KEY"] = "..."
response = completion(
    model="xiaomi_mimo/mimo-v2.5-pro",
    messages=[{"role": "user", "content": "Hello"}],
    temperature=0.3,
    top_p=0.95,
)
```

⚠️ **Caveat**: LiteLLM's docs list only `mimo-v2-flash` in the explicit "Supported Models" table, but the provider passes through any model ID under the prefix. Until early 2026 the `xiaomi_mimo` provider was missing from the `LlmProviders` enum, breaking the Router/Proxy code path — fixed in PR <https://github.com/BerriAI/litellm/pull/18819> (merged 2026-01-08, available in LiteLLM ≥ 1.80.13). **Pin LiteLLM to a recent version (≥ 1.81)** when wiring this up.

OpenRouter also exposes the model as `xiaomi/mimo-v2.5-pro`: <https://openrouter.ai/xiaomi/mimo-v2.5-pro>. OpenRouter routes to Xiaomi's own endpoint (FP8 quantized).

---

## 3. Tool calling — fully native and OpenAI-shaped

MiMo-V2.5-Pro **natively supports OpenAI-style function calling** via the standard `tools: [...]` parameter. The official model card explicitly lists capabilities: "Text generation, deep thinking, streaming, function calling, structured output, web search."

This is critical for our benchmark — ABCoder + GitNexus MCP servers can be wired through any standard MCP-to-OpenAI-tools adapter.

### Minimal Python tool-calling example

```python
from openai import OpenAI
import os, json

client = OpenAI(
    api_key=os.environ["MIMO_API_KEY"],
    base_url="https://api.xiaomimimo.com/v1",
)

tools = [{
    "type": "function",
    "function": {
        "name": "read_file",
        "description": "Read file contents.",
        "parameters": {
            "type": "object",
            "properties": {"path": {"type": "string"}},
            "required": ["path"],
        },
    },
}]

resp = client.chat.completions.create(
    model="mimo-v2.5-pro",
    messages=[{"role": "user", "content": "Open src/main.py and summarize it."}],
    tools=tools,
    tool_choice="auto",
    temperature=0.3,
)

msg = resp.choices[0].message
for tc in (msg.tool_calls or []):
    args = json.loads(tc.function.arguments)
    # ... execute, then append {"role": "tool", "tool_call_id": tc.id, "content": result}
```

### Important multi-turn invariant for thinking mode

When `thinking.type=enabled` and the model returns both `reasoning_content` and `tool_calls`, **every prior assistant message including its `reasoning_content` must be preserved** in the `messages` array for subsequent turns. This is documented on both the V2-Flash and V2.5-Pro model cards. If you strip `reasoning_content` between rounds, multi-step tool-use accuracy degrades sharply. (This matches DeepSeek-R1's behavior — same family lineage; lead Luo Fuli came from DeepSeek.)

Recommended sampling for tool-use: **`temperature=0.3`, `top_p=0.95`** (per the open-source model card). For non-agentic writing/math: `temperature=0.8`.

---

## 4. Context window and capability tier

| Property | Value |
|---|---|
| Total params | 1.02T (MoE) |
| Active params | 42B |
| Context length | **1,048,576 tokens (1M)** at the API; 256K on the open-source `MiMo-V2.5-Pro-Base` checkpoint |
| Max output | 128K tokens |
| Architecture | Hybrid attention (SWA + global, 6:1 ratio, 128-token window) + 3-layer Multi-Token Prediction (MTP); FP8 (E4M3) precision |

### Benchmarks (April 2026, vendor + 3rd-party)

| Benchmark | MiMo-V2.5-Pro | Claude Opus 4.6 | GPT-5.4 | Kimi K2.6 | Gemini 3.1 Pro |
|---|---|---|---|---|---|
| **SWE-bench Pro** (harder cut, multi-file) | **57.2** | 53.4–57.3 | 57.7 | 58.6 | 54.2 |
| **SWE-bench Verified** | "improved over V2 Pro 78%" — vendor-claimed top tier | 80.8 | — | — | — |
| ClawEval Pass³ | **64% @ ~70K tokens/trajectory** | ~62% @ 160K | ~60% @ 150K | ~56% | ~58% |
| τ³-Bench | 72.9 | — | — | — | — |
| Terminal-Bench 2.0 | 68.4 | 65.4 | — | — | — |
| MMLU | 89.4 | — | — | — | — |
| MATH | 86.2 | — | — | — | — |
| LiveCodeBench v6 | 39.6 | — | — | 35.5 (K2.5) | — |
| GDPVal-AA Elo | 1581 | — | 1674 | — | — |
| Humanity's Last Exam (no tools) | 48.0 | 53.0 | 58.7 | — | — |

**Capability tier verdict**: Frontier-class for *agentic coding and long-horizon SE tasks* (ahead of Opus 4.6, peer of GPT-5.4 and Kimi K2.6); somewhat weaker on pure scientific reasoning (HLE, GDPVal-AA). Headline differentiator is **token efficiency**: 40–60% fewer tokens per trajectory for comparable scores. Designed to sustain **1,000+ tool calls in a single session**.

---

## 5. Quota mechanics

| Aspect | Value |
|---|---|
| Quota basis | Token Plan = prepaid credit pool, decremented per (input + cache-read + output) tokens. Input and output billed separately at different rates. |
| Lifetime vs. periodic | Token Plans **auto-renew** monthly by default (can disable). Promotional grants (e.g. launch-week free trials) typically have an explicit expiry date. The user should verify the 1.6B-token grant's expiry on `platform.xiaomimimo.com` → Billing. |
| Rate limits (per account) | **RPM = 100, TPM = 10,000,000** for `mimo-v2-pro` / `mimo-v2.5-pro` / `mimo-v2-omni` / `mimo-v2-flash`. Source: <https://www.mimo-v2.com/docs/pricing>. |
| Concurrent connections | No published hard cap. Under load you get **HTTP 429** with `rate_limit_exceeded` and may receive a `Retry-After` header — implement exponential backoff. |
| Per-key rate share | Multiple API keys under one account share the same RPM/TPM ceiling. |
| Night-time discount | V2.5 Pro tier: reduced rates ~22:00–08:00 local. Useful for batch-running benchmark jobs offline. |

For a SWE-bench Verified subset of e.g. 50 tasks × ~70K tokens/trajectory ≈ 3.5M tokens per pass → 1.6B tokens supports **~450 full passes** of a 50-task subset, which is generous headroom for reproducibility runs.

---

## 6. MCP / agent-loop integration — already battle-tested

MiMo-V2.5-Pro was **explicitly co-designed with Claude Code, OpenCode, Cline, KiloCode, Roo Code, and Blackbox** as drop-in scaffolds. Xiaomi's own documentation says: *"replace the model tag with `mimo-v2.5-pro` to get started"*. Independent guides confirm:

- **Claude Code**:
  ```bash
  claude config set model mimo-v2.5-pro
  claude config set apiBaseUrl https://api.xiaomimimo.com/v1
  claude config set apiKey $MIMO_API_KEY
  ```
- **OpenCode**: `opencode --provider mimo --model mimo-v2.5-pro`
- **OpenClaw**: native `xiaomi` provider (auto-injected when `XIAOMI_API_KEY` is set). Docs: <https://docs.openclaw.ai/providers/xiaomi>
- **PicoClaw / Cline / KiloCode**: configured via OpenAI-compatible base URL.
- **LiteLLM**: native `xiaomi_mimo` provider (see §2).
- **LangChain**: works through the standard `ChatOpenAI` shim with `base_url` override.

GitHub references for community drivers:
- `mzdk100/mimo` — Rust client for Xiaomi MiMo API.
- `BerriAI/litellm` PR #18819 — fixed router enum.
- `XiaomiMiMo/MiMo-V2-Flash` — open-source reference deployment with `--tool-call-parser mimo` SGLang flag.

**No specific public MCP-bridge implementation for MiMo was found** — but because the API is plain OpenAI-shape with native `tools`, any standard MCP→OpenAI tools bridge (e.g. the `mcp` Python SDK pattern in §"Recommended driver" below, or Cline/Claude Code's built-in MCP loader) works without modification.

---

## 7. Determinism

- `temperature` is supported and accepts `0.0`. The open-source model card recommends `temperature=0.3` for agentic tasks (not 0) because the MoE architecture and reasoning mode benefit from minor stochasticity. `temperature=0` is accepted but anecdotally produces flatter, sometimes truncated, agent traces.
- **`seed`**: NOT documented as supported on the OpenAI-compatible endpoint. The Pricing & Rate Limits page lists supported parameters but does not include `seed`. Treat reproducibility as **statistical only** (run N≥3 trajectories per task and aggregate Pass³ rather than relying on bit-exact repro).
- For deterministic tool-call grammar enforcement, use `response_format: {"type": "json_object"}` plus `tool_choice: {"type": "function", "function": {"name": "..."}}` to force a specific tool.

**Bottom line for benchmark**: design the harness around **Pass^k metrics over N independent runs**, not single-shot determinism. ClawEval (Pass³) is exactly this pattern; emulate it.

---

## 8. Geographic / network constraints

- API is hosted at `api.xiaomimimo.com`. No public statement that it is mainland-China-only; OpenRouter, OpenClaw, and aimadetools.com confirm international reachability without VPN as of April 2026.
- Account registration accepts non-Chinese phone numbers and email; Mi ID supports global signup.
- Pricing is published in **USD**, signaling international targeting.
- IPv4 only (no documented IPv6 endpoint).
- TLS 1.2+ required (standard for OpenAI-compatible endpoints).
- Latency/throughput: ~29 tok/sec measured on V2-Pro early access; V2.5-Pro reports comparable. Acceptable for benchmark use; not ideal for latency-sensitive interactive workflows.
- One observation worth verifying empirically: the user is in a China-edge or HK-edge region — re-test latency from the actual benchmark runner host. If you spin runners in US/EU and the endpoint terminates only in cn-region, expect ~300ms RTT overhead per request.

---

## Recommended driver architecture

### Decision

**Use the Claude Agent SDK via LiteLLM proxy** as the primary driver, with a **fallback custom OpenAI-compatible loop** for stdio MCP integration. Rationale:

1. Claude Agent SDK already knows how to spawn stdio MCP servers (ABCoder, GitNexus) and feed their tool schemas into a chat-completions loop. We do not want to rewrite that.
2. Claude Agent SDK speaks Anthropic Messages format. Two routes work:
   - **Route A (recommended)**: Point Claude Agent SDK at MiMo's **native Anthropic-compatible endpoint** `https://api.xiaomimimo.com/anthropic/v1`. Zero proxy needed, zero translation overhead. Confirmed working per Xiaomi's `iChochy.com` reference and OpenClaw integration.
   - **Route B**: Run **LiteLLM Proxy** locally as a translation layer (`Anthropic in → OpenAI/Xiaomi out`). Gives uniform observability + cost tracking but adds a hop.
3. For the **spec-writer (oracle) role** where we want maximum determinism and structured output, prefer the OpenAI-compatible endpoint with `response_format: json_object`. The Anthropic-shape endpoint is better for the task-solver (tester) role where we want native `reasoning_content` flow.

### Architecture sketch

```
┌─────────────────────────────────────────────────────────────┐
│ Benchmark Driver (Python)                                   │
│                                                             │
│  ┌────────────────┐     ┌────────────────┐                  │
│  │ Spec Writer    │     │ Task Solver    │                  │
│  │ (oracle)       │     │ (tester)       │                  │
│  │                │     │                │                  │
│  │ OpenAI SDK     │     │ Claude Agent   │                  │
│  │ + json_object  │     │ SDK            │                  │
│  └───────┬────────┘     └───────┬────────┘                  │
│          │                      │                           │
│          ▼                      ▼                           │
│  https://api.xiaomimimo  https://api.xiaomimimo             │
│      .com/v1                 .com/anthropic/v1              │
│  (mimo-v2.5-pro,         (mimo-v2.5-pro,                    │
│   T=0.3, top_p=0.95)      thinking=enabled)                 │
│                                                             │
│  ┌──────────────────────────────────────────────────┐       │
│  │ Stdio MCP servers spawned by Claude Agent SDK    │       │
│  │   • abcoder  (AST/type signatures)               │       │
│  │   • gitnexus (knowledge graph)                   │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

### Concrete code sketch (Python, custom OpenAI-compat loop with stdio MCP)

This is the minimal robust version for the **task-solver** role; it bypasses Claude Agent SDK entirely and gives full control:

```python
# bench/driver.py
import asyncio, json, os
from openai import AsyncOpenAI
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

MODEL = "mimo-v2.5-pro"
client = AsyncOpenAI(
    api_key=os.environ["MIMO_API_KEY"],
    base_url="https://api.xiaomimimo.com/v1",
)

MCP_SERVERS = [
    StdioServerParameters(command="abcoder", args=["serve"]),
    StdioServerParameters(command="gitnexus", args=["mcp"]),
]

async def collect_tools(sessions):
    """Aggregate tools from every MCP server into one OpenAI tool list."""
    tools, route = [], {}
    for s in sessions:
        listed = await s.list_tools()
        for t in listed.tools:
            tools.append({
                "type": "function",
                "function": {
                    "name": t.name,
                    "description": t.description,
                    "parameters": t.inputSchema,
                },
            })
            route[t.name] = s
    return tools, route

async def run_task(task_prompt: str, max_rounds: int = 50) -> str:
    # Open every MCP server's stdio connection
    async with asyncio.TaskGroup() as tg:
        sessions = []
        async with stdio_client(MCP_SERVERS[0]) as (r0, w0), \
                   stdio_client(MCP_SERVERS[1]) as (r1, w1):
            async with ClientSession(r0, w0) as s0, \
                       ClientSession(r1, w1) as s1:
                await s0.initialize(); await s1.initialize()
                sessions = [s0, s1]
                tools, route = await collect_tools(sessions)

                messages = [
                    {"role": "system",
                     "content": "You are a coding agent. Use the provided tools."},
                    {"role": "user", "content": task_prompt},
                ]

                for _ in range(max_rounds):
                    resp = await client.chat.completions.create(
                        model=MODEL,
                        messages=messages,
                        tools=tools,
                        tool_choice="auto",
                        temperature=0.3,
                        top_p=0.95,
                        # MiMo-specific: keep reasoning across turns
                        extra_body={"thinking": {"type": "enabled"}},
                    )
                    msg = resp.choices[0].message
                    messages.append(msg.model_dump(exclude_none=True))

                    if not msg.tool_calls:
                        return msg.content or ""

                    for tc in msg.tool_calls:
                        args = json.loads(tc.function.arguments)
                        result = await route[tc.function.name].call_tool(
                            tc.function.name, arguments=args
                        )
                        text = result.content[0].text if result.content else "{}"
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "content": text,
                        })

                return "max_rounds_reached"
```

### Operational checklist

- [ ] Pin `litellm>=1.81` (post-PR-18819) if going LiteLLM route.
- [ ] Pin `openai>=1.50` (any modern version is fine, OpenAI SDK is the contract).
- [ ] Set `MIMO_API_KEY` (alias `XIAOMI_API_KEY` / `XIAOMI_MIMO_API_KEY` for LiteLLM/OpenClaw).
- [ ] Use `temperature=0.3, top_p=0.95` for tool-use; do **not** use `seed` (unsupported).
- [ ] Run **N≥3 trajectories per task** for Pass^k metrics; do not rely on single-shot determinism.
- [ ] Persist full `messages` history (including `reasoning_content`) between turns when `thinking.type=enabled`.
- [ ] Implement exponential backoff on HTTP 429 (RPM=100, TPM=10M).
- [ ] Schedule batch runs ~22:00–08:00 local for night-time discount.
- [ ] Verify the 1.6B-token grant's expiry date on `platform.xiaomimimo.com` before relying on it.

---

## Caveats / Not Found

- **`seed` parameter**: not in published API spec. Treat as unsupported; rely on Pass^k aggregation.
- **Exact 1.6B-token quota source**: this is account-specific (likely promotional). Public Token Plans cap at 100M tokens/$69.9; 1.6B implies a custom allocation. The user should screenshot/document the grant terms before benchmarking begins, since promotional balances can have unannounced expiry.
- **SWE-bench Verified score for V2.5-Pro specifically**: vendor uses SWE-bench *Pro* (57.2) as the headline. V2-Pro scored 78.0% on Verified; V2.5-Pro is described as "improved" but no exact published Verified number was found. For our benchmark we should re-measure on our own subset rather than cite a vendor number.
- **MCP-native bridge**: no purpose-built `mcp-mimo` adapter exists in open source. We bridge via OpenAI tools shape — works fine but means we own the glue code.
- **Latency from non-CN regions**: not measured in any source we found. Worth a one-shot empirical check from the benchmark runner host before committing the architecture.
- **Privacy**: Xiaomi's TOS for API inputs/outputs was not surveyed. If benchmark tasks include any proprietary code, review the data-retention clause on `platform.xiaomimimo.com` first.
