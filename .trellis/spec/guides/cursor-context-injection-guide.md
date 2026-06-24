# Cursor Context Injection Guide

> **Purpose**: Know which Cursor injection channels actually reach the model, and route Trellis content accordingly. Most "agent ignored my instructions" failures on Cursor are channel-routing bugs, not wording problems.

---

## The channel matrix (verified 2026-06-19)

Cursor has **four** channels that can put text in front of the model. They are **not** equally reliable:

| Channel | How it loads | Reliable on Cursor? | Trellis content here |
|---|---|---|---|
| `.cursor/rules/*.mdc` (`alwaysApply: true`) | Prepended before **every** prompt, independent path | ✅ **Yes** | `trellis-triage.mdc` (Request Triage hard gate), `retrieval-routing.mdc` (codebase retrieval tool matrix) |
| `AGENTS.md` (repo root + nested) | Read automatically, treated as an always-on rule | ✅ **Yes** | smart-search-first rule, command surface, remote policy (the `<!-- TRELLIS:START -->` block), fallback CLI for retrieval plan |
| `sessionStart` hook → `additional_context` | Hook fires, JSON parsed... **but content never reaches the model's system context** | ❌ **No (confirmed bug)** | workflow.md Phase Index + Task Dashboard + first-reply notice |
| `beforeSubmitPrompt` hook → `additional_context` | Hook fires (when Cursor invokes it), JSON parsed... **but content never reaches the model** (L1: event often not fired; L2: additional_context not delivered) | ❌ **No (confirmed 2026-06-24, BYOK+Native probe)** | telemetry-only (side-channel log) |
| `.trellis/workflow.md` (read on demand) | Only if the agent explicitly runs `get_context.py` or reads the file | ⚠️ Depends on agent taking action | Full Request Triage section, Task Ladder, workflow-state breadcrumbs |
| **`task.py generate-dispatch-prompt` → Task `prompt`** (CLI Layer 2) | Main session runs Trellis script before `Task(...)` | ✅ **Yes (primary for subagent task context on Cursor)** | Full embed: marker, `Selected task:`, prd/jsonl/spec bodies |

**Key takeaway**: anything that must reach the model **every turn without the agent choosing to load it** must live in `.cursor/rules` or `AGENTS.md`. Subagent task context on Cursor uses **CLI Layer 2** before Task dispatch; `preToolUse` hook injection is best-effort only (see forum reports + 2026-06-22 spike). Anything in `workflow.md` that depends on `sessionStart` injection is **invisible to Cursor agents** until the bug is fixed.

---

## The sessionStart bug (why this guide exists)

- **Bug**: Cursor forum #158452 — `sessionStart` hook `additional_context` is executed and JSON-parsed correctly, but the value is **never added to the agent's initial system context**.
- **Status**: Confirmed by Cursor team (deanrie), internal bug filed, **no ETA** as of 2026-06-19.
- **Scope**: Affects `sessionStart` and `postToolUse` `additional_context` on Cursor IDE. The `env` field of the same hook **does** work (separate storage path). Claude Code / OpenCode `sessionStart.additionalContext` is unaffected.
- **Symptom**: hook runs (verifiable via side-channel log), valid JSON emitted, but the agent has zero awareness of the injected text (e.g. won't say a first-reply notice phrase).

### How to diagnose "is sessionStart injection actually reaching the model?"

1. **First-reply-notice test**: put a `<first-reply-notice>` in the sessionStart payload asking the agent to say a specific phrase on its first reply. If the agent doesn't say it → injection failed.
2. **Side-channel trace**: write a line to a logfile at the top of the hook's `main()`. If the line appears → hook executed. Combined with the first-reply test failing → confirms the "hook ran but content discarded" pattern.
3. **Marker probe**: inject a unique marker string (`CURSOR_HOOK_REPRO_MARKER_...`) into `additional_context`, then ask the agent if it sees the marker.

---

## Trellis routing rules on Cursor

Because of the bug, Trellis routes content by reliability on Cursor:

| Trellis content | Where it lives | Why |
|---|---|---|
| **Request Triage hard gate** (classify every turn, emit `[Triage: <Mode>]`) | `.cursor/rules/trellis-triage.mdc` (`alwaysApply: true`) | Must be visible every turn; sessionStart path is broken |
| **smart-search-first web routing** | `AGENTS.md` (TRELLIS:START block) | AGENTS.md is a reliable always-on channel |
| **Command surface** (what's user-invocable vs internal skill) | `AGENTS.md` (TRELLIS:START block) | Same |
| **Workflow phases, Task Ladder, workflow-state breadcrumbs** | `.trellis/workflow.md` | Loaded on demand via `get_context.py` / `trellis-start` / `trellis-continue`; NOT auto-injected on Cursor |

**If a new "must-always-be-visible" rule is added to Trellis**: ship it as a `.cursor/rules/*.mdc` (Cursor) — do **not** rely on adding it to `workflow.md` and expecting sessionStart to deliver it.

---

## When to update this guide

- Cursor ships a fix for forum #158452 → mark the sessionStart row as "✅ Yes (fixed in version X)" and re-evaluate whether workflow.md content can move back to sessionStart-only.
- Cursor fixes `beforeSubmitPrompt` L1 trigger reliability and L2 `additional_context` delivery → run new marker probe, update the matrix row, and re-enable plan injection in `inject-retrieval-plan.py`.
- A new Cursor injection channel appears → add a row to the matrix.
- Trellis adds a new `.cursor/rules/*.mdc` → add a row to the routing table.

---

## Related

- `cursor-subagent-policy.md` — Task tool scenes, model routing (this guide is about **context injection**, that one is about **subagent dispatch**).
- `.trellis/workflow.md` → `### Request Triage` — the full Triage decision tree (the rule in `.cursor/rules/trellis-triage.mdc` is the slim always-apply version pointing here).
- Task `06-19-cursor-rules-triage` (archive) — the investigation that produced this guide.
- Cursor forum thread: https://forum.cursor.com/t/sessionstart-hook-additional-context-is-never-injected-into-agents-initial-system-context/158452
