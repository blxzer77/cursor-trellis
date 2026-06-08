# Trellis Spec-Injection Benchmark (Phase 0a / L1)

## Goal

Empirically test the core Trellis claim — **"injecting structured project spec into a fresh agent session improves performance"** — on a public, reproducible benchmark substrate, using the same model that real users run Trellis on.

This is **Phase 0a (L1)** of a longer arc. L1 tests the *injection mechanism* via oracle-distilled spec on i.i.d. tasks. L2 (longitudinal compounding on a single repo) is intentionally **deferred** to keep the benchmark form pure and reproducible by external parties.

## What Changed From Earlier Iteration (key decisions, ADR-lite)

The PRD went through several pivots. Locked positions, with reasoning:

1. **Substrate: SWE-bench Verified subset, NOT TerminalBench-2.** TB-2 tasks have no starting repo state ("build from scratch in a fresh container"); Trellis's spec-injection pitch needs a real codebase to extract conventions from. SWE-bench Verified gives real repos, real conventions, real grader, hidden tests, external credibility.
2. **Model: Xiaomi MiMo v2.5 Pro (same model for both spec-writer and task-solver roles).** User has 1.6B free tokens. Same-model is **closer to real Trellis usage** (one developer, one model, two sessions across time). Distillation framing was abandoned because MiMo v2.5 Pro is itself SOTA-tier (SWE-bench Pro 57.2 > Opus 4.6).
3. **Driver: OpenCode (`opencode 1.14.30`), NOT Claude Agent SDK.** OpenCode is one of Trellis's officially-supported platforms — driving via OpenCode dogfoods the actual workflow rather than building a synthetic harness. All six benchmark-driver requirements verified live (see `research/opencode-driver.md`).
4. **Protocol: fresh session per task** (with optional ablation testing continuous-within-repo on 5 tasks). Mirrors SWE-bench convention; isolates spec-injection effect from in-context memory.
5. **Scope: L1 only.** Compounding (L2) is more like a longitudinal case-study than a benchmark; it would dilute reproducibility.

## Requirements

- **Substrate**: 20 tasks from SWE-bench Verified, drawn from 4 repos × 5 tasks (sympy, astropy, django, requests).
- **Model under test**: MiMo v2.5 Pro at `https://api.xiaomimimo.com/v1`, model id `mimo-v2.5-pro`.
- **Driver**: OpenCode in headless mode (`opencode run --format json --dangerously-skip-permissions`), per-attempt sandboxed via `XDG_*` env vars + `mktemp -d`.
- **Tool whitelist**: only `Read/Edit/Write/Glob/Grep/Bash` + `mcp__abcoder__*` + `mcp__gitnexus__*`. Default-deny all other tools (no Web*, no playwright, no codex-cli, etc.). Sub-agent (`task`) and skill auto-loading **disabled** to control token bloat.
- **Per-attempt sandboxing**: `XDG_DATA_HOME` / `XDG_CONFIG_HOME` / `XDG_CACHE_HOME` / `XDG_STATE_HOME` all relocated under `mktemp -d`; `--dir <repo-snapshot>` controls cwd. Pre-warmed sqlite to silence first-run migration message.
- **Spec generation (oracle, offline, once per task)**: MiMo v2.5 Pro reads the repo snapshot at the task's base commit, writes a complete Trellis-structured `.trellis/spec/` (multi-file, with `index.md`) capturing the codified conventions a new contributor would need.
- **4 arms** (each task × each arm × 3 trials = 240 attempts):
  - **A. Bare**: MiMo, no extra context beyond task prompt.
  - **B. Wrong spec**: MiMo + a Trellis spec written for a *different* task in the corpus (control: "any extra context helps?").
  - **C. Trellis spec**: MiMo + the matching `.trellis/spec/` injected via OpenCode's standard Trellis hook path. **Main treatment.**
  - **D. Raw dump**: MiMo + concatenated `README.md` + `AGENTS.md` + key source-file headers as raw context (control: "structure beats unstructured dump?").
