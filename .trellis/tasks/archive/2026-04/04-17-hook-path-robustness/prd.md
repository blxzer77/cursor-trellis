# Hook 路径解析（monorepo / submodule / Windows 兼容）

## 背景

**当前状态（2026-04-17 深度扫描确认）**：8 个平台模板（claude/cursor/qoder/codebuddy/droid/gemini/copilot/codex + kiro agent JSON）**全部**用裸相对路径，无 CWD-robustness 逻辑，无 bootstrap helper：

```json
"command": "{{PYTHON_CMD}} .claude/hooks/inject-subagent-context.py"
```

依赖执行时 CWD 在项目根目录。但实际使用中遇到多个场景 CWD 不在项目根：

### 已观察到的失败场景

#### 场景 1: Claude Code spawn sub-agent 时 CWD 漂移

开发本 session 时真实遇到：

```
PreToolUse:Agent hook error: [python3 .claude/hooks/inject-subagent-context.py]:
python3: can't open file '/path/to/project/packages/cli/.claude/hooks/inject-subagent-context.py':
[Errno 2] No such file or directory
```

CWD 变成了 `packages/cli/`（因为之前用 Bash tool 跑过 `cd packages/cli && pnpm test`），spawn sub-agent 时继承了这个 CWD，导致找不到 hook 脚本。

#### 场景 2: Monorepo 子目录

用户在 monorepo 子目录里用 AI 工具：`cd apps/web && claude`。CWD 会是 `apps/web/`，`.trellis/` 在 monorepo 根，hook 找不到。

#### 场景 3: Git submodule 内部

Trellis 本身有 `docs-site/` submodule。如果 CWD 在 `docs-site/` 里：
- `git rev-parse --show-toplevel` 返回 submodule 的根（`docs-site/`）
- 但 `.trellis/` 在**父 repo** 根（一级往上）
- 任何基于 `.git` 查找的方案都会错

---

## 尝试过且失败的方案

### ❌ 方案 A: `${CLAUDE_PROJECT_DIR:-.}`

```json
"command": "python3 ${CLAUDE_PROJECT_DIR:-.}/.claude/hooks/session-start.py"
```

- ✅ macOS/Linux：`/bin/sh` 支持 `${VAR:-default}`
- ❌ Windows cmd.exe：不认 bash 语法，没有 `:-` fallback 机制
- ❌ 每个平台的 `*_PROJECT_DIR` env var 名字不同，模板没法一次满足所有

### ❌ 方案 B: `"$(git rev-parse --show-toplevel)"`

```json
"command": "python3 \"$(git rev-parse --show-toplevel)\"/.claude/hooks/session-start.py"
```

- ✅ 跨平台（git 在每个平台都有）
- ❌ **Submodule 致命问题**：返回 submodule 的根而不是父 repo 根
- ❌ Windows cmd 对 `$()` 命令替换支持有限

### ❌ 方案 C: Python 脚本内 `os.chdir()`

```python
# session-start.py 开头
os.chdir(find_trellis_root())
```

- ❌ **shell 找不到 .py 文件，Python 根本没启动就失败了**
- 这个方案只能解决 Python 内部的路径问题，不能解决 shell 找脚本本身的路径问题

---

## 可能的方向（需要调研和实验）

### 选项 1: 向上查找 `.trellis/` 的 shell 命令

```json
"command": "sh -c 'd=$(pwd); while [ \"$d\" != \"/\" ] && [ ! -d \"$d/.trellis\" ]; do d=$(dirname \"$d\"); done; python3 \"$d/.claude/hooks/session-start.py\"'"
```

- ✅ 跨平台逻辑（`.trellis/` 是真正的项目根标志）
- ✅ Submodule 安全（不依赖 `.git`）
- ⚠️ shell 命令写在 JSON 里要 escape，很丑
- ⚠️ Windows cmd 和 sh 语法不同，可能需要各平台分开写

### 选项 2: 平台 env var 优先 + Python bootstrap 回退

分两种命令模板：

```json
{
  "bash": "python3 ${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/hooks/session-start.py",
  "powershell": "python ${env:CLAUDE_PROJECT_DIR}/.claude/hooks/session-start.py"
}
```

