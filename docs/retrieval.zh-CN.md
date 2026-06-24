# 检索层设计

[English](retrieval.md) | 简体中文

Trellis 将代码库与外部事实问题通过一个**检索层**路由,而不是依赖单一工具。本文说明适配器栈、路由信封、上下文如何进入 Cursor Agent,以及 gating 可以断言什么结论的证据/评分规则。

这是公开设计文档。已初始化项目内面向 Agent 的规范指南是 `.trellis/spec/guides/retrieval-daily-guide.md`;强制执行的 Cursor 规则是 `.cursor/rules/retrieval-routing.mdc`(`alwaysApply: true`)。

## 为什么需要检索层

单一工具无法覆盖所有问题:

- **字面检索**(Grep)快,但大仓库下会刷屏,且无法跟随调用链。
- **语义检索**适合"X 是怎么工作的",但不擅长精确调用点枚举。
- **结构化查询**(调用方、爆炸半径、跨包陷阱)需要索引图,而非字符串匹配。
- **外部/时效性事实**需要网络检索,不是代码库检索。
- **持久项目知识**在 spec、归档任务、日志中——与源码是不同索引。

Trellis 分类问题的**意图**,然后路由到该意图下最省 token 的适配器。证据分层:路径候选在被 Read、Git 或测试确认前不是已验证结论。

## 适配器栈

七个适配器,分三层:

| 层 | 适配器 | 工具/表面 | 适用 |
| --- | --- | --- | --- |
| **Core** | Grep | `rg`(Cursor Grep 工具) | 精确字符串/路径/日志行 |
| **Core** | artifact-search | `search_artifacts.py` | 持久 Trellis spec、过往任务 PRD/design/verify、研究笔记、日志 |
| **Core** | source-git-tests | Git log/blame + 测试运行 | 用源码、Git 或测试证据证明当前 vs 历史行为 |
| **Enhance** | codegraph | `codegraph` MCP(`codegraph_explore`、`codegraph_search`、`codegraph_node`) | 调用方、爆炸半径、跨包陷阱消歧、扩展符号、定义/引用(替代不可用的 Agent LSP) |
| **Enhance** | platform-semantic | 原生 `@codebase` **或** `fast_context_search` MCP(取决于 Cursor 环境——见 [语义路由](#语义路由cursor)) | 概念性"X 是怎么工作的"、大范围语义发现 |
| **Enhance** | smart-search | `run_smart_search.py` → `@blxzer/smart-search` CLI | 外部/时效性/web 事实(**强制首选**;内置 web 工具为降级 fallback) |
| **Enhance** | session-memory | `search_memory.py` | 工作区日志中的可复用过往决策、近期工作 |
| **Placeholder** | mcp/browser/network | 仅信封 | 为未来 MCP 适配器预留;当前仅元数据,非检索后端 |

**Core** 适配器始终可用。**Enhance** 适配器可选,由 `.trellis/capabilities.json` gating。**Placeholder** 条目预留意图槽位但不执行检索。

## 路由信封

`route_codebase_retrieval.py` 是意图路由器。输入自然语言问题,输出结构化计划:

```bash
python ./.trellis/scripts/route_codebase_retrieval.py "<问题>" --json
python ./.trellis/scripts/route_codebase_retrieval.py "<问题>" --instructions
```

JSON 信封包含:

| 字段 | 含义 |
| --- | --- |
| `intent` | 分类的问题类型(如 `caller-chain`、`trap-package-disambiguation`、`env-config-literal`、`conceptual`) |
| `routes` | 有序适配器建议列表,带 `tokenEconomy` 标签 |
| `agentInstructions` | 编号的、Agent 可执行步骤,使用 Cursor 原生工具名 |
| `cursorEnv` | `native` 或 `byok`——决定 `platform-semantic` 后端(见下文) |

**路由器 vs 执行。** 路由器返回**意图与路由建议**——它不检索。适配器输出是**候选**证据,在被 Read/Git/测试确认前不成立。`--instructions` 仅打印步骤列表(无 JSON),适合 Agent 直接消费。

## Cursor 双通道注入

在 Cursor 上,检索计划通过**两个互补通道**到达 Agent。这是对已知 Cursor 限制的刻意规避(`sessionStart` 钩子 `additional_context` 不可靠——Cursor issue #158452)。

### 通道 1:每查询计划注入(`beforeSubmitPrompt`)

当用户消息看起来是代码库问题时,`beforeSubmitPrompt` 钩子运行 `inject-retrieval-plan.py`,调用路由器并在用户提示前预置 `## 代码库检索计划`(或 `## Codebase retrieval plan`)块。该块包含针对该具体问题的有序必执行步骤。

### 通道 2:常驻策略规则(`.cursor/rules/retrieval-routing.mdc`)

`retrieval-routing.mdc` 以 `alwaysApply: true` 发布。它定义:

- **默认工具顺序**(无计划块时):字面用 Grep → 调用方用 codegraph → 概念用语义 → 外部用 smart-search。
- **计划块执行规则**:出现 `## 代码库检索计划` 块时,其步骤是必执行工具,不是建议。
- **语义路由策略**(见下文)。
- **结果层排序**触发条件。

**为何不用 `sessionStart`?** `sessionStart` 钩子的 `additional_context` 字段文档化了但不可靠地进入 Agent 上下文(#158452)。因此 Trellis 把持久检索策略放进常驻规则、每查询计划放进 `beforeSubmitPrompt`——两者都不依赖 `sessionStart` 注入。

## 证据评分

适配器输出**不是**证明。Trellis 将证据分三档:

| 档 | 含义 | 示例 |
| --- | --- | --- |
| **candidate** | 适配器返回的路径/符号;尚未确认 | codegraph 返回 `AuthService.loginUser` 为调用方 |
| **corroborated candidate** | 两个独立适配器一致,或一个适配器 + Read 确认位置 | codegraph + Grep 都指向同一调用点 |
| **verified claim** | 由当前源码(Read)、Git blame 或通过的测试确认 | Read 显示调用在第 42 行;测试断言该路径 |

`get_context.py --mode retrieval-pack` 对收集到的证据 JSON **评分**;它**不检索**。流程:收集候选(Grep/codegraph/语义/artifact)→ 可选运行 `retrieval-pack --input evidence.json` → 在 `verify.md` 中引用 `contextPack.selected` / `scoredEvidence`。

## 结果层排序(B / E / D)

适配器产生**路径候选**后,选择 Top-1 / Top-5 前重排。当以下意图出现时,路由器向 `agentInstructions` 追加 **结果层排序** 块:

| 意图 | 排序规则 |
| --- | --- |
| `caller-chain` | 提升具体调用点;降级 facade/barrel/runtime/registry **仅装配**文件 |
| `trap-package-disambiguation` | 降级 snapshot/registry/`src/agents/` 陷阱路径,除非 Read 确认了所问层 |
| `env-config-literal` | 偏好 `scripts/`、`e2e/`、`bench/`、`test/` 而非通用 `src/auth`/`src/paths` |

离线重排:

```bash
python ./.trellis/scripts/rank_retrieval_candidates.py --candidates fixtures.json --intents caller-chain --top-k 5 --pretty
```

## Token 经济

路由器输出中每条路由带 `tokenEconomy` 标签:

| 标签 | 含义 | 典型工具 |
| --- | --- | --- |
| `high` | 每个正确答案低 token 成本(~80–200 tokens) | codegraph callers/search、platform-semantic |
| `medium` | 中等 token 成本(~200–700 tokens) | codegraph explore、smart Grep、fast-context |
| `low` | 每个答案高 token 成本(~3000+ tokens) | 不受限输出的朴素 Grep |

**大仓库提升:** 当 `projectFileCount > 2000` 时,路由器把结构化(codegraph)路由提到 Grep 路由之前以提升 token 效率。文件数默认 `auto`(`.git` 存在时 `git ls-files`,否则有界 walk);大非 git 树可用 `--project-file-count 5000` 覆盖。

## smart-search:外部事实优先

对**外部/时效性/web 事实**,`run_smart_search.py`(封装 `@blxzer/smart-search` CLI)是**强制首选**。此规则覆盖任何通用"用可用工具"直觉——web 检索强度在 Trellis 内路由,不留给平台默认。

**仅降级 fallback。** Cursor 内置 `WebSearch`/`WebFetch` **仅**在 smart-search 不可用时使用:

- `doctor` 命令报告 not ok
- `run_smart_search.py` 状态 `not_configured` 或 `failed`
- 检索超时

降级时,将结果持久化到 `{TASK}/research/`,frontmatter 标 `source: cursor-web-fallback`。

**CLI 发现顺序:**

```
TRELLIS_SMART_SEARCH_COMMAND  →  smart_search.command 设置
        ↓ (未设)
PATH smart-search  →  项目 node_modules/.bin/smart-search
```

Agent 入口始终是 `./.trellis/scripts/run_smart_search.py`,不是裸 CLI 二进制。

## 语义路由(Cursor)

`platform-semantic` 后端取决于 **`cursorEnv`**,从 `TRELLIS_CURSOR_BYOK` 或 `~/.ccursor/routes.json` `byokMode` 解析:

| `cursorEnv` | 后端 | 规则 |
| --- | --- | --- |
| `native` | 内置 `@codebase`/Agent 语义检索(`platformNative: true`) | **不要**用 fast-context MCP 做 Primary |
| `byok` | `fast_context_search`(fast-context MCP)(`semanticBackend: fast-context-mcp`) | 内置 `@codebase` 在 Agent 工具列表中**不可用**;概念检索**必须**用 fast-context |

路由信封始终包含 `cursorEnv`,Agent 据此知道调用哪个语义后端。这也是驱动双环境子 Agent 派发的同一信号——见 [Cursor 集成](cursor.zh-CN.md)。

## CLI 命令参考

| 命令 | 用途 |
| --- | --- |
| `python ./.trellis/scripts/search_artifacts.py --query "<主题>" --json` | 持久 Trellis spec、任务、研究、日志 |
| `python ./.trellis/scripts/search_memory.py --query "<主题>" --json` | 工作区日志中的过往决策 |
| `python ./.trellis/scripts/run_smart_search.py "<问题>" --intent deep-research --json` | 外部 web 事实(强制首选;在 `{TASK}/research/smart-search/` 写 manifest) |
| `python ./.trellis/scripts/route_codebase_retrieval.py "<问题>" --json` | 意图 + 路由信封(含 `agentInstructions`) |
| `python ./.trellis/scripts/route_codebase_retrieval.py "<问题>" --instructions` | 仅 Agent 可执行步骤 |
| `python ./.trellis/scripts/get_context.py --mode retrieval-pack --json --input evidence.json` | 对收集证据评分(**不检索**) |
| `python ./.trellis/scripts/codegraph_session_smoke.py --json` | 验证工作区存在 `.codegraph/` 索引 |
| `python ./.trellis/scripts/rank_retrieval_candidates.py --candidates fixtures.json --intents caller-chain --top-k 5 --pretty` | 离线结果层重排 |

## codegraph 独有价值

codegraph 用于**调用链**、**跨包陷阱消歧**、**扩展符号解析**、**影响/爆炸半径**、**定义/引用**(替代 Agent 不可用的 GO_TO_DEFINITION / LSP)。**不要**用于:

- 纯字面检索——用 Grep。
- BYOK 概念 Primary——用 `fast_context_search`。

## 延伸阅读

- [Cursor 集成](cursor.zh-CN.md)——双环境派发、检索注入通道
- [Cursor 中的工作流](workflow.zh-CN.md)——检索在 Phase 1 Discovery 与 Phase 2 Execute 中的位置
- [架构概览](architecture.zh-CN.md)——高层结构与 smart-search 集成
- [项目 README](../README.zh-CN.md)
