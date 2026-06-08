# Session Identity Platform Survey

Date: 2026-04-25

## Question

Can Trellis resolve `current-task` at AI session/window scope across supported platforms, instead of using only the repo-global `.trellis/.current-task` file?

## Local Environment

Installed locally:

- Claude Code: `2.1.120`
- Codex CLI: `0.124.0`
- OpenCode: `1.14.22`
- Gemini CLI: `0.27.4`
- Droid: `0.100.0`
- Pi: `0.70.0`
- Cursor IDE/editor CLI: `3.1.17`

Not found locally:

- `qoder`, `qodercli`
- `codebuddy`
- `kiro`
- `kilo`
- `antigravity`
- `windsurf`
- `copilot`

## Source Links

- Claude Code hooks: https://code.claude.com/docs/en/hooks
- Claude Code statusline: https://code.claude.com/docs/en/statusline
- Codex hooks: https://developers.openai.com/codex/hooks
- OpenCode plugins: https://opencode.ai/docs/plugins/
- OpenCode server/SDK: https://opencode.ai/docs/server/ and https://opencode.ai/docs/sdk/
- OpenCode generated types: https://github.com/anomalyco/opencode/blob/dev/packages/sdk/js/src/gen/types.gen.ts
- Gemini CLI hooks reference: https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md
- Factory Droid hooks reference: https://docs.factory.ai/reference/hooks-reference
- Qoder hooks: https://docs.qoder.com/qoderwork/hooks
- CodeBuddy hooks: https://www.codebuddy.ai/docs/cli/hooks
- GitHub Copilot hooks: https://docs.github.com/en/copilot/reference/hooks-configuration and https://docs.github.com/en/copilot/how-tos/copilot-cli/customize-copilot/use-hooks
- Cursor CLI docs: https://docs.cursor.com/en/cli
- Cursor hooks docs: https://cursor.com/docs/hooks
- Kiro CLI hooks: https://kiro.dev/docs/cli/hooks/
- Pi extension docs: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md

## Platform Matrix

| Platform | Session identity in docs | Current Trellis integration | Local verification | Verdict |
|---|---|---|---|---|
| Claude Code | Yes: hook stdin and statusline stdin include `session_id` and `transcript_path` | Shared Python hooks plus `statusline.py` | Mock statusline payloads with different `session_id` rendered the same global task | Tier 1: implement session resolver first |
| Codex CLI | Yes: official hook docs list `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `model` | `.codex/hooks.json` with SessionStart and UserPromptSubmit | Mock `.codex/hooks/session-start.py` payloads with different `session_id` produced the same global task status | Tier 1: use same Python resolver; requires `features.codex_hooks = true` |
| OpenCode | Yes, but through plugin/SDK shape: plugin input uses `sessionID`; session APIs and event types use session IDs | JS plugin and `TrellisContext.getCurrentTask()` | `opencode session list --format json` returned real session IDs; direct `chat.message` plugin calls for two `sessionID`s injected the same global task | Tier 1: add JS-side resolver or call Python resolver |
| Gemini CLI | Yes: hook base input has `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `timestamp` | Shared Python SessionStart/UserPromptSubmit hooks | `gemini --list-sessions` works locally; no project sessions found. Shared hook mock currently ignores `session_id` | Tier 1: shared resolver covers it |
| Droid | Yes: Factory docs list `session_id`, `transcript_path`, `cwd`, `permission_mode`, `hook_event_name` | Shared Python hooks in `.factory/settings.json` template | Local CLI/help verified; no live hook fired to avoid starting a model run. Shared hook mock behavior applies | Tier 1: shared resolver covers it |
| Qoder | Yes: docs list `session_id`, `transcript_path`, `cwd`, `hook_event_name` | Shared Python hooks in `.qoder/settings.json` template | CLI not installed locally | Tier 1 by docs; needs installed-CLI smoke test |
| CodeBuddy | Yes: docs say Claude-compatible hooks and common fields include `session_id`, `transcript_path`, `cwd` | Shared Python hooks in `.codebuddy/settings.json` template | CLI not installed locally | Tier 1 by docs; needs installed-CLI smoke test |
| Kiro CLI | Yes: CLI hook events include `session_id` | Trellis currently uses Kiro agent `agentSpawn` hook for subagent context only | CLI not installed locally | Tier 2: can scope subagent hook; main-session current-task support depends on Kiro setup |
| GitHub Copilot CLI | Public hooks config examples show `timestamp`, `cwd`, tool fields, but not a guaranteed `session_id`; some newer docs/search snippets mention `sessionId` | Copilot template has hooks, but Trellis comments say sessionStart output is not reliable | CLI not installed locally | Tier 2/3: support `sessionId/session_id` if present; otherwise global fallback |
| Cursor IDE | Yes in local hook logs: hook input includes `conversation_id`, `session_id`, `workspace_roots`, `cursor_version`, and `transcript_path: null`; local Cursor statusline skill also documents `session_id` / `transcript_path` | Project `.cursor/hooks.json` wires `sessionStart`, `beforeSubmitPrompt`, and `preToolUse`; user `~/.cursor/hooks.json` also exists | Local Cursor hook log from 2026-04-24 shows real `sessionStart` / `sessionEnd` payloads for this repo with stable `session_id` | Tier 1 for IDE/sessionStart identity; Cursor Agent CLI is out of scope |
| Pi | Extension API has session lifecycle concepts and session manager access; Trellis Pi extension currently reads `.current-task` directly | Pi extension under `.pi/extensions/trellis` template | Local `pi --help` verified; `.pi` is not installed in this repo | Tier 2: possible through extension context, but current template needs adapter work |
| Kilo / Antigravity / Windsurf | Not verified as hook/session transports in this pass | Trellis treats these as agentless/manual workflow platforms | CLIs not installed locally | Tier 3: global fallback |

