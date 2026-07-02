# Task 系统

[English](task-system.md) | 简体中文

本文讲述 **Trellis task 系统**:持久任务工件、Development Strategy Contract、质量门禁、三阶段生命周期(Plan → Execute → Finish)、Parent/Child 任务树。

## Trellis task 是什么

Trellis task 是 `.trellis/tasks/<MM-DD-slug>/` 下一组**持久工件**。对话压缩,文件不丢。主会话失忆时,任务工件是唯一真相 —— 下一会话读 `prd.md`、`design.md`、`implement.md`,从记录的 phase 恢复。

任务仅在 **Request Triage** 把回合分类为可工作模式(Lite / Full / Parent)且用户**同意建任务**后创建。同意建任务不等于同意写码 —— 规划先行。Triage 决策树见 [workflow.zh-CN.md](workflow.zh-CN.md)。

## 工件契约

| 文件 | 职责 | 何任务必需 |
| --- | --- | --- |
| `prd.md` | 需求、约束、验收标准。不放技术设计或执行清单 | 所有任务 |
| `design.md` | 复杂任务技术设计:边界、契约、数据流、权衡、兼容、回滚形态 | Full + Parent |
| `implement.md` | 复杂任务执行计划:有序 checklist、Development Strategy Contract、校验命令、审查 gate、回滚点 | Full + Parent |
| `verify.md` | 校验证据、最终验收、持久学习决策、check 证据、审查 change-set | 所有(收尾时) |
| `implement.jsonl` | 给实现者子 Agent 的 spec/research manifest | 子 Agent 需上下文时 |
| `check.jsonl` | 给审查者子 Agent 的 spec/research manifest | 子 Agent 需上下文时 |
| `task.json` | 机器状态:status、quality_gate_results、fingerprint、contract epoch | 自动管理 |
| `task-map.md` | 仅 Parent:child 状态、集成事件日志 | Parent 任务 |

轻量(Lite)任务可仅 PRD。复杂(Full)任务在 `start-execution --check` 前必须有 `prd.md`、`design.md`、`implement.md`。

## Development Strategy Contract

每个 Full / Parent 任务在 `implement.md` 里带一个 **Development Strategy Contract**(YAML 块)。`task.py` 解析并校验(见 `task_gates.py`)。无效 enum 值过不了门禁。

```yaml
execution_mode: inline
isolation: main-worktree
verification_profile: standard
retrieval_profile: structure
optional_capabilities:
  - markdown-documentation
quality_gates:
  mode: profile
  profile: standard
  enabled:
    - requirements-review
  disabled: []
```

### 枚举值

| 字段 | 允许值 | 含义 |
| --- | --- | --- |
| `execution_mode` | `inline` \| `worker` \| `child-task` | 工作在哪跑:主会话 / worker 子 Agent / Child 任务 |
| `isolation` | `main-worktree` \| `git-worktree` | Git 隔离级别 |
| `verification_profile` | `standard` \| `strict` \| `architecture` | 适用哪套 gate |
| `retrieval_profile` | `exact-only` \| `semantic` \| `structure` \| `architecture-memory` | 检索激进程度 |
| `quality_gates.mode` | `profile` \| `explicit` | 从 profile 派生 gate 还是显式列出 |
| `quality_gates.profile` | `standard` \| `strict` \| `architecture` | gate 集(mode=profile 时) |
| `quality_gates.enabled` | gate 名列表 | 显式 gate 列表(mode=explicit 时) |

六个顶层字段(`execution_mode`、`isolation`、`verification_profile`、`retrieval_profile`、`optional_capabilities`、`quality_gates`)全部必填。缺任一过不了门禁。

### `execution_mode` 语义

`execution_mode` 决定**谁**实现和检查 —— 它是与子 Agent 派发最直接相关的字段:

| `execution_mode` | 谁实现 / 检查 | 典型 `isolation` |
| --- | --- | --- |
| `inline` | 主会话自实现自检查(`cstl-check` 技能形态或 inline review) | `main-worktree` |
| `worker` | 派 `cstl-implement` 再 `cstl-check` Agent | `main-worktree` |
| `child-task` | Child 会话做工作;Parent 编排 | `git-worktree`(有 git package root 时) |

派发合约详见 [subagents.zh-CN.md](subagents.zh-CN.md)。已批合约与最新建议不一致时,`task.py start-execution --check` 打 `[execution-strategy] WARN`(仅提示)。

### 规划阶段建议 execution_mode / isolation

定稿 `implement.md` 里的合约前,先运行:

```bash
python ./.trellis/scripts/task.py suggest-execution-strategy <task-dir>
python ./.trellis/scripts/task.py suggest-execution-strategy <task-dir> --json
```

