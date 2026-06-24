<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on Cursor (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps.

## Command surface (what is user-invocable vs internal)

Only a handful of Trellis entry points are meant for **manual `/` invocation**. Everything else is an **internal auto-triggered skill** — the agent loads it via the skill matcher or workflow routing, not by being called directly. Do **not** manually invoke internal skills through the slash palette.

- **User-invocable (manual)**: `/trellis-continue`, `/trellis-finish-work` (and `/trellis-start` when needed).
- **Internal auto-triggered (do NOT call manually)**: `trellis-brainstorm`, `trellis-before-dev`, `trellis-check`, `trellis-break-loop`, `trellis-update-spec`, `trellis-micro-grill`, `trellis-meta`, `trellis-spec-bootstrap`, `trellis-skill-creator`, `smart-search-cli`. These activate on their own when the workflow/skill matcher decides they fit.

## Web research routing (smart-search first)

For **any external / current / web fact**, run **`python ./.trellis/scripts/run_smart_search.py "<question>" --intent deep-research --json`** first. That script is the **only** Trellis web-research evidence entrypoint (it shells out to the `smart-search` CLI). Do not guess paths under package source trees or sibling repos. Platform built-in web tools (Cursor `WebSearch` / `WebFetch`, or native web tools elsewhere) are **downgrade-only fallbacks**, used solely when smart-search is unavailable (`doctor` not ok, status `not_configured` / `failed`, or search timeout). Do not reach for built-in web search while smart-search is healthy. On Cursor, `smart-search-cli` is an **internal workflow skill name** only (not shipped under `.cursor/skills/`); follow `.trellis/spec/guides/retrieval-daily-guide.md` and `.cursor/rules/retrieval-routing.mdc` for the executable contract.

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->
