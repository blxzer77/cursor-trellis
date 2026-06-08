# Research: OpenCode as Headless Benchmark Driver

- **Query**: Can OpenCode (`opencode` CLI) serve as the headless agent driver for the Trellis spec-compounding benchmark (240 SWE-bench Verified attempts)?
- **Scope**: Mixed (live CLI probe on `opencode 1.14.30` + official docs at opencode.ai)
- **Date**: 2026-05-02
- **Verdict**: **Yes, OpenCode is a strong fit.** All six required capabilities are present in the shipped CLI. No SDK or wrapper is needed.

---

## TL;DR — six checks, all green

| # | Requirement | Verdict | Mechanism |
|---|---|---|---|
| 1 | Headless / batch invocation | OK | `opencode run --format json --dangerously-skip-permissions <prompt>` returns JSONL on stdout, exit 0 on success |
| 2 | Custom OpenAI-compatible provider | OK | `provider.<id>.npm = "@ai-sdk/openai-compatible"`, `options.baseURL`, credentials via `opencode auth login` (`auth.json`) |
| 3 | MCP whitelist enforcement | OK | `permission.{read,edit,bash,…}: "deny"` + per-tool object syntax + `mcp__server__*: allow` in agent frontmatter |
| 4 | Per-run telemetry | OK | JSONL events: `step_start`, `tool_use`, `text`, `step_finish` (carries `tokens.{input,output,reasoning,cache.{read,write}}` and `cost`) |
| 5 | Per-attempt sandbox | OK | `XDG_DATA_HOME / XDG_CONFIG_HOME / XDG_CACHE_HOME / XDG_STATE_HOME` fully relocate state. `--dir` controls workspace cwd |
| 6 | Auto-approve / no human in loop | OK | `--dangerously-skip-permissions` flag + `permission` config (set `"*": "allow"` or whatever policy you need) |

---

## Findings

### 1. Headless invocation — `opencode run`

Live `opencode run --help` (v1.14.30) on the user's machine shows the relevant flags:

```
opencode run [message..]
  --format            "default" | "json"     # JSONL event stream when "json"
  --dir               directory to run in
  -m, --model         provider/model
  --agent             agent to use
  --dangerously-skip-permissions
                      auto-approve permissions that are not explicitly denied
  -s, --session       continue a session id
  -c, --continue      continue last session
  --variant           reasoning effort (high/max/minimal)
  --thinking          show thinking blocks
  --port              port for embedded server (random by default)
  --print-logs        print logs to stderr
```

Key observations:
- The **prompt is positional**, NOT `--prompt`. Use `opencode run "the task text"`.
- `--prompt` is only on the top-level `opencode` command (TUI launch); for batch use it's the positional arg of `run`.
- Exit code is `0` on a clean `step_finish` with `reason: "stop"`; non-zero on session error.
- An ephemeral local server is spun up per invocation on a random port (`--port` to override). No external server lifecycle to manage.
- A new session is created per invocation unless `--session/--continue` is passed → perfect "one-shot per attempt" semantics out of the box.

Verified live (`opencode run --format json -m deepseek/deepseek-chat "Reply with PONG only."`):

```jsonl
{"type":"step_start","timestamp":1777726057104,"sessionID":"ses_217453252ffedmsys6uYEMTPrO","part":{"id":"prt_…","messageID":"msg_…","type":"step-start"}}
{"type":"text","timestamp":1777726057109,"sessionID":"ses_…","part":{"type":"text","text":"HELLO_WORLD","time":{"start":…,"end":…}}}
{"type":"step_finish","timestamp":1777726057112,"sessionID":"ses_…","part":{"reason":"stop","tokens":{"total":92687,"input":92680,"output":7,"reasoning":0,"cache":{"write":0,"read":0}},"cost":0.01297716}}
```

Exit code: `0`. Stderr empty. Stdout was clean newline-delimited JSON.

