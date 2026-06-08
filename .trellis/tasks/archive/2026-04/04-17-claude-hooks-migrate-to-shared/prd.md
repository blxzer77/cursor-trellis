# Claude 旧 hooks 迁移到 shared-hooks

## 背景

v0.5.0-beta 引入了 `templates/shared-hooks/` 作为 10 个平台共享的 Python hook 脚本。7 个新平台（Qoder/CodeBuddy/Droid/Cursor/Gemini/Kiro/Copilot）全部用 shared 版。但 **Claude Code 平台**还在用自己的一份 `templates/claude/hooks/`，两份在分歧。

### 为什么不能放着不管

旧版 `claude/hooks/` 有几百处过时代码，影响 Claude 用户的实际体验：

#### `inject-subagent-context.py`（803 行）

| 问题 | 影响 |
|------|------|
| 仍有 `AGENT_DEBUG` / `get_debug_context()` / `build_debug_prompt()` | ~130 行死代码，debug agent 实际已删 |
| 硬编码引用 `.claude/commands/trellis/check-cross-layer.md` | 文件不存在，fallback 静默失败 |
| `get_check_context` fallback 读 `spec.jsonl` / `finish.jsonl` | 任务系统不创建这些文件，fallback 永远空 |
| `get_research_context` 读 `research.jsonl` | 任务系统不创建，空 |
| `tool_name` 只认 `Task` / `Agent` | 未用 shared 版的 `_parse_hook_input()` 多平台解析 |
| Output 只输出 Claude 格式的 `hookSpecificOutput.updatedInput` | 不是 shared 版的多格式兼容输出 |

#### `session-start.py`

| 问题 | 影响 |
|------|------|
| `<task-status>` 没有 Next-Action 强化 | 不会点名 skill / sub-agent，AI 流程遵守依赖模糊语义匹配 |
| 只读 `CLAUDE_PROJECT_DIR` / `CLAUDE_NON_INTERACTIVE` | 跨平台检测缺失（虽然 Claude 自己用影响不大） |

### 共享版（shared-hooks）的状态

✅ 已清理所有过时代码
✅ `_parse_hook_input()` 覆盖 6 种 input 格式
✅ 多格式 output（Claude/Cursor/Gemini 三合一）
✅ Next-Action 强化（5 个状态明确点名 skill/命令/sub-agent）
✅ 所有 hardcoded 路径 fallback 已删

---

## 目标

让 Claude 平台也使用 `shared-hooks/` 的共享 hook 脚本，删除 `templates/claude/hooks/` 整个目录（**1435 行**旧代码，2026-04-17 实测）。

---

## 任务

### 1. 修改 `configurators/claude.ts`

当前实现：

```typescript
export async function configureClaude(cwd: string): Promise<void> {
  const sourcePath = getClaudeTemplatePath();
  const destPath = path.join(cwd, ".claude");
  const ctx = AI_TOOLS["claude-code"].templateContext;

  // 关键：当前会把 agents/, hooks/, settings.json 全拷贝过去
  await copyDirFiltered(sourcePath, destPath, ["commands"]);

  // ... commands + skills
}
```

改为：

```typescript
import { writeSharedHooks } from "./shared.js";

export async function configureClaude(cwd: string): Promise<void> {
  const sourcePath = getClaudeTemplatePath();
  const destPath = path.join(cwd, ".claude");
  const ctx = AI_TOOLS["claude-code"].templateContext;

  // 排除 commands/ 和 hooks/
  await copyDirFiltered(sourcePath, destPath, ["commands", "hooks"]);

  // 用共享 hook 脚本
  await writeSharedHooks(path.join(destPath, "hooks"));

  // ... 原有的 commands + skills 不变
}
```

### 2. 更新 `configurators/index.ts` 的 `claude-code` entry

当前 `collectTemplates` 从 `getClaudeHooks()` 取：

```typescript
for (const hook of getClaudeHooks()) {
  files.set(`.claude/${hook.targetPath}`, hook.content);
}
```

改为：

```typescript
for (const [k, v] of collectSharedHooks(".claude/hooks")) {
  files.set(k, v);
}
```

（`collectSharedHooks` helper 已经存在）

### 3. 更新 `templates/claude/index.ts`