规则来自 `.trellis/config/execution-strategy-rules.json`(能力、路径段、父子任务信号)。**触及代码的 Full 任务**默认建议 `worker` + `main-worktree`;**仅文档**的 Full 任务默认 `inline`。用户批准后仍以 `implement.md` 中的 YAML 为准。

`start-execution --check` 会在合约与最新建议不一致时输出 `[execution-strategy] WARN`(仅提示,不导致门禁失败)。派发约定见 `.trellis/spec/guides/execution-strategy.md` 与 `workflow.md` Phase 2.1 / 2.2。

## verification_profile 与默认 gate

| Profile | 默认 gate |
| --- | --- |
| `standard` | `requirements-review`、`code-review` |
| `strict` | `requirements-review`、`code-review` |
| `architecture` | `requirements-review`、`architecture-review`、`code-review` |

gate 集来源:`task_gates.py` 的 `PROFILE_DEFAULT_GATES`。`strict` 通过证据要求加严,不加 gate 名;`architecture` 加 `architecture-review` gate。

## 门禁机制

### Start-execution 门禁(Phase 1.4)

```bash
python ./.trellis/scripts/task.py start-execution <task> --check        # 非破坏性预检
python ./.trellis/scripts/task.py start-execution <task> --approved     # 翻转 status → in_progress
```

`--check` 校验 contract、工件、必需 gate,不修改。规划 gate(`requirements-review`、启用时的 `architecture-review`)在 `--approved` 且工件过 CLI 校验时自动记录。需用户显式批准后才 `--approved`。

### 手动记录 gate

```bash
python ./.trellis/scripts/task.py record-gate <task> \
  --transition full-task-complete \
  --gate code-review \
  --result PASS \
  --reviewer <reviewer-id> \
  --evidence verify.md
```

`record-gate` 在转换证据缺失或仅占位时拒绝 `PASS` / `SKIPPED`。审查 gate **从不自动 PASS** —— 需审查后显式记录。

### 已知转换

| 转换 | 何时 |
| --- | --- |
| `start-execution` | Phase 1.4,实现前 |
| `full-task-complete` | Phase 3,归档前 |
| `child-review` | Parent 审查 Child |
| `parent-changes` / `parent-accepted` / `parent-integrating` / `parent-integrated` / `parent-cancelled` | Parent/Child 集成生命周期 |

### 已知 gate

`baseline-check`、`requirements-review`、`code-review`、`architecture-review`、`architecture-deep-review`、`integration-review`。结果:`PASS` / `FAIL` / `SKIPPED`。

## Phase 1–3 生命周期

### Phase 1: Plan

| 步 | 名称 | 必需 | 可重复 |
| --- | --- | --- | --- |
| 1.0 | 建任务(同意后) | 一次 | — |
| 1.1 | 需求探索(`prd.md`;Full 还需 `design.md` + `implement.md`) | 必需 | 可重复 |
| 1.2 | 研究(派 `cstl-research`,写 `research/<topic>.md`) | 可选 | 可重复 |
| 1.3 | 配置上下文(`implement.jsonl` / `check.jsonl`) | 条件 | 一次 |
| 1.4 | 执行门禁(`start-execution --check` → 批准 → `--approved`;status → `in_progress`) | 必需 | 一次 |
| 1.5 | 完成标准 | — | — |

### Phase 2: Execute

| 步 | 名称 | 必需 | 可重复 |
| --- | --- | --- | --- |
| 2.1 | 实现(`cstl-implement` 子 Agent 或 inline) | 必需 | 可重复 |
| 2.2 | 质量检查(`cstl-check` 技能或 Agent) | 必需 | 可重复 |
| 2.3 | 回滚 | 按需 | — |

### Phase 3: Finish

| 步 | 名称 | 必需 |
| --- | --- | --- |
| 3.1 | 验证(证据入 `verify.md`) | 必需 |
| 3.2 | Break loop(卡住时;`cstl-break-loop`) | 按需 |
| 3.3 | 持久学习决策(`update-spec` \| `no-update` \| `unsure`) | 必需 |
| 3.4 | 提交 | 必需 |

Status 从 `--approved` 起保持 `in_progress`,直到 `task.py archive` 才翻转。

## Parent/Child 任务树

一个请求含多个独立可验证交付物时用 Parent 任务。

- **Parent 拥有**:源需求集、`task-map.md`、跨 child 验收标准、最终集成审查
- **Child 拥有**:可独立规划、实现、检查、归档的交付物

创建 child:

```bash
python ./.trellis/scripts/task.py create "<title>" --slug <name> --parent <parent-dir>
python ./.trellis/scripts/task.py add-subtask <parent> <child>      # 链接已有
python ./.trellis/scripts/task.py remove-subtask <parent> <child>   # 解链错误
```

