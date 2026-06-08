# Rollout 2 Trace — 同问题独立复现

## Source

`/Users/taosu/Library/Containers/com.tencent.xinWeChat/.../rollout-2026-04-23T13-13-57-019db8c2-...jsonl`

## Session Meta

- 同一 Codex 版本 / 模型 / 配置
- 起手: `$trellis-continue 04-22-08-task-dtl-003-quote-unlock`
- 任务域: 不同业务，仍是 Java backend + Vue frontend fullstack，仍是"按端拆包" monorepo

## Tool Call 统计

| tool | 次数 |
|---|---|
| `exec_command` | 127 |
| `apply_patch` | 6（共 36 个文件变更：14 Java + 8 Vue/TS + 2 新增 JUnit 测试） |
| `write_stdin` | 8 |
| `update_plan` | 1 |
| **子进程分派** | **0** |

主线程亲自改了：`IqsTask.java`、`TaskWorkAppService.java`、`MpmIntegrationService.java`、`MpmController.java`、`SrmAppService.java`、`TaskDetailResponse.java`、`QuoteFormSection.vue`、`TaskDetailDrawer.vue`、`useTaskDetail.ts`、`integrationsApi.ts/contract.ts`、`tasksApi.contract.ts`、`MaterialSelectModal.vue`，还写了 2 个 JUnit 测试类。

## 与 Rollout 1 对比

| 维度 | Rollout 1 | Rollout 2 |
|---|---|---|
| 入口 | `$trellis-continue <task>` | 同 |
| Phase 2.1 output | "Spawn the implement sub-agent" | 同一字面 |
| 主线程反应 | 忽略 spawn，自己 apply_patch | **行为 1:1 复现** |
| 修改范围 | 若干 | **更大：36 处 patch，跨后端 Java + 前端 Vue/TS + 新写测试** |
| 助手措辞 | 第一人称祈使 | 同："我先确认… / 我改 / 我现在转去… / 我开始跑校验" |
| sub-agent 被提及 | 从未 | **从未**（16 条 assistant 可见消息中 0 次提 trellis-implement） |
| init-context 是否失败 | 是 | 是（同 monorepo `--package required`） |

## 额外行为细节

主线程遇到 `init-context` 报 `monorepo project requires --package` 时，声明：
> "init-context 在这个仓库的 monorepo 配置上和现有 spec 目录结构不匹配，**我不打算在这一步折腾工具本身**。"

随后：
- 直接 `apply_patch` 改 `task.json.status: planning → in_progress`、`dev_type: null → fullstack`
- 手写 `implement.jsonl` / `check.jsonl`（以 archive 里旧任务的 jsonl 为模板）
- **绕过工具后**埋头写业务代码

## 独立样本价值

两次 rollout：不同任务、不同代码域、不同时间段，**同一行为 1:1 复现**。说明：

1. 这不是任务特例或 prompt 微调能解决的事
2. 是系统性 prompt 设计缺陷，每次 `$trellis-continue` 都会踩
3. `init-context` 失败是**每次触发**失控链路的共同起点

## Why relevant to this task

双样本独立复现让"init-context 失败催化主线程独占"的因果关系从"猜测"升级为"可重现的实证"。这给了本 task 的改造足够的置信度：删掉 init-context 至少能堵上两个可复现的失控起点。
