# Debug Loop Guide

> **Purpose**: 调试纪律 —— 先建 tight、red-capable 反馈环，再假设、再修，一次到位找到并修对；与 `cstl-break-loop` 划界（诊断进行中 vs 修完后防再发），互不替代。

---

## 1. Purpose / Non-goals

**Purpose.** Hard bugs and performance regressions are not solved by reading code — they are solved by building a **tight, red-capable feedback loop** first, then letting hypotheses consume it. This guide defines the discipline: build the loop → reproduce → hypothesise → probe one variable at a time → freeze the loop as a regression → clean up and hand off to prevention.

**Non-goals**

- **Not a mandate for every bug.** A lightweight bug (obvious at a glance, provable in a single step) may skip the full loop — but you must state **one sentence** explaining why the full cycle was skipped.
- **Not a replacement for `cstl-break-loop`.** This guide owns *diagnosis in progress*; break-loop owns *post-fix root cause classification / prevention / knowledge capture* (see §2).
- **No production instrumentation** unless the user explicitly permits it. If you cannot build a loop without instrumenting production, stop and ask (see Phase 1 "genuinely cannot build a loop").
- **Not TDD ceremony.** Phase 5 freezes the loop as a test *or* a repeatable command — whichever is the correct seam.

## 2. Boundary with cstl-break-loop

| | **debug-loop-guide** (this guide) | **cstl-break-loop** |
| --- | --- | --- |
| 时机 | 诊断与修复**进行中**（建环 → 修） | 修复**完成后**（深分析） |
| 目标 | 一次到位找到并修对（red 环、假设表、修复、清理） | 根因分类（A–E）、为何修失败、防再发机制、入 spec |
| 输出 | 红环、3–5 假设排名、修复、回归、清理 | 5 维分析、prevention、knowledge capture 到 guides |
| 触发 | 用户报 bug / 性能回归，进入诊断 | `/cstl:break-loop` 或修完后的任务收尾 |

**二者不互相替代**：debug-loop-guide 结束时若只修完没做根因分类，同类 bug 会再发；cstl-break-loop 不帮你找到原因（它在修完之后才启动）。Phase 6 的 post-mortem 钩子负责把两者接起来。

## 3. Hard rule: no red-capable loop → no hypotheses

> **硬纪律：无 red-capable 反馈环，不得进入假设阶段；禁止先读代码猜原因。**

A **red-capable** loop is **one command** that you have **already run at least once** (show the invocation and its redacted output), and that simultaneously:

- **Drives the path of the user's symptom** — it exercises the actual bug code path, not "it didn't crash".
- **Can go red and green** — it goes red on *this* bug and turns green once fixed.
- **Is as deterministic, fast, and agent-runnable as possible** — seconds, unattended; a human in the loop only via the PowerShell HITL template (§12).

If you catch yourself reading code to build a theory before this command exists — **stop**. Jumping straight to a hypothesis is the exact failure this discipline prevents. No red-capable command, no Phase 2.

**If you genuinely cannot build a loop**: stop and say so explicitly. List what you tried. Ask the user for (a) access to the environment that reproduces it, (b) a redacted captured artifact (HAR file, log dump, core dump, screen recording with timestamps), or (c) **explicit permission** to add temporary production instrumentation. Do **not** proceed to hypothesise without a loop.

## 4. Lightweight escape hatch

A lightweight bug — one visible at a glance, provable in a single step (typo, obvious off-by-one, missing export) — may skip the full cycle. The only requirement: **one sentence explaining why the full loop was skipped** (e.g. "single-line typo, provable by one compile run; full loop skipped"). Hard bugs and performance regressions **default to the full loop**.

## 5. Redact

This guide makes you show commands, outputs and captured artifacts. **Redact every secret first** — write `<REDACTED>` in its place.

- Build loops against **env vars** so credentials stay in the environment, never in what you show.
- Captured artifacts carry auth headers: **quote only the lines that carry the signal**, not the whole blob.
- If the redacted output is not enough to diagnose the bug, say so and ask the user — do not leak secrets to move faster.

## 6. Phase 1 — Build a tight feedback loop

**This is the phase.** Everything else is mechanical. If you have a **tight** pass/fail signal for the bug — one that goes red on *this* bug — you will find the cause; bisection, hypothesis-testing, and instrumentation just consume it. If you don't have one, no amount of staring at code will save you. Spend disproportionate effort here. **Be aggressive. Be creative. Refuse to give up.**

### Ways to construct one — try them in roughly this order

