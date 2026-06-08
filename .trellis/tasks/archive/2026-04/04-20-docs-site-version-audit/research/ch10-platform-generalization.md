# ch10 Custom Agents — 跨平台通用化待办

**截图来源**：localhost:3000/zh/guide/ch10-custom-agents（截到 10.2 Agent 可用工具和模型选择）

## 问题

ch10-custom-agents.mdx + ZH 整章当前**完全按 Claude Code 写**，但它在 "魔改篇" 下面，用户期待是跨 10 平台的通用指南。

## 具体穿帮点（screenshot 证据）

### 10.2 "可用工具" 表格

列出的工具全是 Claude Code 专属命名：

| 工具 | 平台专属度 |
|---|---|
| `Read` / `Write` / `Edit` / `Bash` / `Glob` / `Grep` / `Task` / `Skill` | **CC 内部工具名**，Cursor / OpenCode / Codex 调用叫法完全不同 |
| `mcp__exa__web_search_exa` | CC-style MCP tool namespace（`mcp__<server>__<tool>`），OpenCode 里不长这样 |
| `mcp__exa__get_code_context_exa` | 同上 |
| `mcp__chrome-devtools__*` | 同上 |

这些命名跟 `packages/cli/src/templates/claude/agents/trellis-*.md` 的 `tools:` 字段一致，本质是 Claude Code 的 agent frontmatter schema。其他平台：
- **Cursor** agent frontmatter 用 `tools:` 但语法不同
- **OpenCode** 用 `mode: subagent` + `permission: { read/write/edit/bash/glob/grep/mcp__exa__*: allow }` 完全不同 schema
- **Codex** 用 TOML 的 `sandbox_mode` + `developer_instructions`
- **Kiro** 用 JSON `tools: ["read", "write", ...]` 小写
- **Droid** 用 YAML 跟 CC 像但也有差异

### 10.1 整章设定

全章用 `.claude/agents/` 路径、`name:` 字段、`model:` 字段 → 这是 CC frontmatter。

### 模型选择

同理。0.5-beta.5 起我们**默认不指定 model**（让平台 session 继承），但如果章节要讲"模型选择"就得按平台讲：
- CC：`model: claude-opus-4-5 / claude-sonnet-4-5` 在 frontmatter 里
- Cursor：用户在 IDE 里选，agent 文件不能 override（beta.5 教训）
- Codex：TOML 里没 model 字段
- Kiro / Qoder / Codebuddy：各自不同

## 改写方向选项

### Option A：Tabs 按平台分

每一段 10.x 内容都用 `<Tabs>` 切 10 个平台各自的 frontmatter / 工具命名 / 目录。

- 优点：最准确
- 缺点：页面爆长，信息冗余，10 个平台的 matrix 塞进去读者茫然
- 适合章节：10.1 新建 agent 的 frontmatter / 10.2 工具列表

### Option B：抽象成"能力"层，具体 frontmatter 指向平台文档

章节只讲 **"你可以定制 agent 的名字 / 工具权限 / 模型 / 系统提示"** 这种**能力**层次的介绍，具体语法不在 guide 里展开，链到各平台自己的官方 agent 文档或 Trellis 的 `packages/cli/src/templates/{platform}/agents/README`。

- 优点：章节短，维护量小
- 缺点：用户看完不能立刻写 agent，要跳外链
- 适合章节：10.1 / 10.2 整体

### Option C：主 CC 次抽象，其他平台 "差异速查"

主体仍用 CC frontmatter 做例子（因为最完整），但末尾加一节 "其他平台的差异" 用小表格列 frontmatter schema 不同点：

```
| 平台 | frontmatter schema | 工具声明字段 | 模型字段 |
|---|---|---|---|
| Claude Code | YAML `name/description/tools/model` | `tools: Read, Write, ...` | `model: opus` |
| Cursor | 类 CC 但格式差异 | 同 CC | 不支持 |
| OpenCode | YAML `mode: subagent` + `permission` | `permission: { read/write: allow }` | 会话继承 |
| Codex | TOML `name/description/sandbox_mode` | `sandbox_mode: "workspace-write"` | - |
| ... | | | |
```

- 优点：保留深度样例（CC）+ 跨平台速查（表格）
- 缺点：仍然以 CC 为中心，但可接受
- 最务实，**推荐采用这个**

## 具体要改的范围

（相对当前 ch10.mdx）

- L9 `.claude/agents/{name}.md` → 扩到 10 平台路径表（或链接到 appendix-a）
- L15-40 frontmatter 示例 → 维持 CC 样例，但加 "其他平台的 frontmatter 差异" 段
- **10.2 "可用工具" 表格**（screenshot 里高亮的那个）→ 最突出的问题，按 Option C 改
- 10.3 修改已有 agent → 改 `name: check` → `name: trellis-check`（已在 batch 1 修了）
- 10.4 创建新 agent → 去掉 `model: opus`（已在 batch 1 修了）+ 举一个真正跨平台的 agent 例子（比如一个 "代码审阅" agent，展示 CC / OpenCode / Codex 三种 frontmatter）

## 估工作量

- Option C（推荐）：**~2h**，主要是加一个跨平台 frontmatter 速查表 + 改 10.2 工具表
- Option A（重构）：**~5h**，每节加 Tabs
- Option B（精简）：**~1h**，但用户体验差

## 归属

此任务并入 **P1b 魔改篇**（ch09-ch12 rewrite）主任务。不单独建新 task，作为 ch10 改写时的参考。

## 时间线

建议在 P0a/b/c（ch01/02/05）完成后，P1b ch10 改写时参考这份笔记直接执行 Option C。
