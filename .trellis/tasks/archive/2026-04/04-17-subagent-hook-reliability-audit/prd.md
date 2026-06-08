# Sub-agent hook 可靠性实测

## 背景

在 `04-16-rewrite-workflow-full` 的调研中发现：**"平台配了 sub-agent hook" ≠ "sub-agent hook 能真的注入上下文"**。多个平台存在官方 bug 或文档与实现不一致。Trellis 当前按"配了就算有"的字段 (`AI_TOOLS.templateContext.hasHooks`) 分类，可能跟真实能力有出入。

本 task 的目标：**实测**每个"疑似能注入 sub-agent"的平台，确认 Trellis 现有 hook 配置是否真的在 sub-agent 启动时修改了 prompt / 注入了上下文。

## 已确认状态（2026-04-17 调研）

### A. 确认能注入 sub-agent（3 个，不需要实测）
- **claude-code**：PreToolUse + Task matcher，可修改 prompt
- **kiro**：agentSpawn hook 绑在 agent JSON 里，per-agent 设计
- **opencode**：plugin `tool.execute.before` 拦截 task tool

### B. 配了但可靠性存疑（原计划 5 个，2 个已迁移到 pull-based，剩 3 个要实测）

| 平台 | Trellis 现有配置 | 已知问题 | 状态 |
|---|---|---|---|
| **cursor** | `preToolUse` + `matcher: "Task"` | Forum 2026-02: preToolUse 的 `updated_input` for Task tool **被 silently ignored**（staff 2026-04-07 确认 bug 修复） | ⚠️ 仍需实测 |
| **codebuddy** | `PreToolUse` + `matcher: "Task"` | 官方文档只列 `SubagentStop`，可能继承 Claude Code Bug #34692 | ⚠️ 仍需实测 |
| **droid** | `PreToolUse` + `matcher: "Task"` | 官方文档明确支持 `PreToolUse + Task + updatedInput.prompt` | ⚠️ 仍需实测 |
| ~~**gemini**~~ | ~~BeforeTool~~ | ~~#18128~~ | ✅ 已迁移到 class-2 pull-based（commit `d2c6682`，不再依赖 hook） |
| ~~**qoder**~~ | ~~PreToolUse+Task~~ | ~~sub-agent 不走 Task tool~~ | ✅ 已迁移到 class-2 pull-based（commit `d2c6682`） |

### C. 确认不能注入（已迁移 pull-based 或无 hook）
- **codex / copilot**：已迁移 class-2 pull-based（`d2c6682`）
- **kilo / antigravity / windsurf**：无 hook（class-3，主 AI 自己走流程）

### D. 待验证
- **kiro**：agentSpawn hook 绑在 agent JSON 里，协议未验证（详见 `04-17-subagent-injection-per-platform`）

---

## 实测方案

### 通用测试 fixture

**准备**：
1. 在每个平台新建一个干净项目，`npx trellis init --platform <name>`
2. 创建一个简单 task，`prd.md` 写"读一下 TESTFILE.md 并报告内容"
3. 准备 `TESTFILE.md` 写"HOOK_INJECTION_CANARY_TOKEN_{{PLATFORM}}"

**测试步骤**：
1. 在每个平台启动 AI 会话
2. 让 AI 调用 implement sub-agent 处理 task
3. 观察 sub-agent 是否：
   - **能看到注入的 prd.md / jsonl 内容**（证明 prompt 被修改）
   - **看到 canary token**（证明 inject-subagent-context.py 执行并把文件内容塞进 prompt）
4. 如果可见 → hook 工作 ✅；如果不可见 → hook 未生效 ❌

**log 验证**：
- 每个平台的 `inject-subagent-context.py` 加上 `print(f"[DEBUG] injected for {subagent_type}", file=sys.stderr)` 确认 hook 是否真的被 runtime 触发
- 如果 hook fire 了但注入没生效，说明 runtime 忽略了 modified prompt（Cursor forum 里 Task tool 的已知现象）

---

## 执行清单

### Step 0 — 文档级调研 [已完成 2026-04-17]

