# fix: pi subagent output cleanup

## Goal

Clean up Pi Agent Trellis subagent output so the parent Pi conversation shows the delegated agent's final answer instead of the full `--mode json` event stream.

## What I already know

- The `subagent` tool now works functionally for `trellis-check` and default `trellis-implement`.
- User testing shows the page is too noisy because the tool result includes raw Pi JSON events.
- Current `runPi()` returns `stdout || stderr` directly from `pi --mode json`.
- Pi JSON mode emits newline-delimited JSON events including final `message_end` events.

## Assumptions

- The parent tool result should return the final assistant text from the child Pi run.
- If parsing fails, returning the raw output is acceptable as a fallback for diagnosis.
- Error output should remain visible when the child Pi process fails.

## Requirements

- Parse Pi JSON mode output and extract the final assistant text.
- Preserve non-zero exit diagnostics.
- Keep `subagent` tool result shape compatible with Pi: `{ content: [{ type: "text", text }], details }`.
- Update the smoke extension so the user can retry immediately.

## Acceptance Criteria

- [x] `subagent` output no longer displays raw JSON event streams for successful runs.
- [x] Final assistant text is returned for both `trellis-check` and default `trellis-implement`.
- [x] Regression tests cover JSON output extraction.
- [x] Focused tests, typecheck, lint, build, and local Pi smoke pass.

## Definition of Done

- Tests added or updated for output cleanup.
- Lint and typecheck pass.
- CLI build passes.
- Local smoke project is usable for immediate retry.

## Out of Scope

- Changing Pi's own JSON output format.
- Changing non-Pi platform behavior.
- Adding custom Pi UI renderers.

## Technical Notes

- Primary files expected: `packages/cli/src/templates/pi/extensions/trellis/index.ts.txt`, Pi template tests, configurator tests, and `smoke_test/pi-agent-trellis-support/.pi/extensions/trellis/index.ts`.
- Implemented `extractFinalAssistantText()` over Pi JSON mode newline events.
- Successful child Pi runs now return the last assistant text; raw stdout/stderr remains the fallback for parse failures and diagnostics.
- Smoke verified explicit `trellis-check` returns `CLEAN_CHECK_OK` and default `trellis-implement` returns `CLEAN_IMPLEMENT_OK` without nested JSON.
