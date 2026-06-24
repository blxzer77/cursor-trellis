# Architecture

## Main Boundaries

`smart-search` is a CLI-first research tool with a Python backend and an npm wrapper. Backend work should keep these boundaries intact:

- `cli.py`: argument parsing, command aliases, output formatting, exit code mapping, and file output dispatch.
- `service.py`: async orchestration, provider selection, fallback, source merging, Deep Research execution, and evidence policy.
- `config.py`: env/config-file resolution, defaults, validation, masking, and path reporting.
- `providers/*.py`: provider-specific request/response adaptation only.
- `npm/`: install/test/version wrapper logic, not research behavior.
- `skills/smart-search-cli/` and `src/smart_search/assets/skills/...`: bundled agent-facing skill contract.

## Local Patterns

- Keep CLI command names and aliases centralized in `cli.py` (`COMMAND_ALIASES`, `CONFIG_COMMAND_ALIASES`).
- Keep process exit semantics explicit through `EXIT_OK`, `EXIT_PARAMETER_ERROR`, `EXIT_CONFIG_ERROR`, `EXIT_NETWORK_ERROR`, and `EXIT_RUNTIME_ERROR`.
- Service outputs should remain dictionary-shaped and include observability fields such as `routing_decision`, `provider_attempts`, `providers_used`, `fallback_used`, `primary_sources`, and `extra_sources`.
- Avoid pushing provider-specific logic into `cli.py`; CLI code should call service functions and format results.
- Avoid reading or writing local config directly outside `config.py`.

## Evidence

Reference files:

- `src/smart_search/cli.py`
- `src/smart_search/service.py`
- `src/smart_search/config.py`
- `tests/test_cli.py`
- `tests/test_service.py`

## Anti-Patterns

- Adding a new command without alias/help tests.
- Returning provider data directly without normalizing it to the public JSON contract.
- Mixing install-time npm wrapper logic with runtime research routing.
- Using broad search content as claim-level proof when fetched evidence is required.

