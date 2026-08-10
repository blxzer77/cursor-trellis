# Cursor native modes — Prefer & orchestrate (don't replace)

> **Purpose**: Task-drive Cursor **Plan / Ask / Debug / Agent / Multitask** into Trellis phases and artifacts. Prefer native when callable; **quietly** fall back to the cstl spine when not. Do **not** reimplement modes or publish an “unsupported mode” list.
>
> **Product anchor**: `.cstl/workspace/cursor-trellis-product-positioning.md` (P1).
>
> **Design lock**: Parent `research/task-driven-modes-design-lock-2026-08-06.md`.
>
> **Evidence**: `{TASK}/research/cursor-modes-external.md`, `{TASK}/research/modes-callability-matrix.md`.
>
> **Rollback**: [Rollback](#rollback).

---

## Principle

| Layer | Duty |
| --- | --- |
| **Cursor native** | Plan / Ask / Debug / Agent / Multitask — **try task-driven use first** |
| **cstl spine** | Triage / Phase / gates / artifacts / Parent integration — **quiet fallback** when native cannot be driven well |

**Prefer native. Invent less.** Failures drop to existing cstl paths with little commentary — never a user-facing “本版本不适配某 mode” section.

---

## Prefer / Adapt table (mode × Trellis × artifacts)

| Cursor mode | Prefer when | Task-driven Prefer | Quiet cstl fallback | Durable artifacts |
| --- | --- | --- | --- | --- |
| **Ask** | Explain / lookup; **no** durable change | Prefer Ask UI / side chat when the user is already there; Agent cannot `SwitchMode`→Ask | In-session **No Task** behavior (read-only, no `task.py create` without consent) | None |
| **Plan** | Scope / design / tradeoffs before code | **Try `SwitchMode(plan)`**; after review, `SwitchMode(agent)` or Build; **Save to workspace** → map into task files | Keep writing `prd.md` / `design.md` / `implement.md` + `cstl-brainstorm` in Agent | Phase 1 files |
| **Agent** | Approved build / verify | Default; `SwitchMode(agent)` when returning from Plan | — | Diff, `verify.md`, gates |
| **Debug** | Repro / runtime / regressions | Prefer real Cursor Debug when the user/session can reach it | Evidence → `verify.md`; `cstl-break-loop` if looped | Notes / logs in `verify.md` |
| **Multitask** | Independent Parent children post-approval | Prefer `/multitask` / Build in Parallel / Agent `Task` background workers **when useful** | Explicit `.cstl/tasks/<dir>` prompts + Parent `integrate-child` | Child `verify`/`handoff`; Parent `task-map` |

### Phase quick map

```
Triage (No Task / Micro-Grill)  → Ask surface if present; else No Task in Agent
Phase 1                         → SwitchMode(plan) when useful; else write artifacts in Agent
Phase 2–3                       → Agent (+ workers when contracted)
Stuck / repeat failure          → Debug when reachable; else verify.md + break-loop
Parent parallel children        → Multitask / Task parallel when useful; Parent integrates
```

---

## Mode-specific contracts

### Ask ↔ No Task

- Official Ask does not edit files. Agent tools cannot switch into Ask.
- Classify **No Task** for pure Q&A; no task creation without consent.
- Side chats (3.11) complement Ask during Agent runs — still not Trellis artifacts.

### Plan ↔ Phase 1

- Prefer **`SwitchMode(plan)`** for design-heavy Phase 1; care about switch-back quality.
- Default plan save = **home directory** — **Save to workspace**, then map to `{TASK}/prd.md`, `design.md`, `implement.md`.
- Does **not** skip `start-execution --check` / execution approval.
- If Plan switch or save flow is poor: **quietly** author the same files in Agent.

### Debug ↔ evidence

- Prefer Cursor Debug instrumentation when reachable.
- Always land proof in **`verify.md`**. Contract change → Return-to-Planning.

### Multitask ↔ Parent/Child

1. Trellis remains source of truth for status, gates, integration.
2. Prefer native parallel surfaces to support independent Children when they help isolation/throughput.
3. Every worker prompt includes **explicit `.cstl/tasks/<dir>`** — never rely on `selected_task`.
4. Parent alone `integrate-child`; no collision guarantee without worktrees + review.

---

## Callability (Agent tool table)

| Surface | Plan | Agent | Ask | Debug | Parallel Children |
| --- | --- | --- | --- | --- | --- |
| Agent `SwitchMode` | Yes → `plan` | Yes → `agent` | — | — | — |
| Agent `Task` / Multitask | — | workers | — | — | Prefer when useful |
| User / CLI modes | Plan UI / `/plan` | default | Ask UI / `/ask` | Debug UI | `/multitask`, Build in Parallel |

Details: `research/modes-callability-matrix.md`.

---

## What cstl must not claim

- Plans auto-save into `.cstl/tasks/`.
- Multitask inherits `selected_task` or exposes a stable programmatic mode API.
- Parallel agents cannot conflict without Trellis/worktree discipline.
- `SwitchMode` can open Ask or Debug.
- Shipping a parallel fake Plan/Ask/Debug product, or documenting gaps as “本版本不适配”.

---

## Dogfood / probes

| Mode | Minimum probe | Pass when |
| --- | --- | --- |
| **Plan** | Schema or live `SwitchMode(plan)` note in verify | Prefer path documented; quiet Agent fallback if unused |
| **Ask / Debug** | Callability matrix | Quiet spine behavior; no “不适配” section |
| **Multitask** | Task parallel or doc contract | Explicit child paths; Parent integrates |
| **Agent** | Session implements under contract | Artifacts on disk |

---

## Rollback

Docs + rules only:

1. Delete `.cursor/rules/cstl-cursor-modes.mdc` and `.cstl/framework/cursor-native-modes-guide.md`.
2. Drop related `guides/index.md` / `workflow.md` rows, or `cstl update` from pre-P1 templates.
3. **cursor-trellis**: revert this Child’s tip or delete mirrored template paths.

---

## Related

- `{TASK}/research/modes-callability-matrix.md`
- `{TASK}/research/cursor-modes-external.md`
- `.cursor/rules/cstl-cursor-modes.mdc`
- `.cstl/framework/cursor-subagent-policy.md`
