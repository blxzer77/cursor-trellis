# Implementation Plan

## 状态

已进入 implementation。当前已完成 v1 底座和 CLI surface：默认 `--type chat` channel、显式 `--type thread` thread channel、`--scope project|global`、structured `thread` event、`post`/`threads`/`thread` 命令，以及 targeted regression tests。v1 仍不包含 managed resident agents。

## 实现切片

1. [x] 修正 `TRELLIS_CHANNEL_ROOT` spec/code behavior，确保 integration tests 可隔离到临时 channel root，不污染真实 `~/.trellis/channels`。
2. [x] 建立 shared channel kernel，并同步加 helper-level tests：
   - `ChannelRef`: `{ name, scope, project, dir }`
   - scope resolver: `_global`、project、unscoped ambiguity
   - event schema: `type: "chat" | "thread"`、event kinds、wake-worthy kinds、thread actions
   - event payload SOT: `store/events.ts` owns typed event variants、`isThreadEvent`、`metadataFromCreateEvent`
   - shared event filter: `kind/tag/thread/action/from/to`
   - `readChannelMetadata`: legacy 缺省 `type=chat`
   - thread reducer: 只 replay `events.jsonl`
   - shared CSV / linked-context normalization：`parseCsv`、`asStringArray`、`asLinkedContextEntries`
3. [x] 改造 store APIs，让 read/write 接收 resolved `ChannelRef` 或 resolved project，不再让命令层直接依赖 `process.env.TRELLIS_CHANNEL_PROJECT` 作为隐式全局状态。
4. [x] 将 `--scope project|global` 接入主要会读取、写入、删除或 spawn 的命令：`create`、`send`、`messages`、`wait`、`spawn`、`kill`、`rm`、`prune`、`list`、`post`、`threads`、`thread`。
5. [x] 确保 `spawn --scope global` 将 resolved `_global` 持久化到 supervisor env，detached supervisor 不能回写到 cwd project bucket。
6. [x] 增加 `send --tag`，并把 `send --kind` 文档化为 legacy tag alias。
7. [x] 增加 `create --type chat|thread`，并确保缺省仍是 legacy chat channel。
8. [x] 增加 `kind: "thread"` events，并接入 parser、`CHANNEL_EVENT_KINDS`、wait wake set、messages filter、watch filter。
9. [x] 增加 `--description`、repeatable `--linked-context-file <absolute-path>`、repeatable `--linked-context-raw <text>` parsing，支持 channel create 和 thread events。
10. [x] 增加 `trellis channel post` 用于 structured thread events，并验证目标 channel 必须是 `type=thread`。
11. [x] 保持 `send` 只写 `kind: "message"`；没有 `send --thread`，thread 内容只能走 `post`。
12. [x] 增加 `trellis channel threads` 和 `trellis channel thread`，从 shared thread reducer 读取 summary；rendering 不参与状态计算。
13. [x] 调整 `messages` pretty behavior：chat channel 默认展示 timeline；thread channel 默认展示 thread list；`messages --raw` 始终保持完整 event log。
14. [x] 给 thread channel 的 `messages` pretty default 增加当前视图提示；chat channel 使用 `--thread` 报错。
15. [x] 增加 `messages --thread/--action` 和 `wait --kind thread --thread` filtering，并确保两者使用同一 filter model。
16. [~] 增加测试覆盖。已覆盖 `TRELLIS_CHANNEL_ROOT`、thread reducer、`lastSeq`、global/project shadowing、shared filter、shared CSV parsing、thread pretty hint、description/linkedContext pretty rendering；其余 supervisor scope propagation、wait follow 语义仍待补强。
17. [x] 文档化用法和 deferred managed-agent boundary。
18. [x] 用 `trellis-break-loop` 记录 event payload SOT 漏洞，并把规则沉淀到 `.trellis/spec/guides/` 与模板。

## Implementation Blockers

- `TRELLIS_CHANNEL_ROOT` 必须先对齐 spec/code，否则 integration tests 会污染真实用户目录。
- `--scope` resolver 和 store API 改造必须早于 command implementation。不能先按旧 path 写入，再后补 scope。
- `kind: "thread"` 必须同时进入 event parser、event kind set、wake-worthy kinds、messages filter、watch filter。
- `post` 必须验证目标 channel 是 `type=thread`；`send` 必须保持只写 `kind: "message"`。
- `spawn --scope global` 必须把 resolved `_global` 传入 detached supervisor，不能只在父进程里临时设置。

