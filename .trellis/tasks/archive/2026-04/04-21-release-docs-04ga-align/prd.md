# PRD: Release-track docs alignment to 0.4.0 GA

## Background

`docs-site/release/` (and `docs-site/zh/release/`) was snapshotted from beta on 2026-04-20 (commit `d786abc` "feat(docs): add Beta / Release version dropdown"). The snapshot contains pre-0.4.0-beta.1 content (split backend/frontend commands, 6-platform listings, no monorepo coverage). 0.4.0 GA shipped with those commands merged, 12 platforms, and monorepo support as the headline feature — so users on the "Stable" dropdown see docs that don't match their CLI.

Prior audit: `.trellis/tasks/archive/2026-04/04-20-docs-site-version-audit/research/release-snapshot-audit.md` has the complete findings (commands, platform counts, missing sections, orphan files).

## Goal

Bring `release/` track to accurately reflect 0.4.0 GA. Scope is **alignment, not rewrite** — release track is expected to be eventually overwritten when 0.5 GAs.

## In scope

### 1. Fix command references (medium severity — user actively trips over these)

Replace `/before-backend-dev` + `/before-frontend-dev` → `/before-dev`, `/check-backend` + `/check-frontend` → `/check` in:

- `release/guide/ch02-quick-start.mdx`
- `release/guide/ch04-architecture.mdx`
- `release/guide/ch05-commands.mdx`
- `release/guide/ch06-task-management.mdx`
- `release/guide/ch08-real-world.mdx`
- `release/guide/appendix-f.mdx`
- `release/zh/guide/*` mirrors of all of the above

`ch05-commands.mdx` additionally claims "13 slash commands" but lists 14 rows — fix the count and drop the split rows.

### 2. Update platform counts (minor severity — misleads 0.4 users)

`ch01`, `ch04` architecture listing, `release/index.mdx` tagline, `release/skills-market/trellis-meta.mdx` — all list 6 platforms ("Claude Code, Cursor, Codex, OpenCode, Kilo, Kiro"). Update to the 12 platforms present in 0.4.0 GA (add Gemini CLI, Qoder, CodeBuddy, GitHub Copilot, Windsurf, Factory Droid). Remove Antigravity references (it was added in 0.5).

### 3. Add monorepo coverage (missing — 0.4 headline feature)

0.4.0 GA's main selling point was monorepo-native support. Release guide currently has zero monorepo content. Add a focused section (not a full chapter — keep the release track lean):

- Insert a new §6.X in `release/guide/ch06-task-management.mdx` covering `--package` flag on `task.py create` and `init-context`, plus `.trellis/spec/<package>/` layout.
- Reference the 0.4.0 changelog's monorepo bullet from `ch01-what-is-trellis.mdx` features list.

### 4. Clean up orphan changelog files

78 pre-release changelog MDX files (`release/changelog/v0.3.0-beta.X.mdx`, `release/changelog/v0.4.0-beta.X.mdx`, `release/changelog/v0.5.0-beta.X.mdx`, etc.) sit on disk but have no navigation entry in `docs.json`. Delete them. Mintlify doesn't serve content without navigation anyway.

### 5. Unify non-versioned sections (Use Cases onward)

Marketing / community pages — `use-cases/`, `showcase/`, `blog/`, `skills-market/`, `templates/`, `contribute/` — aren't version-coupled. Currently duplicated under `release/` and `zh/release/`. Delete duplicates and point Release nav at the top-level copies. Keep dual tracks only for `guide/`, `changelog/`, `index.mdx`.

### 6. Multi-platform coverage gap (added 2026-04-21 after deeper audit)

The initial audit research ranked multi-platform errors as "medium". Re-reading 0.3-0.4 changelogs to nail down 0.4.0 GA's platform list revealed they're actually **structural**, not just stale mentions. The 0.4.0 GA platforms are:

