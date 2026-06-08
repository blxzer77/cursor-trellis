# brainstorm: Trellis plugin 机制 + memory/trace 插件设计

## Goal

为 Trellis 设计一套**可选插件机制**，让用户按需启用附加能力（记忆系统、对话/代码 trace），而不把这些能力硬编码到 Trellis 核心 init/update 流程。

首批要落地的两个插件：
1. **Memory plugin** — 类 Serena/Supermemory 的 AI 记忆能力
2. **Trace plugin** — 对接 Cursor Agent Trace 开放规范 + 底层对话日志

## Current Brainstorm Status

本 task 仍处于 Phase 1 requirement exploration / design brainstorm。当前目标是讨论清楚 plugin 机制、Memory、Trace 之间的边界和 MVP 范围；尚未进入实现准备阶段。

在以下问题收敛前，不创建 `implement.jsonl` / `check.jsonl`，也不派发实现或检查 agent：
- Plugin 机制本身的抽象边界
- Memory plugin 的最小闭环
- Trace 与 Memory 的关系，以及 Trace 是否仍作为独立 plugin
- 首批 MVP 的实际切入点

## Current Design Candidate: Storage Ownership

详细第一性原理分析见 [`fp-analysis.md`](fp-analysis.md)。

当前更合理的方向是把“物理存储位置”和“逻辑查询 scope”分开：

- **默认 user-global local store**：存 raw traces、session digest、personal memory、跨项目索引；不进 git，通过 metadata 支持 current-project / global / branch / task 过滤。
- **项目级共享知识默认复用现有 Trellis 文档面**：稳定规范进 `.trellis/spec/`，任务设计和调研进 `.trellis/tasks/<task>/`，时间线和会话总结进 `.trellis/workspace/<dev>/journal-*.md`；不默认新增 `.trellis/memory/wiki/` 这套 parallel wiki。
- **后续 team server backend**：解决多人同步、权限、审计、集中搜索；不作为 MVP 默认要求，但 CLI/MCP API 需要为 backend provider 留接口。

关键结论：当前项目搜索不要求数据物理放在当前项目目录。全局 store + project metadata filter 可以同时支持当前项目检索和跨项目个人记忆；项目级共享知识优先落到现有 spec / task / journal 体系，Memory 层负责索引、召回和 promote 建议，而不是复制一份新知识库。

## Current Design Candidate: Memory Plugin Shape

Memory plugin 不应该从“再存一份 raw session”开始，而应该从“统一索引各 IDE/CLI 已有会话 + 提炼可行动记忆”开始。

核心产品判断：

- Claude Code / Codex / OpenCode / Cursor 本身已经有原生 transcript 存储；Trellis 默认不复制完整 raw session，避免重复存储和磁盘膨胀。
- Trellis 的价值在于跨工具、跨项目、跨时间的统一 catalog / search / digest / promote，而不是替代每个工具自己的历史记录。
- GUI app 后续需要的不是一堆复制出来的 JSONL，而是一个统一的 session catalog：按项目、工具、时间、task、branch、文件、决策、错误类型检索和筛选。
- Raw session 只在三种场景复制或 snapshot：用户显式导出、原生存储不可稳定访问、或需要团队共享/迁移到 server 时。

建议的本地默认 store 更像 index/cache，而不是 source-of-truth：

```text
~/.trellis/memory/
  catalog.sqlite              # sessions, projects, transcript pointers, hashes, indexing state
  digests/                    # selected session / task summaries, markdown or JSON
  notes/                      # personal durable memory entries
  cache/                      # optional extracted chunks / embeddings / FTS cache
```

Memory plugin 的能力边界：

- `discover`：扫描 Claude Code / Codex / OpenCode / Cursor 等原生 transcript，建立 catalog，不复制全文。
- `search`：按 current project / global / task / branch 搜 native transcript、digests、repo docs。
- `digest`：把高价值 session 提炼成结构化摘要，默认存在 user-global store。
- `promote`：把 digest 中值得共享的知识建议写入 canonical home：`spec/`、`tasks/<task>/research`、`tasks/<task>/info.md` 或 `journal`。
- `recall`：在 session start / user prompt 时召回少量相关 memory，注入当前 agent。
- `prune`：清理 catalog/cache/digests；不删除原 IDE/CLI 的原生历史，除非用户显式授权。

因此 raw session capture 不是 Memory MVP 的默认核心能力。默认核心是“索引 native raw + 生成 digest + promote 到现有 Trellis 知识面”。

## Research References

