# `worker-orchestration`

P29 表名：`worker-orchestration`（不得改名）。层：on-demand。

## 职责

执行要求的**派工绑定**，不是生命周期槽，也不是调度器。当合同要求 worker / 隔离 / 并行时，把「谁去做」绑到 Adapter 能提供的类型化工人（Cursor 上是 Task 类型 `cstl-implement` / `cstl-check` / `cstl-research`）。Prefer 平台原生并行（Multitask / Task 并行 / 原生隔离）；CSTL 只写契约与派工包，不造 Trellis 调度器、不跨平台把别的 IDE 当工人。主会话是唯一 dispatcher；工人不是 Kernel Phase。

## 触发/披露

未触发当没装。Lite 默认看不见 spawn 教战。触发（任一即可，且可审计）：

1. 已批 Execution Contract 写明 `execution_mode: worker`（或同等 isolation/parallel 要求）；
2. 用户本回合明确要求派工 / 并行工人；
3. `independent-check` 已激活且 Policy 要求 `true-independent`，平台又有独立 Worker；
4. `define-extended` 已激活且研究合同要求独立 research worker。

**不是**触发：Rigor=Full 本身；Topology=parent-child 本身。Parent 可以全程 inline / 顺序会话做完 Child，不自动打开本块。

派工窗口结束，spawn 教战从常驻包消失。

Agent 看见：

1. 三种角色，槽位仍归别人：implement → Execute（`execute-agent` 的非 inline 绑定）；check → 只读第二遍（服从 `independent-check`，工人默认不改代码）；research → Define 深研（服从 `define-extended`）。
2. 每个工人 prompt 必须带显式 `.cstl/tasks/<dir>`，不依赖 dispatcher 的 `selected_task`。工人包 = 该任务路径 + 合同片段；不继承整份梯子。钩 `inject-subagent-context.py` 只在本块激活时订阅。
3. 禁止套娃：implement / check / research 工人不得再 spawn 同类或彼此。只有主会话（或 Parent 主会话）派工。
4. 工人不 `git commit`、不 Finalize、不 `integrate-child`、不改 Kernel 核心状态。
5. 能并行则并行（P18 精神），但 HITL / Execute 门 / Check / 集成仍串行。串行必须写 `serial_reason`（共享写集 / 门禁 / 依赖未满足 / 用户要求 / 冲突面无法隔离）。平台没有并行面 → 顺序派工或降回 inline，记 assurance，不得假装已隔离或已并行。
6. 模型选择归 Adapter / 宿主；本块不写死模型 ID。无可靠 Task API → 诚实降级，可走手动派工提示，不得假 spawn。

用户看见：只有真正要派工时才出现工人/并行叙事。Lite 主会话改代码时看不到本块。没有「CSTL 调度面板」。

## 停止条件

- 触发与非触发见上。
- 三角色 ↔ 槽位 owner 对照；工人包形状（任务路径 + 合同片段）。
- 停止：未激活仍 spawn；套娃；把 Check 工人当执行修补手（与已锁定的 `independent-check` 只读冲突）；把 Child 拓扑当成已经派工；无平台能力却写 true-independent / isolated / parallel。
- 降级：无 Worker / 无隔离 / 无并行 → assurance + inline 或顺序；`execute-agent` 仍可用。

## 关掉必须消失

无 spawn 教战、无 subagent 注入钩、无并行工人说明书。Execute 只走 `execute-agent` inline。Check 最多 `self-review`。研究留在主会话。Parent 仍可存在，但只能顺序/inline，没有工人扇出。

## 不得带走

Execute 槽本身（`execute-agent`）；Check 语义与 assurance 标签（`independent-check`）；Decompose / 集成权威 / task-map（`parent-child`）；worktree 探测细节（`vcs-integration`，本块只要求 isolation capability）；Multitask 是否存在（Adapter 探测）；跨窗人肉搬运（`session-transfer`）。
