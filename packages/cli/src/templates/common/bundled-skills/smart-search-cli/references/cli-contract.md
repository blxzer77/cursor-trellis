# Smart Search CLI Contract

## Entrypoints

- `smart-search` is the primary CLI.
- `smart-search --version`, `smart-search --v`, and `smart-search -v` print the installed version and exit with code `0`.
- `smart-search` should resolve from the user's PATH.
- This bundled skill is maintained with the `smartsearch` repository.
- Private API keys should be saved with `smart-search setup` or `smart-search config set`.
- Environment variables remain supported for CI and advanced users, and override the local config file.
- Do not depend on MCP inline `env` values or committed API-key environment variables for CLI use.
- On Windows with mise, the managed package name is `npm:@konbakuyomu/smart-search`; the executable remains `smart-search`. Diagnose mise managed installs with `mise ls "npm:@konbakuyomu/smart-search"` and `mise which smart-search` (the bare name `smart-search` is the bin, not a mise tool identifier).
- On Windows, the default config file is `%LOCALAPPDATA%\smart-search\config.json`. Linux/macOS default to `~/.config/smart-search/config.json`.
- `SMART_SEARCH_CONFIG_DIR` is an advanced override for CI, containers, sandboxes, or portable installs. The CLI uses it for config and relative logs and skips default-directory selection.
- The default research evidence root is `evidence` under the active config directory. `SMART_SEARCH_EVIDENCE_DIR` overrides that root; relative values resolve under the active config directory and absolute values are used as-is.
- Earlier Windows source defaults used `~\.config\smart-search\config.json`, while some installs were already pinned to `%LOCALAPPDATA%\smart-search` through `SMART_SEARCH_CONFIG_DIR`. If the new Windows default file is missing but the old file exists, the active config source is `legacy_windows_home` so upgrades do not silently lose configuration. Diagnostics must expose the override value and whether it matches the current default.

## Commands

- `smart-search search QUERY [--platform NAME] [--model ID] [--extra-sources N] [--validation fast|balanced|strict] [--fallback auto|off] [--providers auto|CSV] [--stream|--no-stream] [--timeout SECONDS] [--format json|markdown|content] [--output PATH]`
- `smart-search fetch URL [--format json|markdown|content] [--output PATH]`
- `smart-search exa-search QUERY [--num-results N] [--search-type neural|keyword|auto] [--include-text] [--include-highlights] [--start-published-date YYYY-MM-DD] [--include-domains DOMAIN...] [--exclude-domains DOMAIN...] [--category NAME] [--format json|markdown|content] [--output PATH]`
- `smart-search exa-similar URL [--num-results N] [--format json|markdown|content] [--output PATH]`
- `smart-search zhipu-search QUERY [--count N] [--search-engine NAME] [--search-recency-filter VALUE] [--search-domain-filter DOMAIN] [--content-size medium|high] [--format json|markdown|content] [--output PATH]` — **DEPRECATED**: emits a stderr warning on every invocation; the subcommand, the `research_discovery` zhipu branch, and `providers/zhipu.py` will be removed on the schedule in README § "Deprecation notices".
- `smart-search context7-library NAME [QUERY] [--format json|markdown|content] [--output PATH]`
- `smart-search context7-docs LIBRARY_ID QUERY [--format json|markdown|content] [--output PATH]`
- `smart-search research QUERY [--budget quick|standard|deep] [--locale-scope cn|en|both] [--evidence-dir PATH] [--fallback auto|off] [--dry-run] [--progress] [--format json|markdown|content] [--output PATH]`
- `smart-search map URL [--instructions TEXT] [--max-depth N] [--max-breadth N] [--limit N] [--timeout SECONDS] [--format json|markdown|content] [--output PATH]`
- `smart-search doctor [--format json|markdown|content] [--output PATH]`
- `smart-search diagnose openai-compatible [--timeout SECONDS] [--format json|markdown] [--output PATH]`
- `smart-search setup [--lang zh|en] [--advanced] [--non-interactive] [--openai-compatible-api-url URL] [--openai-compatible-api-key KEY] [--openai-compatible-model ID] [--openai-compatible-stream true|false] [--validation-level fast|balanced|strict] [--fallback-mode auto|off] [--minimum-profile standard|off] [--exa-key KEY] [--context7-key KEY] [--zhipu-key KEY] [--zhipu-api-url URL] [--zhipu-search-engine ENGINE] [--jina-key KEY] [--jina-reader-api-url URL] [--jina-respond-with MODE] [--jina-timeout SECONDS] [--tavily-api-url URL] [--tavily-key KEY] [--firecrawl-api-url URL] [--firecrawl-key KEY] [--format json|markdown|content] [--output PATH]`
- `smart-search config path [--format json|markdown|content] [--output PATH]`
- `smart-search config list [--format json|markdown|content] [--output PATH]`
- `smart-search config set KEY VALUE [--format json|markdown|content] [--output PATH]`
- `smart-search config unset KEY [--format json|markdown|content] [--output PATH]`
- `smart-search --version`

