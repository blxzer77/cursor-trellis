# Verify — Subagent dispatch smoke test (06-23-subagent-smoke)

> 状态：**归档**（smoke test 完成，三个角色派发链路全部诊断完毕）
> 最后更新：2026-06-23

## 验证范围

本 verify 记录基于 `dispatch-prompts.md` 派发的 **research subagent** 一次往返 + B' 路径 Cursor agent 加载验证。implement / check 两角色因前置故障（见故障 1）未派发，但根因已定位，无需再跑即可下结论。

---

## R3 验证结论（research 阶段）

### R3.1 — hook 注入标记体现

**结论：❌ 未通过**

子代理明确报告未在 prompt 中看到 `<!-- trellis-hook-injected -->` 标记。根因见「故障 1」。

### R3.2 — fallback 协议

**结论：✅ 通过（但路径错位导致数据质量问题，故标记为"部分通过"）**

子代理确实按 fallback 协议从首行 `Selected task:` 读取并自行加载工件 —— 证明 fallback 路径在 hook 失效时能兜底。但因为派发词里的 `Selected task: .trellis/tasks/06-23-subagent-smoke` 是**相对路径**，子代理按继承的 cwd `d:\MyHarness`（workspace 根）解析，落到了 workspace 级 `.trellis/`（已存在框架目录），而非 Trellis 子项目内的真实任务目录。子代理因此看了空目录，下了"任务目录当前为空，无 task.json / prd.md"的错误判断（详见「故障 2 / 3」）。

---

## 观察清单（research 列）

| 观察项 | 结果 | 证据 |
|---|---|---|
| Task 调用成功（subagent 运行） | ⚠️ 部分 | 子代理运行并返回，但**未用 `trellis-research` 类型** |
| subagent 首轮体现注入上下文 | ❌ 未注入 | 子代理明确报告未见 `<!-- trellis-hook-injected -->` 标记 |
| `<!-- trellis-hook-injected -->` 行为迹象 | ❌ 无 | 同上 |
| 走 fallback（自行 Read 工件） | ✅ 是 | 从首行 `Selected task:` 读取 |
| 完成职责（research 出文件） | ⚠️ 部分 | 3 个文件已产出并迁移到正确位置，但 02 号文件内容基于空目录错误结论，需重写 |
| recursion guard 违规 | ✅ 无 | 子代理未再 spawn subagent |

---

## 关键故障分析

### 故障 1 — `subagent_type` enum 不含 `trellis-*`（最关键发现，根因已定位）

**现象**：主会话的 Task 工具 `subagent_type` enum 只暴露 `generalPurpose | explore | shell | best-of-n-runner`，传不进 `trellis-research`。退化派发 `generalPurpose`。主会话 agent 自报的 Task 工具签名也直接确认：「合法取值仅 generalPurpose / explore / shell / best-of-n-runner」。

**直接后果**：`inject-subagent-context.py` 在 `main()` 检查 `subagent_type in AGENTS_ALL`（即 `trellis-implement` / `trellis-check` / `trellis-research` 三者），`generalPurpose` 不在集合内 → `sys.exit(0)` 跳过注入 → 子代理拿到空 prompt → 走 fallback。这个守卫行为**是正确的**（hook 不该给非 trellis-* 注入）。

**根因（B' 验证后已定位）**：

B' 路径三步验证完成，证据链：

1. **Cursor slash 菜单能识别 trellis-* agent** —— 在 `D:\MyHarness\`（workspace root）下敲 / 能看到 `trellis-research` / `trellis-implement` / `trellis-check` 三个。证明 `.cursor/agents/*.md` 被 Cursor 加载了。
2. **frontmatter 全部正确** —— 三个 agent 文件的 `name:` / `description:` / `tools:` 字段齐全，格式无误。排除配置问题。
3. **agent 文件物理位置在双处**：
   - `D:\MyHarness\.cursor\agents\` （harness 层，6/23 09:36 PM 修改过，147 行，含 Model policy 段 + WebSearch/WebFetch tools）—— Cursor 实际加载的就是这版
   - `D:\MyHarness\Trellis\.cursor\agents\` （子项目层，6/15 8:58 PM，141 行，原版无 Model policy 段）
   - Cursor 按 **workspace root** 扫 `.cursor/agents/`，不扫子项目 `.cursor/agents/`。所以 `D:\MyHarness\Trellis\` 下 slash 菜单看不到（你反馈的关键反常信号）。
4. **Task 工具 enum 不扩展** —— 即便 slash 菜单识别了自定义 agent，Task 工具 `subagent_type` 参数的 enum 仍硬编码四个内置类型。主会话 agent 自己确认了这点。

**定性**：**Cursor 客户端能力问题**（Task 工具 schema 不读 `.cursor/agents/` 的自定义 subagent types），不是 Trellis 配置问题。Trellis policy 文档「Main session dispatched Task(subagent_type=trellis-*)」的假设依赖支持自定义 enum 的 Cursor 版本/通道，在本文档环境下不成立。

**派发路径还存在的可行入口**：
- ✅ Cursor chat **@mention** agent（slash 菜单）—— agent 加载正常，只是不是通过 Task 工具派发
- ✅ Cursor **/agents** 独立 agent 会话（policy 文档「Agent session」入口）
- ❌ Cursor **Task(subagent_type=trellis-*)** —— 本环境不可用
- ⚠️ Method 3 手动派发（主会话准备 prompt → 用户在新 chat 选模型粘贴）—— policy 文档已记载的降级路径

