# 子 Agent 派发

[English](subagents.md) | 简体中文

本文讲述 Trellis 在 Cursor 上的**子 Agent 派发设计**:三个 `trellis-*` 子 Agent、四种派发 Method、Native vs BYOK 模型路由分裂,以及 `trellis-check` 双形态决策。

## 为什么要子 Agent

主会话随时间压缩 —— 上下文易失。子 Agent 解决两个问题:

1. **持久化研究** —— `trellis-research` 把发现写到 `{TASK}/research/<topic>.md`。文件扛过压缩;主会话下轮直接读,不重新推导。
2. **隔离执行** —— `trellis-implement` 和 `trellis-check` 在自己的上下文窗口里运行,带递归守卫,主会话上下文不被实现细节污染。

子 Agent 默认**不是**并行机制。它们由主会话通过 `Task` 工具生成,一次一个,带显式派发 prompt。Parent/Child 任务树才是并行机制 —— 见 [task-system.zh-CN.md](task-system.zh-CN.md)。

## 三个子 Agent

| Agent | 定义 | 工具 | 模型策略 | 递归守卫 |
| --- | --- | --- | --- | --- |
| `trellis-research` | `cursor/agents/trellis-research.md` | Read、Write、Glob、Grep、Bash、WebSearch、WebFetch、Exa、Skill、Chrome DevTools | 无 `model:` frontmatter → **继承**父会话;主会话可一次性 `model:` overlay,跑 `Task`,再剥离 | 无(可递归深研,但更多并行工作应上报) |
| `trellis-implement` | `cursor/agents/trellis-implement.md` | Read、Write、Edit、Bash、Glob、Grep、Exa | 同继承 + overlay 策略 | **硬守卫**:不得再派 `trellis-implement` 或 `trellis-check`。`No git commit allowed` —— implement 不提交 |
| `trellis-check` | `cursor/agents/trellis-check.md` | Read、Write、Edit、Bash、Glob、Grep、Exa | 同继承 + overlay 策略 | **硬守卫**:不得再派 `trellis-check` 或 `trellis-implement`。可自修复代码并记录 gate |

### 派发契约

- **`trellis-research`** —— 为独立 `research/<topic>.md` 文件生成。外部事实先走 `smart-search-cli` + Bash;Cursor web 工具仅在文档化 fallback 时用(`doctor` not ok / 超时)。返回文件路径 + 一行摘要,非全文。
- **`trellis-implement`** —— Phase 2.1 生成做实现。读 `prd.md` / `design.md` / `implement.md` + `implement.jsonl` manifest。不能提交;主会话在 check 通过后提交。
- **`trellis-check`** —— 为独立质量审查 pass 生成。读任务工件 + `check.jsonl`。可直接修问题并记录 `record-gate` 结果。不重定义 Parent `task-map` 或 gate 语义。

### 上下文加载协议

三个 Agent 都在输入里找 `<!-- trellis-hook-injected -->` 标记:

- **标记存在** —— `prd` / `spec` / `research` 文件已在上方自动加载;直接干活。
- **标记缺失** —— hook 注入未触发(Windows + Claude Code、`--continue` 恢复、fork 分发、hooks 禁用、`/multitask` 并行派发)。Agent 从派发 prompt 第一行 `Selected task: <path>` 解析选中任务路径,然后读 `implement.jsonl` / `check.jsonl` 及所列文件,再读 `prd.md` / `design.md` / `implement.md`。

这个 fallback 让派发在 `preToolUse` hook 不触发时也稳健(Cursor 3.8.22 已知 `preToolUse` hook 对 `Task` 工具不触发,所以基于标记的 fallback 是可靠路径)。

## 派发 Method 1–4

主会话如何把工作路由到子 Agent,取决于 Cursor 环境与期望的模型控制。

| Method | 环境 | 适用 | 模型控制 | 可逆 |
| --- | --- | --- | --- | --- |
| **1 Inherit** | Native + BYOK | 默认。子 Agent 继承父会话模型 | 无 —— 无 `model:` frontmatter | N/A(无变更) |
| **2 Explore + 自定义模型** | Native + BYOK | 只读探索,通过 Cursor++ 面板用独立模型 | 每次派发一次性 `model:` overlay 到 Agent 文件,跑 `Task`,再剥离 | 是(overlay 临时) |
| **2.5 BYOK json5 patch** | 仅 Cursor++ BYOK | BYOK 用户需要 frontmatter/Settings UI 给不了的每 `trellis-*` 类型模型路由 | `patch_wpelc8.py` patch `extension.js`,把 `subagentType` 映射到 BYOK slug;读 `~/.ccursor/trellis-task-models.json5`(primary/fallback) | 是(patch 可逆;重跑即还原) |
| **3 Manual** | Native + BYOK | 主会话准备 prompt,用户开新对话手选模型 | 用户驱动 | N/A |
| **4 Ephemeral** | 仅 Native | 一次性 `model:` frontmatter 改动 | 编辑 frontmatter、派发、还原 | 是(用后还原) |

