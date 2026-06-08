# Research: Gemini CLI 0.40.x `.agents/skills/` workspace alias

- **Query**: How does Gemini CLI 0.40.x discover skills under `.agents/skills/` vs `.gemini/skills/`, what's the precedence, can it be disabled, and what frontmatter does it expect?
- **Scope**: external (Gemini CLI source + docs) + light internal cross-reference to Trellis configurators
- **Date**: 2026-05-03

---

## Findings

### 1. Yes, Gemini CLI 0.40.x reads `.agents/skills/` automatically as a workspace alias

Confirmed by source. `packages/core/src/skills/skillManager.ts` on `main` (current at time of research; shipped in 0.40.x):

> ```
> // 4. Workspace skills (highest precedence)
> if (!isTrusted) { … return; }
>
> const projectSkills = await loadSkillsFromDir(storage.getProjectSkillsDir());
> this.addSkillsWithPrecedence(projectSkills);
>
> // 4.1 Workspace agent skills alias (.agents/skills)
> const projectAgentSkills = await loadSkillsFromDir(storage.getProjectAgentSkillsDir());
> this.addSkillsWithPrecedence(projectAgentSkills);
> ```
> — https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/skills/skillManager.ts

Same loader also scans the user-tier alias right after `~/.gemini/skills/`:

> ```
> // 3.1 User agent skills alias (.agents/skills)
> const userAgentSkills = await loadSkillsFromDir(Storage.getUserAgentSkillsDir());
> this.addSkillsWithPrecedence(userAgentSkills);
> ```

**When was it added?** PR #18151 ("feat(core): add `.agents/skills` directory alias for skill discovery") by NTaylorMullen, opened 2026-02-03 and merged into main; documented in PR #19166 (2026-02-15). The alias is therefore present in any Gemini CLI build that includes commits after early February 2026 — which includes the 0.40.0 line (released 2026-04-28) and the 0.40.1 patch reported in issue #224.

> "This PR adds support for `.agents/skills` as an alias for `.gemini/skills` in both user (`~/.agents/skills`) and workspace (`.agents/skills`) directories."
> — https://github.com/google-gemini/gemini-cli/pull/18151

### 2. Precedence and the warning

Discovery order from low → high precedence (later writes override earlier ones in `addSkillsWithPrecedence`):

1. Built-in skills (bundled in `@google/gemini-cli-core`)
2. Extension skills
3. User skills — `~/.gemini/skills/`
4. User agent alias — `~/.agents/skills/`
5. Workspace skills — `.gemini/skills/`
6. **Workspace agent alias — `.agents/skills/` (highest)**

