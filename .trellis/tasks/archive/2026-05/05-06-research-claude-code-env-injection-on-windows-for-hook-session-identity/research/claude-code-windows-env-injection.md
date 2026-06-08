# Research: Claude Code Env Injection on Windows for Hook Session Identity

- **Query**: 弄清 Claude Code 在 Windows（原生 PowerShell / cmd / Git Bash）上向被 spawn 的子进程注入 env 的真实机制，以决定 Trellis SessionStart hook 在 Windows 上要怎么写才能让 `TRELLIS_CONTEXT_ID` 真正进到 `task.py start` 的进程环境
- **Scope**: mixed (一手：Anthropic docs + claude-code GitHub issues + release notes；二手：Trellis 仓库本地代码)
- **Date**: 2026-05-06
- **Trellis CLI 版本**: 0.5.x；用户报告版本 v12 trace = Claude Code 2.1.129 + Trellis 0.5.0/0.5.1
- **Active task**: `.trellis/tasks/05-06-research-claude-code-env-injection-on-windows-for-hook-session-identity`

---

## 一句话结论（给主 agent）

**Trellis 0.5.0/0.5.1 在 Windows 上不工作的最大嫌疑是「调用语义错误」，不是「Claude Code Windows 不支持」。** Claude Code 自 **v2.1.111**（2026-04-16）起在 Windows 上**已经会 source `CLAUDE_ENV_FILE`**，前提是 Bash 工具走 Git Bash（这是 Windows 默认行为）。Trellis 现在写的是合法的 bash `export` 语法，**理论上应该被 source**。需要主 agent 在 Windows 上做一次精准排查（见末尾「推荐 0.5.3 修法」第 0 步「先验证假设」）。

但在确认前，整个 Windows hook 生态有 **多重已知坑**，Trellis 现在的 `_persist_context_key_for_bash` 没有覆盖：

1. **不能假设有 `CLAUDE_ENV_FILE`**：如果 Trellis 是装成 plugin（不是项目级 hook），在 v2.1.111 之前的版本里 `CLAUDE_ENV_FILE` 根本不会传给 hook（issue #11649）。
2. **PowerShell tool 用户**：当 `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`（Windows 没装 Git Bash 时是默认）时，Bash 工具不存在，PowerShell 不读 bash 语法的 `.sh` 文件，`export X=...` 在 `pwsh` 里就是个错误。
3. **Resume / `/clear` 路径不一致**：fresh start 是好的，`--continue` / `--resume` / `/clear` 在 v2.1.119 仍有 session ID mismatch bug（issue #52774, #24775）。
4. **bash 路径解析**：Native installer + 系统装了 WSL 时，hook 里的 `bash` 会解析到 WSL stub 而不是 Git Bash，整个 hook 卡死（issue #37634）。

---

## Q1 — Claude Code 在 Windows 上的子进程 env 注入机制（最关键）

### 1.1 唯一官方机制：`CLAUDE_ENV_FILE`

来自 docs.anthropic.com/en/docs/claude-code/hooks 和 docs.claude.com/en/docs/claude-code/hooks：

> SessionStart hooks have access to the `CLAUDE_ENV_FILE` environment variable, which provides a file path where you can persist environment variables for subsequent Bash commands. To set individual environment variables, write `export` statements to `CLAUDE_ENV_FILE`. Use append (`>>`) to preserve variables set by other hooks.
>
> Any variables written to this file will be available in all subsequent Bash commands that Claude Code executes during the session.
>
> `CLAUDE_ENV_FILE` is available for SessionStart, **Setup**, **CwdChanged**, and **FileChanged** hooks. Other hook types do not have access to this variable.

env-vars 文档对 `CLAUDE_ENV_FILE` 的定义：

> Path to a shell script whose contents Claude Code runs **before each Bash command in the same shell process**, so exports in the file are visible to the command. Use to persist virtualenv or conda activation across commands. Also populated dynamically by SessionStart, Setup, CwdChanged, and FileChanged hooks.

含义：Claude Code 不是用 Win32 `CreateProcess` 把 env 直接塞进子进程。它的机制是：**Bash 工具在每次 spawn `bash` 时，把 `CLAUDE_ENV_FILE` 的内容作为脚本前置 source 一次**——本质是「shell preamble」，不是「env injection」。

### 1.2 Windows 上的演化时间线