- ⚠️ 只适合支持 bash/powershell 分离的平台（Copilot 是，其他大部分不是）
- ⚠️ Env var 名字每平台不同，模板要生成对应的

### 选项 3: 统一把 hooks 放到 `.trellis/hooks/`

所有平台 settings.json 都指向同一位置：

```json
"command": "python3 .trellis/hooks/session-start.py"
```

- ✅ 统一路径，方便维护
- ❌ 没解决 CWD 问题（.trellis 也是相对路径）
- ✅ 但脚本内可以 `os.chdir(find_trellis_root())` 修复后续路径（因为脚本已启动了）
- ⚠️ 还是需要解决 **shell 找到脚本本身** 的问题

### 选项 4: Python bootstrap wrapper + 脚本参数

在每个平台的 config dir 里放一个极小的 bootstrap 脚本：

```python
# .claude/hooks/_bootstrap.py（每个平台都有一份一样的）
import os, sys, subprocess
d = os.getcwd()
while d != "/" and not os.path.isdir(os.path.join(d, ".trellis")):
    d = os.path.dirname(d)
script = sys.argv[1]  # e.g. "session-start"
subprocess.run([sys.executable, os.path.join(d, ".trellis/hooks", f"{script}.py")],
               stdin=sys.stdin)
```

然后 settings.json 里：

```json
"command": "python3 .claude/hooks/_bootstrap.py session-start"
```

- ⚠️ 还是需要 shell 能找到 `_bootstrap.py`（同样的问题）
- 如果连 `_bootstrap.py` 都找不到，就需要 **绝对路径 + init 时解析**

### 选项 5: init 时写入绝对路径

`trellis init` 时把项目绝对路径写进 settings.json：

```json
"command": "python3 /Users/xxx/project/.claude/hooks/session-start.py"
```

- ✅ 绝对路径，CWD 怎么变都不影响
- ❌ 项目搬迁 / 重命名会失效
- ❌ `trellis update` 要能检测并重写
- ⚠️ 用户 commit settings.json 到 git 后，别的开发者拉下来路径就错了（致命缺陷）

---

## 任务

### 1. 先做调研 / 决策

- [ ] 调研各 AI 工具实际 spawn hook 的 shell 和 CWD 行为
  - Claude Code 实际用哪个 shell（sh / bash / zsh / cmd）？
  - 是否总是继承当前 Bash tool 的 CWD？
  - 有没有办法强制 CWD = 项目根？
- [ ] 调研各平台的 `*_PROJECT_DIR` env var 的可用性
- [ ] 在一个专门的测试项目里，分别测试 4 种失败场景是否真的发生

### 2. 选方案并实现

- [ ] 基于调研结果选方案（选项 1-5 之一或组合）
- [ ] 更新 8 个平台的 settings.json / hooks.json
- [ ] 如果选项 4，实现 bootstrap 脚本
- [ ] Windows 兼容（cmd.exe / PowerShell）

### 3. 验证三种 CWD 场景

创建一个 Trellis 项目，手动测试：

- [ ] 场景 1：CWD = 项目根 → 正常工作
- [ ] 场景 2：CWD = `packages/cli/` → 正常工作
- [ ] 场景 3：CWD = 子目录（非 submodule）→ 正常工作
- [ ] 场景 4：CWD = submodule 内部 → 正常工作
- [ ] 场景 5：Windows cmd.exe → 正常工作
- [ ] 场景 6：Windows PowerShell → 正常工作

### 4. 文档

- [ ] 在 `.trellis/spec/cli/backend/platform-integration.md` 加一节 "Hook Path Resolution"
- [ ] 在 README / changelog 注明（如果有 breaking change）

---

## 优先级

🟢 **P3** — 不阻塞 v0.5.0-beta 发布（大部分正常使用下 CWD 是对的）。但用户报告会出，发布前后尽快处理。

可以延到 v0.5.0 rc 或 stable 前。

## 风险

- 方案选错：开发后发现某种场景仍失败 → 需要 re-design
- Windows 兼容：开发环境没有 Windows，只能靠用户反馈验证
- 向后兼容：现有项目的 settings.json 会被 update 重写，如果用户自定义过会被覆盖

## 父 Task
`.trellis/tasks/04-16-skill-first-refactor`
