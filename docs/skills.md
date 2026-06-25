# Internal Skills

English | [简体中文](skills.zh-CN.md)

This document is the complete reference for Trellis **internal skills** on Cursor: what they are, how they differ from subagents and commands, when each one fires, and why none of them appear in the `/` command palette.

## What internal skills are

Trellis internal skills are role-scoped instruction bundles that activate **automatically** when the workflow matcher decides they fit a turn — the agent loads them on demand, the user does not invoke them via `/`. They encode the procedural parts of the Trellis lifecycle: planning grills, pre-development reading, quality checks, bug retrospectives, spec updates, meta-customization, and web research.

The canonical auto-triggered list lives in `AGENTS.md` (generated from `markdown/agents.md` in the template tree). On Cursor, the `commands-only` policy means **internal skills are deliberately not written to `.cursor/skills/`** — the `/` palette stays small (only user-invocable commands like `/trellis-continue` appear), and skill semantics travel through `.cursor/rules` + `AGENTS.md` + `.trellis/workflow.md` instead. This is a product choice: deep integration on a single platform beats a sprawling skill palette.

## Skill vs Agent vs Command

Trellis defines three distinct role surfaces. Confusing them is the most common misunderstanding.

| Surface | Definition source | Activation | `/` palette | Examples |
| --- | --- | --- | --- | --- |
| **Internal Skill** | `templates/common/skills/*.md` (single-file) or `templates/common/bundled-skills/*/SKILL.md` (bundled) | Auto-triggered by workflow matcher | No | `trellis-brainstorm`, `trellis-micro-grill` |
| **Subagent** | `templates/cursor/agents/*.md` (frontmatter + system prompt) | Spawned by main session via `Task` tool | No | `trellis-research`, `trellis-implement`, `trellis-check` |
| **User Command** | `templates/common/commands/*.md` or `templates/cursor/commands/*.md` | Manually invoked by user via `/` | Yes | `/trellis-continue`, `/trellis-finish-work` |

Three forms inherit differently:

- **Single-file skill** — a `.md` with procedural instructions; no frontmatter, no tools list. Loaded inline by the main session.
- **Bundled skill** — a `SKILL.md` directory with frontmatter, optional `references/`, `examples/`, `agents/`. Richer structure for skills that need progressive disclosure.
- **Subagent** — frontmatter (`name`, `description`, `tools`) + system prompt; runs in its own context window via the `Task` tool. See [subagents.md](subagents.md).

## The 11 internal skills

### Single-file skills (5)

#### `trellis-brainstorm`

| | |
| --- | --- |
| **Definition** | `templates/common/skills/brainstorm.md` |
| **Triggers** | Phase 1 planning; `trellis-start` routes "new feature / unclear requirement"; no selected task yet |
| **Role** | Deep interview-style requirement clarification. Two-phase: **Phase A Discovery Before Questions** (exhaust repo evidence first — code, specs, history, platform — never ask the user what the repo can answer) → **Phase B PRD Grill** (12-item checklist on `prd.md` + micro-grill blocking open questions one at a time, each with a recommended answer) |
| **Produce** | `prd.md`, and for complex tasks `design.md` / `implement.md` skeletons |
| **Boundaries** | Does NOT spawn legacy grill subagents; PRD Grill is in-session. Dispatches `trellis-research` Agent only for dedicated `research/<topic>.md` files |

#### `trellis-before-dev`

| | |
| --- | --- |
| **Definition** | `templates/common/skills/before-dev.md` |
| **Triggers** | Phase 2.1 before writing code; `trellis-start` routes "about to write code"; selected task `status=in_progress` |
| **Role** | Mandatory pre-development reading: read task artifacts (`prd`/`design`/`implement`), discover packages via `get_context.py --mode packages`, identify applicable spec layers, read spec `index.md` and follow its **Pre-Development Checklist**, read specific guideline files the index points to (not just the index), always read `guides/index.md` |
| **Boundaries** | The index is a pointer, not the goal — this skill forces reading the actual guideline files. This step is mandatory before any code |

#### `trellis-check`

| | |
| --- | --- |
| **Definition** | `templates/common/skills/check.md` (skill form) + `templates/cursor/agents/trellis-check.md` (agent form) — **dual form** |
| **Triggers** | Phase 2.2 / 3.1 quality check; `trellis-start` routes "finished coding / quality check" |
| **Role (skill form)** | Main-session inline quality verification: Step 1 identify changes (`git diff --name-only`), Step 2 read artifacts + specs, Step 3 run project checks (lint/typecheck/test), Step 4 review against checklist (code quality / test coverage / durable learning Phase 3.3 token / spec sync / retrieval evidence), Step 5 cross-layer dimensions (data flow / code reuse / imports / same-layer consistency), Step 6 report and fix |
| **Role (agent form)** | Same scope but runs as an independent review pass in a spawned subagent context — can self-fix code. Used when a dedicated review pass is needed vs. inline check. See [subagents.md](subagents.md) for the dual-form decision |
| **Boundaries** | Records the Phase 3.3 durable learning decision token (`update-spec` \| `no-update` \| `unsure`) but does not itself edit specs |

