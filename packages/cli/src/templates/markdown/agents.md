<!-- CSTL:START -->
# Cursor-Trellis (cstl) Instructions

These instructions are for AI assistants working in this project.

This project is managed by cursor-trellis. The working knowledge you need lives under `.cstl/`:

- `.cstl/workflow.md` — human overview of phases and skill routing (not runtime SSOT). Parallel first (convention, not a CLI gate). Personal Lite: Open→Close without Parent/Git; Full Quality: `required_controls` + AC ledger + graded Check; Topology/On-demand: Rigor × Topology, `task-map` is a graph projection; Adapter/Middleware: Event Bridge + four retrieval intents + independent smart-search Provider; user overlay `.cstl/middleware/` is never touched by `cstl update`; prefer `get_context.py --mode lite` for Lite
- `.cstl/framework/middleware-protocol.md` — Middleware Protocol v1 (one ABI; Manifest sample)
- `.cstl/framework/upgrade.md` — terminal-user upgrade half-page
- `.cstl/framework/release-boundary.md` — CSTL this-batch ship vs independent cstl-byok ship
- `.cstl/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.cstl/workspace/` — per-developer journals and session traces
- `.cstl/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a cstl command is available on Cursor (e.g. `cstl-finish-work`, `cstl-continue`), prefer it over manual steps.

## Command surface (what is user-invocable vs internal)

Only a handful of Trellis entry points are meant for **manual `/` invocation**. Everything else is an **internal auto-triggered skill** — the agent loads it via the skill matcher or workflow routing, not by being called directly. Do **not** manually invoke internal skills through the slash palette.

- **User-invocable (manual)**: `cstl-continue`, `cstl-finish-work` (and `cstl-start` when needed).
- **Internal auto-triggered (do NOT call manually)**: `cstl-brainstorm`, `cstl-before-dev`, `cstl-check`, `cstl-break-loop`, `cstl-update-spec`, `cstl-micro-grill`, `cstl-meta`, `cstl-spec-bootstrap`, `cstl-skill-creator`, `smart-search-cli`. These activate on their own when the workflow/skill matcher decides they fit.

## Skill authoring (mandatory)

When **creating** or making a **behavioral/structural** change to a Trellis bundled skill, a `blaze-skills` skill, or a harness skill, **first Read** `cstl-skill-creator` and follow its workflow + `references/review-checklist.md`. Do not hand-write around it. **Skip** for typo / pure link fixes. This skill is **internal** (not a user `/` command). **Does not apply** to Cursor product skills (e.g. `~/.cursor/skills-cursor/create-skill`). Load paths: see `.cstl/framework/internal-skills-cursor-reachability.md` (`cstl-skill-creator` row).

## Invocation map (short)

| Intent | Use | Do not |
| --- | --- | --- |
| Session handoff | `/cstl-handoff` → report temp path | task `handoff.md`; ad-hoc workspace handoff |
| Durable objective | official Cursor `/goal` | restore `cstl-goal`; treat as Parent/Child or a Trellis task type |
| User slash surface | only listed `/cstl-*` commands | assume internal skills are slash commands |
| Internal skills (brainstorm, …) | workflow says load → Read documented path (see guides); not user slash | claim loaded with no file read |

Commands-only: internal skills stay **out of** the `/` palette by design; they must still be **reachable** via documented on-demand paths (not "missing from the framework").

## Internal skill reachability (on-demand)

Internal auto-triggered skills are **not** shipped to `.cursor/skills/` and have **no** default slash command. When the workflow routes to one, load its body by reading a documented path — do **not** claim it is loaded without a file read.

- PRD Grill / brainstorm discipline → **`Read .cstl/framework/prd-grill-frontier.md`** (SSOT: bundled `common/skills/brainstorm.md`).
- Skill authoring (new / structural) → **must Read** bundled `cstl-skill-creator/SKILL.md` then `references/review-checklist.md` (paths in `internal-skills-cursor-reachability.md`). Not a slash command.
- Full skill × load-channel matrix → **`Read .cstl/framework/internal-skills-cursor-reachability.md`**.
- Dogfood-only install surfaces (never shipped by default) → **`Read .cstl/framework/dogfood-only-surfaces.md`**.

## Durable objectives (official /goal)

For a persistent in-session objective, use Cursor's official `/goal`. That is **not** a Trellis task type and **not** Parent/Child. Do **not** restore or invent `cstl-goal` / `cstl goal`.

Default install is **Native Cursor**. CSTL does **not** embed BYOK (no install-time BYOK; an optional independent track stays outside this package).

## Web research routing (smart-search first)

For **any external / current / web fact**, use the independent **smart-search** Provider (`smart-search` CLI when installed). Maintainer installs may still have `run_smart_search.py`; it is not Baseline. Platform built-in web tools are **downgrade-only fallbacks**. Follow `.cstl/framework/retrieval-daily-guide.md`.

**External-knowledge gate:** If the answer would be wrong because the **world or a third-party API moved** and that matters → use smart-search (cheap `docs` / `broad-search` when enough; `deep-research` when multi-source). If truth lives only in this workspace → do not default to web. When unsure, prefer a cheap probe over guessing. See `.cstl/framework/retrieval-daily-guide.md` § External-knowledge gate.

Managed by cursor-trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `cstl update`.

<!-- CSTL:END -->
