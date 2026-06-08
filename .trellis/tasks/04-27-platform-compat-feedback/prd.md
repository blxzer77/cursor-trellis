# Platform Compat Feedback (v0.5.0-beta): Claude statusLine & OpenCode skill/cmd dup

## Goal

Triage and resolve two user-reported platform-integration issues that landed during the v0.5.0-beta cycle. Both fall under "Trellis writes platform configs that step on the user's own setup or duplicate themselves across multi-platform installs." The two items can ship as separate PRs but share research surface (per-platform skill/command capability matrix), so they are tracked together.

## What I already know

### Issue 1 — Claude Code project-level `statusLine` overrides user-global

- **Where it's written**: `packages/cli/src/templates/claude/settings.json:5-8`
  ```json
  "statusLine": {
    "type": "command",
    "command": "{{PYTHON_CMD}} .claude/hooks/statusline.py"
  }
  ```
- **Hook source**: `packages/cli/src/templates/shared-hooks/index.ts:73` (statusline.py listed in `SHARED_HOOKS_BY_PLATFORM.claude`).
- **Configurator**: `packages/cli/src/configurators/claude.ts:54` runs placeholder resolution and writes settings.json into `.claude/`.
- **Platform behavior** (verified via official docs, see Research References):
  - `statusLine` is a **scalar** setting → higher-scope wins, no merge.
  - Precedence order (top wins): Managed → CLI args → `.claude/settings.local.json` → `.claude/settings.json` (project) → `~/.claude/settings.json` (user) → defaults.
  - There is **no** documented mechanism (no `null`, no `false`, no inherit keyword) for project settings to "decline" `statusLine` and fall back to the user setting.
  - Workaround on the user side: override in `.claude/settings.local.json` (gitignored, per-user). But Trellis's default still silently overrides on first init.

### Issue 2 — OpenCode duplicates `continue` / `finish-work` as both command and skill

- **Where it's written**: `packages/cli/src/configurators/opencode.ts:77-82`
  ```ts
  for (const cmd of resolveCommands(ctx)) {
    files.set(`.opencode/commands/trellis/${cmd.name}.md`, cmd.content);
  }
  for (const skill of resolveSkills(ctx)) {
    files.set(`.opencode/skills/${skill.name}/SKILL.md`, skill.content);
  }
  ```
- **Symptom**: when a user inits both `codex` + `opencode`, opencode shows `continue` and `finish-work` twice — once as `/continue` slash command, once as a skill auto-trigger.
- **Trellis's original intent** (per CC convention): keep `continue` + `finish-work` as commands so they don't auto-trigger; ship the rest as skills. That intent makes sense for Claude Code, but opencode's command/skill semantics differ.
- **User's two findings** (need to validate via research):
  - **Finding A**: opencode skills can be made non-auto-triggerable by adding `disable-model-invocation: true` to skill frontmatter → would let us collapse commands+skills into "skills only" without losing the "manual-only" guarantee for `continue`/`finish-work`.
  - **Finding B**: opencode loads skills from `.agents/skills/` (a *shared* directory used by codex too). If true, `.opencode/skills/` is redundant when codex is also installed → could share files instead of duplicating.
  - **Finding C** (uncertain): user reports `/<skill-name>` slash invocation does **not** work in opencode, but `/skills <name>` does. Needs confirmation; affects whether we can collapse to skills-only.

### Issue 3 — Claude Code Bash cannot run `task.py start` after session-scoped task state

- **Symptom**: in a fresh Claude Code session, the AI creates a task directory, then `python3 ./.trellis/scripts/task.py start <task>` fails with:
  ```text
  Error: Cannot set active task without a session identity.
  Hint: run inside an AI IDE/session that exposes session identity, or set TRELLIS_CONTEXT_ID before running task.py start.
  ```
- **Root cause**: Claude Code hooks and statusLine receive `session_id` / `transcript_path` through stdin, but a later AI-run `Bash(...)` command has no hook stdin. Trellis passed `TRELLIS_CONTEXT_ID` only to subprocesses launched by `session-start.py`; it did not persist that value into Claude Code's Bash environment.
- **Platform contract**: Claude Code SessionStart exposes `CLAUDE_ENV_FILE`. Lines appended to that file are exported into subsequent Bash commands in the same session.
- **Required fix**: shared `session-start.py` must append `export TRELLIS_CONTEXT_ID=<context-key>` to `CLAUDE_ENV_FILE` when available. Then `task.py start/current/finish` can remain session-scoped without requiring manual user setup.

### Issue 4 — OpenCode TUI Bash cannot run `task.py start` without manual fake context

- **Symptom**: in OpenCode TUI 1.14.22, a freshly created task fails to start with the same session identity error:
  ```text
  Error: Cannot set active task without a session identity.
  Hint: run inside an AI IDE/session that exposes session identity, or set TRELLIS_CONTEXT_ID before running task.py start.
  ```
