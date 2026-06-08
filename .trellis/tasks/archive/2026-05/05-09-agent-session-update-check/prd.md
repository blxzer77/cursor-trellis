# Check Trellis Updates During Agent Session Start

## Goal

Notify users about available Trellis updates even when they do not manually run the `trellis` CLI. The first Trellis context load in an agent session should attempt a lightweight local version check and include a visible update hint when the installed project version differs from the available CLI version.

## What I Already Know

- Manual `trellis` invocation already prints an update prompt such as `Trellis update available: 0.5.0 -> 0.5.9`.
- Users often enter an AI agent directly, so they may only trigger Trellis through SessionStart injection or `$trellis-start`.
- `$trellis-start` runs `python3 ./.trellis/scripts/get_context.py`; SessionStart hooks also call `get_context.py`.
- `get_context.py` delegates to `.trellis/scripts/common/session_context.py`.
- The installed project version is stored at `.trellis/.version`.
- `trellis --version` already runs the CLI's version comparison logic and can print an update hint before the version number.

## Assumptions

- A best-effort check is acceptable: local CLI failures, invalid version data, or timeouts should silently skip the hint.
- The hint should not block context injection or slow it noticeably; use a short timeout.
- "Single session" can be implemented with a runtime marker keyed by Trellis session identity when available, falling back to a process/session-like marker so repeated `get_context.py` calls in one agent session do not spam.

## Requirements

- On the default `get_context.py` text output path, attempt a Trellis update check once per agent session.
- If `.trellis/.version` is older than the version resolved from `trellis --version`, include a concise visible hint before the context body:
  - current project version
  - available Trellis version
  - `run npm install -g @mindfoldhq/trellis@latest`
- If the installed project version equals or is newer than the resolved version, print nothing.
- If `trellis --version` fails or version parsing fails, print nothing.
- Do not perform the update check for JSON output, record mode, packages mode, or phase mode.
- Persist the once-per-session marker under `.trellis/.runtime/` and keep it non-fatal if it cannot be written.
- Keep behavior cross-platform and Python 3.9-compatible.

## Acceptance Criteria

- [ ] `$trellis-start` / `python3 ./.trellis/scripts/get_context.py` can include the update hint when `trellis --version` reports or implies a newer version.
- [ ] A second default context load in the same session does not include the hint again.
- [ ] SessionStart injection that calls `get_context.py` gets the same behavior automatically.
- [ ] Local CLI failures and malformed version output do not fail context generation.
- [ ] Unit tests cover newer, equal/newer, lookup-failure, and once-per-session paths.
- [ ] Template files and local dogfood `.trellis/scripts` copies stay in sync.

## Out of Scope

- Changing the `trellis update` command behavior itself.
- Prompting for automatic installation or running `trellis update` automatically.
- Adding a full cache of npm metadata across sessions.
- Showing update hints in non-default context modes.

## Technical Notes

- Likely implementation files:
  - `packages/cli/src/templates/trellis/scripts/common/session_context.py`
  - `.trellis/scripts/common/session_context.py`
  - relevant tests under `packages/cli/test/`
- Reuse the installed `trellis --version` behavior instead of duplicating npm registry parsing in generated Python scripts.
- Use `subprocess.run(..., timeout=...)` with captured UTF-8 output so the advisory check stays best-effort and cross-platform.
