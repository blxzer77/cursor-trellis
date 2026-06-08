# Official Hook Success Mechanisms

## Summary

There is no single cross-platform official proof mechanism for `SessionStart` injection. The viable design is platform-specific:

- Claude Code: official `SessionStart` stdout / `additionalContext` goes into Claude context. `/hooks` proves registration; debug logs prove execution.
- Codex: official `SessionStart` stdout / `additionalContext` goes into extra developer context. `statusMessage` can be used as a lightweight visible running status. Hooks require `[features] codex_hooks = true`; Windows hooks are disabled as of the current docs.
- GitHub Copilot: official docs say `sessionStart` output is ignored, so it cannot prove context injection via hook output. It can only log/display host-supported banners.
- OpenCode: plugin API supports session events and custom JS logic; proof must be implemented through Trellis' plugin behavior, not a Claude/Codex-style `additionalContext` contract.

## Claude Code

Official docs:

- Hooks fire at lifecycle points and receive JSON input via stdin.
- `/hooks` is an official read-only browser for configured hooks. It shows event, matcher, source file, and command/URL/prompt details.
- For `SessionStart`, Claude Code says any stdout text is added as context for Claude.
- JSON output can use `hookSpecificOutput.additionalContext` for structured injection.
- Debug logs record hook matching, command execution, exit status, stdout, and stderr. Users can start with `claude --debug-file <path>` or `claude --debug`.

Implication for Trellis:

- Registration proof: `/hooks` should show the Trellis `SessionStart` command.
- Execution proof: debug log should show the hook command completed.
- Injection proof: include a small marker in `additionalContext`; the agent can read and report it.

Sources:

- https://code.claude.com/docs/en/hooks

## Codex

Official docs:

- Codex hooks are experimental and behind `[features] codex_hooks = true`.
- Codex discovers `hooks.json` from config layers, including `<repo>/.codex/hooks.json`.
- `SessionStart` matcher applies to source values `startup` and `resume`.
- Plain stdout is added as extra developer context.
- JSON stdout supports `hookSpecificOutput.additionalContext`.
- `systemMessage` is surfaced as a warning in the UI or event stream.
- `statusMessage` is an optional hook handler field.
- Hooks are currently disabled on Windows.

Implication for Trellis:

- The existing Codex session-start JSON shape is aligned with official docs.
- Add a stable marker to `additionalContext`.
- Use `statusMessage` in `.codex/hooks.json` for an immediate "Loading Trellis context" status when the host supports it.
- Keep docs explicit that users must enable `codex_hooks = true`.

Sources:

- https://developers.openai.com/codex/hooks

## GitHub Copilot

Official docs:

- Copilot supports `sessionStart` hooks.
- `sessionStart` receives JSON input with fields such as timestamp, cwd, source, and initialPrompt.
- For session start, output is ignored; no return value is processed.
- A tutorial still uses a `sessionStart` "policy banner", but the same page says output is ignored by Copilot CLI, so this is not a reliable model-context injection proof.

Implication for Trellis:

- Do not promise that Copilot `sessionStart` output proves Trellis context was injected.
- If Trellis keeps a Copilot session-start script, it should be treated as logging/diagnostics unless host behavior changes.
- A proof marker can be written to a local log, but not relied on as model-visible context from official hook output semantics.

Sources:

- https://docs.github.com/en/copilot/reference/hooks-configuration
- https://docs.github.com/en/copilot/tutorials/copilot-cli-hooks

## OpenCode

Official docs:

- OpenCode plugins are JS/TS modules loaded from project/global plugin directories.
- Plugins return hook implementations.
- Available events include session events such as `session.created`, `session.idle`, `session.status`, and `session.updated`.

Implication for Trellis:

- OpenCode proof should be implemented in the Trellis plugin itself.
- A stable marker in the plugin-injected message is the most direct proof if that message is persisted to the session.

Sources:

- https://opencode.ai/docs/plugins/

## Recommended MVP

1. Add a stable, short marker to all Trellis-owned context-injecting session-start implementations:

   ```xml
   <trellis-injection hook="SessionStart" status="ok" platform="..." version="...">
   Context below was injected by Trellis session-start.
   </trellis-injection>
   ```

2. Keep the existing larger context blocks unchanged.

3. Add platform-specific verification docs:

   - Claude Code: run `/hooks`; for execution logs run `claude --debug-file <path>`.
   - Codex: ensure `[features] codex_hooks = true`; inspect `.codex/hooks.json`; look for `statusMessage`; ask the agent to report the injected marker.
   - Copilot: hooks can run, but sessionStart output is ignored; verify via hook logs, not model-visible context.
   - OpenCode: verify through Trellis plugin-injected marker or plugin logs.

4. Add tests that run the generated session-start scripts/plugins and assert the marker appears in the injected context.
