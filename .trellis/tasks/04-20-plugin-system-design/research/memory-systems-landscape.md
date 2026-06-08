# Research: AI Agent Memory System 竞品全景

- **Query**: 除 Serena 和 Supermemory 以外，mem0 / Letta (MemGPT) / Zep / Cognee / Claude 原生 memory / 其他值得关注的 memory 产品调研，用于 Trellis memory plugin 设计参考
- **Scope**: external
- **Date**: 2026-04-20

> Trellis 已有调研：Serena（本地 md + 5 个 MCP tools，agent 主动调用）与 Supermemory（SaaS）。本文补齐剩余主流玩家，并聚焦 **self-host + 本地文件优先** 的可借鉴点。

---

## 1. mem0 (mem0ai/mem0)

- **定位**：开源「memory layer」库 + 可自托管服务（OSS 版）+ 托管平台（MemoryClient）
- **GitHub**：mem0ai/mem0，~52K stars，Apache 2.0
- **存储架构**：hybrid — 主要是 `vector + graph + relational`
  - 默认栈：Qdrant（向量，默认本地 `/tmp/qdrant`）+ Neo4j（图）+ SQLite（history，`~/.mem0/history.db`）
  - 自托管 Docker 栈：FastAPI + PostgreSQL/pgvector + Neo4j（三个容器）
  - 支持 30+ 向量库（Qdrant/Pinecone/Chroma/Weaviate/Milvus/MongoDB/Redis/Elasticsearch/pgvector…）、多图库（Neo4j/Memgraph）、24 LLM（含 Ollama/LM Studio/vLLM）
- **召回机制**：两步 hybrid
  1. LLM 从输入里「抽取事实（facts）」并自动去重/合并
  2. 通过 `add()` 写入、`search()` 按 user/agent/session 召回；支持 reranker（Cohere/HF/SentenceTransformer…）
  - 有「自动注入」味道（在 add 路径由 LLM 主动抽取），**不是纯 agent 主动调用**
- **与 coding agent 整合**：
  - 官方提供 `openmemory/` 里自带 MCP server（FastAPI + Next.js UI）
  - 社区有大量 Claude Code MCP 集成（如 `elvismdev/mem0-mcp-selfhosted`：11 个 MCP tools，Qdrant+Ollama 本地栈）
  - v1.0 加了 reranker、async-by-default
- **Self-host**：✅ 一等公民，`docker-compose up` 起完整栈；offline-ready，可接 Ollama
- **开源协议**：Apache 2.0（OSS），平台另有商业 tier

---

## 2. Letta（原 MemGPT，letta-ai/letta）

- **定位**：**stateful agent 运行时**（不是 memory 层，是「长在 memory 上的 agent OS」）
- **GitHub**：letta-ai/letta，~21K stars，Apache 2.0
- **存储架构**：三层 memory（源自 MemGPT paper 的「virtual context」隐喻）
  - **Core Memory** — 小块、永远在 context window 里（identity、goals），agent 可直接读写
  - **Message / Recall Memory** — 会话历史，自动管理
  - **Archival Memory** — 向量长时存储，agent 通过 tool call 查询
  - 另有 **MemFS**（Letta Code 独有，**git-tracked** 文件系统 memory）和 **Letta Filesystem**（文件式 history，在 LoCoMo 基准 74%）
- **召回机制**：agent self-editing — agent 自己调 memory 函数决定记什么 / 召回什么（跟 Serena 的「agent 主动调用」哲学一致）
- **与 coding agent 整合**：
  - **Letta Code** — memory-first terminal coding agent，声称在 TerminalBench 登顶（model-agnostic OSS）
  - **Letta Code SDK**（TS）— 类似 Claude Agent SDK 的角色
  - ADE（Agent Development Environment，可视化调 memory）
- **Self-host**：✅ Docker 镜像 `letta`；ADE 可连自托管 server
- **开源协议**：Apache 2.0

> **跟 Trellis 的区别**：Letta 是「整个 agent 生命周期都住在 Letta server 里」；Trellis 是 workflow orchestrator，agent 本体住在 Claude/Cursor/OpenCode 里。Letta 的 **MemFS「git-tracked 文件 memory」** 和 **agent self-editing** 两点最值得借鉴。

---

## 3. Zep (getzep/zep) + Graphiti

