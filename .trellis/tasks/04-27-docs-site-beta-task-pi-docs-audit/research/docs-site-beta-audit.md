# Docs-Site Beta Audit: Session Runtime and Pi Agent

## Scope Boundary

This audit covers beta documentation only. Do not update `docs-site/release/**` or `docs-site/zh/release/**` for this task.

## Source of Truth Checked

- `packages/cli/src/types/ai-tools.ts`: Pi Agent is registered as a configured platform with `cliFlag: "pi"`, `agentCapable: true`, and `hasHooks: true`, but `hasPythonHooks: false`.
- `packages/cli/src/configurators/pi.ts`: Pi templates are written to `.pi/prompts`, `.pi/skills`, `.pi/agents`, `.pi/extensions/trellis`, and `.pi/settings.json`.
- `packages/cli/src/templates/pi/extensions/trellis/index.ts.txt`: Pi reads `.trellis/.runtime/sessions/<session-key>.json` and injects task context through extension events.
- `.trellis/workflow.md` and `packages/cli/src/templates/trellis/workflow.md`: the main workflow already includes Pi in relevant platform guidance.
- `.trellis/spec/docs-site/docs/sync-on-change.md`: platform changes must update install docs, multi-platform docs, platform pages/navigation if used, appendices, changelog, and both English/Chinese mirrors.

## P0: Current Beta Sidebar Pages

### `docs-site/start/install-and-first-task.mdx`

Mirrored file: `docs-site/zh/start/install-and-first-task.mdx`

Required updates:

- Add `--pi` to supported `trellis init` flags.
- Change "13 configured platforms" to the correct count including Pi.
- Add Pi to the platform capability table.
- Add Pi to the agent-capable platform list.
- Replace `.current-task` in the generated tree with `.runtime/sessions/<session-key>.json`.
- Add `.pi/` and `.trellis/.runtime/` to the generated tree.
- Rewrite the phase walkthrough where `task.py start` is described as making `.current-task`.
- Rewrite `/trellis:continue` text so it reads session runtime plus task status, not `.current-task`.
- Rewrite the journals paragraph so unfinished task state is described as session-scoped runtime.

### `docs-site/start/everyday-use.mdx`

Mirrored file: `docs-site/zh/start/everyday-use.mdx`

Required updates:

- Add Pi to hook/context-capable platform lists where appropriate.
- Rewrite `continue` as within-session task continuation based on `.trellis/.runtime/sessions/<session-key>.json`.
- Replace examples that say hooks read `.current-task`.
- Rewrite lifecycle hook rows:
  - `after_start`: session runtime is written for the current session.
  - `after_finish`: current session runtime is cleared.
- Clarify that Pi does not use Python hooks; its extension performs Trellis context injection.

### `docs-site/advanced/architecture.mdx`

Mirrored file: `docs-site/zh/advanced/architecture.mdx`

Required updates:

- Add Pi to the high-level platform overview.
- Add Pi to the context-injection model, but describe it as extension-based.
- Rewrite `/trellis:continue` so it no longer says it reads `.current-task`.
- Rewrite the sub-agent context injection diagram:
  - first step reads the session runtime file
  - then resolves the current task directory
  - then reads `prd.md` and JSONL context files
- Update PreToolUse/hook wording so Pi is not incorrectly described as Python-hook based.

### `docs-site/advanced/multi-platform.mdx`

Mirrored file: `docs-site/zh/advanced/multi-platform.mdx`

Required updates:

- Change 13-platform wording to include Pi.
- Add a Pi row to the capability matrix.
- Add a Pi section documenting:
  - `trellis init -u your-name --pi`
  - `.pi/prompts/trellis-{name}.md`
  - `.pi/skills/{name}/SKILL.md`
  - `.pi/agents/{name}.md`
  - `.pi/extensions/trellis/index.ts`
  - `.pi/settings.json`
  - session runtime lookup through the Pi extension
- Replace `.trellis/.current-task` in gitignored/shared-state guidance with `.trellis/.runtime/`.
- Keep `.agents/skills/` as the broader ecosystem layer, but do not use it as the Pi-specific delivery path.

### `docs-site/advanced/custom-commands.mdx`

Mirrored file: `docs-site/zh/advanced/custom-commands.mdx`

Required updates:

- Change platform count from 13 to include Pi.
- Add Pi to the explicit command delivery model.
- Document Pi command path as `.pi/prompts/trellis-{name}.md`.
- Do not classify Pi as skill-only; it has prompts, skills, agents, and an extension.

