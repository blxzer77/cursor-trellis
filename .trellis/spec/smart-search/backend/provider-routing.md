# Provider Routing

## Capability-First Routing

Provider selection is capability-first. New behavior should fit one of the established capabilities before adding more special cases:

- `main_search`: OpenAI-compatible Chat Completions.
- `docs_search`: Context7 and Exa for library/API/docs/official/trusted discovery.
- `web_search`: Tavily and Firecrawl for bilingual broad discovery.
- `web_fetch`: Tavily, Jina Reader with key, and Firecrawl for URL evidence.
- `site_map`: Tavily.
- `research_executor`: `research` / `rs` staged workflow.

`service.py` defines the current provider profiles, Deep Research tool whitelist, trigger keywords, route policy version, and same-capability fallback behavior.

## Local Rules

- Keep fallback within the same capability. Do not fall back from docs search to broad synthesis or from fetch to search.
- Keep Zhipu as deprecated manual compatibility unless a task explicitly targets the legacy command.
- Keep Jina as `web_fetch` only; it must not count as general web search.
- Preserve bilingual source discovery for normal `balanced` and `strict` search when web discovery providers are configured.
- For high-risk claims, use fetched page evidence; `extra_sources` are discovery candidates.
- Deep Research steps must use the existing tool set: `search`, `exa-search`, `exa-similar`, `context7-library`, `context7-docs`, `fetch`, `map`.

## Adding A Provider

When adding or changing a provider:

- Implement the HTTP adapter under `src/smart_search/providers/`.
- Register capability metadata in `service.py`.
- Add config keys in `config.py` and diagnostics in the relevant doctor flow.
- Add tests for configured/missing key behavior, fallback, and output fields.
- Update `README.md`, `README.zh-CN.md`, and bundled skill assets if the public workflow changes.

## Evidence

Reference files:

- `src/smart_search/service.py`
- `src/smart_search/providers/base.py`
- `src/smart_search/providers/openai_compatible.py`
- `src/smart_search/providers/context7.py`
- `src/smart_search/providers/exa.py`
- `src/smart_search/providers/jina.py`
- `tests/test_service.py`
- `tests/test_providers_new.py`