#### `trellis-break-loop`

| | |
| --- | --- |
| **Definition** | `templates/common/skills/break-loop.md` |
| **Triggers** | Repeatedly debugging the same bug; `trellis-start` routes "stuck / same bug fixed multiple times" |
| **Role** | Deep bug analysis to break the "fix bug → forget → repeat" cycle. Five dimensions: **1 Root Cause Category** (A Missing Spec / B Cross-Layer Contract / C Change Propagation Failure / D Test Coverage Gap / E Implicit Assumption), **2 Why Fixes Failed** (surface fix / incomplete scope / tool limitation / mental model), **3 Prevention Mechanisms** (documentation / architecture / compile-time / runtime / test / review), **4 Systematic Expansion** (similar issues / design flaw / process flaw / knowledge gap), **5 Knowledge Capture** (update `.trellis/spec/guides/` thinking guides) |
| **Boundaries** | Philosophy: "30 minutes of analysis saves 30 hours of future debugging". After analysis it MUST immediately update spec/guides and sync templates — the analysis is worthless if it stays in chat |

#### `trellis-update-spec`

| | |
| --- | --- |
| **Definition** | `templates/common/skills/update-spec.md` |
| **Triggers** | Phase 3.3 when durable learning decision = `update-spec`; learned a pattern/convention/gotcha worth sinking |
| **Role** | Semi-automatic spec update flow: **Detect** (did this task produce reusable learning?) → **Proposal** (write `research/learning-proposal.md`, do NOT edit specs yet) → **Confirm** (user approves, `Learning decision: update-spec` in `verify.md`) → **Write** (only then edit spec files, add `Spec update evidence:` to `verify.md`) |
| **Boundaries** | **Forbidden**: silent spec edits; writing spec when decision is `no-update`/`unsure`; auto-updating from hooks alone. For infra/cross-layer changes it must use the **7-section code-spec depth** (Scope/Signatures/Contracts/Validation Matrix/Cases/Tests Required/Wrong vs Correct). Enforces Code-Spec vs Guide distinction (specs = "how to implement", guides = "what to consider") |

### Bundled skills (6)

#### `trellis-micro-grill`

| | |
| --- | --- |
| **Definition** | `bundled-skills/trellis-micro-grill/SKILL.md` |
| **Triggers** | Triage decision tree hits `Micro-Grill` mode; underspecified small request with no task yet |
| **Role** | Clarify an underspecified small request by asking **exactly one** high-value question per message, each with a recommended answer and trade-off. Once clarified, execute directly without creating a task. If scope grows, upgrade to Lite/Full/Parent |
| **Boundaries** | One question per message; Simplified Chinese for user-facing text; update `prd.md` after every answer (when a task exists); never ask process questions |

#### `trellis-meta`

| | |
| --- | --- |
| **Definition** | `bundled-skills/trellis-meta/SKILL.md` + `references/` (local-architecture, platform-files, customize-local) |
| **Triggers** | User wants to modify or understand the local `.trellis/` architecture, platform hooks/agents/skills/commands/workflows |
| **Role** | Local Trellis architecture map and customization entry router. Three reference layers: **local-architecture** (context injection, generated files, spec system, task system, workflow, workspace memory), **platform-files** (agents, hooks-and-settings, overview, platform-map, skills-and-commands), **customize-local** (change-agents, change-context-loading, change-hooks, change-skills-or-commands, change-spec-structure, change-task-lifecycle, change-workflow) |
| **Boundaries** | Edits only the user's project-local files, never the upstream source tree. Routes to `trellis-skill-creator` for detailed skill authoring rules |

#### `trellis-spec-bootstrap`

| | |
| --- | --- |
| **Definition** | `bundled-skills/trellis-spec-bootstrap/SKILL.md` + `references/` (mcp-setup, repository-analysis, spec-task-planning) |
| **Triggers** | Create or refresh `.trellis/spec/`; after `trellis init` when the spec tree is empty or needs restructuring |
| **Role** | Single-owner full flow: analyze repository → decouple spec boundaries → fill specs with **real code patterns** (not template boilerplate) → verify no placeholders. Uses GitNexus/ABCoder/source analysis to extract actual conventions |
| **Boundaries** | No template clichés; one owner owns the whole bootstrap; see [spec-system.md](spec-system.md) for the resulting structure |

#### `trellis-skill-creator`

| | |
| --- | --- |
| **Definition** | `bundled-skills/trellis-skill-creator/SKILL.md` + `references/` (authoring-rules, review-checklist, trellis-skill-locations) |
| **Triggers** | User wants to write or improve a Trellis-compatible skill (project-local, shared, `.agents/`, or upstream bundled) |
| **Role** | Skill authoring and review guide: frontmatter, trigger description, Hard Constraints, progressive disclosure. Includes authoring rules, review checklist, and trellis-skill-locations reference |
| **Boundaries** | Enforces the skill form contract loaded by `trellis-meta` |

