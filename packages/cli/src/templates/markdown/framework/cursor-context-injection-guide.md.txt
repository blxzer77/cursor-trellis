# Cursor Context Injection Guide

> **Purpose**: Know which Cursor injection channels actually reach the model, and route Trellis content accordingly. Most "agent ignored my instructions" failures on Cursor are channel-routing bugs, not wording problems.

---

## The channel matrix (verified 2026-08-05, Cursor Native 3.8.x)

Cursor has **several** channels that can put text in front of the model. They are **not** equally reliable:

| Channel | How it loads | Reliable on Cursor? | Trellis content here |
|---|---|---|---|
| `.cursor/rules/*.mdc` (`alwaysApply: true`) | Prepended before **every** prompt, independent path | ✅ **Yes** | `cstl-triage.mdc` (Request Triage hard gate), `retrieval-routing.mdc`, `cstl-cursor-modes.mdc` (Prefer native modes) |
| `AGENTS.md` (repo root + nested) | Read automatically, treated as an always-on rule | ✅ **Yes** | smart-search-first rule, command surface (the `<!-- CSTL:START -->` block) |
| `sessionStart` hook → `additional_context` | Once per session; delivered via `hooks_context` | ✅ **Yes** (fixed — verified 2026-08-05; was #158452) | Task Dashboard, workflow Phase Index summary, first-reply notice |
| `beforeSubmitPrompt` hook → `additional_context` | Per user message; router would emit `## 代码库检索计划` | ❌ **No (telemetry-only since 2026-06-24)** | `inject-retrieval-plan.py` logs to `.cstl/.runtime/retrieval-plan-events.log`; **no injection** |
| `.cstl/workflow.md` (read on demand) | Only if the agent explicitly runs `get_context.py` or reads the file | ⚠️ Depends on agent taking action | Full Request Triage section, Task Ladder, workflow-state breadcrumbs |
| **`task.py generate-dispatch-prompt` → Task `prompt`** (CLI Layer 2) | Main session runs Trellis script before `Task(...)` | ✅ **Yes (primary for subagent task context on Cursor)** | Full embed: marker, `Selected task:`, prd/jsonl/spec bodies (budgeted — see [injection-budget-guide](./injection-budget-guide.md)) |

**Key takeaway**: anything that must reach the model **every turn** must live in `.cursor/rules` or `AGENTS.md`. `sessionStart` is reliable for **session-level** orientation (dashboard, workflow summary) but fires only once. Retrieval plans: use **Rules default tool order** or run `route_codebase_retrieval.py --instructions` on demand — do **not** rely on `beforeSubmitPrompt` injection. Subagent task context uses **CLI Layer 2** before Task dispatch.

---

## The sessionStart bug (#158452) — history and current status

- **Bug**: Cursor forum #158452 — `sessionStart` hook `additional_context` was executed and JSON-parsed correctly, but the value was **not added to the agent's initial system context** (through ~2026-06).
- **Status (2026-08-05)**: **Fixed** on Cursor Native 3.8.x — first-reply-notice probe passes; `hooks_context` contains full SessionStart payload. Re-verify after major Cursor upgrades.
- **Historical scope**: Also affected `postToolUse` `additional_context` on some builds. The `env` field of the same hook uses a separate storage path.
- **Routing implication**: Even with sessionStart working, **per-turn hard gates** (Triage, retrieval policy) stay in `.cursor/rules` — sessionStart fires only once per session.

### How to diagnose "is sessionStart injection actually reaching the model?"

1. **First-reply-notice test**: put a `<first-reply-notice>` in the sessionStart payload asking the agent to say a specific phrase on its first reply. If the agent doesn't say it → injection failed.
2. **Side-channel trace**: write a line to a logfile at the top of the hook's `main()`. If the line appears → hook executed. Combined with the first-reply test failing → confirms the "hook ran but content discarded" pattern.
3. **Marker probe**: inject a unique marker string (`CURSOR_HOOK_REPRO_MARKER_...`) into `additional_context`, then ask the agent if it sees the marker.

---

## Trellis routing rules on Cursor

Trellis routes content by reliability on Cursor:

| Trellis content | Where it lives | Why |
|---|---|---|
| **Request Triage hard gate** (classify every turn, emit `[Triage: <Mode>]`) | `.cursor/rules/cstl-triage.mdc` (`alwaysApply: true`) | Must be visible **every turn**; sessionStart is once-per-session |
| **Codebase retrieval policy** | `.cursor/rules/retrieval-routing.mdc` + `route_codebase_retrieval.py` | `beforeSubmitPrompt` injection is telemetry-only; Rules + router CLI |
| **Prefer Cursor native modes** (Plan/Ask/Debug/Agent/Multitask × Trellis) | `.cursor/rules/cstl-cursor-modes.mdc` + `cursor-native-modes-guide.md` | P1 orchestration; full table on demand in guide |
| **smart-search-first web routing** | `AGENTS.md` (CSTL block) | AGENTS.md is a reliable always-on channel |
| **Command surface** (what's user-invocable vs internal skill) | `AGENTS.md` (CSTL block) | Same |
| **Session orientation** (dashboard, workflow summary, first-reply notice) | `sessionStart` hook → `additional_context` | Reliable on Cursor 3.8.x+; session-level only |
| **Workflow phases, Task Ladder, workflow-state breadcrumbs** | `.cstl/workflow.md` + sessionStart summary | Full detail on demand via `get_context.py` / `cstl-continue` |

**If a new "must-always-be-visible" rule is added to Trellis**: ship it as a `.cursor/rules/*.mdc` (Cursor) — do **not** rely on `workflow.md` or sessionStart alone for per-turn enforcement. Run `injection_budget_probe.py` after adding rules (see [injection-budget-guide](./injection-budget-guide.md)).

---

## Injection budget (P0)

Per-channel caps and jsonl/Layer 2 limits are defined in **[injection-budget-guide](./injection-budget-guide.md)**. Summary from channel matrix (2026-08-06):

- **Per-turn:** C01 Rules + C02 AGENTS only (not C04).
- **Session once:** C03 sessionStart dashboard/workflow.
- **Subagent:** C06 Layer 2 with role `max_chars` + jsonl entry/file/total caps.
- **Retrieval:** C16 Rules + router CLI on demand.

Probe: `python ./.cstl/scripts/injection_budget_probe.py --repo-root .`

---

## When to update this guide

- Cursor major upgrade → re-run sessionStart first-reply-notice probe and update the matrix date.
- `beforeSubmitPrompt.additional_context` becomes reliable on a future build → re-enable injection in `inject-retrieval-plan.py` and update this guide.
- Trellis adds a new `.cursor/rules/*.mdc` → add a row to the routing table.

---

## Related

- `cursor-subagent-policy.md` — Task tool scenes, model routing (this guide is about **context injection**, that one is about **subagent dispatch**).
- `cursor-native-modes-guide.md` — Prefer Plan/Ask/Debug/Agent/Multitask; pairs with `cstl-cursor-modes.mdc`.
- `.cstl/workflow.md` → `### Request Triage` — the full Triage decision tree (the rule in `.cursor/rules/cstl-triage.mdc` is the slim always-apply version pointing here).
- Task `06-19-cursor-rules-triage` (archive) — the investigation that produced this guide.
- Cursor forum thread: https://forum.cursor.com/t/sessionstart-hook-additional-context-is-never-injected-into-agents-initial-system-context/158452