## V1 不做

- Managed resident agent lifecycle commands。
- Persistent worker management config。
- Thread projection files，例如 `threads.json`。
- 独立的 `trellis issue` commands。
- Automatic thread triage、dedupe、summary generation、stale reminders、background listening。

## 测试矩阵

- Unit：scope resolver 的 explicit project/global、unscoped unique match、unscoped ambiguity、missing channel errors。
- Unit：`TRELLIS_CHANNEL_ROOT` override 能把 channel storage 完整隔离到临时 root。
- Unit：event parser 接受 `thread`，并用稳定错误拒绝 unknown kinds。
- Unit：shared event filter 覆盖 `kind/tag/thread/action/from/to`，供 `messages` 和 `wait` 共用。
- Unit：CSV parsing 统一通过 `parseCsv`，避免命令层重复拆分 comma-separated options。
- Unit：`--linked-context-file` 只接受绝对路径并拒绝相对路径；`--linked-context-raw` 接受非空纯文本。
- Unit：thread key normalization 拒绝 `/`、`\`、`..`、control characters、empty keys。
- Unit：thread reducer 推导 title、status、labels、assignees、timestamps、`lastSeq`。
- Integration：`create --scope global` 写入 `_global/<name>/events.jsonl`。
- Integration：`create --type thread` 写入 `type: "thread"`，缺省 create 不写 `type` 或写 `type: "chat"`。
- Integration：chat channel 的 `messages` 默认展示 timeline；thread channel 的 `messages` 默认展示 thread list。
- Integration：thread channel 的 `messages` pretty output 显示当前视图提示；chat channel 使用 `--thread` 报错。
- Integration：explicit `--scope project`、explicit `--scope global`、unscoped unique global、unscoped project/global collision。
- Integration：project/global 同名 channel 存在时，unscoped write commands 失败且不追加 event；至少覆盖 `send`、`post`、`thread status/label`、`spawn`。
- Integration：`post --action opened|comment|status|labels` 写入 `kind: "thread"` events，`messages --raw` 保留 fields。
- Integration：`post` against chat channel fails clearly。
- Integration：thread channel `send` 仍只写 plain message，不变成 thread comment。
- Integration：不存在 `send --thread` 路径；thread 内容只能走 `post`。
- Integration：channel create 和 thread opened events 的 `description` / `linkedContext` 在 raw output 中完整保留，在 pretty output 中可见。
- Integration：thread list/show 使用 `description` 作为稳定摘要，thread event timeline 保留 `text` 正文。
- Integration：`messages --thread` 和 `wait --kind thread --thread` 使用相同 filter semantics。
- Integration：`wait --kind thread --thread <key>` 能被 matching thread event 唤醒，且不被 progress filtering 影响。
- Integration：`messages --raw` on thread channel 输出完整 create/thread fields，包括 `description`、`linkedContext`、provenance。
- Integration：`linkedContext.raw` pretty truncation 不影响 raw fidelity。
- Integration：legacy channel with no `type/scope/labels` resolves as project-scoped chat。
- Integration：`send --kind interrupt` 仍是 message tag path；`send --tag interrupt` 是文档化路径。
- Integration：`spawn --scope global` 将 supervisor events 保持在 `_global`。
- Output：thread pretty output 包含 thread/action/status/labels，且不改变 legacy message output。

## Break-Loop 记录

- `break-loop-event-payload-sot.md`：记录 thread event payload contract drift 的根因、失败修复路径、防复发机制。

## 可留到实现阶段

- Pretty table 的列宽、颜色、排序细节。
- `linkedContext.raw` 摘要的具体截断长度。
- labels 输出格式。
- thread status 是否先允许自由字符串，只要 reducer 能稳定 replay。
- docs wording 和 help text 的最终措辞。

## 验证命令

```bash
pnpm typecheck
pnpm lint
pnpm --filter @mindfoldhq/trellis test
```

当前验证结果：`pnpm lint`、`pnpm typecheck`、`pnpm --filter @mindfoldhq/trellis test` 均通过。