**Method 2.5** 存在是因为一个硬 BYOK 限制:Cursor++ BYOK 下,frontmatter `model:` 字段和 Cursor Settings 每 Agent 模型 UI 对自定义 `trellis-*` 子 Agent 类型**都不路由**。唯一可靠通道是 patch resolver。`trellis-cursor2plus-setup` bundled 技能自动化此过程 —— 见 [skills.zh-CN.md](skills.zh-CN.md)。Native Cursor API 用户不需要 Method 2.5;frontmatter 和 Settings UI 都生效。

## Native vs BYOK 模型路由

| 能力 | Native Cursor API | Cursor++ BYOK |
| --- | --- | --- |
| Agent frontmatter `model:` | ✅ 有效 | ❌ 对 `trellis-*` 类型被忽略 |
| Cursor Settings 每 Agent 模型 UI | ✅ 有效 | ❌ 不填充 `subagentModelOverrides` |
| Task 子 Agent(`trellis-*`)模型 | ✅ Frontmatter 或 Settings | ❌ 无 Method 2.5 时继承父会话模型 |
| Method 2.5 patch | 不需要 | ✅ 每类型路由必需 |

环境探测:`TRELLIS_CURSOR_BYOK=0|1` 环境变量或 `~/.ccursor/routes.json` 的 `byokMode`。`trellis-cursor2plus-setup` 技能读此决定是否提供 patch。

## `trellis-check` 双形态决策

`trellis-check` 是唯一同时有技能形态和 Agent 形态的名字。何时用哪个:

| 信号 | 用技能形态(inline) | 用 Agent 形态(生成) |
| --- | --- | --- |
| 变更规模 | 小,单文件 | 多文件,跨层 |
| 审查独立性 | 主会话自审 | 独立审查 pass,新鲜上下文 |
| 自修复 | 不需要(只报告) | 需要(Agent 可编辑) |
| Gate 记录 | 主会话记录 | Agent 记录 `record-gate` |
| `workflow.md` 指引 | inline `in_progress` 默认 | "代码变更后验证优先用 Agent 形态" |

Agent 形态有硬递归守卫 —— 不能再派 `trellis-check` 或 `trellis-implement`。发现需要实现的工作时,把建议上报主会话。

## Parent/Child 派发与集成权限

Parent 任务编排 Child 任务时,派发权限分裂:

- **Child worker** —— 经 `trellis-implement` 生成(或在 Child 自己会话 inline)。用 `task.py set-child-state` 报进度:`open` / `working` / `blocked` / `review`。Child worker **不能**自标 `changes` / `accepted` / `integrating` / `integrated` / `cancelled` —— 只有 Parent 有集成权限。
- **Parent** —— 用 `task.py prepare-child-worktree` 和 `task.py integrate-child`,状态 `changes` / `accepted` / `integrating` / `integrated` / `cancelled`。默认 `merge_limit: 1` 阻止多于一个 Child 同时 `integrating`。集成是串行 Git-ref 集成:每个决策遵守 `merge_limit: 1`,冲突、合并决策、验收理由写入 `task-map.md` Event Log。
- **审查编排** —— Parent 会话可 inline 产品化 child 派发与审查:

  ```bash
  python ./.trellis/scripts/task.py parent-status <parent-task>
  python ./.trellis/scripts/task.py generate-child-prompt <parent-task> <child-task> --mode inline
  python ./.trellis/scripts/task.py review-child <parent-task> <child-task> --check
  python ./.trellis/scripts/task.py review-child <parent-task> <child-task> --decision accept --ref <child-ref>
  python ./.trellis/scripts/task.py review-child <parent-task> <child-task> --decision integrate-through --ref <child-ref>
  ```

  `--mode subagent` 仅当平台能生成子 Agent 时作交付提示;inline 模式是可移植默认。

完整 Parent/Child 生命周期见 [task-system.zh-CN.md](task-system.zh-CN.md)。

## 常见派发场景

下表把常见任务情境映射到推荐派发选择。这些是默认值,非硬规则 —— 任务画像明显不同时调整。

