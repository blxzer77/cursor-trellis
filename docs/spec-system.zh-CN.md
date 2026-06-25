# Spec 系统

[English](spec-system.md) | 简体中文

本文讲述 `.trellis/spec/` 的设计:**渐进式规范系统**,承载项目特定的工程约定,如何加载进 Agent 上下文,以及管理其生命周期的两个技能(`trellis-spec-bootstrap` 与 `trellis-update-spec`)。

## `.trellis/spec/` 是什么

靠记忆约定的 Agent 一定会记错。Trellis 在合适时机注入相关 spec —— 或要求 Agent 读取 —— 不把所有东西前置塞进一个巨型文件。`.trellis/spec/` 是用户项目特定的工程规范库:关于这个代码库如何构建的可执行契约,不是泛泛最佳实践。

关键属性是**渐进式加载**:Agent 只读即将编辑文件相关的 spec 切片,不读整棵树。这由 `trellis-before-dev` 技能与 `implement.jsonl` / `check.jsonl` manifest 强制。

## 目录模型

### 单仓库

```text
.trellis/spec/
├── backend/
│   ├── index.md
│   └── ...
├── frontend/
│   ├── index.md
│   └── ...
└── guides/
    ├── index.md
    └── ...
```

### Monorepo

```text
.trellis/spec/
├── cli/
│   ├── backend/
│   │   ├── index.md
│   │   └── ...
│   └── unit-test/
│       ├── index.md
│       └── ...
├── docs-site/
│   └── docs/
│       ├── index.md
│       └── ...
└── guides/
    ├── index.md
    └── ...
```

`index.md` 是每层入口 —— 列出 **Pre-Development Checklist** 与 **Quality Check** 指针。具体规范在 index 指向的同级 Markdown 文件里。index 是指针,不是目标;`trellis-before-dev` 强制读实际的 guideline 文件。

## 包配置

`.trellis/config.yaml` 声明包:

```yaml
packages:
  cli:
    path: packages/cli
  docs-site:
    path: docs-site
    type: submodule
default_package: cli
```

运行时发现包与 spec 层:

```bash
python ./.trellis/scripts/get_context.py --mode packages
```

此命令列出当前项目的包与 spec 层。配置 `implement.jsonl` / `check.jsonl` manifest 时以此为参考。

## Spec 如何进入任务

任务进入实现前,规划可把相关 spec 写进 `implement.jsonl`(给实现者)和 `check.jsonl`(给审查者):

```jsonl
{"file": ".trellis/spec/cli/backend/index.md", "reason": "CLI backend conventions"}
{"file": ".trellis/spec/cli/unit-test/conventions.md", "reason": "Test expectations"}
```

子 Agent 派发时读这些 manifest。若 `<!-- trellis-hook-injected -->` 标记存在,所列文件已自动加载;否则 Agent 从派发 prompt 的 `Selected task: <path>` 行读取。上下文加载协议见 [subagents.zh-CN.md](subagents.zh-CN.md)。

无子 Agent 支持的平台,Agent 按工作流直接读相关 spec。

## Code-Spec vs Guide

Trellis 硬区分两种 spec 类型:

| 类型 | 位置 | 目的 | 内容风格 |
| --- | --- | --- | --- |
| **Code-Spec** | `<layer>/*.md` | 告诉 Agent "如何安全实现" | 签名、契约、矩阵、用例、测试点 |
| **Guide** | `guides/*.md` | 帮助 Agent "该想什么" | 清单、问题、指向 spec 的指针 |

判定规则:

- "这是**怎么写**代码" → 放 spec 层目录
- "这是**写之前该想什么**" → 放 `guides/`

Guide 应是短清单,指向 spec,不复制详细规则。例:"用 API X 不用 API Y" 是 spec 约定(具体);"做 Y 时记得查 X" 是 guide 清单项(抽象)。

## Spec 该写什么

Spec 承载项目可执行工程约定,非泛泛最佳实践:

- 文件该放哪
- 错误处理怎么表达
- API、hooks、commands 的输入/输出契约
- 禁止的模式
- 需要测试的场景
- 项目特定坑与规避

