# Research: Terminal-Bench 2.0 Agent Landscape (TB-2 Competitors)

- **Query**: Map the top agent frameworks on the TB-2 leaderboard so Trellis can position itself relative to them.
- **Scope**: External (web)
- **Date**: 2026-05-02

## Findings

### Quick Comparison Table

| Framework | Vendor | OSS? | License | Lang | TB-2 (Opus 4.6) | TB-2 (Haiku 4.5) | Spec/memory layer? |
|---|---|---|---|---|---|---|---|
| ForgeCode | Antinomy HQ / Tailcall (forgecode.dev) | Agent OSS, Services proprietary | Apache-2.0 | Rust | **81.8%** (#1) | not posted | No (skills + AGENTS.md, not user-curated) |
| Meta-Harness | Stanford IRIS Lab (Yoonho Lee et al., +KRAFTON) | Yes | MIT | Python | 76.4% (#2 Opus) | **37.6%** (#1 Haiku) | Filesystem-as-memory for outer-loop search; no project spec layer |
| Terminus-KIRA | KRAFTON AI + Ludo Robotics | Yes | (no LICENSE file shown, free repo) | Python | 74.7% | ~lower 30s | No (harness-level fixes only) |
| Capy | Capy (vendor opaque) | Unknown | n/a | n/a | 75.3% | n/a | Unknown |
| Terminus 2 | Terminal-Bench / AfterQuery / Laude Institute | Yes (in Harbor) | Apache-2.0 | Python | 64.7% | ~28% | No — minimal reference loop |
| OpenHands | All Hands AI / community (formerly OpenDevin) | Yes (core MIT, enterprise/ source-available) | MIT | Python + TS | ~52% (Opus 4.5 entry) | ~24% | "Microagents" exist but not user-curated project spec |
| MAYA-V2 | Adya.ai (Hyderabad, India) | No | Proprietary | n/a | ~mid leaderboard (rank 12 on 2026-03-12) | n/a | No public detail |
| Claude Code (in Harbor) | Anthropic, adapter by Harbor | Adapter OSS, Claude Code itself proprietary | adapter Apache-2.0 | Python adapter | 65–70% range | ~30% range | CLAUDE.md is the closest analog; adapter doesn't add one |

Numbers are from tbench.ai filtered views captured 2026-04 — see citations below. Treat as approximate; bench is "actively contested" (Meta-Harness paper) and ForgeCode has had reward-hacking entries rescored.

---

### 1. ForgeCode — #1 on TB-2 with Opus 4.6 (81.8%)

- **Vendor**: Antinomy HQ (also referenced as Tailcall, Inc. on Terminal Trove). LinkedIn lists 7 employees, Dover, US. Repo `antinomyhq/forge` (older alias `tailcallhq/forgecode`). Site: https://forgecode.dev. The "Open-source agent" + "ForgeCode Services" (proprietary runtime layer) split is explicit in their blog.
- **GitHub / license / stars**: https://github.com/antinomyhq/forge — Apache-2.0, ~6.6k stars, 1.3k forks, written in **Rust** (93%). Created Dec 2024. v2.11.1 latest (2026-04-15).
- **Open vs proprietary**: Agent itself is OSS. The runtime layer that produced the 78.4–81.8% TB-2 numbers — "ForgeCode Services" — is **proprietary** but currently free; depends on `api.forgecode.dev` for semantic indexing.
- **Tech stack**: Rust core; supports OpenAI, Anthropic, OpenRouter (~300+ models), local models. ZSH plugin (`:` prefix), interactive TUI, and one-shot CLI modes.
- **Distinctive design**:
  - Three named built-in subagents — **Forge** (execute), **Muse** (plan), **Sage** (read-only research) — each with its own model/context. Subagents can spawn subagents via `join_all()` for parallel tool calls.
  - **Skills framework** (`SKILL.md`) — reusable workflow modules loaded only when task profile matches them ("dynamic skill loading"). Conceptually similar to Anthropic Skills.
  - Programmatic enforcement layer: `todo_write` planning enforcement, tool-call correction layer, schema flattening, "verification skill" enforced after task body — all model-agnostic.
- **TB-2 scores**: Opus 4.6 → **81.8% (#1)**, GPT-5.4 → **81.8% (#1 tie)**, Gemini 3.1 Pro → 78.4%. Haiku 4.5 score: not posted on the public board as of latest data.
- **Spec / memory layer for our comparison**: Has a "context engine" (semantic indexing on their server), but **no user-authored project-level spec / convention file**. The agent does construct an `AGENTS.md` per task at runtime — and that very mechanism was caught reward-hacking by curling solutions from the internet (per the Terminal-Bench Integrity Update). No durable, user-curated spec analog to `.trellis/spec/`.

Citations:
- https://forgecode.dev/blog/benchmarks-dont-matter (Part 1, 78.4% writeup)
- https://forgecode.dev/blog/gpt-5-4-agent-improvements/ (Part 2, 81.8% writeup)
- https://www.tensorlake.ai/blog/forgecode-terminal-bench
- https://www.tbench.ai/news/leaderboard-integrity-update
- https://github.com/antinomyhq/forgecode

---

### 2. Meta-Harness — Stanford IRIS Lab (Yoonho Lee et al., 2026)

- **What**: An *outer-loop search* system that searches over harness code itself. Paper "Meta-Harness: End-to-End Optimization of Model Harnesses" (arXiv 2603.28052). Authors: Yoonho Lee, Roshen Nair, Qizheng Zhang (Stanford), Kangwook Lee (KRAFTON), Omar Khattab (MIT), Chelsea Finn (Stanford).
- **Repos**:
  - Framework — https://github.com/stanford-iris-lab/meta-harness — **MIT**, 127+ stars, Python.
  - TB-2 artifact — https://github.com/stanford-iris-lab/meta-harness-tbench2-artifact — Python, 623 stars. Open-source, sole contributor `yoonholee`.
- **Open-source confirmation**: Yes, both repos are public. Framework MIT, artifact has no explicit license file but is published openly. The optimized TB-2 harness is in the artifact repo and inherits from Terminus-KIRA, which inherits from Terminus 2.
- **Distinctive design**:
  - "Agentic proposer" reads source code, scores, and execution traces of all prior candidates **through a filesystem** to evolve harness code.
  - Builds on Terminus-KIRA + adds "environment bootstrapping": before agent loop starts, gathers `cwd`, file listing, available languages/tools, package managers, memory and injects into the first prompt. Saves 2–5 exploration turns.
  - Optimization happens offline (search), but at inference time it just runs the discovered harness.
- **TB-2 scores (per paper Table 7)**:
  - Claude Opus 4.6 → **76.4%** (#2 among Opus 4.6 agents, surpasses Terminus-KIRA 74.7%; only ForgeCode beats it, "but we were unable to reproduce their reported result from publicly available code alone").
  - Claude Haiku 4.5 → **37.6%** (#1 among Haiku 4.5 agents, beats Goose 35.5%).
- **Spec / memory layer**: The framework's *meta* operates with a "filesystem of prior candidates" — that *is* a memory abstraction, but it's a **search-time** memory of harness candidates, not a user-curated project-level convention store at inference time. Closest analog among TB-2 frameworks but still different in role.

Citations:
- https://arxiv.org/abs/2603.28052
- https://yoonholee.com/meta-harness/
- https://github.com/stanford-iris-lab/meta-harness
- https://github.com/stanford-iris-lab/meta-harness-tbench2-artifact

---

### 3. MAYA-V2 — Adya.ai

- **Vendor**: Adya.ai, Hyderabad-based startup (also "Adyatech Solutions LLP"); founder/CEO Shayak Mazumder. Marketed as "Vertical AI for businesses" combining Claude Code + n8n + Replit + HF features under enterprise governance.
- **GitHub / license**: No public agent repo found. Submissions to TB-2 leaderboard were filed under PRs `MAYA-V2 Adya Submission` on the `harborframework/terminal-bench-2-leaderboard` HF dataset (e.g. PR #83 by `alexgshaw`/`thilak9`).
- **Open-source**: **Proprietary**. Site touts "7+ patents filed."
- **Tech stack**: Not disclosed publicly. Enterprise platform marketing focus, not engineering details.
- **TB-2 scores**:
  - Claude 4.6 Opus, dated 2026-03-12 — submission listed; "Top 12 globally" per their LinkedIn (rank 12 on 2026-03-12).
  - Earlier entry: Claude 4.5 Sonnet, 2026-01-04.
- **Spec / memory layer**: Not disclosed. Likely an internal vertical-agent stack rather than a public framework with public conventions.

Citations:
- https://adya.ai/
- https://www.linkedin.com/posts/adyadotai_adyaai-maya-artificialintelligence-activity-7438130512063504384-Ajpr
- https://huggingface.co/datasets/harborframework/terminal-bench-2-leaderboard/commits

---

### 4. OpenHands (formerly OpenDevin)

- **Vendor**: All Hands AI / OpenHands community. Originally "OpenDevin", renamed.
- **GitHub**: https://github.com/OpenHands/OpenHands — **MIT** (core), 72k+ stars, 9k+ forks, 470 contributors. Latest 1.6.0 (2026-03-30). Primary language Python (62%), TypeScript (36%).
- **Open-source**: Mostly OSS (MIT). The `enterprise/` directory is source-available with a paid license.
- **Tech stack**: Python SDK + TS frontend. Components: SDK (composable Python lib), CLI, Local GUI (REST API + React), Cloud, Enterprise. Model-agnostic — Anthropic, OpenAI, Gemini, Minimax, etc.
- **Distinctive design**:
  - "Software Agent SDK" approach: define agents in code; scale to thousands of cloud agents.
  - CodeAct paradigm (executable Python actions, not JSON tool schemas) — strongly featured on SWE-Bench (CodeAct v3 with Opus 4.6 → 68.4% Verified).
  - "Microagents" / Theory-of-Mind module mentioned in repo, not heavily marketed.
  - Native enterprise integrations (Slack, Jira, Linear, GitHub/GitLab).
- **TB-2 scores (from leaderboard)**: Submissions exist for Claude Opus 4.5, Claude Sonnet 4.5, Claude Opus 4.1, Claude Haiku 4.5, GPT-5, GPT-5-Mini, Gemini 2.5 Pro. Concrete numbers from filtered views: Opus 4.5 ≈ low-50s; Haiku 4.5 ≈ low-to-mid 20s. Not in the top 10 on Opus 4.6.
- **Spec / memory layer**: OpenHands has a **"Microagents"** mechanism — small markdown files with frontmatter that activate on triggers (similar in spirit to Trellis skills/specs), and supports an `.openhands/` directory in repos. This is the closest analog to `.trellis/spec/` among major OSS coding agents. Not as central / structured as Trellis specs, but the conceptual seed exists.

Citations:
- https://github.com/OpenHands/OpenHands
- https://openhands.dev/

---

### 5. Terminus 2 — Harbor's reference agent

- **Vendor**: Terminal-Bench team / Laude Institute / AfterQuery (per leaderboard "Agent Org" labels). Lives inside the Harbor framework: https://github.com/laude-institute/harbor (also accessible as `harbor-framework/harbor`), Apache-2.0, 1.7k stars, 180 contributors.
- **Source location**: `src/harbor/agents/terminus_2/terminus_2.py` (class `Terminus2(BaseAgent)`).
- **Tech stack**: Python. Uses litellm for model calls, tmux for terminal interaction, Docker sandbox.
- **Agent loop shape (from source + docs)**:
  - **Minimal loop**: send command → read terminal buffer (incremental output via tmux) → think → repeat. Runs in a separate Python process from the Docker container.
  - Tools exposed: just **shell commands via tmux** (`session.send_keys`) plus a "submit final answer" mechanism. No file-edit primitive — model writes via `cat`, `sed`, etc.
  - **Conversation history management** is the only sophisticated piece:
    - Proactive summarization when free tokens < `proactive_summarization_threshold` (default 8000).
    - 3-step subagent summarization: Summary → Question → Answer subagents reconstruct compressed context.
    - 4-step passive fallback (Unwind → Standard summary → Fallback summary → Ultimate fallback) on `ContextLengthExceededError`.
  - Trajectories logged in **ATIF (Agent Trajectory Interchange Format)** — Harbor's standard for SFT/RL rollouts.
- **TB-2 scores (Terminus 2 across models)**: Opus 4.6 → 64.7%; Opus 4.5 → 62.9%; Gemini 3 Pro → 57.8%; GPT-5.2 → 56.9%; Claude Sonnet 4.5 → 47.6%; Claude Haiku 4.5 → 28.3%; GPT-OSS-120B → 23.9%; ... down to GPT-OSS-20B → 3.1%.
- **Memory/spec features**: **None**. By design Terminus 2 is "intentionally minimal." Its only "memory" mechanic is the runtime conversation summarizer described above — there is no project-level spec, no AGENTS.md/CLAUDE.md analog, no skills, no convention store.

Citations:
- https://harborframework.com/docs/terminus-2 (and /docs/agents/terminus-2)
- https://github.com/laude-institute/harbor/blob/main/src/harbor/agents/terminus_2/terminus_2.py
- https://github.com/laude-institute/harbor/blob/main/AGENTS.md
- https://www.tbench.ai/leaderboard/terminal-bench/2.0?agents=Terminus+2

---

### 6. Terminus-KIRA — KRAFTON AI variant of Terminus 2

- **Vendor**: KRAFTON AI (game studio's AI division) + Ludo Robotics. Repo: https://github.com/krafton-ai/KIRA (Python).
- **Open-source**: Yes, public; specifically declared open-source in their blog. No SPDX LICENSE shown in highlights but the repo is public and they invite users to "use Terminus-KIRA."
- **Tech stack**: Python. `terminus_kira/terminus_kira.py` extends Harbor's `Terminus2` class. Calls litellm directly with a `tools=TOOLS` parameter to bypass parent ICL parsing.
- **What they changed vs Terminus 2** (the meaningful diff):
  1. **Native tool calling** instead of ICL JSON/XML parsing — three tools: `execute_commands`, `task_complete`, `image_read`. Removes regex/JSON parsers and the verbose response-format prompt.
  2. **Multimodal `image_read`** so the agent can analyze screenshots/PDF previews from the terminal (tmux can't forward images).
  3. **Marker-based polling** — appends `echo '__CMDEND__<seq>__'` after each command; if marker appears, skip remaining wait. Saves wall time on fast commands.
  4. **Smart completion verification** — double-confirmation checklist with multi-perspective QA (test engineer / QA engineer / user roles in prompt). Reduces false positives where the agent claims success prematurely.
  5. **Anthropic ephemeral prompt caching** on recent messages.
  6. Prompt-level fixes: "submission is FINAL", "no human intervention", "you do NOT have eyes or ears" framing.
- **TB-2 scores**: Opus 4.6 → 74.7% (#3 among Opus 4.6 agents). Krafton blog claims +10pp boost vs frontier baselines on TB1.5/TB2 series; titled "How We Reached 74.8%". Haiku 4.5 score not separately marketed.
- **Memory/spec layer**: **None**. Pure harness-level work. No project conventions, no skill registry, no durable memory. They explicitly call themselves a "minimal harness."

Citations:
- https://github.com/krafton-ai/KIRA
- https://krafton-ai.github.io/blog/terminus_kira_en/

---

### 7. (Bonus) Claude Code via Harbor adapter

- **What it is**: Harbor adapter at `src/harbor/agents/installed/claude_code.py` (`class ClaudeCode(BaseInstalledAgent)`). Source: https://github.com/laude-institute/harbor/blob/main/src/harbor/agents/installed/claude_code.py.
- **What it does**:
  - `install()` — apt/apk/yum-installs curl, then either `npm install -g @anthropic-ai/claude-code@<ver>` (Alpine) or `curl -fsSL https://claude.ai/install.sh | bash`. Adds `~/.local/bin` to PATH.
  - `run()` — invokes `claude` CLI with flags exposed via `CliFlag` definitions: `--max-turns`, `--effort` (low/med/high), `--max-budget-usd`, `--fallback-model`, `--append-system-prompt`, `--allowedTools`, etc.
  - `populate_context_post_run()` — parses Claude Code's session JSONL logs from `logs/sessions/projects/*/*.jsonl` into ATIF trajectory format.
  - `SUPPORTS_ATIF = True` so trajectories integrate with Harbor's standard format / RL pipeline.
- **Notable**: This adapter is just a *runner* — it does not inject CLAUDE.md / AGENTS.md / skills. The TB-2 task itself doesn't ship one. So when Anthropic submits "Claude Code" results on TB-2 (Opus 4.6 entry 2026-02-07; Haiku 4.5 entry 2025-11-04), the agent is operating *without* a project spec layer — exactly the regime where Trellis would add value if integrated.

---

### Notes on benchmark integrity (relevant to anyone planning to submit)

- ATIF trajectories are required for all passing trials.
- Reward hacking → rescored to 0 (publicly: ForgeCode's `AGENTS.md` curling solutions from the internet was caught and rescored).
- Cheating → submission removed.
- A judge agent will be open-sourced; submitters can validate locally before uploading.

Source: https://www.tbench.ai/news/leaderboard-integrity-update

---

## Trellis Positioning Analysis

### Does any TB-2 framework have a `.trellis/spec/`-equivalent project spec / convention layer?

**No, not really.** The closest analogs and how they fall short:

1. **ForgeCode `SKILL.md` files + dynamic skill loading** — closest *structural* analog. But skills are reusable workflow modules (e.g. "testing skill", "debugging skill"), authored once and bundled with the framework or by the user as plugins. They are *not* a per-project, durable record of "this codebase's conventions, file layout, contracts." Plus ForgeCode also auto-generates AGENTS.md *at task time* — that's the opposite of Trellis's persisted user-curated spec.
2. **OpenHands microagents** (`.openhands/microagents/`) — closest *intent* analog. Trigger-based small markdown agents that activate on specific repo events. Not foregrounded in marketing, not central to the framework's design philosophy, and not a structured spec hierarchy (no `cli/`, `docs-site/`, `guides/` separation). Conceptually adjacent to Trellis but execution is much shallower.
3. **Meta-Harness "filesystem of prior candidates"** — a *meta-level* memory used by an outer-loop search across harness candidates. Not user-facing, not project-specific, not a coding convention store. Different problem.
4. **Terminus 2 / Terminus-KIRA / Claude Code adapter** — **zero** project spec layer. The Terminus family is explicitly minimal; the Claude Code adapter just shells out to the CLI without injecting a CLAUDE.md.
5. **Capy / MAYA-V2** — not enough public info; safe to assume no such layer publicly.

**Conclusion**: There is a **clear positioning gap** for an explicit, structured, user-curated *project spec / coding convention* layer that lives alongside the agent. Every TB-2 framework leaks knowledge into runtime prompts (AGENTS.md generation), runtime memory (Terminus summaries), or hand-tuned runtime rules (KIRA prompt edits). None persist user-validated coding conventions in a way that compounds across tasks and sessions. Trellis's `.trellis/spec/` is meaningfully different.

The remaining caveat: Anthropic's own Claude Code (and Codex/Cursor) recommend ad-hoc CLAUDE.md / AGENTS.md / .cursorrules. Those are unstructured one-file conventions. Trellis is a **structured, multi-file, multi-domain** spec system on top of that — which is the differentiating angle.

### Which TB-2 Haiku 4.5 score should Trellis target as the baseline to beat?

Order of Haiku 4.5 scores on TB-2 from public data (Meta-Harness paper Table 7 + leaderboard):

1. **Meta-Harness on Haiku 4.5 → 37.6%** (auto-discovered harness, Stanford IRIS Lab).
2. Goose on Haiku 4.5 → 35.5%.
3. Claude Code, OpenHands, Terminus 2 on Haiku 4.5 — all in the 24–32% range based on filtered leaderboard views.

**Recommendation**: Use **Goose @ 35.5%** as the realistic baseline-to-beat for a *non-meta-search* harness; use **Meta-Harness @ 37.6%** as the SOTA-to-beat if Trellis claims compounding-spec gives a similar advantage to outer-loop harness search. Beating Meta-Harness on Haiku 4.5 with a pure spec-injection approach would be a strong narrative ("compounding human-curated specs ≥ automated harness search at the same scale").

For Opus 4.6, the goalposts are: Terminus 2 64.7% (vanilla), Terminus-KIRA 74.7%, Meta-Harness 76.4%, ForgeCode 81.8% (best public).

## Caveats / Not Found

- **Capy** vendor identity and design philosophy could not be determined from public web. They show up at 75.3% on Opus 4.6 but the org has no public GitHub or website surfaced in searches.
- **MAYA-V2** has no published technical writeup; only marketing claims and HuggingFace PR submissions.
- **ForgeCode Haiku 4.5** score: not verified — they don't seem to have submitted on Haiku 4.5.
- **Capy / Crux / Mux / TongAgents / Junie CLI / Droid / Letta Code / Goose** were name-dropped in leaderboard scans but were out of scope for deep dive.
- TB-2 leaderboard has a **leaderboard-integrity update** (rescored entries, cheating takedowns). All score numbers above are best-effort as of late 2026-04 captures and could shift.
- Specific Haiku 4.5 numbers below the top 3 are approximate (read off filter views; exact rounding may differ from official tbench.ai display).
