# Subagent 与 worktree

[English](subagents.md) | 简体中文

Subagent 是共享 Pactile Task 契约之上的宿主派发表面，不是无限 Agent 池，也不创建第二套 canonical workflow。宿主可以提供隔离上下文或 worktree；Parent 仍拥有集成权，Kernel 仍拥有持久状态转换权。

## 安全派发

1. 选择或创建带有限写集的 Task。
2. 生成 CLI dispatch prompt，让 child 收到 PRD、design、实现契约与 Evidence 要求。
3. Child 只能报告 `working`、`review` 或 `blocked`，不能自行声明 Parent 集成。
4. 需要独立性时，在新鲜上下文中审查 change set 与 Evidence。
5. Parent 一次只集成一个已审阅 ref，并记录决定。

Cursor 通常提供 `.cursor/agents/` 与 Task subagent；Codex 可能使用自己的项目工具或普通 task conversation。即使 UI 与上下文注入不同，共享契约仍相同。Hook 只是尽力而为；CLI dispatch prompt 与 `.pactile/workflow.md` 是可靠回退。

不要要求 subagent 提交、发布、修改远程或扩大写集，除非显式变更 Task 契约。