- [x] 5 个平台的 hook 文档、GitHub issues、论坛全量梳理，产出 `research/platform-hook-audit.md`
- **核心结论**：
  - ✅ **Cursor**：2026-04-07 staff 确认 bug 修复，保持现状
  - ⚠️ **Gemini CLI**：机制可行（`hookSpecificOutput.tool_input` 覆盖），但 #18128 限制 hook 看不到主 agent 上下文
  - ❌ **Qoder**：`PreToolUse + Task` 在 Qoder 上无文档依据，sub-agent 不走 Task tool — 需迁移到 UserPromptSubmit 或静态注入
  - ❌ **CodeBuddy**：继承 Claude Code #15897/#40580 bug，大概率 `modifiedInput.prompt` 被静默丢弃
  - ✅ **Factory Droid**：文档明确支持 `PreToolUse + Task + updatedInput.prompt`
- **意外发现**：Claude Code 自己也有 Task tool `updatedInput`/exit-code 被忽略的 bug（#15897/#40580）— A 类"确认能注入"需重新实测

### Step 1 — 准备测试 harness [必做]

- [ ] 创建独立目录 `/tmp/trellis-hook-audit/`
- [ ] 对 5 个平台各自 `trellis init`（可能需要 `--platform` 参数每次单选）
- [ ] 写一份共享的 `TESTFILE.md` + minimal `prd.md`
- [ ] 修改每个平台的 `inject-subagent-context.py` 临时加 stderr 调试日志

**完成标志**：5 个独立项目目录准备好，每个都有 Trellis 配置。

### Step 2 — 单平台实测 [必做，对 B 类 3 个平台各跑一次]

对每个平台：
- [ ] **cursor**：启动 cursor CLI，在项目里 `Task` 调 implement sub-agent，观察 sub-agent 是否看到 canary
- [ ] **codebuddy**：同上
- [ ] **droid**：同上

（原计划的 gemini / qoder 已迁移 pull-based，不再需要测 hook 注入）

每次记录：
- hook 是否 fire（看 stderr debug log）
- sub-agent 是否看到注入内容（看 sub-agent 回复）
- 平台 CLI 版本号（方便未来 bug 回归追踪）

**完成标志**：5 个平台都有明确结论（✅/❌/⚠️）。

### Step 3 — 汇总 + 决策 [必做]

把结果汇总到 `results.md`：

```markdown
| 平台 | CLI 版本 | hook 触发 | 注入生效 | 结论 |
|---|---|---|---|---|
| cursor | 1.7.x | ✅ | ❌ | Forum bug 确认，需切 subagentStart |
| ...
```

根据结果，决定：
- 哪些平台的 Trellis hook 配置需要改（如 cursor 切 subagentStart、qoder 切 SubagentStart）
- 哪些平台的 `hasHooks` 需要修正为 false（真的不能注入的）
- 哪些平台继续观察（上游会修）

**完成标志**：`results.md` 产出 + 一份调整清单。

### Step 4 — 调整 Trellis 配置 [按需]

按 Step 3 的调整清单：
- [ ] 修改对应平台的 `settings.json` / `hooks.json` / agent 定义
- [ ] 修改 `src/types/ai-tools.ts` 的 `hasHooks` 字段（如需）
- [ ] 更新测试

**完成标志**：`pnpm test` 全绿；每个平台重新 init 产出正确的 hook 配置。

### Step 5 — 文档更新 [必做·一次]

- [ ] 更新 `.trellis/spec/cli/platform-integration.md`（如存在），记录每个平台的 sub-agent 注入真实能力
- [ ] 给 memory 加一条：平台 hook 能力矩阵

---

## 非目标

- **不修复上游 bug**：Cursor / Gemini / Copilot 的 bug 是上游的，只负责绕过或记录
- **不新增平台**：只在现有 13 个平台内测试
- **不做压力测试**：只验证 "能否注入"，不测性能/并发

---

## 前置依赖

- 需要本地能跑 3 个平台的 CLI：cursor, codebuddy, droid
  - cursor: 有 UI app
  - codebuddy: 腾讯 CodeBuddy，安装方式待确认
  - droid: Factory Droid CLI
- 如果某平台本地跑不起来，在 `results.md` 里标"无法实测"即可

## 关联

- 主 task：`04-16-skill-first-refactor`
- 被阻塞的 task：`04-16-rewrite-workflow-full`（不 block，按乐观分类先推进）
