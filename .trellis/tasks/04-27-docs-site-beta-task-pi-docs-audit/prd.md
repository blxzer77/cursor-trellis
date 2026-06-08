# Docs-Site Beta Task and Pi Agent Documentation Audit

## Goal

Bring the beta docs-site into sync with the current Trellis task runtime and Pi Agent support, without touching release-track documentation.

## Scope

- Update only beta docs-site content:
  - `docs-site/*.mdx`
  - `docs-site/start/**`
  - `docs-site/advanced/**`
  - `docs-site/guides/**` if kept as live beta pages
  - `docs-site/concepts/**`
  - `docs-site/changelog/**`
  - matching `docs-site/zh/**` mirrors
- Do not edit:
  - `docs-site/release/**`
  - `docs-site/zh/release/**`

## Current Product Truth

- Trellis no longer uses a global `.trellis/.current-task` pointer.
- Active task state is session-scoped and stored at `.trellis/.runtime/sessions/<session-key>.json`.
- `task.py start` writes the current session file and moves a planning task to `in_progress`.
- `task.py finish` clears the current session file after the task is finished.
- `task.py archive` clears any session files that still point at the archived task.
- Pi Agent is a configured platform behind `trellis init --pi`.
- Pi writes:
  - `.pi/prompts/trellis-{command}.md`
  - `.pi/skills/{skill}/SKILL.md`
  - `.pi/agents/{agent}.md`
  - `.pi/extensions/trellis/index.ts`
  - `.pi/settings.json`
- Pi is agent-capable, but it does not use Python hooks. It uses the Pi extension to read session runtime and inject Trellis context.
- `.trellis/workflow.md` and the workflow template already mention Pi in the main workflow.

## Documentation Problem

The beta docs-site still describes old global task state and old platform counts in multiple places:

- Many pages still say `.trellis/.current-task`.
- Multiple pages still say Trellis ships on 13 configured platforms.
- Pi Agent is missing from install instructions, platform matrices, command/skill/agent delivery tables, and hook/context-injection docs.
- Some older beta guide pages are not in the current sidebar but remain accessible and are linked from other beta pages.

## Required Change Strategy

1. Update current beta sidebar pages first:
   - install and first task
   - everyday use
   - architecture
   - multi-platform
   - custom commands
   - custom skills
   - custom agents
   - custom hooks
   - appendices A/B/F
   - index pages
2. Update the latest beta changelog entry or prepare the next beta changelog entry for session-scoped runtime and Pi support.
3. Triage legacy/orphaned beta pages:
   - either update them if they remain reachable
   - or remove/redirect references from live beta pages
4. Apply every MDX change to both English and Chinese mirrors.
5. Keep release-track docs unchanged.

## Acceptance Criteria

- No live beta docs page claims `.trellis/.current-task` is the active task pointer.
- Beta docs explain `.trellis/.runtime/sessions/<session-key>.json` in plain user-facing language.
- Beta docs describe that active task state is per session/window instead of global.
- `trellis init --pi` appears wherever platform flags are listed.
- Platform count and matrices include Pi Agent.
- Pi command, skill, agent, settings, and extension paths are documented.
- Pi is described as extension-based context injection, not Python-hook based.
- English and Chinese beta docs stay structurally aligned.
- Release docs are untouched.

## Research

Detailed page-level findings are recorded in `research/docs-site-beta-audit.md`.
