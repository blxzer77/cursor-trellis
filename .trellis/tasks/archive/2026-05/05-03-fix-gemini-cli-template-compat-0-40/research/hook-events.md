# Research: Gemini CLI 0.40.x Hook Event Names

- **Query**: What hook event names are valid in Gemini CLI 0.40.x `.gemini/settings.json`? Confirm `BeforeAgent` replaces `UserPromptSubmit`. Is `SessionStart` still valid? What is the stdin/stdout contract?
- **Scope**: external (upstream `google-gemini/gemini-cli` repo + official docs)
- **Date**: 2026-05-03

## Summary (TL;DR)

- **`UserPromptSubmit` is NOT a valid Gemini CLI event name and never was.** It is a Claude Code event name. Gemini CLI's equivalent has always been `BeforeAgent`. Issue #224 reporter is correct.
- `SessionStart` IS still valid in 0.40.x (one of the 11 supported events).
- Hook stdin still receives JSON; stdout still returns JSON (`hookSpecificOutput.additionalContext`) which is appended/prepended to the prompt depending on event + interactive mode.
- The Gemini hook system was introduced in **v0.35** (preview) / stabilized through v0.38; the 11-event enum has been the same set since. There is no `UserPromptSubmit` alias — Gemini CLI's settings schema rejects unknown property names under `hooks.*`.

---

## Findings

### 1. The Full Event Enum (11 events)

Source of truth: [`packages/core/src/hooks/types.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/hooks/types.ts) — also pinned at commit `07ab16db`.

```typescript
/**
 * Event names for the hook system
 */
export enum HookEventName {
  BeforeTool = 'BeforeTool',
  AfterTool = 'AfterTool',
  BeforeAgent = 'BeforeAgent',
  Notification = 'Notification',
  AfterAgent = 'AfterAgent',
  SessionStart = 'SessionStart',
  SessionEnd = 'SessionEnd',
  PreCompress = 'PreCompress',
  BeforeModel = 'BeforeModel',
  AfterModel = 'AfterModel',
  BeforeToolSelection = 'BeforeToolSelection',
}
```

Each event also has a settings-schema entry under `hooks.*` in [`packages/cli/src/config/settingsSchema.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/config/settingsSchema.ts) with `ref: 'HookDefinitionArray'`. Any `hooks.<name>` outside this enum is rejected by the schema validator — that is what makes the CLI throw "invalid event" for `UserPromptSubmit`.

Reserved non-event meta-fields under the hooks object: `enabled`, `disabled`, `notifications` (constant `HOOKS_CONFIG_FIELDS` in `types.ts`). Note: PR #16870 (Jan 2026, post-0.40) is moving these meta-fields to a sibling `hooksConfig` object — but as of 0.40.x they still live alongside event names under `hooks`.

### 2. The Pre-Agent / Per-Turn Hook → `BeforeAgent`

Confirmed. From the official reference [`docs/hooks/reference.md`](https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md):

> ### `BeforeAgent`
> Fires after a user submits a prompt, but before the agent begins planning. Used for prompt validation or **injecting dynamic context**.
>
> - **Input Fields**: `prompt`: (`string`) The original text submitted by the user.
> - **Relevant Output Fields**:
>   - `hookSpecificOutput.additionalContext`: Text that is **appended** to the prompt for this turn only.
>   - `decision`: `"deny"` to block + discard the message.
>   - `continue: false` to block but save to history.
> - **Exit Code 2 (Block Turn)**: Aborts the turn and erases the prompt from context.

Cross-platform mapping table (from `mherod/agent-hook-schemas` and Open Agent Kit docs): Claude Code's `UserPromptSubmit` ↔ Gemini CLI's `BeforeAgent` ↔ Cursor's `beforeSubmitPrompt`. Same role, different name per platform.

So Trellis's existing semantic ("inject workflow-state breadcrumb at the start of each turn") maps to **`BeforeAgent`** in Gemini.

### 3. `SessionStart` Validity