## Aliases

Top-level aliases must normalize to the same service behavior as their full command:

| Full command | Aliases |
| --- | --- |
| `smart-search --version` | `smart-search --v`, `smart-search -v` |
| `search` | `s` |
| `fetch` | `f` |
| `map` | `m` |
| `exa-search` | `exa`, `x` |
| `exa-similar` | `xs` |
| `zhipu-search` | `z`, `zp` |
| `context7-library` | `c7`, `ctx7` |
| `context7-docs` | `c7d`, `c7docs`, `ctx7-docs` |
| `research` | `rs` |
| `doctor` | `d` |
| `diagnose` | `diag` |
| `setup` | `init` |
| `config` | `cfg` |

Nested aliases:

| Full command | Aliases |
| --- | --- |
| `config path` | `cfg p` |
| `config list` | `cfg ls`, `cfg l` |
| `config set` | `cfg s` |
| `config unset` | `cfg rm`, `cfg u` |

## Output Format Expectations

Successful search output includes `ok`, `query`, `primary_api_mode`, `content`, `sources`, `sources_count`, `primary_sources`, `primary_sources_count`, `extra_sources`, `extra_sources_count`, `source_warning`, `routing_decision`, `providers_used`, `provider_attempts`, `fallback_used`, `validation_level`, and `elapsed_ms`. Each source should include at least `url` when available.

`--format json` is the stable machine-readable contract for agents and scripts. JSON output remains parseable and uses readable non-ASCII text when the terminal encoding supports it.

`--format markdown` is the human-readable report format. `doctor --format markdown` must render a detailed diagnostic report with overall status, active/default/legacy config paths, log path resolution, evidence path resolution, file-logging status, masked config values with sources, minimum profile, capability status, main-search provider checks, provider connectivity checks, model metadata, and full long error/message detail instead of falling back to raw JSON. `diagnose openai-compatible --format markdown` must render a short copy-pasteable troubleshooting report with masked config, quick chat check, real search-shape `stream=false` and `stream=true` checks, a plain-language summary, and a next command. Provider list commands such as `exa-search`, `exa-similar`, `zhipu-search`, `context7-library`, and `map` render result lists or a clear no-results message.

`--format content` prints only the `content` field for content-bearing commands such as `search`, `fetch`, `context7-docs`, and `research`. Commands without a `content` field, including `doctor` and `config`, must print a compact non-empty text summary rather than an empty stdout.

Source provenance fields:

- `primary_sources`: sources explicitly extracted from the primary model/provider answer.
- `extra_sources`: parallel Tavily / Firecrawl candidates from `--extra-sources`; these are not automatic evidence for the generated `content`.
- `sources`: backward-compatible merged list from `primary_sources + extra_sources`, deduped by URL.

Exa domain filters:

