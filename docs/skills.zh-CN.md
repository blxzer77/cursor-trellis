# 内部技能

[English](skills.md) | 简体中文

本文是 Trellis 在 Cursor 上的**内部技能**完整参考:它们是什么、与子 Agent 和命令的差异、各自何时触发、为什么都不出现在 `/` 命令面板里。

## 内部技能是什么

Trellis 内部技能是角色限定的指令束,在工作流匹配器判定适配时**自动激活** —— Agent 按需加载,用户不通过 `/` 调用。它们承载 Trellis 生命周期的程序性部分:规划访谈、开发前阅读、质量检查、bug 回溯、spec 更新、元定制、web 研究。

规范自动触发清单在 `AGENTS.md`(由模板树 `markdown/agents.md` 生成)。在 Cursor 上,`commands-only` 策略意味着**内部技能刻意不写入 `.cursor/skills/`** —— `/` 面板保持精简(只出现 `/trellis-continue` 等用户可调命令),技能语义通过 `.cursor/rules` + `AGENTS.md` + `.trellis/workflow.md` 传递。这是产品取舍:单平台深度集成胜过臃肿的技能面板。

## Skill vs Agent vs Command

Trellis 定义三种不同角色面。混淆它们是最常见的误解。

| 面 | 定义源 | 激活 | `/` 面板 | 例子 |
| --- | --- | --- | --- | --- |
| **内部技能** | `templates/common/skills/*.md`(单文件)或 `templates/common/bundled-skills/*/SKILL.md`(bundled) | 工作流匹配器自动触发 | 否 | `trellis-brainstorm`、`trellis-micro-grill` |
| **子 Agent** | `templates/cursor/agents/*.md`(frontmatter + system prompt) | 主会话通过 `Task` 工具生成 | 否 | `trellis-research`、`trellis-implement`、`trellis-check` |
| **用户命令** | `templates/common/commands/*.md` 或 `templates/cursor/commands/*.md` | 用户通过 `/` 手动调用 | 是 | `/trellis-continue`、`/trellis-finish-work` |

三种形态继承方式不同:

- **单文件技能** —— 带 procedural 指令的 `.md`;无 frontmatter,无 tools 列表。主会话 inline 加载。
- **Bundled 技能** —— `SKILL.md` 目录,带 frontmatter、可选 `references/`、`examples/`、`agents/`。需 progressive disclosure 的技能用更丰富结构。
- **子 Agent** —— frontmatter(`name`、`description`、`tools`)+ system prompt;在自己上下文窗口里跑,经 `Task` 工具派发。见 [subagents.zh-CN.md](subagents.zh-CN.md)。

## 11 个内部技能

### 单文件技能(5)

#### `trellis-brainstorm`

| | |
| --- | --- |
| **定义** | `templates/common/skills/brainstorm.md` |
| **触发** | Phase 1 规划;`trellis-start` 路由"新功能/不清晰需求";无选中任务 |
| **角色** | 深度访谈式需求澄清。两阶段:**Phase A Discovery Before Questions**(先穷尽仓库证据 —— 代码、spec、历史、平台 —— 绝不问用户仓库能回答的问题)→ **Phase B PRD Grill**(`prd.md` 12 项 checklist + micro-grill 逐个澄清 blocking 开放问题,每次带推荐答案) |
| **产出** | `prd.md`,复杂任务还有 `design.md` / `implement.md` 骨架 |
| **边界** | 不派 legacy grill subagent;PRD Grill 在会话内。仅为独立 `research/<topic>.md` 派 `trellis-research` Agent |

#### `trellis-before-dev`