所有详细调研沉淀在 `research/` 目录（12 份）：

**规范与生态**：
- [`research/agent-trace-spec.md`](research/agent-trace-spec.md) — Cursor Agent Trace RFC 0.1.0 规范解读（schema / 参考实现 / hook 事件表）
- [`research/agent-trace-ecosystem.md`](research/agent-trace-ecosystem.md) — Agent Trace 生态现状（RFC 停滞 / 签字方实现情况 / opentraces.ai / git-ai 竞争方案 / OTel GenAI）
- [`research/memory-systems-landscape.md`](research/memory-systems-landscape.md) — Memory 系统全景（Anthropic 原生 Memory Tool GA / mem0 / Letta / Zep / Basic Memory / Obsidian MCP 等 10 个产品对比）

**平台能力**：
- [`research/claude-code-hook-api.md`](research/claude-code-hook-api.md) — Claude Code 24 个 hook 事件完整 payload schema + transcript 存储实测 + 环境变量
- [`research/opencode-plugin-api.md`](research/opencode-plugin-api.md) — OpenCode 15 个 hook + 1.2.x factory function 约定 + Claude Code 映射表 + 能力缺口
- [`research/cursor-chat-storage.md`](research/cursor-chat-storage.md) — Cursor state.vscdb 聊天存储（事后 scraper 路径）
- [`research/cursor-trace-ux.md`](research/cursor-trace-ux.md) — Cursor Trace 事后观测 UX 路径（SQLite scraper）

**参考产品**：
- [`research/serena-memory.md`](research/serena-memory.md) — Serena 的 memory 设计（本地 md + 5 tools + agent 主动召回）
- [`research/supermemory.md`](research/supermemory.md) — Supermemory SaaS 形态
- [`research/karpathy-llm-wiki.md`](research/karpathy-llm-wiki.md) — Karpathy Wiki LLM 4 原则 + 社区 12 天落地方案（llm_wiki / obsidian-ai-orange-book / wiki9 / Rowboat 等）

**Trellis 现状**：
- [`research/trellis-existing-extension-points.md`](research/trellis-existing-extension-points.md) — Trellis 现有 5 种 plugin-like 机制盘点

**思考沉淀**：
- [`research/fp-spec-memory-trace-boundary.md`](research/fp-spec-memory-trace-boundary.md) — 2026-04-22 first-principles 分析：`spec/` 改名 vs `_index.md` 路由、trace ⊂ sources ≠ memory、`memory/` 作为顶层的三层认知状态闸门（结论**未合入本 PRD**，留作后续决策素材）
- [`research/trace-as-memory-feedstock.md`](research/trace-as-memory-feedstock.md) — 2026-04-23 定位切换：Trace 从 observability/attribution → Memory 底座。`.developer` ini 开关 + `.trellis/.traces/` per-developer 存储 + Case 1（纯采集）/ Case 2（采集+digest）两种实现路径。**原 OTel / exporter 路线作废**，PRD 待整章重写（结论**未合入本 PRD**）

**OTel 生态调研（定位切换后降为参考历史）**：
- [`research/otel-mcp-semconv.md`](research/otel-mcp-semconv.md) — MCP 的 OpenTelemetry semantic convention 实况（`span.mcp.client/server`、`mcp.method.name` 枚举、Python/C# SDK 已支持、TS SDK 靠第三方、MCP spec #246/#414 未定）

## What I already know

**核心架构认知**：

- **Trellis 本质是配置生成器**（init/update 后退场），真正的 runtime 在各 AI CLI 里。所以"Trellis 插件"的抽象是：**Capability Bundle，声明需要的 skill/hook/storage/plugin.js，由 Trellis 在 init 阶段分发到各平台的原生扩展点**。
- **Trellis 已有 5 种扩展点**（Platform Registry / Shared Templates / Migration / OpenCode Plugins / Spec Marketplace），plugin 机制应**复用**而非新建子系统。

**Memory 方向（调研后确认）**：

- Anthropic **2026-04 GA 的原生 Memory Tool** (`memory_20250818`) 路线与 Serena/Trellis 哲学一致：本地文件 + 6 命令（`view/create/str_replace/insert/delete/rename`）+ agent 主动调用
- 业界主流（Basic Memory / Obsidian MCP / Letta MemFS / ByteRover 2.0）都在这个象限收敛 —— **Trellis 不是赌方向，是踩中共识**
- **关键决策**：Memory plugin 的 tool schema **对齐 Claude 官方的 6 命令**，使 handler 可同时充当 MCP server + Claude Memory Tool handler（一套代码两个 channel）
- **值得借鉴**：`_index.md` 路由表（省 token）、memory 文件进 git（Letta MemFS 思路）
- **不做**：vector / graph 栈（反 Trellis 气质）、SaaS、跨线做 agent 运行时