### `docs-site/advanced/custom-skills.mdx`

Mirrored file: `docs-site/zh/advanced/custom-skills.mdx`

Required updates:

- Change platform count from 13 to include Pi.
- Add Pi skill path: `.pi/skills/{name}/SKILL.md`.
- Confirm skill command behavior against Pi docs/code before writing detailed invocation wording.

### `docs-site/advanced/custom-agents.mdx`

Mirrored file: `docs-site/zh/advanced/custom-agents.mdx`

Required updates:

- Change "10 of 13 configured platforms" to include Pi if Pi sub-agents are documented as a platform primitive.
- Add Pi row with `.pi/agents/{name}.md`.
- Explain that Pi agent files receive a pull-based Trellis prelude and extension-based runtime context.

### `docs-site/advanced/custom-hooks.mdx`

Mirrored file: `docs-site/zh/advanced/custom-hooks.mdx`

Required updates:

- Add an extension-based section for Pi.
- Do not present Pi as a Python-hook platform.
- Document that `.pi/extensions/trellis/index.ts` handles session start, before-agent-start context injection, and Trellis sub-agent delegation.
- Replace any `.current-task` references with session runtime wording.

### `docs-site/advanced/appendix-a.mdx`

Mirrored file: `docs-site/zh/advanced/appendix-a.mdx`

Required updates:

- Replace `.trellis/.current-task` with `.trellis/.runtime/sessions/<session-key>.json`.
- Add `.pi/` paths if the appendix lists platform output paths.
- Mark `.trellis/.runtime/` as gitignored runtime state.

### `docs-site/advanced/appendix-b.mdx`

Mirrored file: `docs-site/zh/advanced/appendix-b.mdx`

Required updates:

- Add Pi to command/platform matrices if those matrices list every configured platform.
- Update `task.py start` description from "set current task" to "set current session task".
- Update `task.py finish` description from "clear current task" to "finish task and clear current session task".

### `docs-site/advanced/appendix-d.mdx`

Mirrored file: `docs-site/zh/advanced/appendix-d.mdx`

Required updates:

- The JSONL format remains correct.
- Replace platform-specific wording like "the hook reads all `.md` files" with platform-neutral wording such as "the context loader reads all `.md` files".
- This matters because Pi uses extension-based context loading and some platforms use pull-based preludes instead of Python hooks.

### `docs-site/advanced/appendix-f.mdx`

Mirrored file: `docs-site/zh/advanced/appendix-f.mdx`

Required updates:

- Add Pi to hook/context-capable platform lists.
- Replace `.current-task` in per-developer state with session runtime.
- Update the "seven platforms upgraded" / "13 platforms" wording to include Pi or rewrite as a version-specific historical note.
- Review stale Cursor claims. The current docs/code treat Cursor as hook-capable and agent-capable, so any beta FAQ text that says otherwise needs to be corrected.

### `docs-site/index.mdx`

Mirrored file: `docs-site/zh/index.mdx`

Required updates:

- Add Pi Agent to the supported platform list.
- Update "10+ platforms" wording if a current platform count is shown.

## P1: Reachable Legacy Beta Pages

These pages are not all present in the current `docs-site/docs.json` beta sidebar, but they still exist and some are linked from other beta pages. They should be updated or deliberately removed from live beta navigation/link paths.

### `docs-site/guides/tasks.mdx`

Mirrored file: `docs-site/zh/guides/tasks.mdx`

Required updates:

- Replace "Set the current task" with "Set the current session task".
- Replace "Only one is current at a time" with "Each session/window has its own active task".
- Replace hook wording that says hooks read `.current-task`.
- Add runtime path: `.trellis/.runtime/sessions/<session-key>.json`.
- Explain that `finish` clears the current session file and `archive` clears stale session files pointing at the task.

### `docs-site/guides/commands.mdx`

Mirrored file: `docs-site/zh/guides/commands.mdx`

Required updates:

- This page is very stale. It still lists removed commands such as `record-session`, `before-backend-dev`, `before-frontend-dev`, `check-backend`, `check-frontend`, `check-cross-layer`, `create-command`, `integrate-skill`, `parallel`, and `onboard`.
- Either update it to the v0.5 command set or remove live links to it.
- `docs-site/quickstart.mdx` still links to this page, so the stale page is reachable.

