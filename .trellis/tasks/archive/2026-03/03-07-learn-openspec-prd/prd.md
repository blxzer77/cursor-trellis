# 学习 OpenSpec 体验流程，加强 PRD 制作

## Goal

借鉴 OpenSpec 的 Spec-Driven Development（SDD）流程，改进 Trellis 的 PRD 制作和任务规划能力，让模型产出的 PRD 更结构化、更可执行。

## Background

### OpenSpec 简介

[OpenSpec](https://github.com/Fission-AI/OpenSpec)（20k+ stars）是一个 spec-driven development 框架，核心理念是"先明确要做什么，再写代码"。它将规划拆分成多个独立 artifact，形成可验证的规划管线。

### OpenSpec 核心流程

```
/opsx:new       → 创建 change 目录
/opsx:ff        → 一次生成所有规划文件（proposal + specs + design + tasks）
/opsx:continue  → 逐步创建 artifact（每次一个，可审查）
/opsx:apply     → 执行 tasks.md 中的任务
/opsx:verify    → 验证实现是否偏离 spec
/opsx:archive   → 归档，将 delta specs 合并回 main specs
/opsx:explore   → 调查模式（不允许写代码，专注思考）
```

### OpenSpec 的 Artifact 结构

```
openspec/changes/<change-name>/
├── proposal.md      # 为什么做、改什么（动机 + 范围）
├── specs/           # Delta specs（这次变更影响的规格）
│   └── <module>/
│       └── spec.md
├── design.md        # 技术方案（怎么做）
└── tasks.md         # 实作清单（按顺序的可执行步骤）
```

### Trellis 当前状态

Trellis 用单一 `prd.md` 承载所有规划内容：

```
task-dir/
├── task.json
├── prd.md           # Goal + Requirements + Acceptance Criteria + Technical Notes（全在一个文件）
├── implement.jsonl
└── check.jsonl
```

### 差距分析

| 维度 | OpenSpec | Trellis | 差距 |
|------|----------|---------|------|
| 规划粒度 | 4 个独立 artifact | 1 个 prd.md | Trellis 的 prd.md 经常缺 design 和 tasks 拆解 |
| 快速通道 | `/opsx:ff` 一次生成全部 | Simple Task 模型手动串 | 模型容易半途停住 |
| 逐步审查 | `/opsx:continue` 一次一个 | brainstorm（非结构化） | Trellis 的 brainstorm 产出格式不固定 |
| 验证 | `/opsx:verify` spec-focused | check agent（代码 lint 为主） | Trellis 缺少 "实现 vs 需求" 的系统验证 |
| Delta 管理 | delta specs → merge | 无 | Trellis 的 spec 更新是 ad-hoc 的 |
| 探索模式 | `/opsx:explore` 禁止写代码 | 无 | Trellis 没有纯调查阶段 |

## Requirements

### R1: PRD 结构升级 — 拆分为多个 artifact

将 `prd.md` 的职责拆分，引入更细粒度的规划文件：

```
task-dir/
├── task.json
├── prd.md           # 保留：Goal + Requirements + Acceptance Criteria（WHAT）
├── design.md        # 新增：技术方案（HOW）— 涉及哪些文件、接口变更、数据流
├── tasks.md         # 新增：可执行的步骤清单（DO）— 按顺序、可勾选
├── implement.jsonl
└── check.jsonl
```

**兼容性**：`prd.md` 仍然是必须的（向后兼容），`design.md` 和 `tasks.md` 是可选增强。

### R2: Fast-Forward 模式 — 确认后一次生成

借鉴 `/opsx:ff`，在 `start.md` 的 Simple Task 路径中加入 fast-forward：

- 用户确认需求后，模型一次性生成 `prd.md` + `design.md` + `tasks.md`
- 然后直接进入 Phase 2（research → init-context → start）
- 消除"创建 task 后停住"的问题（与 `03-06-hook-start-equiv` 的 R1 协同）

### R3: Plan Agent 支持新 artifact

更新 `plan.md` agent，让它在规划阶段同时产出 design.md 和 tasks.md：

- research 后写 design.md（基于 codebase 分析的技术方案）
- 将实现步骤拆分到 tasks.md（而不是嵌入在 prd.md 的 Technical Notes 里）

### R4: Check Agent 增加 spec 验证

借鉴 `/opsx:verify`，在 check agent 的流程中增加一步：

- 将 `git diff` 的变更与 `prd.md` 的 Acceptance Criteria 逐项比对
- 输出"需求覆盖度"（哪些 AC 已满足、哪些未满足）

### R5:（Stretch）Explore 模式

借鉴 `/opsx:explore`，在 brainstorm 之前增加 explore 阶段：

- 明确禁止写代码，只做调查和分析
- 适合"不确定要做什么"的场景
- 产出：调查报告，作为 brainstorm 的输入

## Acceptance Criteria

- [ ] task 目录支持 `design.md` 和 `tasks.md`（可选文件）
- [ ] plan agent 能产出 design.md + tasks.md
- [ ] implement agent 能读取 tasks.md 作为执行清单
- [ ] check agent 能逐项验证 Acceptance Criteria
- [ ] start.md Simple Task 路径支持 fast-forward（一次生成所有 artifact）
- [ ] 现有流程向后兼容（无 design.md/tasks.md 时行为不变）

## Technical Notes

- 与 `03-06-hook-start-equiv`（R1: start.md 强化指令）有协同关系
- `inject-subagent-context.py` 的 `get_implement_context()` 需要增加读取 `tasks.md`
- `task.py` 的 `init-context` 不需要改动（design.md/tasks.md 不是 jsonl 条目，是直接文件）
- 优先级：R1 > R2 > R3 > R4 > R5

## References

- [OpenSpec GitHub](https://github.com/Fission-AI/OpenSpec)
- [OpenSpec v1.0 OPSX 命令详解](https://blog.cashwu.com/blog/2026/openspec-opsx-commands)
- [OpenSpec + Claude Code 工作流](https://www.vibesparking.com/en/blog/ai/openspec/2025-10-17-openspec-claude-code-dev-process/)
- [SDD 工具对比：GSD vs Spec Kit vs OpenSpec vs Taskmaster AI](https://medium.com/@richardhightower/agentic-coding-gsd-vs-spec-kit-vs-openspec-vs-taskmaster-ai-where-sdd-tools-diverge-0414dcb97e46)
