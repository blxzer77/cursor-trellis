# smart-search

简体中文 | [English](README.md)

`smart-search` 是一个给 AI 助手和命令行用户使用的 CLI-first 网页研究工具。它把普通联网搜索、来源发现、网页正文抓取、站点 map、配置检查和 live Deep Research 执行统一成一个可复现的命令层。

<p>
  <a href="https://www.npmjs.com/package/@konbakuyomu/smart-search">
    <img src="https://img.shields.io/npm/v/@konbakuyomu/smart-search?label=npm%20latest" alt="npm latest">
  </a>
</p>

![Star History Chart](https://api.star-history.com/svg?repos=konbakuyomu/smartsearch&type=Date)

## 它到底是什么

它不是 MCP Server，而是一个普通命令行工具。AI 工具通过 `smart-search-cli` skill 调它，脚本和终端用户也可以直接调它：

```powershell
smart-search search "今天 OpenAI Responses API 有什么新变化" --format json
smart-search fetch "https://example.com/article" --format markdown
smart-search research "OpenAI Responses API web_search 和 Chat Completions 联网搜索怎么选" --format markdown
```

当前架构分两层：

| 层 | 负责什么 |
| --- | --- |
| CLI 执行层 | 稳定执行命令、provider 路由、同能力兜底、JSON/Markdown 输出、本机配置 |
| Skill / AI 编排层 | 判断用户意图，决定普通搜索还是 Deep Research，按计划执行 CLI 积木，最后写出有来源支撑的回答 |

`smart-search search` 保持快速、直接联网。`smart-search research` 是 live Deep Research 执行器：它会先在内部生成计划，再按 plan -> discover -> fetch/read -> gap check -> evidence-only synthesis 执行。

## 安装

稳定版：

```powershell
npm install -g @konbakuyomu/smart-search@latest
smart-search --version
smart-search setup
```

测试版：

```powershell
npm install -g @konbakuyomu/smart-search@next
smart-search --version
```

npm 包安装时会自动创建隔离的 Python 运行环境。你平时只需要使用 `smart-search` 这个命令。

前置条件：

- 已安装 Node.js / npm。
- 已安装 Python 3.10 或更新版本，并且终端里能运行 `python`、`python3` 或 Windows 的 `py -3`。

## 快速开始

1. 配置 provider：

```powershell
smart-search setup
smart-search doctor --format json
```

2. 普通快速搜索：

```powershell
smart-search search "今天有什么值得关注的 AI 新闻？" --validation balanced --extra-sources 2 --format json
```

3. 抓取关键网页正文：

```powershell
smart-search fetch "https://example.com/source" --format markdown --output evidence.md
```

4. 让 CLI 直接执行 live Deep Research：

```powershell
smart-search research "深度搜索一下最近的比特币行情" --budget deep --format markdown
```

## 当前架构

| 能力 | 主要命令 | Provider | 负责什么 |
| --- | --- | --- | --- |
| `main_search` | `search` | OpenAI-compatible Chat Completions | 综合回答、快速搜索、初步总结 |
| `docs_search` | `context7-library`、`context7-docs`、`exa-search` | Context7、Exa | 官方文档、SDK、API、框架/库文档 |
| `web_search` | `search` 内部中英双语来源发现；`zhipu-search` 仅作 deprecated 手动兼容 | Tavily、Firecrawl；智谱 Web Search API 仅在显式请求时使用 | 每个常规研究问题都做中文和英文网页来源发现 |
| `web_fetch` | `fetch` | Tavily、Jina Reader、Firecrawl | 已知 URL 正文抓取、证据提取 |
| `site_map` | `map` | Tavily | 文档站、产品站、目录型站点结构 |
| `research_executor` | `research` / `rs` | 按 capability 注册的 provider | live 深度研究执行：规划、发现、抓取/读取、gap check、仅基于证据综合 |

同能力兜底关系：

| 能力 | 兜底链 |
| --- | --- |
| `main_search` | OpenAI-compatible |
| `docs_search` | Context7 处理库/API/文档意图；Exa 处理官方域名、论文、产品页、可信站点发现 |
| `web_search` | Tavily -> Firecrawl；智谱仅在显式选择 deprecated legacy 命令时使用 |
| `web_fetch` | Tavily -> 带 `JINA_API_KEY` 的 Jina Reader -> Firecrawl |

Jina Reader 只属于 `web_fetch`，不是通用搜索 provider。只有配置 `JINA_API_KEY` 后，它才可以满足 `SMART_SEARCH_MINIMUM_PROFILE=standard`；匿名 `r.jina.ai` 只能当显式/实验抓取能力，不能让最低配置检查放松。

这里有一个重要边界：兜底只在同一类能力里发生。不会用 Context7 去查普通新闻，也不会用 Firecrawl 假装做文档语义检索。

输出里会保留可观测字段：

| 字段 | 作用 |
| --- | --- |
| `routing_decision` | 为什么触发了某些补强路径 |
| `provider_attempts` | 每个 provider 的尝试结果 |
| `providers_used` | 最终用到哪些 provider |
| `fallback_used` | 是否触发同能力兜底 |
| `primary_sources` | 主搜索回答里带出的来源 |
| `extra_sources` | Tavily / Firecrawl 等额外发现的候选来源 |
| `source_warning` | 来源和回答之间可能存在的证据边界提醒 |

`balanced` 和 `strict` 的 `search` 默认通过 Tavily / Firecrawl 执行中英双语 `web_search` 来源发现：同一个用户问题会生成一个中文来源查询和一个英文来源查询。`--validation fast` 跳过补强。没有主回答来源、docs、fetch 或显式来源证据的 strict 查询仍可能返回 `evidence_error`；需要可引用证据时，用 `--extra-sources N`、`exa-search` 这类 source-first 命令，或直接 `fetch` 关键 URL。docs 补强继续保持显式 docs/API/库/框架关键词触发。

`extra_sources` 是通过 `--extra-sources N` 显式请求的候选来源，默认是 `0`，不等于自动事实校验。新闻、政策、财经、医疗、严肃评测、工具选型等高风险问题，建议先发现来源，再 `fetch` 关键网页正文，最后只基于抓到的正文写结论。

搜索引擎选择速记：先用 `search` 做中英双语宽泛探索和综合；想让 CLI 执行完整证据流时用 `research`；库/API/框架文档优先用 Context7；官方域名、论文、产品页、可信站点和低噪声发现再用 Exa；Tavily/Firecrawl 负责双语网页发现和 URL/页面证据；Jina 用于已知 URL 正文抓取。智谱只保留为 deprecated 手动兼容命令，不再作为默认路径。

## Deep Research 深度搜索

普通问题用：

```powershell
smart-search search "React useEffect cleanup 文档" --format json
```

如果你希望 CLI 直接执行完整 live Deep Research，用：

```powershell
smart-search research "OpenAI Responses API web_search 和 Chat Completions 联网搜索怎么选" --budget deep --fallback auto --format json
smart-search rs "https://example.com/source" --fallback off --format markdown
```

`research` 会先在内部生成 Deep Research 计划，再执行 plan -> discover -> fetch/read -> gap check -> evidence-only synthesis。规划阶段会产出：

- `intent_signals`：是否强时效、是否 docs/API、是否给 URL、是否高风险、是否需要权威来源、是否需要交叉验证；
- `decomposition`：复杂问题拆成 1-6 个子问题；
- `capability_plan`：选择需要的能力；
- `steps[]`：每一步的 `tool`、`purpose`、`command`、`output_path`、`subquestion_id`；
- `evidence_policy="fetch_before_claim"`；
- `gap_check`：关键结论没有正文证据就继续抓，或者降级成未验证候选。

Deep Research 不是固定题材配方。行情、选型、技术文档、新闻政策、真假核验、用户给 URL 这些只是用户语言示例，不是 schema 枚举。

规划只允许组合现有 CLI 积木：

```text
search, exa-search, exa-similar, context7-library, context7-docs, fetch, map
```

`doctor` 是 preflight 配置预检，不是 research step；它帮助 AI 判断当前 provider 是否可用，但不算 Deep Research 的取证步骤。

默认 `--fallback auto`，会在同一 capability 内兜底；`--fallback off` 只尝试每个 capability 选中的第一个 provider，适合手动调试某个 provider。

`research` JSON 会包含 `final_answer`、`citations`、`evidence_items`、`gap_check`、`provider_attempts`、`fallback_used`、`degraded`、`route_policy_version` 和 `evidence_dir`。发现阶段的 snippet 只是候选，不会直接变成 citation；只有 fetch/read 到正文的来源才会被引用。兜底仍然补不齐证据时，`research` 会降级输出 gap，不会编造结论。

`research` 的路由是 capability-first 加 provider 优势：

- Context7 优先处理库/API/框架文档，Exa 用于官方域名、论文、产品页、可信站点和低噪声发现。
- Tavily / Firecrawl 负责中英双语宽泛来源发现。智谱已从默认路由弃用，除非显式请求 legacy 命令，否则不会用于中文、时效、国内搜索。
- Jina 优先用于已知公开 URL、PDF、arXiv 正文抽取；ReaderLM-v2 仍要求 `JINA_API_KEY`。
- Firecrawl 优先用于 JS-heavy、动态页面、浏览器式抽取、OCR/PDF 或强兜底抓取。

高级路由覆盖项是 `SMART_SEARCH_RESEARCH_PREFERRED_PROVIDERS` 和 `SMART_SEARCH_RESEARCH_DISABLED_PROVIDERS`。它们只能在 provider 已支持的 capability 内调整顺序或禁用，不能把 provider 移到另一个 capability。

可以用这些标准问题测试 live Deep Research：

```powershell
smart-search research "深度搜索一下最近的比特币行情" --format json
smart-search research "OpenAI Responses API web_search 和 Chat Completions 联网搜索怎么选" --budget deep --format json
smart-search research "帮我核验这个说法是真是假：某某工具已经完全替代 Tavily 做 AI 搜索了" --format json
smart-search research "https://example.com/source" --format json
```

看到输出里有 `mode=deep_research_execution`、`citations`、`evidence_items`、`gap_check`，就说明已经进入 Deep Research 执行模式。

## API 和 Key 申请入口

普通用户优先用 `smart-search setup` 配置。环境变量仍然支持 CI 和高级用户。

| Provider / 路线 | 用途 | 主要配置项 | 官方文档 | Key / 控制台 |
| --- | --- | --- | --- | --- |
| OpenAI-compatible Chat Completions | 主搜索，适合 OpenAI 官方或兼容中转 | `OPENAI_COMPATIBLE_API_URL`、`OPENAI_COMPATIBLE_API_KEY`、`OPENAI_COMPATIBLE_MODEL`、`OPENAI_COMPATIBLE_STREAM` | [OpenAI platform docs](https://platform.openai.com/docs) | [OpenAI API keys](https://platform.openai.com/api-keys) 或你的兼容服务商 |
| Exa | 官方文档、API、论文、产品页、可信网页的低噪声发现 | `EXA_API_KEY` | [Exa docs](https://docs.exa.ai/) | [Exa API keys](https://dashboard.exa.ai/api-keys) |
| Context7 | SDK、库、框架、API 文档兜底 | `CONTEXT7_API_KEY`、`CONTEXT7_BASE_URL` | [Context7 docs](https://context7.com/docs) | [Context7](https://context7.com/) |
| 智谱 Web Search API | 仅用于 deprecated 手动 `zhipu-search` 兼容；不参与默认路由 | `ZHIPU_API_KEY`、`ZHIPU_API_URL`、`ZHIPU_SEARCH_ENGINE` | [智谱联网搜索文档](https://docs.bigmodel.cn/cn/guide/tools/web-search) | [智谱 API keys](https://open.bigmodel.cn/usercenter/apikeys) |
| Tavily | 额外来源、URL fetch、站点 map | `TAVILY_API_URL`、`TAVILY_API_KEY` | [Tavily docs](https://docs.tavily.com/) | [Tavily app](https://app.tavily.com/home) |
| Jina Reader | 已知 URL 正文抓取；满足 standard 最低配置必须有 key | `JINA_API_KEY`、`JINA_READER_API_URL`、`JINA_RESPOND_WITH`、`JINA_TIMEOUT_SECONDS` | [Jina Reader](https://jina.ai/reader/) | [Jina AI](https://jina.ai/) |
| Firecrawl | fetch 兜底、补充网页来源 | `FIRECRAWL_API_URL`、`FIRECRAWL_API_KEY` | [Firecrawl docs](https://docs.firecrawl.dev/) | [Firecrawl API keys](https://www.firecrawl.dev/app/api-keys) |

几个容易混淆的点：

- OpenAI-compatible 兼容中转/网关走 Chat Completions `/chat/completions`，只通过 `OPENAI_COMPATIBLE_*` 配置。
- `OPENAI_COMPATIBLE_STREAM=true` 或 `smart-search search --stream` 只会给 OpenAI-compatible 的 `search` 和 provider 侧 `fetch` 设置 `stream=true`。它是中转长请求兼容开关，不改变 URL 描述和来源排序行为。
- 旧的 `SMART_SEARCH_API_URL`、`SMART_SEARCH_API_KEY`、`SMART_SEARCH_API_MODE`、`SMART_SEARCH_MODEL` 不再是受支持配置项。请显式使用 `OPENAI_COMPATIBLE_*`。
- 默认网页发现走 Tavily / Firecrawl 的中英双语路径。`zhipu-search` 仅保留为 deprecated 手动兼容命令，不参与普通 `search` 或 `research` 路由。
- `zhipu-search` 对应的是智谱 Web Search API，不是 Chat Completions `tools=[web_search]`，不是 Search Agent，也不是 MCP Server。
- Jina Reader 不是通用搜索 provider。只有配置 `JINA_API_KEY` 后才计入 `standard`；`JINA_RESPOND_WITH=readerlm-v2` 也必须配置 `JINA_API_KEY`。
- `ZHIPU_SEARCH_ENGINE` 默认是 `search_std`。官方值包括 `search_std`、`search_pro`、`search_pro_sogou`、`search_pro_quark`；`config set` 仍允许自定义值，方便官方以后新增服务。
- `TAVILY_API_URL` 只影响 Tavily，不会代理智谱。Tavily Hikari / 号池用 `https://<host>/api/tavily`；setup 会把根域名或 `/mcp` 输入规范化成这个 REST base。
- `FIRECRAWL_API_URL` 默认是 `https://api.firecrawl.dev/v2`。

非交互配置示例：

```powershell
smart-search setup --non-interactive `
  --openai-compatible-api-url "https://api.openai.com/v1" `
  --openai-compatible-api-key "your-openai-or-relay-key" `
  --openai-compatible-model "gpt-4.1" `
  --openai-compatible-stream "false" `
  --validation-level "balanced" `
  --fallback-mode "auto" `
  --minimum-profile "standard" `
  --exa-key "your-exa-key" `
  --context7-key "your-context7-key" `
  --jina-key "your-jina-key" `
  --tavily-api-url "https://api.tavily.com" `
  --tavily-key "your-tavily-key" `
  --firecrawl-api-url "https://api.firecrawl.dev/v2" `
  --firecrawl-key "your-firecrawl-key"
```

仅在显式需要 legacy 智谱兼容时，`smart-search setup --non-interactive --zhipu-key "your-zhipu-key" --zhipu-api-url "https://open.bigmodel.cn/api" --zhipu-search-engine "search_pro_sogou"` 仍会保存这条 deprecated 手动路径。

默认最低配置是 `SMART_SEARCH_MINIMUM_PROFILE=standard`，至少需要：

- `main_search`：OpenAI-compatible；
- `docs_search`：Exa 或 Context7 二选一；
- `web_fetch`：Tavily、带 `JINA_API_KEY` 的 Jina、Firecrawl 三选一。

缺少任一最低能力时，`doctor` 和 `search` 会 fail closed 并返回缺失 capability。`SMART_SEARCH_MINIMUM_PROFILE=off` 只建议本地实验使用。

本机配置和证据文件位置：

- Windows 默认：`%LOCALAPPDATA%\smart-search\config.json`。
- Linux/macOS 默认：`~/.config/smart-search/config.json`。
- `SMART_SEARCH_CONFIG_DIR` 是高级覆盖项，适合 CI、容器、沙箱或便携安装。
- `research` 证据默认保存到当前配置目录下的 `evidence`，例如 Windows 上的 `%LOCALAPPDATA%\smart-search\evidence`。
- `SMART_SEARCH_EVIDENCE_DIR` 可覆盖证据根目录；相对路径会解析到当前配置目录下，绝对路径按原样使用。
- 更早的 Windows 源码默认路径曾是 `~\.config\smart-search\config.json`，但有些安装会通过 `SMART_SEARCH_CONFIG_DIR` 提前固定到 `%LOCALAPPDATA%\smart-search`。如果新版默认位置还没有配置，但旧 home 路径存在配置，Smart Search 会以 `legacy_windows_home` 方式继续读取旧配置，避免升级后配置丢失；`config path` 和 `doctor` 会同时报告当前生效路径、默认路径、旧 home 路径、`SMART_SEARCH_CONFIG_DIR`、`SMART_SEARCH_EVIDENCE_DIR` 和最终解析出的证据根目录。

常用环境变量：

| 变量 | 用途 |
| --- | --- |
| `OPENAI_COMPATIBLE_API_URL` | OpenAI-compatible `/v1` base URL |
| `OPENAI_COMPATIBLE_API_KEY` | OpenAI-compatible key |
| `OPENAI_COMPATIBLE_MODEL` | 兼容模型名，默认 `grok-4.20-multi-agent-xhigh` |
| `OPENAI_COMPATIBLE_STREAM` | OpenAI-compatible 中转兼容开关，接受 `true/1/yes`，默认 `true` |
| `EXA_API_KEY` | Exa key |
| `CONTEXT7_API_KEY` | Context7 key |
| `ZHIPU_API_KEY` | 智谱 Web Search key |
| `ZHIPU_API_URL` | 智谱 API 地址，默认 `https://open.bigmodel.cn/api` |
| `ZHIPU_SEARCH_ENGINE` | 智谱搜索服务，例如 `search_pro_sogou` |
| `JINA_API_KEY` | Jina Reader key；满足 standard 必须配置 |
| `JINA_READER_API_URL` | Jina Reader endpoint，默认 `https://r.jina.ai` |
| `JINA_RESPOND_WITH` | Jina Reader 响应模式，例如 `readerlm-v2`；需要 `JINA_API_KEY` |
| `JINA_TIMEOUT_SECONDS` | Jina Reader 请求超时，默认 `60` |
| `TAVILY_API_URL` | Tavily REST base |
| `TAVILY_API_KEY` | Tavily key |
| `TAVILY_TIMEOUT_SECONDS` | Tavily 连通性检查超时，默认 `60`；公益站/号池较慢时可调大 |
| `FIRECRAWL_API_URL` | Firecrawl REST base |
| `FIRECRAWL_API_KEY` | Firecrawl key |
| `SMART_SEARCH_VALIDATION_LEVEL` | `fast`、`balanced`、`strict` |
| `SMART_SEARCH_FALLBACK_MODE` | `auto` 或 `off` |
| `SMART_SEARCH_RESEARCH_PREFERRED_PROVIDERS` | `research` 路由优先 provider CSV，只能在同 capability 内调整顺序 |
| `SMART_SEARCH_RESEARCH_DISABLED_PROVIDERS` | `research` 禁用 provider CSV，不能改变 provider capability 边界 |
| `SMART_SEARCH_CONFIG_DIR` | 指定本机配置和日志根目录 |
| `SMART_SEARCH_EVIDENCE_DIR` | 指定 `research` 默认证据根目录 |

## 常用命令

| 命令 | 简写 | 用途 |
| --- | --- | --- |
| `search` | `s` | 快速联网搜索和综合回答 |
| `research` | `rs` | live Deep Research 执行 |
| `fetch` | `f` | 抓一个 URL 正文 |
| `map` | `m` | 读取站点结构 |
| `exa-search` | `exa`、`x` | Exa 来源发现 |
| `exa-similar` | `xs` | 从一个 URL 找相似页面 |
| `zhipu-search` | `z`、`zp` | Deprecated legacy 智谱 Web Search API |
| `context7-library` | `c7`、`ctx7` | 查 Context7 库候选 |
| `context7-docs` | `c7d`、`c7docs`、`ctx7-docs` | 抓 Context7 文档 |
| `doctor` | `d` | 配置和连通性检查 |
| `setup` | `init` | 配置向导 |
| `config` | `cfg` | 本机配置读写 |

示例：

```powershell
smart-search search "query" --validation balanced --extra-sources 3 --timeout 90 --format json --output result.json
smart-search research "query" --budget deep --fallback auto --format json --output research.json
smart-search search "query" --stream --format json
smart-search search "query" --no-stream --format json
smart-search search "nba战报" --format content
smart-search exa-search "OpenAI Responses API documentation" --include-domains platform.openai.com developers.openai.com --num-results 5 --include-text --format json
smart-search context7-library "react" "hooks" --format json
smart-search context7-docs "/facebook/react" "useEffect cleanup" --format json
smart-search exa-similar "https://example.com/source" --num-results 5 --format json
smart-search fetch "https://example.com/source" --format markdown --output page.md
smart-search map "https://docs.example.com" --instructions "Find API reference pages" --max-depth 1 --limit 50 --format json
smart-search doctor --format markdown
```

## 输出和证据策略

AI 和脚本解析优先用 JSON：

```powershell
smart-search search "query" --format json
smart-search doctor --format json
```

给人看连接状态、详细排障报告、来源列表、网页正文时用 Markdown：

```powershell
smart-search doctor --format markdown
smart-search exa-search "OpenAI Responses API documentation" --format markdown
smart-search fetch "https://example.com" --format markdown
```

终端快速扫正文或摘要用 content：

```powershell
smart-search search "nba战报" --format content
smart-search doctor --format content
```

`content` 刻意保持很短，只适合快速看结论。完整排障给人看用 `doctor --format markdown`，给脚本和 AI 解析用 `doctor --format json`。

多来源研究建议保存证据文件：

```powershell
$Config = smart-search config path --format json | ConvertFrom-Json
$EvidenceDir = Join-Path $Config.resolved_evidence_dir "iran-hormuz"
New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
smart-search exa-search "Reuters Iran Hormuz latest" --format json --output (Join-Path $EvidenceDir "01-exa.json")
smart-search fetch "https://example.com/source" --format markdown --output (Join-Path $EvidenceDir "02-fetch.md")
```

写 claim-level 结论时建议流程：

1. 用中英双语 `search`、`exa-search` 或 `exa-similar` 找候选 URL。
2. 用 `fetch` 抓关键 URL 正文。
3. 最终回答只引用 fetch 正文能支撑的事实。
4. 没有 fetch 的来源标为未验证候选。

## 排障

如果 `doctor` 返回 `config_error`：

```powershell
smart-search setup
smart-search config list --format json
smart-search doctor --format markdown
```

如果搜索慢：

- 降低 `--extra-sources`；
- 把大问题拆成多个小问题；
- 先用中英双语 `search` 或 `exa-search` 找来源，再 `fetch` 关键网页。

如果想确认安装是否正常：

```powershell
smart-search --help
smart-search --version
smart-search doctor --format json
```

Windows npm/mise 安装后建议验证中文 JSON 管道：

```powershell
smart-search search "深度搜索一下最近的比特币行情" --format json | ConvertFrom-Json
```

## 开发验证

```powershell
.\.venv\Scripts\python.exe -m compileall -q src tests
.\.venv\Scripts\python.exe -m pytest tests -q
npm test
npm pack --dry-run
```

## 最新稳定版说明

### v0.1.14

这个稳定补丁版把已经验证过的 `0.1.13-beta.4` CLI 和内置 skill contract 推到 npm `latest`。

- `smart-search diagnose openai-compatible --format markdown` 会生成适合复制给维护者的 OpenAI-compatible 卡住/超时诊断报告。
- 文档/API 路由现在优先用 Context7 处理库/框架文档，Exa 继续负责官方域名、论文、产品页和可信站点发现。
- README、打包 skill 资源、release notes 和测试已经同步说明并验证这次稳定包行为。

## 发布通道

稳定版走 Git tag 和 npm `latest`：

```powershell
git tag v0.1.14
git push origin v0.1.14
```

测试版不移动 `latest`。推送到 `main` 会发布下一个 `<package.json version>-beta.N` 到 npm `next`，并且 `N` 按每个稳定版本重新从 1 开始。例如 `0.1.10-beta.1`、`0.1.10-beta.2` 之后是 `0.1.10-beta.3`。

已发布 npm 版本不可变。旧的 `*-dev.*` 包不能原地改名，只能发布新的 `*-beta.N` 替代。

稳定版 GitHub Release 会读取 `.github/releases/vX.Y.Z.md` 作为正文，并自动追加 npm package、dist-tag、workflow run 等元数据。打稳定 tag 前先写这个文件，避免 Release 页面只显示包名和 workflow 链接。

发布收尾检查：

1. 先读 `npm view @konbakuyomu/smart-search versions --json`、`npm view @konbakuyomu/smart-search dist-tags --json`、`gh release list --repo konbakuyomu/smartsearch --limit 100`。
2. beta 发布必须保持 `latest` 不动，只移动 `next` 或指定的非 latest tag。
3. 遇到 npm `E409`，先查版本是否已经发布，再串行重跑对应版本。
4. 最后安装指定版本并运行 `smart-search --version`、`smart-search doctor --format json`。
5. Windows npm/mise 包装层额外跑中文 JSON 管道：`smart-search search "深度搜索一下最近的比特币行情" --format json | ConvertFrom-Json`。

## License

MIT
