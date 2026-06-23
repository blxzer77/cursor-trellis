# BYOK 路 B 改造方案 — generalPurpose 注入路径

> 状态：草稿（待 Cursor Native 验证结果决定是否实施）
> 前提：Cursor Native 验证确认 Task enum 也不扩展自定义 subagent types（即非 BYOK 通病）
> 若 Native 验证成功（enum 扩展），本方案不实施，直接用原生 Task(subagent_type=trellis-*)

---

## 核心思路

主会话用 `Task(subagent_type="generalPurpose", prompt="[trellis:implement]\nSelected task: ...")` 派发。改造 `inject-subagent-context.py` hook 识别 prompt 首行的 `[trellis:<role>]` 标记，对 generalPurpose 也按对应角色注入上下文 + 角色指令。

## 派发协议（用户/主会话侧）

主会话派发时，prompt 首行必须是角色标记，第二行起是标准 Trellis 派发内容：

```
[trellis:implement]
Selected task: d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke
Repo root: d:\MyHarness\Trellis

<原始任务描述>
```

三种角色标记：`[trellis:implement]` / `[trellis:check]` / `[trellis:research]`

## hook 改造点（inject-subagent-context.py）

### 1. 解析角色标记（新增函数）

在 `_parse_hook_input` 之后、`AGENTS_ALL` 检查之前，加一层"角色标记解析"：

```python
ROLE_MARKER_PREFIX = "[trellis:"

def _parse_role_marker(prompt: str) -> str | None:
    """从 prompt 首行提取 [trellis:<role>] 标记。"""
    if not prompt:
        return None
    first_line = prompt.split("\n", 1)[0].strip()
    if not first_line.startswith(ROLE_MARKER_PREFIX):
        return None
    # [trellis:implement] → implement
    inner = first_line[len(ROLE_MARKER_PREFIX):]
    if not inner.endswith("]"):
        return None
    role = inner[:-1].strip().lower()
    if role in ("implement", "check", "research"):
        return role
    return None
```

### 2. 改造 main() 的路由逻辑

当前 `main()` 的关键路径（简化）：

```python
subagent_type, original_prompt, tool_input = _parse_hook_input(input_data)
if subagent_type not in AGENTS_ALL:
    sys.exit(0)  # ← generalPurpose 在这里被跳过
```

改造后：

```python
subagent_type, original_prompt, tool_input = _parse_hook_input(input_data)

# 原生路径：trellis-* 直接走（Native API 验证成功的话）
if subagent_type in AGENTS_ALL:
    role = subagent_type.replace("trellis-", "")  # trellis-implement → implement
    # ... 原有逻辑

# BYOK 退化路径：generalPurpose + 角色标记
elif subagent_type == "generalPurpose":
    role = _parse_role_marker(original_prompt)
    if role is None:
        sys.exit(0)  # 普通 generalPurpose 调用，不注入
    # 剥掉角色标记行，得到真实 prompt
    original_prompt = original_prompt.split("\n", 1)[1] if "\n" in original_prompt else ""
    # 走对应角色的注入逻辑（复用现有 build_*_prompt）

else:
    sys.exit(0)
```

### 3. 角色指令增强（关键：弥补 tools 限制丢失）

generalPurpose subagent 不会读 `.cursor/agents/trellis-*.md` 的 frontmatter，所以 tools 列表 / recursion guard / scope limits 都丢了。必须在注入的 prompt 里把这些约束写回去。

改造 `build_implement_prompt` / `build_check_prompt` / `build_research_prompt`，在开头加一个"角色身份与约束"段：

```markdown
## 你的角色身份（BYOK 退化模式）

你是 Trellis {role} agent。由于本环境 Cursor Task 工具不支持自定义 subagent_type，
你以 generalPurpose 身份被派发，但必须严格遵守以下约束（等同 .cursor/agents/trellis-{role}.md frontmatter）：

### 允许的工具（只用这些，不要调用其他）
- {role_tools_list}

### 禁止操作
{role_forbidden_ops}  # 如 implement 的 "不得 git commit/push/merge"

### Recursion Guard
- 不要再 spawn 任何 subagent（包括 generalPurpose / trellis-*）
- 如果需要更多并行工作，报告给主会话而不是自己派发

### Scope 限制
{role_scope_limits}  # 如 research 的 "只能写 {TASK}/research/*.md"
```

