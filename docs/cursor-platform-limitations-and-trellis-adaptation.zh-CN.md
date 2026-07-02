# Cursor 平台限制与 cursor-trellis 适配说明（用户与开发者版）

[English](cursor-platform-limitations-and-trellis-adaptation.md)

> **文档性质**：独立说明，面向最终用户与贡献者。  
> **最后核对**：2026-06-26  
> **证据**：Cursor 官方文档/博客、社区论坛、本仓库实测，以及 Trellis 包装的 smart-search 深度检索（2026-06-25 共 6 次，均成功）。  
> **诚实声明**：Cursor 与 Cursor++ 更新频繁；下文描述的是当前已验证行为。你的版本若不同，请按文中「自检步骤」自行复测。

---

## 这篇文档解决什么问题

使用 **cursor-trellis**（在 Cursor 中运行 Trellis 工作流的 CLI 与模板）时，常见问题包括：

- 写了钩子（hook），Agent 却像没看见工作流；
- 在 **Cursor++（自备 API 模型）** 下，研究/实现/检查子任务没有按预期换模型；
- 检索计划写了「语义搜索」，Agent 却一直在做文本搜索；
- 不清楚 **Cursor Native（官方订阅）** 与 **Cursor++** 是否应使用同一套配置。

本文分四块说明（尽量不用内部代号，必要处会解释）：

1. **Cursor 官方/社区已报告的平台问题**（附链接）
2. **Cursor Native**：cursor-trellis 会遇到什么、如何解决、你怎么操作
3. **Cursor++ BYOK**：同上
4. **仍存在的不足**（平台 + cursor-trellis）

日常集成见 [Cursor 集成](cursor.zh-CN.md)；子任务派发见 [子 Agent 派发](subagents.zh-CN.md)。

---

## 先分清两种环境

| 名称 | 含义 | 如何判断 |
| --- | --- | --- |
| **Cursor Native** | 使用 Cursor 官方模型与 API（常见为 Cursor 订阅）。 | 未用 Cursor++，或未设置环境变量 `TRELLIS_CURSOR_BYOK=1`。 |
| **Cursor++ BYOK** | 通过 **Cursor++**（社区常称 ccursor）使用自备 API Key / 模型商。配置多在用户目录 `~/.ccursor/`。 | 存在 `~/.ccursor/providers.json`，或 `routes.json` 里 `byokMode` 为真，或 `TRELLIS_CURSOR_BYOK=1`。 |

两种环境下，项目里的 `.cursor/agents`、`.cursor/hooks`、`.cursor/rules` **通常都能加载**。差异主要在：**子任务用哪个模型**、**Agent 能否用内置语义搜索**、**是否需要本机可选补丁**。

