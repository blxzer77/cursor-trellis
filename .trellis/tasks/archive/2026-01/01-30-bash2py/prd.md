# Shell to Python Migration - Scripts Refactor

## Overview

将 `.trellis/scripts/` 下的 19 个 shell 脚本 1:1 迁移为 Python 脚本，保持相同的逻辑和接口。

## Motivation

- Python 比 shell 更易于维护和调试
- 更好的错误处理和类型安全
- 跨平台兼容性更好
- 便于未来扩展和重构

## Changes Made

### 1. Directory Structure

**Before:**
```
.trellis/scripts/
├── common/           # Shell utilities
├── multi-agent/      # Shell multi-agent scripts
└── *.sh              # Main shell scripts
```

**After:**
```
.trellis/scripts/
├── __init__.py
├── common/           # Python utilities
│   ├── __init__.py
│   ├── paths.py
│   ├── developer.py
│   ├── git_context.py
│   ├── task_queue.py
│   ├── task_utils.py
│   ├── phase.py
│   ├── worktree.py
│   └── registry.py
├── multi_agent/      # Python multi-agent scripts
│   ├── __init__.py
│   ├── start.py
│   ├── plan.py
│   ├── status.py
│   ├── create_pr.py
│   └── cleanup.py
├── get_developer.py
├── init_developer.py
├── get_context.py
├── task.py
├── add_session.py
└── create_bootstrap.py

.trellis/scripts-shell-archive/  # Archived shell scripts
├── common/
├── multi-agent/
└── *.sh
```

### 2. File Mapping

| Shell Script | Python Script |
|-------------|---------------|
| `common/paths.sh` | `common/paths.py` |
| `common/developer.sh` | `common/developer.py` |
| `common/git-context.sh` | `common/git_context.py` |
| `common/task-queue.sh` | `common/task_queue.py` |
| `common/task-utils.sh` | `common/task_utils.py` |
| `common/phase.sh` | `common/phase.py` |
| `common/worktree.sh` | `common/worktree.py` |
| `common/registry.sh` | `common/registry.py` |
| `multi-agent/start.sh` | `multi_agent/start.py` |
| `multi-agent/plan.sh` | `multi_agent/plan.py` |
| `multi-agent/status.sh` | `multi_agent/status.py` |
| `multi-agent/create-pr.sh` | `multi_agent/create_pr.py` |
| `multi-agent/cleanup.sh` | `multi_agent/cleanup.py` |
| `get-developer.sh` | `get_developer.py` |
| `init-developer.sh` | `init_developer.py` |
| `get-context.sh` | `get_context.py` |
| `task.sh` | `task.py` |
| `add-session.sh` | `add_session.py` |
| `create-bootstrap.sh` | `create_bootstrap.py` |

### 3. Template System Updates

Updated files:
- `src/templates/trellis/index.ts` - Export Python scripts instead of shell
- `src/templates/trellis/scripts/` - Now contains Python scripts only
- `src/templates/trellis/scripts-shell-archive/` - Archived shell scripts
- `src/templates/extract.ts` - Added `.py` file permission handling
- `src/commands/update.ts` - Updated imports and file mappings

### 4. .gitignore Updates

Added to `.trellis/.gitignore`:
```
# Python cache
**/__pycache__/
**/*.pyc
```

## Technical Details

- Python 3.10+ required (uses `str | None` type hints)
- Uses only standard library (argparse, json, subprocess, pathlib)
- Simple YAML parsing without external dependencies
- All scripts have executable permissions (755)

## Testing

Verified in `testDir/demo1/`:
- `get_developer.py` ✓
- `get_context.py` ✓
- `task.py create/list/start/finish/archive` ✓
- `multi_agent/status.py` ✓
- `multi_agent/cleanup.py` ✓

## Backward Compatibility

- Original shell scripts archived in `scripts-shell-archive/`
- All functionality preserved with identical interfaces
- `trellis init` now creates Python-only scripts directory

### 5. Documentation Updates

Updated all templates and documentation to reference Python scripts instead of shell:

**Trellis Templates:**
- `src/templates/trellis/workflow.md` - All script references updated to Python

**Claude Code Templates:**
- `src/templates/claude/hooks/session-start.py` - Script execution updated for `.py` files
- `src/templates/claude/agents/dispatch.md` - create-pr.py reference
- `src/templates/claude/agents/plan.md` - task.py and multi_agent references
- `src/templates/claude/commands/trellis/parallel.md` - All script references
- `src/templates/claude/commands/trellis/record-session.md` - All script references
- `src/templates/claude/commands/trellis/start.md` - All script references
- `src/templates/claude/commands/trellis/onboard.md` - All script references

