# Fix: Sub-agent context injection fallback + non-blocking task.py start

## Goal

修两个互相关联的失败模式，发 0.5.3 hotfix：

1. **Class-1 平台 sub-agent context 注入单点失败**：claude / cursor / opencode / kiro / codebuddy / droid 的 sub-agent 完全依赖 hook push 注入 jsonl，hook 一旦不工作（Windows / `--continue` resume / 企业 fork / hook 禁用）sub-agent 就丢 context、隐式信任 hook 一定触发。Anthropic 自己的 PreToolUse hook 在 Windows 上至 v2.1.119 仍 silent skip（issue #53254 OPEN）。
2. **Main session `task.py start` 硬卡死**：当前 `task.py:93-99` 拿不到 `TRELLIS_CONTEXT_ID` 直接 `return 1`，AI 卡在这里"强行"绕过工作。Windows + Claude Code 用户必撞。

## Background

调研产物（已归档到 `archive/2026-05/05-06-research-...`）：

- `research/claude-code-windows-env-injection.md` — main session env 注入历史 + 6 类失败模式 + 28 处引用
- `research/subagent-dispatch-and-context-injection.md` — class-1 sub-agent 注入机制 + 5 个平台逐个对比 + Windows 失败矩阵

关键事实：

- Class-1 平台用 `inject-subagent-context.py` 在 PreToolUse 改 `updatedInput.prompt` 把 jsonl 内容塞进 sub-agent 系统消息
- 每个平台 sub-agent 定义文件（`.claude/agents/trellis-implement.md` 等）**完全没有 fallback 指引**，假设 hook 一定触发
- Class-2 平台（codex / copilot / gemini / qoder）通过 `buildPullBasedPrelude()` 让 sub-agent 自己拉取，已经稳定运行
- OpenCode 走 JS plugin（`tool.execute.before`）不走 stdin/PTY，是 Trellis 自己的 Windows-safe 范例

## Requirements

### A. Sub-agent 端：marker-based hook fallback

**A.1 Hook 注入加 marker**

`packages/cli/src/templates/shared-hooks/inject-subagent-context.py` 在成功注入 prd.md / jsonl 内容时，在内容头部加一行 sentinel marker：

```
<!-- trellis-hook-injected -->
<implement-context>
...prd.md / implement.jsonl 内容...
</implement-context>
```

或类似稳定 marker 格式，要求：
- AI 可识别（不可被 sub-agent 误删 / 误改）
- 跨平台一致（class-1 所有平台 hook 都用同一个 marker）
- 简短（不浪费 token）

**A.2 Sub-agent 定义文件加条件 fallback**

每个 class-1 平台的 trellis-implement / trellis-check 定义文件（**不动 trellis-research**）顶部加一段条件指引：

```
Look for the `<!-- trellis-hook-injected -->` marker in your input.

- If present: spec / prd / research files have been auto-loaded above. Proceed with the implementation/check work directly.
- If absent: hook didn't inject (Windows env failure, --continue path, fork distribution, or hook disabled). Find the active task path from your dispatch prompt's first line `Active task: <path>`, then Read `<task-path>/prd.md` and the spec files listed in `<task-path>/{implement,check}.jsonl` yourself before doing the work.
```

涉及平台 + 文件：

- claude: `.claude/agents/trellis-implement.md` + `trellis-check.md`
- cursor: `.cursor/agents/trellis-implement.md` + `trellis-check.md`
- opencode: agent 定义（具体路径待 implement agent 查）
- kiro: agent JSON 文件（不是 markdown，需要单独 helper 处理）
- codebuddy: 同 cursor 风格
- droid: 同 cursor 风格

**A.3 Workflow 扩展 dispatch 协议**

`.trellis/workflow.md` 现在 `Sub-agent dispatch protocol` 只对 class-2 平台强制 `Active task: <path>` 第一行，扩到所有 sub-agent dispatch（**research 除外**）—— class-1 hook 工作时这行被忽略，hook 失败时这行救命。

### B. Main session：`task.py start` 不卡死

**B.1 `task.py start` 改非阻塞**

`packages/cli/src/templates/trellis/scripts/task.py:93-99` 现在的硬错误改成：

```python
context_key = resolve_context_key()
if context_key:
    active = set_active_task(task_dir, repo_root)
    # ... 现有逻辑
else:
    # Degraded mode: no session identity → no per-session pointer
    # Cause: hook didn't inject TRELLIS_CONTEXT_ID (Windows + Claude Code, 
    # --continue path, fork distribution, etc.). AI continues based on
    # conversation context.
    print(colored(
        "ℹ Session identity not available; active-task pointer not persisted "
        "this session. AI continues based on conversation context. "
        "(Windows + Claude Code? See troubleshooting docs.)",
        Colors.YELLOW,
    ))
    # Still flip status: planning → in_progress
    task_json_path = full_path / FILE_TASK_JSON
    if task_json_path.is_file():
        data = read_json(task_json_path)
        if data and data.get("status") == "planning":
            data["status"] = "in_progress"
            write_json(task_json_path, data)
            print(colored("✓ Status: planning → in_progress", Colors.GREEN))
    return 0
```