| 版本 / 日期 | Windows 行为 | 来源 |
|---|---|---|
| < v2.1.111 (2026-04-16 之前) | **完全不支持**：源码里有 `if(y$()==="windows")return N("Session environment not yet supported on Windows"),null;` 早 return。Hook 仍然能拿到 `CLAUDE_ENV_FILE` 路径并写文件，但 Claude Code 永远不会 source 它。**静默失败**，没有 stderr 警告。 | issue #45953（seanmartinsmith，repro on 2.1.97/2.1.98）；issue #27987（root cause analysis 反编译 `cn7` 函数）；issue #15840 |
| v2.1.111 (2026-04-16) | Release notes 明文："Windows: `CLAUDE_ENV_FILE` and SessionStart hook environment files now apply (previously a no-op)" | github.com/anthropics/claude-code/releases/tag/v2.1.111；shanraisshan/claude-code-hooks README |
| v2.1.111+ (Git Bash 路径) | Bash 工具走 Git Bash 时，hook 写 `export FOO=bar` 到 `CLAUDE_ENV_FILE`，下一次 Bash 工具调用前会被 source。**Trellis 现在的写法应该工作。** | release notes |
| v2.1.111+ (PowerShell tool) | **未明确文档化**。PowerShell tool 不解析 bash `export` 语法。已知 statusline 在 PowerShell 模式下会触发同一个 "Session environment not yet supported on Windows" 信息（issue #27161），暗示 PowerShell tool 仍然没有等价 sourcing。**Trellis 写 `.sh` 的 export 在 PowerShell tool 模式下肯定不工作。** | issue #27161 |

**关键事实**：Anthropic **没有**为 Windows 引入 `.ps1` / `.cmd` 形态的 `CLAUDE_ENV_FILE`。机制仍是同一个 `.sh` 文件，靠 Git Bash source。如果 Bash 工具不可用（无 Git Bash 或显式启用 PowerShell tool），CLAUDE_ENV_FILE 机制本身就用不上。

### 1.3 Claude Code 主动注入哪些 env？

从 issue #16564 一位 Windows 用户 dump 出来的「hook 进程内可见」env：
```
CLAUDE_AGENT_SDK_VERSION=0.1.75
CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING=true
CLAUDE_CODE_ENTRYPOINT=claude-vscode
CLAUDE_PROJECT_DIR=c:\Users\Luke\Documents\Claude Code\hq
CLAUDECODE=1
```

确认 **没有**：`CLAUDE_SESSION_ID`、`CLAUDE_CODE_SESSION_ID`、`CLAUDE_TRANSCRIPT_PATH` —— 这与 taosu 在 Mac 上的观察一致。Anthropic 官方现在的设计是「session_id 通过 stdin JSON 给 hook，hook 自己决定要不要持久化它」，不导出语义化 session env。

`CLAUDE_PROJECT_DIR` 是 Trellis 现在已经在 fall-back chain 里读的，OK。

### 1.4 `CLAUDE_CODE_GIT_BASH_PATH` / `CLAUDE_CODE_USE_POWERSHELL_TOOL`

文档摘要（docs.claude.com/en/docs/claude-code/tools-reference）：

- 装了 Git for Windows → Bash 工具默认走 Git Bash，`CLAUDE_ENV_FILE` 机制走 source
- 没装 Git for Windows → Bash 工具不存在，PowerShell tool 自动启用
- `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` 显式启用 PowerShell tool（rolling out）
- Hook 自己有独立的 `"shell": "bash" | "powershell"` 字段（**不依赖 `CLAUDE_CODE_USE_POWERSHELL_TOOL`**），spawn 自己的 shell

含义：「hook 用什么 shell 运行」和「Bash 工具用什么 shell」是两件事。

---

## Q2 — Hook 端在 Windows 应该写什么样的「持久化文件」

### 2.1 Trellis 0.5.x 的现状

`packages/cli/src/templates/shared-hooks/session-start.py:184-201`：

```python
def _persist_context_key_for_bash(context_key: str | None) -> None:
    if not context_key:
        return
    env_file = os.environ.get("CLAUDE_ENV_FILE")
    if not env_file:
        return
    try:
        with open(env_file, "a", encoding="utf-8") as handle:
            handle.write(f"export TRELLIS_CONTEXT_ID={shlex.quote(context_key)}\n")
    except OSError:
        pass
```

**评估**（仅描述，不评论）：
- 写的是 bash `export` 语法 ✓ —— 与 Anthropic 文档示例完全一致，与 Git Bash 兼容
- `shlex.quote` 是 POSIX 风格 —— 在 Mac/Linux/Git Bash 都正确
- 用 `>>` append（`open(..., "a")`）—— 与文档建议一致
- **没有任何 OS 分支**：当前所有平台都走同一个分支
- **没有任何 PowerShell 兼容**：Windows 用户如果走 PowerShell tool（无 Git Bash 或显式启用），这个 `export` 行会被忽略

### 2.2 如果要支持 PowerShell tool 模式