- **Determinism strategy**: MiMo does NOT support `seed`. Use `temperature=0.3` (per Xiaomi's recommendation for agentic), 3 trials per (task, arm), report **Pass^3** primary and per-trial pass rate secondary.
- **Telemetry per attempt**: pass/fail (binary, from SWE-bench grader), input/output/cache tokens, per-tool-call count, wall-clock time, final assistant message, errors. Captured from OpenCode's JSONL `step_finish` events into `result.json`.
- **Calibration first**: Run **one** smoke attempt with the slim agent BEFORE the full 240. The default OpenCode agent inlines 92K+ input tokens of catalog/skills/memory; we MUST verify the slim agent (`task: deny`, `skill: deny`, no auto-loaded memory) gets us under ~5K. Estimate full-run cost from calibration, not assumptions.

## Acceptance Criteria

- [ ] 20 SWE-bench Verified tasks selected with task IDs, base commit, and grader spec persisted in `bench/tasks.yaml`.
- [ ] OpenCode `swe-bench-runner` agent definition + per-arm provider config + MCP whitelist all checked in under `bench/`.
- [ ] `run_attempt.sh` (per-attempt driver) and `score_attempt.py` (per-attempt grader + telemetry parser) implemented, with calibration smoke-test passing under expected token budget.
- [ ] Spec-generation script that produces `.trellis/spec/` for each task using MiMo, output reproducible across re-runs (same prompt + same temp + manual diff if regen needed).
- [ ] Full benchmark execution: 20 tasks × 4 arm × 3 trial = 240 attempt rows in `results/all.jsonl`.
- [ ] Aggregator that reports per-arm Pass^3, mean tokens, mean tool-calls, mean wall-clock, with bootstrap 95% CIs.
- [ ] Findings memo (`research/findings.md`) with the headline plot (4 arms × pass rate w/ CIs) and a clear "go / pivot / no-go" recommendation for next phase.
- [ ] Optional ablation: 5 tasks rerun in continuous-within-repo mode; delta vs fresh-per-task quoted.

## Definition of Done

- All artifacts (tasks selection, runner, oracle generator, aggregator, plots) checked into `bench/` directory.
- Findings memo published with raw data attached.
- Research files retained under `.trellis/tasks/<this-task>/research/` for future replay.
- If results justify, a follow-up Phase 0b (L2 compounding) task is created with this PRD as parent.
- New conventions discovered during implementation captured into `.trellis/spec/` per Trellis discipline.

## Out of Scope (Phase 0a)

- L2 compounding test (longitudinal sequential tasks on a single repo, with `trellis-update-spec` self-accumulation).
- Cross-model distillation experiments (Opus → Haiku, etc.).
- Public leaderboard submission to TerminalBench-2 or SWE-bench.
- Multi-language / multi-framework expansion beyond the 4 chosen Python repos.
- Optimization of the spec-generation prompt itself (treat current Opus-style template as v0; iterate later if needed).
- Modifying SWE-bench Verified's grader.

## Decision Rules (pre-registered)

Compute primary metric: **C - A in Pass^3, with bootstrap 95% CI over (task × trial)**.

| Outcome | Interpretation | Next Step |
|---|---|---|
| C - A ≥ 5pp, CI excludes 0, AND C > D | Trellis structured-spec injection adds robust value beyond raw context dump | Greenlight Phase 0b (L2 compounding) |
| C - A ≥ 5pp but C ≈ D | Spec content matters, structure doesn't | Pivot Trellis pitch to "auto-curated context" rather than "structured spec library" |
| 0 ≤ C - A < 5pp | Mechanism works but small | Investigate — is MiMo too strong? Is spec quality the bottleneck? Optionally retry on a weaker open model |
| C - A < 0 OR C - B ≈ 0 | Spec injection has no real lift on SOTA model, or any context works equally | Honest null result. Reframe Trellis value prop or stop |

## Technical Approach

End-to-end pipeline:

```
1. Select tasks       (bench/select_tasks.py → tasks.yaml)
2. Snapshot repos     (per task × repo, checkout at base commit, save tarball)
3. Index for MCP      (abcoder parse + gitnexus analyze, once per repo)
4. Generate oracle    (bench/generate_spec.py via MiMo → .trellis/spec/ tarball per task)
5. Run attempts       (bench/run_attempt.sh × 240, OpenCode headless, sandboxed)
6. Grade attempts     (bench/score_attempt.py: SWE-bench grader + telemetry parse → result.json)
7. Aggregate          (bench/aggregate.py → results/all.jsonl + plots/*.png)
8. Memo               (research/findings.md, hand-written analysis)
```

Per-attempt isolation pattern (see `research/opencode-driver.md` for full sketch):
```bash
SANDBOX=$(mktemp -d)
export XDG_DATA_HOME=$SANDBOX/data XDG_CONFIG_HOME=$SANDBOX/config \
       XDG_CACHE_HOME=$SANDBOX/cache XDG_STATE_HOME=$SANDBOX/state
opencode debug paths >/dev/null   # pre-warm sqlite
opencode run \
  --dir "$REPO_SNAPSHOT" \
  --format json \
  --dangerously-skip-permissions \
  --model mimo/mimo-v2.5-pro \
  --agent swe-bench-runner \
  "$TASK_PROMPT" \
  > "$RESULT_DIR/raw.jsonl"
python bench/score_attempt.py "$RESULT_DIR/raw.jsonl" > "$RESULT_DIR/result.json"
rm -rf "$SANDBOX"
```

OpenCode provider config (drop-in, see research file for full):
```json
{
  "provider": {
    "mimo": {
      "npm": "@ai-sdk/openai-compatible",
      "options": {"baseURL": "https://api.xiaomimimo.com/v1"},
      "models": {"mimo-v2.5-pro": {"name": "MiMo v2.5 Pro"}}
    }
  },
  "enabled_providers": ["mimo"]
}
```

Slim agent definition (`<workspace>/.opencode/agents/swe-bench-runner.md`) with `task: deny`, `skill: deny`, MCP allowlist, `steps: 200` cap.

## Decision (ADR-lite)

**Context**: We need an external benchmark substrate to test Trellis's spec-injection mechanism, while staying within reproducibility norms and the user's free-MiMo budget.

**Decision**:
- Substrate = SWE-bench Verified 20-task subset across 4 repos.
- Model = MiMo v2.5 Pro for both spec-writing and task-solving roles, fresh session per task.
- Driver = OpenCode 1.14.30 with custom provider + slim agent + MCP allowlist.
- Scope = L1 only (mechanism test). L2 (compounding) deferred.

**Consequences**:
- Pros: External credibility (SWE-bench Verified), zero dollar cost (1.6B token grant), realistic Trellis dogfood (OpenCode is a supported platform), reproducible by anyone with MiMo access.
- Cons: SOTA model means delta from spec injection may be small; null result is a real possibility. No `seed` means we rely on Pass^3 over 3 trials (modest stat power; if results sit on the boundary we may need to expand to 5 trials).

## Research References

- [`research/terminal-bench-2.md`](research/terminal-bench-2.md) — TB-2 evaluated and rejected; "no starting repo state" was the disqualifier
- [`research/tb2-agent-landscape.md`](research/tb2-agent-landscape.md) — competitive landscape; **no existing TB-2 framework has a structured project-spec layer** → confirmed positioning gap
- [`research/claude-agent-sdk.md`](research/claude-agent-sdk.md) — Claude Agent SDK option (rejected in favor of OpenCode), useful as fallback reference
- [`research/mcp-tools-setup.md`](research/mcp-tools-setup.md) — abcoder + gitnexus stdio MCP wiring (carries over to OpenCode unchanged)
- [`research/mimo-v2-5-pro.md`](research/mimo-v2-5-pro.md) — model API, capability tier (SWE-bench Pro 57.2), 1M context, no `seed` support
- [`research/opencode-driver.md`](research/opencode-driver.md) — full driver architecture, 6/6 capability checks green, ready-to-lift script + agent + config sketches

## Technical Notes

- **MiMo quirks**: no `seed`, `temperature=0.3` recommended for agentic, dotted model id `mimo-v2.5-pro`, 22:00–08:00 night-time discount (irrelevant under free quota but useful for paid expansion).
- **OpenCode quirks**: prompt is positional argument (NOT `--prompt`); `task: deny` mandatory to avoid sub-session provider fallback bug (sst/opencode#20725); `steps: 200` cap mandatory to prevent runaway loops; default agent's 92K+ token bloat means slim agent is non-negotiable.
- **Repo selection rationale**: sympy and astropy both have rich math/scientific conventions; django for "huge codebase" stress-test of long-context spec; requests as small-codebase control. Avoiding Flask + scikit-learn for now (can add later if signal demands).
- **No `seed` workaround**: 3 trials per cell is the floor. If post-hoc CIs cross the decision threshold, expand to 5 trials (50% more budget — still < 0.1% of free quota).
- **Calibration is mandatory**: do not skip the smoke run. The default OpenCode agent's token bloat would single-handedly burn meaningful budget across 240 attempts.
