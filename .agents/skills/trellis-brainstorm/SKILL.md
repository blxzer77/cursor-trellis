---
name: trellis-brainstorm
description: "Guides collaborative requirements discovery before implementation. Two-phase Cursor planning: Discovery Before Questions, PRD draft, then PRD Grill (document pass + micro-grill for blocking business questions). Use when requirements are unclear, multiple valid approaches exist, or the user describes a new feature or complex task."
---

# Trellis Brainstorm

## Non-Negotiable Interview Contract

Interview me relentlessly about every aspect of this plan until we reach a shared understanding. Walk down each branch of the design tree, resolving dependencies between decisions one-by-one. For each question, provide your recommended answer.

Ask the questions one at a time.

## Non-Negotiable Evidence Rule

If a question can be answered by exploring the codebase, explore the codebase instead.

This is mandatory. Before asking the user a question, first check whether the answer is already available in code, tests, configs, docs, existing specs, or task history.

Do not ask the user to confirm facts that the repository can answer. Ask only for product intent, preference, scope, risk tolerance, or decisions that remain ambiguous after inspection.

---

Use this skill during Phase 1 planning to turn the user's request into clear requirements and planning artifacts.

**Agent-capable platforms:** Do **not** use legacy Claude-only grill subagents as a hard gate. Complete **PRD Grill** (below) and **`trellis-micro-grill`** for blocking open questions before treating planning as ready for `design.md` / `implement.md` / `start-execution --check`.

## Preconditions

Use this skill only after task-creation consent has been given and the user is ready to enter Trellis planning.

If no task exists yet, create one:

```bash
TASK_DIR=$(python ./.trellis/scripts/task.py create "<short task title>" --slug <slug>)
```

Use a concise title from the user's request. Use a slug without a date prefix. `task.py create` adds the `MM-DD-` directory prefix automatically.

`task.py create` creates the default `prd.md`. Update that file with the current understanding before asking follow-up questions.

## Two-phase planning overview

| Phase | Name | User questions |
| --- | --- | --- |
| **A** | Discovery Before Questions + PRD draft | None until repo evidence is exhausted |
| **B** | PRD Grill pass + Micro-grill unresolved | Only blocking business / risk / preference |

External facts during Discovery or Research: load `smart-search-cli`; on CLI/doctor failure use Cursor WebSearch/WebFetch and persist under `{TASK}/research/` with `source: cursor-web-fallback`.

---

## Phase A — Discovery Before Questions

Run **before** any user interview questions.

Inspect and record in `prd.md` (sections: **Confirmed facts**, initial **Out of scope**, draft **Goal**):

1. **Code & tests** — relevant modules, fixtures, configs, error paths.
2. **Specs** — `.trellis/spec/` indexes and layer guides for touched packages.
3. **History** — archived tasks, active task research, developer journal when useful.
4. **Platform** — `.cursor/` hooks, agents, skills; shared `.agents/skills/` when behavior spans platforms.
5. **Parent/Child** — if multiple independent deliverables, note child split early in `prd.md`.

Use retrieval per `.trellis/spec/guides/retrieval-daily-guide.md` (rg for literals, codegraph for structure, fast-context for semantic sweep).

Dispatch **`trellis-research`** (writable Agent) when a topic needs a dedicated `{TASK}/research/<topic>.md` file; do **not** use a subagent for PRD Grill itself.

## Phase A — PRD draft

After Discovery, flesh out `prd.md`:

- goal and user value
- confirmed facts (not restated as unverified requirements)
- requirements
- draft acceptance criteria
- out of scope
- open questions (tag **blocking** vs **nice-to-have**)

For complex tasks, start `design.md` / `implement.md` skeletons only when boundaries are already clear from Discovery; otherwise wait until Phase B.

## Phase B — PRD Grill pass

Treat `prd.md` (+ existing `design.md` fragments) as the **only document surface**. Run this checklist; fix the PRD in place (no new subagent):

| # | Check |
| --- | --- |
| 1 | **Goal & user value** — single clear statement |
| 2 | **Confirmed facts vs assumptions** — repo facts not listed as assumptions |
| 3 | **Testable acceptance criteria** |
| 4 | **Out of scope** explicit |
| 5 | **Dependencies & sequencing** |
| 6 | **Parent/Child & deliverables** when applicable |
| 7 | **Research & external facts** — smart-search or documented fallback |
| 8 | **Execution gate & artifacts** — `design.md` / `implement.md` / `verify.md` expectations |
| 9 | **Durable Learning** — Phase 3.3 will need `update-spec` \| `no-update` \| `unsure` |
| 10 | **Platform** — Cursor-first; PRD Grill in-session (no legacy grill-me / grill-with-docs subagent gate) |
| 11 | **Risk & rollback** for complex tasks |
| 12 | **Open questions** — only **blocking** strategic/preference items remain |

## Phase B — Micro-grill unresolved

For each **blocking** open question after the checklist, embed the **`trellis-micro-grill` contract**:

- exactly **one** question per message
- **Simplified Chinese** for user-facing text
- recommended answer + trade-off
- **update `prd.md` after every answer** before the next question

Stop micro-grill when no blocking open questions remain.

Do not ask process questions ("should I search?"). Do not re-ask facts Discovery already confirmed.

## Question Rules (Phase B only)

Each question must include:

- the decision needed
- why the answer matters
- your recommended answer
- the trade-off if the user chooses differently

## Artifact Rules

`prd.md` records requirements and acceptance:

- goal and user value
- confirmed facts
- requirements
- acceptance criteria
- out of scope
- open questions that still block planning

`design.md` records technical design for complex tasks:

- architecture and boundaries
- data flow and contracts
- compatibility and migration notes
- important trade-offs
- operational or rollback considerations

`implement.md` records execution planning for complex tasks:

- ordered implementation checklist
- validation commands
- risky files or rollback points
- follow-up checks before `task.py start-execution --check`

Lightweight tasks may have only `prd.md`. Complex tasks must have `prd.md`, `design.md`, and `implement.md` before `task.py start-execution --check`.

`implement.md` is not a replacement for `implement.jsonl`. Use JSONL files only for manifest-style spec and research references when the task needs them.

## Completion criteria — PRD Grill done

Planning is ready for execution gate when **all** hold:

- PRD Grill checklist (12 items) satisfied or explicitly N/A with rationale in `prd.md`
- **No blocking** open questions in `prd.md`
- Acceptance criteria are testable; out of scope is explicit
- Complex tasks: `design.md` and `implement.md` present
- User reviewed artifacts or explicitly approved proceeding

Then proceed to Phase 1.2 Research (if needed), Phase 1.4 `task.py start-execution --check`, and implementation only after user approval.

Do not start implementation until the user approves or asks for implementation.

## Legacy planning flow (summary)

The former single "Planning Flow" is now Phase A + B above. Steps 4–6 map to Phase B micro-grill and artifact updates.