#### `smart-search-cli`

| | |
| --- | --- |
| **Definition** | `bundled-skills/smart-search-cli/SKILL.md` + `examples/`, `references/cli-contract.md`, `agents/openai.yaml` |
| **Triggers** | Any external/web/current-fact retrieval; `trellis-research` agent external search; `workflow.md` Discovery/Research stage; `retrieval-daily-guide` routing |
| **Role** | CLI-first web research: `doctor` preflight → bilingual `search` → `context7`/`exa`/`fetch`/`map` by capability boundary → `research` Deep Research mode orchestrates plan→discover→fetch/read→gap check→evidence-only synthesis |
| **Boundaries** | Cursor built-in `WebSearch`/`WebFetch` are **downgrade-only fallback**, used solely when `doctor` is `not_configured`/`failed` or search times out. See [retrieval.md](retrieval.md) |

#### `trellis-cursor2plus-setup`

| | |
| --- | --- |
| **Definition** | `bundled-skills/trellis-cursor2plus-setup/SKILL.md` |
| **Triggers** | `trellis init` selects Cursor and user wants Cursor++ BYOK per-subagent models; `providers.json` changes |
| **Role** | Guide Cursor++ BYOK users to write `~/.ccursor/trellis-task-models.json5` (primary/fallback), run `patch_wpelc8.py` (reversible json5 slug mapping), report resolver WARN/ERROR |
| **Boundaries** | Native Cursor API users do not need this. Not in the `AGENTS.md` auto-triggered list (conditional, BYOK-only). See [cursor.md](cursor.md) for Method 2.5 detail |

## Auto-triggered inventory

The canonical auto-triggered list (10 skills) is generated into `AGENTS.md` from `templates/markdown/agents.md`. The 11th skill (`trellis-cursor2plus-setup`) is bundled but conditional — it activates only for Cursor++ BYOK users and is therefore not in the universal auto-triggered set.

| # | Skill | Trigger source |
| --- | --- | --- |
| 1 | `trellis-brainstorm` | Phase 1 planning / `trellis-start` |
| 2 | `trellis-before-dev` | Phase 2.1 / `trellis-start` |
| 3 | `trellis-check` | Phase 2.2/3.1 / `trellis-start` |
| 4 | `trellis-break-loop` | `trellis-start` (stuck) |
| 5 | `trellis-update-spec` | Phase 3.3 learning decision |
| 6 | `trellis-micro-grill` | Triage Micro-Grill mode |
| 7 | `trellis-meta` | Local architecture modification |
| 8 | `trellis-spec-bootstrap` | Spec tree creation/refresh |
| 9 | `trellis-skill-creator` | Skill authoring |
| 10 | `smart-search-cli` | External fact retrieval |
| 11 | `trellis-cursor2plus-setup` | Cursor++ BYOK setup (conditional) |

## Skill vs Agent: who does what

Three names overlap conceptually but resolve to different runtimes:

| Name | Skill form? | Agent form? | When to use which |
| --- | --- | --- | --- |
| `trellis-research` | No | Yes (`cursor/agents/trellis-research.md`) | Always the Agent form — there is no skill by this name. Spawned when a topic needs a dedicated `research/<topic>.md` file |
| `trellis-implement` | No | Yes (`cursor/agents/trellis-implement.md`) | Always the Agent form. Spawned in Phase 2.1 to do the implementation work in its own context |
| `trellis-check` | Yes (`common/skills/check.md`) | Yes (`cursor/agents/trellis-check.md`) | **Dual form.** Skill form = main-session inline check (default, lighter). Agent form = independent review pass with self-fix capability (when a dedicated pass is needed). `workflow.md` recommends the Agent form when verifying after code changes |

## Customizing skills

Trellis skills are customizable at three layers:

1. **Project-local skills** — drop a `SKILL.md` (or single-file `.md`) into the project's `.trellis/` or `.agents/skills/` tree. Loaded by the workflow matcher alongside bundled skills.
2. **Shared skills** — place under a shared `.agents/skills/` path when behavior spans multiple projects on the same platform.
3. **Upstream bundled skills** — the ones shipped in `@blxzer/cursor-trellis`; customize by copying and overriding locally rather than editing the installed package.

Use `trellis-skill-creator` (loaded via `trellis-meta`) for the authoring rules. See its `references/authoring-rules.md` and `references/review-checklist.md` for the frontmatter and Hard Constraints contract.

## See also

- [Subagent dispatch design](subagents.md) — the three `trellis-*` Agents, Method 1–4 dispatch, Native vs BYOK model routing
- [Spec system design](spec-system.md) — what `trellis-spec-bootstrap` creates and `trellis-update-spec` maintains
- [Task system design](task-system.md) — Phase 1–3 lifecycle, gates, Development Strategy Contract
- [Cursor integration](cursor.md) — commands-only policy, hooks, environment detection
- [Workflow in Cursor](workflow.md) — the lifecycle these skills serve