| | |
| --- | --- |
| **定义** | `templates/common/skills/before-dev.md` |
| **触发** | Phase 2.1 写码前;`trellis-start` 路由"准备写码";选中任务 `status=in_progress` |
| **角色** | 强制开发前阅读:读任务工件(`prd`/`design`/`implement`)、用 `get_context.py --mode packages` 发现包、识别适用 spec 层、读 spec `index.md` 并跟 **Pre-Development Checklist**、读 index 指向的具体 guideline 文件(非只读 index)、始终读 `guides/index.md` |
| **边界** | index 是指针,不是目标 —— 此技能强制读实际 guideline 文件。编码前必走 |

#### `trellis-check`

| | |
| --- | --- |
| **定义** | `templates/common/skills/check.md`(技能形态)+ `templates/cursor/agents/trellis-check.md`(Agent 形态)— **双形态** |
| **触发** | Phase 2.2 / 3.1 质量检查;`trellis-start` 路由"完成编码/质量检查" |
| **角色(技能形态)** | 主会话 inline 质量验证:步 1 识别变更(`git diff --name-only`)、步 2 读工件+spec、步 3 跑项目检查(lint/typecheck/test)、步 4 按 checklist 审查(代码质量/测试覆盖/Phase 3.3 持久学习 token/spec 同步/检索证据)、步 5 跨层维度(数据流/代码复用/imports/同层一致性)、步 6 报告并修 |
| **角色(Agent 形态)** | 同范围但在生成的子 Agent 上下文里跑独立审查 pass —— 可自修代码。需独立审查 pass vs inline 检查时用。双形态决策见 [subagents.zh-CN.md](subagents.zh-CN.md) |
| **边界** | 记录 Phase 3.3 持久学习决策 token(`update-spec` \| `no-update` \| `unsure`)但自身不编辑 spec |

#### `trellis-break-loop`

| | |
| --- | --- |
| **定义** | `templates/common/skills/break-loop.md` |
| **触发** | 反复调试同一 bug;`trellis-start` 路由"卡住/同一 bug 修多次" |
| **角色** | 深度 bug 分析,打破"修 bug → 忘 → 重复"循环。五维度:**1 根因分类**(A 缺 spec / B 跨层契约 / C 变更传播失败 / D 测试覆盖缺口 / E 隐式假设)、**2 修复为何失败**(表面修/范围不全/工具限制/心智模型)、**3 预防机制**(文档/架构/编译期/运行时/测试/审查)、**4 系统性扩展**(类似问题/设计缺陷/流程缺陷/知识缺口)、**5 知识捕获**(更新 `.trellis/spec/guides/` 思考指南) |
| **边界** | 理念:"30 分钟分析省 30 小时未来调试"。分析后必须立即更新 spec/guides 并同步模板 —— 分析留在 chat 里一文不值 |

#### `trellis-update-spec`

| | |
| --- | --- |
| **定义** | `templates/common/skills/update-spec.md` |
| **触发** | Phase 3.3 持久学习决策=`update-spec`;学到值得沉淀的模式/约定/gotcha |
| **角色** | 半自动 spec 更新流:**Detect**(此任务是否产出可复用学习?)→ **Proposal**(写 `research/learning-proposal.md`,不编辑 spec)→ **Confirm**(用户批准,`verify.md` 出现 `Learning decision: update-spec`)→ **Write**(此时才编辑 spec,`verify.md` 加 `Spec update evidence:`) |
| **边界** | **禁止**:静默 spec 编辑;决策为 `no-update`/`unsure` 时写 spec 无后续;仅从 hook/check 自动更新。infra/跨层变更必须用 **7 段 code-spec 深度**(Scope/Signatures/Contracts/Validation Matrix/Cases/Tests Required/Wrong vs Correct)。强制 Code-Spec vs Guide 区分(specs="怎么实现",guides="该想什么") |

### Bundled 技能(6)

#### `trellis-micro-grill`

| | |
| --- | --- |
| **定义** | `bundled-skills/trellis-micro-grill/SKILL.md` |
| **触发** | Triage 决策树命中 `Micro-Grill` 模式;不明确小请求且无任务 |
| **角色** | 每次一个高价值问题澄清不明确小请求,每个问题带推荐答案与权衡。澄清后直接执行不建任务。范围扩大则升级 Lite/Full/Parent |
| **边界** | 每条消息一个问题;用户面向文本用简体中文;每次回答后更新 `prd.md`(有任务时);不问流程问题 |

