# Scripts And Assets

## Script Patterns

Helper scripts live under the skill that owns them:

- `chrome-cdp/scripts/cdp.mjs` is a Node 22+ CDP CLI with explicit commands and runtime paths.
- `trd-planner/scripts/generate_plan.sh` and `update_status.sh` support the TRD planning workflow.
- `trd-writer-v2/scripts/manifest.py` returns structured JSON and writes a deterministic manifest under `trd_work/`.

When adding scripts:

- Expose only the parameters the agent must provide.
- Let the script decide internal output paths, timestamps, and defaults when possible.
- Return structured JSON to stdout for machine-readable status when the script mutates files.
- Prefer repo-relative paths in generated docs and reports.
- Keep platform assumptions in the skill instructions, not hidden in the script.

## Prompt And Reference Files

Large workflow instructions should live in directly referenced files:

- `trd-planner/prompts/scanner.md` and `prompts/plan_writer.md` split scanning from writing.
- `trd-writer-v2/prompts/*` separates coordinator, worker, reviewer, and fixer responsibilities.
- `hk-ipo-multi-compare/reference.md` holds domain detail outside the trigger file.

Do not create multi-hop reference chains unless necessary. A future agent should be able to read `SKILL.md`, then one linked reference file, and proceed.

## Examples

Examples should demonstrate a complete workflow boundary, not just a command fragment. `chrome-cdp/examples/fetch-hook-api-capture.md` is the pattern for an advanced example tied to one specific skill.

## Validation

- Run syntax checks for modified scripts where available: `node --check` for `.mjs` helpers and `python -m py_compile` for Python helpers.
- Re-read `SKILL.md` after adding support files to ensure every referenced path exists.
- Update root `README.md` / `README.zh-CN.md` when adding, deprecating, or changing the status of a skill.