- `--include-domains` and `--exclude-domains` accept comma-separated or whitespace-separated domains.
- Both `--include-domains docs.python.org,developer.mozilla.org` and `--include-domains docs.python.org developer.mozilla.org` normalize to the same Exa domain list.
- This normalization is intentional for Windows PowerShell, where an unquoted comma expression can be forwarded through `.ps1` wrappers as a space-separated value.
- `source_warning`: non-empty when extra source candidates were appended.

Fetch output includes `ok`, `url`, `provider`, `content`, `provider_attempts`, `fallback_used`, and `elapsed_ms`.

Zhipu Web Search API legacy setup:

- `ZHIPU_API_URL` defaults to `https://open.bigmodel.cn/api`.
- `ZHIPU_SEARCH_ENGINE` defaults to `search_std`.
- Official Web Search API service values include `search_std`, `search_pro`, `search_pro_sogou`, and `search_pro_quark`.
- `smart-search setup --zhipu-api-url URL --zhipu-search-engine ENGINE` saves these values in non-interactive mode.
- Interactive setup no longer recommends or prompts for Zhipu in the default flow. Use `config set` or non-interactive flags only for explicit manual legacy compatibility.
- `config set ZHIPU_SEARCH_ENGINE VALUE` must remain free-form so newly added official services do not require a CLI release.
- `zhipu-search` corresponds to Zhipu Web Search API, not Zhipu Chat Completions `tools=[web_search]`, not Search Agent, and not the MCP Server.
- `zhipu-search` is deprecated and not used by default routing because quota may be unavailable. Default source discovery uses bilingual `search` through Tavily / Firecrawl when configured.
- `TAVILY_API_URL` only affects Tavily and does not proxy Zhipu.
- `TAVILY_TIMEOUT_SECONDS` controls the Tavily `doctor` connectivity timeout. It defaults to `60` so slower pooled/community endpoints are not incorrectly marked unhealthy by the diagnostic check.

Jina Reader setup:

- `JINA_READER_API_URL` defaults to `https://r.jina.ai`.
- `JINA_API_KEY` is required before Jina satisfies `SMART_SEARCH_MINIMUM_PROFILE=standard`.
- Anonymous Jina Reader calls may be used only as explicit/experimental degraded fetch behavior; they must not make standard setup pass.
- `JINA_RESPOND_WITH=readerlm-v2` requires `JINA_API_KEY` and should report a configuration error without a network request when the key is missing.
- Jina Reader is `web_fetch` only, not `web_search`.
- Jina 401/403, 422, 429, timeout, network errors, and low-quality challenge pages such as `Title: Just a moment...` must be reported as failed provider attempts and allow same-capability fallback.

OpenAI-compatible streaming:

- `OPENAI_COMPATIBLE_STREAM` defaults to `true` and accepts `true`, `1`, or `yes` as true.
- `search --stream` and `search --no-stream` override `OPENAI_COMPATIBLE_STREAM` for the current invocation.
- Streaming applies only to OpenAI-compatible `search()` and provider-side `fetch()` calls. `describe_url()` and `rank_sources()` stay non-streaming.

Exa search output includes `ok`, `query`, `search_type`, `results`, `total`, and `elapsed_ms` when successful.

Exa HTTP `400` or `422` failures are returned as `ok=false` with `error_type=parameter_error`; use this to distinguish bad CLI/domain/date/category arguments from upstream network failures.

Exa similar output includes `ok`, `url`, `results`, `total`, and `elapsed_ms` when successful.

Zhipu search output includes `ok`, `query`, `provider`, `search_engine`, `results`, `total`, and `elapsed_ms` when successful.

Context7 library output includes `ok`, `query`, `provider`, `results`, `total`, and `elapsed_ms` when successful. Context7 docs output includes `ok`, `library_id`, `query`, `provider`, `results`, `total`, `content`, and `elapsed_ms` when successful.

Map output includes `ok`, `base_url`, `results`, `response_time`, `url`, and `elapsed_ms` when successful.

