# trellis-core SDK package

## 当前意图

设计并后续实现 `@mindfoldhq/trellis-core`，把 Trellis CLI 里已经成型的 channel/task 领域逻辑抽成可发布的 TypeScript core package。CLI 继续作为用户命令入口，但不再独占 channel 事件、thread reducer、storage、watch、task record 等核心语义。外部 Node 消费方后续应能通过 in-process API 调用同一套 core，而不是 subprocess 调 `trellis channel ...`。

## 背景

下游集成场景已经提出两个明确需求：

1. Task 数据模型单一来源：`TrellisTaskRecord`、task record schema、task dir validation、phase inference 等不应在下游系统和 Trellis CLI 模板里重复维护。
2. Channel-as-library：`create / send / postThread / read / watch / wait / spawn / kill / thread mode / global scope` 需要成为 core API，下游 Node 服务不能每个 agent turn 都 fork CLI。

当前 Trellis channel 代码已经有一批可抽取的 shared kernel：`store/events.ts`、`store/paths.ts`、`store/filter.ts`、`store/thread-state.ts`、`store/schema.ts`、`store/watch.ts`、`text-body.ts` 等。下一步需要把这些能力从 CLI command tree 中抽出一等包边界。

## 目标

- 新增 workspace package：`packages/core`，npm 包名 `@mindfoldhq/trellis-core`。
- `packages/cli` 依赖 `@mindfoldhq/trellis-core@workspace:*`。
- Core 包拥有 channel/task 的领域类型、schema、storage、reducer、watch、API 函数。
- CLI command files 变薄：只负责参数解析、终端输出、exit code、help 文案。
- 下游 Node 消费方可直接 import core API，并写入 `origin: "api"` 的 channel events。
- Threads channel 的 context mutation、thread rename、channel display title rename 等成熟度能力进入当前 beta 线，不作为远期 0.7 后续再拖延。
- 用户侧术语从 `linkedContext` 收敛为 `context`；旧字段仅作为兼容读取。
- Core 需要同时支持 channel-level context 和 thread-level context 的 add/delete projection。
- 事件归属采用 `by / to / origin / meta` 边界：
  - `by` 是 Trellis 轻量 alias。
  - `to` 是 worker / agent routing target。
  - `origin` 是写入入口：`cli | api | worker`。
  - `meta` 是 pass-through JSON object，业务身份归外部系统自己解释。
- `appendEvent` 后续必须支持 O(1) seq sidecar，不再在锁内全量扫描 `events.jsonl`。

## 非目标

- 不设计外部系统的用户、组织、权限、displayName 等业务 identity model。
- 不在第一版支持 browser / edge / React Native / Deno。
- 不在第一版引入 cloud storage adapter。
- 不在第一版承诺 CJS dual package；先保持 Node ESM-only，与当前 CLI 一致。
- 不把 managed resident agents 作为 SDK MVP。
- 不把外部系统的产品 runtime event 硬塞进 Trellis channel event 顶层。
- 不做单 comment 删除。
- 不做单 thread hard delete；thread 生命周期继续使用现有 `status` 字段表达，例如 `open` / `closed` / `processed`。
- 不做 channel address rename。

## 验收标准

- `design.md` 明确 package layout、public exports、内部目录、API surface、迁移顺序、build/publish 策略。
- `design.md` 明确 channel API 和 task API 的 MVP 列表。
- `design.md` 明确 CLI 如何从 owner 变成 adapter。
- `design.md` 明确 `by / to / origin / meta` 对 SDK API 的影响。
- `design.md` 明确 `context` add/delete/list、thread rename、channel display title rename 的 core-level reducer 语义。
- `design.md` 明确哪些能力进入 0.7，哪些延后。
- 后续 implementation task 能根据该设计拆出首批 core package，而不需要重新讨论边界。