1. **Failing test** at whatever seam reaches the bug — unit, integration, e2e.
2. **Curl / HTTP script** against a running dev server.
3. **CLI invocation** with a fixture input, diffing stdout against a known-good snapshot.
4. **Headless browser script** (Playwright / Puppeteer) — drives the UI, asserts on DOM/console/network.
5. **Replay a captured trace.** Save a real network request / payload / event log to disk; replay it through the code path in isolation.
6. **Throwaway harness.** Spin up a minimal subset of the system (one service, mocked deps) that exercises the bug code path with a single function call.
7. **Property / fuzz loop.** If the bug is "sometimes wrong output", run 1000 random inputs and look for the failure mode.
8. **Bisection harness.** If the bug appeared between two known states (commit, dataset, version), automate "boot at state X, check, repeat" so you can bisect it.
9. **Differential loop.** Run the same input through old-version vs new-version (or two configs) and diff outputs.
10. **HITL PowerShell script** (§12). Last resort. If a human must click, drive *them* with a structured loop so it is still a loop. Captured output feeds back to you.

### Tighten the loop

Treat the loop as a product. Once you have *a* loop, **tighten** it:

- Can I make it **faster**? (Cache setup, skip unrelated init, narrow the test scope.)
- Can I make the **signal sharper**? (Assert on the specific symptom, not "didn't crash".)
- Can I make it **more deterministic**? (Pin time, seed RNG, isolate filesystem, freeze network.)

A 30-second flaky loop is barely better than no loop; a 2-second deterministic one is a debugging superpower.

### Non-deterministic bugs

The goal is not a clean repro but a **higher reproduction rate**. Loop the trigger 100×, parallelise, add stress, narrow timing windows, inject sleeps. A 50%-flake bug is debuggable; 1% is not — keep raising the rate until it is debuggable.

### Completion criterion — a tight loop that goes red

Phase 1 is done when the loop is **tight** and **red-capable**: you can name **one command** — a script path, a test invocation, a curl — that you have **already run at least once** (show the invocation and its output, redacted), and that is:

- [ ] **Red-capable** — drives the actual bug code path and asserts the **user's exact symptom**, so it can go red on this bug and green once fixed. Not "runs without erroring".
- [ ] **Deterministic** — same verdict every run (flaky bugs: a pinned, high reproduction rate, per above).
- [ ] **Fast** — seconds, not minutes.
- [ ] **Agent-runnable** — unattended; a human in the loop only via the HITL template (§12).

No red-capable command, no Phase 2.

## 7. Phase 2 — Reproduce + minimise

Run the loop. Watch it go red — the bug appears.

Confirm:

- [ ] The loop produces the failure mode the **user** described — not a different failure that happens to be nearby. Wrong bug = wrong fix.
- [ ] The failure is reproducible across multiple runs (or, for non-deterministic bugs, reproducible at a high enough rate to debug against).
- [ ] You have captured the exact symptom (error message, wrong output, slow timing) so later phases can verify the fix actually addresses it.

### Minimise

Once it is red, shrink the repro to the **smallest scenario that still goes red**. Cut inputs, callers, config, data, and steps **one at a time**, re-running the loop after each cut — keep only what is load-bearing for the failure. A minimal repro shrinks the Phase 3 hypothesis space (fewer moving parts to suspect) and becomes the clean Phase 5 regression. Done when **every remaining element is load-bearing** — removing any one of them makes the loop go green.

Do not proceed until you have reproduced **and** minimised.

## 8. Phase 3 — Ranked falsifiable hypotheses (show user)

Generate **3–5 ranked hypotheses** before testing any of them. Single-hypothesis generation anchors on the first plausible idea.

Each hypothesis must be **falsifiable**: state the prediction it makes.

> Format: "If `<X>` is the cause, then `<changing Y>` will make the bug disappear / `<changing Z>` will make it worse."

If you cannot state the prediction, the hypothesis is a vibe — discard or sharpen it.

**Show the ranked list to the user before testing.** They often have domain knowledge that re-ranks instantly ("we just deployed a change to #3"), or know hypotheses they have already ruled out. Cheap checkpoint, big time saver. Don't block on it — proceed with your ranking if the user is AFK.

## 9. Phase 4 — One-variable probes / instrumentation

Each probe must map to a specific prediction from Phase 3. **Change one variable at a time.**

Tool preference:

1. **Debugger / REPL inspection** if the environment supports it. One breakpoint beats ten logs.
2. **Targeted logs** at the boundaries that distinguish hypotheses.
3. Never "log everything and grep".

**Tag every debug log with a unique prefix**, e.g. `[DEBUG-a4f2]` (or any equivalent uniform prefix). Cleanup at the end becomes a **single grep**: `grep -rn "\[DEBUG-" .` / `rg "\[DEBUG-"` — every tagged line dies, untagged lines survive.

