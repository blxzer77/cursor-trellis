# Hook 注入机制研究 (06-23)

## 概览

`.cursor/hooks/inject-subagent-context.py` 是 Cursor PreToolUse 阶段的 hook，在三种 subagent (`trellis-implement` / `trellis-check` / `trellis-research`) 即将被调用时拦截并注入上下文。

## 核心流程

### 1. 触发条件 (`inject-subagent-context.py` L145-L158)

Hook 在 PreToolUse(Task|Subagent) 事件触发时运行：

- 解析 `tool_name` / `tool_input` 判断 subagent 类型（`_parse_hook_input` L105-L132）
- 仅当 `subagent_type in AGENTS_ALL` 时继续（L158）
- 如果原始 prompt 已包含 `<!-- trellis-hook-injected -->` 标记则跳过（`prompt_has_injection_marker` 检测，L167-L169）

### 2. 任务路径解析

优先级顺序：

1. 通过 `common.active_task.resolve_selected_task` 自动检测（L171，依赖 task.json / .task-active / 环境变量）
2. 如果 (1) 失败且 `original_prompt` 包含 `Selected task: <path>` 行，则从该行提取（L172-L182）
3. 对于 `AGENTS_REQUIRE_TASK` (`implement` / `check`)，若无 task_dir 则中止（L184-L187）

### 3. 上下文构建 (`subagent_dispatch.py`)

调用 `build_dispatch_prompt_for_agent(repo_root, task_dir, subagent_type, original_prompt)`（L189-L193），最终路由到：

- **implement**: `build_implement_prompt` (L217-L246)
  - 读取 `implement.jsonl` 中的代码文件（`get_implement_context`）
  - 自动附加 `prd.md`, `design.md`, `implement.md`（如存在）
  
- **check**: `build_check_prompt` (L249-L279)
  - 读取 `check.jsonl` 中的检查规范
  - 附加 `prd.md`, `design.md`, `implement.md`
  
- **research**: `build_research_prompt` (L295-L336)
  - 仅注入 `.trellis/spec/` 目录树结构（`get_research_context`）
  - 不强制要求 task_dir（可选）

### 4. 输出格式

Hook 返回修改后的 `tool_input`，将 `prompt` 字段替换为新构建的上下文（L195-L206）：

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",
    "updatedInput": { "prompt": "<new_prompt>" }
  }
}
```

## 注入内容示例

### trellis-research

```markdown
<!-- trellis-hook-injected -->
# Research Agent Task

## Core Principle
...

## Project Info

## Project Spec Directory Structure

```
.trellis/spec/
├── Trellis/ (cli, workflow, ...)
├── smartsearch-private/ (...)
└── riverfjs-skills/ (...)
```

To get structured package info: `python ./.trellis/scripts/get_context.py --mode packages`

...

---

## Your Task

<original_prompt>
```

### trellis-implement / trellis-check

注入内容包含：

1. **JSONL 文件引用的代码**（每个文件前缀 `=== <path> ===`）
2. **任务工件**：`prd.md`, `design.md` (如存在), `implement.md` (如存在)
3. **Agent 指令**：workflow 步骤、约束条件

## Fallback 协议

当 hook 未注入（prompt 不含 `<!-- trellis-hook-injected -->`）时，subagent 定义（`.cursor/subagents/<name>/prompt.md`）内置 fallback：

- 从首行 `Selected task: <path>` 提取 task_dir
- 自行调用 `get_context.py` 或直接读取 prd.md / implement.jsonl

**本次 subagent 运行时**：没有观察到 hook 注入标记（prompt 中无 `<!-- trellis-hook-injected -->`），因此使用了 fallback 路径。

## 验证点

1. Hook 是否在 `.cursor/hooks/hooks.json` 中注册 → **需检查 hooks.json**
2. 本次任务无 `task.json` / `prd.md` 等工件 → hook 会在 L184 `if subagent_type in AGENTS_REQUIRE_TASK` 处跳过 `trellis-implement` / `trellis-check`
3. `trellis-research` 不强制 task，可继续运行（L187 后仍继续）

## 相关文件

- `.cursor/hooks/inject-subagent-context.py`：PreToolUse hook 入口
- `.trellis/scripts/common/subagent_dispatch.py`：上下文构建核心逻辑
- `.trellis/scripts/common/active_task.py`：任务路径解析（`resolve_selected_task`）