`SessionStart` IS in the enum (event #6 in the list above) and remains valid in 0.40.x. It also supports `additionalContext` for context injection (PR #15746, merged Dec 2025).

From `docs/hooks/reference.md`:

> ### `SessionStart`
> Fires on application startup, resuming a session, or after a `/clear` command. Used for loading initial context.
> - **Input fields**: `source`: (`"startup" | "resume" | "clear"`)
> - **Relevant output fields**:
>   - `hookSpecificOutput.additionalContext`: (`string`)
>     - **Interactive**: Injected as the first turn in history.
>     - **Non-interactive**: Prepended to the user's prompt.
>   - `systemMessage`: Shown at the start of the session.
> - **Advisory only**: `continue` and `decision` fields are **ignored**. Startup is never blocked.

### 4. Hook stdin/stdout Payload Shape (unchanged in 0.40.x)

From [`docs/hooks/reference.md`](https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md) and `hookRunner.ts` source:

**Communication model:** stdin = JSON input, stdout = JSON output, stderr = logs.

> **Silence is Mandatory**: Your script **must not** print any plain text to `stdout` other than the final JSON.

**Base input (all events) via stdin:**

```json
{
  "session_id": "string",
  "transcript_path": "string",
  "cwd": "string",
  "hook_event_name": "string",
  "timestamp": "string"
}
```

`BeforeAgent` adds: `prompt: string`.
`SessionStart` adds: `source: "startup" | "resume" | "clear"`.

Env vars set by runner: `GEMINI_PROJECT_DIR` and `CLAUDE_PROJECT_DIR` (compat alias) = `input.cwd`.

**Output for `BeforeAgent`:**

```json
{
  "hookSpecificOutput": {
    "hookEventName": "BeforeAgent",
    "additionalContext": "<text appended to the user's prompt for this turn>"
  }
}
```

**Output for `SessionStart`:**

```json
{
  "hookSpecificOutput": {
    "hookEventName": "SessionStart",
    "additionalContext": "<text prepended to first prompt (non-interactive) / first history turn (interactive)>"
  },
  "systemMessage": "<optional, displayed at session start>"
}
```

**Important nuances for Trellis:**

- For **`BeforeAgent`**, `additionalContext` is appended (`prompt += '\n\n' + additionalContext`), see `hookRunner.ts` `applyHookOutputToInput` switch on `HookEventName.BeforeAgent`.
- For **`SessionStart`** in non-interactive mode (`gemini -p "..."`), Gemini CLI wraps the context as `<hook_context>...</hook_context>` and prepends to input — see `packages/cli/src/gemini.tsx` (commit `07ab16db`):

  ```typescript
  const wrappedContext = `<hook_context>${additionalContext}</hook_context>`;
  input = input ? `${wrappedContext}\n\n${input}` : wrappedContext;
  ```

- The `getAdditionalContext()` method in the base hook output sanitizes `<` and `>` to HTML entities to prevent tag injection.
- Plaintext-to-stdout (the old "just `console.log(text)`" pattern) is no longer surfaced as injected context — see `mksglu/context-mode` PR #314 reproducing that bug on 0.38.2. Hooks **must** emit structured JSON.

### 5. Version Timeline of the Hook System

| Version       | Date       | Hook event change                                                     |
|---------------|------------|----------------------------------------------------------------------|
| v0.35.0-preview.1 | 2026-03-17 | "fix(hooks): fix BeforeAgent/AfterAgent inconsistencies" (#21383). Hooks already exist with current event names. |
| v0.38.0       | 2026-04-14 | Hook system messages displayed in UI (#24616); BeforeModel partial llm_request fix (#22326, #24784). 11-event enum stable. |
| v0.38.2       | 2026-04-17 | Latest stable as of pre-0.39.0 release. SessionStart/BeforeAgent both present. |
| v0.39.0       | 2026-04-23 | `useAgentStream` UI hook (internal — not a settings hook). 11 events unchanged. |
| v0.40.0       | 2026-04-28 | 11 events unchanged. Schema still rejects unknown event names. |
| (post-0.40 / main) | future | PR #16870 will move `enabled`/`disabled`/`notifications` from `hooks` → `hooksConfig`, leaving `hooks` purely event-keyed. **Will break configs that put meta-fields under `hooks`.** Not yet released. |

**There is no `UserPromptSubmit` deprecation alias.** That name has never existed in Gemini CLI's enum. It comes from Claude Code, and earlier Trellis Gemini templates apparently borrowed Claude's name by mistake — which only worked because pre-hook-system Gemini versions silently ignored unknown settings keys. Once the 0.35-series schema validation landed, the unknown key started failing.

### Sources

- [`packages/core/src/hooks/types.ts` (main)](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/hooks/types.ts) — full `HookEventName` enum + per-event input/output interfaces.
- [`packages/core/src/hooks/types.ts` @ 07ab16db](https://github.com/google-gemini/gemini-cli/blob/07ab16db/packages/core/src/hooks/types.ts) — pinned commit covering 0.40-era code.
- [`packages/cli/src/config/settingsSchema.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/cli/src/config/settingsSchema.ts) — schema definitions for each event under `hooks.*`.
- [`docs/hooks/reference.md`](https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/reference.md) — official per-event reference.
- [`docs/hooks/writing-hooks.md`](https://github.com/google-gemini/gemini-cli/blob/main/docs/hooks/writing-hooks.md) — example `BeforeAgent` JSON output.
- [`packages/core/src/hooks/hookEventHandler.ts`](https://github.com/google-gemini/gemini-cli/blob/main/packages/core/src/hooks/hookEventHandler.ts) — per-event fire methods.
- [`packages/core/src/hooks/hookRunner.ts` @ 07ab16db](https://github.com/google-gemini/gemini-cli/blob/07ab16db/packages/core/src/hooks/hookRunner.ts) — proves stdin = JSON, stdout = JSON, env vars set, and the `BeforeAgent.additionalContext` append behavior.
- [`packages/cli/src/gemini.tsx` @ 07ab16db](https://github.com/google-gemini/gemini-cli/blob/07ab16db/packages/cli/src/gemini.tsx) — non-interactive `<hook_context>` wrapper for `SessionStart`.
- [PR #15746 — Support context injection via SessionStart hook](https://github.com/google-gemini/gemini-cli/pull/15746) — landed the `additionalContext`/`systemMessage` wiring for `SessionStart`.
- [PR #9074 — Hook Configuration Schema and Types](https://github.com/google-gemini/gemini-cli/pull/9074) — introduced the 11-event enum + schema validation.
- [PR #9105 — Hook Agent Lifecycle Integration](https://github.com/google-gemini/gemini-cli/pull/9105) — wired `BeforeAgent`/`AfterAgent` into `GeminiClient.sendMessageStream()`.
- [PR #16870 — Move meta properties out of `hooks` into `hooksConfig`](https://github.com/google-gemini/gemini-cli/pull/16870) — future breaking change (post-0.40).
- [`mherod/agent-hook-schemas` README](https://github.com/mherod/agent-hook-schemas) — Cross-platform event-name mapping table (Claude `UserPromptSubmit` ↔ Gemini `BeforeAgent`).
- [Open Agent Kit Hooks Reference](https://openagentkit.app/features/codebase-intelligence/hooks-reference/) — same mapping confirmation: "Gemini CLI `BeforeAgent` → OAK `UserPromptSubmit` (provides `prompt`)".
- [shanraisshan/gemini-cli-hooks](https://github.com/shanraisshan/gemini-cli-hooks) — independent enumeration of all 11 events for v0.38.2.
- [mksglu/context-mode PR #314](https://github.com/mksglu/context-mode/pull/314) — empirical confirmation tested on Gemini CLI 0.38.2 that hooks must return JSON, not plaintext, to inject context.
- [Release notes v0.38.0](https://github.com/google-gemini/gemini-cli/releases/tag/v0.38.0), [v0.39.0](https://github.com/google-gemini/gemini-cli/releases/tag/v0.39.0), [v0.40.0](https://github.com/google-gemini/gemini-cli/releases/tag/v0.40.0).

---

## Caveats / Not Found

- I did not locate the exact PR that originally added `UserPromptSubmit` to Trellis's Gemini template, so cannot say with certainty whether older Gemini CLI versions silently accepted it (vs. simply not running the hook). What's certain is that 0.35+ schema validation rejects it.
- PR #16870 (the `hooksConfig` rename) is on `main` but **not** yet in any released 0.40.x build. Trellis should NOT pre-emptively migrate to `hooksConfig` until a release ships it. The 0.40.x format remains: meta fields (`enabled`, `disabled`, `notifications`) and event keys (`BeforeAgent`, `SessionStart`, …) coexist as siblings under top-level `hooks`.
- I did not verify the "interactive vs non-interactive" behavior difference for `BeforeAgent` (the docs only spell it out for `SessionStart`). For `BeforeAgent`, the runner unconditionally appends `additionalContext` to `prompt` regardless of mode — see `hookRunner.ts`.

---

## Recommendation for Trellis

Drop-in replacement for `.gemini/settings.json`. Keep both events; rename `UserPromptSubmit` → `BeforeAgent`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup",
        "hooks": [
          {
            "type": "command",
            "command": "<existing trellis SessionStart command>",
            "timeout": 10000
          }
        ]
      }
    ],
    "BeforeAgent": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "<command previously wired to UserPromptSubmit>",
            "timeout": 10000
          }
        ]
      }
    ]
  }
}
```

Notes for the implementer:

1. The hook command's stdout JSON must use `"hookEventName": "BeforeAgent"` (not `"UserPromptSubmit"`) inside `hookSpecificOutput`, otherwise `getAdditionalContext()` won't find the field. Example:
   ```json
   {"hookSpecificOutput":{"hookEventName":"BeforeAgent","additionalContext":"<workflow breadcrumb here>"}}
   ```
2. The per-turn breadcrumb is **appended** to the user's prompt (not prepended). If Trellis previously assumed prepend-semantics, double-check the breadcrumb still parses correctly when it appears after the user text. If prepend ordering matters, switch to `SessionStart` for first-turn injection or have the breadcrumb script wrap with explicit markers.
3. `matcher` for lifecycle events like `SessionStart` / `BeforeAgent` is an exact-string filter; `"startup"` filters `SessionStart` to startup-only (skipping `resume`/`clear`). Use `"*"` (or omit `matcher`) to match every invocation. `BeforeAgent` has no sub-types so `matcher: "*"` is fine.
4. Stdin still delivers the user's prompt for `BeforeAgent` as `input.prompt`. Hook scripts that previously read Claude's `UserPromptSubmit` payload (`prompt` field at top level) will need no change — Gemini's `BeforeAgent` payload has the same `prompt` field.
5. Do NOT add `enabled`/`disabled`/`notifications` keys under `hooks` if you can avoid it — they are slated to move to `hooksConfig` in the next breaking release. If you need to gate hooks on/off, prefer the per-hook `disabled` key on the definition rather than a top-level toggle, OR keep using top-level `hooks.enabled` knowing it'll need migration later.