- **Bad workaround observed**: the model can run `TRELLIS_CONTEXT_ID="test-session-$(date +%s)" python3 ... task.py start ...`, but that creates an arbitrary runtime session unrelated to the real OpenCode conversation.
- **Root cause**: `opencode run` exposes `OPENCODE_RUN_ID` to Bash, but OpenCode TUI can omit that env var from the Bash tool. The plugin hook still receives `sessionID`.
- **Required fix**: OpenCode `tool.execute.before` must inject `TRELLIS_CONTEXT_ID` before Bash commands execute, using the same JS resolver as session-start and subagent prompt injection. The command prefix must be shell-aware: POSIX shells use `export TRELLIS_CONTEXT_ID=<context-key>;`, while Windows PowerShell uses `$env:TRELLIS_CONTEXT_ID = '<context-key>';`.

### Issue 5 — Cursor Bash cannot run `task.py start` after task creation

- **Symptom**: Cursor Agent can create `.trellis/tasks/<task>/`, but `python3 ./.trellis/scripts/task.py start <task>` fails with the session identity error.
- **Bad workaround observed**: the model can run `TRELLIS_CONTEXT_ID=manual-test python3 ... task.py start ...`, but that creates a fake session runtime file unrelated to the Cursor conversation.
- **Root cause**: Cursor hook input has `conversation_id` / `session_id`, but Cursor's ordinary shell command does not inherit SessionStart environment output. Trellis only used that identity inside hook subprocesses.
- **Required fix**: Cursor `beforeShellExecution` must write a short-lived runtime ticket for matching `task.py start/current/finish` commands, and `task.py` must consume that ticket when no normal session identity exists.

### Issue 6 — Pi Agent Bash cannot run `task.py start` without manual fake context

- **Symptom**: Pi Agent can create a task directory, but a plain `python3 ./.trellis/scripts/task.py start <task>` has no session identity. The model can only make it work by inventing `TRELLIS_CONTEXT_ID=pi-test-session`, which creates a fake runtime file unrelated to the real Pi session.
- **Root cause**: Pi exposes session identity to extensions through `ctx.sessionManager.getSessionId()`, not as an ordinary Bash environment variable. Trellis's Pi extension only injected prompt context and sub-agent tools; it did not mutate Bash tool calls.
- **Required fix**: the generated `.pi/extensions/trellis/index.ts` must derive `pi_<session-id>` from `ctx.sessionManager.getSessionId()`, prefix Bash tool calls in `tool_call` with `export TRELLIS_CONTEXT_ID=<context-key>;`, and pass the same env var when spawning Pi subagents.

### Issue 7 — Cursor custom sub-agent `preToolUse.updated_input` not reached

- **Symptom**: Cursor can create/start the task in the main conversation, but a spawned `trellis-implement` sub-agent does not receive the `implement.jsonl` content when the user asks it to verify a marker without using tools. The sub-agent reports `INJECTION_MISSING`.
- **Current evidence**: Cursor forum staff marked the exact `Task` `updated_input` bug fixed on April 7, 2026. Current docs still define `preToolUse.updated_input` as a plain object and local Cursor 3.2.11 validates the same shape.
- **Root cause**: Cursor 3.2.11 can emit sub-agent spawns as `tool_name: "Subagent"` while Trellis's Cursor hook config matched only `Task`; the project hook did not run. Also, native Cursor custom-subagent args can encode the agent name as protobuf-shaped objects such as `subagent_type.custom.name`, so the parser must handle more than the string form.
- **Required fix**: keep Cursor in hook-inject mode, match `Task|Subagent`, and teach `inject-subagent-context.py` to extract Trellis agent names from both string and native Cursor custom-subagent payloads.

## Research References

