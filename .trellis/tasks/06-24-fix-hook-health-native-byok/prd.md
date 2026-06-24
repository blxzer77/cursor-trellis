# Fix cursor-trellis hook health for Native/BYOK environments

## Background

2026-06-24 对 `cursor-trellis` 的 hook 体系做了一次只读审核，覆盖 Native 与 Cursor++BYOK 两种环境。审核发现 2 个 Critical、2 个 High、3 个 Medium、1 个 Low 问题。C-2（`beforeSubmitPrompt` 通道不可靠）由 subagent 判定为 **High confidence 成立**。

本 Parent Task 统筹 5 个子任务的修复，目标是让 hook 体系在 Native/BYOK 双环境下都健康可用。

## Findings Summary

| ID | Severity | Issue |
| --- | --- | --- |
| C-1 | Critical | `cursor-trellis\.cursor\hooks\inject-retrieval-plan.py` 缺失但被 hooks.json 注册（dogfooding 副本漂移） |
| C-2 | Critical | `beforeSubmitPrompt` 的 `additional_context` 通道不可靠（hook 执行成功但内容不送达模型，#158452 同族） |
| H-1 | High | dogfooding 副本 `inject-subagent-context.py` 是旧版 25KB 全量实现，与模板源 7.6KB thin-wrapper 版脱节 |
| H-2 | High | 模板源 `session-start.py` 硬编码 `python3`（5 处），标准 Windows 不可用 |
| M-1 | Medium | 两套 `.cursor/hooks/` 并存无治理（工作区根 + 项目内），dogfooding 副本易漂移 |
| M-2 | Medium | 工作区根 `inject-subagent-context.py` 的 BOM strip 补丁未回传模板源 |
| M-3 | Medium | 5 个 `*-debug.py` 脚手架残留且未注册 |
| L-1 | Low | `hooks-and-settings.md` 文档易让人误以为 Cursor 装 `inject-workflow-state.py` |

## Child Tasks

1. **06-24-fix-session-start-python3-windows** (P1) — H-2: 模板源 session-start.py 的 `python3` 占位化/跨平台化
2. **06-24-backport-bom-strip-subagent-hook** (P2) — M-2: BOM strip 补丁回传模板源
3. **06-24-sync-dogfooding-hooks** (P1) — C-1+H-1: 重新同步 cursor-trellis/.cursor/hooks 到最新模板源
4. **06-24-handle-beforesubmitprompt-unreliability** (P1) — C-2: marker probe 确认 + 降级 inject-retrieval-plan.py + 路由指令迁移到可靠通道 + 更新 channel matrix
5. **06-24-cleanup-debug-hooks** (P3) — M-3: 清理 debug 脚手架与 stale logs

## Requirements

- 所有对 `packages/cli/src/templates/shared-hooks/` 的修改必须同步验证 dogfooding 副本（`cursor-trellis/.cursor/hooks/`）能通过 `trellis update` 正确同步
- Windows 兼容性是硬约束：`python3` 不可假设存在；BOM/编码处理必须鲁棒
- C-2 的修复不能破坏 REC-03 遥测（hook 仍需记录触发事件供分析）
- 路由指令迁移到 `.cursor/rules` 或 `AGENTS.md` 时，必须保持 Native/BYOK 双环境的工具矩阵正确（Native→@codebase，BYOK→fast_context_search）

## Acceptance Criteria

- [ ] 在标准 Windows（无 python3 shim）上，sessionStart 注入的 Next-Action 提示中的命令可执行
- [ ] 模板源 `inject-subagent-context.py` 对 BOM 前缀 stdin 不再静默退出
- [ ] `cursor-trellis` 作为工作区根独立打开时，5 个注册的 hook 文件全部存在且为最新模板源版本
- [ ] C-2 经 marker probe 获得决定性证据；`inject-retrieval-plan.py` 降级为 telemetry-only（若 probe 确认）
- [ ] `.cursor/rules/retrieval-routing.mdc` 或 `AGENTS.md` 覆盖了原 `beforeSubmitPrompt` 注入的关键路由指令
- [ ] `cursor-context-injection-guide.md` channel matrix 新增 `beforeSubmitPrompt` 行并标注可靠性
- [ ] debug 脚手架与 stale log 清理完毕
- [ ] `pnpm test` / `pnpm lint` / `pnpm typecheck` 全绿（涉及 TS 模板的子任务）
- [ ] Hook 脚本在 BYOK 环境（`~/.ccursor/routes.json` byokMode=1）下路由正确

## Out of Scope

- 修复 Cursor 上游 bug #158452 / #158883（等 Cursor 团队）
- 其他平台（Claude/Codex 等）的 hook 调整（除非模板源改动波及）
- `.trellis/spec/` 下非 hook 相关 spec 的修改

## Environment

- 审核环境：Windows 10.0.26200，BYOK（`~/.ccursor/routes.json` byokMode=1）
- 审核 commit：cursor-trellis @ main, 747ca01c (v0.1.3)
- BYOK 探测脚本命令行实测正确返回 `byok`
