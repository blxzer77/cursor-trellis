# SessionStart visible injection notice

## Goal

Make SessionStart injection visibly obvious to users across hook-capable platforms by instructing the AI to acknowledge the injected Trellis context at the start of the first visible assistant reply in each new session.

## What I already know

* Users cannot easily tell whether Trellis `SessionStart` context was actually injected.
* Claude Code and Codex officially support `SessionStart` context injection through stdout / `hookSpecificOutput.additionalContext`.
* Some platforms do not expose a native persistent UI surface like Claude Code `statusLine`.
* The user explicitly prefers one unified behavior across platforms instead of per-platform UI implementations.
* The selected MVP is: put a strong one-shot instruction inside SessionStart injected context, so the AI begins the first response by saying Trellis SessionStart was injected and briefly lists what was loaded.

## Requirements

* Every Trellis-owned SessionStart implementation that injects context must include a concise first-reply notice instruction.
* The notice must be platform-neutral and work through model context, not a host-specific status bar.
* The first visible assistant reply in a session should start with one short Chinese sentence similar to:
  * `Trellis SessionStart 已注入：workflow、当前任务状态、开发者身份、git 状态、active tasks、spec 索引已加载。`
* After the one-sentence notice, the AI must continue directly with the user's request.
* The instruction must say the notice is one-shot: do not repeat it after the first assistant reply in the same session.
* The notice must not claim success on platforms whose host ignores SessionStart output. Platform docs should not overpromise Copilot behavior.
* Keep existing hook payload shape unchanged.
* Keep existing task-status / workflow-state behavior intact.

## Acceptance Criteria

* [x] Shared Python `session-start.py` includes the first-reply notice instruction in injected context.
* [x] Codex `session-start.py` includes the same first-reply notice instruction.
* [x] Copilot/OpenCode behavior is handled honestly: either include only where context is actually injected, or document why host output is not reliable.
* [x] Tests assert the notice instruction appears in generated SessionStart context for supported implementations.
* [x] Lint and typecheck pass.

## Definition of Done

* Tests added/updated for the first-reply notice.
* CLI lint and typecheck pass.
* Spec/docs updated if this establishes a reusable SessionStart convention.
* Phase 2 implementation is followed by `trellis-check`.

## Out of Scope

* Claude Code statusLine implementation.
* Per-session status files.
* Persistent UI banners.
* Changing official hook feature-flag requirements, such as Codex `codex_hooks = true`.

## Technical Notes

* Relevant templates:
  * `packages/cli/src/templates/shared-hooks/session-start.py`
  * `packages/cli/src/templates/codex/hooks/session-start.py`
  * `packages/cli/src/templates/copilot/hooks/session-start.py`
  * `packages/cli/src/templates/opencode/plugins/session-start.js`
* Relevant tests:
  * `packages/cli/test/regression.test.ts`
  * existing template tests under `packages/cli/test/templates/`
* Research:
  * `research/official-hook-success-mechanisms.md`
