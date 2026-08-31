# `session-transfer`

P29 表名：`session-transfer`（不得改名）。层：on-demand。

## 职责

把**还在飞的工作**搬到另一个会话 / 人 / 宿主 / 目录。产出一份一次性过境文档（默认写 OS temp，不进仓库、不当任务证据）。`/cstl-handoff` 是 Adapter 的平台入口；本块拥有正文契约（何时搬、写什么、不写什么）。与 Child 的 `integration-handoff`（任务目录里的集成证据）分 owner。不是 Continue，不是 Compact，不是派工包。

## 触发/披露

未触发当没装。日常 Open→Close、同窗继续，看不见本块。触发（可审计）：用户显式要搬走，或阶段边界判定「工作需要旅行」（换宿主、换目录/仓、交给同事、分叉旁路）。

**不是**触发：同宿主同目录接着做（Continue / Compact）；派一个工人（`worker-orchestration`）；Child 向 Parent 交集成证据（`parent-child`）；Close 收尾。

写完并交出路径后，本块教战从常驻包消失。

Agent 看见：

1. 先问清下一会话用途，按用途裁剪「为什么」，不整段复制会话。
2. 写 temp 文件，回报**完整绝对路径**，并提醒 temp 易挥发。需要跨小时/跨宿主时，请用户立刻拷到耐久位置。
3. 只引用磁盘路径（任务目录、spec、ADR、commit），不粘贴 PRD/diff 正文。密钥/token/PII → `<REDACTED>`。事实与未验证信念必须分开写。
4. 不得写入 `.cstl/tasks/<dir>/handoff.md` 冒充集成证据；不得把过境文档当长期 spec。
5. 不得用 shell 引号把全文塞给下一个 Agent（截断）。下一个 Agent 去读文件路径。
6. 不自动 hook 交接；不在 Close 时强制写一份。

用户看见：少数逃生舱之一。用时得到一条 temp 路径。同窗接着做只用 Continue，不出现本块。

## 停止条件

- 触发与非触发（五问里本块只占 Handoff）。
- 产出位置（OS temp）与必须回报绝对路径。
- 内容角色：Goal / Done / Blocked / Next / 按用途裁过的 whys / Facts vs beliefs / 指针。
- 停止：与 `integration-handoff` 混用；同窗续做却写 handoff；把过境文档当任务证据或长期记忆；泄露密钥。

## 关掉必须消失

不能生成跨窗过境文档、Prompt 无搬运教战。Continue / Compact / 选中任务指针仍在。Parent 集成交接若 `parent-child` 开着仍在。

## 不得带走

`integration-handoff` 与集成权（`parent-child`）；Continue 与窗口标题（Adapter）；`selected_task`（Kernel）；工人派工包（`worker-orchestration`）；journal 跨 Task 记忆（`personal-memory`）；物理 archive（`retention-storage`）。
