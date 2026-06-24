# Configuration And Secrets

## Config Ownership

All persistent config behavior belongs in `src/smart_search/config.py`.

The local pattern is:

- Environment variables override config file values.
- Windows defaults to `%LOCALAPPDATA%\smart-search`; Linux/macOS default to `~/.config/smart-search`.
- `SMART_SEARCH_CONFIG_DIR` is the explicit override for CI, sandboxes, and portable installs.
- Windows legacy home config can be read as `legacy_windows_home` when the new default is missing.
- Permission failures should degrade to a clear error or cwd fallback where implemented.

## Secret Handling

- Never print raw API keys in diagnostics, tests, docs, or final answers.
- Use masked config output by default.
- Keep real secrets out of tracked files.
- `doctor`, `diagnose`, and config list outputs must remain safe to paste into issue reports.

## Config Key Changes

When adding a config key:

- Add it to `_CONFIG_KEYS`.
- Decide whether changing it should clear `_cached_model`.
- Add setup/config command handling in `cli.py` if user-editable.
- Add doctor or diagnose coverage when it affects provider readiness.
- Update README provider tables and the bundled skill contract.

## Evidence

Reference files:

- `src/smart_search/config.py`
- `src/smart_search/cli.py`
- `tests/test_config_dir_override.py`
- `tests/test_cli.py`
- `README.md`