Research executor output includes `ok`, `mode=deep_research_execution`, `query_mode=research`, `question`, `budget`, `research_plan`, `routing_decision`, `stage_results`, `discovery_sources`, `final_answer`, `content`, `citations`, `evidence_items`, `gap_check`, `provider_attempts`, `providers_used`, `fallback_used`, `degraded`, `route_policy_version`, `evidence_dir`, `minimum_profile_ok`, `capability_status`, and `elapsed_ms`. The embedded `research_plan` carries `intent_signals`, `decomposition`, `capability_plan`, `evidence_policy`, `steps`, and `gap_check`. Citations must come only from fetched/read `evidence_items`; discovery sources are candidates until fetched. If evidence cannot close, `research` returns degraded gaps instead of unsupported claims.

Diagnostic output masks keys, reports `config_file` / `config_dir` / `config_dir_source` / `default_config_file` / Windows legacy config metadata / `config_dir_override_value` / `config_dir_override_matches_default` / `log_dir_config_value` / `resolved_log_dir` / `evidence_dir_config_value` / `resolved_evidence_dir` / `file_logging_enabled` / `config_sources` / `primary_api_mode` / `primary_api_mode_source` / provider timeout values / `capability_status` / `minimum_profile_ok`, and includes `main_search_connection_tests` plus connection test objects for Exa, Tavily, Zhipu, Context7, and Firecrawl. `primary_connection_test` remains as a backward-compatible alias for the first configured main provider check. OpenAI-compatible provider health must be validated through `/chat/completions`; `/models` is supplementary metadata and must not be the health gate. Firecrawl currently reports whether `FIRECRAWL_API_KEY` is configured; it is not a live Firecrawl request.

When a Windows user reports that different versions seem to use different config paths, diagnose in this order: `config_dir_source`, `config_dir_override_value`, `config_dir_override_matches_default`, then `legacy_windows_config_exists`. A source of `environment` with `config_dir_override_matches_default=true` means the active path is pinned by `SMART_SEARCH_CONFIG_DIR` but is functionally the same as the current default. Do not delete either config file or the user-level override until the upgraded CLI has been verified with `config path` and `doctor` checks.

## Deep Research Skill Contract

Deep Research is an optional capability orchestration workflow for prompts such as `深度搜索`, `深度调研`, `深入搜索`, `deep search`, `deep research`, multi-source verification, cross-checking, serious review, and selection/comparison research. `smart-search research` is the public live executor command for this workflow. It must not change default `smart-search search` behavior. `research` builds the plan internally, then executes the staged workflow and writes JSON/Markdown evidence.

Deep Research must not require fixed topic recipe ids such as `current_market_research`, `product_comparison_research`, `technical_docs_research`, `news_or_policy_research`, `claim_verification_research`, or `url_first_research`. Those phrases may appear as prompt examples, but they are not schema modes or routing enums.

`research` builds an internal `research_plan` before discovery. Its fields are:

- `mode`: always `deep_research`.
- `query_mode`: always `research`.
- `question`: the user's research question.
- `trigger_source`: usually `explicit_cli`.
- `difficulty`: `standard` or `high`.
- `intent_signals`: dimensional signals such as `recency_requirement`, `docs_api_intent`, `locale_domain_scope`, `known_url`, `source_authority_need`, `claim_risk`, `cross_validation_need`, and `breadth_depth_budget`.
- `decomposition`: subquestions for complex research, each with `id`, `question`, `reason`, and `required_capabilities`.
- `capability_plan`: the selected capability needs and the CLI tools chosen for each need.
- `evidence_policy`: default `fetch_before_claim`.
- `preflight`: `doctor` guidance.
- `steps`: ordered CLI command steps.
- `gap_check`: how the executor verifies that key claims have fetched evidence or downgrades unsupported claims to unverified candidates.
- `final_answer_policy`: how to cite fetched evidence and list unverified candidates.