**Cursor Templates:**
- `src/templates/cursor/commands/trellis-start.md` - All script references
- `src/templates/cursor/commands/trellis-record-session.md` - All script references
- `src/templates/cursor/commands/trellis-onboard.md` - All script references

**Trellis Project's Own Files:**
- `.trellis/workflow.md` - All script references updated to Python

### 6. Cross-Platform Agent Launcher

**Before (Shell-based):**
```bash
# start.sh 生成临时 shell 脚本
cat > "${WORKTREE_PATH}/.agent-runner.sh" << 'EOF'
#!/bin/bash
claude -p --agent dispatch --session-id "xxx" ...
EOF
nohup ./agent-runner.sh > .agent-log 2>&1 &
```

**After (Python subprocess):**
```python
# start.py 直接使用 subprocess.Popen
session_id = str(uuid.uuid4()).lower()
session_id_file.write_text(session_id)  # 写入 .session-id

claude_cmd = ["claude", "-p", "--agent", "dispatch", "--session-id", session_id, ...]

# 跨平台启动
if sys.platform == "win32":
    popen_kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
else:
    popen_kwargs["start_new_session"] = True

process = subprocess.Popen(claude_cmd, **popen_kwargs)
```

**文件变化:**
| 之前 | 现在 | 说明 |
|------|------|------|
| `.agent-runner.sh` | ❌ 删除 | 不再生成 |
| - | `.session-id` | 新增，存储 UUID 用于追踪会话 |

**gitignore 更新:**
```diff
- .agent-runner.sh
+ .session-id
```

### 7. CLI Init Command Updates

`src/commands/init.ts`:
```diff
- const scriptPath = path.join(cwd, PATHS.SCRIPTS, "init-developer.sh");
- execSync(`bash "${scriptPath}" "${developerName}"`, ...);
+ const scriptPath = path.join(cwd, PATHS.SCRIPTS, "init_developer.py");
+ execSync(`python3 "${scriptPath}" "${developerName}"`, ...);

- const bootstrapScriptPath = path.join(cwd, PATHS.SCRIPTS, "create-bootstrap.sh");
- execSync(`bash "${bootstrapScriptPath}" "${projectType}"`, ...);
+ const bootstrapScriptPath = path.join(cwd, PATHS.SCRIPTS, "create_bootstrap.py");
+ execSync(`python3 "${bootstrapScriptPath}" "${projectType}"`, ...);
```

### 8. Documentation Updates (Final)

**docs/ 目录:**
- `docs/guide.md` - 所有脚本引用更新为 Python
- `docs/guide-zh.md` - 所有脚本引用更新为 Python
- `docs/context-overhead.md` - `get_context.py`
- `docs/context-overhead-zh.md` - `get_context.py`

**Trellis 项目配置:**
- `.claude/settings.local.json` - 权限配置更新
- `.claude/agents/plan.md` - `plan.py` 引用

## Final Testing (demo4)

完整测试通过：

| # | 测试项 | 结果 |
|---|--------|------|
| 1 | `trellis init` | ✅ |
| 2 | `get_developer.py` | ✅ |
| 3 | `get_context.py` | ✅ |
| 4 | `task.py list` | ✅ |
| 5 | `task.py create` | ✅ |
| 6 | `task.py init-context` | ✅ |
| 7 | `task.py add-context` | ✅ |
| 8 | `task.py validate` | ✅ |
| 9 | `task.py list-context` | ✅ |
| 10 | `task.py set-branch` | ✅ |
| 11 | `task.py set-scope` | ✅ |
| 12 | `task.py start` | ✅ |
| 13 | `task.py finish` | ✅ |
| 14 | `task.py archive` | ✅ |
| 15 | `task.py list-archive` | ✅ |
| 16 | `multi_agent/status.py` | ✅ |
| 17 | `multi_agent/plan.py` | ✅ |
| 18 | `multi_agent/cleanup.py` | ✅ |
| 19 | `multi_agent/start.py` | ✅ |
| 20 | `.session-id` 创建 | ✅ |
| 21 | registry.json 更新 | ✅ |
| 22 | Hooks (session-start.py) | ✅ |
| 23 | Hooks (inject-subagent-context.py) | ✅ |
| 24 | Hooks (ralph-loop.py) | ✅ |
| 25 | 无 `.sh` 引用检查 | ✅ |

## Summary

- ✅ 19 个 shell 脚本迁移为 Python
- ✅ 所有模板、文档、配置更新
- ✅ 跨平台兼容 (Windows/macOS/Linux)
- ✅ `.agent-runner.sh` 替换为 `.session-id`
- ✅ Hooks 全部使用 Python
- ✅ demo4 完整测试通过
