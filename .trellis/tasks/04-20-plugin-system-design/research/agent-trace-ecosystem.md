# Research: Agent Trace 规范生态实现 + Coding Agent 可观测性

- **Query**: Cursor agent-trace RFC 0.1.0 实施情况 + coding agent observability landscape
- **Scope**: external (web search)
- **Date**: 2026-04-20
- **Related task**: `.trellis/tasks/04-20-plugin-system-design/prd.md`

---

## TL;DR

- **Agent Trace RFC 0.1.0** (cursor/agent-trace) 于 2026-01-27 发布, CC BY 4.0 许可, 截至 2026-04-20 仍是 **RFC 阶段的厂商提案**, 不是事实标准.
- **真正在生产中写入 agent-trace 格式的只有 Cursor 的 reference implementation 和两个社区 fork** (`yurekami/agent-trace`, `Siddhant-K-code/agent-trace`). 其他签字方 (Amp / Cline / Cloudflare / Vercel / Jules / OpenCode / Amplitude / Cognition) **以"原则支持"为主, 没有找到任何一方在自己的 agent 里已落地写 `.agent-trace/*.json`**.
- **`git-ai`** 是目前唯一的**竞争性事实标准**: 它用 Git Notes + 本地 checkpoints 存 Authorship Log, 独立于 agent-trace RFC, 但两者解决同一问题.
- **`opentraces.ai` v0.3.0** (2026-04-16) 是一个**发散性规范**: 结构比 agent-trace 丰富得多 (TraceRecord + Task + Agent + Steps + Observations + ToolCalls + Attribution + Metrics), 明显有独立演进意图.
- **可观测性生态** (Langfuse / Datadog / Braintrust / LangSmith) 都是基于 **hooks 插件 + OpenTelemetry GenAI semantic conventions** 做 coding agent tracing; 没有一家原生支持 agent-trace RFC 格式.
- **如果 Trellis 做 trace plugin**: 核心选择是 "写 agent-trace JSONL" vs "走 OTel GenAI spans" vs "调用 git-ai checkpoint". 三者互不替代.

---

## Part A: Agent Trace 规范实现情况

### A.0 RFC 0.1.0 自身现状