- **定位**：
  - **Zep Cloud** — SaaS「context engineering 平台」，商业产品
  - **Graphiti** — Zep 开源的 temporal knowledge graph engine（~24.7K stars，Apache 2.0），是 Zep 的核心引擎
- **存储架构**：**temporal knowledge graph**
  - 实体 + 关系 + 时间戳，支持 **fact invalidation**（旧事实过时自动失效）
  - 后端：Neo4j / FalkorDB / Kuzu（graph）+ 向量嵌入
- **召回机制**：
  - 自动构建 — 每次交互都 incremental update 图（不用 batch recompute）
  - 查询：hybrid search（语义 + 图距离 rerank）+ 预定义 search recipes
  - 官方主打「200ms retrieval」
- **与 coding agent 整合**：
  - Graphiti **MCP server**（官方）— Claude Desktop / Cursor / Raycast 都能接
  - 社区 `graphiti-mcp-ollama`、`leboiko/agent-memory`（FalkorDB + Ollama 全本地）广泛流传
  - 9 个 MCP tools：`add_memory`、`search_nodes`、`search_facts`、`get_episodes` …
- **Self-host**：
  - Graphiti 完全 OSS 可自托管（只要 Neo4j）
  - Zep 完整平台是 cloud-only / BYOC
- **开源协议**：Graphiti Apache 2.0；Zep 平台专有

> **特色**：**时间感知**是别人没有的 —「去年我喜欢 A，今年换成 B」它能知道 B 替代了 A。

---

## 4. Cognee (topoteretes/cognee)

- **定位**：开源「knowledge engine」/ AI memory — 卖点是「6 行代码构建 AI memory」
- **GitHub**：topoteretes/cognee，Apache-2 / MIT（README 写 Apache-2，第三方目录列 MIT，实际以仓库 LICENSE 为准）
- **存储架构**：**vector + graph 双栈**（cognitive-science 风格 ontology grounding）
  - graph 后端：Neo4j / Kuzu
  - vector 后端：Qdrant
  - 支持 30+ 数据类型（pdf/docx/xlsx/mp3/png…，multimodal）
- **召回机制**：
  - 自动 ingestion → 构建知识图 → 检索时 vector + graph 混合
  - 有 **self-improving memory**（从 feedback 学习）、**time awareness**
  - Feature：multi-tenant、async memory、REST API server、custom prompts
- **与 coding agent 整合**：
  - 官方 Claude Code 插件（README 里列为 `claude-code-plugin`）
  - MCP 集成、多个 agent framework 原生 integration
- **Self-host**：✅ 1-click deploy（Modal / Railway / Fly.io / Daytona / Docker）；Cognee Cloud 是商业 tier
- **开源协议**：Apache-2（以仓库为准）

---

## 5. Claude 原生 Memory（Anthropic, 2026 最新动态）

> 这是 2025-10-28 beta 启动、**2026-04 正式 GA** 的一等公民，Trellis 必须跟它协同而不是重复造。

Anthropic 的 memory 体系是**三层架构**（按使用场景分层）：

### Layer 1 — Chat Memory（claude.ai / Desktop）
- 2026-03-02 对所有 plan 开放（含 Free tier）
- 每 24h 自动抽取；Settings → Capabilities / Memory 可查看/编辑/删除
- 支持从 ChatGPT / Gemini 导入历史（用户拉取 Google Takeout 等 → 喂给 Claude）

### Layer 2 — Claude Code Memory（CLAUDE.md + Auto Memory）
- 2026-03 起 Claude Code 会自动记住项目 context、debug 模式、偏好
- 无需配置；与现有 CLAUDE.md 共存
- 社区主流做法仍是**手写多层 CLAUDE.md + learnings.md**（Reddit 帖子记录了这个模式）

### Layer 3 — API Memory Tool（`memory_20250818`）
**这是 Trellis 最该关注的一层，因为它就是「本地 markdown 文件 + agent 主动调用」。**

- Beta 发布：2025-10-28；**GA：2026-04**（release notes 明确说「no beta header required」）
- 兼容模型：Opus 4.5/4.6/4.7、Sonnet 4.5/4.6、Haiku 4.5
- 约 2,500 tokens overhead，无额外费用（按正常 token 收费）
- **Client-side tool** — SDK 定义接口（`BetaAbstractMemoryTool`），**数据在你自己的磁盘 / 你自己的 infra**，天然 ZDR 合规
- Anthropic Python SDK 内置参考实现：`BetaLocalFilesystemMemoryTool(base_path="./memory")`