Agent 在实现或调试中学到新规则时,应更新 `.trellis/spec/`(经 `trellis-update-spec`),而非只在 chat 里总结。

## 生命周期:`trellis-spec-bootstrap`(创建)

`trellis-spec-bootstrap` 技能处理 spec 树创建或重构。单 owner 全流程:

1. **分析仓库** —— 用源码分析(GitNexus / ABCoder / 直接读源码)提取真实约定,非模板猜测
2. **解耦 spec 边界** —— 把关注点分到 layer/package 目录;避免一个巨型 spec 文件
3. **用真实模式填充** —— 实际签名、实际契约、代码里观察到的实际错误矩阵
4. **验证无 placeholder** —— `PLACEHOLDER_VALUES_RE` 正则(`TBD|TODO|待定|待补充|N/A|NA|NONE|-|…`)拒绝占位内容

边界:无模板套话;一个 owner 负责整个 bootstrap。技能带 `mcp-setup`、`repository-analysis`、`spec-task-planning` 参考。

## 生命周期:`trellis-update-spec`(维护)

`trellis-update-spec` 技能是把持久学习回写 spec 的半自动流。Phase 3.3 学习决策为 `update-spec` 时触发。

**流程**(必须 —— 禁止静默 spec 编辑):

1. **Detect** —— 此任务是否产出可复用 code-spec 或 guide-worthy 学习?
2. **Proposal** —— 写 `{TASK}/research/learning-proposal.md`,含目标 spec 路径与草稿要点。**不编辑 `.trellis/spec/`。**
3. **Confirm** —— 用户显式批准;`verify.md` 出现 `Learning decision: update-spec`
4. **Write** —— 此时才编辑 spec 文件;`verify.md` 加 `Spec update evidence: .trellis/spec/...`

**禁止**:静默 spec 编辑;决策为 `no-update`/`unsure` 时写 spec 无后续;仅从 hook 或 check 自动更新。

### Code-Spec 深度(7 段)

infra 或跨层契约变更时,`trellis-update-spec` 强制 7 段:

1. **Scope / Trigger** —— 为何需要 code-spec 深度
2. **Signatures** —— command / API / DB 签名
3. **Contracts** —— 请求字段、响应字段、环境变量(必填/可选)
4. **Validation & Error Matrix** —— `<条件>` → `<错误>`
5. **Good / Base / Bad Cases** —— 具体用例
6. **Tests Required** —— unit / integration / E2E 含断言点
7. **Wrong vs Correct** —— 至少一对对比

强制触发:新增/变更 command 或 API 签名、跨层请求/响应契约变更、DB schema/migration 变更、infra 集成(storage、queue、cache、secrets、env wiring)。

## 本地化定制点

| 需求 | 编辑位置 |
| --- | --- |
| 加新 spec 层 | `.trellis/spec/<package>/<layer>/index.md` + guideline 文件 |
| 改 monorepo spec 映射 | `.trellis/config.yaml` 的 `packages` / `default_package` / `spec_scope` |
| 改实现者读哪些 spec | 任务的 `implement.jsonl` |
| 改审查者读哪些 spec | 任务的 `check.jsonl` |
| 改 spec 何时更新 | `.trellis/workflow.md` 的 Phase 3.3 与 `trellis-update-spec` 技能 |

## 边界

`.trellis/spec/` 是用户项目规范,**不是** Trellis 内置模板的永久副本。Agent 鼓励用户按实际项目代码更新它,而非把 Trellis 默认模板当不可变文档。bootstrap 技能提取真实模式;update 技能回写新学习;两者都不冻结 spec 树。

## 延伸阅读

- [Task 系统设计](task-system.zh-CN.md) — `implement.jsonl` / `check.jsonl` manifest、Phase 3.3 学习决策
- [内部技能](skills.zh-CN.md) — `trellis-spec-bootstrap` 与 `trellis-update-spec` 定义
- [Cursor 中的工作流](workflow.zh-CN.md) — Phase 2.1(`trellis-before-dev` 规范读取)与 Phase 3.3(学习决策)
- [Cursor 集成](cursor.zh-CN.md) — 上下文注入、`preToolUse` hook 限制