Each `steps[]` item must include `id`, `subquestion_id`, `tool`, `purpose`, `command`, and `output_path`. Allowed `tool` values are `search`, `exa-search`, `exa-similar`, `context7-library`, `context7-docs`, `fetch`, and `map`; these map to existing CLI commands only. `doctor` is a `preflight` action, not a `steps[]` item. Use the system-aware evidence root from `resolved_evidence_dir` or an explicit `--evidence-dir` absolute directory for `output_path` values.

Capability boundaries:

- `search`: broad bilingual discovery and synthesis through `main_search`; use returned `routing_decision`, `provider_attempts`, `fallback_used`, and `source_warning` as orchestration signals, not as claim proof.
- `zhipu-search`: deprecated manual compatibility command. Do not include it in default research plans.
- `context7-library` and `context7-docs`: library, SDK, API, framework, and documentation intent. Prefer Context7 before Exa for docs/API questions.
- `exa-search`: low-noise source discovery for official domains, papers, product pages, known domains, and trusted pages. It is not the default second hop for every high-risk or verification task.
- `exa-similar`: adjacent-source discovery when a known reliable URL is available.
- `search --extra-sources N`: Tavily/Firecrawl horizontal candidate collection for breadth. Treat those candidates as discovery until fetched.
- `fetch`: page-content evidence. Key claims require fetched page text under `fetch_before_claim`.
- `map`: site structure exploration before many fetches from one site; not claim evidence by itself.

Default Deep Research orchestration:

1. Run `smart-search doctor --format json` as preflight when configuration is uncertain.
2. `research` generates `intent_signals`, `decomposition`, and `capability_plan` internally instead of selecting a fixed topic recipe.
3. Use planned bilingual `search ... --validation balanced --extra-sources 1..3` steps for Chinese-source and English-source broad discovery.
4. Add planned `context7-library` plus `context7-docs` for docs/API/library topics, `exa-search` for official/trusted-domain or paper discovery, `exa-similar` for URL-neighbor discovery, or `map` only when the capability boundary matches the intent.
5. Use `fetch` for key URLs before making claim-level statements.
6. Run `gap_check`: fetch missing evidence for key claims or downgrade them to unverified candidates.

`fetch_before_claim` means key claims must be backed by fetched page content. `primary_sources` and `extra_sources` are discovery candidates until fetched. Final answers should include fetched evidence, unverified candidate sources, and key commands used.

When the user wants the CLI to execute the live workflow directly, call:

```powershell
$Config = smart-search config path --format json | ConvertFrom-Json
$EvidenceDir = Join-Path $Config.resolved_evidence_dir "YYYYMMDD-HHMM-topic"
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
smart-search research "question" --budget deep --fallback auto --format json --output (Join-Path $EvidenceDir "research.json")
```

`research --fallback auto` permits same-capability fallback inside selected routes. `research --fallback off` tries only the first selected provider in each capability route and is for debugging or provider comparison. Dynamic routing may reorder providers only inside the same capability. Every attempt must record capability, provider, status, error type, latency, and result count.

Research provider advantage routing:

- Context7 first for library/API/framework docs and docs retrieval.
- Exa for official domains, papers, product/company pages, date/domain-filtered low-noise discovery, and adjacent-source discovery.
- Tavily for broad bilingual source discovery and site maps.
- Jina for known public URL, PDF, and arXiv clean extraction; ReaderLM-v2 requires `JINA_API_KEY`.
- Firecrawl for robust fetch fallback, JS-heavy/dynamic/browser-like extraction, OCR/PDF/structured extraction.

Safe research overrides are `SMART_SEARCH_RESEARCH_PREFERRED_PROVIDERS` and `SMART_SEARCH_RESEARCH_DISABLED_PROVIDERS`. They may reorder or disable providers only inside capabilities the provider already supports; they must not move a provider across capability boundaries.

Planner closeout lessons:

- Budget limits must not break evidence policy. Even `--budget quick` plans must retain at least one `fetch` step when claim-level conclusions are expected, and retained steps must keep valid `subquestion_id` links.
- `steps[].command` and `steps[].output_path` are one contract. The `--output` path embedded in the executable command must match `output_path`; otherwise the AI agent cannot reliably find saved evidence.
- Prefer PowerShell-safe quoted commands in generated plans because Windows users often copy planned steps directly from Markdown or JSON output.

