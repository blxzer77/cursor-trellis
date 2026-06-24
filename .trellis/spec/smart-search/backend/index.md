# Smart Search Backend Guidelines

This layer covers the Python implementation under `src/smart_search/`: configuration, provider adapters, routing, research orchestration, evidence handling, and tests.

## Source Areas

- `src/smart_search/service.py` owns provider registration, routing, search/fetch/map/research flows, and evidence policy.
- `src/smart_search/config.py` owns config storage, env overrides, secret masking, defaults, and minimum-profile policy.
- `src/smart_search/providers/` contains provider-specific HTTP adapters.
- `src/smart_search/sources.py` and `utils.py` hold shared source/session/prompt helpers.
- `tests/test_*.py` are pytest coverage for behavior and contracts.

## Guides

| Guide | Use When |
| --- | --- |
| [Architecture](./architecture.md) | Changing service boundaries or adding shared behavior. |
| [Provider Routing](./provider-routing.md) | Adding or changing providers, fallback, evidence, or research behavior. |
| [Configuration And Secrets](./configuration-and-secrets.md) | Touching config keys, defaults, env overrides, diagnostics, or secret output. |
| [Testing](./testing.md) | Adding behavior or changing CLI/service contracts. |

## Pre-Development Checklist

- Read `README.md` for the public command and provider contract.
- Check the matching tests before editing behavior.
- Preserve JSON/Markdown output fields used by agents and scripts.
- Treat provider keys and local config as secrets; never write real keys into fixtures or docs.
- Use focused pytest first, then `.\.venv\Scripts\python.exe -m pytest tests -q` for larger backend changes.