Parent/Child **不是**依赖系统。若一个 child 必须等另一个,把顺序写进 child `prd.md` / `implement.md`,每个 child 验收标准可独立测试。

### Child 状态(Child 控制)

```bash
python ./.trellis/scripts/task.py set-child-state <parent> <child> open|working|blocked|review --evidence <ref>
```

### 集成状态(Parent 控制)

```bash
python ./.trellis/scripts/task.py prepare-child-worktree <parent> <child> --branch <branch>
python ./.trellis/scripts/task.py integrate-child <parent> <child> changes|accepted|integrating|integrated|cancelled --evidence <ref>
```

- `merge_limit: 1` 阻止多于一个 Child 同时 `integrating`
- 集成是串行 Git-ref 集成;每个决策把冲突、合并决策、验收理由写入 `task-map.md` Event Log
- Child 可提供证据并请求审查,但**不能**自标 `changes` / `accepted` / `integrating` / `integrated` / `cancelled` —— 只有 Parent 有集成权限

### Parent 审查编排

```bash
python ./.trellis/scripts/task.py parent-status <parent-task>
python ./.trellis/scripts/task.py generate-child-prompt <parent-task> <child-task> --mode inline
python ./.trellis/scripts/task.py review-child <parent-task> <child-task> --check
python ./.trellis/scripts/task.py review-child <parent-task> <child-task> --decision accept --ref <child-ref>
python ./.trellis/scripts/task.py review-child <parent-task> <child-task> --decision integrate-through --ref <child-ref>
```

`review-child` 汇总 child `verify.md` / `handoff.md`,把备注追加到 parent `verify.md`,可一流推进 `accepted` → `integrating` → `integrated`(`--decision integrate-through`),用与 `integrate-child` 相同的 Stage 0 集成守卫。

审查质量 gate **不**自动记录。CLI 在转换边界强制:

- **Full Child accept / integrate-through**:Parent 标 Child `accepted` 前需实质 `verify.md` 证据与 `child-review/code-review`(加配置的 architecture gate)
- **Parent 归档**:需所有结构性 Child `integrated` 或 `cancelled`、实质 Parent 集成证据、`parent-integrated/integration-review`
- **Lite 收尾**:显式无 gate 链;归档仍需 `verify.md` 校验、验收、持久学习证据

## 归档门禁

```bash
python ./.trellis/scripts/task.py archive <task> --check    # 非破坏性预检
python ./.trellis/scripts/task.py archive <task>            # 归档(移到 archive/2026-MM/)
```

归档需 `verify.md` 证据行(grep 友好):

- 校验命令 + 结果
- 最终验收证据(或 `Accepted by user:`)
- 持久学习决策(`no durable learning` / `Spec update evidence:` / `Learning artifact:`)
- check 证据(`cstl-check` 摘要或手动审查记录)
- 审查 change-set(git ref 或 diff 摘要)

加上 `full-task-complete/code-review` gate 记录。用 `prepare-archive-evidence` 辅助起草证据块,再用 `record-gate` 在显式审查后记录(从不自动 PASS)。

## 任务路径 fallback(子 Agent 派发,0.2.8 起)

当 `task.py select` 未运行(或会话指针缺失)时,子 Agent 派发流仍需一个任务路径来读 `prd` / `design` / `implement` / `implement.jsonl`。fallback 链:

1. **`generate_dispatch_prompt.py --task <path>`** —— **主 fallback**。主会话显式传任务目录;脚本解析该路径下工件并嵌入 Layer 2 派发 prompt。即使无 task 被 `select`,也能工作。
2. **`task.py select <task>` 失败提示** —— `task.py select` 因无任务而失败时,错误信息现打印一行提示,指向 `generate_dispatch_prompt.py --task <path>` 作为免 select 的派发路径。

这让派发流对"无 selected task"状态鲁棒(`/multitask` 并行派发、新会话、会话指针过期)。无论是否 `select` 过,CLI Layer 2 派发 prompt 始终是主上下文通道——见 [子 Agent 派发](subagents.zh-CN.md#entry-points-与-context-source028-起)。

## 延伸阅读

- [Cursor 中的工作流](workflow.zh-CN.md) — 完整 Triage 决策树、Task Ladder、升降级规则
- [内部技能](skills.zh-CN.md) — `cstl-brainstorm` / `cstl-before-dev` / `cstl-check` / `cstl-break-loop` / `cstl-update-spec`
- [子 Agent 派发](subagents.zh-CN.md) — `cstl-implement` / `cstl-check` 派发、Parent/Child 集成权限
- [Spec 系统](spec-system.zh-CN.md) — 喂给任务上下文的 `implement.jsonl` / `check.jsonl` manifest
