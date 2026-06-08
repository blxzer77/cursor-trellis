# fix: pi subagent agent frontmatter parsing

## Goal

Fix Pi Agent Trellis subagent execution so the generated `subagent` tool can launch `trellis-implement` and `trellis-check` without Pi treating agent markdown frontmatter as CLI options.

## What I already know

- The generated Pi extension registers a `subagent` tool and injects active Trellis task context successfully.
- User testing shows both explicit `agent: trellis-check` and default `trellis-implement` fail inside subagent execution.
- The reported error is `Error: Unknown option: --- name: trellis-check ...`, which points to the delegated prompt or agent definition being interpreted as command-line options.
- `.pi/agents/trellis-*.md` files contain YAML frontmatter beginning with `---`.
- Current `runPi()` uses `spawn("pi", ["--mode", "json", "-p", "--no-session", prompt])`.

## Assumptions

- The root fix should make delegated prompts safe for multi-line content that starts with YAML frontmatter or contains `---` separators.
- The fix should preserve the existing `subagent` tool contract and Trellis task-context injection.
- The smoke project under `smoke_test/pi-agent-trellis-support` should be updated so the user can retry immediately.

## Requirements

- `subagent` tool must successfully launch a delegated Pi run for `trellis-implement` and `trellis-check`.
- Agent definitions must not be passed to Pi in a way that can be parsed as CLI options.
- The implementation must handle frontmatter-delimited agent markdown safely.
- Tool errors should include enough context to diagnose Pi spawn failures without exposing secrets.
- Existing Pi startup/context behavior must keep working.

## Acceptance Criteria

- [x] Reproduce or isolate the `Unknown option: --- name: ...` failure path.
- [x] Fix the Pi extension template and generated smoke extension.
- [x] Add regression coverage for frontmatter-safe subagent invocation.
- [x] Run focused tests, typecheck, lint, build, and a local Pi smoke test where feasible.

## Definition of Done

- Tests added or updated for the affected Pi extension behavior.
- Lint and typecheck pass.
- CLI build passes.
- Local smoke project is usable for immediate retry.

## Out of Scope

- Reworking Pi's native agent system.
- Changing non-Pi platform behavior.
- Publishing a package or committing changes.

## Technical Notes

- Primary files expected: `packages/cli/src/templates/pi/extensions/trellis/index.ts.txt`, Pi template tests, configurator tests, and `smoke_test/pi-agent-trellis-support/.pi/extensions/trellis/index.ts`.
- Need inspect installed Pi CLI prompt argument semantics and examples before changing invocation.
- Confirmed `pi -p` treats a prompt argument starting with `---` as CLI options. Prefixing with a non-option character avoids parser failure.
- Final fix strips YAML frontmatter from generated agent markdown and wraps the prompt argument so it cannot begin with `-`.
- Smoke verified both explicit `trellis-check` and default `trellis-implement` subagent calls.