Claude Code 的 `CLAUDE_ENV_FILE` 仅按 `.sh` source；目前 **没有** PowerShell 等价物（Anthropic 官方至今未实现）。Trellis 自己生成 `.ps1` 是没用的——Claude Code 不会 source 它。

**唯一的「PowerShell 模式 fallback」是绕开 `CLAUDE_ENV_FILE`**，参考 issue #45953 作者的官方 workaround：

> use pid file resolution or write to a known file on disk instead of relying on env vars.

也就是：Trellis 写一个固定路径文件（例如 `.trellis/.runtime/sessions/<key>.json` 或 `.trellis/.runtime/last-session.json`），让 `task.py` 自己去读，不依赖 env 注入。事实上 Trellis 已经有 `.trellis/.runtime/sessions/` —— 见 `trellis/scripts/common/active_task.py:480-502` 的 ActiveTask resolver。

### 2.3 `_persist_context_key_for_bash` 在 Windows 上的有效性矩阵

| Windows 场景 | Bash 工具？ | 当前 Trellis 行为 | 是否能让 `task.py start` 拿到 `TRELLIS_CONTEXT_ID` |
|---|---|---|---|
| Git Bash 装了 + Claude Code ≥ 2.1.111 | 是（Git Bash） | 写 `.sh` export | **应该 ✓**（待 v12 验证） |
| Git Bash 装了 + Claude Code < 2.1.111 | 是 | 写 `.sh` export | **✗** sourcing 被 windows guard 跳过 |
| 没装 Git Bash + 任意版本 | 否（PowerShell tool） | 写 `.sh` export | **✗** PowerShell 不读 .sh 语法 |
| 显式 `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` | 否 | 写 `.sh` export | **✗** 同上 |
| `--continue` / `--resume` / `/clear`，任意版本 | 是 | 写 `.sh` export | **可能 ✗**（issue #52774, #24775，session ID mismatch on resume，至 v2.1.119 仍未修） |

v12 报告的 Trellis 0.5.0/0.5.1 + Claude Code 2.1.129 + 原生 PowerShell 启动场景，落在第 1 行（Git Bash 装了走 Bash 工具）或第 3/4 行（没装 / 启用了 PowerShell tool），需要 v12 在 Windows 上 dump 以下信息才能定位：
- `where.exe bash` 输出
- `$env:CLAUDE_ENV_FILE`
- `$env:CLAUDE_CODE_USE_POWERSHELL_TOOL`
- `$env:CLAUDE_CODE_GIT_BASH_PATH`
- 在 Bash 工具调一次 `env | grep -i 'claude\|trellis'`
- 在 Bash 工具调一次 `cat $CLAUDE_ENV_FILE` 看是否真的有 `export TRELLIS_CONTEXT_ID=...`

---

## Q3 — Anthropic claude-code 仓库相关 issues / PRs

只列与 Windows hook 环境注入直接相关的（按相关度排序）：