**6 个命令**（与 Serena 的 5 tools 高度重合但更偏 file-system）：

| 命令 | 作用 |
|---|---|
| `view` | 读文件或列目录，可选 line range |
| `create` | 新建文件（已存在则报错） |
| `str_replace` | 替换文件中字符串 |
| `insert` | 在指定行插入 |
| `delete` | 删除文件/目录 |
| `rename` | 重命名/移动 |

- 配合 **context editing**（`context-management-2025-06-27` beta）—context 要满时自动 warning，agent 可先把关键信息写入 memory 文件再被 clear
- 默认 memory 目录：`/memories`（与 CLAUDE.md 区分）
- 已知坑：多文件 multi-edit 可能误删（GitHub issue #2396）— 实现方需小心

> **关键洞察**：Anthropic 官方钦定的 memory 方向 = **agent 主动 CRUD 本地文件**，而不是 vector/graph embedding。这**直接印证 Trellis 的 Serena 风格设计是正确方向**。

---

## 6. 其他值得关注

### 6.1 Byterover / Cipher（campfirein/cipher）
- **定位**：open-source「coding agent memory layer」— 跟 Serena / Trellis 目标重叠度最高
- **GitHub**：byterover team，Elastic License 2.0（注意：**不是 Apache**，商业限制版）
- **架构**：
  - **Cipher**（OSS 核心）：vector（Qdrant/Milvus/内存）+ optional Neo4j knowledge graph
  - **ByteRover 2.0**（商业产品）：放弃 vector、改为「tiered file-search pipeline（fuzzy → deep）」+ **hierarchical tree + natural-language markdown memory**，LoCoMo 92.2% 登顶
  - 明确支持 Ollama 本地 LLM
- **召回机制**：dual memory — System 1（programming knowledge）+ System 2（reasoning trace）；auto-generate coding memories
- **与 coding agent 整合**：**通过 MCP 接入 Cursor / Windsurf / Claude Desktop / Claude Code / Gemini CLI / Kiro / VS Code / Roo Code / Trae / Warp**
- **Self-host**：✅ npm / Docker / 源码
- **License**：Elastic-2.0（⚠ 对 SaaS 商业化有限制）

> **最大借鉴价值**：ByteRover 2.0 把 vector 换成 **「hierarchical markdown tree + file-search」** —— 这跟 Trellis 气质**非常接近**（本地 .md、人类可读、git 可 diff）。可以对照他们的 tree schema。

### 6.2 Basic Memory（basicmachines-co/basic-memory）
- **定位**：最「Trellis-ish」的 memory — **本地 Markdown + MCP**
- **架构**：纯 Markdown 文件 + 本地 SQLite 索引；与 Obsidian vault 直接互通（同一堆 .md）
- **召回**：MCP tools（create/read/edit/delete/move/search/project 切换）—— agent 主动调用，无 vector、无 embedding、无 graph
- **Self-host**：✅ npx / pip / Docker / Homebrew
- **License**：OSS（AGPL / 类似，详见仓库）
- **跟 Serena/Trellis 的关系**：**几乎就是 Serena 的 Markdown-first 版本 + 加了 Obsidian 互通**

### 6.3 Obsidian Memory Layer MCP（honam867）
- 纯文件系统 MCP：`AI Agent <-MCP-> MCP Server <-fs-> Obsidian Vault`
- 10 个 tools，markdown + `[[wiki-links]]` + `#tags`
- 零数据库、零 HTTP 后端，**最简实现**

### 6.4 文件系统派（「ditched the UI」Reddit 帖）
- 一批重度 Claude Code 用户自己搭 `learnings.md` + 多层 CLAUDE.md 就达到了「项目 memory」效果
- 证明：**低保真 markdown + 路由表（root CLAUDE.md 里写"when to read what"）** 已足够好用

### 6.5 Vector DB 原生 memory pattern（Chroma / LanceDB / Qdrant）
- 这些本身**不是 memory 产品**，是被 mem0/Cognee 当存储层使用
- 有零星教程讲「直接用 vector DB 当 memory」，但**没人把它们当产品用于 coding agent 长期 memory**（因为缺抽取 + 缺召回触发）
- 无须重点参考

### 6.6 OpenAI 侧
- **Assistants API** — 2026-08-26 **EOL**，不用考虑
- **Responses API + Conversations API**（推荐方向）— durable conversation id，类似 thread
- **ChatGPT Memory** — 消费级，类似 Claude Chat Memory；**平台锁定、无法导出、无 API**
- 对 Trellis（B-end 开发者工具）不直接可借鉴

