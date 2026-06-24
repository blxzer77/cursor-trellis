# Testing

## Test Shape

Tests are pytest-based and live under `tests/test_*.py`.

Local patterns:

- Monkeypatch service functions from CLI tests rather than making network calls.
- Assert command aliases and help output when adding CLI flags.
- Assert JSON fields and exit codes, not just success.
- Use temp config directories or monkeypatched config paths for config tests.
- Preserve non-ASCII JSON behavior; `test_cli.py` includes GBK stdout coverage.

## Commands

Run focused tests first:

```powershell
.\.venv\Scripts\python.exe -m pytest tests\test_cli.py -q
```

Then broader checks when behavior or contracts change:

```powershell
.\.venv\Scripts\python.exe -m compileall -q src tests
.\.venv\Scripts\python.exe -m pytest tests -q
npm test
npm run pack:dry
```

## Network Boundary

Unit tests should not require real provider keys or live network access. Live provider checks belong in explicit user-approved validation, not default test suites.

## Evidence

Reference files:

- `tests/test_cli.py`
- `tests/test_service.py`
- `tests/test_config_dir_override.py`
- `tests/test_openai_compatible_provider.py`
- `npm/scripts/test.js`