| # | 标题 | 状态 | 关键信息 |
|---|---|---|---|
| **#45953** | CLAUDE_ENV_FILE not supported on Windows - not documented | open (2026-04-09) | 一手反编译证据：源码里有 windows 早 return；明确说静默失败；作者建议的 workaround 是「pid file resolution」绕开 env 机制 |
| **#27987** | CLAUDE_ENV_FILE written but not sourced for Bash tool calls on Windows | closed (2026-02-23 → fixed in **v2.1.111**) | 给出 root cause（`cn7`/`E1()==="windows"` 早 return）+ 建议「Git Bash 时移除 guard」+ 标注修复版本 |
| **#27161** | Statusline not working on Windows - "Session environment not yet supported on Windows" | closed (duplicate of #27057) | 同一个 windows guard 也影响 statusline |
| **#52774** | CLAUDE_ENV_FILE variables not available in Bash on resumed sessions | open (2026-04-24, repro on **v2.1.119**, post-fix) | resume / continue 路径在修复后仍坏 |
| **#24775** | CLAUDE_ENV_FILE: session ID mismatch on resume causes env files to be written to wrong directory | open (2026-02-10) | hook 写到 startup session id 目录，loader 从 resumed session id 目录读，对不上 |
| **#15840** | CLAUDE_ENV_FILE not provided to SessionStart hooks (macOS) | closed (not_planned) | macOS 上 plugin 安装的 hook 拿不到 `CLAUDE_ENV_FILE` |
| **#11649** | SessionStart hook doesn't receive CLAUDE_ENV_FILE when installed by a plugin | merged fix | 同上，plugin 路径不传 env_file，已修 |
| **#37634** | Native installer on Windows: bash hooks resolve to WSL bash.exe instead of Git Bash, causing TUI hang | open (v2.1.81) | hook 里写 `bash xxx.sh` 在 native installer 下解析到 `C:\Windows\System32\bash.exe`（WSL stub）而不是 Git Bash，导致 hook 直接卡死整个 TUI |
| **#23556** | Windows: Hook .sh auto-detection resolves to WSL bash.exe instead of Git Bash when WSL is installed | open | 同类，自动 `.sh` detection 也踩 WSL stub 坑 |
| **#25399** | Windows: Plugin hook ${CLAUDE_PLUGIN_ROOT} expansion strips backslashes | open | bash 把反斜杠当 escape sequence 吃掉，路径报 `No such file or directory` |
| **#16152** | Windows: Hooks fail when user path contains spaces | open | 未加引号的 `${CLAUDE_PLUGIN_ROOT}` 在带空格的用户名下被 word-split |
| **#10450** | No hook is working on Windows (VSCode plugin) | open | hook 触发但 stdin 不传 |
| **#17424** | PreToolUse hooks receive empty stdin on Windows | closed (duplicate of #10450) | 同上 |
| **#37024** | SessionStart hooks not firing on Windows (startup or /new) | open | duplicate of #10373，fresh session 上 SessionStart 不触发的核心 bug |
| **#46601** | Stop hook does not receive stdin on Windows (PowerShell 5.1 + pwsh 7) | open | PowerShell hook 还有 cwd 字段反斜杠不 escape 导致 JSON 解析失败、CP932 vs UTF-8 编码问题、hook 路径被吃掉反斜杠等多个二级 bug |
| **#32930** | Hooks always executed via `/usr/bin/bash` on Windows, ignoring `shell` setting | open | 即使配了 `"shell": "powershell.exe"` 也还是被强制 bash 包，每次 hook 都弹 bash 窗 |
| **#23105 / #23747** | SessionStart hooks break keyboard input / hang indefinitely on Windows | duplicates | 早期 bug，已不再普遍但说明 SessionStart 在 Windows 上历史脆弱 |
| **#13735** | Support persistent environment variables across Bash calls (Linux-only workaround: shell-snapshots/snapshot-*.sh) | open | 给出 Linux-only 备用 hack：往 `~/.claude/shell-snapshots/snapshot-*.sh` append；与 `CLAUDE_ENV_FILE` 同样依赖 Bash 工具 |

**重要观察**：
- "session env not supported on Windows" 这个 windows guard 是历史上至少 5 个 issue 的根因（#45953, #27987, #27161, #15840, #14433）
- v2.1.111 release notes 明文修了它，但 **#52774 在 v2.1.119 仍 repro**——只在 fresh session 修了，resume 路径还坏
- 所有 Windows hook 问题都共有一个底层根因：Claude Code 在 Windows 上的 shell 选择 + 路径处理有大量 corner case

### 还没有人报告的细分 case

到 2026-05-06 我没找到「v2.1.111+ Windows + Git Bash + 项目级（非 plugin）SessionStart hook 写 CLAUDE_ENV_FILE 失败」的明确 issue。这意味着 **要么 Trellis 0.5.0 在 v12 那台机器上的失败是非典型场景（PowerShell tool / 没装 Git Bash / 走 resume 路径）**，要么是新的尚未上报的 bug。这正是 v12 验证步骤要回答的问题。

---

## Q4 — 社区其他 Claude Code hook 项目怎么处理 Windows

调研覆盖范围：search GitHub for "claude-code-hooks", "claude-code SessionStart hook"。覆盖度有限，但关键事实清晰。

### 4.1 shanraisshan/claude-code-hooks

URL: https://github.com/shanraisshan/claude-code-hooks  
最近活跃，Python 写的多 hook 集合（含 SessionStart）。

- 跨平台（Mac/Linux/Windows），用 `winsound` 处理 Windows 音效
- HOOKS-README.md 显式标注 **Windows fix (v2.1.111)**：「`CLAUDE_ENV_FILE` and SessionStart hook environment files now apply on Windows (prior to v2.1.111, this was a silent no-op on Windows)」
- 其本身的 SessionStart 没有写 `CLAUDE_ENV_FILE`（只是音效 + 日志），所以不构成 Trellis 的可借鉴对象

### 4.2 anthropics 官方插件 marketplace 的 superpowers / ralph-loop / hookify

- 都用 `.sh` hook + bash spawn
- 在 Windows 上踩遍了 Q3 列出的多个坑：路径反斜杠 strip、空格、WSL stub 拦截
- **没有任何一个走 PowerShell-native 路径**——它们都是「在 Mac/Linux 上写好然后在 Windows 上挣扎」

### 4.3 superpowers 的 polyglot wrapper 模式

