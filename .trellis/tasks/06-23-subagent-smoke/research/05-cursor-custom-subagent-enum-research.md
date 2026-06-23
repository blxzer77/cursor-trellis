# Research: Cursor 自定义 subagent + Task 工具 enum 扩展机制

- **Query**: 为什么 trellis-* 自定义 subagent 不能被 Task 工具 enum 识别？如何让它进 enum？BYOK 下能否自动派发？
- **Scope**: 外部（Cursor 官方文档 + 社区论坛 + plugin 机制）
- **Date**: 2026-06-23
- **检索方式**: smart-search 不可用（not_configured），降级 WebSearch + WebFetch

---

## 核心结论（先看这个）

**trellis-* 不进 enum 不是 BYOK 独有问题，也不是 Cursor 不支持自定义 subagent —— 是 Cursor 加载自定义 subagent 需要满足特定条件，且历史上存在多个使 Task 工具失效的 bug。**

官方文档（https://cursor.com/docs/subagents.md）明文支持 `.cursor/agents/*.md` 自定义 subagent 被 Task 工具识别。**理论上 trellis-* 应该能进 enum**。你看到 enum 只有 8 个内置值（generalPurpose/explore/shell/cursor-guide/ci-investigator/bugbot/security-review/best-of-n-runner）而不含 trellis-*，是以下某个原因导致的：

---

## 关键发现 1: 自定义 subagent 进 enum 需要重启 Cursor + UI 验证

**来源**: https://forum.cursor.com/t/message-not-a-valid-subagent-type-when-creating-a-custom-agent/159054

这是一个**跟你的情况几乎完全一致**的 forum 帖子。用户在 `~/.cursor/agents/security-reviewer.md` 定义了自定义 subagent，Task 工具 enum 拒绝：

```
Invalid enum value. Allowed values are still only:
generalPurpose, explore, shell, cursor-guide, best-of-n-runner,
ci-watcher, code-reviewer, agents-memory-updater, compatibility-scan-review,
docs-reliability-review, startup-review, validation-review
```

Cursor 团队成员 deanrie 的排查思路：
1. 确认路径是 `~/.cursor/agents/`（agents 复数，不是 agent）
2. 确认 frontmatter 后有 prompt body（空 body 不会被 parser 注册）
3. **关键**：「After creating the file, did you restart Cursor? And do you see security-reviewer show up in Settings > Agents in the UI?」
4. `readonly: true` 有已知 bug 但那是另一种症状，enum 不识别跟它无关

**楼主最终回复**：「Simply had to restart Cursor for the new agents to be picked up…it's always the simple things.」

**对你的启示**：
- 你的 trellis-* 文件 frontmatter 都正确，但**你的 Cursor 可能从未在添加这些文件后重启过**，或者重启后 window 状态没刷新
- 验证方法：Cursor 设置里找 `Settings > Agents`，看 trellis-research / trellis-implement / trellis-check 是否在 UI 列表里。**如果 UI 里看不到，enum 也不会有**。

---

## 关键发现 2: 特定模型（Auto / Composer 1）根本不加载 Task 工具

**来源**: 多个 forum 帖子
- https://forum.cursor.com/t/task-tool-not-available-to-agent-when-subagent-delegation-context-is-injected-2-5-17-windows/152174
- https://forum.cursor.com/t/my-subagents-cant-be-used-in-auto-model/150846
- https://forum.cursor.com/t/cursor-rules-and-sub-agent-calls-do-not-work-when-agent-model-is-set-to-auto-or-composer-1/151134

Cursor 团队 deanrie 多次确认：

> Composer 1 doesn't support the Task tool for subagents. When Auto is selected, requests often get routed through Composer 1, so subagents don't work.
> Workaround: pick a specific model from the dropdown instead of Auto or Composer, for example Sonnet 4.5, GPT-5.2, or Opus 4.5. The Task tool should show up.