---

## 对比表

| 产品 | 定位 | 存储 | 召回触发 | Self-host | 与 coding agent 整合 | 开源协议 | 2026 动态 |
|---|---|---|---|---|---|---|---|
| **Serena**（已调研） | MCP server | 本地 md + 5 tools | agent 主动 | ✅ 纯本地 | MCP | MIT | 稳定 |
| **Supermemory**（已调研） | SaaS | 云 | API | ❌ | SDK/API | 专有 | — |
| **mem0** | 库 + OSS 服务 + SaaS | vector+graph+SQL | 自动抽取 + search API | ✅ Docker 三容器 | 官方 MCP（openmemory），社区 Claude Code MCP | Apache 2.0 | v1 加 reranker |
| **Letta (MemGPT)** | **Agent 运行时** | 三层：core/recall/archival + MemFS（git-tracked） | agent self-editing | ✅ Docker | Letta Code（CLI/Terminal），自有 agent | Apache 2.0 | Letta Code 登顶 TerminalBench |
| **Zep / Graphiti** | SaaS + OSS 图引擎 | temporal knowledge graph（Neo4j/FalkorDB/Kuzu） | 自动构建 + 200ms hybrid 召回 | Graphiti ✅ / Zep ❌ | 官方 MCP（9 tools），Claude/Cursor 支持 | Graphiti Apache 2.0 / Zep 专有 | Graphiti MCP 持续迭代 |
| **Cognee** | OSS 知识引擎 + Cloud | vector + graph（Neo4j/Kuzu + Qdrant），multimodal | 自动 + ontology grounding | ✅ 1-click 多平台 | Claude Code plugin + MCP | Apache-2 | self-improving memory |
| **Claude 原生 Memory Tool** | Anthropic 一等公民 | **本地文件目录 `/memories`** | **agent 主动 CRUD（6 命令）** | ✅ client-side，数据在你盘上 | 天然整合 Claude Code / SDK | Anthropic 私有 | **2026-04 GA（Opus 4.7）** |
| **Byterover Cipher** | OSS coding-memory layer | v1: vector+graph；v2: hierarchical md tree + file-search | 自动生成 coding memory + MCP search | ✅ npm/Docker | MCP 接 10+ IDE/CLI | Elastic-2.0 | ByteRover 2.0 LoCoMo 92.2% |
| **Basic Memory** | OSS markdown-first MCP | 纯 .md + SQLite 索引 | agent 主动 MCP 调用 | ✅ 纯本地 | MCP（Claude/Cursor/VS Code） | OSS | Obsidian 原生互通 |
| **Obsidian Memory Layer MCP** | 最小化 MCP | 纯 Obsidian vault（.md + wiki-links） | agent 主动 | ✅ 纯本地 | MCP | OSS | 2026-03 发布 |

---

## 给 Trellis 的建议（按「值得借鉴 / 需警惕 / 不适合」分）

### A. 值得直接借鉴 ✅

1. **方向大对路**：Anthropic 2026-04 GA 的 **Memory Tool (`memory_20250818`)** = **本地文件 + 6 个 CRUD 命令 + agent 主动调用**，**和 Trellis/Serena 哲学完全一致**。不是我们赌错了方向，而是业界主流在往这个方向收敛。
2. **命令集对齐 Claude Memory Tool**：把 Serena 风格的 5 tools 往 `view/create/str_replace/insert/delete/rename` 这 6 个靠，可以：
   - 让同一组 memory 既能被 MCP agent 用，也能无缝挂到 Claude API Memory Tool 的 handler 上
   - 复用 Anthropic Python SDK 里的 `BetaLocalFilesystemMemoryTool` 参考实现作为起点
