# PR #22 合并后同步 iFlow 模板

## Goal

PR #22 (iFlow CLI support by @jsfaint) 合并后，本地同步更新并修复兼容性问题，确保 iFlow 模板与其他平台保持一致。

## Background

PR #22 添加了 iFlow CLI 支持，包含：
- `src/configurators/iflow.ts` - iFlow 配置器
- `src/templates/iflow/` - 完整模板集（agents、commands、hooks、settings）
- CLI 更新支持 `--iflow` 参数

但 PR 基于较早的代码，缺少我们最近的更新：
1. Windows stdout 编码修复（`reconfigure()` 方案）
2. `update-spec.md` 命令更新（Spec vs Guide 区分）
3. 其他可能的模板同步

## Requirements

### 1. 拉取合并后的代码
```bash
git fetch origin
git merge origin/feat/opencode
```

### 2. 修复 iFlow hooks 的 Windows 编码问题

需要更新的文件：
- `src/templates/iflow/hooks/session-start.py`
- `src/templates/iflow/hooks/inject-subagent-context.py`
- `src/templates/iflow/hooks/ralph-loop.py`

当前 PR 中的旧方案（不可靠）：
```python
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
```

需要改为新方案：
```python
# IMPORTANT: Force stdout to use UTF-8 on Windows
# This fixes UnicodeEncodeError when outputting non-ASCII characters
if sys.platform == "win32":
    import io as _io
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    elif hasattr(sys.stdout, "detach"):
        sys.stdout = _io.TextIOWrapper(sys.stdout.detach(), encoding="utf-8", errors="replace")  # type: ignore[union-attr]
```

### 3. 同步 update-spec.md 命令

检查 `src/templates/iflow/commands/trellis/update-spec.md` 是否包含：
- "CRITICAL: Spec vs Guide - Know the Difference" 部分
- 正确的命令格式（iFlow 使用 `/trellis:` 还是其他格式？需确认）

### 4. 检查其他模板同步

对比以下目录，确保内容一致：
- `src/templates/iflow/commands/` vs `src/templates/claude/commands/`
- `src/templates/iflow/agents/` vs `src/templates/claude/agents/`

### 5. 确认 iFlow 命令格式

需要确认 iFlow CLI 的命令格式：
- Claude Code: `/trellis:xxx`
- Cursor: `/trellis-xxx`
- OpenCode: `/trellis:xxx`
- iFlow: `???` (需要确认)

## Acceptance Criteria

- [ ] 代码合并无冲突
- [ ] iFlow hooks 使用新的 `reconfigure()` 编码方案
- [ ] iFlow update-spec.md 包含 Spec vs Guide 区分部分
- [ ] iFlow 模板内容与其他平台保持同步
- [ ] `pnpm lint` 通过
- [ ] `pnpm typecheck` 通过
- [ ] 本地测试 `trellis init --iflow` 正常工作
- [ ] 推送并发版

## Files to Check

```
src/templates/iflow/
├── hooks/
│   ├── session-start.py      # 需要编码修复
│   ├── inject-subagent-context.py  # 需要编码修复
│   └── ralph-loop.py         # 需要编码修复
├── commands/trellis/
│   └── update-spec.md        # 需要同步 Spec vs Guide 内容
├── agents/                   # 检查是否需要同步
└── settings.json             # 检查配置
```

## Notes

- PR 作者 @jsfaint 已同意后续 rebase，我们合并后自行修复是更好的体验
- 修复完成后考虑发版 0.3.0-beta.16