**Trace 方向（调研后重大调整）**：

- ⚠️ **Agent Trace RFC 0.1.0 发布 5 个月零迭代**（2026-04 仍 0.1.0），实际落地的仅 Cursor 参考实现 + 1-2 个社区 fork
- **8/10 signatory 仅承诺未实现**（Amp / Cline / Cloudflare / Cognition / Jules / OpenCode / Vercel / Amplitude）
- **事实标准浮现**：`.opentraces.ai v0.3.0`（2026-04-16 发布，schema 比 agent-trace 更丰富，带 Steps/ToolCalls/Attribution/GitLink evidence tiers）+ git-ai（Git Notes + `.git/ai/*` checkpoints，schema 与 agent-trace 不兼容）
- **事实标准优先级**：Claude Code session JSONL > Cursor hooks > OTel GenAI > agent-trace RFC > git-ai checkpoints
- **可观测性生态通用模式**：Langfuse / Braintrust / LangSmith / Datadog 都走"Claude Code hooks + env var opt-in"
- **OpenTelemetry GenAI semantic conventions** 仍是 Development 状态，但 2026-03-09 刚加 `invoke_workflow` span

**Trace 架构决策调整**：

Trellis 应该用**内部形态（对齐 OTel GenAI）做 source of truth**，把 agent-trace / opentraces / git-ai 作为**可插拔 exporter**，不 1:1 绑定任何规范。

存储路径**待定**（Open Question）：trace 是否与 task 绑定尚未决策。三个候选：
- (a) 全局平铺 `.trellis/traces/session-{uuid}.jsonl` — 无绑定，按时间/session id 归档
- (b) Task-scoped `.trellis/tasks/{task}/traces/session-{uuid}.jsonl` — 需要 session↔task 绑定基建（依赖 `04-21-session-scoped-task-state`）
- (c) 先平铺后归集 — 默认写 `.trellis/traces/`，提供显式 `/trellis:attach <session> <task>` 事后归档

**Claude Code / OpenCode 平台能力**：

- **Claude Code**：24 hook 事件，PostToolUse/UserPromptSubmit/SessionStart/SessionEnd payload 都有实测 schema；transcript 存 `~/.claude/projects/<normalized>/<session_id>.jsonl`，subagents 嵌在 `<sessionId>/subagents/` 下
- **OpenCode**：15 hook，`async (PluginInput) => Hooks` factory 形态（1.2.x breaking），transcript 存 `~/.local/share/opencode/storage/`（session/message/part 三级分目录）
- **能力差异**：OpenCode 缺 `Stop` / `SubagentStop` / agent-hook；Claude Code 缺 `shell.env` / `permission.ask`
- **陷阱**：OpenCode `chat.message` 改动会持久化，`experimental.chat.system.transform` 不会（memory recall 要看是否想显示在历史）

## Assumptions (temporary)

- A1: 插件是 **opt-in** 的，`trellis init` 不默认启用任何插件
- A2: 插件资源在 `trellis plugin add <name>` 或 `trellis update` 时写入目标平台
- A3: 存储默认本地（`.trellis/memory/` / `.agent-trace/`），云端后端作为可选配置
- A4: Code Attribution（Agent Trace 规范）和 Conversation Transcript 是**两个不同插件**，前者引用后者
- A5: 首批仅支持 Claude Code + OpenCode（真 hook 平台），Cursor 等 IDE 平台走降级或留空
- A6: Plugin 分发复用 Spec Marketplace 的 `--registry` 机制，不引入 npm 依赖

## Open Questions

（Blocking / Preference 问题，每次只问一个）

- Q1（当前待答）：MVP 范围 — 聚焦 Trace / 聚焦 Memory / 均分 / 只做机制 / 其他？
- Q3（待答）：Trace 存储是否与 task 绑定？
  - (a) 全局平铺 `.trellis/traces/` — 最简单，零依赖
  - (b) Task-scoped `.trellis/tasks/{task}/traces/` — 语义清晰但依赖 session↔task 绑定（见 `04-21-session-scoped-task-state`）
  - (c) 平铺 + 事后 `/trellis:attach` 归集 —— 弱绑定折中
  - ⚠️ 2026-04-22 更正：原先 PRD 把路径默认写成 (b)，是**未经决策的暗假设**；已改回 (a) 作为默认
