# Python 脚本 Windows 兼容性测试

## Goal

为 `src/templates/trellis/scripts/` 下的 Python 脚本引入单元测试，重点覆盖 Windows 兼容性代码路径。在 macOS 开发环境上通过 mock 模拟 Windows 行为，防止历史 Windows bug 回归。

## Background

历史版本中 Windows 相关 bug 占 23 个版本的 26%（beta.2/7/10/11/12/16），全部因为没有测试覆盖，只能靠用户反馈发现：
- `ValueError: I/O operation on closed file` — `TextIOWrapper(sys.stdout.detach())` 调用两次
- `UnicodeEncodeError: 'gbk' codec` — stdout 默认编码非 UTF-8
- 路径分隔符 `\` vs `/` 导致路径解析失败
- `python3` 命令 Windows 上不可用
- subprocess `CREATE_NEW_PROCESS_GROUP` vs `start_new_session`

## Requirements

### 1. 测试基础设施
* 安装 pytest（或用 Python 内置 unittest）
* 创建 `test/python/` 目录（或 `tests/` 在 scripts 下）
* 添加 `pnpm test:py` 脚本

### 2. 纯函数测试（不需要 mock sys.platform）

**`task.py` — `resolve_task_dir()`**：
* Windows 绝对路径 `C:\Users\...\task` — `startswith("/")` 不匹配
* Windows 相对路径 `".trellis\tasks\my-task"` — `"/" in` 不匹配
* 正常 Unix 路径仍然工作

**`cli_adapter.py` — `config_dir` property / `detect_platform()`**：
* 每个平台返回正确的 configDir
* 不支持的平台抛异常
* `get_cli_adapter()` 验证逻辑

**`common/__init__.py` — `_configure_stream()`**：
* 传入 mock stream（有 `reconfigure` 方法），验证调用 `reconfigure(encoding="utf-8")`
* 传入 mock stream（无 `reconfigure`，有 `detach`），验证 fallback 逻辑
* 验证幂等性：调用两次不崩（beta.16 的 bug 根因）

### 3. Mock sys.platform 测试

**subprocess 进程组标志**（`plan.py` / `start.py`）：
* `sys.platform == "win32"` → `creationflags = CREATE_NEW_PROCESS_GROUP`
* `sys.platform == "darwin"` → `start_new_session = True`

**encoding 修复触发条件**：
* `sys.platform == "win32"` → `_configure_stream()` 被调用
* `sys.platform == "darwin"` → 跳过

### 4. 已知 Bug 回归测试

| Bug | 版本 | 测试方式 |
|-----|------|---------|
| `TextIOWrapper(detach())` 调两次崩溃 | beta.16 | mock stream 调两次 `_configure_stream` |
| GBK codec error | beta.10 | mock stream encoding="gbk" |
| `\` 路径不匹配 | beta.12 | 直接传 Windows 路径字符串 |
| `resolve_task_dir` 漏 Windows 绝对路径 | 潜在 | 传 `C:\Users\...` 测试 |

## Out of Scope

* 端到端 Windows 编码测试（需真实 Windows CI）
* 模块级 import 副作用的完整测试（`importlib.reload` 太脆弱）
* `python3` 命令可用性检测（操作系统级别，无法 mock）
* GitHub Actions Windows CI 搭建

## Definition of Done

* pytest 测试通过
* 覆盖 3 个关键纯函数 + 2 个 mock sys.platform 场景 + 4 个回归测试
* `pnpm test:py` 脚本可用
* 不修改生产代码（例外：如果发现 `resolve_task_dir` 路径 bug 可顺手修）
* `pnpm run lint:py` 继续通过

## Technical Notes

### Windows 特有代码分布（7 处 sys.platform 检查）
* `common/__init__.py` — 模块级 encoding 修复（2处：自动执行 + `configure_encoding()` 函数）
* `task.py` / `add_session.py` / `git_context.py` — inline encoding 修复（3处，import 前执行）
* `multi_agent/plan.py` / `multi_agent/start.py` — subprocess flags（2处）

### 已知代码问题
* encoding 修复重复执行（inline + common/__init__.py 各一次）
* inline 修复只管 stdout 不管 stderr
* `task.py` 路径检查硬编码 `/`，Windows `\` 路径会 fallthrough

### 测试策略
* 纯函数直接传参测试（不需要 mock）
* `monkeypatch.setattr("sys.platform", "win32")` 测 Windows 分支
* mock stream 对象测 encoding 逻辑
* `importlib.reload` 不使用（太脆弱）