#### `trellis-meta`

| | |
| --- | --- |
| **定义** | `bundled-skills/trellis-meta/SKILL.md` + `references/`(local-architecture、platform-files、customize-local) |
| **触发** | 用户要改或理解本地 `.trellis/` 架构、平台 hooks/agents/skills/commands/workflows |
| **角色** | 本地 Trellis 架构地图与定制入口路由。三层参考:**local-architecture**(context 注入、生成文件、spec 系统、task 系统、workflow、workspace memory)、**platform-files**(agents、hooks-and-settings、overview、platform-map、skills-and-commands)、**customize-local**(change-agents、change-context-loading、change-hooks、change-skills-or-commands、change-spec-structure、change-task-lifecycle、change-workflow) |
| **边界** | 只改用户项目本地文件,不动上游源码树。详细 skill 编写规则路由到 `trellis-skill-creator` |

#### `trellis-spec-bootstrap`

| | |
| --- | --- |
| **定义** | `bundled-skills/trellis-spec-bootstrap/SKILL.md` + `references/`(mcp-setup、repository-analysis、spec-task-planning) |
| **触发** | 创建或刷新 `.trellis/spec/`;`trellis init` 后 spec 树为空或需重构 |
| **角色** | 单 owner 全流程:分析仓库 → 解耦 spec 边界 → 用**真实代码模式**填充(非模板套话)→ 验证无 placeholder。用 GitNexus/ABCoder/源码分析提取实际约定 |
| **边界** | 无模板套话;一个 owner 负责整个 bootstrap;结果结构见 [spec-system.zh-CN.md](spec-system.zh-CN.md) |

#### `trellis-skill-creator`

| | |
| --- | --- |
| **定义** | `bundled-skills/trellis-skill-creator/SKILL.md` + `references/`(authoring-rules、review-checklist、trellis-skill-locations) |
| **触发** | 用户要写或改进 Trellis 兼容 skill(项目本地、共享、`.agents/`、上游 bundled) |
| **角色** | skill 编写与审查指南:frontmatter、trigger description、Hard Constraints、progressive disclosure。含 authoring rules、review checklist、trellis-skill-locations 参考 |
| **边界** | 强制由 `trellis-meta` 加载的 skill 形态契约 |

#### `smart-search-cli`

| | |
| --- | --- |
| **定义** | `bundled-skills/smart-search-cli/SKILL.md` + `examples/`、`references/cli-contract.md`、`agents/openai.yaml` |
| **触发** | 任何外部/web/当前事实检索;`trellis-research` Agent 外部搜索;`workflow.md` Discovery/Research 阶段;`retrieval-daily-guide` 路由 |
| **角色** | CLI 优先 web 研究:`doctor` 预检 → 双语 `search` → `context7`/`exa`/`fetch`/`map` 按能力边界路由 → `research` Deep Research 模式编排 plan→discover→fetch/read→gap check→evidence-only synthesis |
| **边界** | Cursor 内置 `WebSearch`/`WebFetch` 仅作**降级 fallback**,只在 `doctor` `not_configured`/`failed` 或超时时用。见 [retrieval.zh-CN.md](retrieval.zh-CN.md) |

#### `trellis-cursor2plus-setup`

| | |
| --- | --- |
| **定义** | `bundled-skills/trellis-cursor2plus-setup/SKILL.md` |
| **触发** | `trellis init` 选 Cursor 且用户要 Cursor++ BYOK 每子 Agent 模型;`providers.json` 变化 |
| **角色** | 引导 Cursor++ BYOK 用户写 `~/.ccursor/trellis-task-models.json5`(primary/fallback),跑 `patch_wpelc8.py`(可逆 json5 slug 映射),报告 resolver WARN/ERROR |
| **边界** | Native Cursor API 用户不需要。不在 `AGENTS.md` 自动触发清单(条件性,仅 BYOK)。Method 2.5 细节见 [cursor.zh-CN.md](cursor.zh-CN.md) |