**Repository**: [cursor/agent-trace](https://github.com/cursor/agent-trace)
- Created 2026-01-27, 665 stars, last push 2026-02-06, 仅 2 位 contributor (leerob from Vercel, cursoragent)
- 版本仍为 0.1.0, **规范本身在 Feb-Mar 被大量 RFC issue 请求澄清**:
  - #29 Plan Records, #28 Atomic vs Agent Trace replay, #27 mixed contributor 语义, #26 privacy & durability, #25 trace lifecycle / git rewrite semantics, #24 conversation.kind, #23 conversation.tool, #22 vcs.repository_url, #21 tool.version optionality, #18 Agent Trust Stack, #16 decision resource type, MCP Usage Tracking
- **没有 0.2.0 发布**, 所有讨论还在 issue 中
- 规范关键字段: `version` (0.1.0), `id` (UUID), `timestamp` (RFC3339), `vcs` (git/jj/hg/svn + revision), `tool` (name + version), `files[]` (path + attributions[] → contributor {type: human/ai/mixed/unknown, model_id} + ranges[] {start_line, end_line, content_hash:murmur3})
- **存储**: "storage-agnostic" — RFC 明确不规定位置, reference impl 用 `.agent-trace/{uuid}.json` (一个 UUID 一个文件, 不是 JSONL append)
- **MIME type**: `application/vnd.agent-trace.record+json`

### A.1 Amp (Sourcegraph) — 未实现

- 签字列表出现 "Amp" (cursor/agent-trace README)
- Amp 实际产品文档 (`ampcode.com/manual`, `ampcode.com/manual/sdk`) **没有任何 agent-trace 相关配置项**
- Amp 唯一相关的 attribution 设置: `amp.git.commit.coauthor.enabled` (把 Amp 加为 git commit co-author) 和 `Amp-Thread` trailer
- Amp SDK (`@sourcegraph/amp-sdk`) 输出 `--stream-json` 流消息 (system/assistant/result) 用于程序集成, 但**这是独立的 SDK streaming 格式, 不是 agent-trace**
- 状态: **仅承诺**

### A.2 Cline — 未实现 agent-trace, 但有 Hooks 基础设施

- 签字列表出现 "Cline"
- Cline 的 CHANGELOG (2025-09 到 2026-03) 大量实现了 **Claude Code 兼容的 Hooks 系统** (PR #6440, issue #5605): PreToolUse / PostToolUse / Notification / SessionStart hooks
  - Hook payloads 带 `model.provider`, `model.slug`
  - 配置位置: `.clinerules/hooks/` (project), `~/Documents/Cline/Hooks/` (global)
- **没有 agent-trace 相关的 changelog entry**
- 但 Cline 的 hooks 已经把"每次工具调用 + 文件编辑"都有通道可以导出 → 社区可以写一个"Cline → agent-trace"桥, 暂未见
- 状态: **仅承诺** (但有技术基础)

### A.3 Cloudflare — 未实现 agent-trace, 但重金押注 OTel

- 签字列表出现 "Cloudflare"
- Cloudflare 官方博客和 Agents Week 2026 (2026-04-14) 公告中**未提及 agent-trace**
- Cloudflare 实际做的是:
  - **Workers Tracing (2025-10 open beta)**: 基于 **OpenTelemetry** 的自动 span instrumentation, 无需代码改动
  - 2026-03-01 起按 span/log event 计费 (200k/day free, 10M/month on paid)
  - Agents SDK v0.7.0 (2026-03-02) "Observability rewrite, keepAlive" — 把 diagnostics channel 转发给 Tail Workers
  - Agent Cloud + Dynamic Workers (2026-04-13) — 运行 AI 生成代码的 isolate sandbox
- Cloudflare 的路径很清楚: **OTel-first, 不是 agent-trace-first**
- 状态: **仅承诺 agent-trace, 已实现 OTel tracing**

### A.4 Cognition / Devin — 博客支持, 没有实现细节

- [Cognition 博客 2026-01-29 "Agent Trace: Capturing the Context Graph of Code"](https://cognition.ai/blog/agent-trace) — 这是**宣布 Agent Trace 的官方文章之一**
- 博客内容是**理念宣言** (context graph, "LoC is commodity, context is precious"), **没有给出 Devin 实现 agent-trace 的技术细节**
- Cognition 后续博客 (2026-02-27 "How Cognition Uses Devin to Build Devin") 描述 Devin 内部使用 Datadog MCP + DeepWiki + Playbooks + Session Insights, **未提 agent-trace 写入**
- **注意**: contextgraph.tech 文章 (一个第三方) 声称 "Cursor and Devin are already building native Agent Trace support" — 但没有 citation, 可能是营销措辞
- 状态: **仅承诺** (博客级支持, 无落地证据)

### A.5 git-ai — 独立的平行标准, 不兼容 agent-trace

- 签字列表出现 "git-ai"
- Repository: [git-ai-project/git-ai](https://github.com/git-ai-project/git-ai), 生产产品 `usegitai.com`
- **git-ai 完全自己一套**, 跟 agent-trace **不共享任何 schema**:
  - 存储: **Git Notes** (绑在 commit 上) + 本地 SQLite + `.git/ai/` checkpoint diffs
  - 集成: agent 调用 `git-ai checkpoint` CLI 而非写 JSON 文件
  - 核心概念: **Authorship Log** 链接 line ranges → conversation hashes
  - Preset: `agent-v1` (strict shape) — 发送 `transcript` (user/assistant/tool_use messages)
  - 支持 "blame / diff / stats" CLI 命令 (drop-in git replacement: `git ai blame`)
  - 保持 attribution 跨 rebase / squash / cherry-pick / amend (通过 wrapping git binary)
- git-ai 1.0 **自称 "maintains the open standard for tracking AI authorship in Git Notes"** — 这个措辞明显和 agent-trace 争事实标准
- 状态: **独立已实现** (产品级, 跟 agent-trace RFC 存在竞争关系)

### A.6 Google Jules — 仅签字, 无实现证据

- 签字列表出现 "Jules"
- Jules 本身文档 (`jules.google/docs`) 只提到:
  - 任务跑在 Google Cloud VM 里, 返回 diff
  - 用 `AGENTS.md` 读项目结构
  - 提供 Jules Tools CLI + Jules API (2025-10)
- `google-labs-code/jules-sdk` (npm @google/jules-sdk) 没有任何 agent-trace 字段
- **没有任何 Jules 官方文档提到 agent-trace 写入**
- 状态: **仅承诺**

### A.7 OpenCode — 签字但未实现, 社区有 OTel 分支需求

- 签字列表出现 "OpenCode" (sst/opencode, 最近转到 anomalyco/opencode)
- **没有找到任何 OpenCode 相关的 agent-trace PR / issue**
- OpenCode 的可观测性路径:
  - **Issue #219** (2025-06 开, 状态 open, 18 👍) — 请求 Langfuse tracing, 被 **PR #4978** (2025-12) 部分解决 — 社区写了"minimal plugin" 做 Langfuse OTel 导出
  - **Issue #12142** — 请求 OTEL export capabilities
  - **Issue #18801 + PR #18800** (2026-03-23) — 传播 incoming `traceparent` / `tracestate` headers (W3C Trace Context)
  - **Issue #12930** — 转发 session/parent-session IDs 作为 HTTP header
  - **Issue #6142** — `experimental.chat.system.transform` hook 加 sessionID 用于 tracing
- MLflow 在 2026-01 开了 #20096 请求支持 opencode tracing, 2026-03-21 由 PR #20133 merge — 所以 **MLflow 已支持 opencode tracing, 走的是 OTel/plugin 路线**, 不是 agent-trace
- 状态: **仅承诺 agent-trace, 社区走 OTel/Langfuse 路线**

### A.8 Vercel — 只有 App Attribution (不同概念), 无 agent-trace

- 签字列表出现 "Vercel" (Lee Rob 是 agent-trace repo 的 top contributor, Vercel CEO/CTO 都支持)
- Vercel **"App Attribution"** (`vercel.com/docs/ai-gateway/ecosystem/app-attribution`) **是另一个东西**: 仅仅两个 HTTP header (`http-referer`, `x-title`) 用于 Gateway 识别应用, 跟 agent-trace 文件写入无关
- Vercel 的 coding agent 方向 (`vercel.com/docs/ai-gateway/coding-agents`, 2026 博客 "How we built AEO tracking for coding agents") 专注在 **AI Gateway 做 request tracing + sandbox 运行**, 没有 agent-trace 文件
- 状态: **仅承诺 agent-trace**, "App Attribution" 是无关的同名概念

### A.9 Amplitude — 签字, 做了 Agent Analytics, 但不是 agent-trace 的实现

- 签字列表出现 "Amplitude"
- Amplitude 在 2026-03-18 发了 ["Why We Created Agent Analytics"](https://amplitude.com/blog/agent-analytics) — 这是 Spenser Skates 说的 "analytics dashboard"
- **但 Agent Analytics 不是 agent-trace 的 dashboard**, 它是 Amplitude 自己定义的 "trace" (user-agent conversation), 用于分析 "agent as a product":
  - 定位: "sits between product analytics and LLM observability"
  - 数据对象: multi-turn conversations with intent / outcome / sentiment
  - Customer target: 构建 AI agent 产品的团队, 不是 coding agent 用户
- Amplitude AI Agents (2026-02) — 是 Amplitude 自己的 agent 产品, 连 Amplitude MCP 到 Claude/Cursor
- 状态: **仅承诺 agent-trace, 已实现自己的 Agent Analytics**

### A.10 其他 signatory: Tapes

- 签字列表出现 "Tapes" — 没有找到具体产品页面或实现证据, 信息不足
- 状态: **信息不足**

---

## A.X 实际已实现的 Agent Trace 写入方

1. **cursor/agent-trace 自带 reference implementation** (`reference/trace-store.ts`, `reference/trace-hook.ts`) — 针对 Cursor 或 Claude Code 的 hooks 集成示例
2. **[yurekami/agent-trace](https://github.com/yurekami/agent-trace)** (2026-02-02) — TypeScript reference impl, v0.1.0 full compliance, 为 Claude Code integration 设计, 存 `.agent-trace/{uuid}.json`
3. **[Siddhant-K-code/agent-trace](https://github.com/Siddhant-K-code/agent-trace)** (2026-03-15, Python) — 实际上**不是 agent-trace RFC 实现**, 而是"`strace` for AI agents" — 捕获 tool calls / prompts / responses 用于 Claude Code / Cursor / MCP, 导出到 Datadog / Honeycomb / New Relic / Splunk. 只是**同名**, schema 完全不同 (内部用自定义 JSON, 支持 NDJSON/CSV/OTLP export). 这是第一个重要"名字撞车"
4. **cursor 自己的产品** — RFC 文档声称 Cursor 会用 agent-trace, 但**没有公开文档说明 Cursor 当前版本是否默认写 `.agent-trace/`** (截至 2026-04-20 未找到)

---

## A.Y 已知 JSONL/存储格式变体

| Source | 格式 | 兼容 agent-trace RFC? |
|---|---|---|
| `cursor/agent-trace` reference | `.agent-trace/{uuid}.json` (一文件一记录) | 基准 |
| `yurekami/agent-trace` | 同上, `.agent-trace/{uuid}.json` | ✅ v0.1.0 compliant |
| `Siddhant-K-code/agent-trace` (PyPI) | 内部 JSON, 可导出 OTLP/NDJSON/JSON/CSV | ❌ 同名不同构 |
| **opentraces.ai v0.3.0** (2026-04-16) | JSONL, 一行一 TraceRecord | ❌ **完全不同 schema** (TraceRecord + Task + Agent + Steps + ToolCalls + Observations + Attribution + GitLink with evidence tiers) |
| `agent-trace-replay` PyPI v0.1.1 | JSONL, 一行一 span (trace_header / span / events) | ❌ 又是同名不同构, 针对 agent replay |
| `git-ai` | Git Notes + `.git/ai/*.json` checkpoints + SQLite | ❌ 不同哲学 (git-native) |
| Cursor [dev.cursor] metadata namespace | agent-trace.metadata 的 vendor key | 扩展, 兼容 RFC |

**"agent-trace" 名字已经被至少三个项目占用** (Cursor RFC, Siddhant-K strace tool, opentraces.ai), schema 各不相同. Cursor RFC 的 MIME type `application/vnd.agent-trace.record+json` 目前没有 IANA 注册.

---

## Part B: Coding Agent 可观测性生态

### B.1 Langfuse for coding agents

- **Claude Code**: 通过 Stop hook + Python script, env var `TRACE_TO_LANGFUSE=true`, 存在 `langfuse/skills` repo + Cursor plugin 自动安装
- **Cursor**: `naoufalelh/cursor-langfuse` (2025-12) — 12 个 Cursor hooks 都接入, 存 conversation → Langfuse trace, 用 workspace 名作为 session, tags: `cursor` / `agent` / `tab` / `shell` / `mcp` / `file-ops` / `thinking`
- **OpenCode**: 社区 plugin (opencode issue #219, PR #4978) 把 Langfuse 作为 OTel export target
- Langfuse 官方 CLI 也支持 skill 模式, `langfuse get-skill` 输出 `SKILL.md`
- `michaeloboyle/claude-langfuse-monitor` (v1.1.0, 2026-03) — 监听 `~/.claude/projects/*.jsonl` 自动 push traces
- 数据模型: **Langfuse trace** (per conversation) + **observations** (LLM calls / tool calls) + **scores** (evals)

### B.2 Datadog Cursor extension

- **datadog-labs/cursor-plugin** (2026-03-10, preview) — 从 Cursor 直接 query Datadog (logs/metrics/traces/dashboards/monitors)
- 机制: **Datadog MCP Server** (managed, `mcp.datadog.com`, 分 region) 暴露 APM / LLM Observability / Docs / APM toolsets
- **Live Debugger** 集成: 在 Cursor 里直接下 logpoint, 用 `add_dynamic_log_at_line` tool
- Datadog 也 ships **`datadog-labs/agent-skills`** (2026-02): dd-pup / dd-apm / dd-llmo / dd-docs skills 给 Claude Code / Codex / Gemini / Cursor / Windsurf / OpenCode
- **Agentic Onboarding** (2026 Q1): agent 自动给项目加 Datadog RUM/Error Tracking 配置
- 数据模型: **Datadog APM spans** (OTel-compatible) + LLM Observability traces + experiment/eval 对象

### B.3 OpenTelemetry GenAI semantic conventions (截至 2026-04-04)

- 官方文档: [opentelemetry.io/docs/specs/semconv/gen-ai](https://opentelemetry.io/docs/specs/semconv/gen-ai/)
- **状态仍是 Development**, 不是 stable
- v1.36.0 是当前"旧版", 转换计划依赖环境变量 `OTEL_SEMCONV_STABILITY_OPT_IN=gen_ai_latest_experimental`
- 分类:
  - **Model spans** — `chat` / `embeddings` / `retrieval` / `execute_tool` / `invoke_agent` / `create_agent` / `invoke_workflow` (新增 2026-03-09)
  - **Agent spans** — `gen_ai.agent.name`, `gen_ai.agent.version`, `create_agent` (for remote agent services)
  - **Events** — `gen_ai.client.inference.operation.details` (input/output), `gen_ai.evaluation.result`
  - **Exceptions** — GenAI 错误 semantic
- 技术厂商扩展: Anthropic / Azure AI Inference / AWS Bedrock / OpenAI
- **MCP** 有专门的 semantic convention
- 最新变化: 2026-04-04 PR #3595 — `execute_tool` span 要求 `name` 必填

### B.4 Braintrust / Helicone / LangSmith / PromptLayer — coding agent 支持

- **Braintrust** [docs](https://www.braintrust.dev/docs/integrations/developer-tools/claude-code):
  - 两个 plugin: `braintrust` (MCP, 把 Braintrust logs/prompts/experiments 带进 Claude Code) + `trace-claude-code` (hooks 导出 sessions/turns/tool-calls)
  - env var `TRACE_TO_BRAINTRUST=true`, `BRAINTRUST_CC_PROJECT`
  - Cursor 也有 extension 自动配 `.cursor/mcp.json`
- **LangSmith** (LangChain):
  - `langchain-ai/langsmith-claude-code-plugins` (Claude Code marketplace) — plugin 自动 trace LLM interactions / file operations / tool calls / token usage
  - env var `TRACE_TO_LANGSMITH`, `CC_LANGSMITH_API_KEY`, `CC_LANGSMITH_PROJECT`
  - LangSmith Insights + eval 支持
- **Helicone**: 主打 LLM request logging, 没找到专门 Claude Code / Cursor plugin, 通常走 base URL proxy 方式
- **PromptLayer**: 传统 prompt management/logging, 没找到 coding-agent-specific integration
- **MLflow**: 支持 Claude Code 和 (自 2026-03-21) OpenCode tracing, 通过 plugin 机制
- **模式一致**: 所有家都用 **Claude Code hooks (PreToolUse/PostToolUse/Stop/SessionStart)** 作为 universal export 通道, 环境变量控制 opt-in
- 数据模型: OTel-compatible spans, 外加自家 trace/session/score 概念

### B.5 Claude Code 自己的 native transcript 格式

- Claude Code 把每个 session 存为 `~/.claude/projects/{project}/{session-id}.jsonl` — 一行一 message (user/assistant/tool_use/tool_result)
- 第三方工具 (`claude-langfuse-monitor`, `agent-strace`) 都**watch 这个 JSONL 目录**做 post-hoc tracing
- **这可能是 coding agent 领域最"事实"的 trace 格式** — 因为 Claude Code 的装机量最大, 其他工具 (langsmith/langfuse/braintrust) 都针对它适配

---

## Part C: 结论

### C.1 Agent Trace 规范是什么地位?

- **不是事实标准**, 是 **Cursor 主导 + Vercel leerob 共同维护** 的 RFC, 其他 signatory 都是"原则支持"
- 规范 5 个月零实际 signatory 落地 (除 Cursor 自己), 0.1.0 → 0.2.0 没动
- **git-ai 是事实对手**: 它有生产级产品 + enterprise SKU + multi-agent 支持 (Cursor / Claude Code / GitHub Copilot), 且明确自称 "open standard"
- opentraces.ai 的 v0.3.0 schema 显示有些人觉得 agent-trace RFC 不够深, 自己做了更丰富的版本
- OTel GenAI semantic conventions 和 agent-trace 解决不同层次: OTel 是**运行时 span**, agent-trace 是**归属记录**, 两者可以共存但没有直接映射

### C.2 如果 Trellis 做 trace plugin 要兼容什么?

**按市场份额和 pragmatism 排序**:

1. **Claude Code session JSONL** (`~/.claude/projects/*.jsonl`) — 已有大量第三方监听, 零改动就能被 Langfuse / Braintrust / LangSmith 消费. **最接近事实标准**.
2. **Cursor hooks 输出** (12 hooks, 2025-12 起) — Cursor 用户导出的唯一通道, 已被 Langfuse / Datadog / Braintrust plugin 用. Hook payload shape 是 Cursor 专属, 不是标准.
3. **OpenTelemetry GenAI spans** — 未来方向, 但当前 Development 状态, Cloudflare / Vercel 押注. 走 OTel collector 可以 fanout 到所有观测厂商.
4. **Agent Trace RFC 0.1.0 JSONL** — 写 `.agent-trace/{uuid}.json` 文件. 生态小, 但写起来便宜 (~100 行), 有 signal 价值.
5. **git-ai checkpoints** — 需要用户装 `git-ai` CLI 并配 shim, 集成重但 attribution 最可靠 (跨 rebase).
6. **Langfuse / Braintrust / LangSmith / Datadog plugin** — 不用 Trellis 自己做, 用户自己装 plugin 就有.

### C.3 建议的存储格式/位置

**观察**:
- Agent Trace RFC 用 `.agent-trace/{uuid}.json` (每会话一文件) — 对小改动场景太碎
- git-ai 用 `.git/ai/` + Git Notes — 要 hook git binary, 侵入性高
- Claude Code 用 `~/.claude/projects/{project}/{session}.jsonl` — per-session JSONL, **这个形状最可用**
- opentraces.ai 用 JSONL, 一行一 TraceRecord
- Trellis 已有 `.trellis/tasks/{task}/` 目录结构, 天然可以放在 `.trellis/tasks/{task}/traces/*.jsonl`

**"更好的格式"候选**:
- 每个 task 目录下一个 `traces/session-{uuid}.jsonl`
- JSONL 内容用 OTel GenAI span 形状 (兼容未来), 外层 trace_id 对齐 task_id
- Post-hoc 导出器把 JSONL → agent-trace record / langfuse / git-ai checkpoints (pluggable exporters)
- 用 `.gitignore` 默认忽略, 避免污染 repo; 单独的 opt-in commit hook 才写入 Git Notes / agent-trace

---

## Caveats / Not Found

- **Tapes** — signatory 列表中, 未找到产品页面或代码证据, 不能判断是哪家公司/产品
- **Cursor 自身**: RFC 承诺 Cursor 会 "demonstrate integration", 但截至 2026-04-20 没找到 Cursor 当前版本默认写 `.agent-trace/` 的公开文档. 需要下 Cursor 实测.
- **Cognition Devin 实际实现**: 博客是宣言级, 缺技术细节. 2026-04-09 "Devin Open Source Initiative is Back" 博文可能有, 但本次检索未涵盖.
- **Jules AGENTS.md 与 agent-trace 的关系**: Jules 读 AGENTS.md, 但是否反向写 agent-trace 无证据.
- **git-ai 是否跟 agent-trace 在 IETF 层面对话**: agent-trace issue tracker 里找到 #18 "Agent Trust Stack + Provenance Integration", 但没具体聊 git-ai.
- **agent-trace RFC 0.2**: 规范作者计划中但未发布, 所有讨论在 issue #21-#29 中.
- **Amplitude Spenser Skates 原话**: 只从 martechvibe / Amplitude 博客找到"agent analytics"语境, 没找到他直接说"为 agent-trace 做 dashboard" — 可能是 agent-trace signatory page / 新闻稿里的措辞, 原始 quote 未定位.

---

## External References (按重要性)

- [cursor/agent-trace](https://github.com/cursor/agent-trace) — RFC 0.1.0 源头
- [cursor/agent-trace/issues](https://github.com/cursor/agent-trace/issues) — 0.2 讨论全在这
- [agent-trace.dev](https://agent-trace.dev/) — RFC 托管
- [cognition.ai/blog/agent-trace](https://cognition.ai/blog/agent-trace) — Cognition 宣言
- [usegitai.com](https://usegitai.com/) — git-ai 产品
- [github.com/git-ai-project/git-ai](https://github.com/git-ai-project/git-ai) — git-ai 源码
- [opentraces.ai/schema/latest](https://opentraces.ai/schema/latest) — 发散的 v0.3.0 规范
- [opentelemetry.io/docs/specs/semconv/gen-ai](https://opentelemetry.io/docs/specs/semconv/gen-ai/) — OTel GenAI 官方
- [github.com/open-telemetry/semantic-conventions/tree/main/docs/gen-ai](https://github.com/open-telemetry/semantic-conventions/tree/main/docs/gen-ai) — 活跃开发
- [get.langfuse.com/integrations/other/cursor](https://get.langfuse.com/integrations/other/cursor) — Cursor→Langfuse
- [get.langfuse.com/integrations/other/claude-code](https://get.langfuse.com/integrations/other/claude-code) — Claude Code→Langfuse
- [datadoghq.com/blog/datadog-cursor-extension](https://www.datadoghq.com/blog/datadog-cursor-extension/) — Datadog Cursor 宣布
- [github.com/datadog-labs/cursor-plugin](https://github.com/datadog-labs/cursor-plugin) — Datadog plugin 源码
- [github.com/datadog-labs/agent-skills](https://github.com/datadog-labs/agent-skills) — Datadog skills for 多 agent
- [braintrust.dev/docs/integrations/developer-tools/claude-code](https://www.braintrust.dev/docs/integrations/developer-tools/claude-code) — Braintrust
- [github.com/sst/opencode/issues/219](https://github.com/sst/opencode/issues/219) — OpenCode Langfuse 需求 + 社区 plugin
- [vercel.com/docs/ai-gateway/coding-agents](https://vercel.com/docs/ai-gateway/coding-agents) — Vercel coding agents
- [vercel.com/docs/ai-gateway/ecosystem/app-attribution](https://vercel.com/docs/ai-gateway/ecosystem/app-attribution) — Vercel App Attribution (同名不同)
- [amplitude.com/blog/agent-analytics](https://amplitude.com/blog/agent-analytics) — Amplitude Agent Analytics
- [developers.cloudflare.com/workers/observability/traces](https://developers.cloudflare.com/workers/observability/traces/) — CF Workers OTel tracing
- [granda.org/en/2026/01/30/who-is-agent-trace-for/](https://granda.org/en/2026/01/30/who-is-agent-trace-for/) — 批判性分析 agent-trace
- [jangwook.net/en/blog/en/cursor-agent-trace-ai-code-attribution](https://jangwook.net/en/blog/en/cursor-agent-trace-ai-code-attribution/) — agent-trace 在 ADL/MCP/Skills 生态定位