3. **路由表模式（root CLAUDE.md / `_index.md`）**：Reddit 社区和 Obsidian MCP 都独立地验证了「顶层有个 `when-to-read-what` 索引」是省 token + 精准召回的最佳结构。Trellis memory plugin 应该生成 / 维护一个 `research/_index.md` 或 `memory/_index.md`。
4. **Letta 的 git-tracked MemFS**：memory 文件纳入 git 是**非常自然的工程化选择**（可 diff、可 review、可回滚、可 PR review memory 修改）。Trellis 已经以 `.trellis/` 目录形式放进 repo，天然继承这个优势，**值得在文档里明说这是我们对 mem0/Cognee 的优势**。
5. **Basic Memory / Obsidian 的 vault 互通**：Trellis 的 `.trellis/research/` 和 `.trellis/spec/` 都是 .md，用户理论上可以直接挂进 Obsidian 当 vault 看。这是**零成本的差异化卖点**，可在 README 写一行。
6. **ByteRover 2.0 的 hierarchical markdown tree**：比扁平 md 文件更结构化，但不至于上 graph。对 Trellis 来说 spec 已经是树形（`cli/backend/`、`docs-site/`…），memory 也应沿用同一树形结构，保持脑图一致性。
7. **时间感知**：Graphiti 的 fact invalidation 很强，但对 Trellis 过重。**轻量化版本**：memory 文件加 `Date`、`Status: current|superseded-by: xxx.md` 这种 frontmatter 即可（Serena 风格兼容）。

### B. 需警惕 / 不完全适配 ⚠

1. **不要自己做 vector/graph**。mem0 / Zep / Cognee 都背着向量库和图库。Trellis 用户是**轻量 CLI 党**，在 repo 里跑 Neo4j + Qdrant 是**反人类**。保持「**纯 md + SQLite 索引**」上限。
2. **不要做 SaaS 托管**。Supermemory / Zep Cloud / Cognee Cloud / mem0 平台都是云，这条路 Trellis 没预算也没必要打。核心价值主张就是 self-host + git-owned。
3. **不要做 agent 运行时**。Letta 是「Trellis 的 10x 版本」，但它把整个 agent loop 抢过去；Trellis 只管 workflow + memory，让 Claude Code / Cursor / OpenCode 做 agent 本体。这条边界**必须守住**，否则和 Letta 正面冲突打不过。
4. **Cipher (Byterover) 的 Elastic License 2.0 不兼容自由 self-host 商业化**，抄代码之前注意；但**学架构思想（tree + file-search）** 完全合法。
5. **不要同时维护 auto-extract（mem0 风格）和 agent-active（Serena 风格）两套**：选一个。Claude Memory Tool GA 之后，**agent-active 是生态共识**，auto-extract 应延后 / 可选。

### C. 不适合 ❌

1. **Vector DB 作为唯一 backend**（Chroma/LanceDB/Qdrant 单飞）：缺抽取、缺召回触发，没人这么用，不值得参考。
2. **OpenAI Assistants API memory**：8月 EOL，忽略。
3. **Zep Cloud / Cognee Cloud 全托管路线**：与 Trellis 脱节。
4. **Graphiti 图模型当默认**：太重，只在后期「可选 advanced backend」位置考虑。

---

## 架构建议（对照其他产品的一张「Trellis 定位图」）

```
    存储模型                 召回触发
    ────────              ────────
    vector     →  mem0, Chroma          自动抽取  →  mem0, Cognee, Zep
    graph      →  Zep, Cognee           hybrid   →  Letta
    hybrid     →  Cipher v1             agent 主动 →  Serena, Claude Memory Tool,
    md tree    →  Cipher v2,                         Basic Memory, Letta MemFS,
                  Basic Memory,                      Obsidian MCP,
                  Serena,               ◀ TRELLIS ▶
                  ◀ TRELLIS ▶
```

Trellis 的坐标：**markdown tree + agent 主动调用** — 跟 Claude 原生 Memory Tool、Basic Memory、ByteRover 2.0、Letta MemFS 是同一象限，是 2026 的主流共识象限。

---

## Caveats / Not Found

- 各产品 GitHub stars / pricing 取自搜索结果快照，可能略滞后
- Cognee 的具体 license 在不同来源不一致（README 说 Apache-2，第三方目录写 MIT）；**以仓库 LICENSE 文件为准**，接入时再核验
- Cipher 明确是 Elastic License 2.0（**不是自由开源**），涉及商业 redistribution 时要先看条款
- Anthropic Memory Tool 的具体 SDK 实现细节（错误处理、冲突、并发）仍在迭代中；GitHub issue #2396 提到过 MultiEdit 误删 CLAUDE.md 的 bug，需在自己的 handler 里做保护
- 未深入调研：LangMem、Letta 以外的「agent-native memory」框架（e.g. Camel、CrewAI memory）— 这些是 framework 内部 memory，不构成独立产品
- 未调研 2026 Q2 之后的新发布（时间截至 2026-04-20）