Deep Research test coverage should verify trigger phrases, normal search requests that should not trigger Deep Research, required `research_plan` fields, allowed tool whitelist, `fetch_before_claim`, evidence paths, capability boundaries, `intent_signals`, `capability_plan`, `gap_check`, simple current prompts such as `深度搜索一下最近的比特币行情`, docs/API prompts, claim-verification prompts, user-provided URL fetch-first flows, missing-provider failure guidance, research provider advantage routing, same-capability research fallback, and the rule that fixed topic recipe ids are not required schema. When real keys are available, a small live `research` check confirms staged behavior end to end. If an issue is found, fix the affected docs/code/tests and rerun until it passes or is proven to be an external provider blocker.

Setup and config output should include `ok` and `config_file`; `config path` and `doctor` should include `resolved_evidence_dir`. Saved API keys must be masked in command output.

Interactive setup behavior:

- Default `smart-search setup` shows a Smart Search ASCII banner, asks for `zh`
  or `en`, then shows a grouped provider wizard.
- The grouped wizard should use an arrow-key / Space / Enter selector when the
  packaged TUI dependencies are available, with a text fallback for non-TTY
  and tests.
- Required groups are `main_search`, `docs_search`, and `web_fetch`; `web_search` is optional reinforcement.
- `--lang zh|en` skips the language question.
- `--advanced` shows low-level config keys one by one for compatibility with older setup behavior.
- `--non-interactive` keeps script behavior and only saves values passed as flags.
- Unchecking a configured provider must not delete existing config values; use
  `smart-search config unset KEY` for deletion.
- Interactive output should summarize `minimum_profile_ok`, missing required capabilities, and next-step commands.
- Beginner filling examples for official-service and relay/pooled-endpoint
  minimum profiles must appear in the grouped wizard on stderr, not stdout.
  They must cover `main_search`, `docs_search`, and `web_fetch` so a first-time
  user can satisfy the minimum profile without understanding provider internals.

Provider endpoint setup:

- `TAVILY_API_URL` defaults to `https://api.tavily.com`.
- `TAVILY_TIMEOUT_SECONDS` defaults to `60` and applies to Tavily `doctor`
  connectivity checks.
- Tavily Hikari / pooled endpoints must use the REST facade base
  `https://<host>/api/tavily`; `/mcp` is not a REST provider base.
- Setup normalizes a Hikari root host or `/mcp` URL to
  `https://<host>/api/tavily`; an existing `/api/tavily` base and official
  `https://api.tavily.com` remain unchanged.
- `FIRECRAWL_API_URL` defaults to `https://api.firecrawl.dev/v2`; custom REST
  bases are saved with scheme normalization and no trailing slash.

Search timeout output uses `ok=false`, `error_type=network_error`, includes the timeout seconds in `error`, keeps `query`, `content`, `sources`, `sources_count`, `primary_sources`, `primary_sources_count`, `extra_sources`, and `extra_sources_count`, and exits with code `4`.

Agent timeout handling contract:

- A `search` result with `ok=false`, `error_type=network_error`, and an `error` message containing `timed out` is retryable at the orchestration layer.
- Agents should retry up to 3 total attempts with `smart-search search ... --timeout 180 --extra-sources 1 --format json --output PATH`, waiting about 5 seconds between attempts and stopping as soon as the saved JSON has `"ok": true`.
- Agents must use the CLI `--timeout` option, not a shell-level `timeout` wrapper, so timeout failures remain structured JSON with exit code `4`.
- `SMART_SEARCH_RETRY_*` settings are not the contract for this path; the visible CLI result is the contract.
- After repeated timeout failures, agents should switch to source-first fallback: `exa-search` for broad source discovery, `exa-search --include-domains` for likely official domains, then `fetch` key URLs before claim-level conclusions.
- Final answers assembled through that fallback should explicitly label the evidence mode, for example `source_mode: "fallback"` or equivalent prose.