**Perf branch.** For performance regressions, logs are usually wrong. Instead: establish a baseline measurement (timing harness, `performance.now()`, profiler, query plan), then bisect. Measure first, fix second.

## 10. Phase 5 — Regression (freeze the loop)

Freeze the loop as a test **or** a repeatable command — whichever has a **correct seam**.

A correct seam is one where the test/command exercises the **real bug pattern** as it occurs at the call site. If the only available seam is too shallow (single-caller test when the bug needs multiple callers, unit test that cannot replicate the chain that triggered the bug), a regression there gives false confidence.

**If no correct seam exists, that itself is the finding.** Note it — the architecture is preventing the bug from being locked down. Flag it for Phase 6 / break-loop.

If a correct seam exists:

1. Turn the minimised repro into a failing test (or a repeatable command) at that seam.
2. Watch it fail.
3. Apply the fix.
4. Watch it pass.
5. Re-run the Phase 1 feedback loop against the original (un-minimised) scenario.

This phase hands off to the test-discipline scope (P08) without being absorbed by it: the loop here is bug-driven; test-discipline owns the general testing strategy.

## 11. Phase 6 — Cleanup + post-mortem hook

Required before declaring done:

- [ ] Original repro no longer reproduces (re-run the Phase 1 loop)
- [ ] Regression passes (or absence of seam is documented)
- [ ] All `[DEBUG-...]` instrumentation removed — one grep, zero hits
- [ ] Throwaway prototypes deleted (or moved to a clearly-marked debug location)
- [ ] The hypothesis that turned out correct is stated in the commit / PR message — so the next debugger learns

**Post-mortem hook:** then ask *what would have prevented this bug?* If the answer involves architectural change (no good test seam, tangled callers, hidden coupling), or the bug is worth classifying, run **`cstl-break-loop`** (root cause category A–E, why fixes failed, prevention mechanisms) and/or update the relevant spec/guide via **`cstl-update-spec`**. Make the recommendation **after** the fix is in, not before — you have more information now than when you started.

## 12. PowerShell HITL template

PowerShell 7 (user environment). Copy this file, edit the steps below, and run it. The agent runs the script; the user follows prompts in their terminal. Two helpers:

- `Step "instruction"` → show instruction, wait for Enter
- `$var = Capture "question"` → show question, read response; the returned value is echoed back, where the agent reads it — so capture observations, and leave signing in to the user as a `Step`

At the end, captured values are printed as `KEY=VALUE` for the agent to parse.

```powershell
# Human-in-the-loop reproduction loop (PowerShell 7).
# Usage:  ./hitl-loop.ps1
# Edit the "--- edit below ---" section per bug, then run it.

$ErrorActionPreference = 'Stop'

function Step {
    param([Parameter(Mandatory)][string]$Instruction)
    Write-Host ''
    Write-Host ">>> $Instruction" -ForegroundColor Cyan
    [void](Read-Host "    [Enter when done] ")
}

function Capture {
    param([Parameter(Mandatory)][string]$Question)
    Write-Host ''
    Write-Host ">>> $Question" -ForegroundColor Cyan
    $answer = Read-Host "    > "
    Write-Host "    (captured: $answer)"
    return $answer
}

# --- edit below ---------------------------------------------------------

Step "Open the app at http://localhost:3000 and sign in."

$ERRORED = Capture "Click the 'Export' button. Did it throw an error? (y/n)"

$ERROR_MSG = Capture "Paste the error message (or 'none'):"

# --- edit above ---------------------------------------------------------

Write-Host ''
Write-Host '--- Captured ---' -ForegroundColor Green
Write-Host "ERRORED=$ERRORED"
Write-Host "ERROR_MSG=$ERROR_MSG"
```

Adaptation notes for the agent: keep the loop **agent-runnable** where possible (headless/HTTP/CLI first); HITL only when a human must click or sign in. Never ask the user to paste secrets into the loop output — capture observations, leave signing in to the user as a `Step`.

## 13. Completion checklist

- [ ] Phase 1 loop exists, ran at least once, red-capable, deterministic, fast, agent-runnable (or escape hatch justified in one sentence)
- [ ] Phase 2: reproduced the user's exact symptom; repro minimised until every element is load-bearing
- [ ] Phase 3: 3–5 ranked falsifiable hypotheses, each with a stated prediction; shown to user
- [ ] Phase 4: one variable per probe; debug logs tagged `[DEBUG-...]`
- [ ] Phase 5: loop frozen as test or repeatable command at a correct seam (or absence of seam documented)
- [ ] Phase 6: original repro green, instrumentation removed (one grep, zero hits), post-mortem hook to `cstl-break-loop` / `cstl-update-spec` decided
- [ ] Everything shown to the user redacted (`<REDACTED>`, credentials via env)