Within a tier, `.agents/skills/` wins. From the official docs page (https://www.geminicli.com/docs/cli/skills/):

> "Within the same tier (user or workspace), the `.agents/skills/` alias takes precedence over the `.gemini/skills/` directory."

When the same skill name appears in two locations with different files on disk, `addSkillsWithPrecedence` emits a non-fatal warning via `coreEvents.emitFeedback('warning', …)`:

> ```
> if (existingSkill && existingSkill.location !== newSkill.location) {
>   …
>   coreEvents.emitFeedback(
>     'warning',
>     `Skill conflict detected: "${newSkill.name}" from "${newSkill.location}" is overriding the same skill from "${existingSkill.location}".`,
>   );
> }
> ```
> — `packages/core/src/skills/skillManager.ts`

So the duplicate-skill messages issue #224 reports are **warnings, not errors**: Gemini still loads the skill (the `.agents/skills/` copy wins), but it complains in stderr/feedback for every name collision.

For built-in collisions the message uses `coreLogger.warn(…)` instead of `emitFeedback`, but the override behavior is identical.

### 3. Is there a knob to disable the `.agents/skills/` alias?

**No dedicated knob exists.** I searched the settings schema, `SkillManager`, and admin overrides. The discovery code path for the workspace alias is unconditional once skills are enabled and the workspace is trusted — there is no per-source toggle (e.g. nothing like `skills.disableAgentsAlias`). The documented `skills` settings are:

| Setting | Default | Effect |
|---|---|---|
| `skills.enabled` | `true` | Master switch. Setting to `false` disables ALL skill discovery (built-in + extension + user + workspace + alias). |
| `skills.disabled` (array) | `[]` | Per-skill blocklist by name. The skill is still discovered but filtered out of `getSkills()`. The duplicate-warning is emitted during the discovery+merge phase, **before** the disabled filter runs, so blocklisting will not silence the warnings. |
| `admin.skills.enabled` | `true` | Enterprise master switch (CCPA-synced). Same all-or-nothing behavior as `skills.enabled`. |
| `admin.skills.disabled` | `[]` | Enterprise per-skill blocklist. Same caveat as above. |

Sources:
- https://github.com/google-gemini/gemini-cli/blob/main/docs/cli/settings.md ("Enable Agent Skills | `skills.enabled` | true")
- `docs/reference/configuration.md` mirror: "`skills.disabled` (array): List of disabled skills. Default `[]`. Requires restart: Yes."
- PR #16406 added `admin.skills.enabled` / `admin.skills.disabled` (2026-01-12).

There is no environment variable or CLI flag that scopes discovery to `.gemini/skills/` only — `gemini --help` for skills exposes `--scope user|workspace` for `enable/disable/install/uninstall`, but `--scope` selects which **settings file** to write to, not which **directory** to scan.

The only way to fully suppress workspace-alias discovery is `"skills": { "enabled": false }`, which is too blunt — it would also kill any built-in skills and any skills the user actually wants from `.gemini/skills/`.

**Workaround that works at the cost of being noisy** — name your skills uniquely. The warning fires only when two locations share a skill `name` (parsed from `SKILL.md` frontmatter), not when they share a directory name. So a Trellis skill named `trellis-check` in `.gemini/skills/trellis-check/SKILL.md` and a Codex skill named `trellis-check` in `.agents/skills/trellis-check/SKILL.md` will collide; renaming the `.gemini/` copy to e.g. `gemini-trellis-check` would silence the warning but creates duplicate content.

### 4. Other alias paths Gemini scans

From `Storage` class methods used in `discoverSkills` (PR #18151 + #15698):

- `~/.gemini/skills/` — user (tier 3)
- `~/.agents/skills/` — user alias (tier 3.1)
- `<workspace>/.gemini/skills/` — workspace (tier 4)
- `<workspace>/.agents/skills/` — workspace alias (tier 4.1)
- Built-in: bundled inside `@google/gemini-cli-core` under `packages/core/src/skills/builtin/`
- Extensions: each extension's `skills/` directory inside `<workspace>/.gemini/extensions/<name>/`

No other roots are scanned. Specifically: there is **no** plain `.skills/` lookup, no `~/.skills/`, no `XDG_*` override.

The workspace alias is also gated by trust:

> ```
> if (!isTrusted) {
>   debugLogger.debug('Workspace skills disabled because folder is not trusted.');
>   return;
> }
> ```

So an untrusted workspace silently skips both `.gemini/skills/` and `.agents/skills/` — that's not a viable opt-out path either (it would also block all other workspace features).

### 5. SKILL.md frontmatter format

YAML frontmatter, two required keys: `name` (string) and `description` (string). Discovered via `glob('*/SKILL.md')` under each skills root. Real example from upstream:

> ```md
> ---
> name: docs-writer
> description: …
> ---
> ```
> — `.gemini/skills/docs-writer/SKILL.md` on `main`

The parser was rewritten in PR #16705 ("refactor(core): harden skill frontmatter parsing", 2026-01-15) to be regex-based and tolerant. Confirmed accepted shapes:

- `name: foo` and `name:foo` (spaces around colon optional)
- Leading whitespace allowed
- `description:` may be a single line, OR a multi-line block scalar (`description: >` then indented lines), OR a folded array of indented continuation lines.

There is one known parser bug filed at issue #25693 (2026-04-20, against 0.38.2; fix landed in PR #25728 before 0.40.0): single-line long descriptions with internal punctuation could fail to parse. Trellis's wrapper produces a single line, but the bug only triggered on specific punctuation patterns and the fix is in 0.40.0+. Worth a quick smoke test against current Trellis output but not a blocker.

Trellis's `wrapWithSkillFrontmatter` (`packages/cli/src/configurators/shared.ts:150`) emits exactly:

```
---
name: <baseName>
description: <SKILL_DESCRIPTIONS[baseName]>
---
<body>
```

That matches the Gemini-accepted format. No `tools:`, `category:`, or other extra keys are required by Gemini; extras are ignored by the parser.

---

## Internal cross-reference (Trellis side, for context)

- `packages/cli/src/configurators/gemini.ts:41-42` — currently writes via `writeSkills(path.join(configRoot, "skills"), …)` → `.gemini/skills/`.
- `packages/cli/src/configurators/codex.ts:28-30` — already writes the SAME shared skill set to `.agents/skills/` via `writeSkills(path.join(cwd, ".agents", "skills"), …)`.
- `packages/cli/src/configurators/shared.ts:150` — `wrapWithSkillFrontmatter` produces Gemini-compatible YAML; same content is reused across both calls. The body still contains `{{CMD_REF:...}}` placeholders that get resolved per-platform (this is the precondition Pi flagged as "not yet safe for shared `.agents/skills/`"; same risk applies if Gemini and Codex both target `.agents/skills/`).

So the duplicate warning in issue #224 will fire on every project that runs `trellis init --gemini --codex` (or installs both at any time): Gemini sees `.agents/skills/trellis-*/SKILL.md` written by Codex AND `.gemini/skills/trellis-*/SKILL.md` written by itself, with identical `name:` frontmatter, and warns once per skill on each Gemini boot.

---

## Caveats / Not Found

- I could not locate a 0.40.x-specific commit hash for the alias (PR #18151 merged earlier and is part of the snowball into 0.40.0); the live `main` source quoted above is the authoritative behavior. If you need to pin to a tag, check `git log --grep "agents/skills"` against the `v0.40.1` tag locally.
- Did not find any community workaround that suppresses the warning without disabling skills entirely. Searched issues for `agents/skills duplicate warning`, `Skill conflict detected`, `disable workspace alias` — nothing directly relevant beyond #19167 (a docs-only issue).
- The trust gate (`isTrusted`) is checked via Gemini's folder-trust system; Trellis projects opened in a trusted folder will always trigger discovery.

---

## Recommendation for Trellis

**Pick option (A) — share via `.agents/skills/` and stop writing `.gemini/skills/`.** Reasons:

1. **No knob exists** to disable Gemini's `.agents/skills/` discovery (option C is dead — the only available switch, `skills.enabled=false`, also kills built-in skills the user wants).
2. **Option B (init-order conditional skip) is brittle** as the PRD already notes — and would still leave duplicate warnings whenever Codex was added after Gemini, until the user re-ran `trellis update`.
3. **The `{{CMD_REF}}` collision risk is real but bounded.** The SAME risk already exists today for Codex+Pi (both target `.agents/skills/`), and the project hasn't shipped a fix. So adopting (A) for Gemini doesn't add new categories of risk; it makes the existing one one platform wider. The clean long-term fix is a separate task: refactor `{{CMD_REF}}` placeholders to render platform-neutral references inside `.agents/skills/` (mentioned in the PRD's "Out of Scope").
4. **Aligns with the upstream design intent.** Gemini's docs literally tell users to prefer `.agents/skills/` for "cross-tool alignment" (issue #19167). Trellis writing to a Gemini-private path is now the off-pattern choice.

**Concrete change shape** (for the implementer, not me):

- In `gemini.ts`, swap `path.join(configRoot, "skills")` → `path.join(cwd, ".agents", "skills")` for the `writeSkills(...)` call that emits the 5 shared trellis-* skills + bundled.
- Keep any Gemini-platform-specific skills (none today, but future-proof) in `.gemini/skills/`.
- Remove the corresponding entries from `collectTemplates()` in `configurators/index.ts:270-298` so `.template-hashes.json` doesn't track files Gemini no longer writes.
- When BOTH Codex and Gemini are configured, only one of them should actually do the write (idempotent: `writeSkills` is content-addressed via the file-writer, so a second writer with identical content is a no-op — but with `{{CMD_REF}}` resolved differently per platform, the second writer WILL overwrite). Either:
  - (a) Gate `writeSkills(.agents/skills, …)` to a single "owner" platform per project, OR
  - (b) Accept that "last init wins" is the current Codex+Pi behavior too, and document the limitation until the placeholder refactor lands.

Pick (b) for this task — it matches existing Trellis behavior, defers the placeholder problem, and resolves issue #224 in a single configurator change.
