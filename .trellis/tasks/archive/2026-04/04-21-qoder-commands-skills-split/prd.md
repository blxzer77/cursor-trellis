# PRD: Qoder — split session-boundary commands from skills

## Problem

On Qoder, Trellis currently delivers **all** its workflows (start / finish-work / continue + brainstorm / before-dev / check / update-spec / break-loop) as auto-trigger skills under `.qoder/skills/{name}/SKILL.md`. Verified against current (0.5.0-beta.8) and 0.4.0 GA code:

- `packages/cli/src/configurators/qoder.ts` — only writes `.qoder/skills/` + `.qoder/hooks/` (0.5) / only `.qoder/skills/` (0.4)
- `packages/cli/src/templates/qoder/` — no `commands/` subdirectory

But Qoder's docs (`docs.qoder.com/zh/user-guide/commands`) confirm it **does** support Custom Commands:

- Typed with `/` in the Agent input
- Stored at `~/.qoder/commands/` (user-level) or `<project>/.qoder/commands/` (project-level)
- Supports Markdown-based custom prompt commands

This is an inconsistency with Trellis's command/skill design principle applied on every other platform:

| Primitive | Trigger | Purpose | Examples |
|---|---|---|---|
| **Command** | User (`/trellis:*`) | Session boundaries — explicit user entry | `start`, `finish-work`, `continue` |
| **Skill** | Platform (auto-match) | Phase-level workflows — AI picks based on intent | `brainstorm`, `before-dev`, `check`, `update-spec`, `break-loop` |
| **Sub-agent** | Main session (spawn) | Isolated roles | `implement`, `check`, `research` |

Qoder violates this: user-invoked session-boundary commands are buried in the skill-matcher along with AI-triggered workflows, so:

- User can't reliably invoke "start a session" — has to hope the skill matcher picks `start` skill based on their chat wording
- Skill matcher pollution — every platform turn has to consider 7–8 candidates instead of 5
- Inconsistency with peer platforms — Qoder users can't follow the same mental model they use on Claude Code / Cursor / OpenCode

## Goal

On Qoder, deliver Trellis in the correct two-layer form:

- **`.qoder/commands/trellis-{name}.md`** (flat, YAML frontmatter) — session-boundary commands. Qoder is `agentCapable` so `start` is filtered out (session-start hook injects the workflow overview), leaving `finish-work` + `continue` as the 2 user-facing commands in 0.5.
- **`.qoder/skills/trellis-{name}/SKILL.md`** — auto-trigger workflows only: `brainstorm`, `before-dev`, `check`, `update-spec`, `break-loop`.

User types `/trellis-finish-work` or `/trellis-continue` explicitly when they want session boundaries. AI matches skills for workflow-level triggers.

## Proposed approach (implemented)

1. **Verified Qoder Custom Commands format** against `docs.qoder.com/en/cli/user-guide/command.md`: `.qoder/commands/<name>.md` is **flat** (no documented nested-namespace support), YAML frontmatter with required `name` + `description` fields, filename must match `name`, triggered as `/<name>`.
2. **Configurator** (`packages/cli/src/configurators/qoder.ts`):
   - Writes `.qoder/commands/trellis-{name}.md` for each `resolveCommands(ctx)` result, wrapped via new `wrapWithCommandFrontmatter(...)` helper.
   - Writes `.qoder/skills/trellis-{name}/SKILL.md` via `resolveSkills(ctx)` (5 auto-trigger skills only).
   - Agents / hooks / settings unchanged.
3. **Shared helper**: `wrapWithCommandFrontmatter` + new `COMMAND_DESCRIPTIONS` registry in `configurators/shared.ts`. Kept separate from `SKILL_DESCRIPTIONS` because skill descriptions are long auto-trigger prose (for the matcher), whereas command descriptions are short imperative one-liners (for the `/` palette).
4. **Update tracking**: mirrored the same layout into `PLATFORM_FUNCTIONS.qoder.collectTemplates()` (`configurators/index.ts`) so `trellis update` hash-tracks the new command files.
5. **Migration manifest** `packages/cli/src/migrations/manifests/0.5.0-beta.10.json`:
   - `safe-file-delete` for `.qoder/skills/trellis-finish-work/SKILL.md` and `.qoder/skills/trellis-continue/SKILL.md`, with `allowed_hashes` covering both Unix (`python3`) and Windows (`python`) `{{PYTHON_CMD}}` variants of the current template content.
   - New commands written by the standard configure step on `trellis update`.
6. **Tests updated**: `test/commands/init.integration.test.ts` `#3g` asserts commands dir + filtered skill dirs; `test/configurators/platforms.test.ts` rewrites the Qoder check to verify both primitives and the split. 599/599 tests pass.
7. **Docs-site** (TODO separately — not in this sprint): `ch13-multi-platform.mdx` §13.9 Qoder, `ch02-quick-start.mdx`, `appendix-a.mdx` / `appendix-b.mdx`.

## Out of scope

- Migrating other skills-only platforms (Qoder is the only one that has native commands + we picked not to use them — other skills-only platforms like Kiro use skills because that's the platform's only UX surface)
- Changing 0.4 retroactively — fix goes into the next 0.5 beta; 0.4 users keep the skills-only behavior

## Acceptance criteria

- [x] `packages/cli/src/configurators/qoder.ts` writes both `.qoder/commands/` (2 session commands — `start` filtered by `agentCapable`) and `.qoder/skills/` (5 workflow skills).
- [x] Running `trellis init --qoder` in `/tmp/qoder-migrate-test` produces the expected layout (verified); `collectTemplates()` entries match so `trellis update` tracks them.
- [ ] Typing `/trellis-finish-work` in Qoder's Agent input invokes the command (requires a real Qoder session — done offline by the user when available).
- [x] Migration manifest handles existing 0.5.0-beta.X installs: legacy `.qoder/skills/trellis-{finish-work,continue}/SKILL.md` hash-verified and deleted, new `.qoder/commands/trellis-{finish-work,continue}.md` written fresh. Verified end-to-end in `/tmp/qoder-migrate-test`.
- [ ] `docs-site` beta + release tracks updated (deferred — separate doc task).
- [x] Dogfood fixture: `/tmp/qoder-migrate-test/.qoder/` shows correct post-migration layout after `trellis update --migrate --force`.

## Notes

- Confirmed symptom in `tmp1/.qoder/skills/` (2026-04-21): lists `trellis-start`, `trellis-finish-work`, `trellis-continue`, plus the five true auto-trigger workflows. Session-boundary ones shouldn't be there.
- Related user quote: "qoder 本身应该用那俩 command + 剩下的搞成 skill 吧" — yes, matches peer-platform convention.
- This is a P2 (design inconsistency, not breaking) but worth doing before 0.5 GA so the release doesn't ship with inconsistent Qoder UX.
