# Subagent Dispatch

English | [简体中文](subagents.zh-CN.md)

This document covers the **subagent dispatch design** in Trellis on Cursor: the three `trellis-*` subagents, the four dispatch Methods, the Native vs BYOK model routing split, and the `cstl-check` dual-form decision.

## Why subagents

The main chat session compacts over time — context is volatile. Subagents solve two problems:

1. **Persistent research** — `cstl-research` writes findings to `{TASK}/research/<topic>.md`. Files survive compaction; the main session reads them next turn instead of re-deriving.
2. **Isolated execution** — `cstl-implement` and `cstl-check` run in their own context window with a recursion guard, so the main session's context is not polluted by implementation detail.

Subagents are **not** a parallelism mechanism by default. They are spawned by the main session via the `Task` tool, one at a time, with explicit dispatch prompts. Parent/Child task trees are the parallelism mechanism — see [task-system.md](task-system.md).

## The three subagents

| Agent | Definition | Tools | Model policy | Recursion guard |
| --- | --- | --- | --- | --- |
| `cstl-research` | `cursor/agents/cstl-research.md` | Read, Write, Glob, Grep, Bash, WebSearch, WebFetch, Exa, Skill, Chrome DevTools | No `model:` frontmatter → **inherit** parent session; main session may apply a one-shot `model:` overlay, run `Task`, then strip it | None (may recurse for deep research, but should report up when more parallel work is needed) |
| `cstl-implement` | `cursor/agents/cstl-implement.md` | Read, Write, Edit, Bash, Glob, Grep, Exa | Same inherit + overlay policy | **Hard guard**: must not spawn another `cstl-implement` or `cstl-check`. `No git commit allowed` — implement does not commit |
| `cstl-check` | `cursor/agents/cstl-check.md` | Read, Write, Edit, Bash, Glob, Grep, Exa | Same inherit + overlay policy | **Hard guard**: must not spawn another `cstl-check` or `cstl-implement`. May self-fix code and record gates |

### Entry points & Context source (since 0.2.8)

Each `trellis-*` agent definition opens with two standardized sections that make the dispatch contract explicit:

- **Entry points** — lists the three ways the agent can be reached:
  1. **Agent session** — a chat started directly in the agent's name (rare for `trellis-*`).
  2. **Task dispatch** — the main session spawns the agent via the `Task` tool with a CLI-generated Layer 2 dispatch prompt (the **primary** path for `cstl-implement` / `cstl-check`).
  3. **Skill form** — the agent runs as an inline skill in the main session without a separate context window (`cstl-check` skill, `cstl-research` skill).
- **Context source** — declares **CLI Layer 2 dispatch** (`generate_dispatch_prompt.py` → `Task` tool `prompt`) as the **primary and guaranteed** context channel. `sessionStart.additional_context` and `preToolUse` hooks are **best-effort only**:
  - Cursor issue #158452 makes `sessionStart.additional_context` unreliable.
  - The agent definition body does **not** reliably enter the subagent system prompt under Cursor 3.8.22.
  - When only hook-injected context is available, treat the agent as undersupplied and request a Layer 2 dispatch prompt.

This standardization means the main session can trust that a properly dispatched `trellis-*` agent received its `prd` / `spec` / `research` bundle via Layer 2, regardless of whether hooks fired.

### Dispatch contracts

- **`cstl-research`** — spawned for dedicated `research/<topic>.md` files. External facts route to `smart-search-cli` + Bash first; Cursor web tools only on documented fallback (`doctor` not ok / timeout). Returns file paths + one-line summaries, not full content.
- **`cstl-implement`** — spawned in Phase 2.1 to do implementation work **when the approved contract has `execution_mode: worker`**. Reads `prd.md` / `design.md` / `implement.md` + `implement.jsonl` manifest. Cannot commit; the main session commits after check passes.
- **`cstl-check`** — spawned for an independent quality review pass **when the approved contract has `execution_mode: worker`**. Reads task artifacts + `check.jsonl`. May fix issues directly and record `record-gate` results. Does not redefine Parent `task-map` or gate semantics.