## Actual Trellis Script Tests

The repo-global pointer currently contains:

```text
.trellis/tasks/04-21-session-scoped-task-state
```

### Claude Statusline

Command shape:

```bash
printf '<mock statusline JSON with session_id=A/B>' | python3 .claude/hooks/statusline.py
```

Result:

```text
STATUSLINE_A=[P1] Session 级 current-task 指针：多窗口并发不互相污染 (in_progress)
STATUSLINE_B=[P1] Session 级 current-task 指针：多窗口并发不互相污染 (in_progress)
```

Finding: `statusline.py` reads `.trellis/.current-task` and ignores `session_id` / `transcript_path`.

### Shared UserPromptSubmit Hook

Command shape:

```bash
printf '<mock hook JSON with session_id=A/B>' | python3 packages/cli/src/templates/shared-hooks/inject-workflow-state.py
```

Result:

```text
WORKFLOW_A=<workflow-state> | Task: session-scoped-task-state (in_progress)
WORKFLOW_B=<workflow-state> | Task: session-scoped-task-state (in_progress)
```

Finding: shared per-turn hook also reads only the global current-task pointer.

### Codex SessionStart Hook

Command shape:

```bash
printf '<mock Codex SessionStart JSON with session_id=A/B>' | python3 .codex/hooks/session-start.py
```

Result:

```text
CODEX_SESSION_START_A=Status: NOT READY | Task: Session 级 current-task 指针：多窗口并发不互相污染
CODEX_SESSION_START_B=Status: NOT READY | Task: Session 级 current-task 指针：多窗口并发不互相污染
```

Finding: Codex hook receives session identity by current docs, but Trellis does not consume it.

### OpenCode Plugin

Command shape:

```bash
bun -e 'import .opencode/plugins/session-start.js; call chat.message with sessionID=A/B'
```

Result:

```text
trellis-test-session-a=Status: NOT READY | Task: Session 级 current-task 指针：多窗口并发不互相污染
trellis-test-session-b=Status: NOT READY | Task: Session 级 current-task 指针：多窗口并发不互相污染
```

Finding: OpenCode plugin receives `sessionID`, but `TrellisContext.getCurrentTask()` still reads `.trellis/.current-task`.

### Cursor Local State and Logs

Local files:

```text
~/.cursor/hooks.json
.cursor/hooks.json
~/Library/Application Support/Cursor/logs/.../cursor.hooks.workspaceId-2ada66ef51fa1f42eb8f932e8a5e9d0a.log
```

Project hook config:

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [{"command": "python3 .cursor/hooks/inject-subagent-context.py", "matcher": "Task"}],
    "sessionStart": [{"command": "python3 .cursor/hooks/session-start.py"}],
    "beforeSubmitPrompt": [{"command": "python3 .cursor/hooks/inject-workflow-state.py"}]
  }
}
```

Real local Cursor hook payload observed in the log:

```json
{
  "conversation_id": "5aeeea93-c6f8-4bab-971d-06c78786933d",
  "model": "default",
  "is_background_agent": false,
  "composer_mode": "agent",
  "session_id": "5aeeea93-c6f8-4bab-971d-06c78786933d",
  "hook_event_name": "sessionStart",
  "cursor_version": "3.1.17",
  "workspace_roots": ["/Users/taosu/workspace/company/mindfold/product/share-public/Trellis"],
  "transcript_path": null
}
```

The same log also says Cursor loaded 3 project hooks for:

```text
preToolUse, sessionStart, beforeSubmitPrompt
```

Finding: Cursor should not be Tier 3. At least Cursor IDE `sessionStart` has a stable `session_id` for this repo. The resolver should treat Cursor like other hook-capable platforms and use `session_id` first, then `conversation_id`, then fallback. `transcript_path` may be null in Cursor.

## Design Consequences

1. The unified resolver is still the right architecture. There should not be per-platform current-task logic.
2. Most hook-capable platforms already expose a stable session key. Claude-only treatment is too narrow.
3. The resolver input adapter must accept both snake_case and camelCase:
   - `session_id`
   - `sessionId`
   - `sessionID`
   - `transcript_path`
4. `transcript_path` is the absolute path to a platform conversation transcript / session log file. It is a fallback identity source, not a requirement. Cursor IDE may send it as `null`, so Cursor should use `session_id` first and `conversation_id` second.
5. OpenCode needs a JS adapter because its plugin does not use stdin JSON. It can either:
   - implement the same runtime-context file lookup in JS, or
   - call a small Python resolver command and cache the result.
6. `.trellis/.runtime/` must be gitignored. Current `.trellis/.gitignore` does not ignore it.
7. Cursor IDE should be included in the MVP for sessionStart/current-task identity. Cursor Agent CLI is out of scope. Copilot, Pi, Kilo, Antigravity, and Windsurf should not block the MVP; they can use global fallback until a stable context key is verified.

## Recommended Support Tiers

Tier 1 for MVP:

- Claude Code hooks + statusline
- Codex hooks
- OpenCode plugin
- Gemini shared hooks
- Droid shared hooks
- Qoder shared hooks
- CodeBuddy shared hooks
- Cursor IDE hooks

Tier 2:

- Kiro subagent hook support
- Pi extension support
- GitHub Copilot only when `sessionId` / `session_id` is observed in real payload

Tier 3 fallback:

- Kilo
- Antigravity
- Windsurf
- Any platform payload without stable session identity