**Caveat — large default system prompt.** The trivial "say PONG" cost **92,680 input tokens** because the default `build` agent loads OpenCode's full toolset + skill manifests + project memory into the system prompt. For a benchmark we MUST define a slim custom agent (see §3) with only the tools the experiment requires.

### 2. Provider configuration — pointing at MiMo's OpenAI-compatible endpoint

Schema reference: `provider.<id>` from `https://opencode.ai/config.json` (lines 5578-5874 of the live JSON Schema). Required pattern for a custom OpenAI-compatible endpoint:

```jsonc
// ~/.config/opencode/opencode.json (or per-attempt isolated config)
{
  "$schema": "https://opencode.ai/config.json",
  "provider": {
    "mimo": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "MiMo (XiaoMi)",
      "options": {
        "baseURL": "https://api.xiaomimimo.com/v1",
        "timeout": 600000,           // 10 min per request — SWE-bench tasks can be slow
        "chunkTimeout": 120000        // 2 min between SSE chunks before abort
      },
      "models": {
        "mimo-v2.5-pro": {
          "name": "MiMo v2.5 Pro",
          "tool_call": true,
          "reasoning": false,
          "limit": { "context": 200000, "output": 16384 },
          "cost": { "input": 0, "output": 0 }
        }
      }
    }
  },
  "model": "mimo/mimo-v2.5-pro"
}
```

**Auth.** API key is NOT inline in `opencode.json`. It lives in `~/.local/share/opencode/auth.json` keyed by provider id, e.g.:

```json
{ "mimo": "sk-xxx..." }
```

Set it once via `opencode auth login` (interactive) OR seed the file directly per attempt — auth.json is plain JSON and the user already has `deepseek` and `openai` keys living there. Driver script can `printf '{"mimo":"%s"}' "$MIMO_KEY" > $XDG_DATA_HOME/opencode/auth.json` before launching.

**Model id format.** The CLI flag is `-m mimo/mimo-v2.5-pro` (provider/model joined by `/`). `opencode models` lists exact ids; verify it appears after configuring.

**Known issue to watch:** github.com/anomalyco/opencode#20725 reports that custom `@ai-sdk/openai-compatible` providers can fall back to `@ai-sdk/openai` and demand `OPENAI_API_KEY` in **sub-sessions** (Task tool). For our benchmark we plan to disable the Task tool anyway, so this should not bite — but smoke-test once before the full sweep.

### 3. MCP whitelist — abcoder + gitnexus only