**并存**：同一台机器上可对不同仓库分别使用 Native 与 BYOK；`--cursor2plus` 按项目物化，`cursorEnv` 按会话解析。见 [Native 与 BYOK 并存](cursor.zh-CN.md#native-与-byok-并存非二选一)。

初始化：

```bash
npm install -g @blxzer/cursor-trellis
cd /path/to/your-project
cstl init --cursor

# 仅当你使用 Cursor++ 且需要「按角色固定模型」时：
cstl init --cursor --cursor2plus
```

---

## 第一部分：Cursor 平台已存在的问题

以下多为 **Cursor 或社区已公开讨论** 的行为/缺陷，不是 cursor-trellis 单独能修的 bug。cursor-trellis 通过规则文件、命令行生成派发说明、环境分叉来规避。

### 1. 钩子返回的 `additional_context` 可能进不了 Agent

**用户能看到的现象**

- 在 `sessionStart` 或 `postToolUse` 钩子里返回了大段 `additional_context`（例如整份 workflow）。
- 日志显示钩子成功，但 **对话里 Agent 完全没按这些内容行动**。

**为何严重**

- 若把「必须先做请求分类」「必须先按检索计划查代码」等 **唯一** 写在钩子里，Agent 可能每轮都跳过。

**外部证据（Cursor 论坛）**

- [sessionStart：additional_context 未进入 Agent 初始上下文 #158452](https://forum.cursor.com/t/sessionstart-hook-additional-context-is-never-injected-into-agents-initial-system-context/158452)
- [sessionStart：已合并但未到达 Agent 窗口 #157141](https://forum.cursor.com/t/sessionstart-hook-output-is-accepted-and-merged-but-the-injected-context-does-not-reach-agent-window/157141)
- [postToolUse：additional_context 未注入 #156157](https://forum.cursor.com/t/cursor-hooks-additional-context-not-injected-in-agent-context-in-posttooluse/156157)
- [Cursor Hooks 官方文档](https://cursor.com/docs/hooks)（说明钩子存在，不表示上述问题已修复）

**cursor-trellis 的做法**

- 钩子只做 **尽力而为** 的辅助（终端会话、检索计划块等）。
- **每轮必须遵守的规则** 放在 `.cursor/rules/*.mdc`（`alwaysApply: true`）和 `AGENTS.md`，不单独依赖钩子注入。

---

### 2. 自定义子 Agent（Task 工具）模型路由与预期不符

**现象**

- 为 `cstl-research`、`cstl-implement`、`cstl-check` 指定了模型，或在本机 Cursor 设置里配置了「每个 Agent 的模型」。
- 实际派发时子 Agent **仍用主会话同一模型**。

**外部证据**

- [SubAgent Task 忽略按类型的模型路由（论坛）](https://forum.cursor.com/t/subagent-task-tool-ignores-model-specific-subagent-type-routing-all-subagents-inherit-parent-model-instead-of-using-their-designated-models-opus-codex/151917)
- [Cursor 2.4：Subagents、Skills（官方 changelog）](https://cursor.com/changelog/2-4)

Native 与 BYOK 分叉见下文第二、三部分。

---

### 3. 代码检索：字面搜索强；语义搜索与 LSP 不宜对 Agent 硬承诺

**字面搜索**

- Cursor 官方说明面向 Agent 的快速正则索引：[Fast regex search](https://cursor.com/blog/fast-regex-search)

**语义搜索（@codebase 等）**

- 产品中有语义/代码库搜索叙事，但 **Agent 是否调用、能否从日志确认** 因版本与环境而异。
- cursor-trellis 在 Native 检索计划里 **可以建议** 内置语义能力，并标明：**计划 ≠ 已实测执行**。

**LSP（跳转定义、查引用）**

- 编辑器里通常可用；在 **Agent 自动工具** 层面不宜对外保证「每轮都能稳定 LSP 跳转」。
- 建议：用精确搜索 + 读文件验证；若项目配置了 codegraph 等索引工具，优先用其查调用关系。

---

### 4. Cursor++ 是第三方增强，不是 Cursor 官方 API

- Cursor++ 多在 **API 层** 路由，一般 **不阻止** `.cursor/` 下 agents/hooks/rules 加载。
- BYOK 下仅靠 Agent 文件头部 `model:` 或 Cursor 设置里的「每 Agent 模型」，**往往无法** 让自定义 `trellis-*` 子 Agent 换模型（本地 E2E 与社区反馈一致）。
- 需要固定「研究 / 实现 / 检查」各用不同 BYOK 模型时，cursor-trellis 提供 **可选、需你本人同意** 的本机脚本（第四部分），**不是** 默认安装步骤。
- 补丁会改本机 Cursor/Cursor++ 程序文件，升级可能失效；`~/.ccursor/` 可能有 API Key，**勿提交到 Git 或公开分享**。

---

### 5. Automations / SDK：在演进，未纳入 Trellis 默认流程

- [Build agents that run automatically（官方博客）](https://cursor.com/blog/automations)
- 持续关注，**尚未** 作为 Trellis 默认工作流；需单独设计与安全评估。

---

### 6. 钩子与安全（与注入 bug 不同，但应知晓）

- 社区讨论过 Agent 与 Git 钩子相关风险，示例：[Hackread 报道](https://hackread.com/cursor-ai-ide-vulnerability-code-execution-git-hooks)
- 建议：只在信任仓库启用钩子；审查 `.cursor/hooks/` 变更。

---

## 第二部分：Cursor Native 环境

### 2.1 常见问题

| 问题 | 表现 | 平台原因 |
| --- | --- | --- |
| Triage/工作流偶发失效 | Agent 不分类就直接改代码 | 钩子 additional_context 不可靠（§1） |
| 子任务上下文不全 | implement 不知道 prd/design | Task 只有短 prompt |
| 检索与文档不一致 | 计划写 semantic，实际全 Grep | Agent 语义工具不可观测（§3） |
| 斜杠面板过杂 | 误点内部技能 | 平台暴露过多入口 |

### 2.2 cursor-trellis 的解决办法

| 做法 | 说明 |
| --- | --- |
| 常驻规则 | `cstl-triage.mdc`、`retrieval-routing.mdc`，`alwaysApply: true` |
| AGENTS.md | 项目结构、外部资料优先 smart-search、推送策略等 |
| 少量斜杠命令 | `/cstl-continue`、`/cstl-finish-work`；默认不堆 `.cursor/skills/` |
| **CLI 生成完整派发说明** | 派发 research/implement/check 前用 `generate_dispatch_prompt.py` 生成全文，再粘贴到 Task 的 prompt。**这是保证子任务看见任务上下文的可靠主路径。** |
| 钩子降级 | sessionStart 辅助；beforeSubmitPrompt 可注入检索计划；不依赖钩子传硬规则 |
| Native 语义 | 检索计划可走 Cursor 内置语义建议，并区分计划与执行 |

### 2.3 推荐操作步骤（Native）

**A. 初始化**

```bash
cstl init --cursor
```

确认存在 `.trellis/workflow.md`、`.cursor/rules/cstl-triage.mdc`、`.cursor/agents/cstl-*.md`。

**B. Triage**

由规则要求 Agent 在回复首行标注分类；勿只靠 hook 注入 workflow。

**C. 派发子任务（关键）**

```bash
python ./.trellis/scripts/generate_dispatch_prompt.py --agent research --task ".trellis/tasks/你的任务目录"
```

将 `--agent` 改为 `implement` 或 `check`。复制**整段输出**，在 Cursor Task 中 `subagent_type` 填 `cstl-research`（等），prompt 粘贴全文。  
**不要**假设 preToolUse 钩子一定会注入同样内容。

**D. 临时换子任务模型（仅 Native，用后还原）**

在对应 `.cursor/agents/cstl-*.md` frontmatter 临时加 `model: <id>`，派发后删除该行，避免提交 Git。

**E. 查外部资料**

```bash
python ./.trellis/scripts/run_smart_search.py "你的问题" --intent deep-research --json
```

仅在 smart-search 不可用时再降级用其他网页搜索。

---

## 第三部分：Cursor++ BYOK 环境

### 3.1 在 Native 问题之上的额外问题

| 问题 | 表现 |
| --- | --- |
| 子 Agent 模型跟主会话 | 无法 research A、implement B |
| frontmatter `model:` 无效 | 改了 agent 文件仍 inherit |
| Cursor 设置「每 Agent 模型」无效 | 日志仍 inherit parent |
| 无内置 @codebase 语义 | 计划写内置 semantic 会落空 |
| 补丁升级失效 | 更新后模型又回到继承 |

### 3.2 cursor-trellis 的解决办法

| 做法 | 说明 |
| --- | --- |
| 环境检测 | `TRELLIS_CURSOR_BYOK` 或 `~/.ccursor/routes.json` |
| BYOK 语义 | 检索计划用 **fast-context MCP**（`fast_context_search`），不用内置 semantic |
| 可选包 | `cstl init --cursor --cursor2plus` → `.trellis/local/cursor2plus/` |
| 子任务上下文 | 与 Native 相同：CLI 生成派发说明为主路径 |
| 映射文件 | `~/.ccursor/trellis-task-models.json5` 或 `.trellis/local/subagent-models.json` |
| 可选补丁 | `patch_wpelc8.py`：仅在你明确同意后执行 |

### 3.3 推荐操作步骤（BYOK）

**1. 初始化**

```bash
cstl init --cursor --cursor2plus
```

Native 用户可忽略整个 `cursor2plus` 目录。

**2. 配置映射（先只看、不写程序）**

编辑 `~/.ccursor/trellis-task-models.json5`（slug 来自 `providers.json` 的 `id`，**勿公开该文件**）：

```json5
{
  "cstl-research": "model-xxx",
  "cstl-implement": "model-yyy",
  "cstl-check": "model-zzz"
}
```

```bash
cd .trellis/local/cursor2plus
python patch_wpelc8.py --print-map
```

**3. 应用补丁（高风险，须本人同意）**

```bash
python patch_wpelc8.py
```

然后 **Developer: Reload Window**。派发测试 Task，确认子 Agent 自报模型与主会话不同（若你配置了不同 slug）。

**4. 升级后**

重新 print-map / patch，或 `python patch_wpelc8.py --revert` 后重载。

**5. 不想打补丁**

| 方案 | 场景 |
| --- | --- |
| 继承主会话模型 | 一个模型够用 |
| Explore 子 Agent | 只读探索，在 Cursor++ 面板选模型 |
| 手动派发 | 新对话选手动模型 + 粘贴 CLI 生成的派发说明 |

也可用斜杠命令 `/cstl-cursor2plus-setup` 引导配置。

---

## 第四部分：仍存在的不足

### 4.1 平台侧

- 钩子注入类问题在官方修复前都会影响依赖钩子的产品。
- 子 Agent 模型路由仍有论坛投诉；需跟 changelog。
- Agent 语义搜索难以向用户证明「一定执行了」。
- Cursor++ 与 Cursor 版本差导致补丁滞后。
- Automations 与 Trellis 任务生命周期如何对齐尚无定论。

### 4.2 cursor-trellis 侧

| 缺口 | 计划 |
| --- | --- |
| Native 下 frontmatter `model:` 最新版 E2E 待补 | 单独测试并更新本文 |
| 检索「计划 vs 执行」telemetry 不足 | 报告与测试增强 |
| 三种子任务入口对新手仍绕 | 决策树文档 |
| `task.py select` 部分环境失败 | 文档强调传 `--task` 路径 |
| retrieval-pack 消费链不完整 | finish/check 引用 |
| 补丁绝不默认执行 | smoke 与 setup 引导 |

### 4.3 请勿误导他人的说法

- 「钩子会自动把 workflow 塞进 Agent」——**错**
- 「BYOK 改 agent 的 model 一行就能换子任务模型」——**通常错**
- 「Agent 保证每轮语义搜索」——**无法保证**
- 「打补丁是 init 必做」——**错**

---

## 第五部分：自检清单

**每次 `cstl update` 后**

- [ ] `cstl-triage.mdc` 存在且 `alwaysApply: true`
- [ ] 派发子任务前运行 `generate_dispatch_prompt.py` 并粘贴**全文**

**Native**

- [ ] 未误用 Cursor++ 补丁
- [ ] 外部资料优先 smart-search

**BYOK**

- [ ] 检索计划用 fast-context，非内置 @codebase
- [ ] 升级后检查补丁；未泄露 `providers.json`

---

## 第六部分：外部证据链接汇总

| 主题 | 链接 |
| --- | --- |
| sessionStart #158452 | https://forum.cursor.com/t/sessionstart-hook-additional-context-is-never-injected-into-agents-initial-system-context/158452 |
| sessionStart #157141 | https://forum.cursor.com/t/sessionstart-hook-output-is-accepted-and-merged-but-the-injected-context-does-not-reach-agent-window/157141 |
| postToolUse #156157 | https://forum.cursor.com/t/cursor-hooks-additional-context-not-injected-in-agent-context-in-posttooluse/156157 |
| Hooks 文档 | https://cursor.com/docs/hooks |
| SubAgent 路由 #151917 | https://forum.cursor.com/t/subagent-task-tool-ignores-model-specific-subagent-type-routing-all-subagents-inherit-parent-model-instead-of-using-their-designated-models-opus-codex/151917 |
| Changelog 2.4 | https://cursor.com/changelog/2-4 |
| Fast regex search | https://cursor.com/blog/fast-regex-search |
| Automations | https://cursor.com/blog/automations |

维护者本地追溯：`.trellis/tasks/06-26-cursor-platform-adaptation-research/`、`.trellis/workspace/smart-search/20260625t*/manifest.json`。

---

## 相关文档

| 文档 | 内容 |
| --- | --- |
| [cursor.zh-CN.md](cursor.zh-CN.md) | 初始化与生成文件 |
| [subagents.zh-CN.md](subagents.zh-CN.md) | 三个 trellis 子 Agent |
| [retrieval.zh-CN.md](retrieval.zh-CN.md) | 检索与 Native/BYOK |
| [workflow.zh-CN.md](workflow.zh-CN.md) | 任务生命周期 |

**反馈**：[cursor-trellis Issues](https://github.com/blxzer77/cursor-trellis/issues)（附 Cursor 版本、Native/BYOK、复现步骤）。

**文档版本**：1.0（2026-06-26）
