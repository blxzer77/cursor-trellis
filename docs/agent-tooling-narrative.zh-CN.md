# Agent 工具层叙事：CLI、MCP、Hook、Rule

[English README](../README.md) | 相关：[cursor.zh-CN.md](cursor.zh-CN.md) · [subagents.zh-CN.md](subagents.zh-CN.md) · [retrieval.zh-CN.md](retrieval.zh-CN.md)

本文用**面试/对外讲解**口径，说明 cursor-trellis 如何把「Agent 能用什么、何时用、谁负责校验」分层，而不把项目包装成 Java/RAG 后端。

## 一句话定位

**cursor-trellis** 是基于 [mindfold-ai/Trellis](https://github.com/mindfold-ai/Trellis) 的 Cursor 适配 fork：把 Agent 工作流结构化为 `.cstl/` 工件，并生成 `.cursor/` 集成面（rules、commands、agents、hooks）。npm 包 `@blxzer/cursor-trellis`（`cstl`）是**安装与模板分发**入口，不是业务应用本身。

## 四层对照

| 层 | 载体 | 职责 | 可靠性 | 典型例子 |
| --- | --- | --- | --- | --- |
| **CLI** | `cstl` 命令 | 初始化/更新项目、任务门禁、派发 prompt 生成、规则校验 | **高** — 显式调用、可脚本化 | `cstl init --cursor`、`task.py start-execution --check`、`cstl validate-rules` |
| **Rule** | `.cursor/rules/*.mdc` | 常驻策略：Triage、检索路由、子代理派发契约 | **高** — Cursor 规则通道 | `cstl-triage.mdc`、`retrieval-routing.mdc` |
| **Hook** | `.cursor/hooks/*.py` + `hooks.json` | 会话/工具前后注入上下文、检索计划、证据 pack | **尽力而为** — 平台限制（如 #158452） | `session-start.py`、`inject-subagent-context.py` |
| **MCP / 外部工具** | 用户配置的 MCP、smart-search CLI | 代码图、浏览器、GitHub、**外部事实**检索 | **按能力配置** — doctor/就绪检查 | codegraph、fast-context、smart-search |

### 设计原则

1. **硬门禁走 CLI + Rule**，不走 Hook 单通道。
2. **子代理上下文主路径是 CLI Layer 2**（`generate_dispatch_prompt.py` → `Task` 的 `prompt`），Hook 只做补全。
3. **检索 = 工具策略**：代码事实（Grep/codegraph）与外部事实（smart-search）分流，见 `retrieval-routing.mdc`。

## CLI：可重复的工程面

| 命令/脚本 | 作用 |
| --- | --- |
| `cstl init --cursor` | 写入 `.cstl/` + `.cursor/` + `AGENTS.md` |
| `cstl validate-rules` | `.cursor/rules` 与模板清单硬比对 |
| `pnpm mirror-check` | 贡献者侧：dogfood `.cursor` 与模板不漂移 |
| `task.py` 族 | 任务创建、执行门禁、Parent/Child、gate 记录 |

工作流叙事：**triage → plan → gate → execute → verify**。`cstl-finish-work` 与 `verify.md` 把「完成」变成可审计证据，而非聊天里口头说「做完了」。

## Rule：聊天里甩不掉的策略

Cursor 的 `sessionStart` 附加上下文不可靠时，**`.cursor/rules` 是唯一可靠的 always-on 通道**（本 fork 的明确适配决策）。

- **Triage**：每个可产出工作的回合必须先分类（`No Task` … `Parent Task`）。
- **检索路由**：代码位置/架构问题先走检索计划，再 Grep/codegraph/语义搜索。
- **子代理派发**：Trellis 子代理必须用 CLI 生成的 dispatch prompt。

Rules 内容与 `packages/cli/src/templates/cursor/fixtures/expected-rules.ts` 绑定；回归时 `init`/`update` 会 abort。

## Hook：增强，不替代

| Hook | 意图 |
| --- | --- |
| `session-start.py` | 紧凑 SessionStart（任务仪表盘等） |
| `beforeSubmitPrompt` / `inject-retrieval-plan.py` | 代码库问题时注入检索计划块 |
| `inject-subagent-context.py` | Task 派发时补上下文（有 `cstl-hook-injected` 标记则跳过） |
| `research-end-retrieval-pack.py` | 研究结束写证据 pack |

**限制**：Agent 定义体不保证进入子 Agent system prompt；`preToolUse` 对 `Task` 工具在部分 Cursor 版本不触发。因此 Hook 文档里一律写「best-effort」。

## MCP 与 smart-search：能力插件

Trellis **不内置**所有 MCP；`init` 可选勾选项目能力（codegraph、fast-context、github-mcp 等），并就绪检查。

**外部/Web 事实**统一路由到 **smart-search**（`@blxzer/smart-search`，随 cursor-trellis 依赖安装）：

```bash
python ./.cstl/scripts/run_smart_search.py "<question>" --intent deep-research --json
```

这与「RAG 项目里的 @Tool」叙事对齐：**Agent 选工具 → 证据回写工件**，而非把 Trellis 说成向量库产品。

## 三子代理分工（工作流，非并行线程池）

| Agent | 持久化产出 | 守卫 |
| --- | --- | --- |
| `cstl-research` | `research/<topic>.md` | 可深研；并行多路应上报 Parent |
| `cstl-implement` | 代码变更（不提交） | 禁止再派 implement/check |
| `cstl-check` | `verify.md` / gate 记录 | 禁止再派 check/implement |

仅在 `execution_mode: worker` 时通过 `Task` 派发；`inline` 时主会话自己实现与审查。

## 5 分钟体验路径

```bash
cd examples/minimal-agent-app
./demo.sh    # 或 demo.ps1
```

链：`init` → `validate-rules` → 浏览 `.cstl/` / `.cursor/`。完整生命周期见 [workflow.zh-CN.md](workflow.zh-CN.md)。

## 与「热门技术栈」话术的对齐

| 市场话术 | cursor-trellis 诚实映射 |
| --- | --- |
| Multi-Agent | 三角色 + Parent/Child 任务树；非任意 Agent 群聊 |
| Tool Calling | CLI 脚本、MCP、smart-search、Bash；检索路由即工具策略 |
| Context Engineering | `.cstl/tasks` 工件 + 渐进式 spec + dispatch prompt |
| 质量门禁 | Triage、start-execution、validate-rules、mirror-check、Vitest |

**不是**：Java Spring 业务、LLM 训练、自研向量数据库。若是全栈岗，把本仓库讲成 **Agent 工程化 CLI + Cursor 平台适配** 即可。