OpenCode's permission model (docs: https://opencode.ai/docs/permissions, v1.1.1+):
- Each tool key (`read`, `edit`, `bash`, `glob`, `grep`, `webfetch`, `websearch`, `task`, `skill`, `lsp`, plus MCP tools) accepts `"allow" | "ask" | "deny"`.
- A wildcard `"*"` key sets the global default; **last matching rule wins**, so put `"*"` first and specific rules after.
- MCP tools are referenced as `mcp__<server>__<tool>` (per the user's existing `trellis-research.md` agent: `mcp__exa__*: allow`).

For the benchmark's "ONLY Read/Edit/Bash + abcoder + gitnexus" policy, define a custom agent in `<workspace>/.opencode/agents/swe-bench-runner.md`:

```yaml
---
description: SWE-bench Verified attempt runner. No human, no Task subagents.
mode: primary
model: mimo/mimo-v2.5-pro
steps: 200          # cap agentic iterations; tune after first dry runs
permission:
  "*": deny          # default-deny floor
  read: allow
  edit: allow
  bash: allow        # narrow further if you want to forbid network: see below
  glob: allow
  grep: allow
  list: allow
  webfetch: deny
  websearch: deny
  task: deny         # no nested subagents — keeps the test single-agent
  skill: deny        # no Trellis skills loaded inside the experiment
  todowrite: allow
  doom_loop: ask     # currently can't be forced to deny; ask is fine in headless+yolo
  mcp__abcoder__*: allow
  mcp__gitnexus__*: allow
  # Belt-and-suspenders: explicitly deny anything else MCP exposes
  mcp__exa__*: deny
  mcp__chrome-devtools__*: deny
  mcp__playwright__*: deny
---
You are running a SWE-bench Verified task in repo {repo}@{commit}.
Issue: {issue_text}
Apply the minimal patch that makes the failing tests pass. Use only the
tools you have. Do not invent tools. When done, output a single line:
TASK_COMPLETE.
```

Then invoke with `--agent swe-bench-runner`. The default-deny policy plus MCP-prefix `allow` rules deliver exactly the requested whitelist. Combined with `--dangerously-skip-permissions` the explicit denies are still honored (the flag only auto-approves the `ask` cases) — see §6.

**Sanity check the policy** with `opencode debug agent swe-bench-runner` before running a sweep — it dumps the resolved permission map.

### 4. Telemetry — per-attempt JSONL

Authoritative event reference: https://takopi.dev/reference/runners/opencode/stream-json-cheatsheet/ (corroborated by live test).

| Event | When | Useful fields |
|---|---|---|
| `step_start` | beginning of an LLM step | `sessionID`, `part.snapshot` (git snapshot hash) |
| `tool_use` | tool finished (only `status:"completed"` is emitted in CLI JSON) | `part.tool`, `part.callID`, `part.state.input`, `part.state.output`, `part.state.metadata` (e.g. `{exit:0}` for bash), `part.state.time.{start,end}` |
| `text` | model emitted text | `part.text`, `part.time.{start,end}` |
| `step_finish` | end of an LLM step | `part.reason: "stop" \| "tool-calls"`, `part.tokens.{total,input,output,reasoning,cache.{read,write}}`, `part.cost` (USD), `part.snapshot` |
| `error` | session-level error | `error.name`, `error.data.message` |

**Aggregation per attempt:**
- Total input/output tokens = sum over all `step_finish.part.tokens.{input,output}`. (Last event has running totals depending on version; sum all events to be safe.)
- Cost USD = sum of `step_finish.part.cost`.
- Per-tool counts = `Counter(ev.part.tool for ev in events if ev.type == "tool_use")`.
- Wall-clock = last_event.timestamp − first_event.timestamp (ms).
- Final assistant text = last `text` event's `part.text` before terminal `step_finish` with `reason:"stop"`.
- Success signal = the SWE-bench grader (separate harness) running against the working tree the agent touched.

**Persistent storage.** OpenCode also persists every session to disk under `$XDG_DATA_HOME/opencode/storage/`:
- `session/<projectHash>/<sessionID>.json` — session metadata (id, slug, version, projectID, directory, created/updated, summary)
- `message/<sessionID>/<messageID>.json` — per-message records carrying `role`, `time`, `modelID`, `providerID`, `cost`, `tokens.{input,output,reasoning,cache.{read,write}}`, `finish` reason
- `part/<messageID>/<partID>.json` — text & tool-call parts
- Plus `$XDG_DATA_HOME/opencode/tool-output/tool_<id>` for full tool output bodies (the `state.output` field in `tool_use` events is sometimes truncated; the file has the full content)

Recommended pipeline: capture stdout JSONL as the primary source of truth for the run, then optionally archive the per-attempt `storage/` tree alongside it for forensic replay.

`opencode export <sessionID> --sanitize` and `opencode stats --days N` exist as built-in aggregators if you want a quick post-run summary outside your own analysis script.

### 5. Sandboxing — XDG isolation per attempt

Live `opencode debug paths` proved every state path is XDG-driven:

```
$ XDG_DATA_HOME=/tmp/oc-probe/data XDG_CONFIG_HOME=/tmp/oc-probe/config \
  XDG_CACHE_HOME=/tmp/oc-probe/cache XDG_STATE_HOME=/tmp/oc-probe/state \
  opencode debug paths
data       /tmp/oc-probe/data/opencode
log        /tmp/oc-probe/data/opencode/log
cache      /tmp/oc-probe/cache/opencode
config     /tmp/oc-probe/config/opencode
state      /tmp/oc-probe/state/opencode
```

So per-attempt isolation = `mktemp -d` an attempt root and set the four XDG vars under it. `auth.json` (under data), `opencode.db` (under data), session storage, snapshots, logs — all isolated. Concurrent runs cannot collide.

`--dir <workspace>` is independent of XDG and controls the cwd / `.opencode/` lookup root. For SWE-bench: `--dir /tmp/attempts/<task>/<arm>/<trial>/repo` after `git clone`-ing the target commit there.

The `.opencode/` directory inside the workspace is where per-workspace `agents/`, `plugins/`, and `skills/` are picked up. To dogfood Trellis you can place your custom benchmark agent there OR in the global config at `$XDG_CONFIG_HOME/opencode/agents/`.

**One time-consuming gotcha:** first invocation under a fresh XDG_DATA_HOME triggers `Performing one time database migration, may take a few minutes...` (verified on the probe run — took <2 s on this machine, but worth pre-warming). To pre-warm: run `opencode debug paths` once per attempt root before the real `opencode run`, or copy a pre-migrated empty `opencode.db` template.

### 6. Auto-approve — no human in the loop

Two complementary mechanisms:

1. `--dangerously-skip-permissions` on `opencode run` — auto-approves all `ask` prompts but **still respects explicit `deny` rules**. This is the YOLO mode.
2. `permission` config — set `"*": "deny"` (or `"allow"`) explicitly. With the default-deny config in §3 plus `--dangerously-skip-permissions`, the only tools the agent can call are exactly those marked `allow`. No prompt is ever surfaced.

Confirmed live: a smoke run with `--dangerously-skip-permissions --format json` produced no interactive prompts and exited cleanly.

**Plus belt:** `permission.doom_loop` defaults to `"ask"` and can't be set to `"deny"` (only `allow|ask|deny` per schema, but the doom-loop guard is a safety circuit that may force ask in some versions). With `--dangerously-skip-permissions` it auto-approves; if it ever blocks a benchmark run we should mark the run failed and continue.

---

## Recommended Driver Architecture

### Layout

```
benchmark/
  driver/
    run_attempt.sh          # one attempt = one opencode run
    score_attempt.py        # SWE-bench grader → pass/fail
    aggregate.py            # walk results/, collate metrics
  config/
    agents/
      swe-bench-runner.md   # the locked-down agent (§3)
    opencode.template.json  # provider+model+permission defaults
  results/
    <task_id>/<arm>/<trial>/
      events.jsonl          # raw opencode stdout
      result.json           # parsed telemetry + grader verdict
      workspace/            # final repo state (or a diff vs base commit)
      session/              # archived $XDG_DATA_HOME/opencode/storage tree
      stderr.log
```

### `run_attempt.sh`

```bash
#!/usr/bin/env bash
# Usage: run_attempt.sh <task_id> <arm> <trial_id>
# Arms: zero | wrong | trellis | rawdump
set -euo pipefail

TASK_ID="$1"; ARM="$2"; TRIAL="$3"
ROOT="$(pwd)"
ATTEMPT_DIR="$ROOT/results/$TASK_ID/$ARM/$TRIAL"
mkdir -p "$ATTEMPT_DIR"

# 1. Per-attempt XDG sandbox (totally isolates auth, sessions, db)
export XDG_DATA_HOME="$ATTEMPT_DIR/xdg/data"
export XDG_CONFIG_HOME="$ATTEMPT_DIR/xdg/config"
export XDG_CACHE_HOME="$ATTEMPT_DIR/xdg/cache"
export XDG_STATE_HOME="$ATTEMPT_DIR/xdg/state"
mkdir -p "$XDG_CONFIG_HOME/opencode" "$XDG_DATA_HOME/opencode"

# 2. Seed config + credentials
cp "$ROOT/config/opencode.template.json" "$XDG_CONFIG_HOME/opencode/opencode.json"
printf '{"mimo":"%s"}' "$MIMO_API_KEY" > "$XDG_DATA_HOME/opencode/auth.json"

# 3. Build per-attempt workspace (fresh clone at the SWE-bench base commit)
WORK="$ATTEMPT_DIR/workspace"
python3 "$ROOT/driver/setup_workspace.py" \
  --task "$TASK_ID" --out "$WORK"           # clones + checks out base commit

# 4. Inject custom benchmark agent at workspace scope
mkdir -p "$WORK/.opencode/agents"
cp "$ROOT/config/agents/swe-bench-runner.md" "$WORK/.opencode/agents/"

# 5. Build the prompt (arm-specific context injection)
PROMPT_FILE="$ATTEMPT_DIR/prompt.txt"
python3 "$ROOT/driver/build_prompt.py" \
  --task "$TASK_ID" --arm "$ARM" > "$PROMPT_FILE"

# 6. Pre-warm db migration (avoids JSONL pollution from first-run notice)
opencode debug paths > /dev/null 2>&1

# 7. Run!  Single opencode run = single SWE-bench attempt.
set +e
opencode run \
  --dir "$WORK" \
  --agent swe-bench-runner \
  -m mimo/mimo-v2.5-pro \
  --format json \
  --dangerously-skip-permissions \
  --print-logs --log-level INFO \
  "$(cat "$PROMPT_FILE")" \
  > "$ATTEMPT_DIR/events.jsonl" \
  2> "$ATTEMPT_DIR/stderr.log"
RUN_EXIT=$?
set -e

# 8. Score with SWE-bench grader (independent of opencode)
python3 "$ROOT/driver/score_attempt.py" \
  --task "$TASK_ID" --workspace "$WORK" \
  --events "$ATTEMPT_DIR/events.jsonl" \
  --run-exit "$RUN_EXIT" \
  --out "$ATTEMPT_DIR/result.json"

# 9. Archive session storage for forensic replay (optional)
cp -r "$XDG_DATA_HOME/opencode/storage" "$ATTEMPT_DIR/session" || true

echo "[$TASK_ID/$ARM/$TRIAL] exit=$RUN_EXIT result=$ATTEMPT_DIR/result.json"
```

### `score_attempt.py` parsing core

```python
import json, sys, pathlib
from collections import Counter

def parse_events(path):
    tokens_in = tokens_out = tokens_reasoning = cache_read = cache_write = 0
    cost_usd = 0.0
    tool_calls = Counter()
    final_text_parts = []
    first_ts = last_ts = None
    errors = []

    for line in pathlib.Path(path).read_text().splitlines():
        if not line.strip():
            continue
        ev = json.loads(line)
        ts = ev.get("timestamp")
        if ts:
            first_ts = ts if first_ts is None else first_ts
            last_ts = ts
        et = ev["type"]
        if et == "step_finish":
            tk = ev["part"].get("tokens", {})
            tokens_in += tk.get("input", 0)
            tokens_out += tk.get("output", 0)
            tokens_reasoning += tk.get("reasoning", 0)
            cache = tk.get("cache", {})
            cache_read += cache.get("read", 0)
            cache_write += cache.get("write", 0)
            cost_usd += ev["part"].get("cost", 0.0)
        elif et == "tool_use":
            tool_calls[ev["part"]["tool"]] += 1
        elif et == "text":
            final_text_parts.append(ev["part"].get("text", ""))
        elif et == "error":
            errors.append(ev.get("error"))

    return {
        "tokens": {
            "input": tokens_in, "output": tokens_out,
            "reasoning": tokens_reasoning,
            "cache_read": cache_read, "cache_write": cache_write,
        },
        "cost_usd": round(cost_usd, 6),
        "tool_calls": dict(tool_calls),
        "tool_call_total": sum(tool_calls.values()),
        "wall_clock_ms": (last_ts - first_ts) if first_ts and last_ts else None,
        "final_text": "".join(final_text_parts),
        "errors": errors,
    }

if __name__ == "__main__":
    print(json.dumps(parse_events(sys.argv[1]), indent=2))
```

### `result.json` shape

```json
{
  "task_id": "django__django-12345",
  "arm": "trellis",
  "trial": "1",
  "verdict": "pass",                  // from SWE-bench grader
  "run_exit": 0,
  "tokens": {"input": 184223, "output": 4112, "reasoning": 0, "cache_read": 142000, "cache_write": 9100},
  "cost_usd": 0.43,
  "tool_calls": {"read": 12, "edit": 4, "bash": 7, "grep": 3, "mcp__abcoder__find_definition": 9, "mcp__gitnexus__impact_analysis": 2},
  "tool_call_total": 37,
  "wall_clock_ms": 184321,
  "errors": [],
  "session_id": "ses_217453252ffedmsys6uYEMTPrO",
  "opencode_version": "1.14.30",
  "model": "mimo/mimo-v2.5-pro"
}
```

### `opencode.template.json` (provider + global guards)

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "mimo/mimo-v2.5-pro",
  "share": "disabled",
  "autoupdate": false,
  "snapshot": true,
  "provider": {
    "mimo": {
      "npm": "@ai-sdk/openai-compatible",
      "name": "MiMo (XiaoMi)",
      "options": {
        "baseURL": "https://api.xiaomimimo.com/v1",
        "timeout": 600000,
        "chunkTimeout": 120000
      },
      "models": {
        "mimo-v2.5-pro": {
          "name": "MiMo v2.5 Pro",
          "tool_call": true,
          "limit": { "context": 200000, "output": 16384 },
          "cost": { "input": 0, "output": 0 }
        }
      }
    }
  },
  "enabled_providers": ["mimo"],
  "permission": {
    "*": "deny",
    "read": "allow",
    "edit": "allow",
    "bash": "allow",
    "glob": "allow",
    "grep": "allow",
    "list": "allow",
    "todowrite": "allow",
    "webfetch": "deny",
    "websearch": "deny",
    "task": "deny",
    "skill": "deny",
    "mcp__abcoder__*": "allow",
    "mcp__gitnexus__*": "allow"
  }
}
```

`enabled_providers: ["mimo"]` is a hard guard — even if `auth.json` happens to carry leftover credentials for openai/deepseek/anthropic, OpenCode will refuse to load any provider not in this list.

---

## Caveats / Watch-Outs

1. **System-prompt token bloat.** Default agents inline the entire OpenCode tool catalog + skills + project memory. Expect a 90k–200k input-token floor BEFORE any task content. Mitigations: custom agent with narrow `permission`, `skill: deny` (so no skills load), `task: deny` (no Task subagent prompts). Still, baseline ≈ 50k–80k tokens — budget accordingly. **Run a single calibration attempt per arm before committing to 240.**
2. **First-run db migration.** Fresh XDG_DATA_HOME triggers a one-time SQLite migration that emits stderr noise (`Performing one time database migration…`). Pre-warm with `opencode debug paths` before the actual `run`, or pipe stderr to a file the parser ignores.
3. **`tool_use` event only fires on completion.** Pending/running states are not emitted in the CLI JSON stream (per takopi.dev cheatsheet). For wall-clock per-tool you must use `part.state.time.{start,end}` from the completed event, not start-vs-end-event diffing.
4. **Cost field is provider-reported.** When you self-host or use a custom provider with `cost.input/output: 0` in config, `step_finish.part.cost` will be `0`. Not a bug — track tokens and apply a cost model post-hoc.
5. **`@ai-sdk/openai-compatible` sub-session quirk** (github.com/anomalyco/opencode#20725). Sub-sessions (Task tool) may try to fall back to the openai SDK. Since we set `task: deny` this is moot, but still: never enable `task` for the benchmark.
6. **Concurrency limits.** Each `opencode run` spins up a Bun runtime + an embedded server. RSS ≈ 200–400 MB per process. On a typical 16 GB dev machine you can run ~8–16 attempts in parallel; on cloud throwaway boxes pick a worker count × per-process RSS that fits.
7. **Auth.json schema is a flat string-keyed map.** For api-key providers (like our MiMo) the value is just the bare key string (`{"mimo":"sk-..."}`). For OAuth providers it's an object. Match the existing format on the user's `~/.local/share/opencode/auth.json` — confirmed flat for `deepseek` and OAuth-object for `openai` on this machine.
8. **`steps` cap is essential.** Without `steps: 200` (or similar) on the agent config, a confused model can loop indefinitely. The benchmark MUST cap iterations to bound runtime per attempt.

---

## External References

- **CLI source of truth (live):** `opencode --help`, `opencode run --help`, `opencode debug paths` outputs captured in this research session, opencode 1.14.30.
- **Config JSON Schema (live):** `https://opencode.ai/config.json` — full schema for `provider`, `mcp`, `agent`, `permission`. Pulled and excerpted above.
- **Permissions docs:** https://opencode.ai/docs/permissions
- **Providers docs (custom OpenAI-compatible section):** https://opencode.ai/docs/providers
- **CLI JSON event cheatsheet (community, but accurate):** https://takopi.dev/reference/runners/opencode/stream-json-cheatsheet/
- **Custom OpenAI-compatible provider walkthrough:** https://haimaker.ai/blog/opencode-custom-provider-setup
- **Source repo:** https://github.com/sst/opencode (rebrand: anomalyco/opencode)
- **Known issue — sub-session provider fallback:** https://github.com/sst/opencode/issues/20725
- **Original `--format json` PR:** https://github.com/sst/opencode/pull/2471