**这对 BYOK 场景特别重要**：Cursor++ BYOK 路由可能把你以为是某个模型的请求路由到 Composer 1/Auto 等不加载 Task 工具的模型。即便 enum 扩展了 trellis-*，Task 工具本身不被加载，subagent 还是派不出去。

**验证方法**：你在派发 subagent 的会话里，看主会话 agent 自报的 tools 里有没有 `Task`。你之前那段长汇报里 agent 自报的 tools 是有 `Task` 的（合法集 generalPurpose/explore/shell/best-of-n-runner），所以这一项排除了 —— 你的主会话有 Task 工具，问题纯在 enum 不扩展。

---

## 关键发现 3: Cursor 内置 subagent（ci-watcher 等）是通过 plugin 机制进 enum 的

**来源**: 
- https://cursor.com/docs/plugins
- https://cursor.com/docs/reference/plugins
- https://github.com/cursor/plugins/blob/main/cursor-team-kit/agents/ci-watcher.md

enum 里的 `ci-watcher / code-reviewer / agents-memory-updater / compatibility-scan-review / docs-reliability-review / startup-review / validation-review` 来自 Cursor 官方 plugin（`cursor-team-kit` 等）。

**Cursor plugin 机制**（官方文档）：
- plugin 是一个目录，含 `.cursor-plugin/plugin.json` manifest
- plugin 的 `agents/` 目录下放 `*.md` subagent 定义（跟 `.cursor/agents/` 同格式）
- plugin 通过 marketplace 安装，或本地放 `~/.cursor/plugins/local/<plugin-name>/`
- **安装 plugin 后需要重启 Cursor 或 Developer: Reload Window**
- plugin 的 agents 会被 Cursor 识别并加入 Task 工具 enum

**这对你的潜在路径**：把 trellis-* 打包成 Cursor plugin，放到 `~/.cursor/plugins/local/trellis-agents/`，可能比 `.cursor/agents/` 更可靠地进 enum。但官方文档没明说 plugin agents 是否一定进 enum —— 只说"会被 Cursor 识别"。

---

## 关键发现 4: Cursor subagent 有多个历史 bug，跟版本强相关

forum 里报告的各种 bug 状态：

| Bug | 影响 | 状态 |
|---|---|---|
| Composer 1 / Auto 不加载 Task 工具 | subagent 完全不可用 | 已修复（2.4.31+ / Composer 1.5+） |
| 2.4.22 引入 Task 工具绑定 bug | subagent 完全不可用 | 已修复（回滚或升级） |
| `readonly: true` subagent 启动即拒 | readonly subagent 不可用 | 部分修复 |
| `model: inherit` 实际用 Composer 1 | 模型路由错 | 修复中（2.5+） |
| 自定义 subagent 不进 enum | enum 拒绝 | **重启可解**（forum 案例） |

**对你的启示**：你的 Cursor 版本是多少？如果是较老版本，可能命中某个已修复 bug。升级到最新稳定版可能直接解决问题。

---

## 给你的 5 条可行路径（按优先级）

### 路 1（最先试）：重启 Cursor + Settings > Agents UI 验证

- 完全退出 Cursor（不是关窗口，是 Quit）
- 重新打开
- 进 Settings > Agents，看 trellis-research / trellis-implement / trellis-check 是否在列表里
- 如果在 UI 里 → enum 大概率也扩展了，测 Task(subagent_type=trellis-research)
- 如果不在 UI 里 → Cursor 没扫到 `.cursor/agents/`，走路 2 或路 3

### 路 2：把 trellis-* 放到 user 级 `~/.cursor/agents/`

官方文档说 subagent 可放两处：
- `.cursor/agents/`（project 级，仅当前项目）
- `~/.cursor/agents/`（user 级，所有项目）

