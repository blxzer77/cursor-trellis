# CLI Contract

## Command Boundary

`src/smart_search/cli.py` is the public command boundary. Keep these responsibilities there:

- Build the argparse parser with `SmartSearchArgumentParser(allow_abbrev=False)`.
- Define command aliases in `COMMAND_ALIASES` and config aliases in `CONFIG_COMMAND_ALIASES`.
- Convert service results into JSON, Markdown, or content output.
- Map result types to explicit exit codes.
- Write `--output` files through service/file helpers.

## Output Stability

Agent workflows depend on stable JSON fields. For search/research outputs, preserve existing fields unless a task explicitly changes the contract:

- `ok`, `error_type`, `error`
- `query`, `content`
- `sources`, `primary_sources`, `extra_sources`
- `routing_decision`, `provider_attempts`, `providers_used`, `fallback_used`
- `validation_level`, `timeout_seconds`
- `research_plan`, `evidence_items`, `gap_check`, `citations` for research output

## Formatting Rules

- Keep `ensure_ascii=False` for JSON.
- Preserve stdout safety for non-UTF-8 consoles through `_json_stdout_safe`.
- Markdown diagnostics should be human-readable and safe to paste.
- `content` format is intentionally compact; do not overload it with full diagnostics.

## Tests

For command changes, add or update `tests/test_cli.py` coverage for:

- Help text.
- Aliases.
- Exit code.
- Output format.
- File output.
- Non-ASCII behavior when relevant.