移除：
- `getAllHooks()` 函数
- `HookTemplate` interface（如果只给 hooks 用）
- `listFiles("hooks")` 调用

保留：
- `getAllAgents()`
- `getSettingsTemplate()`
- `settingsTemplate`（测试依赖）

### 4. 删除旧 hook 脚本文件

```bash
rm -rf packages/cli/src/templates/claude/hooks/
```

实际行数（2026-04-17 验证 `wc -l`）：
- `inject-subagent-context.py`（803 行，其中 ~130 行是 `AGENT_DEBUG` / `get_debug_context` / `build_debug_prompt` 死代码）
- `session-start.py`（414 行）
- `statusline.py`（218 行）

总计 **1435 行**旧代码。（原 PRD 写 1831 行是估计偏高。）

**已确认存在的过时引用**（shared 版都已去掉）：
- 硬编码引用 `.claude/commands/trellis/check-cross-layer.md`（文件已删）
- `spec.jsonl` / `research.jsonl` / `finish.jsonl` fallback（这些 JSONL 不再由任务系统创建）
- `tool_name` 只认 `Task` / `Agent`（未用 shared 版的多平台 `_parse_hook_input()`）

### 5. 更新测试

#### `test/templates/claude.test.ts`

当前可能有：

```typescript
describe("claude getAllHooks", () => {
  it("returns 3 hook scripts", ...)
})
```

要么删除这些 test，要么改为测试 `getSharedHookScripts()`。

#### `test/regression.test.ts`

有几处从 `templates/claude/index.ts` import `getAllHooks` — 移除或替换为 shared 版。

#### `test/commands/init.integration.test.ts`

有验证 `.claude/hooks/session-start.py` 存在的测试 — 保留（文件仍会存在，只是来源不同）。

### 6. 手动验证

- [ ] 干净目录 `trellis init --claude` → `.claude/hooks/` 下有 3 个 .py 文件
- [ ] 对比内容：应该和 `shared-hooks/` 下的一致
- [ ] 打开 Claude Code → SessionStart hook 触发 → 看 `<task-status>` 是否是新版 Next-Action 格式
- [ ] 创建一个任务 → spawn check sub-agent → hook 拦截 → 验证 context 注入正常

---

## 风险

### 行为差异

旧版和新版在**一些边界情况**可能有差异：

- 旧版 fallback 逻辑（读 check-cross-layer.md / spec.jsonl）— 新版没有，如果用户有依赖这些 fallback 的 task，会丢 context
- 旧版的 `<session-context>` 格式可能和新版有字段差异

**缓解**：切换前跑一遍完整的 Claude 流程，对比注入的 prompt 内容。

### 用户已有项目升级

如果用户的 `.claude/hooks/` 已经被 Trellis 写过（旧版），`trellis update` 会用新版覆盖。hash 如果匹配（用户没改过），正常更新；如果用户自己改过 hook 代码，会跳过更新并提示。

---

## 任务依赖

- 不依赖其它子 task
- **但强依赖 `04-17-subagent-injection-per-platform` 里 Copilot hooks.json 修复** —— 如果 shared-hooks 在 Copilot 等平台已验证可靠，迁移 Claude 风险更低

## 相关文件

```
packages/cli/src/
├── configurators/
│   ├── claude.ts                      ← 修改
│   └── index.ts                       ← 修改 claude entry
├── templates/
│   ├── claude/
│   │   ├── index.ts                   ← 修改，移除 getAllHooks
│   │   ├── hooks/                     ← 删除整个目录
│   │   │   ├── inject-subagent-context.py
│   │   │   ├── session-start.py
│   │   │   └── statusline.py
│   │   └── settings.json              ← 不改
│   └── shared-hooks/                  ← 不改（源）
test/
├── templates/claude.test.ts           ← 更新
├── regression.test.ts                 ← 更新
└── commands/init.integration.test.ts  ← 检查
```

## 验收

- [ ] `templates/claude/hooks/` 整个目录删除
- [ ] Claude 平台 configurator 改用 `writeSharedHooks()`
- [ ] 所有 538+ 测试通过
- [ ] 手动 e2e 验证：init → spawn sub-agent → 注入正常

## 父 Task
`.trellis/tasks/04-16-skill-first-refactor`