- Q2（待答）：Memory plugin 的 ingest 触发形态 —
  - (A) **常驻 wiki subagent**：注册 `.claude/agents/wiki.md`，挂 `Stop`/`SubagentStop` hook，每次主对话结束自动 ingest 当轮讨论（jakevin7 "agent team" 形态，实时但对 Claude Code subagent + hook 耦合深，OpenCode 无 `Stop`/`SubagentStop` 要降级）
  - (B) **手动 slash command**：`/ingest <path>`，用户按需触发（jackwener/llm-wiki 原始形态，实现简单但用户要记得触发）
  - (C) **双通道共存**：subagent 负责 session 级自动 ingest，slash command 负责显式 ingest 外部源 —— 默认启用 A，B 作为 fallback

## Requirements (evolving)

### Plugin 机制本身
- [ ] 定义 Plugin Manifest schema（声明依赖 capability、平台适配、资源清单）
- [ ] `trellis plugin add/remove/list` 命令
- [ ] `.trellis/plugins/` 目录约定 + registry 远程拉取
- [ ] 插件资源写入/清理生命周期（复用 `writeMode` / migration manifest 机制）
- [ ] 插件启用状态持久化（`.trellis/config.json` 或类似）

### Memory Plugin（Claude Memory Tool 对齐版 + llm-wiki vault 形态）
- [ ] 本地存储采用 **jackwener/llm-wiki vault schema**：`.trellis/memory/{wiki-purpose.md, wiki-schema.md, wiki-log.md, wiki/, sources/YYYY-MM-DD/, _index.md}`（raw 与 derived 分层，`sources/` immutable）
- [ ] Tool schema **对齐 Claude API Memory Tool `memory_20250818`** 的 6 命令：`view` / `create` / `str_replace` / `insert` / `delete` / `rename`
- [ ] Skill 内容以 `jackwener/llm-wiki/skills/llm-wiki.md`（315 行）为基础改写，加 Trellis 代码场景的 MUST / NEVER ingest 规则
- [ ] 4 个 slash command 闭环：`/ingest` / `/query`（带 knowledge compounding 写回）/ `/lint` / `/research`
- [ ] Skill 分发到 Claude Code / OpenCode（agent 主动调用模式）
- [ ] Handler 双通道：同一份核心逻辑同时充当 MCP server tool handler + Claude API Memory Tool handler
- [ ] `_index.md` 路由表约定（Reddit + Obsidian MCP 验证的省 token 最佳实践）
- [ ] **Wiki subagent 形态**（pending Q2）：注册 `.claude/agents/wiki.md` 订阅 `Stop` / `SubagentStop` hook 做实时 ingest；OpenCode 走 `session.idle` 事件降级
- [ ] **Ingest 原子化 + 可撤销**：每次 `/ingest` 作为独立 git commit，`wiki-log.md` 记录 commit SHA，`trellis memory revert <log-entry>` 原子回滚（应对 @LuckyCurveC 反馈的 ingest 错误传播）
- [ ] **项目级 Ingest Filter**：`.trellis/memory/wiki-agent.md` 可覆盖默认 MUST / MAY / NEVER 标准，缺失时 fallback 到 `CLAUDE.md` / `AGENTS.md` bootstrap 默认
- [ ] **Incremental guard**：source frontmatter 带 `ingested: YYYY-MM-DD` + `wiki_pages: [...]`，re-ingest 时按 mtime + SHA256 跳未变化文件
- [ ] **Source 强制切分**：大 source 按 topic 或 date 拆入 `sources/YYYY-MM-DD/`，不允许单块 monolithic 源
- [ ] **Frontmatter schema 硬约束**：`sources:` 必填（claim 可追溯）；issue/bug 页 `status:` 必填在 frontmatter（machine-readable）；`aliases:` 记录常见缩写/翻译改善召回
- [ ] **`## Related` 固定格式**：`- [[page-name]] — one-line relationship description`，结构化 + 机器可读
- [ ] 可选云端后端（Supermemory API）— MVP 不做

### Trace Plugin（架构重构：OTel 为内核 + 可插拔 exporter）
- [ ] **内部 source of truth**：`.trellis/traces/session-{uuid}.jsonl`（默认平铺，不与 task 绑定；task 归集作为可选能力）
  - Schema 对齐 OpenTelemetry GenAI semantic conventions（span 基础 + `invoke_workflow` span）
  - Per-session JSONL，append-only