1. Claude Code, Cursor, OpenCode, Codex (core)
2. iFlow (0.3.0-beta.16 added, still in 0.4.0, removed in 0.5.0-beta.0)
3. Kilo (0.3.4 renamed `commands/trellis/` → `workflows/`)
4. Kiro (0.3.x)
5. Gemini CLI (0.3.x)
6. Qoder (0.3.4)
7. GitHub Copilot, Windsurf, Factory Droid (0.4.0 new)

= **12 platforms**. CodeBuddy is **NOT** in 0.4.0 (landed in 0.5).

Fixes required:

- **`ch13-multi-platform.mdx`**: currently has §13.1–§13.5 covering Claude Code / Cursor / Codex / Kilo / Kiro, plus §13.5b CodeBuddy. Delete the CodeBuddy section. Add dedicated sections for iFlow, OpenCode, Gemini CLI, Qoder, GitHub Copilot, Windsurf, Factory Droid — each with install command + directory layout + notable caveats.
- **`ch02-quick-start.mdx`**: the `<Tab>` group lists 7 platforms (Claude Code / Cursor / Codex / OpenCode / Kilo / Kiro / CodeBuddy). Drop CodeBuddy, add 6 missing platforms. Directory-location and capability-comparison tables need same treatment.
- **`appendix-a.mdx`**: has per-platform "Configuration" sections for Cursor, Codex+OpenCode (merged weirdly), Kilo, Kiro. Split Codex and OpenCode into separate sections; add iFlow, Gemini CLI, Qoder, Copilot, Windsurf, Droid layouts.
- **`appendix-b.mdx`**: command-matrix header lists 5 platforms. Extend to 12; add per-platform invocation syntax notes below the table.
- **`appendix-f.mdx`**: Q14–Q17 are Kilo/Kiro/OpenCode era-appropriate — keep. No new FAQs needed.

ZH mirrors: same files under `zh/release/guide/`.

## Out of scope

- Complete parity audit against every page (not needed — `release-snapshot-audit.md` confirmed 0 severe errors, no 0.5 concepts leaked in)
- Rewriting release/ chapters for stylistic updates
- Any beta-track changes (beta audit is done, branch at `feat/docs-beta8-alignment`)
- Promoting beta → release when 0.5 GAs (separate task, not this one)

## Acceptance criteria

- [ ] No occurrences of `/before-backend-dev`, `/before-frontend-dev`, `/check-backend`, `/check-frontend`, `/trellis-check-backend`, `/trellis-before-backend-dev` in any `release/guide/` or `release/zh/guide/` file (grep returns empty).
- [ ] Platform count in `release/index.mdx` + `release/guide/ch01-what-is-trellis.mdx` + `release/guide/ch04-architecture.mdx` + `release/skills-market/trellis-meta.mdx` matches the 12-platform reality of 0.4.0 GA.
- [ ] `release/guide/ch06-task-management.mdx` has a monorepo section covering `--package` + `.trellis/spec/<package>/` layout.
- [ ] `ch01-what-is-trellis.mdx` features list mentions monorepo.
- [ ] 78 orphan pre-release changelog MDX files deleted.
- [ ] `docs-site` Mintlify dev server renders `/release/` paths without parse errors.
- [ ] Changes committed to `docs-site` feat branch and pushed.
- [ ] `release/guide/ch13-multi-platform.mdx` has sections for all 12 0.4.0 GA platforms; CodeBuddy section removed.
- [ ] `release/guide/ch02-quick-start.mdx` `<Tab>` group covers all 12 platforms; CodeBuddy tab removed.
- [ ] `release/guide/appendix-a.mdx` + `release/guide/appendix-b.mdx` per-platform layouts extended to all 12; Codex / OpenCode split into their own sections in appendix-a.
- [ ] ZH mirrors updated in lockstep.

## Notes

Don't bikeshed; this is cleanup. If something in the audit research file conflicts with real 0.4.0 GA source code, the source wins — grep `git log --oneline v0.4.0^..v0.4.0 -- packages/cli/src/` or the 0.4.0 release manifest when in doubt.
