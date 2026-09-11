# Spec system

[English](spec-system.md) | 简体中文

Pactile spec system 是位于 `.pactile/spec/` 的项目级持久工程契约库。它让 Agent 只加载与待改文件相关的约定，而不是在每轮对话前置整棵知识树。

## 定义

项目 spec 记录这个仓库实际上如何工作：文件位置、接口、错误行为、必需测试、禁止模式和已知陷阱。它是项目知识，不是 Pactile 产品文档，也不是某一个任务的对话记录。

Pactile 不会仅为了让目录存在就安装空 spec 骨架。只有项目确实需要时，才根据仓库 Evidence 第一次建立 spec tree。

## 职责

- 按 package、layer 或 concern 组织持久约定；
- 用简短 index 把 Agent 路由到相关详细文件；
- 根据 task context 与 package/file scope 渐进加载；
- 使用 manifest 时，区分 implementation context 与 independent-check context；
- 通过受审 closeout 流程接收可复用学习。

## 边界

Specs 不存放通用最佳实践、placeholder、临时任务需求、聊天总结，也不是 Pactile bundled framework 的不可变副本。`prd.md` 定义一个任务；`.pactile/spec/` 定义可复用的项目约定。只说明“要考虑什么”的清单属于 guide；具体仓库契约属于 spec。

## 渐进加载

```text
task definition 与 touched files
  -> package/layer scope
  -> 相关 spec indexes
  -> 选中的详细 specs 与 guides
  -> implementation 或 independent check
```

Agent 读取满足任务所需的最小切片。支持 sub-agent 的工作流可通过 `implement.jsonl` 与 `check.jsonl` 提供精选 spec/research manifests；其他工作流通过开发前路由读取相同项目知识。Manifest 是 context route，不是另一份权威。

## 常见形状

确切结构由项目拥有。Monorepo 可以采用：

```text
.pactile/spec/
  cli/
    backend/
      index.md
      command-contracts.md
    unit-test/
      index.md
  docs-site/
    docs/
      index.md
  guides/
    index.md
    debugging.md
```

单 package 仓库可以省略 package 层。真正有用的边界应来自实际代码，而不是强制模板。

## 生命周期

### Bootstrap

一次性的 `pactile-spec-bootstrap` skill 会分析仓库 Evidence、划分边界、写入真实模式并拒绝 placeholder-only 内容。这是 maintainer workflow，不是每个已初始化项目都必须运行的步骤。

### 开发前读取

在 implementation 或 check 前，Pactile 根据 task 与受影响文件路由到相关 indexes 和详细 specs。Implementer 与 reviewer 可以获得不同的精选 manifest，使检查不会只是重复实现叙事。

### 从持久学习更新

完成的任务可能产生可复用约定。Closeout 流程必须：

1. 判断该学习是否可复用；
2. 提议目标 spec 与具体改动；
3. 为 `update-spec` 取得显式确认；
4. 写入 spec 并记录更新 Evidence。

Routine work 以带理由的 `no-update` 收口。`unsure` 最多追问一次，不能静默修改长期知识。Execute 阶段也不会顺手重写 specs。

## 用户场景

一个任务修改 CLI error contract。Implementation context 加载 command/error specs，check context 再加入相关测试规则。Closeout 时，团队发现一条新的跨平台 exit-code 规则；任务提出对 command contract 的聚焦更新，取得确认后写入，并把 spec 路径记录为 Evidence。后续任务无需回放旧对话即可检索这条规则。

## 应检查什么

- task PRD：只适用于本次改动的 requirements；
- 相关 `.pactile/spec/`：可复用项目规则；
- 存在精选 context manifest 时的 `implement.jsonl` 或 `check.jsonl`；
- closeout Evidence：持久学习是已写入、明确不写，还是仍未解决。

继续阅读 [Task system](task-system.zh-CN.md)和 [Kernel、Evidence 与 Trace](kernel-evidence-trace.zh-CN.md)。