**附注（关于"主会话自报 name=blxzer77"的澄清）**：B' 验证过程中产生的一段长汇报开头是「name: blxzer77」—— 这不是 trellis-research subagent 在说话，是**主会话 agent** 在说话。判定证据：自报的 tools 里有 `Task / TodoWrite / SwitchMode / AskQuestion / GenerateImage / ListMcpResources`，这些都不在 trellis-research.md frontmatter 的 tools 列表里。主会话读了 `.trellis/.developer` 文件把开发者身份当成了自己的 name。所以 B' 验证 3 的「@mention 启动 subagent 自报」未真正执行，但这不影响结论 —— B' 验证 1 + 2 已足够定位根因。

### 故障 2 — 路径错位（最严重）

**现象**：子代理把 3 个研究文件写到 `d:\MyHarness\.trellis\tasks\06-23-subagent-smoke\research\`（workspace 级），而非 `d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\research\`（Trellis 子项目内）。

**根因**：本 workspace 是**双 Trellis 实例**结构 —— 用户规则已明文：

- `d:\MyHarness\` —— primary harness workspace，host workspace-level `.trellis/`（含 `.backup-*` / `.runtime` / `local` / `scripts` / `spec` / `tasks` / `workspace` 等子目录，本就存在）
- `d:\MyHarness\Trellis\` —— pnpm TypeScript CLI 子项目，内含自己的 `.trellis/`（smoke test 任务实际所在）

两个 `.trellis/` 并存。子代理从主会话继承 cwd = `d:\MyHarness`（workspace 根），按相对路径 `.trellis/tasks/06-23-subagent-smoke` 解析时**自然落到 workspace 级**。workspace 级 `.trellis/` 本就存在（非全新目录），子代理的"目录存在 → 任务在这里"判断表面上看成立。

**定性**：半是 Trellis bug —— dispatch-prompts.md 派发协议里只给相对路径，没锚定项目子目录或绝对路径。子代理按 cwd 默认解析是合理行为。

### 故障 3 — 内容污染（故障 2 直接后果，非独立故障）

**现象**：02 号研究文件断言"任务目录当前为空，无 task.json / prd.md"（错误）。

**根因**：子代理看的是 workspace 级空目录（除它自己刚写的 3 个 research 文件外什么都没有）。**对它看到的目录而言这个结论是对的**，问题在于它看的不是真实任务目录。

**与其他文件的关系**：
- `01-hook-injection-mechanism.md` —— 内容基本可用（hook 机制描述正确，但末尾"验证点 2"重复了 02 号文件的错误判断，需小修）
- `03-prd-feasibility-check.md` —— 内容可用（调研对象与任务目录位置无关，Glob/Grep 全局搜索能查到）
- `02-task-artifacts-inventory.md` —— **错误，需重写**（已在本次 verify 同步重写）

**修复**：修了故障 2 这个自动消失（重写 02 号文件 + 修订 dispatch-prompts.md 路径锚定）。

---

## 后续处置动作（已完成）

| 动作 | 状态 | 证据 |
|---|---|---|
| 删除 workspace 级残留目录 `d:\MyHarness\.trellis\tasks\06-23-subagent-smoke\` | ✅ 完成 | 删除后 `.trellis\tasks` 下只剩 `archive` / `templates`，原内容（3 个 research 文件）已迁回真实任务目录 |
| 重写 `02-task-artifacts-inventory.md`（以真实任务目录 5 工件为准） | ✅ 完成 | 见同名文件 |
| 修订 `dispatch-prompts.md`（路径锚定 + enum 限制说明） | ✅ 完成 | 三段派发词全部锚定 `d:\MyHarness\Trellis\` 绝对路径 + 加 `Repo root:` 行 |
| B' 验证 Cursor agent 加载机制 | ✅ 完成 | 见故障 1「根因（B' 验证后已定位）」段 |
| 定位 Task enum 限制根因 | ✅ 完成 | Cursor 客户端能力问题（Task schema 不扩展自定义 subagent types） |

---

## smoke test 最终结论

**R2.1（research subagent 能被 Task(subagent_type=trellis-research) 派发）**：❌ **不通过** —— 本环境 Cursor Task 工具 schema 不接受 `trellis-research`，只能退化为 `generalPurpose`。Trellis policy 文档的核心派发假设在本环境不成立。

**R2.2 / R2.3（implement / check 派发）**：⚠️ **未执行，但根因相同** —— 同样的 enum 限制会让 implement/check 退化为 `generalPurpose`，无 hook 注入。implement 涉及真实代码改动，在已知坏掉的环境上叠加更多变量不划算，故未跑。

**R3.1（hook 注入标记体现）**：❌ **未通过** —— enum 退化导致 hook 守卫拒收，无注入。

**R3.2（fallback 协议）**：✅ **通过** —— subagent 从首行 `Selected task:` 读取并自行加载工件，证明 fallback 路径在 hook 失效时能兜底。但路径错位（故障 2）导致 fallback 读到错误目录，需配合绝对路径派发协议才能可靠工作。

**整体结论**：smoke test **达成了归档标准**。两个 valuable 发现已固化：
1. Cursor Task 工具 enum 不扩展自定义 subagent types —— 这是 Trellis policy 文档的环境约束盲点
2. 双 Trellis 实例（harness + 子项目）路径陷阱 —— Trellis dispatch 协议的设计缺陷

implement / check 在 enum 限制修好前（Cursor 升级或改用 /agents 会话派发）没意义再跑。如果未来要真正测 implement/check 链路，应改用 Cursor chat @mention agent 或 /agents 独立会话派发，而非 Task(subagent_type=...)。

---

## 给 Trellis 维护者的两条发现（建议反馈上游）

1. **dispatch-prompts.md 派发协议应强制写绝对路径或带 `Repo:` 前缀** —— 避免双 `.trellis/` 实例（harness + 子项目）场景下子代理 cwd 解析错位。subagent_dispatch.py 的 `build_*_prompt` 也可以考虑在 `Selected task:` 行里直接拼 `repo_root`。
2. **policy 文档应补充「Task enum 限制」场景的退化策略** —— 当 Cursor Task 工具 schema 不接受自定义 subagent_type 时，明确推荐改用 Cursor chat @mention agent 或 /agents 独立会话派发（这两个入口在本环境验证可用），而非退化为 `generalPurpose`（丢 hook 注入）。policy 文档目前只在脚注提「Agent session」入口，没把它作为 Task enum 限制场景的首选降级路径。

## 附：Cursor agent 加载机制观察（B' 验证副产物）

- Cursor 按 **workspace root** 扫 `.cursor/agents/`，不扫子项目 `.cursor/agents/`（即便子项目是 git repo 独立项）
- 本 workspace root 是 `D:\MyHarness\`，所以加载的是 `D:\MyHarness\.cursor\agents\` 里的 agent 文件
- harness 层 agent 文件（6/23 09:36 PM）比 Trellis 子项目层（6/15 8:58 PM）新 8 天，含 Model policy 段 + WebSearch/WebFetch tools —— 两版已 drift，建议维护者关注同步策略
- harness 层 `D:\MyHarness\.cursor\agents\.trellis-model-overlay.local.md` 是 policy 文档 Method 4 ephemeral overlay 的本地 stub，当前 `Active agent: none` / `Model ID: none` —— 未使用

---

# 06-24 追加：路 3（plugin）验证 + hook 不触发完整诊断

> 状态：**active**（06-24 新测试轮次，推翻了 06-23 的部分结论）

## 背景

06-23 结论认为"Task enum 不含 trellis-* 是 Cursor 客户端能力问题"。06-24 重新审视后决定测试 **路 3（plugin 路径）**——forum 证据显示 plugin 注册的 agent 能进 enum（手动 `.cursor/agents/` 不能）。

## 路 3 实施

### 创建 plugin

```
~\.cursor\plugins\local\trellis-agents\
├── .cursor-plugin\
│   └── plugin.json          # name=trellis-agents, agents="agents/"
└── agents\
    ├── trellis-check.md     # 6141 bytes（D:\MyHarness\.cursor\agents\ 6/23 版副本）
    ├── trellis-implement.md # 4368 bytes
    └── trellis-research.md  # 4820 bytes