你目前 trellis-* 在 `D:\MyHarness\.cursor\agents\`（workspace 级，按 Cursor 扫描规则算 project 级）。**试试复制到 `~/.cursor/agents/`（即 `C:\Users\blaze\.cursor\agents\`）**，重启 Cursor，看 enum 是否扩展。

 Cursor 按 workspace root 扫 `.cursor/agents/`，user 级 `~/.cursor/agents/` 是另一条独立加载路径，不依赖 workspace。如果 user 级工作，跨项目都能用。

### 路 3：把 trellis-* 打包成 Cursor plugin

按官方 plugin 规范：
1. 建目录 `~/.cursor/plugins/local/trellis-agents/`
2. 加 `.cursor-plugin/plugin.json` manifest（最少 `name` 字段）
3. 把三个 trellis-*.md 放进 `agents/` 子目录
4. 重启 Cursor 或 Developer: Reload Window
5. 在 Settings > Plugins 验证 loaded

这是 Cursor 官方推荐的"可分发 subagent 包"机制，enum 里那些 ci-watcher / code-reviewer 都是这么进来的。**理论上最可靠**，但官方文档没明说 plugin agents 是否一定进 Task enum（forum 里有用户报告 plugin subagent 能进 enum，自定义 subagent 不能，所以 plugin 路径可能比 `.cursor/agents/` 更受保障）。

### 路 4（BYOK 备选）：Cursor chat @mention 或 /agents 会话

如果以上都试不通，走之前已验证可用的 fallback：
- Cursor chat 里 `@trellis-research`（slash 菜单已确认能识别）
- 或 Cursor /agents 独立会话

这两个入口绕开 Task 工具，但 hook 不会自动注入（因为 PreToolUse 只对 Task 工具触发）。subagent 得走 fallback 协议自己 Read `Selected task:` 首行。

### 路 5（兜底）：改 hook 支持 generalPurpose + 角色标记

即之前写的 `byok-road-b-plan.md` 方案。主会话用 `Task(subagent_type=generalPurpose, prompt="[trellis:implement]\n...")`，hook 识别 `[trellis:<role>]` 标记后注入。这是"以上都不行"的兜底，确定能跑通但 tools 限制变成软约束。

---

## 相关文档

- [Subagents | Cursor Docs](https://cursor.com/docs/subagents) — 官方 subagent 文档
- [Plugins | Cursor Docs](https://cursor.com/docs/plugins) — 官方 plugin 文档
- [Plugins Reference | Cursor Docs](https://cursor.com/docs/reference/plugins) — plugin manifest 规范
- [Forum: "not a valid subagent_type"](https://forum.cursor.com/t/message-not-a-valid-subagent-type-when-creating-a-custom-agent/159054) — 与你情况最接近的 case，重启解决
- [Forum: Task tool not available (Composer 1 issue)](https://forum.cursor.com/t/task-tool-not-available-to-agent-when-subagent-delegation-context-is-injected-2-5-17-windows/152174) — Auto/Composer 1 不加载 Task
- [Forum: Task Tool Missing for Custom Agents](https://forum.cursor.com/t/task-tool-missing-for-custom-agents-in-cursor-agents-documentation-pages-return-errors/149771) — 多人报告同样问题
- [GitHub: cursor/plugins](https://github.com/cursor/plugins) — 官方 plugin 仓库，看 ci-watcher 等是怎么定义的

---

## Caveats / 不确定

- 「重启 Cursor 解决 enum 不扩展」是从 forum 单个 case 推断的，官方没明文说"必须重启才生效"。但 forum 里这是 Cursor 团队成员建议的标准排查步骤。
- plugin agents 是否一定进 enum，官方文档没明文。forum 里有人说"plugin subagent 能进 enum 但手动 .cursor/agents 不行"，但这是用户观察不是官方声明。
- Cursor++ BYOK 是否会干扰 subagent 加载，policy 文档已有记载（多个已知坑），但没具体说 enum 扩展会不会被 BYOK 影响。需要实际测试。
- 你的 Cursor 版本未知，无法判断是否命中某个已修复 bug。建议跑 `Cursor --version` 或看 About 确认。