## Provider Routing

- `search` builds `main_search` from `OPENAI_COMPATIBLE_API_URL` + `OPENAI_COMPATIBLE_API_KEY`, which registers OpenAI-compatible Chat Completions.
- OpenAI-compatible relays/gateways use Chat Completions `/chat/completions` through `OPENAI_COMPATIBLE_*`.
- `OPENAI_COMPATIBLE_STREAM` and `search --stream/--no-stream` affect only the OpenAI-compatible Chat Completions transport for search/fetch. They do not change provider-internal ranking/URL description tasks.
- Legacy `SMART_SEARCH_API_URL`, `SMART_SEARCH_API_KEY`, `SMART_SEARCH_API_MODE`, and `SMART_SEARCH_MODEL` are unsupported config keys. `config set` / `config unset` must return a parameter error for them.
- Standard minimum profile requires `main_search`, `docs_search`, and fetch capability. Missing required capabilities produce a configuration error.
- Jina satisfies fetch capability only when `JINA_API_KEY` is configured. Anonymous Jina Reader does not satisfy `standard`.
- Same-capability fallback is allowed; cross-capability fallback is not. Context7 is not used for unrelated broad web queries, and page extraction providers are not used as docs search providers.
- `main_search`: OpenAI-compatible Chat Completions.
- `web_search`: `search` runs bilingual web_search source discovery through Tavily / Firecrawl when configured. Zhipu is deprecated from default routing and is not selected automatically for Chinese/current/domestic searches.
- `docs_search`: explicit keyword-based docs/API/library/framework intent. Context7 is first for library/API/docs intent, then Exa for official-domain, paper, product-page, trusted-site, or low-noise supplemental discovery.
- Fetch capability: Tavily first, then Jina Reader with `JINA_API_KEY`, then Firecrawl.
- `search --validation strict` uses the same bilingual web_search policy as balanced mode when source discovery providers are configured. Strict queries without primary, docs, fetch, or explicit source evidence can still fail with `evidence_error`; use `--extra-sources N`, source-first commands such as `exa-search`, or `fetch` when citable evidence is required.
- `search` calls Tavily and/or Firecrawl for `extra_sources` only when `--extra-sources` is greater than 0.
- If both Tavily and Firecrawl are configured, `search --extra-sources N` gives about 60% of extra source slots to Tavily and the remainder to Firecrawl.
- `extra_sources` are retrieved in parallel and are not automatically used by the primary model to verify its answer.
- `fetch` and known-URL `search "https://..."` use the same fetch fallback chain.
- `fetch` tries Tavily first, then Jina Reader with `JINA_API_KEY`, then Firecrawl.
- `research` uses capability-first plus provider-advantage routing. Fallback remains same-capability only; low-quality fetches, challenge pages, empty content, auth/rate/timeout/provider errors, and runtime errors are failed attempts that may trigger same-capability fallback.
- `map` uses Tavily only.
- `exa-search` and `exa-similar` use Exa only.
- `zhipu-search` uses Zhipu only and is retained as a deprecated manual compatibility command.
- `context7-library` and `context7-docs` use Context7 only.
- Runtime config priority is environment variables first, then local config file, then defaults.
- `setup` and `config` read/write the local Smart Search config file and do not call providers.
- Use `config set OPENAI_COMPATIBLE_MODEL ...` to change the main-search model.

## Routing Heuristics