- [ ] **Conversation Transcript 归集**：
  - Claude Code：复制 `~/.claude/projects/<normalized>/<session>.jsonl` 增量到 trace 目录
  - OpenCode：plugin 订阅 event firehose，主动 dump 对话到 trace 目录
- [ ] **Pluggable Exporters**（可选启用）：
  - `agent-trace`：按 Cursor RFC 0.1.0 schema 导出到 `.agent-trace/traces.jsonl`（生态兼容）
  - `opentraces`：按 opentraces.ai v0.3.0 schema 导出（如采用）
  - `git-ai`：写 Git Notes（可选）
  - `langfuse` / `otel-otlp`：通过 OTLP 上报（后期）
- [ ] Hook 订阅（双平台）：
  - Claude Code：PostToolUse (Write/Edit/Bash) + UserPromptSubmit + SessionStart/End + Stop + SubagentStop
  - OpenCode：tool.execute.after + chat.message + session.idle（Stop 的降级替代）+ event firehose

## Acceptance Criteria (evolving)

- [ ] 用户能 `trellis plugin add memory` 启用记忆，AI 对话能写入 `.trellis/memory/`
- [ ] 用户能 `trellis plugin add trace` 启用追踪，对话过程写入 `.trellis/trace/transcripts/`，commit 时生成 `.agent-trace/traces.jsonl`
- [ ] 插件在 Claude Code / OpenCode 双平台有差异化实现，且不破坏 Trellis 核心流程
- [ ] `trellis plugin remove` 可清理，残留文件不影响平台运行
- [ ] Manifest schema 可被第三方理解和编写

## Definition of Done

- 测试：unit 测 manifest 解析、adapter 分发；integration 测 add/remove 生命周期
- Lint / typecheck / CI 绿
- 文档：插件开发指南 + 首批两个插件的使用文档
- Migration：如果改 `.trellis/` 结构，提供 migration manifest
- 向后兼容：现有用户 `trellis update` 不受影响

## Out of Scope (explicit)

- **首批不做**：Cursor/VSCode 等 IDE 平台的 trace 降级（事后扒 SQLite）
- **首批不做**：Memory plugin 的云端后端（Supermemory / 自建）
- **首批不做**：Plugin marketplace UI / 索引服务
- **首批不做**：插件间依赖解析（A 依赖 B）
- **首批不做**：插件沙箱 / 权限系统
- **首批不做**：confidence scoring / memory tiers / forgetting curves / contradiction resolution（LLM Wiki v2 方向，独立研究课题，MVP 保持 Karpathy 原始简洁哲学）
- **首批不做**：企业级 / 跨项目 wiki（jakevin7 实测上限约 10 人团队，Trellis Memory 定位单项目单小组）
- **首批不做**：lint 自动纠错深度化（@LuckyCurveC 实测 wiki 大了 lint 不好用，改用 ingest 原子 commit + revert 机制兜底）

## Technical Notes

### 初步架构方向

```
.trellis/plugins/<plugin-name>/
  manifest.json          # capability 声明
  skills/*.md            # → 复用 template 共享层
  hooks/*.py             # → 复用 shared-hooks 机制
  adapters/
    claude-code/         # → 复用 Configurator 注册
    opencode/            # → 复用 OpenCode plugin 范式
  migration/             # → 复用 migration manifest
```

### Design Principles（Memory plugin，对齐 Karpathy 4 原则）

- **Explicit** — memory artifact 可浏览、可审计（markdown + frontmatter，非黑盒 embedding）
- **Yours** — 数据默认在 `.trellis/memory/` 本地，不上云
- **File over app** — 纯 md + 图片，Unix 工具链 + 任意 agent 原生消费；`wiki/` 目录 Obsidian 兼容
- **BYOAI** — Claude Code / Codex / OpenCode 都能操作同一份 vault（两文件 bootstrap 模式：`CLAUDE.md` + `AGENTS.md` 入口，`.{platform}/skills/` 按需加载）

### Capability 候选枚举

- `skill` — 注入 SKILL.md 到平台
- `hook:user-prompt-submit` / `hook:stop` / `hook:post-tool-use` — 订阅事件
- `storage:local` / `storage:remote` — 存储偏好
- `mcp-server` — 声明外部 MCP 依赖

### 可复用的 Trellis 已有资源

详见 `research/trellis-existing-extension-points.md`。核心：
- Shared Templates → skill/hook 分发
- OpenCode Plugins → hook 运行时范例
- Migration Manifests → 插件升级路径
- Spec Marketplace → registry 拉取机制
