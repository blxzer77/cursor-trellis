# `execute-agent`

P29 表名：`execute-agent`（不得改名）。层：baseline。

## 职责

生命周期的 Execute 槽。把**平台无关的执行要求**交给 Adapter 去绑：是否允许委派、是否必须隔离、写入边界、必须停在已批合同内。个人默认绑定是**主 Agent、当前会话、inline**。不点名 Subagent、不点名 worktree、不点名某个模型。真正绑到 Cursor Agent / Task / worktree 是 Adapter + 按需模块的事。

## 触发/披露

仅 Phase=Execute，且实际 binding 为 inline（或 Worker 不可用而诚实降级为此）时加载本块短契约。Define / Open / 无任务时看不见「去改代码」。Execute 结束后教战从常驻包拿掉。

Agent 看见：

1. 已批 Definition / AC /（Full 时）执行与验证契约是边界；实现缺陷留在 Execute 修。
2. 范围、AC、执行契约、验证策略、capability/runtime、Parent 边界变化 → 停手，Return-to-Define，再走 Execute 门。不得边改 PRD 边假装仍在 Execute。
3. 不得因本块去 spawn `cstl-implement` / `cstl-check`；那只在 `worker-orchestration` 激活且合同要求 worker 时出现。
4. 不得因本块去 integrate-child 或建 Child。
5. Adapter 可将本阶段绑到 Cursor Agent；Plan/Debug 不是本块说明书。

用户看见：阶段名 Execute。Lite：主会话在已同意的范围内改东西。不默认看到并行工人、worktree、检查 Agent。

渐进：非 Execute 阶段不加载本块。

## 停止条件

- 输入：Execute 门已过；Definition 有效；Kernel Phase=Execute。
- 输出：合同内的工作结果（代码/配置/文档 diff）。Evidence 角色仍归 `verify-basic` 收。
- 停止：契约变更；未批准的写入；把 Verify/Close 提前做完并宣称完成。
- 降级：平台绑不上 Worker/隔离时，记 assurance，走 inline，不得假装隔离已发生。

## 关掉必须消失

没有「主 Agent 在合同内执行」这条默认路径。没有本槽则 Profile 预检应拒绝启动生命周期（Execute 是必需槽）。

## 不得带走

类型化 Agent 派工（`worker-orchestration`）；Child 拓扑与集成（`parent-child`）；AC 怎么写（`define-basic`）；假绿判定（`verify-basic`）；Git（`vcs-integration`）。
