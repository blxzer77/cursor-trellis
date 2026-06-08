# tmux Support - 增加 tmux 支持

## Goal

为 multi-agent pipeline 增加 tmux 集成，提供可视化的多 agent 并行运行体验。当前 agent 以后台进程运行，只能通过 `status.py` 和日志文件监控；tmux 可以提供实时的分屏视图。

## What I already know

- 当前 multi-agent 使用 `subprocess.Popen` + `start_new_session=True` 启动后台进程
- Agent 通过 `registry.json` 追踪（PID, worktree_path, task_dir）
- 监控通过 `status.py` 实现（PID 检查 + 日志解析）
- `start.py` 支持 5 个平台：claude, cursor, iflow, opencode, qoder
- 代码中完全没有 tmux 相关实现
- README 中提到过 tmux 作为未来愿景

## Assumptions (temporary)

- tmux 作为可选增强，不是硬依赖
- 用户系统需要预装 tmux
- 主要场景：一个 tmux session 中多个 pane，每个 pane 运行一个 agent

## Open Questions

1. tmux 是启动 agent 的新方式，还是在现有 start.py 上增加 `--tmux` flag？
2. pane 布局策略：自动平铺？还是用户可配置？
3. agent 结束后 pane 行为：保留输出？自动关闭？
4. 与现有 registry.json 的关系：tmux session name 是否也追踪？

## Requirements (evolving)

- [ ] 检测 tmux 是否可用
- [ ] 在 tmux session 中启动 agent（每个 agent 一个 pane）
- [ ] 实时查看 agent 输出
- [ ] 与现有 status.py 兼容

## Acceptance Criteria (evolving)

- [ ] `python3 start.py <task> --tmux` 在 tmux pane 中启动 agent
- [ ] 多个 agent 自动分屏显示
- [ ] 没有 tmux 时优雅降级到现有后台模式

## Definition of Done

- Tests added/updated
- Lint / typecheck / CI green
- Docs/notes updated

## Out of Scope (explicit)

- tmux 配置文件的自动生成
- 非 tmux 的终端复用器（screen, zellij 等）
- GUI 监控面板

## Technical Notes

- 核心文件：`.trellis/scripts/multi_agent/start.py`, `status.py`
- Python `subprocess` 可以用 `tmux send-keys` 或 `tmux new-window` 启动命令
- 需要考虑 tmux session 命名规范（如 `trellis-<task-slug>`）