各角色的约束内容直接从 `.cursor/agents/trellis-*.md` 提取，写死在 hook 脚本里（或读 agent 文件解析 frontmatter —— 更优雅但实现复杂）。

### 4. 派发提示词模板（供主会话用）

改造后主会话派发词变成：

```
请用 Task 工具派发一个 generalPurpose subagent，prompt 首行必须是角色标记，内容如下（原样传入）：

---
[trellis:implement]
Selected task: d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke
Repo root: d:\MyHarness\Trellis

实现目标：实现 prd.md 中的 R1 需求。

<具体任务...>
---
```

## 跟现状的关系

| 方面 | 现状（退化 generalPurpose） | 路 B 改造后 |
|---|---|---|
| Task enum 接受 | ✅ generalPurpose 能派 | ✅ 不变 |
| hook 注入 | ❌ 跳过（白名单守卫） | ✅ 识别角色标记后注入 |
| 角色约束（tools/recursion/scope） | ❌ 全丢失 | ⚠️ 在 prompt 里约束（Cursor 不强制 tools，但 prompt 约束通常有效） |
| 任务上下文（prd/jsonl） | ❌ 无（走 fallback） | ✅ hook 自动注入 |
| 改动量 | - | 改 `inject-subagent-context.py` + 三个 `build_*_prompt` |

## 实施清单（若决定做）

1. **改 `inject-subagent-context.py`**（部署版 `D:\MyHarness\Trellis\.cursor\hooks\`）：
   - 加 `_parse_role_marker()` 函数
   - 改 `main()` 路由：增加 generalPurpose + 角色标记分支
   - 剥掉角色标记行后传给 `build_*_prompt`

2. **改 `subagent_dispatch.py`**（模板源码 `packages/cli/src/templates/trellis/scripts/common/`）：
   - `build_implement_prompt` / `build_check_prompt` / `build_research_prompt` 加"角色身份与约束"段
   - 从 `.cursor/agents/trellis-*.md` 提取 tools / forbidden / scope 写死或动态读

3. **同步部署版和模板源码**：
   - 部署版路径：`D:\MyHarness\Trellis\.cursor\hooks\inject-subagent-context.py`
   - 模板源码路径：`packages\cli\src\templates\shared-hooks\inject-subagent-context.py`（这是模板，`trellis init` 会复制到用户项目）
   - 两个都要改，否则 `trellis update` 会覆盖部署版

4. **更新 dispatch-prompts.md**：主会话派发词从 `subagent_type=trellis-*` 改成 `subagent_type=generalPurpose` + 首行角色标记

5. **测试**：用 research 角色跑通一次，确认 hook 注入 + 角色约束生效

## 局限与权衡

- **tools 限制不强制**：generalPurpose 在 Cursor 层面有全部工具，prompt 里写"只用 Read/Write/Edit/Bash"是软约束，遇到不听话的模型可能违规。但 implement 的"不得 git commit"这种关键约束，可以靠 prompt 强约束 + 主会话观察兜底。
- **recursion guard 软约束**：generalPurpose 理论上能再 spawn generalPurpose，靠 prompt 约束"不要再派 subagent"。
- **角色身份感知弱**：subagent 知道自己是"以 generalPurpose 身份运行 trellis-implement 角色"，但 Cursor UI 里显示的是 generalPurpose，不是 trellis-implement。观察体验略差。
- **不解决 model 路由**：路 B 只解决"派发 + 注入"，model 仍是 inherit 父会话。如果要 per-role 不同 model，还是要 Method 2.5（policy 文档记载的 Cursor++ patch）。

## 为何不直接改 hook 白名单把 generalPurpose 加进去

 simplest 想法是改 `AGENTS_ALL` 加 `generalPurpose`。但这会让**所有** generalPurpose 调用都被 hook 拦截注入 Trellis 上下文 —— 用户用 generalPurpose 做无关事情时也会被污染。角色标记 `[trellis:<role>]` 是显式 opt-in，只有主会话主动写标记的派发才走注入路径，干净。
