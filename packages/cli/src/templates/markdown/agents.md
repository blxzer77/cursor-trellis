<!-- CSTL:START -->
# Cursor-Trellis (cstl) Instructions

These instructions are for AI assistants working in this project.

This project is managed by cursor-trellis. The working knowledge you need lives under `.cstl/`:

- `.cstl/workflow.md` — development phases, when to create tasks, skill routing
- `.cstl/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.cstl/workspace/` — per-developer journals and session traces
- `.cstl/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a cstl command is available on Cursor (e.g. `cstl-finish-work`, `cstl-continue`), prefer it over manual steps.

## Command surface (what is user-invocable vs internal)

Only a handful of Trellis entry points are meant for **manual `/` invocation**. Everything else is an **internal auto-triggered skill** — the agent loads it via the skill matcher or workflow routing, not by being called directly. Do **not** manually invoke internal skills through the slash palette.

- **User-invocable (manual)**: `cstl-continue`, `cstl-finish-work` (and `cstl-start` when needed).
- **Internal auto-triggered (do NOT call manually)**: `cstl-brainstorm`, `cstl-before-dev`, `cstl-check`, `cstl-break-loop`, `cstl-update-spec`, `cstl-micro-grill`, `cstl-meta`, `cstl-spec-bootstrap`, `cstl-skill-creator`, `smart-search-cli`. These activate on their own when the workflow/skill matcher decides they fit.

## Goal runtime (not a task type)

**Goal** here means the **CLI subsystem** `cstl goal` (preflight → accept → run / pause / status / review), not a Task Ladder type and not Parent/Child orchestration.

- Prefer: `cstl goal status` / `cstl goal preflight …` in the project terminal.
- Do **not** invent a "goal" task kind or map "use goal" onto `add-subtask` / Parent-only planning.
- Default Cursor install has **no** `/cstl-goal` slash command (optional dogfood/extension only).
- Task directory `handoff.md` = child integration evidence; session handoff = `/cstl-handoff` (temp file).

## Invocation map (short)

| Intent | Use | Do not |
| --- | --- | --- |
| Session handoff | `/cstl-handoff` → report temp path | task `handoff.md`; ad-hoc workspace handoff |
| Goal runtime | `cstl goal status\|preflight\|run\|…` | Parent/Child as "goal"; invent goal task type |
| User slash surface | only listed `/cstl-*` commands | assume internal skills are slash commands |
| Internal skills (brainstorm, …) | workflow says load → Read documented path (see guides); not user slash | claim loaded with no file read |

Commands-only: internal skills stay **out of** the `/` palette by design; they must still be **reachable** via documented on-demand paths (not "missing from the framework").

## Internal skill reachability (on-demand)

Internal auto-triggered skills are **not** shipped to `.cursor/skills/` and have **no** default slash command. When the workflow routes to one, load its body by reading a documented path — do **not** claim it is loaded without a file read.

- PRD Grill / brainstorm discipline → **`Read .cstl/spec/guides/prd-grill-frontier.md`** (SSOT: bundled `common/skills/brainstorm.md`).
- Full skill × load-channel matrix → **`Read .cstl/spec/guides/internal-skills-cursor-reachability.md`**.
- Dogfood-only install surfaces (never shipped by default) → **`Read .cstl/spec/guides/dogfood-only-surfaces.md`**.

## Web research routing (smart-search first)

For **any external / current / web fact**, run **`python ./.cstl/scripts/run_smart_search.py "<question>" --intent deep-research --json`** first. That script is the **only** Trellis web-research evidence entrypoint (it shells out to the `smart-search` CLI). Do not guess paths under package source trees or sibling repos. Platform built-in web tools (Cursor `WebSearch` / `WebFetch`, or native web tools elsewhere) are **downgrade-only fallbacks**, used solely when smart-search is unavailable (`doctor` not ok, status `not_configured` / `failed`, or search timeout). Do not reach for built-in web search while smart-search is healthy. On Cursor, `smart-search-cli` is an **internal workflow skill name** only (not shipped under `.cursor/skills/`); follow `.cstl/spec/guides/retrieval-daily-guide.md` and `.cursor/rules/retrieval-routing.mdc` for the executable contract.

**External-knowledge gate:** If the answer would be wrong because the **world or a third-party API moved** and that matters → use smart-search (cheap `docs` / `broad-search` when enough; `deep-research` when multi-source). If truth lives only in this workspace → do not default to web. When unsure, prefer a cheap probe over guessing. See retrieval-daily-guide § External-knowledge gate.

Managed by cursor-trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `cstl update`.

<!-- CSTL:END -->
