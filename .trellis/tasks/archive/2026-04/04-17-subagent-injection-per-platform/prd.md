# 修复各平台 sub-agent 上下文注入

## 状态：**Mostly Done**（2026-04-17 更新）

原 PRD 基于 "hook-based 注入" 思路写成。实际落地走了不同路线：**4 个 class-2 平台改为 pull-based prelude**（由 `d2c6682` commit 实现），在 sub-agent definition 开头注入「Load Trellis Context First」指令，不再依赖平台 hook。

只剩 Kiro 的 `agentSpawn` 协议真实环境未验证。

---

## 平台分类（最终确定）

**Class-1：hook-based 注入**（6 平台，hook 自动改写 sub-agent prompt）
- Claude Code / Cursor / OpenCode / Kiro / CodeBuddy / Droid

**Class-2：pull-based prelude**（4 平台，sub-agent 启动后自己读 `.current-task`）
- Codex / Copilot / Gemini / Qoder

**Class-3：agent-less**（3 平台，主 AI 自己走所有流程）
- Kilo / Antigravity / Windsurf

---

## 已完成

### ✅ Codex + Copilot + Gemini + Qoder（pull-based）

commit `d2c6682` 引入 `buildPullBasedPrelude(agentType)` + `applyPullBasedPrelude{Markdown,Toml}` helper。4 平台 configurator 写 sub-agent definition 时自动在顶部（或 Codex 的 `developer_instructions` 字段内）注入：

```
## Required: Load Trellis Context First

This platform does NOT auto-inject task context via hook. Before doing anything else, you MUST load context yourself:

1. Read `.trellis/.current-task` ...
2. Read `<task-path>/prd.md` ...
3. Read `<task-path>/{implement,check}.jsonl` ...
4. For each entry in the JSONL, Read its `file` path ...
```

原 PRD 里的以下 3 项**不再需要**（已被 pull-based 替代）：
- ~~修改 codex/agents/{implement,check}.toml 的 developer_instructions~~（pull-based prelude 已自动处理）
- ~~修改 copilot/hooks.json 加 preToolUse~~（放弃，因 Copilot hook 不触发 sub-agent spawn）
- ~~Copilot configurator 不再写 inject-subagent-context.py 到 `.github/copilot/hooks/`~~（已跳过）

### ✅ OpenCode（JS plugin 同步）

`packages/cli/src/templates/opencode/plugins/inject-subagent-context.js`：
- ✅ agent list 与 shared 版一致：`["implement", "check", "research"]`
- ✅ 无 spec.jsonl / research.jsonl fallback
- ✅ `tool.execute.before` 原地 mutate `args.prompt`（OpenCode 正确用法）
- ✅ 含 `update_current_phase()` 等价实现（为 workflow-enforcement-v2 准备）

---

## 还开着

### ⚠️ Kiro `agentSpawn` 协议验证（P2）

Kiro 是 class-1 hook-based，但 `agentSpawn` hook 的 stdout → sub-agent context 协议官方文档不清晰：

- 选项 A：stdout JSON 的 `context` 字段 → 注入
- 选项 B：stdout 纯文本 → 全文注入
- 选项 C：stdout 被忽略，只看 exit code

`shared-hooks/inject-subagent-context.py` 当前输出 Claude/Cursor/Gemini 三合一 JSON，Kiro 可能都不认。

**当前模板**：`kiro/agents/{implement,check,research}.json` 里嵌入 `hooks: [{"on": "agentSpawn", "command": "python3 .kiro/hooks/inject-subagent-context.py"}]`。

#### 验证步骤

1. 真实 Kiro 环境安装 Trellis 项目
2. 创建 task + 填 `implement.jsonl`
3. 通过 `subagent` 工具调用 implement agent
4. 看 sub-agent 实际拿到的 prompt 里有没有 injected context
5. 在 hook 脚本里临时加 `sys.stderr.write(f"HOOK FIRED: {input_data}\n")` 确认触发

#### 如果不工作的修复路线

- 若 stdout 格式不对：给 `_build_hook_output()` 加 Kiro 专属分支
- 若 `agentSpawn` 根本不 fire：把 Kiro 降级为 class-2（pull-based），改走 `applyPullBasedPreludeMarkdown()`

#### 验收

- [ ] 真实 Kiro 里 sub-agent spawn 后，context 被正确注入（从 `implement.jsonl` 读的 spec 文件内容出现在 sub-agent 的首轮 prompt 里）
- [ ] 如需修复，修复并重测

---

## 相关文件

```
packages/cli/src/
├── configurators/
│   ├── shared.ts                      ← buildPullBasedPrelude / applyPullBasedPreludeMarkdown/Toml
│   ├── codex.ts / copilot.ts / gemini.ts / qoder.ts   ← 调 apply*
│   └── kiro.ts                        ← ⚠️ 仍走 hook，待验证
└── templates/
    ├── shared-hooks/inject-subagent-context.py
    ├── opencode/plugins/inject-subagent-context.js
    └── kiro/agents/{implement,check,research}.json    ← agentSpawn hook 配置在这
```

## 父 Task
`.trellis/tasks/04-16-skill-first-refactor`