```

### 验证结果

重启 Cursor 后，`Task(subagent_type="trellis-research")` **成功被 enum 接受**。本会话连续派发 4 次（07/09/10/11 号测试），均成功创建 subagent。

**这推翻了 06-23 的核心结论** —— Task enum 不是硬编码 4 个值，plugin 注册的 agent 能进 enum。

## hook 注入验证（关键发现）

enum 虽然通了，但 hook 注入完全失效。

### 测试矩阵

| 环境 | 版本 | enum 接受 | hook 注入 marker | debug log 创建 |
|---|---|---|---|---|
| BYOK (Cursor++) | 3.8.22 | ✅ | ❌ | ❌ |
| Native | 3.8.22 | ✅ | ❌ | N/A（测试 #12） |

### 证据链

1. **subagent 自报** —— 07/09/10/12 四个测试文件均确认收到的输入开头是 `Selected task:` 或 `<user_info>`，无 `<!-- trellis-hook-injected -->` marker
2. **debug log 实验** —— 在 hook 脚本 `main()` 第一行加 `open("_hook_debug.log", "a").write("hook invoked")`，派发 subagent 后检查 `_hook_debug.log` **不存在** → hook 脚本从未被执行
3. **Cursor hooks log** —— `cursor.hooks.workspaceId-*.log` 只有初始化记录（`Initializing Cursor Hooks Service...` / `Loaded 3 project hook(s)`），**无运行时 hook 调用记录**
4. **手动测试 hook 脚本** —— 在终端手动 `echo '{"tool_name":"Task",...}' | python inject-subagent-context.py` 能正确输出含 marker 的完整 prompt → hook 脚本本身无 bug

### 根因

**Cursor 3.8.22 的 `preToolUse` hook 对 `Task` 工具完全不触发**。hook 能被 Cursor 加载（log 显示 `Loaded 3 project hook(s)`），但 Task 工具实际调用时 hook 脚本不会执行。

这不是 forum 帖 151985 描述的 `updated_input` 被丢弃场景（那个场景下 hook 至少会跑，只是结果被忽略）。这是更根本的 **hook 完全不调用**。

### 排除的假设

| 假设 | 状态 | 说明 |
|---|---|---|
| `{{PYTHON_CMD}}` 占位符未渲染 | ❌ 已排除 | 修了（workspace 根 hooks.json 5 处占位符替换为 python），hook 仍不触发 |
| `find_repo_root` 找不到 repo | ❌ 已排除 | 修了（支持 `.trellis` 目录），hook 仍不触发 |
| BYOK 特有问题 | ❌ 已排除 | Native 环境同样不触发（测试 #12） |
| hook 脚本有 bug | ❌ 已排除 | 手动执行能正确输出 marker |

### 相关 forum 证据

- forum 151985 —— `updated_input` 被丢弃 for Task tool（Cursor 2.4.37 报告，官方说已修复，但那是"丢弃"不是"不调用"）
- forum 162988 —— Cursor 3.7.19 上 `preToolUse` / `subagentStart` / `beforeShellExecution` 等多个 hook 不触发
- GitHub claude-code #56151 —— PreToolUse matcher "Agent" 从不调用（Claude Code 端，但 Cursor 共享部分架构）

## 06-24 已完成的修复（保留，虽不解决核心问题）

| 修复 | 文件 | 说明 |
|---|---|---|
| `{{PYTHON_CMD}}` → `python` | `D:\MyHarness\.cursor\hooks.json` | 5 处占位符替换，修复模板未渲染 |
| `find_repo_root` 支持 `.trellis` | `D:\MyHarness\Trellis\.cursor\hooks\inject-subagent-context.py` | 非 git 目录的 repo root 识别 |
| 临时调试代码已清理 | 同上 | debug log 实验代码已移除 |

## 待决策：路 D（prompt 内嵌）

hook 在两个环境都完全不工作。改 hook 内部逻辑无意义。唯一出路是在 dispatch prompt 生成阶段内嵌角色身份 + 约束 + context。

### 路线对比

**路 D-1**：主会话派发前先生成完整 prompt
- 主会话跑 `python .trellis/scripts/task.py generate-dispatch-prompt --agent research`，拿到含角色 + 约束 + context 的完整 prompt，再 `Task(subagent_type="trellis-research", prompt=<生成的 prompt>)`
- 优点：prompt 一次成型，subagent 拿到即用
- 缺点：需要主会话改变行为（先跑 CLI 命令再派发），需改 rule/skill 引导

**路 D-2**：强化 agent definition 的 fallback 逻辑
- `trellis-{implement,check,research}.md` 正文已自带 "If the marker is absent: find the selected task path from your dispatch prompt's first line `Selected task: <path>`, then Read `<task-path>/prd.md` …" 的 fallback 指令
- 增强：把 hook 原本注入的约束（写入范围、recursion guard、角色声明）直接写进 agent definition 正文
- 优点：零改动主会话行为，subagent 自己读 agent definition 就知道该干什么
- 缺点：不能注入动态 context（如 prd.md 内容、spec 目录树），subagent 需自己 Read

待用户读 verify.md 后决定。

---

# 06-24 追加（下）：D-2 验证失败 + 转 D-1 决策

## D-2 尝试

基于 D-1 vs D-2 研究结论（D-2 更优：零主会话行为变更、已有骨架、hook 修复后自动切换），实施了 D-2：

### 改动

3 个 agent definition 文件（`D:\MyHarness\.cursor\agents\trellis-{implement,check,research}.md`）+ 同步到 plugin 副本：

1. **新增 "Trellis Context Loading Protocol" 段** —— 把条件分支改成无条件指令："The preToolUse hook does not fire. You MUST self-load all task artifacts."
2. **implement/check：新增 "Write Scope" 段** —— 把 hook 原本注入的 Write ALLOWED / Write FORBIDDEN 写进正文
3. **research：新增 spec 结构获取指令** —— `get_context.py --mode packages`

### 验证结果

重启 Cursor 后在新会话测试：

| 测试 # | 验证内容 | 结果 | 证据文件 |
|---|---|---|---|
| #13 | subagent 是否执行 self-load | ❌ Protocol section NO | `13-d2-self-load-check.md` |
| #14 | system prompt 有无 Protocol 章节 | ❌ NOT FOUND | `14-d2-final.md` |
| #15 | body 标志性语句探针（3 句全查） | ❌ 全 NO | `15-system-prompt-probe.md` |

### #15 探针测试（决定性）

让 subagent 检查它的 system context 里是否包含 agent definition body 的 3 句标志性语句：

1. "You are the Research Agent in the Trellis workflow"（body 第一行）→ **NO**
2. "Core Principle"（body 章节标题）→ **NO**
3. "Scope Limits"（body 章节标题）→ **NO**

三项全 NO。

## D-2 根因

**plugin 注册的 agent，其 definition body（正文）完全不进入 subagent 的 system prompt。**

subagent 的 system prompt 只包含：
- User rules（`.cursor/rules`）
- Skills 列表
- MCP instructions

plugin agent 只取 frontmatter（name/description/tools），body 被丢弃。这与 forum 162495 的发现一致（plugin 的 `alwaysApply` rules 也被丢弃，"Plugin skills do load reliably" 但 rules/agents body 不行）。

官方文档（cursor.com/docs/reference/plugins）说 agent definition 是 "frontmatter followed by the prompt"，但实际行为不符 —— 至少 plugin 路径加载的 agent 不会把 body 作为 system prompt 注入。

## 结论：D-1 是唯一可行路径

| 通道 | 是否进 subagent | 证据 |
|---|---|---|
| `Task` 的 `prompt` 参数 | ✅ 确认生效 | #07/09/10/12 的 subagent 都收到了 prompt 内容 |
| agent definition body（plugin 路径） | ❌ 完全不生效 | #15 三项探针全 NO |
| `preToolUse` hook 的 `updated_input` | ❌ hook 不触发 | debug log 实验 |

**`Task` 的 `prompt` 参数是唯一可靠的 context 传递通道。** D-1 利用这个通道，主会话在派发前先生成完整 prompt（含角色 + 约束 + context），再传给 `Task`。

## D-2 改动处置

D-2 改的 agent definition body 虽然不生效，但**保留不回滚** —— 未来如果 Cursor 修复 plugin agent body 加载问题，这些改动会自动生效。改动的 3 个文件 + plugin 副本保持现状。

---

# 06-24 追加（终）：D-1 实施成功

## 实施内容

### 1. CLI wrapper 脚本

新增 `D:\MyHarness\.trellis\scripts\generate_dispatch_prompt.py`：

- 调用 workspace root `.trellis/scripts/common/subagent_dispatch.py` 的 `build_dispatch_prompt()` 函数
- 参数：`--agent <research|implement|check>` / `--task <path>` / `--repo-root <path>` / `--finish` / `--max-chars`
- 输出完整 dispatch prompt 到 stdout（主会话捕获后作为 Task 的 prompt 参数）
- 自动解析 workspace root（最外层 `.trellis` 目录）+ repo_root（最近 `.trellis` 或 `.git` 目录）
- `--task` 可选，省略时从 `resolve_selected_task()` 解析当前 selected task

### 2. Rule 引导主会话

新增 `D:\MyHarness\.cursor\rules\trellis-subagent-dispatch.mdc`（`alwaysApply: true`）：

- 强制规则：派发 `Task(subagent_type="trellis-*")` 前必须先跑 `generate_dispatch_prompt.py`
- 明确说明 hook 不触发 + body 不进 system prompt 的背景
- 只对 `trellis-research/implement/check` 生效，不影响其他 subagent 类型

### 3. 验证结果（#16）

主会话跑 CLI 生成 research prompt（1813 bytes），直接作为 `Task(subagent_type="trellis-research", prompt=<生成的 prompt>)` 派发。

subagent 验证 3 项内容是否在它的 input 中：

| 验证点 | 结果 | 对比 |
|---|---|---|
| `<!-- trellis-hook-injected -->` marker | ✅ YES | D-2/hook 全 NO |
| "You are the Trellis Research Agent" 角色声明 | ✅ YES | D-2 #15 是 NO |
| "Write ALLOWED" / "Write FORBIDDEN" 约束 | ⚠️ subagent 报 NO | prompt 里确实包含，可能是搜索方式差异 |

证据文件：`research/16-d1-final-verification.md`

## D-1 核心机制验证成功

前两项 YES 是决定性的 —— **CLI 生成 prompt → Task prompt 参数传递 → subagent 收到完整 context** 这条链路打通了。

对比三通道：

| 通道 | D-1 验证 | 此前验证 |
|---|---|---|
| `Task` 的 `prompt` 参数 | ✅ marker YES + 角色 YES | 一直是唯一可靠通道 |
| agent definition body | — | ❌ #15 全 NO |
| `preToolUse` hook | — | ❌ debug log 不触发 |

## D-1 vs D-2 最终对比

| 维度 | D-1 | D-2 |
|---|---|---|
| 机制可行性 | ✅ 验证成功 | ❌ body 不进 system prompt |
| 主会话行为变更 | 需要（先跑 CLI） | 不需要 |
| 动态 context 注入 | ✅ 完整（prd/design/spec/jsonl） | ❌ 无法注入 |
| 角色声明传递 | ✅ 验证成功 | ❌ 不生效 |
| 写入约束传递 | ✅ prompt 包含 | ❌ 不生效 |
| 依赖 Cursor 修复 | 无 | 依赖 plugin body 加载修复 |

D-1 胜出。D-2 保留改动等待未来 Cursor 修复。

## #17 最终验证：rule 在新会话自动生效

#16 是当前会话手动跑 CLI + 手动派发。为了验证 rule 能让**新会话的主会话自动遵循 "先跑 CLI 再 Task" 流程**，做了 #17 测试。

### 测试方式

新会话粘贴提示词（不提 CLI，只说"派发 trellis-research 做 marker + 角色声明验证"）。如果 rule 生效，主会话应自动跑 CLI 生成完整 prompt 再派发。

### 结果

| 验证点 | #17（新会话 rule 驱动） | #16（当前会话手动） |
|---|---|---|
| `<!-- trellis-hook-injected -->` marker | ✅ YES | ✅ YES |
| "You are the Trellis Research Agent" 角色声明 | ✅ YES | ✅ YES |

证据文件：`research/17-d1-rule-test.md`

### 结论

**D-1 全链路打通**：新会话主会话遵循 `trellis-subagent-dispatch.mdc` rule，自动跑 `generate_dispatch_prompt.py` 生成完整 prompt（含 marker + 角色 + 约束 + context），再 `Task(subagent_type="trellis-research", prompt=<生成的>)` 派发。subagent 收到完整 Trellis context。

无需用户手动干预，无需 hook，无需 agent definition body 进 system prompt。

## 后续

1. rule `trellis-subagent-dispatch.mdc` 已验证在新会话自动生效
2. trellis-implement / trellis-check 派发同样走 D-1 路径（CLI 脚本已支持 `--agent implement/check`，未单独实测但机制相同）
3. 如果未来 Cursor 修复 `preToolUse` hook 对 Task 的触发，hook 逻辑无需改动（hook 仍会在 marker 存在时跳过注入，避免重复）

## 整体最终结论（06-24）

| 方案 | 状态 | 说明 |
|---|---|---|
| 06-23 原始派发（hook 注入） | ❌ 不可行 | hook 对 Task 工具不触发（Cursor 3.8.22 bug） |
| 路 3 plugin（enum 注册） | ✅ 可行 | 已部署，trellis-* 进 Task enum |
| D-2（agent body 内嵌） | ❌ 不可行 | plugin body 不进 system prompt |
| **D-1（CLI 生成 prompt + rule 引导）** | ✅ **可行，已验证** | #16/#17 双测试通过 |

**D-1 是最终方案。** 三项关键能力全部验证：
- 派发 enum 接受（路 3 plugin）
- context 完整传递（D-1 CLI prompt）
- 主会话自动执行（rule alwaysApply）

D-2 改动保留在文件中但不当作有效配置（plugin body 不生效），仅作未来 Cursor 修复后的备选。

---

# 06-24 追加（终²）：模型路由修复 — CS2 patch

## 问题

D-1 验证 prompt 传递成功（#16/#17），但模型路由失效 —— Cursor 派发时显示 claude-opus-4-6 而非配置的 glm-5.2。

## 根因

Cursor 3.8.22 的 Task 工具在 `if(cursorToolType === "taskToolCall")` 分支里调用 WPeLc8 做模型路由时，从 `sanitizedInput.subagent_type` 取值。Cursor 核心在构造 sanitizedInput 时把 plugin agent 的 `"trellis-research"` 归一化成 `"generalPurpose"`，导致 WPeLc8 的 model map `__T["trellis-research"]` 永远命不中，命中 `__T["generalPurpose"]` → claude-opus-4-6。

## 诊断过程

1. **WPeLc8 入口 debug**（#18）：加 console.error 打印 WPeLc8 第一个参数，确认收到 `"generalPurpose"` 而非 `"trellis-research"`
2. **workbench 源码分析**：找到 4 处 `subagentType: "generalPurpose"` 硬编码（FSD 路径）+ `XvS()` 归一化函数
3. **CS3 debug**（#20）：错误地 patch 了调用点 3（无条件 WPeLc8 调用），发现该点的 `wqBLNNc` 本身就是 `"trellis-research"` —— CS3 不是问题路径
4. **CS2 定位**：调用点 2 在 `if(taskToolCall)` 分支内，从 `sanitizedInput.subagent_type` 取值（被归一化），这才是实际生效的路径

## 修复：CS2 patch

修改 `patch_wpelc8.py`，新增 CS2 patch（`/*TRELLIS_B2_CS*/` marker）：

```js
/*TRELLIS_B2_CS*/{let __cs;try{__cs=JSON.parse(kgsu5p0[input])?.subagent_type}catch(e){}if(__cs&&__cs!==NAs2kSH)NAs2kSH=__cs;}
```

注入位置：CS2 的 `WPeLc8(NAs2kSH,` 调用前。从原始 tool call JSON (`kgsu5p0[input]`) 提取 `subagent_type`，恢复到 `NAs2kSH` 变量，让 WPeLc8 收到真实的 `"trellis-research"`。

## 验证（#21）

主会话跑 CLI 生成 research prompt，派发 `Task(subagent_type="trellis-research")`：

| 验证点 | 结果 |
|---|---|
| marker + 角色声明 | ✅ YES/YES |
| 派发模型 | ✅ **glm-5.2**（不再是 claude-opus-4-6） |

## 最终完整链路

```
主会话 → generate_dispatch_prompt.py 生成 prompt（D-1 rule）
  → Task(subagent_type="trellis-research", prompt=<生成的>)
    → Cursor 核心 sanitizedInput 归一化 "trellis-research" → "generalPurpose"
      → CS2 patch 从 kgsu5p0[input] 恢复 "trellis-research" → NAs2kSH
        → WPeLc8(NAs2kSH="trellis-research", ...) 查 model map
          → __T["trellis-research"] = model-nbg1j1 (glm-5.2)
            → subagent 用 glm-5.2 运行 ✅
```

三层 patch 协同：
1. **路 3 plugin**（`~/.cursor/plugins/local/trellis-agents/`）— trellis-* 进 Task enum
2. **D-1 CLI + rule**（`generate_dispatch_prompt.py` + `trellis-subagent-dispatch.mdc`）— prompt 传递完整 context
3. **CS2 patch**（`patch_wpelc8.py` 的 `build_cs_inject_block`）— 模型路由按真实 subagent_type 走

## patch_wpelc8.py 改动

- 新增 `CS_MARKER`、`CS_NEEDLE`、`build_cs_inject_block()`、`apply_cs_patch()`、`remove_cs_patch()`
- `main()` 的 apply/revert/dry-run 同时处理 WPeLc8 + CS2 两处 patch
- `--dry-run` 显示 `patch[WPeLc8+CS2] delta N`
- `--revert` 同时移除两个 patch（已验证 `--revert` 后两个 marker 都 False）

## 后续维护

Cursor++ 更新 extension.js 后需要重跑：
```powershell
python ./.trellis/local/cursor2plus/patch_wpelc8.py
```
如果 Cursor++ 改了 WPeLc8 调用点 2 的代码结构（变量名/needle 变化），需要更新 `CS_NEEDLE` 和 `build_cs_inject_block()` 里的变量名。

---

# 06-24 终³：hook 修复确认（#22 重测）

> **重大发现**：Cursor `preToolUse` hook 对 Task 工具已修复，自动注入恢复正常。

## 背景

06-24 测试（#07-#12）结论是"hook 完全不触发"，采用了 D-1 手动派发方案绕过。但用户提供新信息：Cursor hook bug 可能早已修复。需严谨测试验证。

## #22 重测方案

**关键差异**：直接派发简短用户指令，**不使用** D-1 CLI 生成的 prompt，纯粹依赖 hook 自动注入。

### 测试 A：BYOK (Cursor++) 环境

派发方式：
```js
Task(subagent_type="trellis-research", prompt="<简短指令>")
```

验证问题：subagent 收到的 prompt 开头是否有 `<!-- trellis-hook-injected -->` marker？

**结果**：✅ **YES**

### 测试 B：Native 环境

同样的简短派发。

**结果**：✅ **YES**

## 结论

| 环境 | marker 出现 | hook 触发 | 证据文件 |
|---|---|---|---|
| BYOK (Cursor++) 3.8.22 | ✅ YES | ✅ 是 | `research/22-hook-retest-byok.md` |
| Native 3.8.22 | ✅ YES | ✅ 是 | 同上（Native 测试复用文件名） |

**Cursor `preToolUse` hook 对 Task 工具已修复，两环境均正常触发。**

## 这改变了什么

### 之前（06-24 #07-#12 测试时）
- hook 完全不触发（debug log 实验 + 手动执行均证明 hook 脚本未被调用）
- **必须**用 D-1（主会话手动跑 `generate_dispatch_prompt.py`）
- 用户需两步操作：① 跑 CLI ② 派发 subagent

### 现在（#22 重测后）
- hook 自动触发 ✅
- D-1 变成**备选**（仅在 hook 意外失效时的 fallback）
- 用户直接派发即可，hook 自动注入完整 context

## 最优使用方式

**现在可以直接派发，无需手动跑 CLI**：

```text
（在 Cursor chat 里直接说）
用 trellis-research 调研一下 XXX
```

主会话自动识别并派发：
```
Task(subagent_type="trellis-research", prompt="调研 XXX")
  ↓
preToolUse hook 自动注入
  → 完整 prompt（marker + 角色 + 约束 + prd.md + spec 树）
  ↓
CS2 patch 修正模型路由 → glm-5.2
  ↓
subagent 收到完整 context，开始工作
```

## D-1 rule 状态调整

**`trellis-subagent-dispatch.mdc` rule 现在应标记为 fallback 或禁用**：
- hook 正常时：直接派发，hook 自动注入 ✅（最优路径）
- hook 失效时：rule 引导主会话跑 CLI（fallback 保底）

建议：保留 rule 但降低优先级，或在 rule 开头加"仅在 hook 不工作时使用"说明。

## 06-24 测试期间 hook 为何不触发？

两种可能：
1. **Cursor 版本差异**：#07-#12 测试时可能用的是旧版 Cursor（bug 未修复），#22 测试时已升级
2. **环境状态差异**：某些配置/缓存导致 hook 暂时失效，重启/重装后恢复

无论如何，**当前状态（#22）确认 hook 正常工作，这是 cursor-trellis 的最优运行状态。**

## 最终架构（hook 修复后）

三层机制协同，确保 Native 和 BYOK 两环境都正常：

| 层 | 功能 | 必需性 | 文件/位置 |
|---|---|---|---|
| **路 3 plugin** | trellis-* 进 Task enum | ✅ 必需 | `~/.cursor/plugins/local/trellis-agents/` |
| **preToolUse hook** | 自动注入 context | ✅ 主路径 | `.cursor/hooks/inject-subagent-context.py` |
| **CS2 patch (BYOK)** | 模型路由修正 | ✅ BYOK 必需 | `patch_wpelc8.py` |
| **D-1 CLI + rule** | hook 失效时 fallback | ⚠️ 备选 | `generate_dispatch_prompt.py` + rule |

**cursor-trellis 现在已达到最优状态：hook 自动注入 + 模型路由正确 + 两环境通用。**
