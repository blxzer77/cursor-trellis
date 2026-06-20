# Changelog

All notable changes to **@blxzer/trellis** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Versions before 1.0.0 (the `0.x` / `0.6.0-beta.x` series) are not itemized
> here. For the full pre-1.0 history, browse the git tags:
> ```bash
> git tag -l "v0.*" --sort=-creatordate
> ```

---

## [Unreleased]

Three fixes — the third is the one that finally makes Request Triage work on Cursor.

### Added
- **Cursor `.cursor/rules` injection channel.** Trellis's Cursor configurator
  now ships `.cursor/rules/*.mdc` (template + init/update writes + hash
  tracking). The first rule, `trellis-triage.mdc` (`alwaysApply: true`), carries
  the Request Triage hard gate (decision tree + `[Triage: <Mode>] <reason>`
  classification mark + consent gate) through Cursor's reliable rules-injection
  path. This works around Cursor's confirmed `sessionStart.additional_context`
  bug (forum #158452, no ETA) — the Triage rules in `.trellis/workflow.md` never
  reached the agent via sessionStart; rules are prepended before every prompt on
  a separate, working channel. Verified: agents now emit the `[Triage: ...]`
  mark and ask for task-creation consent on Cursor, matching Claude/OpenCode.

### Fixed
- **`trellis update` no longer hangs in non-interactive contexts.** When stdin
  is not a TTY (backgrounded shells, CI, redirected stdin) and no explicit
  consent flag (`--force` / `--skip-all` / `--create-new`) or `--dry-run` is
  passed, `update` now throws a clear error guiding the operator to a consent
  flag instead of blocking forever on `inquirer.prompt`. Interactive terminals
  are unaffected.
- **`pnpm release:publish` publishes both packages in dependency order.** New
  `scripts/publish-packages.js` (+ `release:publish` / `release:publish:dry`
  script entries) builds and publishes `@blxzer/trellis-core` first, then
  `@blxzer/trellis`, with a version-parity guard and an npm-auth guard. This
  closes the gap where the release flow bumped core's `package.json` and
  tagged it, but never published it to npm (core's 1.1.0 was never published;
  1.1.1 was missed until the manifest-continuity gate caught it during 1.1.2).

---

## [1.1.2] — 2026-06-19

Patch release with three documentation/template hardenings from the
post-1.1.0 review (optimization backlog #12 / #13 / #15).

### Changed
- **Request Triage is now a hard gate.** The `### Request Triage` section in
  `workflow.md` was upgraded from prose suggestions to a mandatory
  classification step with a 5-step first-match-wins decision tree (No Task /
  Micro-Grill / Lite / Full / Parent) and a `[Triage: <Mode>] <reason>`
  classification mark that must start every work-capable reply. The Task
  Ladder table gained a "Trigger signals" column to reduce misclassification.
  Cursor per-turn `UserPromptSubmit` injection remains a separate follow-up.
- **smart-search is the mandatory first web tool.** `AGENTS.md` (template) and
  `retrieval-daily-guide` now state that smart-search is the required first
  choice for any external/web fact, with Cursor `WebSearch` / `WebFetch` as
  downgrade-only fallbacks (not co-equal options).
- **Command surface clarified.** `AGENTS.md` (template) now distinguishes
  user-invocable commands (`/trellis-continue`, `/trellis-finish-work`) from
  internal auto-triggered skills (brainstorm / before-dev / check / break-loop
  / update-spec / micro-grill / meta / spec-bootstrap / skill-creator /
  smart-search-cli) that should not be invoked manually through the slash
  palette.

### Release engineering
- **release.js fork policy.** The release orchestrator now pushes to the
  `private` remote (not `origin`, which is absent in this fork) and always
  pushes the current branch HEAD rather than a hardcoded `main`, so releases
  can be cut from any working branch.

---

## [1.1.1] — 2026-06-18

Version-only patch bump. No template or runtime changes beyond the version
fields; a maintenance release following 1.1.0 to refresh the published npm
tarball. Users on 1.1.0 can `trellis update` as a clean version bump.

---

## [1.1.0] — 2026-06-18

First minor after 1.0.x stable. Ships the Cursor-first template overhaul and
Cursor++ BYOK subagent model routing from the 1.0.3 follow-up commits, plus a
pre-release trim and workflow gate UX improvements.

### Added
- **Cursor++ BYOK subagent model routing (Method 2.5 bundle).** Ships the
  publishable Cursor++ BYOK bundle (`.trellis/local/cursor2plus/` reversible
  `WPeLc8` patch), the `trellis-cursor2plus-setup` bundled skill, and tests.
  BYOK users can now route each `trellis-research` / `trellis-implement` /
  `trellis-check` Task dispatch to an independent model slug from
  `~/.ccursor/providers.json`, evaluated before the inherit-parent branch.
  Verified on Cursor++ v0.0.11.
- **Cursor-first template overhaul.** brainstorm / spec-bootstrap / shared
  hooks templates aligned to the Cursor-first flow; `smart-search` resolution
  wired into the CLI; session-start hint emitted on new sessions.
- **`--cursor2plus` init flag.** Forces the Cursor++ BYOK local bundle to be
  written during `trellis init` (requires `--cursor`). Interactive mode now
  asks "使用 Cursor++ BYOK 代理?" (default No) when Cursor is selected.
- **Auto-recording planning gates.** `requirements-review` and
  `architecture-review` gates auto-record on `start-execution --approved`
  when planning artifacts pass CLI checks. `record-gate` retained as manual
  override.

### Changed
- **Cursor++ BYOK assets are now opt-in.** `.trellis/local/cursor2plus/` is
  no longer written by default on `trellis init`. `trellis update` refreshes
  it only when the directory already exists (existing BYOK installs
  unaffected).
- **Cursor subagent entry-point clarity.** A "Quick reference: which entry
  point am I using?" decision tree added at the top of
  `cursor-subagent-policy.md`. Each `trellis-{research,implement,check}.md`
  agent gained a one-line dispatch-path comment.
- **micro-grill naming clarification.** `grill-me` / `grill-with-docs`
  references in the brainstorm skill resolved to the authoritative names
  (`trellis-micro-grill`, `trellis-brainstorm` Phase B PRD Grill).
- **AGENTS.md remote policy** now says "only push to `private`
  (`blxzer77/trellis-private`); never push to `origin` or re-add
  `mindfold-ai/Trellis` as a remote".

### Removed
- **`trellis-spec-bootstarp` bundled skill.** Deprecated typo alias for
  `trellis-spec-bootstrap`; "one release cycle" retention elapsed; reference
  files were byte-identical duplicates. Hash entries auto-prune on update.
- **`trellis-publish-skill` command** (`.cursor` + `.claude`). The
  publish-skill workflow (marketplace → docs-site sync) no longer exists;
  command was never registered in the CLI.

### Migration
No `--migrate` flag required. `trellis update` from 1.0.x is a plain version
bump. For fresh `trellis init`, the only breaking-ish change is that BYOK
assets require opt-in (`--cursor2plus` or answering Yes).

---

## [1.0.3] — 2026-06-16

### Fixed
- **test(shared-hooks):** enumerate `research-end-retrieval-pack` in
  `ALL_HOOK_FILES` so the shared-hooks regression test covers the Phase B
  hook added in 1.0.2.

---

## [1.0.2] — 2026-06-16

### Added
- **Phase B research-end hooks.** The `stop` hook (Cursor) / `Stop` hook
  (Claude) now scans the selected task for research artifacts and smart-search
  manifests, writes a scored `{TASK}/research/retrieval-pack-latest.json`,
  and emits a hint citing top ranked items for `verify.md`.

---

## [1.0.1] — 2026-06-15

### Added
- **Phase 1 optimization templates.** Orchestration agents + smart-search
  wiring, Parent/Child subagent prompt, Task Ladder quick routing.
- **Phase 2 research hook** + PC subagent prompt groundwork.
- **docs(workflow):** retrieval-pack evidence scoring hookup; Phase 3 Task
  Ladder quick routing.
- **docs(readme):** stable `@blxzer/trellis` install and harness note.

---

## [1.0.0] — 2026-06-15

First stable release of the `@blxzer/trellis` fork. Promotion from the
`0.6.0-beta` series with the optimization templates, Cursor-first flow, and
smart-search vendor integration finalized.

### Notes
- Stable baseline. No new `src/` changes beyond the beta series promotion.
- Establishes the 1.x version line for downstream users.
- Users on any `0.6.0-beta.x` can `trellis update` as a clean version bump.

---

[1.1.2]: https://github.com/blxzer77/cursor-trellis/releases/tag/v1.1.2
[1.1.1]: https://github.com/blxzer77/cursor-trellis/releases/tag/v1.1.1
[1.1.0]: https://github.com/blxzer77/cursor-trellis/releases/tag/v1.1.0
[1.0.3]: https://github.com/blxzer77/cursor-trellis/releases/tag/v1.0.3
[1.0.2]: https://github.com/blxzer77/cursor-trellis/releases/tag/v1.0.2
[1.0.1]: https://github.com/blxzer77/cursor-trellis/releases/tag/v1.0.1
[1.0.0]: https://github.com/blxzer77/cursor-trellis/releases/tag/v1.0.0
