# Platform Task Artifact Context Design

## Goal

Keep every platform agent definition aligned with the beta task artifact contract:
`prd.md` is always required, `design.md` and `implement.md` are read when present,
and `implement.jsonl` / `check.jsonl` remain spec and research manifests rather
than task-plan substitutes.

## Current State

Runtime context injection is already aligned in the shared hook and Pi extension.
The remaining drift is in static agent card text. Non-Pi implement cards already
describe the artifact contract, but check cards still describe only spec review.
Pi cards use a terser format and mention jsonl manifests without naming the task
artifacts.

## Design

Update source templates only. Do not edit generated local platform files.

For class-1 markdown check cards, mirror the sibling implement-card language:

- `## Context` lists `.trellis/spec/`, `prd.md`, `design.md`, and `implement.md`.
- Core responsibilities include reviewing against task artifacts.
- Workflow step 2 tells the agent to read the three task artifacts before review.

For Gemini and Qoder check cards, use the same wording even though they do not
carry the hook marker protocol.

For Pi's terse cards, keep the concise style and add direct responsibility lines
for `prd.md`, `design.md`, and `implement.md`.

For Kiro JSON, update the `prompt` field through JSON parsing and preserve the
existing schema.

## Validation

Extend `packages/cli/test/regression.test.ts` so platform template tests assert
all three task artifacts, not just `prd.md`. Add explicit coverage for Gemini,
Qoder, and Pi because they are not covered by the class-1 markdown marker test.
