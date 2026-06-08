# Audit platform task artifact context

## Requirement

Audit beta platform templates for consistency with the new task artifact contract:

- `prd.md` is the requirements artifact.
- `design.md` is the technical design artifact for complex tasks.
- `implement.md` is the execution plan artifact for complex tasks.
- `implement.jsonl` and `check.jsonl` are spec/research manifests, not replacements for `implement.md`.

Known issue from initial inspection: most beta templates follow this contract, but several agent cards still describe only jsonl/spec context and do not explicitly mention `prd.md`, `design.md`, and `implement.md`.

## Scope

Check platform templates, specs, and tests for:

- stale `info.md` references in active generated templates/specs
- platform agent cards that omit `design.md` / `implement.md`
- mismatch between generated local files and source templates
- tests that should assert the new contract
- PR #281 review impact, especially whether it duplicates beta work or changes generated files instead of source templates

## Initial Findings To Verify

- `packages/cli/src/templates/pi/agents/trellis-implement.md` omits explicit `prd.md` / `design.md` / `implement.md` context wording.
- `packages/cli/src/templates/pi/agents/trellis-check.md` omits explicit `prd.md` / `design.md` / `implement.md` context wording.
- `packages/cli/src/templates/gemini/agents/trellis-check.md` appears to use older generic check-agent wording.
- `packages/cli/src/templates/qoder/agents/trellis-check.md` appears to use older generic check-agent wording.
- PR #281 modifies `.pi/extensions/trellis/index.ts` directly, while the source template is `packages/cli/src/templates/pi/extensions/trellis/index.ts.txt`.

## Acceptance Criteria

- Research identifies all active platform-template drift around `design.md` / `implement.md`.
- Research distinguishes real template/spec drift from historical changelog/archive references.
- Recommended code changes are scoped to source templates and tests, not generated local-only files.
- PR #281 review notes are updated with the correct beta context.
