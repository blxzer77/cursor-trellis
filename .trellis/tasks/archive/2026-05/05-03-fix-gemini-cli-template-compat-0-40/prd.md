# Fix Gemini CLI 0.40.x template compat

## Goal

Make `trellis init --gemini` produce templates that load cleanly on Gemini CLI 0.40.x. Today the generated `.gemini/agents/*.md`, `.gemini/settings.json`, and `.gemini/skills/` cause schema errors and duplicate-skill warnings (issue #224).

## Reproduction (from #224)

`@mindfoldhq/trellis@0.5.0-rc.2` + `gemini-cli 0.40.1`:

1. Agent loading error — `tools: Expected array, received string` for every `.gemini/agents/trellis-*.md`.
2. Hook event `UserPromptSubmit` rejected — Gemini 0.40.x renamed it to `BeforeAgent`.
3. Duplicate skills — Gemini reads `.agents/skills/` as a workspace alias and warns when the same skill exists in both `.agents/skills/` and `.gemini/skills/`.

Reporter's local workaround (verified working): drop `tools:` line, rename event to `BeforeAgent`, delete `.gemini/skills/`, prune corresponding entries from `.trellis/.template-hashes.json`.

## What I already know (from repo scan)

* Agent templates: `packages/cli/src/templates/gemini/agents/{trellis-check,trellis-implement,trellis-research}.md` — all carry the comma-separated `tools:` line.
* Settings: `packages/cli/src/templates/gemini/settings.json` — uses `SessionStart` + `UserPromptSubmit` hook events.
* Configurator: `packages/cli/src/configurators/gemini.ts` — writes `.gemini/skills/` via `writeSkills(...)` from the shared common skill set (5 skills + bundled).
* Hash tracking: `packages/cli/src/configurators/index.ts:270-298` mirrors the same file set into `collectTemplates()` for `.template-hashes.json`. Both must change in lockstep.
* Codex precedent: `packages/cli/src/configurators/codex.ts` already writes shared skills to `.agents/skills/`. Pi (`packages/cli/src/configurators/pi.ts:30-34`) explicitly noted shared `.agents/skills/` is "not yet safe" because skill content has `{{CMD_REF:...}}` placeholders resolved per-platform.

## Assumptions (temporary)

* Gemini 0.40.x's "BeforeAgent" event name is the correct replacement for `UserPromptSubmit` (per issue reporter, needs confirmation against current Gemini docs).
* No existing test covers Gemini agent frontmatter shape or hook event name (none surfaced in scan; will verify).
* `.template-hashes.json` is generated fresh; no manual user data to migrate.

## Research References

* [`research/agent-tools-frontmatter.md`](research/agent-tools-frontmatter.md) — recommend OMIT `tools:` (inherit parent); comma-string was never valid; explicit array would need PascalCase→snake_case mapping.
* [`research/hook-events.md`](research/hook-events.md) — `BeforeAgent` confirmed; `UserPromptSubmit` never existed in Gemini (Claude Code name borrowed by mistake); `additionalContext` is APPENDED (verify breadcrumb ordering); hook script JSON `hookEventName` field must also rename.
* [`research/skills-discovery.md`](research/skills-discovery.md) — Option C dead (no disable knob exists); recommends Option A; warning fires before `skills.disabled` filter.

## Decisions Locked

* **Tools field** — OMIT `tools:` line from all 3 Gemini agent files (inherit parent tools). Avoids Gemini's PascalCase→snake_case + `mcp__`→`mcp_` rename traps. Per [`research/agent-tools-frontmatter.md`](research/agent-tools-frontmatter.md).
* **Hook event** — Use `BeforeAgent`. Only event in Gemini's 11-event enum that fires per user-turn for context injection (Claude `UserPromptSubmit` ↔ Gemini `BeforeAgent`). `SessionStart` fires only on startup/resume/clear so cannot replace per-turn breadcrumb. Per [`research/hook-events.md`](research/hook-events.md).
* **Skills strategy** — Option **A** (write shared skills to `.agents/skills/`, drop `.gemini/skills/`). Matches Codex pattern. Per [`research/skills-discovery.md`](research/skills-discovery.md).
* **Bundled in this PR — `{{CMD_REF}}` neutralization for `.agents/skills/`**. Add `resolvePlaceholdersNeutral()` rendering `{{CMD_REF:start}}` → `` `start` (Trellis command) `` (or similar). `.agents/skills/` writes use neutral; platform-specific skill dirs (`.claude/skills/`, `.cursor/skills/` etc.) keep platform-specific resolution. Eliminates Codex+Gemini "last-writer-wins" collision. Pi configurator note (`pi.ts:30-34`) becomes obsolete and can be cleaned up.

## Requirements (evolving)

* Gemini agent frontmatter must validate under Gemini CLI 0.40.x (array `tools` or omitted).
* Gemini settings must use the current hook event name for the per-turn workflow breadcrumb.
* `trellis init --gemini` must not emit duplicate-skill warnings against `.agents/skills/` workspace alias.
* `.template-hashes.json` tracks exactly the file set actually written.

## Acceptance Criteria (evolving)

* [ ] In a fresh project, `trellis init --gemini --yes && gemini --help` exits clean (no agent schema errors, no duplicate-skill warnings).
* [ ] `trellis update` is a no-op on a freshly-initialized Gemini project (hashes match generated set).
* [ ] Unit tests cover: (a) agent frontmatter shape, (b) hook event name, (c) skill destination strategy.
* [ ] Lint + typecheck + full test suite pass.

## Definition of Done

* Tests added/updated for the three fixes above.
* `pnpm test` / lint / typecheck green.
* Manual repro from issue #224 verified clean against built CLI.
* Issue #224 referenced in commit + closed when PR lands.

## Out of Scope (explicit)

* Changes to other platforms' templates or hook events.
* Refactoring shared skill `{{CMD_REF}}` placeholders to be platform-neutral (would unblock Pi too — separate task).
* Adding a Gemini compat-version matrix or runtime detection.

## Technical Notes

* Files to edit (minimum viable):
  - `packages/cli/src/templates/gemini/agents/*.md` — fix `tools:` line (3 files).
  - `packages/cli/src/templates/gemini/settings.json` — rename `UserPromptSubmit` → `BeforeAgent` (or whichever event lookup confirms).
  - `packages/cli/src/configurators/gemini.ts` + `packages/cli/src/configurators/index.ts:270` — adjust skill destination per chosen strategy.
* Need to verify: current Gemini CLI 0.40.x docs for (a) supported `tools:` YAML shape, (b) full hook event enum, (c) `.agents/skills/` precedence rules.
* Research will be delegated to `trellis-research` sub-agents.

## Implementation Plan

**Commit 1 — Issue #224 fixes**

1. `packages/cli/src/templates/gemini/agents/{trellis-check,trellis-implement,trellis-research}.md` — delete the `tools:` frontmatter line.
2. `packages/cli/src/templates/gemini/settings.json` — rename `UserPromptSubmit` → `BeforeAgent`.
3. `packages/cli/src/templates/shared-hooks/inject-workflow-state.py` — branch on platform: emit `"hookEventName": "BeforeAgent"` when `_detect_platform() == "gemini"`, otherwise `"UserPromptSubmit"`. Update module docstring (currently says "UserPromptSubmit hook").
4. `packages/cli/src/configurators/gemini.ts` — switch shared skills write target from `.gemini/skills/` to `.agents/skills/` (mirror Codex's `configureCodex` pattern: `path.join(cwd, ".agents", "skills")`).
5. `packages/cli/src/configurators/index.ts:270-298` — sync `collectTemplates()` for gemini with the same change so `.template-hashes.json` tracks the real write set.

**Commit 2 — `{{CMD_REF}}` neutralization**

6. `packages/cli/src/configurators/shared.ts` — add `resolvePlaceholdersNeutral()` and `resolveSkillsNeutral()` / `resolveAllAsSkillsNeutral()`. Neutral form rendered to TBD-but-readable string (proposal: `` `start` (Trellis command — see workflow.md) ``).
7. `packages/cli/src/configurators/codex.ts` — switch `.agents/skills/` write to neutral resolver.
8. `packages/cli/src/configurators/gemini.ts` — `.agents/skills/` write also uses neutral resolver.
9. `packages/cli/src/configurators/pi.ts:30-34, 70` — clean up the stale "shared `.agents/skills` not yet safe" comment (now safe).
10. Tests: extend `test/configurators/shared.test.ts` (or equivalent) to cover the neutral resolver output shape.

**Per-commit verification gate**

* After commit 1: `pnpm build && pnpm test && pnpm lint`. Manual: in a scratch dir, `node packages/cli/dist/index.js init --gemini --yes` and `gemini --help` — expect zero schema errors.
* After commit 2: same gates plus a diff-check on rendered `.agents/skills/brainstorm/SKILL.md` between Codex+Gemini configurators (must be byte-identical).

