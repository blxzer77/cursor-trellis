# Research: Claude Code env injection on Windows for hook session identity

## Goal

弄清楚 Claude Code 在 Windows（原生 PowerShell 和 cmd，可能也包含 WSL）上**到底怎么向被 spawn 的子进程注入环境变量**，确定 Trellis 的 SessionStart hook 在 Windows 上要怎么写才能让 `TRELLIS_CONTEXT_ID` 真正进到 `task.py start` 的进程里。

不是写代码、不是发版——只调研，把结论落到 `research/` 让后续 0.5.3 治本方案有根据。

## Background

- Trellis 现有 Mac/Linux 路径：`shared-hooks/session-start.py:_persist_context_key_for_bash` 写一个 bash 脚本（`export TRELLIS_CONTEXT_ID=...`）；Claude Code 通过 `CLAUDE_ENV_FILE` 让 spawned shell 自动 source。
- v12 报告（Windows native PowerShell + Claude Code 2.1.129）：
  - `task.py start` 报 "Cannot set active task without a session identity"
  - AI 内通过 Bash tool 调 `os.environ.get("TRELLIS_CONTEXT_ID")` 返回 `None`
  - taosu 在 Mac 同样上下文返回 `claude_<id>` ✓
- 假设：bash 脚本在 PowerShell 不会被 source，env 进不去——但**这只是猜测，未经验证**。Claude Code 在 Windows 可能有完全不同的 env 注入机制（.ps1 / .cmd / Win32 lpEnvironment / 不注入 / 注入但通过别的渠道）。
- 我们目前不确定的事：
  - Claude Code Windows 是否暴露 `CLAUDE_ENV_FILE` 等价物
  - 它对 hook 端期望什么文件格式
  - SessionStart hook 输出的 `additionalContext` 在 Windows 上是否能拿到 session_id 给 hook 自己用（这部分应该不变，跨平台都是 stdin JSON）
  - hook 怎么把 context_key "导出"给后续 shell 命令

## Open Questions（必须查清）

### Q1 — Claude Code 在 Windows 的子进程 env 注入机制

- Anthropic 官方文档对 hook 端 env / shell 启动 env 在 Windows 的描述是什么？
- 跟 Mac/Linux 的 `CLAUDE_ENV_FILE` 机制对应的 Windows 路径是什么？是不是有 `CLAUDE_ENV_FILE_PS1` / `CLAUDE_ENV_FILE_CMD` / 注册表 / 别的东西？
- 还是说 Claude Code 在 Windows 上**直接把 env 通过 Win32 CreateProcess lpEnvironment 塞进子进程**，不用 source 任何脚本？
- 还是说 Claude Code Windows 根本不向子进程注入 env？

### Q2 — Hook 端在 Windows 应该写什么样的"持久化文件"

- 如果 Claude Code Windows 期望 `.ps1`，文件名 / 路径 / 内容格式是什么？
- 如果是 `.cmd`，同上？
- Trellis 现有 `_persist_context_key_for_bash` 写的 `.sh` 在 Windows 上完全失效是确定的吗？还是 Claude Code 会自动转换？
- 有没有"两份都写、Claude Code 按 OS 选一份"这种通用做法？

### Q3 — 已知公开 issues / PRs

- `github.com/anthropics/claude-code` 上有没有 issues / PRs 讨论 Windows env 注入、hook 在 Windows 不工作、PowerShell 兼容？
- 用关键词：`windows`, `powershell`, `env`, `CLAUDE_ENV_FILE`, `hook`, `session_id`, `SessionStart`
- 状态（开 / 闭 / 已修在哪个版本）和官方回复

### Q4 — 社区其他 hook 项目怎么处理 Windows

- 找 2-3 个 active 的 Claude Code hooks 开源项目（除了 Trellis 自己）
- 它们 Windows 适配怎么做？写 .ps1？走 Win32 API？还是干脆放弃 Windows？
- 有什么 workaround 是社区共识？

### Q5 — Trellis 现有 Windows 适配的盲点

- 看一下 `packages/cli/src/templates/shared-hooks/session-start.py` 全文，找跟 OS 检测有关的代码（`sys.platform`、`os.name`）
- 看 `_persist_context_key_for_bash` 写文件的路径是不是已经 Windows-aware
- 如果 Trellis 已经有部分 Windows 处理，目前缺的是哪一环

## Acceptance Criteria

- [ ] research 文件 `research/claude-code-windows-env-injection.md` 落库，至少回答 Q1-Q5
- [ ] 给出**具体修复路径建议**：在 Windows 上 hook 应该写什么、Trellis 代码改哪里、是否依赖 Claude Code 自身行为
- [ ] 引用至少 3 处官方/社区源（Anthropic 文档、Claude Code GitHub issue、其他 hook 项目代码），不要纯猜测
- [ ] 明确"已找到证据"和"未找到、推断"两类结论分开标注

## Out of Scope

- 实际写代码 / 发 0.5.3 / 改 hook 文件 —— 这次只调研
- v12 单点临时绕过（已有 fallback 补丁可用）—— 不在本任务范围
- macOS / Linux 的 env 注入机制（已知，不需要重新调研）

## Deliverable

`.trellis/tasks/05-06-research-claude-code-env-injection-on-windows-for-hook-session-identity/research/claude-code-windows-env-injection.md`

结构：

```markdown
# Claude Code Windows env injection 研究

## 一句话结论
（Windows 上 Claude Code 用 X 机制注入 env / 不注入 env；Trellis 修法应该是 Y）

## Q1: Claude Code Windows 子进程 env 注入机制
（事实 + 来源链接 + 是否有官方机制）

## Q2: Hook 端持久化文件该写什么格式
（具体格式 + 路径 + Claude Code 怎么消费）

## Q3: 已知公开 issues / PRs
（列表 + 状态 + 关键引用）

## Q4: 其他 hook 项目的 Windows 处理
（2-3 个项目 + 它们的做法）

## Q5: Trellis 现有 Windows 适配盲点
（已有逻辑 + 缺的地方）

## 推荐 0.5.3 修法
（基于以上事实，治本方案 1-2 条 + 临时绕过 1 条）

## 引用来源
- ...
```
