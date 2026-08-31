# `context-progressive`

P29 表名：`context-progressive`（不得改名）。层：baseline。

## 职责

唯一上下文编译器，也是渐进式披露的机械保证。输入只有：Kernel 的 Phase / Condition / Outcome、已激活模块列表、当前需要的产物角色。输出一份预算内的 Session 包（可去重、带来源与 freshness）。Baseline 只带四类检索意图（exact / semantic / structural / external），不绑 codegraph、fast-context 或任何 Agent 工具名。`workflow.md`、AGENTS 长文、`[workflow-state:*]` 整坨方法论**不是**合法输入。Adapter 只负责注入编译结果，不负责拼方法论。

## 触发/披露

五层，按序，不得跳层一次灌全：

1. 常驻最小：阶段、关键约束、下一动作（无任务时几乎只有这些 + 若发生 Intake 事件则加 intake 短契约）。
2. 已激活模块短契约（仅当前 Phase 需要的那些）。
3. 当前阶段产物片段（如 Define 的 PRD/AC，不是整个 task 目录）。
4. 有事实缺口才检索（薄路由；打分/pack 归 `retrieval-extended`）。
5. 失败或复杂卡住才深诊断（break-loop、完整指南）。

编译器自己几乎没有「教战」；它决定别人谁能进包。过了阶段，上一阶段模块正文从常驻包掉下去，需要时按产物角色再取片段。

Agent 看见：

1. 当前包里没有的模块 = 当作没装。不得自己去读 `workflow.md` 当 SSOT 补回来。
2. 无 `selected_task`：不装任务产物；不装 Parent/Worker/VCS 教战。
3. Worker / Resume 包与 Session 包语义分离：工人只带其任务路径与合同片段，不继承「整份梯子」。
4. SessionStart 若只能注入编译结果；禁止再切 `workflow.md` 的 Phase Index 当 overview。

用户看见：默认简单。高级模块用到才出现。不靠一次打开就看到全部 CSTL。

## 停止条件

- 输入集合：Kernel 的 Phase / Condition / Outcome、已激活模块列表、当前需要的产物角色。非法输入：上帝文档、未激活模块正文。
- 五层顺序与预算/去重/provenance/freshness 义务（数值实现后置）。
- 有任务才装产物；Lite Single 拒绝把 Parent/VCS/Memory/Retention/retrieval-extended 塞进常驻包。
- 停止：把未激活模块「顺便」编进去；用 workflow 切片冒充第 1 层。
- 不新增第五个常驻检索意图。

## 关掉必须消失

没有 CSTL 上下文包。Adapter 仍可起会话，但没有模块化披露。缺本槽则渐进式披露无法验收。

## 不得带走

各模块短契约正文的所有权；Event Bridge 总线（Adapter）；检索打分与 stop 钩（`retrieval-extended`）；journal 常驻注入（`personal-memory`）。