### `execution_mode` and dispatch (since 0.2.7)

The approved Development Strategy Contract in `implement.md` decides **who** implements and checks. Spawn `cstl-implement` / `cstl-check` agents only when `execution_mode: worker`.

| `execution_mode` | Who implements | Who checks | Spawn `cstl-implement` / `cstl-check` agents? |
| --- | --- | --- | --- |
| `inline` | Main session | Main session (`cstl-check` skill form or inline review) | No (unless you explicitly re-negotiate the contract) |
| `worker` | `cstl-implement` agent | `cstl-check` agent | Yes (CLI Layer 2 dispatch prompt + `Task`) |
| `child-task` | Child session | Child/Parent orchestration | Main session does not replace Child delivery |

Use `task.py suggest-execution-strategy <task-dir>` during planning to get a data-driven suggestion before freezing the YAML. See [task-system.md](task-system.md) and the `execution-strategy.md` spec guide.

### Context loading protocol

Context reaches a subagent via **two paths**; the `<!-- cstl-hook-injected -->` marker is the signal that context is already embedded:

- **Primary: CLI Layer 2** — the main session calls `task.py generate-dispatch-prompt` (or the hook below calls `build_dispatch_prompt_for_agent`) before spawning. This pre-embeds `prd` / `spec` / `research` into the dispatch prompt and prepends the marker.
- **Best-effort: `preToolUse` hook** — `inject-subagent-context.py` (matcher `Task|Subagent`) checks if the marker is already present; if so it skips, otherwise it injects the same context bundle.

All three agents look for the marker in their input:

- **Marker present** — `prd` / `spec` / `research` files already auto-loaded above; proceed directly.
- **Marker absent** — neither path fired (`--continue` resume, fork distribution, hooks disabled, `/multitask` parallel dispatch). The agent resolves the selected task path from the dispatch prompt's first line `Selected task: <path>`, then reads `implement.jsonl` / `check.jsonl` and the listed files, then `prd.md` / `design.md` / `implement.md`.

This fallback makes dispatch robust even when the `preToolUse` hook does not fire (Cursor 3.8.22 has a known issue where the `preToolUse` hook does not fire for the `Task` tool, but CLI Layer 2 does not depend on the hook, so the primary path still carries the marker). The mechanism is identical for Native and BYOK — it is orthogonal to model routing.

## Dispatch Methods 1–4

How the main session routes work to a subagent depends on the Cursor environment and the desired model control.

| Method | Environment | Use case | Model control | Reversible |
| --- | --- | --- | --- | --- |
| **1 Inherit** | Native + BYOK | Default. Subagent inherits the parent session's model | None — no `model:` frontmatter | N/A (no change) |
| **2 Explore + custom model** | Native + BYOK | Read-only exploration with an independent model via the Cursor++ panel | Per-dispatch one-shot `model:` overlay on the agent file, run `Task`, then strip | Yes (overlay is temporary) |
| **2.5 BYOK json5 patch** | Cursor++ BYOK only | BYOK users need per-`trellis-*`-type model routing that frontmatter/Settings UI cannot provide | `patch_wpelc8.py` patches `extension.js` to map `subagentType` → BYOK slug; reads `~/.ccursor/trellis-task-models.json5` (primary/fallback) | Yes (patch is reversible; re-run to restore) |
| **3 Manual** | Native + BYOK | Main session prepares the prompt, user opens a new chat and manually selects the model | User-driven | N/A |
| **4 Ephemeral** | Native only | Temporary `model:` frontmatter change for one dispatch | Edit frontmatter, dispatch, restore | Yes (restore after) |

**Method 2.5** exists because of a hard BYOK limitation: under Cursor++ BYOK, the frontmatter `model:` field and the Cursor Settings per-agent model UI **do not route** for custom `trellis-*` subagent types. The only reliable channel is patching the resolver. The `cstl-cursor2plus-setup` bundled skill automates this — see [skills.md](skills.md). Native Cursor API users do not need Method 2.5; frontmatter and Settings UI both work.

