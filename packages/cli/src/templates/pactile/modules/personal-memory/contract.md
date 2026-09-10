# `personal-memory`

P29 表名：`personal-memory`（不得改名）。层：on-demand。

## 职责

跨 Task 的可搜索个人记忆。默认 **Task-first**：续作先读当前/归档任务产物、Kernel 审计、Close 摘要。Journal 不是 Baseline，不常驻注入 Session 包。本块按需提供：检索「上次…」跨任务记忆；可选地在用户要记下时才 Capture 一条；**Close 收尾时由机器写入 Notes 索引投影**（非正文，详见「Close Notes 索引投影」）。安装不预建默认 Journal。Developer Identity（路径用的开发者 id）可以在安装时存在，但不等于本块已激活，也不进每回合 Prompt。

### Close Notes 索引投影

Close 边界按学习 disposition 写 Notes 索引投影（`note-projection`，见 `close-basic`）：**≤N token 的摘要 + 路径指针**（N 由 S2/P1 定，占位不填值），进 `context-progressive` **第 4 层检索**，**不常驻注入**（不进第 2 层常驻）。

**投影 ≠ journal 正文**：

| 轨 | 谁写 | 形态 | 供谁 |
| --- | --- | --- | --- |
| Notes 索引投影 | 机器（Close 自动） | ≤N token 摘要 + 路径指针 | 供检索 |
| journal 正文 | Agent 主动 | 完整正文 | 供阅读 |

二者不同轨。投影是机器在 Close 边界旁路写入的槽位，不要求 Agent 每次收工「写日记」，也不进常驻 Prompt；journal 仍是"首次 Capture 才物化"、"Journal 不是 Evidence"的既有语义，本条款只额外给了一把机器自动写的检索钥匙，不改变 journal 的物化与地位。

## 触发/披露

未触发当没装。日常 Open→Close 只靠任务目录。触发（可审计）：

1. 用户问跨任务的「上次 / 我们是不是说过 / 搜 journal」；或
2. 用户明确要记一条跨任务备忘。

**不是**触发：有 `selected_task` 的普通续作（Continue / 任务产物即可）；SessionStart；Close 强制写 journal。

问完/记下后从常驻包消失。

Agent 看见：

1. 有选中任务时，先读该任务产物。不得用 journal 代替 PRD/Evidence。
2. 跨任务才搜记忆；命中以路径+短摘要进第 4 层，不把 journal 全文灌进第 2 层。
3. 首次 Capture 才物化 `.pactile/workspace/<id>/journal-*.md`。未激活不得在 SessionStart 打印 journal 行数当教战。
4. Journal 不是 Evidence、不是长期 spec、不是 session-transfer 过境文档。
5. `init_developer` / `.developer` 若已存在，只用于路径；不因此加载本块正文。

用户看见：只有主动回忆或要记下时才出现记忆搜索。没有常驻「日记必须写」的仪式。新安装可以没有 journal 文件。Notes 索引投影是机器在 Close 边界自动写的，用户只在需要时（如未来窗口检索）看到它，收工时不机械问「要不要写记忆」。

## 停止条件

- Task-first vs 跨任务搜索的分界。
- 触发与非触发；首次 Capture 才物化。
- Notes 索引投影：走第 4 层检索、不进第 2 层常驻；缺投影槽与缺 journal 都不挡 Close（Close 只留痕）。
- 停止：SessionStart 注入 journal 正文或当方法论；把 Notes 投影当 journal 正文常驻注入；用 journal 或投影当 Close 完成条件；用记忆代替任务 SSOT；安装预建空 journal。

## 关掉必须消失

不注入 journal、不做跨 Task 记忆检索、不要求写日记。`.pactile/tasks/`、Continue、`selected_task` 仍在。Identity 文件可以留着当路径，不进 Prompt。

## 不得带走

任务产物与审计（Kernel / `close-basic`）；过境 handoff（`session-transfer`）；长期 spec（`spec-learning`）；编译器常驻包（`context-progressive`）；检索 pack（`retrieval-extended`）。