issue #23556 注释里提到：superpowers 用 `run-hook.cmd` polyglot 文件做 Windows 适配，cmd 段调用 Git Bash 显式绝对路径，sh 段 pass-through 给原生 bash。这是社区目前找到的「在 Windows 上让 .sh hook 真正可靠运行」的最实用方案，但它仍然依赖 Git Bash 已经安装；纯 PowerShell 用户依然没出路。

### 4.4 总结

**整个 Claude Code hook 社区目前没有「在 PowerShell-only Windows（无 Git Bash）下让 SessionStart hook 真正持久化 env」的 working pattern。** Anthropic 官方的回答是「装 Git Bash」。issue #45953 作者最后接受的 workaround 也是「写文件而不是依赖 env」。

---

## Q5 — Trellis 仓库自己的 Windows 盲点

已用 Read + grep 扫描的代码。

### 5.1 SessionStart hook 主体（`packages/cli/src/templates/shared-hooks/session-start.py`）

- L22-67：`_normalize_windows_shell_path()`：处理 MSYS / Cygwin / WSL `/c/Users/...` `/cygdrive/...` `/mnt/c/...` 路径转换为 `C:\\Users\\...`，挺细致的 ✓
- L78-83：Windows stdout reconfigure 为 UTF-8 ✓（避免 UnicodeEncodeError）
- L184-201：`_persist_context_key_for_bash()` —— **没有任何 OS 分支**，只写 bash export
- L217-244：`run_script()` 通过 `subprocess.run` 给 Python child 设 `env["TRELLIS_CONTEXT_ID"]` —— 这是 hook 内部跑 `get_context.py` 时用的，跟「让后续 Bash 工具看到 env」是两回事
- 整个文件没有 `_persist_context_key_for_powershell()` 或类似分支

### 5.2 OS-aware 代码已有的位置（grep 出来的命中点）

| 文件 | 已做的 Windows 适配 |
|---|---|
| `packages/cli/src/templates/shared-hooks/session-start.py` | 路径标准化 + stdout UTF-8 |
| `packages/cli/src/templates/copilot/hooks/session-start.py` | 同上（独立 copy） |
| `packages/cli/src/templates/codex/hooks/session-start.py` | 同上（独立 copy） |
| `packages/cli/src/templates/shared-hooks/inject-shell-session-context.py:71` | `shlex.split(command, posix=os.name != "nt")` ✓ |
| `packages/cli/src/templates/shared-hooks/inject-subagent-context.py:36` | `if sys.platform.startswith("win"):` 分支（具体内容未看，但有意识） |
| `packages/cli/src/templates/trellis/scripts/common/__init__.py:36,52` | `if sys.platform == "win32":` 分支 |
| `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:268-273` | **关键参考**：opencode 已经实现 `if (hostPlatform === "win32") return $env:TRELLIS_CONTEXT_ID = ...; else export TRELLIS_CONTEXT_ID=...; ` —— 这是 Trellis 自己另一个平台已经做的 PowerShell-aware 注入，与 Claude Code session-start 形成对照 |
| `packages/cli/src/configurators/shared.ts:17,31` | `process.platform !== "win32"` 分支处理 placeholder |

`opencode/plugins/inject-subagent-context.js:268-273` 是直接的 OS-aware shell 注入：

```js
if (hostPlatform === "win32") {
  return `$env:TRELLIS_CONTEXT_ID = ${powershellQuote(contextKey)}; `
}
return `export TRELLIS_CONTEXT_ID=${shellQuote(contextKey)}; `
```

但 opencode 的 inject 是「在每条 Bash 命令前 prepend 注入语句」，机制和 Claude Code 的 `CLAUDE_ENV_FILE`-source 不同——不能照搬 PowerShell 段，因为 Claude Code 不会 source `.ps1`。这只能作为「Trellis 已经知道 Windows 要 PowerShell 语法」的存在性证据。

### 5.3 `task.py start` 的 session identity 解析链

`packages/cli/src/templates/trellis/scripts/common/active_task.py:386-389`：

```python
# `TRELLIS_CONTEXT_ID` is an explicit context-key override used by CLI
# ...
override = _string_value(os.environ.get("TRELLIS_CONTEXT_ID"))
```

`task.py:97`：错误信息显式提到 "or set TRELLIS_CONTEXT_ID before running task.py start."

含义：当前 Trellis 设计就是「单点依赖 `TRELLIS_CONTEXT_ID` env」。如果 Windows 上 `CLAUDE_ENV_FILE` 没生效，整个 task system 就没有 fall-back（除非用户手动 `set TRELLIS_CONTEXT_ID=...`）。这是设计层面的 fragility。

`active_task.py:219` 还有一段注释直接承认这个脆弱点：