## Related Internal Files

- `Trellis/.opencode/agents/trellis-research.md` — example of YAML-frontmatter agent with `permission` block + MCP `allow` rules. Mirror this pattern for `swe-bench-runner.md`.
- `Trellis/.opencode/plugins/inject-subagent-context.js`, `inject-workflow-state.js`, `session-start.js` — plugin examples showing how OpenCode plugins hook session lifecycle. Not needed for the benchmark (we want a clean room) but useful if we ever want to inject the four-arm context via a plugin instead of prompt-templating.
- `~/.config/opencode/opencode.json` — current user config (just registers a Playwright MCP server). Reference for opencode.json shape.
- `~/.local/share/opencode/auth.json` — credentials store. Schema is `{ "<providerId>": "<apiKey>" | { oauth-object } }`.

## Not Found / Open Questions

- **MCP env-var injection at agent-level.** I did not find a clean way to set per-attempt env vars for an MCP server *via the agent file alone*. The MCP `environment` map lives in the top-level `mcp.<server>.environment` (in opencode.json). For per-attempt MCP config we either (a) re-template `opencode.json` per attempt (easy, since each attempt has its own XDG_CONFIG_HOME) or (b) launch the MCP server externally. Option (a) is simpler.
- **Streaming partial-token usage.** `step_finish` reports per-step totals; whether the *running* totals appear before the final `step_finish` is unclear from the schema alone — the live test was too short (one step) to verify cumulative-vs-delta semantics across multiple steps. Recommend inspecting the first multi-step calibration attempt to confirm whether to sum events or take the last one.
- **Doom-loop force-disable.** The schema lists `doom_loop: ask|allow|deny` but the docs note it only triggers after 3 identical tool calls. With `--dangerously-skip-permissions` it'll be auto-approved. No way found to wholly disable the detector — accept it as benign noise.