- [`research/claude-code-settings-precedence.md`](research/claude-code-settings-precedence.md) — Claude Code: `statusLine` is scalar, project fully overrides user, only escape is `.claude/settings.local.json` (gitignored, per-user).
- [`research/opencode-skills-vs-commands.md`](research/opencode-skills-vs-commands.md) — Done. Key takeaways:
  - **Finding A (`disable-model-invocation`)**: NOT supported in opencode. Only 5 frontmatter fields recognized: `name`, `description`, `license`, `compatibility`, `metadata`. Feature request opencode#11972 open + unmerged.
  - **Finding B (`.agents/skills/` shared)**: TRUE. Opencode added formal support Feb 3 2026 (PR #11842, ~v1.1.50). Codex CLI also formally scans `.agents/skills/` and is deprecating `~/.codex/skills/` in favor of `~/.agents/skills/`. OpenAI engineer calls it "an emerging industry standard."
  - **Finding C (slash invocation)**: Both `/<skill-name>` (opencode PR #11390, Jan 31 2026) and `/skills` picker work in opencode TUI. No `/skill:<name>` form.
  - **Caveat 1**: opencode `.agents/skills/` requires v ≥ ~1.1.50 (Feb 2026). Older versions silently miss. Need min-version doc or fallback.
  - **Caveat 2**: Worktree-root gotcha (opencode#12741) — when CWD === git worktree root, opencode's `Filesystem.up()` skips it; `.agents/skills/` at repo root silently missed in versions ≤ v1.3.0. User workaround: `ln -s .agents .opencode`.

## Assumptions (temporary)

1. We will **not** ask Claude Code / opencode upstream for new platform features — Trellis must adapt within current platform contracts.
2. Existing installs must not be silently broken on `trellis update`. Migration manifests should be additive (delete is OK only behind a confirm prompt).
3. The fix scope is `packages/cli/src/` only — no changes to `.trellis/scripts/` runtime, except for Issue 3 which by definition lives there.

## Open Questions (Blocking / Preference only)

### Q1 — statusLine default

For new `trellis init` runs, should `statusLine` be:

1. **Off by default**, opt in via `--with-statusline` flag (and interactive prompt in non-`-y` mode). *Recommended — least-surprise; respects user's global config.*
2. **On by default**, opt out via `--no-statusline`. *Compatible with existing behavior, but the original complaint stands for new users.*
3. **Detect-based**: read `~/.claude/settings.json`, default off if user already has a statusLine, otherwise on. *Smart but more code; cross-platform path resolution.*

### Q2 — Existing-install migration for statusLine

When users run `trellis update` after we change the default:

1. **Leave existing `.claude/settings.json` `statusLine` intact** (no auto-removal). New flag only governs new inits. *Safe but inconsistent.*
2. **Prompt during update** ("Trellis statusLine is now opt-in; remove from this project?"). *Best UX, more code.*
3. **Migration manifest deletes the `statusLine` key**. *Clean but breaks any user who actually wanted it.*

### Q3 — OpenCode redesign scope — **DECIDED: Approach 3 (share via `.agents/skills/`)**

Research [opencode-skills-vs-commands.md](research/opencode-skills-vs-commands.md) ruled out the alternatives:

- ❌ **Approach 2 (skills-only with `disable-model-invocation`)**: opencode does not recognize that frontmatter field; converting commands → skills means losing the manual-only guarantee for `continue`/`finish-work`.
- ❌ **Approach 1 (conditional skip)**: leaves opencode-only users without auto-invokable skills and adds fragile cross-platform conditional logic.
- ✅ **Approach 3**: write SKILL.md to `.agents/skills/<name>/` (codex + opencode both read it natively), keep `.opencode/commands/trellis/{continue,finish-work}.md` as opencode's manual-only slash commands, drop the redundant `.opencode/skills/` and `.codex/skills/` writes.

**Concrete deltas**:
- New writer: `.agents/skills/<name>/SKILL.md` shared by codex + opencode.
- Stop writing `.codex/skills/<name>/` and `.opencode/skills/<name>/` for the shared skill set.
- Keep writing `.opencode/commands/trellis/{continue,finish-work}.md` (manual-only slash + supports `$ARGUMENTS`/`@file`/`!bash` placeholders).
- Migration manifest deletes the now-stale `.codex/skills/` and `.opencode/skills/` dirs.
- Document min opencode version (`~1.1.50`, Feb 2026) and worktree-root gotcha (#12741) in CHANGELOG / docs.

## Requirements (evolving — will firm up after research + Q&A)

- [ ] New `trellis init` no longer silently overrides user-global Claude Code statusLine.
- [ ] Users have a documented, single-flag way to enable statusLine if they want it.
- [ ] OpenCode no longer ships duplicate `/continue` + `continue`-skill pair when codex is also installed.
- [ ] Claude Code AI-run Bash commands inherit `TRELLIS_CONTEXT_ID` after SessionStart, so `task.py start` works without manual env setup.
- [ ] OpenCode AI-run Bash commands inherit `TRELLIS_CONTEXT_ID` from plugin session identity on POSIX shells and Windows PowerShell, so `task.py start` works without manual env setup.
- [ ] Cursor AI-run Bash commands get conversation-scoped task identity through `beforeShellExecution`, so `task.py start` works without manual env setup.
- [ ] Pi Agent AI-run Bash commands inherit `TRELLIS_CONTEXT_ID` from extension session identity, so `task.py start` works without manual env setup.
- [ ] Cursor sub-agent prompt injection runs for `Task` and `Subagent` tool names, and handles both string and native custom-subagent `subagent_type` payloads.
- [ ] All existing tests stay green; new tests cover: statusLine flag matrix, opencode dedup logic.

## Acceptance Criteria (evolving)

- [ ] `trellis init --claude` (no other flags) does **not** write a `statusLine` field into `.claude/settings.json`.
- [ ] `trellis init --claude --with-statusline` (or equivalent post-Q1 decision) writes the existing `statusLine` block.
- [ ] `trellis init --opencode --codex` produces no duplicated `/continue` + `continue` skill in opencode.
- [ ] `trellis update` on an existing project respects the Q2 decision (no surprise removals).
- [ ] Migration manifest shipped under `0.5.0-beta.X.json` documents the behavior change.
- [ ] CHANGELOG.md and the relevant docs page note the new flag and the rationale.

## Definition of Done

- Tests added: statusLine flag handling, opencode skill/command file-set, migration manifest application.
- `pnpm test` + `pnpm lint` green.
- Manual smoke test: fresh `trellis init` on a scratch repo for both default and `--with-statusline`; both `--opencode` alone and `--opencode --codex` combinations.
- Regression test added to `test/regression.test.ts`: opencode dedup, statusLine default off.
- Docs/site updated: any `docs/` pages referencing statusLine + opencode setup.

## Out of Scope (explicit)

- Other platforms' statusline equivalents (only Claude Code has one currently).
- Redesigning `SHARED_HOOKS_BY_PLATFORM` — only the `claude.statusline.py` membership may change.
- Cursor / iFlow / Gemini / Qoder skill/command layout — only opencode (+ possibly codex shared dir) is in scope.
- Renaming any user-facing skill/command names.
- Building a generic "user opt-out registry" — the two flags here are enough.

## Technical Approach (draft, subject to research outcome)

### Issue 1 (statusLine)

1. Add CLI flag `--with-statusline` (commander auto-generates `--no-with-statusline`) to `init` command at `packages/cli/src/cli/index.ts`.
2. Plumb the flag through `init.ts` → `configurePlatform(platformId, cwd, options)`. Today configurePlatform takes `(platformId, cwd)` — needs an options-bag refactor (touches `configurators/index.ts:468`, all 9 platform configurators' signatures).
3. In `configurators/claude.ts`, after loading settings.json content:
   - if `withStatusline === false`, delete the `statusLine` key from the parsed JSON before writing.
   - if `withStatusline === false`, also skip writing `statusline.py` (filter `SHARED_HOOKS_BY_PLATFORM.claude`).
4. Print a one-liner at end of init: `💡 To enable Trellis statusLine later, re-init with --with-statusline; or override per-machine in .claude/settings.local.json.`
5. Migration manifest `0.5.0-beta.X.json`: document the behavior change. Per Q2 outcome, decide whether to delete the field or leave it.

### Issue 2 (opencode dedup)

Pending research outcome (Q3). Most likely path:
- If Finding A confirms `disable-model-invocation: true` in opencode skills → collapse to skills-only, remove `.opencode/commands/` writes, add the frontmatter to the two formerly-command entries.
- If Finding B confirms `.agents/skills/` shared loading → in a follow-up task, migrate codex + opencode + any other compatible platform to read from `.agents/skills/`.

## Decision (ADR-lite) — to be filled after Q1/Q2/Q3 are answered

**Context**: TBD
**Decision**: TBD
**Consequences**: TBD

## Technical Notes

### Files likely to change

- `packages/cli/src/cli/index.ts` — add `--with-statusline` flag.
- `packages/cli/src/commands/init.ts` — propagate flag; default-off interactive confirm in non-`-y` mode.
- `packages/cli/src/configurators/index.ts` — extend `configurePlatform` signature.
- `packages/cli/src/configurators/claude.ts` — skip statusLine write when disabled.
- `packages/cli/src/configurators/opencode.ts` — drop `.opencode/commands/` write (pending Q3); add `disable-model-invocation` to skill frontmatter for the two formerly-command entries.
- `packages/cli/src/templates/shared-hooks/index.ts` — filter `statusline.py` from claude when disabled (or move filter into configurator instead).
- `packages/cli/src/migrations/manifests/0.5.0-beta.X.json` — new manifest.
- `test/configurators/platforms.test.ts`, `test/regression.test.ts` — coverage.
- `CHANGELOG.md`.

### Constraints

- Repo style is in-process file-write registry (`writeFile` + `writeMode`) — no shell-out.
- Migration manifests are JSON-only (rename / delete / rename-dir actions). Cannot run arbitrary code; if we need a "prompt user" step on update, that's a code path in `update.ts`, not the manifest.
- Tests use Vitest 4.x with `test/` mirroring `src/`.

### User feedback source (for traceability)

- Issue 1: cross-channel user report after upgrading to v0.5.0-beta (channel/screenshot not preserved).
- Issue 2: user message + WeChat screenshots in this conversation thread (Saturday 16:01 messages).
