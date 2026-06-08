# OpenCode skills vs commands — capability research

**Researched**: 2026-04-27
**For**: .trellis/tasks/04-27-platform-compat-feedback (Issue 2)

## TL;DR

- **Finding A (`disable-model-invocation`)**: **NOT SUPPORTED**. Opencode's official docs list only 5 recognized frontmatter fields (`name`, `description`, `license`, `compatibility`, `metadata`); unknown fields are explicitly ignored. The Anthropic-standard `disable-model-invocation` is filed as feature request [#11972](https://github.com/anomalyco/opencode/issues/11972) (open as of Feb 2026) and [#12109](https://github.com/anomalyco/opencode/issues/12109). Opencode steers users to `opencode.json` `permission.skill` (`allow`/`deny`/`ask`) instead — but commenters note even `deny` still loads the skill description into context.
- **Finding B (`.agents/skills/` sharing)**: **TRUE**. Opencode officially scans `.agents/skills/` (project) and `~/.agents/skills/` (global) since commit [`17e62b0`](https://github.com/anomalyco/opencode/commit/17e62b050f744adcc9ca30f59ab9ed45ba3184f8) (Feb 3 2026, PR #11842). Codex CLI also officially scans `$REPO_ROOT/.agents/skills` and `$HOME/.agents/skills` per [OpenAI's docs](https://developers.openai.com/codex/skills/create-skill). It is an emergent cross-tool convention now formalized by both projects.
- **Finding C (slash invocation)**: In the TUI, typing `/<skill-name>` directly invokes the skill (PR [#11390](https://github.com/anomalyco/opencode/issues/11390), merged Jan 31 2026). There is also a `/skills` command that opens a searchable picker (issue [#21447](https://github.com/anomalyco/opencode/issues/21447)). So **both** `/<skill-name>` and `/skills` work in the TUI. Note: as of [#22129](https://github.com/anomalyco/opencode/issues/22129) (Apr 12 2026), the TUI autocomplete still filters skills out (`if (serverCommand.source === "skill") continue`), so users must type the full name; the web/desktop app shows them with a "Skill" badge.
- **Recommended Trellis change (PRD Q3)**: **Approach 3 (share via `.agents/skills/`)** for the skill payload, combined with **keeping** `.opencode/commands/` for trellis slash commands. Rationale below in §6.

---

## 1. Skill frontmatter spec

**Authoritative source**: <https://opencode.ai/docs/skills/> (mirrored at <https://dev.opencode.ai/docs/skills/> and source MDX at <https://github.com/sst/opencode/blob/dev/packages/web/src/content/docs/skills.mdx>).

Direct quote from the docs:

> Each `SKILL.md` must start with YAML frontmatter. Only these fields are recognized:
>
> - `name` (required)
> - `description` (required)
> - `license` (optional)
> - `compatibility` (optional)
> - `metadata` (optional, string-to-string map)
>
> Unknown frontmatter fields are ignored.

Constraints:

- `name`: 1–64 chars, regex `^[a-z0-9]+(-[a-z0-9]+)*$`, must equal directory name.
- `description`: 1–1024 chars.

Example from the docs:

```yaml
---
name: git-release
description: Create consistent releases and changelogs
license: MIT
compatibility: opencode
metadata:
  audience: maintainers
  workflow: github
---
```

### Is `disable-model-invocation` (or equivalent) supported?

**No.** The docs do not list it. Per Issue [#11972](https://github.com/anomalyco/opencode/issues/11972) "feat: Support disable-model-invocation field in skill frontmatter" (Feb 3 2026, still open):

> Currently, OpenCode appears to ignore this field. Skills with `disable-model-invocation: true` are still visible to the model.

Opencode's documented alternative is `opencode.json` permission rules:

```json
{
  "permission": {
    "skill": {
      "*": "allow",
      "internal-*": "deny",
      "experimental-*": "ask"
    }
  }
}
```

…but a commenter on #11972 reports that `deny` still loads the description into context, so it's not a clean equivalent to Anthropic's `disable-model-invocation`.

There is also no `auto: false`, `manual: true`, or `auto_invoke: false` field in opencode's schema.

**There is one related lever**: agent-level `tools.skill: false` disables the entire skill subsystem for a given agent (docs §"Disable the skill tool"). This is per-agent, not per-skill.

**Inline-trigger work-in-progress**: Issue [#15617](https://github.com/anomalyco/opencode/issues/15617) and PR #22666 are adding `$skill-name` inline invocation, mirroring Codex. Not relevant to the auto-invocation suppression problem.

---

## 2. Skill discovery paths

Verbatim from <https://opencode.ai/docs/skills/>:

> OpenCode searches these locations:
>
> - Project config: `.opencode/skills/<name>/SKILL.md`
> - Global config: `~/.config/opencode/skills/<name>/SKILL.md`
> - Project Claude-compatible: `.claude/skills/<name>/SKILL.md`
> - Global Claude-compatible: `~/.claude/skills/<name>/SKILL.md`
> - Project agent-compatible: `.agents/skills/<name>/SKILL.md`
> - Global agent-compatible: `~/.agents/skills/<name>/SKILL.md`
>
> For project-local paths, OpenCode walks up from your current working directory until it reaches the git worktree.

Source code reference (`packages/opencode/src/skill/skill.ts`, per Issue #12741 forensics):

```ts
const EXTERNAL_DIRS = [".claude", ".agents"]
// scanned via Filesystem.up({ targets: EXTERNAL_DIRS, start: Instance.directory, stop: Instance.worktree })
```

History: `.agents/skills/` support was added by PR #11842, commit [`17e62b0`](https://github.com/anomalyco/opencode/commit/17e62b050f744adcc9ca30f59ab9ed45ba3184f8), merged Feb 3 2026, after community pressure in issue [#10986](https://github.com/anomalyco/opencode/issues/10986).

**Order of precedence**: Docs do not state a strict precedence; `Skill.all()` returns deduplicated results across all six paths. Issue [#23035](https://github.com/anomalyco/opencode/issues/23035) (Apr 17 2026) confirms hardcoded scan of all 6 dirs and that opencode "correctly deduplicates" identical skills (so duplication across `.opencode/skills/` and `.agents/skills/` is benign — but adds startup cost).

**Known gotchas**:
- Issue [#12741](https://github.com/anomalyco/opencode/issues/12741): When CWD === git worktree root, `Filesystem.up()` produces an empty range and `.agents/skills/` at repo root is **not scanned**. Workaround: `ln -s .agents .opencode`.
- Env var `OPENCODE_DISABLE_CLAUDE_CODE=1` (and `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS=true`) disables both `.claude/` and `.agents/` paths together (issue #12109, #15396, #12604).
- Custom paths can be added via opencode.json: `"skills": { "paths": [ "/path/to/extra" ] }` (PR #6539, additive only, defaults can't be removed yet).

`.agents/skills/` is one of the six paths. **Yes**, it is a first-class supported path.

---

## 3. Slash UI for skills

Per PR [#11390](https://github.com/anomalyco/opencode/issues/11390) "feat: make skills invokable as slash commands in the TUI" (Jan 31 2026):

> Users can now invoke any skill defined in SKILL.md files by typing `/skillname` in the TUI. The skill's body content (markdown after the frontmatter) is used as the command template, and arguments are substituted just like with regular commands.
> Skills appear in the slash command autocomplete alongside regular commands, marked with "(Skill)" label for clarity.

Per Issue [#21447](https://github.com/anomalyco/opencode/issues/21447) "docs: /skills slash command missing from TUI docs" (Apr 8 2026):

> The `/skills` slash command … opens a searchable dialog listing all discovered agent skills. Selecting a skill populates the prompt with `/<name>` so you can invoke it directly.

So today users have **two** ways to manually trigger a skill from the TUI:

1. `/<skill-name>` — direct invocation. Skill body is injected as template.
2. `/skills` — opens a picker; selecting an item types `/<name>` for you.

Caveats:
- **TUI autocomplete bug**: Issue [#22129](https://github.com/anomalyco/opencode/issues/22129) (Apr 12 2026) — `autocomplete.tsx:363` still has `if (serverCommand.source === "skill") continue`, so skills aren't suggested as you type; you must know the name or use `/skills`. The web/desktop app has no such filter.
- **Web/desktop app** does not show `/skills` (per #7846 thread, Apr 4 2026 comment), but does show skills with a "Skill" badge in its slash popover.
- Inline `$skill-name` trigger (a la Codex) is being added in PR #22666 (Apr 15 2026), not yet merged at time of writing.

**There is no `/skill:<name>` syntax** — that was the original proposal in #7846, but the team aligned on `/<name>` (Cursor-style) for ecosystem interoperability.

---

## 4. Command vs skill — does opencode still have both?

**Yes, both still exist** as distinct concepts:

### Custom slash commands
- Live in `.opencode/commands/<name>.md` (project) or `~/.config/opencode/commands/<name>.md` / `~/.opencode/commands/<name>.md` (user). Source: <https://opencode.ai/docs/commands/>.
- Frontmatter fields: `description`, `agent`, `model`, `template` (when defined in opencode.json instead of MD). Recognize `$ARGUMENTS` placeholders, `@{file}` injection, `!shell` execution.
- Original feature: PR [#1304](https://github.com/sst/opencode/pull/1304) (Jul 2025) and issue #299.
- Always manually invoked, never auto-invoked by the model. No "model-discovery" semantics.

### Skills
- Live in `.opencode/skills/<name>/SKILL.md` (and the 5 other discovery paths above).
- Loaded via the native `skill` tool — agent picks based on description; **also** invocable via `/<skill-name>` since PR #11390.
- Designed for "progressive disclosure": metadata always in context, body loaded on demand.

### Have they converged?

Not as a deletion of either side, but they overlap heavily. After PR #11390, the **only** functional differences from a user's standpoint are:

| Aspect | Command (.opencode/commands/) | Skill (SKILL.md) |
|---|---|---|
| Project path | `.opencode/commands/foo.md` | `.opencode/skills/foo/SKILL.md` (+ 5 alt paths) |
| Frontmatter | `description`, `agent`, `model` | `name`, `description`, `license`, `compatibility`, `metadata` |
| Auto-invocable by model | No | Yes (via `skill` tool) |
| User invocation | `/foo` | `/foo` (since #11390), or `/skills` picker |
| Argument placeholders | `$ARGUMENTS`, `@file`, `!bash` | Inherits same template substitution since #11390 |
| Hot reload | Yes | Yes |
| Cross-tool path sharing | Opencode-only | Yes via `.claude/`, `.agents/` |

The convergence happened in **late January 2026** (PR #11390). Opencode has not deprecated commands — they remain useful for manually-only flows and for the richer command frontmatter (`agent`, `model` overrides). Issue #12109 shows the team briefly removed the auto-listing of skills as commands and then partly reverted; the current state is "both visible, distinguished by source."

There is no formal migration story — both surfaces coexist.

---

## 5. `.agents/skills/` cross-tool convention

### Opencode-formal?
**Yes.** Opencode docs list `.agents/skills/` and `~/.agents/skills/` as first-class discovery paths. Implementation: `EXTERNAL_DIRS = [".claude", ".agents"]` in `packages/opencode/src/skill/skill.ts`. Tests live in the same file (commit `17e62b0`).

### Codex-formal?
**Yes.** Per <https://developers.openai.com/codex/skills/create-skill>:

> Codex reads skills from repository, user, admin, and system locations. For repositories, Codex scans `.agents/skills` in every directory from your current working directory up to the repository root.

Codex's full table:

| Scope | Location |
|---|---|
| `REPO` | `$CWD/.agents/skills`, `$CWD/../.agents/skills`, `$REPO_ROOT/.agents/skills` |
| `USER` | `$HOME/.agents/skills` |
| `ADMIN` | `/etc/codex/skills` |
| `SYSTEM` | bundled |

OpenAI is actively deprecating `~/.codex/skills` in favor of `~/.agents/skills` (Issue [#14337](https://github.com/openai/codex/issues/14337) — quote: *"`~/.codex/skills` is the old (legacy) name. The industry has since standardized on `~/.agents/skills`."*).

### Multi-tool convention status

There is an external open standard at <https://agentskills.my/specification> — but it lists per-platform paths (`.claude/`, `.cursor/`, etc.) and does **not** mandate `.agents/skills/`.

`.agents/skills/` is an **emergent convention** that opencode and codex have both formally adopted. It is mentioned by an OpenAI engineer on Codex issue #16595 as:

> The `.agents` directory is an emerging industry standard and is not specific to codex whereas `.codex` contains codex-specific settings and configuration files.

Cursor ([cursor.com/docs/context/skills](https://cursor.com/docs/context/skills)) and Claude Code use their own per-tool dirs (`.cursor/skills/`, `.claude/skills/`) and have not formally adopted `.agents/skills/`, though opencode's compatibility mode picks up `.claude/skills/` opportunistically.

---

## 6. Implications for Trellis

### Recommendation: **Approach 3 — share via `.agents/skills/`**

Rationale:

1. **Both target tools support it natively.** Opencode (since Feb 3 2026, v ≥ ~1.1.50) and codex CLI both scan `.agents/skills/` as a first-class location. No env vars, no symlinks (as long as worktree gotcha #12741 is avoided — and Trellis tasks always run from a path where worktree-traversal works).
2. **Eliminates the duplicate-trigger user complaint.** A single SKILL.md under `.agents/skills/<name>/` is discovered exactly once by each tool. No more "I see continue twice."
3. **Single source of truth** for trellis's auto-invocable skills (continue, finish-work, etc.). Trellis's existing `.codex/skills/` and `.opencode/skills/` writes can be consolidated.
4. **`.opencode/commands/` should still be written** for opencode users who want a guaranteed manual-only slash trigger (and so they can use $ARGUMENTS / @file / !bash placeholders, which the SKILL.md path inherits since #11390 but is less idiomatic). Codex has no equivalent commands directory, so codex users get the skill auto-invocation path only, which is fine.
5. **Why not Approach 1 (skip skill copy when both selected)**: leaves opencode-only users without auto-invokable skills, and creates conditional logic in the configurator that's fragile.
6. **Why not Approach 2 (skills-only)**: opencode does not yet support `disable-model-invocation`, so converting commands → skills means losing the manual-only guarantee and relying on the model not to auto-call them. Issue #11972 is open and unmerged. Will revisit if/when opencode adopts the field.

### Concrete deltas if Approach 3 is taken

- **Trellis configurator changes**:
  - Add a writer for `.agents/skills/<name>/SKILL.md` shared between codex and opencode platforms.
  - Stop writing `.opencode/skills/<name>/SKILL.md` and `.codex/skills/<name>/SKILL.md` for skills already covered by the shared `.agents/` path.
  - Continue writing `.opencode/commands/trellis/{continue,finish-work}.md` for opencode users (these are deliberately user-only and use slash-command-specific features).
- **Migration**:
  - Manifest entry to delete `.opencode/skills/<name>/` and `.codex/skills/<name>/` for users updating from older trellis versions, since the same content now lives in `.agents/skills/`.
- **Codex configurator work** (the user explicitly asked):
  - Codex's own discovery already covers `.agents/skills/`. Today Trellis writes `.codex/skills/`. Switching to `.agents/skills/` is a single path change in the codex template writer. No frontmatter changes needed (codex parses the same `name`/`description` minimum).
  - Note: codex's docs encourage `.agents/skills/`; `~/.codex/skills/` is being deprecated, so this aligns with codex's own direction.
- **Worktree-root gotcha (#12741)**: opencode's `Filesystem.up()` skips the start dir when start === stop. If the user runs opencode from the repo root (the worktree), `.agents/skills/` at the repo root is silently skipped in some opencode versions (≤ v1.3.0 still affected per the issue). Workaround for users: a symlink `ln -s .agents .opencode` or wait for opencode fix. Trellis docs should mention this caveat for opencode users.
- **Risk**: opencode's `.agents/` support landed Feb 3 2026 (~v1.1.50). Trellis users on opencode older than that won't see skills from `.agents/skills/`. Trellis should require a min opencode version or fall back to writing `.opencode/skills/` for old versions. Suggest: detect via `opencode --version` if feasible, else just document the requirement.

### One-liner answer to PRD Q3

> Use `.agents/skills/` for skill payload (codex + opencode both read it natively); keep `.opencode/commands/` for manual-only slash commands; drop `.opencode/skills/` and `.codex/skills/` writes.

---

## Sources

All URLs accessed 2026-04-27.

**Opencode docs (primary):**
- <https://opencode.ai/docs/skills/> — frontmatter spec, discovery paths
- <https://dev.opencode.ai/docs/skills/> — dev mirror, identical content
- <https://opencode.ai/docs/commands/> — custom commands spec
- <https://github.com/sst/opencode/blob/dev/packages/web/src/content/docs/skills.mdx> — source MDX

**Opencode source code & PRs/issues:**
- PR #1304 <https://github.com/sst/opencode/pull/1304> — original custom commands feature (Jul 2025)
- Issue #299 <https://github.com/anomalyco/opencode/issues/299> — custom slash commands proposal
- Issue #10986 <https://github.com/anomalyco/opencode/issues/10986> — `.agents/skills/` request
- Commit `17e62b0` <https://github.com/anomalyco/opencode/commit/17e62b050f744adcc9ca30f59ab9ed45ba3184f8> — `.agents/skills/` support landed Feb 3 2026
- Issue #11390 / PR #11390 <https://github.com/anomalyco/opencode/issues/11390> — skills as slash commands in TUI (Jan 31 2026)
- Issue #11972 <https://github.com/anomalyco/opencode/issues/11972> — `disable-model-invocation` feature request (open)
- Issue #12109 <https://github.com/anomalyco/opencode/issues/12109> — skills-as-commands controllability
- Issue #12604 <https://github.com/anomalyco/opencode/issues/12604> — disable claude/agents sync
- Issue #12741 <https://github.com/anomalyco/opencode/issues/12741> — `Filesystem.up` worktree-root gotcha
- Issue #15396 <https://github.com/anomalyco/opencode/issues/15396> — `OPENCODE_DISABLE_CLAUDE_CODE_SKILLS` env var
- Issue #15617 <https://github.com/anomalyco/opencode/issues/15617> — inline `$skill-name` trigger (in progress)
- Issue #21447 <https://github.com/anomalyco/opencode/issues/21447> — `/skills` command exists, missing from docs
- Issue #22129 <https://github.com/anomalyco/opencode/issues/22129> — TUI autocomplete filters skills (Apr 2026)
- Issue #23035 <https://github.com/anomalyco/opencode/issues/23035> — startup cost of 6-dir scan
- Issue #7846 <https://github.com/anomalyco/opencode/issues/7846> — original `/skills` command request, Cursor-style alignment
- Issue #10273 <https://github.com/anomalyco/opencode/issues/10273> — skill not recognized via `/skill`

**Codex docs:**
- <https://developers.openai.com/codex/skills/create-skill> — `.agents/skills/` formal spec
- <https://developers.openai.com/codex/concepts/customization> — skill scope table
- Issue #14337 <https://github.com/openai/codex/issues/14337> — `~/.codex/skills` deprecation in favor of `~/.agents/skills`
- Issue #16595 <https://github.com/openai/codex/issues/16595> — "`.agents` is an emerging industry standard" quote
- Issue #11314 <https://github.com/openai/codex/issues/11314> — symlink behavior
- Issue #10493 <https://github.com/openai/codex/issues/10493> — global `~/.agents/skills` support

**Anthropic / cross-references:**
- <https://agentskills.my/specification> — Agent Skills open standard (per-platform paths)
- Issue anthropics/claude-code#43875 — Claude Code's `disable-model-invocation` semantics (current bug: skill hidden entirely)
- Issue anthropics/claude-code#51007 — interaction with subagent `skills:` preload
- <https://cursor.com/docs/context/skills> — Cursor's `/<skill-name>` invocation precedent

**Other:**
- <https://opencodeguide.com/en/opencode-skills/> — community guide, mirrors official docs
- <https://www.opencode.live/reference/slash-commands/> — community reference for slash commands
- <https://www.mintlify.com/opencode-ai/opencode/features/custom-commands> — mintlify mirror with extra detail on user vs project scoping