> Hooks pass `TRELLIS_CONTEXT_ID` to subprocesses they launch, but an AI-run [shell command from Bash tool can't be reached this way].

### 5.4 Trellis 配置 Claude Code hook 时是否区分 OS

Read 过相关 configurator 代码。`packages/cli/src/configurators/shared.ts:17` 给出 `python` vs `python3` 选择会区分 `process.platform === "win32"`，但这只是 hook 脚本路径，不是 hook 内部行为。

**结论**：Trellis 在「写出 Claude Code hook」这一步**没有**针对 Windows 改 hook 内容，所有平台的 SessionStart hook body 都是同一份。

---

## 推荐 0.5.3 修法

基于以上调研给出 1 个治本 + 1 个保险 + 1 个紧急绕过。

### 步骤 0（先做）— 验证假设：v12 Windows 现状到底卡在哪

主 agent 让 v12 在 Claude Code Windows session 里依次 dump（同一次 session，按顺序）：

```powershell
# 1. shell 选择
where.exe bash
$env:CLAUDE_CODE_USE_POWERSHELL_TOOL
$env:CLAUDE_CODE_GIT_BASH_PATH

# 2. hook 阶段拿到的 env file
$env:CLAUDE_ENV_FILE
```

然后在 Bash 工具（不是 PowerShell）里：

```bash
# 3. hook 是不是真的写了 export
echo "CLAUDE_ENV_FILE=$CLAUDE_ENV_FILE"
ls -la "$CLAUDE_ENV_FILE" 2>&1
cat "$CLAUDE_ENV_FILE" 2>&1
env | grep -E 'CLAUDE|TRELLIS'
```

**判定矩阵**：
- 如果 `$env:CLAUDE_ENV_FILE` 是空 → Trellis hook 那个 `os.environ.get("CLAUDE_ENV_FILE")` 也是 None，根本没写文件（plugin 安装路径或者旧版 CC bug，#11649 类）
- 如果 `cat $CLAUDE_ENV_FILE` 显示 `export TRELLIS_CONTEXT_ID=...` 但 `env | grep TRELLIS` 没有 → sourcing 失败（v2.1.111 的修复在该机器/场景没生效，新 bug）
- 如果 `where.exe bash` 没有 Git Bash 或 PowerShell tool 启用 → Trellis 的 `.sh` export 注定不被 source（已知 limitation，需要 fallback）

### 步骤 1（治本）— 改成「不依赖 `CLAUDE_ENV_FILE` 的文件 fallback」

参考 issue #45953 作者建议的 "pid file resolution" 思路 + Trellis 已有的 `.trellis/.runtime/sessions/<context_key>.json`：

让 `_persist_context_key_for_bash` 同时做 **两件事**：

1. 继续写 `CLAUDE_ENV_FILE`（保留 Mac/Linux/Git Bash 的 env 直通路径，没有变化）
2. **新增**：写一个 `.trellis/.runtime/last-claude-context.json`（或类似命名）包含 `{ "context_key": "...", "platform": "claude", "session_id": "...", "ts": "..." }`，并让 `task.py start` 在 `TRELLIS_CONTEXT_ID` 环境变量缺失时 fallback 读这个文件

具体要点：
- 文件位置必须是 per-cwd/per-project 的，避免多个 Claude Code 窗口互踩（Trellis 已经有这个意识，参考 active_task.py:480-502 的「refuses to guess across windows」）
- 文件需要带时间戳 + 短 TTL（比如 60 秒），过期就忽略，避免老 session 的 stale pointer
- Windows path 用 forward slash 写入，避免 JSON `\c` 之类的 escape 灾难（issue #46601 的 cwd 反斜杠 bug 警告）

这样 Windows 上即使 `CLAUDE_ENV_FILE` sourcing 失败，`task.py start` 仍能从文件里恢复 context_key。Mac/Linux 上 env 路径仍是首选（更快），没回归。

### 步骤 2（保险）— PowerShell tool 模式下的额外 `.ps1`

当探测到 `CLAUDE_CODE_USE_POWERSHELL_TOOL=1` 或 hook 自身在 Windows 且没看到 Git Bash 时，可选地额外写一份同名的 `.ps1` 副本到 `<env_file>.ps1`，内容是 `$env:TRELLIS_CONTEXT_ID = '<key>'`。即使 Anthropic 当前没 source 它，将来若官方扩展机制（issue #45953 推动），就 free 拿到。**短期内不是必需的**，因为步骤 1 的文件 fallback 已经覆盖了这个 case。

### 步骤 3（紧急绕过 — 给 0.5.2 hotfix 备选）— 文档化手动 set

在 `task.py:97` 的错误提示里，针对 Windows 加一行明确指令：

```
For Windows users where CLAUDE_ENV_FILE didn't take effect, run:
    $env:TRELLIS_CONTEXT_ID = '<your-session-key>'
before retrying. See <doc-link> for full troubleshooting.
```

并在 docs-site 加一篇 troubleshooting 文档，引用 anthropic issue #45953 / #27987 / v2.1.111 release notes 说明历史；告诉 Windows 用户最低要求是 Claude Code ≥ 2.1.111 + 装 Git Bash（或者用 步骤 1 的 fallback 文件机制）。

---

## 引用来源

### Anthropic 官方一手

1. **Claude Code Hooks Reference** — https://docs.anthropic.com/en/docs/claude-code/hooks（同 https://docs.claude.com/en/docs/claude-code/hooks）—— `CLAUDE_ENV_FILE` 在 SessionStart/Setup/CwdChanged/FileChanged hook 可用；写 `export X=val` 到该文件 source；文档里的官方 PowerShell hook 例子只用 `Notification` 弹消息框，没演示用 PowerShell 写 env 持久化。
2. **Claude Code Hooks Guide** — https://docs.anthropic.com/en/docs/claude-code/hooks-guide —— direnv 用法演示了「`SessionStart` 写 `>` 到 `$CLAUDE_ENV_FILE`，每条 Bash 命令前自动 source」的 contract。
3. **Claude Code env-vars Reference** — https://code.claude.com/docs/en/env-vars —— `CLAUDE_ENV_FILE` 定义为 "shell script whose contents Claude Code runs before each Bash command in the same shell process"；`CLAUDE_CODE_USE_POWERSHELL_TOOL` 行为说明（Windows 无 Git Bash 时自动启用）；`CLAUDE_CODE_GIT_BASH_PATH` 用于显式指定 Git Bash 路径。
4. **Claude Code Tools Reference** — https://docs.claude.com/en/docs/claude-code/tools-reference —— Bash tool "Environment variables do not persist. An `export` in one command will not be available in the next."；PowerShell tool 限制（Windows 无 sandbox、profiles 不加载）。
5. **Claude Code Setup** — https://docs.anthropic.com/en/docs/claude-code/setup —— 官方 Windows 安装指南：推荐装 Git for Windows，否则 fall back 到 PowerShell；明确 Native Windows 不支持 sandboxing。
6. **Claude Code v2.1.111 Release Notes** — https://github.com/anthropics/claude-code/releases/tag/v2.1.111 —— "Windows: `CLAUDE_ENV_FILE` and SessionStart hook environment files now apply (previously a no-op)"；同时引入 PowerShell tool 渐进 rollout。

### claude-code GitHub issues（一手）

7. **#45953 CLAUDE_ENV_FILE not supported on Windows - not documented** — https://github.com/anthropics/claude-code/issues/45953 —— 反编译 root cause + 官方 workaround：「pid file resolution / write to known file on disk」。
8. **#27987 CLAUDE_ENV_FILE written but not sourced for Bash tool calls on Windows** — https://github.com/anthropics/claude-code/issues/27987 —— 给出修复版本 v2.1.111；指出 Git Bash 是 POSIX shell，sourcing 本就该工作。
9. **#52774 CLAUDE_ENV_FILE variables not available in Bash on resumed sessions** — https://github.com/anthropics/claude-code/issues/52774 —— 修复后 resume 路径仍坏，至 v2.1.119。
10. **#24775 CLAUDE_ENV_FILE: session ID mismatch on resume** — https://github.com/anthropics/claude-code/issues/24775 —— hook 写到 startup session id 目录，loader 从 resumed session id 目录读。
11. **#15840 CLAUDE_ENV_FILE not provided to SessionStart hooks (macOS/plugin)** — https://github.com/anthropics/claude-code/issues/15840 —— plugin-installed hook 拿不到 `CLAUDE_ENV_FILE`。
12. **#11649 SessionStart hook doesn't receive CLAUDE_ENV_FILE when installed by a plugin** — https://github.com/anthropics/claude-code/issues/11649 —— 已修，给出 workaround "$CLAUDE_HOME/session-env/$CLAUDE_SESSION_ID/hook-0.sh"。
13. **#13735 Support persistent environment variables across Bash calls** — https://github.com/anthropics/claude-code/issues/13735 —— Linux-only 备用 hack（`~/.claude/shell-snapshots/snapshot-*.sh`）。
14. **#37634 Native installer Windows: bash hooks resolve to WSL bash.exe** — https://github.com/anthropics/claude-code/issues/37634 —— Windows native installer + WSL stub 让 hook 卡死。
15. **#23556 Hook .sh auto-detection resolves to WSL bash.exe** — https://github.com/anthropics/claude-code/issues/23556 —— 同类 PATH-resolution 坑。
16. **#25399 ${CLAUDE_PLUGIN_ROOT} backslash strip on Windows** — https://github.com/anthropics/claude-code/issues/25399 —— bash escape sequence 吃反斜杠。
17. **#16152 / #38800 Windows hooks fail with spaces in user path** — https://github.com/anthropics/claude-code/issues/16152、https://github.com/anthropics/claude-code/issues/38800 —— word splitting 经典坑。
18. **#10450 No hook is working on Windows (VSCode plugin)** + **#17424 PreToolUse hooks receive empty stdin on Windows** — Windows hook stdin/PTY 历史综合坑。
19. **#37024 SessionStart hooks not firing on Windows** + **#23105 / #23747** — Windows SessionStart 触发不稳定的历史 issue 簇。
20. **#46601 Stop hook does not receive stdin on Windows (PowerShell)** — https://github.com/anthropics/claude-code/issues/46601 —— 暴露 Windows 上 cwd 字段反斜杠 JSON escape bug + CP932 vs UTF-8 编码坑。
21. **#27161 Statusline not working on Windows** — 同一个 windows guard 也影响 statusline，反向佐证 #27987 的 root cause。
22. **#32930 Hooks always executed via /usr/bin/bash on Windows, ignoring `shell` setting** — https://github.com/anthropics/claude-code/issues/32930 —— 强制 bash 包破坏 PowerShell hook 体验。

### 社区项目

23. **shanraisshan/claude-code-hooks** — https://github.com/shanraisshan/claude-code-hooks —— 跨平台 hook 集合（含 SessionStart）；HOOKS-README.md 显式注解 Windows v2.1.111 修复；本身没用 `CLAUDE_ENV_FILE`，借鉴有限。
24. **anthropics/claude-plugins** marketplace 的 superpowers / ralph-loop / hookify —— issue references 显示它们在 Windows 上踩遍多种 .sh hook 路径坑，没有走 PowerShell-native；superpowers 的 `run-hook.cmd` polyglot wrapper 是社区目前最实用的「跨平台 .sh hook」方案。

### Trellis 仓库本地

25. `packages/cli/src/templates/shared-hooks/session-start.py:184-201` —— `_persist_context_key_for_bash` 实现，单分支 `.sh` export。
26. `packages/cli/src/templates/trellis/scripts/common/active_task.py:386-389, 219, 480-502` —— `TRELLIS_CONTEXT_ID` env 读取链 + per-session pointer 设计意图。
27. `packages/cli/src/templates/trellis/scripts/task.py:97` —— "set TRELLIS_CONTEXT_ID before running task.py start" 错误提示。
28. `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:268-273` —— Trellis 已有的 win32/posix shell 分支例子（不同机制，opencode 是 prepend 注入而非 file-source，不能直接复用）。
29. `packages/cli/src/configurators/shared.ts:17,31` —— `python` vs `python3` 选择，已有 `process.platform === "win32"` 区分。

### 缺口（未找到 / 需要进一步验证）

- **没找到** v2.1.111+ Windows + 项目级（非 plugin）SessionStart hook 写 `CLAUDE_ENV_FILE` 的失败 issue。建议主 agent 让 v12 dump 步骤 0 列的诊断信息后再判断是「已知 case 未覆盖」还是「新 bug」。
- **没找到** Anthropic 关于 PowerShell tool 是否会有等价 `CLAUDE_ENV_FILE` 机制的 roadmap/讨论。issue #45953 至 2026-04-09 仍 open 且无官方回复。可以判断短期内 Anthropic 不打算在 PowerShell tool 上引入文件 sourcing，所以 Trellis 的 PowerShell-only Windows fallback 必须是「文件 fallback」而非「等待官方 .ps1 source」。
- **未验证** Trellis 当前的 hook 注册（settings.json hooks 配置部分，由 configurator 写出）在 Windows 上 hook 触发是否本身就稳定（即使 `_persist_context_key_for_bash` 写对了语法，hook 没触发也没用）。这与 #37024（SessionStart 不触发）相关，但需要 v12 实测确认。

---

## 给主 agent 的最简版决策清单

1. **先验证不要瞎修**：让 v12 在 Windows 上跑步骤 0 的诊断命令，把输出塞回这个 task。决定是「Trellis bug」、「Claude Code 新 bug」还是「Windows 环境配置缺 Git Bash」。
2. **如果是「Windows 环境缺 Git Bash」**：补 docs-site troubleshooting 页 + `task.py` 错误提示加一行 PowerShell 手动 set。
3. **如果是「Trellis 没覆盖 PowerShell-only / resume 路径」**：实施步骤 1 的「文件 fallback」治本方案。
4. **0.5.3 PR 范围建议**：步骤 1 + 步骤 3 docs，不动 `_persist_context_key_for_bash` 现有 bash 逻辑（Mac/Linux/Git Bash 路径已经验证可用）。
