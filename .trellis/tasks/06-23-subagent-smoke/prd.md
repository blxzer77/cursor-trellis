# Subagent dispatch smoke test

## Goal

验证 Trellis 三种 subagent（`trellis-research` / `trellis-implement` / `trellis-check`）在真实 Cursor 会话中能被主会话通过 `Task(subagent_type=...)` 自动发放，且 `inject-subagent-context.py` hook 能正确注入任务上下文（`<!-- trellis-hook-injected -->` 标记 + prd/jsonl 内容）。

为了给 implement/check 提供可执行的真实改动，本任务附带一个最小代码改动：在 `Trellis/scripts/` 下新增 `smoke_echo.py`，提供一个 `echo_msg(msg: str) -> str` 函数 + CLI 入口。

## Requirements

### R1 — 真实代码改动（供 implement/check 演练）
- R1.1 新增 `Trellis/scripts/smoke_echo.py`，导出 `echo_msg(msg: str) -> str`，返回 `"[smoke] <msg>"`。
- R1.2 提供 `if __name__ == "__main__":` CLI 入口，打印 `echo_msg(sys.argv[1])` 结果。
- R1.3 不修改任何其他文件；不新增依赖。

### R2 — Subagent 派发验证
- R2.1 `trellis-research` subagent 能被派发，且回复中体现已读取注入的 spec 目录树上下文。
- R2.2 在 `start-execution --approved` 后，`trellis-implement` subagent 能被派发，完成 R1 代码改动并自报修改文件清单。
- R2.3 `trellis-check` subagent 能被派发，对 implement 的改动做 spec 对齐检查并自修/报告。

### R3 — Hook 上下文注入验证
- R3.1 每个 subagent 首轮回复或行为中体现已收到 `<!-- trellis-hook-injected -->` 标记后的内容（如能引用 prd.md 的验收标准）。
- R3.2 若 hook 未注入（selected_task 为空 / Windows 路径问题等），subagent 应按 fallback 协议从 `Selected task:` 首行读取并自行加载工件 —— 这一分支也要观察记录。

## Acceptance Criteria

- [ ] `Trellis/scripts/smoke_echo.py` 存在且符合 R1.1 / R1.2
- [ ] `python Trellis/scripts/smoke_echo.py hello` 输出 `[smoke] hello`
- [ ] 三种 subagent 均成功被 `Task(...)` 派发（在观察方会话中可见 subagent 运行记录）
- [ ] 至少一个 subagent 的行为明确体现注入上下文被读取
- [ ] 在 `verify.md` 中记录每个角色的派发结果 + hook 注入是否成功 + 任何 fallback 行为

## Out of Scope

- 不改动 Trellis CLI 源码（`packages/cli/`）
- 不改动 `.cursor/agents/` 或 hook 脚本本身
- 不发布、不推送、不创建 PR
- 不测 Cursor++ BYOK 模型路由（Method 2.5）—— 本次只测"发放 + 上下文注入"，模型继承父会话即可

## Notes

- 本任务故意保持极小，目的是跑通派发链路而非交付功能。
- `task.py` 本机部署版本不含 `generate-dispatch-prompt` 子命令（落后于模板源码），所以派发提示词由主会话手写，hook 仍会自动注入上下文 —— 这正好同时验证 hook-only 路径。