| 情境 | 推荐 | 原因 |
| --- | --- | --- |
| 单文件修复,Lite 任务 | Inline(不派子 Agent) | 影响范围小;子 Agent 开销不值 |
| 多文件功能,Full 任务 | `trellis-implement` Agent | 隔离上下文;递归守卫防失控 |
| 需研究陌生模块 | `trellis-research` Agent | 发现持久化到 `research/<topic>.md`;主会话读摘要 |
| 小变更后质量检查 | `trellis-check` 技能(inline) | 不需新鲜上下文;主会话自审 |
| 多文件变更后质量检查 | `trellis-check` Agent | 新鲜上下文;可自修;独立审查 |
| 外部事实查询(API 版本、文档) | `smart-search-cli` 技能 | CLI 优先;Cursor WebSearch 仅 fallback |
| 同一 bug 反复卡住 | `trellis-break-loop` 技能 | 深度根因分析;更新 spec/guides |
| Parent 含 3 个独立交付物 | Parent + 3 Child 任务 | 每 Child 独立可验证;Parent 拥有集成 |
| BYOK 用户要每 Agent 模型 | Method 2.5(`patch_wpelc8.py`) | BYOK 下 frontmatter/Settings UI 不路由 `trellis-*` |
| Native 用户要每 Agent 模型 | Method 4(临时 frontmatter) | Native 上 frontmatter 有效;不需 patch |

## 失败模式与 fallback

子 Agent 派发可能以多种方式失败。系统设计为优雅降级:

| 失败 | 症状 | Fallback |
| --- | --- | --- |
| `preToolUse` hook 不触发(Cursor 3.8.22) | `<!-- trellis-hook-injected -->` 标记缺失 | Agent 从 `Selected task: <path>` 手动读 `implement.jsonl` / `check.jsonl` + 任务工件 |
| `smart-search` doctor not ok | 外部搜索不可用 | `trellis-research` fallback 到 Cursor `WebSearch`/`WebFetch`,以 `source: cursor-web-fallback` 持久化 |
| BYOK patch 未应用 | `trellis-*` 子 Agent 继承父模型 | 需 Method 2.5 patch;跑 `trellis-cursor2plus-setup` 技能 |
| 子 Agent 递归尝试 | `trellis-implement`/`trellis-check` 试图再派一个 | 硬守卫阻止;Agent 把建议上报主会话 |
| 任务工件缺失 | 找不到 `prd.md` / `design.md` / `implement.md` | Agent 无法继续;报告缺失工件,主会话需重新规划 |

基于标记的 hook 注入 fallback 最重要:它让系统对 Cursor 平台变更稳健,无需 Trellis 代码修复。

## Model overlay 工作流(Method 2 与 4)

Method 2 与 4 都依赖 Agent 文件上的**一次性 `model:` overlay**。工作流相同;区别只在 overlay 是在 Agent 文件上(Method 2,经 Cursor++ 面板兼容 BYOK)还是临时改 frontmatter(Method 4,仅 Native)。

逐步:

1. **读当前 Agent 文件** —— 确认无 `model:` 字段(默认继承)。
2. **写 overlay** —— 在 frontmatter 插入 `model: <目标模型>`。这是临时编辑,非永久变更。
3. **派发** —— 通过 `Task` 工具生成子 Agent,带派发 prompt。首行必须是 `Selected task: <path>`,以便 hook 标记缺失时 Agent 能解析上下文。
4. **剥离 overlay** —— `Task` 调用返回后立即从 frontmatter 移除 `model:` 行。恢复默认继承行为供后续派发。
5. **验证** —— 读 Agent 文件确认 frontmatter 回到原状。

**为何剥离?** 若 overlay 持留,该 Agent 类型的每次后续派发都用 overlay 模型,违背 per-dispatch 意图,可能让用户意外。剥离步骤不可省。

**Method 2.5 vs overlay:** Method 2.5(BYOK json5 patch)不同 —— 它 patch resolver 本身,非 Agent 文件。应用后,该 `trellis-*` 类型的所有派发路由到配置的 slug,直到 patch 反转。BYOK 下要持久 per-type 路由用 Method 2.5;要 per-dispatch 路由用 overlay(Method 2/4)。

## 延伸阅读

- [内部技能](skills.zh-CN.md) — 11 个自动触发技能,含 `trellis-check` 技能形态
- [Task 系统设计](task-system.zh-CN.md) — Phase 1–3 生命周期、门禁、Parent/Child 任务树
- [Cursor 集成](cursor.zh-CN.md) — 环境探测、Method 2.5 细节、hooks
- [Cursor 中的工作流](workflow.zh-CN.md) — 触发派发的 Phase 2.1/2.2/3.1 步骤
- [检索层](retrieval.zh-CN.md) — `trellis-research` 如何把外部事实路由到 `smart-search-cli`