### `docs-site/quickstart.mdx`

Mirrored file: `docs-site/zh/quickstart.mdx`

Required updates:

- Platform flags are stale and omit current platforms including Pi.
- Old iFlow wording remains.
- Links point to legacy guide pages.
- `docs-site/ai-tools/cursor.mdx` and `docs-site/zh/ai-tools/cursor.mdx` still link here.
- Either update this page or ensure it is not reachable from beta docs.

### `docs-site/guides/faq.mdx`

Mirrored file: `docs-site/zh/guides/faq.mdx`

Required updates:

- Remove iFlow-era and removed-command guidance.
- Replace Cursor limitations that are no longer true.
- Replace "forget to set the current task" guidance with session-scoped runtime guidance.

### `docs-site/concepts/overview.mdx`

Mirrored file: `docs-site/zh/concepts/overview.mdx`

Required updates:

- If this page keeps linking to `/guides/tasks`, update that target page or change the link.
- Refresh the task/context injection explanation so it does not imply a single global current task.

### `docs-site/ai-tools/**`

Mirrored directory: `docs-site/zh/ai-tools/**`

Required updates:

- Current platform pages are old setup pages and are not in the active beta sidebar.
- Cursor pages still link to `/quickstart`, which is stale.
- No Pi page exists.
- Either leave `ai-tools` out of beta navigation and avoid linking users there, or revive the section with a Pi page plus current per-platform setup pages.

### `docs-site/showcase/open-typeless.mdx`

Mirrored file: `docs-site/zh/showcase/open-typeless.mdx`

Required updates:

- The page still describes `/trellis:parallel` and worktree agents as the showcased workflow.
- Since `/trellis:parallel` was removed in 0.5, either mark this as historical or rewrite the workflow using the current task model.

### `docs-site/use-cases/open-typeless.mdx`

Mirrored file: `docs-site/zh/use-cases/open-typeless.mdx`

Required updates:

- The page still uses `/trellis:parallel` in the step-by-step flow and summary table.
- Since this is a live use-case page rather than a changelog, update it or mark it historical.

## P2: Changelog and Historical Pages

### `docs-site/changelog/v0.5.0-beta.14.mdx`

Mirrored file: `docs-site/zh/changelog/v0.5.0-beta.14.mdx`

Required updates:

- The latest beta changelog currently says no migration is needed and `.current-task` is preserved. That is no longer accurate for the next beta after session-scoped runtime.
- Preferred approach: add a new beta changelog entry for the session runtime + Pi docs/code update instead of rewriting older historical entries.
- If beta.14 remains the published "current" page until the next entry exists, add a clear note or replace the inaccurate current-behavior statement in both languages.

### Older changelogs

Recommendation:

- Do not rewrite historical release notes that describe behavior at the time of that release.
- Only update old changelog pages if they are presented as current migration guidance rather than historical notes.

### Blog posts

Recommendation:

- Blog posts can keep older concepts if they are explicitly marked as historical.
- `docs-site/blog/use-k8s-to-know-trellis.mdx` already has a 0.4-era warning, so its `/trellis:parallel` references can remain unless the blog is rewritten.

## Navigation and Page Inventory

### `docs-site/docs.json`

Required checks:

- If a new `ai-tools/pi.mdx` page is added, add it to both English and Chinese navigation.
- If legacy pages remain outside navigation, make sure no current beta sidebar page links users into stale content.
- Release navigation should remain unchanged for this task.

### `docs-site/ai-tools/**`

Current state:

- Existing `ai-tools` pages are old platform setup pages and are not in the active beta sidebar.
- No Pi page exists.

Decision needed during implementation:

- Either add a Pi page and wire the `ai-tools` section back into beta navigation, or keep Pi documentation inside `advanced/multi-platform.mdx` and related appendices.
- Do not create an unlinked Pi page unless docs navigation is updated.

## Verification Checklist

Run these checks before closing the documentation update:

```bash
rg -n "\\.current-task|current-task|13 configured|13 platforms|10 of 13|iFlow|init-context|record-session|before-backend-dev|check-backend|parallel" docs-site --glob '!release/**' --glob '!zh/release/**'
```

Then manually inspect remaining hits:

- Historical changelog references can remain if clearly historical.
- Blog posts can remain if explicitly marked historical.
- Beta start/advanced/guides pages should not contain stale current-behavior claims.

Also verify English/Chinese parity for every edited MDX file.