## Native vs BYOK model routing

| Capability | Native Cursor API | Cursor++ BYOK |
| --- | --- | --- |
| Agent frontmatter `model:` | ✅ Effective | ❌ Ignored for `trellis-*` types |
| Cursor Settings per-agent model UI | ✅ Effective | ❌ Does not populate `subagentModelOverrides` |
| Task subagent (`trellis-*`) model | ✅ Frontmatter or Settings | ❌ Without Method 2.5, inherits parent session model |
| Method 2.5 patch | Not needed | ✅ Required for per-type routing |

Environment detection: `TRELLIS_CURSOR_BYOK=0|1` env var or `~/.ccursor/routes.json` `byokMode`. The `cstl-cursor2plus-setup` skill reads this to decide whether to offer the patch.

## `cstl-check` dual-form decision

`cstl-check` is the only name with both a skill form and an agent form. When to use which:

| Signal | Use skill form (inline) | Use agent form (spawn) |
| --- | --- | --- |
| Change size | Small, single-file | Multi-file, cross-layer |
| Review independence | Main session self-reviews | Dedicated review pass, fresh context |
| Self-fix | Not needed (just report) | Needed (agent can edit) |
| Gate recording | Main session records | Agent records `record-gate` |
| `workflow.md` guidance | Default for inline `in_progress` | "Prefer the Agent form when verifying after code changes" |

The agent form has a hard recursion guard — it cannot spawn another `cstl-check` or `cstl-implement`. If it finds work that needs implementation, it reports the recommendation up to the main session.

## Parent/Child dispatch and integration authority

When a Parent task orchestrates Child tasks, dispatch authority is split:

- **Child workers** — spawned via `cstl-implement` (or inline on the Child's own session). Report progress with `task.py set-child-state`: `open` / `working` / `blocked` / `review`. Child workers **cannot** mark themselves `changes` / `accepted` / `integrating` / `integrated` / `cancelled` — only the Parent has integration authority.
- **Parent** — uses `task.py prepare-child-worktree` and `task.py integrate-child` with states `changes` / `accepted` / `integrating` / `integrated` / `cancelled`. Default `merge_limit: 1` blocks more than one Child from being `integrating` simultaneously. Integration is serial Git-ref integration: every decision respects `merge_limit: 1` and writes conflicts, merge decisions, and acceptance rationale to `task-map.md` Event Log.
- **Reviewer orchestration** — Parent sessions can productize child dispatch and review inline:

  ```bash
  python ./.trellis/scripts/task.py parent-status <parent-task>
  python ./.trellis/scripts/task.py generate-child-prompt <parent-task> <child-task> --mode inline
  python ./.trellis/scripts/task.py review-child <parent-task> <child-task> --check
  python ./.trellis/scripts/task.py review-child <parent-task> <child-task> --decision accept --ref <child-ref>
  python ./.trellis/scripts/task.py review-child <parent-task> <child-task> --decision integrate-through --ref <child-ref>
  ```

  `--mode subagent` is only a delivery hint when the platform can spawn subagents; inline mode is the portable default.

See [task-system.md](task-system.md) for the full Parent/Child lifecycle.

## Common dispatch scenarios

The table below maps common task situations to the recommended dispatch choice. These are defaults, not hard rules — adjust when the task profile clearly differs.

| Situation | Recommended | Why |
| --- | --- | --- |
| Single-file fix, Lite task | Inline (no subagent) | Small blast radius; subagent overhead not worth it |
| Multi-file feature, Full task | `cstl-implement` Agent | When contract `execution_mode: worker`: isolated context; recursion guard prevents runaway |
| Need to research an unfamiliar module | `cstl-research` Agent | Persists findings to `research/<topic>.md`; main session reads summary |
| Quality check after small change | `cstl-check` skill (inline) | Fresh context not needed; main session self-reviews |
| Quality check after multi-file change | `cstl-check` Agent | When contract `execution_mode: worker`: fresh context; self-fix capability; independent review |
| External fact lookup (API version, docs) | `smart-search-cli` skill | CLI-first; Cursor WebSearch only as fallback |
| Stuck on same bug repeatedly | `cstl-break-loop` skill | Deep root-cause analysis; updates spec/guides |
| Parent with 3 independent deliverables | Parent + 3 Child tasks | Each Child independently verifiable; Parent owns integration |
| BYOK user wants per-agent models | Method 2.5 (`patch_wpelc8.py`) | frontmatter/Settings UI do not route `trellis-*` under BYOK |
| Native user wants per-agent models | Method 4 (ephemeral frontmatter) | frontmatter effective on Native; no patch needed |

## Failure modes and fallbacks

Subagent dispatch can fail in several ways. The system is designed to degrade gracefully:

| Failure | Symptom | Fallback |
| --- | --- | --- |
| `preToolUse` hook does not fire (Cursor 3.8.22) | `<!-- cstl-hook-injected -->` marker absent | Agent reads `implement.jsonl` / `check.jsonl` + task artifacts manually from `Selected task: <path>` |
| `smart-search` doctor not ok | External search unavailable | `cstl-research` falls back to Cursor `WebSearch`/`WebFetch`, persists with `source: cursor-web-fallback` |
| BYOK patch not applied | `trellis-*` subagents inherit parent model | Method 2.5 patch required; run `cstl-cursor2plus-setup` skill |
| Subagent recursion attempt | `cstl-implement`/`cstl-check` tries to spawn another | Hard guard blocks; agent reports recommendation up to main session |
| Task artifact missing | `prd.md` / `design.md` / `implement.md` not found | Agent cannot proceed; reports missing artifact, main session must re-plan |

The marker-based fallback for hook injection is the most important: it makes the system robust to Cursor platform changes without requiring a code fix in Trellis.

## Model overlay workflow (Methods 2 and 4)

Methods 2 and 4 both rely on a **one-shot `model:` overlay** on the agent file. The workflow is identical; the difference is only whether the overlay is on the agent file (Method 2, BYOK-compatible via Cursor++ panel) or a temporary frontmatter edit (Method 4, Native only).

Step-by-step:

1. **Read the current agent file** — confirm no `model:` field exists (default is inherit).
2. **Write the overlay** — insert `model: <desired-model>` into the frontmatter. This is a temporary edit, not a permanent change.
3. **Dispatch** — spawn the subagent via the `Task` tool with the dispatch prompt. The first line must be `Selected task: <path>` so the agent can resolve context if the hook marker is absent.
4. **Strip the overlay** — remove the `model:` line from the frontmatter immediately after the `Task` call returns. This restores the default inherit behavior for subsequent dispatches.
5. **Verify** — read the agent file to confirm the frontmatter is back to its original state.

**Why strip?** If the overlay persists, every subsequent dispatch of that agent type uses the overlay model, which defeats the per-dispatch intent and can surprise the user. The strip step is non-negotiable.

**Method 2.5 vs overlay:** Method 2.5 (BYOK json5 patch) is different — it patches the resolver itself, not the agent file. Once applied, it routes all dispatches of that `trellis-*` type to the configured slug until the patch is reversed. Use Method 2.5 when you want persistent per-type routing under BYOK; use overlay (Method 2/4) when you want per-dispatch routing.

## See also

- [Internal skills](skills.md) — the 11 auto-triggered skills, including the `cstl-check` skill form
- [Task system design](task-system.md) — Phase 1–3 lifecycle, gates, Parent/Child task trees
- [Cursor integration](cursor.md) — environment detection, Method 2.5 detail, hooks
- [Workflow in Cursor](workflow.md) — the Phase 2.1/2.2/3.1 steps that trigger dispatch
- [Retrieval layer](retrieval.md) — how `cstl-research` routes external facts to `smart-search-cli`
