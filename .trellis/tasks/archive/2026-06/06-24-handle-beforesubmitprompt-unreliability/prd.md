# Handle beforeSubmitPrompt channel unreliability (C-2 confirmed)

## Background

`beforeSubmitPrompt` hook 通过 `additional_context` 注入 `## 代码库检索计划`。subagent 初判 High confidence 不可靠（#158452 / #158883 同族）。本任务用 marker probe 做决定性验证。

## Step 1 — Marker Probe（已完成，2026-06-24）

双环境 marker probe 结论：

### BYOK 环境（cursorEnv: byok, ~/.ccursor/routes.json byokMode=1）

- Marker: `CURSOR_PROBE_47E67734`
- **L1 hook 触发：否**。probe log 只有自检记录（18:13:27），用户消息（18:15 左右）无新记录。
- **L2 标记送达：否**。模型报告"未观察到"。
- sessionStart 旁证：`.trellis/.runtime/sessions/cursor_22901720-...json` 存在，证明 sessionStart hook 触发过 → hook 机制未全死，是 beforeSubmitPrompt 特定事件未触发。

### Native 环境（cursorEnv: native）

- Marker: `CURSOR_PROBE_NATIVE_BA3E4E1C`
- **L1 hook 触发：否**。probe log 最后写入 18:21:56（自检时间），Native 会话消息（18:21 之后）无新记录。Native 会话回复里 L1 标"是"是误判——它看到的是自检旧记录，非本会话触发的新记录。
- **L2 标记送达：否**。模型报告"未观察到"，并明确检查了 hooks_context / always_applied_workspace_rules / user_rules / agent_skills / mcp_file_system 均无。

### 双环境统一结论

| 层面 | BYOK | Native |
| --- | --- | --- |
| L1: Cursor 是否调用 beforeSubmitPrompt hook | ❌ 未调用 | ❌ 未调用 |
| L2: additional_context 是否送达模型 | ❌ 未送达 | ❌ 未送达 |

**`beforeSubmitPrompt` hook 在当前 Cursor 版本（2026-06）下，BYOK 与 Native 双环境均不可用**：既不稳定触发（依赖 code path，forum #148316 / #155183 佐证），触发后 `additional_context` 也不送达模型（#158883 同族）。

### Web 证据（2026 年）

- Cursor 官方文档确认 `beforeSubmitPrompt` 是支持的事件（IDE 环境）。
- forum #148316：「Cursor CLI doesn't send all events — Only tool-level hooks work. None of the lifecycle hooks fire (sessionStart, sessionEnd, afterAgentResponse, stop)」。
- forum #155183（已确认 bug）：queued messages / agent backend code path 跳过 beforeSubmitPrompt。
- forum #158883：即使触发，`updated_input` 被静默丢弃。
- forum #149566：某些版本 sessionStart 被报为「Unknown hook type」。

## Step 2 — 降级 inject-retrieval-plan.py 为 telemetry-only（待执行）

保留 hook 注册（用于监测 Cursor 何时修复该事件触发），但：
- 移除对 `additional_context` 注入的功能依赖（既然不送达，产出无意义）。
- 改为只写 side-channel 日志（记录触发事件、问题类型、cursorEnv、路由决策），供 REC-03 遥测分析。
- 或直接从 `hooks.json` 注销该 hook（若 telemetry 价值不足以抵消维护成本）。

## Step 3 — 迁移路由指令到可靠通道（待执行）

可靠通道：`.cursor/rules/*.mdc`（alwaysApply: true）+ `AGENTS.md`。

- 验证 `.cursor/rules/retrieval-routing.mdc` 已覆盖 Native/BYOK 双环境工具矩阵（审核时已确认内容完整）。
- 在 `AGENTS.md` TRELLIS:START 块或 retrieval-routing.mdc 增补 fallback 指令：当 agent 需要检索计划时，主动运行 `python ./.trellis/scripts/route_codebase_retrieval.py "<question>" --instructions`。
- 确认 `retrieval-routing.mdc` 已是 `alwaysApply: true`（Rules 通道在双环境 probe 中均验证可靠——Native 会话明确报告看到了 always_applied_workspace_rules）。

## Step 4 — 更新 channel matrix（待执行）

在 `cursor-context-injection-guide.md` 的 channel matrix 新增行：

| Channel | Reliable? | Trellis content |
| --- | --- | --- |
| `beforeSubmitPrompt` hook → `additional_context` | ❌ No (L1 不触发 + L2 不送达，双环境 probe 确认 2026-06-24) | 降级为 telemetry-only 或注销 |

并在 "When to update this guide" 增条：Cursor 修复 beforeSubmitPrompt 触发 + additional_context 送达后重新验证。

## Acceptance Criteria

- [x] Step 1: 双环境 marker probe 完成，C-2 确凿成立（L1+L2 双层失效）
- [x] Step 2: inject-retrieval-plan.py 降级为 telemetry-only 或从 hooks.json 注销
- [x] Step 3: retrieval-routing.mdc + AGENTS.md 覆盖关键路由指令，`alwaysApply: true` 确认
- [x] Step 4: cursor-context-injection-guide.md channel matrix 更新 beforeSubmitPrompt 行
- [x] hook 生产脚本已回滚与模板源一致（probe 改动清理完毕）

## Notes

- probe 产物 `probe-marker.log` 留在 `.trellis/` 作为 audit trail，由 `06-24-cleanup-debug-hooks` 任务清理。
- 本任务不改 Cursor 上游 bug（#158452 / #158883 / #155183），等 Cursor 团队修复。