- Use `exa-search --include-domains` when official documentation domains are known.
- Use `context7-library` / `context7-docs` for explicit docs/API/SDK/library/framework intent when Context7 is configured.
- Use the bilingual `search` pair for Chinese, domestic, current, or mixed-language source discovery. Do not use Zhipu unless the user explicitly asks for the deprecated manual route.
- Use `exa-search --start-published-date` for recency-constrained source discovery.
- Use `exa-similar` when a known good page is available and adjacent sources are needed.
- Use `search --format content` when a human wants only the generated answer body.
- Use `fetch --format markdown` or `fetch --format content` for user-supplied URLs or when exact page text matters.
- Use `map` before fetching many pages from a documentation site.
- Keep `search --extra-sources` small (`1` to `3`) unless broad coverage is requested.
- Treat `search --extra-sources N` as explicit candidate discovery; default `extra_sources` is `0`, and candidates still need `fetch` before claim-level citation.
- For current news or high-risk claims, prefer source discovery plus `fetch`; do not treat broad `search.content` plus `extra_sources` as claim-level verification.

## Maintenance Guardrails

- Provider architecture changes must be verified as distributable CLI behavior, not as behavior that only works because one developer machine has a specific wrapper, shell profile, or local config file.
- Register providers by capability first, then route by intent. Fallback is allowed only within the same capability.
- Do not use Context7 for broad news or generic web facts; do not use Tavily or Firecrawl as documentation semantic-search replacements.
- Standard installs must fail closed unless `main_search`, `docs_search`, and fetch capability each have at least one configured provider.
- After provider-routing changes, run the source-checkout offline test suite. If live keys were used, run a targeted secret scan for exact key substrings before committing.

## Exit Codes

- `0`: success
- `2`: parameter error
- `3`: configuration error
- `4`: network or upstream error
- `4`: also used for strict insufficient-evidence search failures
- `5`: runtime or parse error

## Release Lanes

- Stable releases are pushed as `vX.Y.Z` Git tags and publish npm `X.Y.Z` with dist-tag `latest`.
- Test releases are pushed from `main` and publish `<package.json version>-beta.N` with dist-tag `next`. The beta counter resets per base version, so `0.1.9-beta.1` and `0.1.10-beta.1` are separate sequences.
- Stable bump commits must use `chore(release): bump version to X.Y.Z`; the branch push is skipped by the npm workflow so the matching `vX.Y.Z` tag is the only publisher for npm `latest`.
- Stable GitHub release notes should be stored as `.github/releases/vX.Y.Z.md` before tagging. The publish workflow appends npm package, dist-tag, and workflow-run metadata to that body automatically.
- Historical test builds can be backfilled through GitHub Actions `workflow_dispatch` by supplying an explicit `target_ref`, exact `version`, and a non-`latest` npm tag such as `backfill`.
- npm versions are immutable. Old `*-dev.*` packages cannot be renamed in place; publish replacement `*-beta.N` packages and optionally deprecate the old names when npm owner credentials are available.

### Release Closeout Lessons

- Always read back npm before and after publishing with `npm view @konbakuyomu/smart-search versions --json` and `npm view @konbakuyomu/smart-search dist-tags --json`. A test release must leave `latest` on the stable version and move only `next` or the explicitly supplied non-`latest` tag.
- Backfill jobs can publish npm successfully even if GitHub release creation fails because the workflow token cannot access the release API. In that case, leave npm intact and create the missing GitHub prerelease with authenticated local `gh release create ... --prerelease --latest=false`.
- If concurrent backfill jobs hit npm `E409`, re-dispatch only the affected versions serially after checking whether the version already appeared in the registry.
- Finish with a diff-style gap check: expected beta version list minus npm versions equals empty, and expected `vX.Y.Z-beta.N` list minus GitHub prereleases equals empty.
- Local verification after a test release must use an exact install target, such as `mise use -g "npm:@konbakuyomu/smart-search@0.1.10-beta.3" -y --pin`, followed by `mise reshim`, `where.exe smart-search`, `smart-search --version`, and `smart-search doctor --format json`. Also pipe a non-ASCII JSON command such as `smart-search search "深度搜索一下最近的比特币行情" --format json | ConvertFrom-Json` to verify the Windows npm/mise wrapper is emitting UTF-8 JSON, not locale-encoded bytes.

## Tool Policy

Web research through this skill should use `smart-search` CLI. If the CLI is unavailable, report the blocker and recovery steps instead of silently falling back to another web-search route.