## Auto-triggered 清单

规范自动触发清单(10 个技能)从 `templates/markdown/agents.md` 生成到 `AGENTS.md`。第 11 个(`trellis-cursor2plus-setup`)是 bundled 但条件性 —— 仅 Cursor++ BYOK 用户激活,因此不在通用自动触发集。

| # | 技能 | 触发源 |
| --- | --- | --- |
| 1 | `trellis-brainstorm` | Phase 1 规划 / `trellis-start` |
| 2 | `trellis-before-dev` | Phase 2.1 / `trellis-start` |
| 3 | `trellis-check` | Phase 2.2/3.1 / `trellis-start` |
| 4 | `trellis-break-loop` | `trellis-start`(卡住) |
| 5 | `trellis-update-spec` | Phase 3.3 学习决策 |
| 6 | `trellis-micro-grill` | Triage Micro-Grill 模式 |
| 7 | `trellis-meta` | 本地架构修改 |
| 8 | `trellis-spec-bootstrap` | spec 树创建/刷新 |
| 9 | `trellis-skill-creator` | skill 编写 |
| 10 | `smart-search-cli` | 外部事实检索 |
| 11 | `trellis-cursor2plus-setup` | Cursor++ BYOK 配置(条件性) |

## Skill vs Agent:谁干什么

三个名字概念重叠但解析到不同 runtime:

| 名字 | 技能形态? | Agent 形态? | 何时用哪个 |
| --- | --- | --- | --- |
| `trellis-research` | 否 | 是(`cursor/agents/trellis-research.md`) | 永远用 Agent 形态 —— 无此名技能。某主题需独立 `research/<topic>.md` 文件时生成 |
| `trellis-implement` | 否 | 是(`cursor/agents/trellis-implement.md`) | 永远用 Agent 形态。Phase 2.1 生成在自己上下文里做实现 |
| `trellis-check` | 是(`common/skills/check.md`) | 是(`cursor/agents/trellis-check.md`) | **双形态。** 技能形态=主会话 inline 检查(默认,更轻)。Agent 形态=独立审查 pass,可自修(需 dedicated pass 时)。`workflow.md` 建议代码变更后优先用 Agent 形态 |

## 定制 skill

Trellis 技能可在三层定制:

1. **项目本地 skill** —— 把 `SKILL.md`(或单文件 `.md`)放项目 `.trellis/` 或 `.agents/skills/` 树。工作流匹配器与 bundled skill 一起加载。
2. **共享 skill** —— 行为跨同平台多项目时放共享 `.agents/skills/` 路径。
3. **上游 bundled skill** —— `@blxzer/cursor-trellis` 自带;定制靠本地复制覆盖,不编辑已安装包。

用 `trellis-skill-creator`(经 `trellis-meta` 加载)获取编写规则。见其 `references/authoring-rules.md` 与 `references/review-checklist.md` 了解 frontmatter 与 Hard Constraints 契约。

## 延伸阅读

- [子 Agent 派发设计](subagents.zh-CN.md) — 三个 `trellis-*` Agent、Method 1–4 派发、Native vs BYOK 模型路由
- [Spec 系统设计](spec-system.zh-CN.md) — `trellis-spec-bootstrap` 创建什么、`trellis-update-spec` 维护什么
- [Task 系统设计](task-system.zh-CN.md) — Phase 1–3 生命周期、门禁、Development Strategy Contract
- [Cursor 集成](cursor.zh-CN.md) — commands-only 策略、hooks、环境探测
- [Cursor 中的工作流](workflow.zh-CN.md) — 这些技能服务的工作流生命周期