关键行为：
- 拿不到 context_key → 警告但 return 0（不阻塞 AI 流程）
- 仍然翻 task.json.status: planning → in_progress（让后续 phase 推进）
- 不写 session pointer（degraded mode）

**B.2 SessionStart hook 也别 noisy fail**

`packages/cli/src/templates/shared-hooks/session-start.py:184-201` 的 `_persist_context_key_for_bash`：拿不到 `CLAUDE_ENV_FILE` 或 context_key → 静默跳过（保持现状），但确保 hook 整体 exit 0 继续注入其他内容（workflow / spec 索引等仍要正常）。

### C. （可选附带）docs-site troubleshooting

如果 implement agent 时间允许，加一篇 `docs-site/troubleshooting/windows-claude-code.mdx`（中英）：
- Windows + Claude Code 历史坑（v2.1.111 / 53254 等）
- 怎么判断进了 degraded mode
- 怎么手动 set TRELLIS_CONTEXT_ID
- 最低版本要求

如果 scope 紧，C 可以放 0.5.4。

## Acceptance Criteria

- [ ] **A.1 marker**：`inject-subagent-context.py` 注入的内容头部含稳定 marker（关键词如 `trellis-hook-injected`），现有 push-based context 注入不破坏
- [ ] **A.2 sub-agent 文件**：6 个平台的 trellis-implement / trellis-check 定义文件（共 ~12 个文件 + Kiro JSON 单独 helper）顶部都有 conditional fallback 指引
- [ ] **A.3 workflow.md**：dispatch protocol 段落把 class-2 限定改成"all sub-agent except trellis-research"
- [ ] **B.1 task.py start**：拿不到 context_key 时打 INFO + return 0 + 仍翻 status；现有"有 context_key"路径完全不变
- [ ] **B.2 hook**：SessionStart hook 在 env 失败时静默跳过 + exit 0
- [ ] vitest regression test：覆盖（1）`task.py start` 在 env 缺失时 return 0；（2）每个 class-1 sub-agent 文件含 marker 检查 + fallback 指引
- [ ] `pnpm test` / `pnpm lint` 全绿
- [ ] **不要**做 trellis-research 的 fallback（它跟 task 解耦）

## Definition of Done

- 所有 A.x 和 B.x 实施完
- 测试覆盖
- 0.5.3 manifest + docs-site changelog 中英
- feat/v0.5（或 main 直接 cherry-pick）→ pnpm release → 0.5.3 上 npm latest
- main 同步回 feat/v0.6.0-beta

## Out of Scope

- 治本 Anthropic upstream PreToolUse hook bug —— 是 Anthropic 的事
- pull-prelude 改用 `buildPullBasedPrelude()` 函数复用 —— 本次直接在 sub-agent 文件硬写条件文本，复用是后续优化
- trellis-research sub-agent 改 fallback —— research 跟 task 解耦，不动
- 多窗口隔离在 degraded mode 下的恢复 —— 本次接受 degraded mode 下没多窗口隔离
- 改 OpenCode（JS plugin 已经 Windows-safe，不需要修）
- `task.py current` / breadcrumb hook 在 degraded mode 下的行为优化 —— 本次只让它们"返回空 / 不注入"，不报错就行

## Technical Notes

### 涉及文件清单（implement agent 起点）

**Hook**：
- `packages/cli/src/templates/shared-hooks/inject-subagent-context.py` — 加 marker
- `packages/cli/src/templates/shared-hooks/session-start.py:184-201` — 确认 silent skip on env fail
- `packages/cli/src/templates/trellis/scripts/task.py:93-99` — 改非阻塞

**Sub-agent 定义文件**：implement agent 用 grep 找 `trellis-implement.md` / `trellis-check.md` 在 `packages/cli/src/templates/{claude,cursor,opencode,kiro,codebuddy,droid}/agents/` 目录下的位置；Kiro 是 JSON。

**Workflow**：
- `packages/cli/src/templates/trellis/workflow.md` — 改 dispatch protocol 段

**测试**：
- `packages/cli/test/regression.test.ts` 加 describe block 覆盖 marker / fallback 文本 / task.py 非阻塞行为

### Marker 格式建议（不强制）

`<!-- trellis-hook-injected -->` 这种 HTML 注释好处：
- 在 Markdown / 系统消息里都能保留
- AI 不会误解为内容
- grep 友好
- 长度短（24 字符）

implement agent 可优化措辞，但 marker 字符串要在测试里硬编码做断言，所以一旦定下来不要随便改。

### 与已发版本关系

- 本次基于 `main` 的 0.5.2（dd73642 → 5ad1e21）
- feat/v0.5 分支：上次 0.5.2 已经合到 main 后没特别用，本次重新从 main checkout `feat/v0.5` 干（同样的 hotfix 节奏）
- 发版后同步回 feat/v0.6.0-beta

### Research 引用

- `archive/2026-05/05-06-research-claude-code-env-injection-on-windows-for-hook-session-identity/research/claude-code-windows-env-injection.md`
- `archive/2026-05/05-06-research-claude-code-env-injection-on-windows-for-hook-session-identity/research/subagent-dispatch-and-context-injection.md`

implement agent 必读 subagent-dispatch-and-context-injection.md 的 Q5（fallback 可行性）、Q6（marker / anchor 设计建议）。
