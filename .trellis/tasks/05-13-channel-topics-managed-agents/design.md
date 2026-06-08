# Channel Threads And Managed Resident Agents Design Notes

## 当前意图

`trellis channel` 应保留现有 live chat / worker transport，同时新增一种 `thread` channel 结构类型。Thread channel 类似飞书话题群：默认看到 thread list，进入具体 thread 后再评论、改状态、打标签。Issue-board 行为由 thread channel 表达，而不是新建一个单独的 `trellis issue` 子系统。

## 架构决策

第一版只交付 `type: "chat" | "thread"`、channel scope、labels、thread events，不交付 managed resident agents。

- Global channels 存在保留 bucket `_global` 下。
- `events.jsonl` 仍是 source of truth；v1 不写 `threads.json`。
- 默认创建的是 `type: "chat"` channel，保持现有行为。
- 显式 `--type thread` 后才是 thread channel。
- `chat` channel 是 timeline-first；`thread` channel 是 board-first。
- Thread board changes 用 `kind: "thread"` events 表达，内部状态转移放在 `action: "opened" | "comment" | "status" | "labels" | "assignees" | "summary" | "processed"`。
- `kind` 是粗粒度 wake/filter category；`action` 是 thread state transition。
- `--type` 只表示 channel 的结构形态，不表示用途。只允许 `chat` 和 `thread`；`issue-board`、`feedback`、`release` 这类用途词放在 `labels`。
- Managed resident agents 放到 v2。它们以后消费 thread events，不定义 thread storage。

## 飞书命名参考

`lark-cli schema im.chats.create` 里，飞书创建群的字段是 `group_message_type`，取值：

- `chat`：对话消息
- `thread`：话题消息

Trellis 采用同样的结构思路，但 CLI 用更贴近用户表达的 `--type chat|thread`。这里的 `thread` 是 channel 的结构类型；channel 内部的单个话题元素也叫 thread，由 `--thread <key>` 指向。

## 数据契约

Channel create events 可以包含 scope、type、labels、description 和 linkedContext metadata：

```json
{
  "kind": "create",
  "scope": "global",
  "type": "thread",
  "labels": ["trellis", "feedback", "issue-board"],
  "description": "Global feedback and issue threads for Trellis maintenance.",
  "linkedContext": [
    {
      "type": "file",
      "path": "/Users/taosu/workspace/company/mindfold/product/share-public/Trellis/.trellis/tasks/05-13-channel-topics-managed-agents/prd.md"
    },
    {
      "type": "file",
      "path": "/Users/taosu/workspace/company/mindfold/product/share-public/Trellis/.trellis/spec/cli/backend/commands-channel.md"
    },
    {
      "type": "raw",
      "text": "Use this channel for Trellis channel/thread design discussion."
    }
  ],
  "schemaVersion": 1
}
```

缺少 `type` 等同于 `"chat"`，表示 legacy chat channel。

`description` 和 `linkedContext` 适用于所有 channel，不只适用于 thread channel。它们用于帮助人和 agent 快速理解 channel 的用途和背景，不驱动运行时行为。

`linkedContext` 只支持两种 entry：

- `file`：绝对文件路径。不得接受相对路径，避免不同 cwd 下 agent 解析到不同文件。
- `raw`：直接写入的纯文本。用于短背景说明、外部系统摘要、无法稳定落盘的上下文。

`linkedContext` 不支持 `task`、`spec`、`url`、`channel` 等语义类型。Task/spec 都通过 `file` 指向具体绝对路径；外部链接如果需要保留，可以作为 `raw` 文本写入。

`linkedContext` 是 orientation hint，不是强一致依赖。文件可能不存在、不可读或内容已变；agent 应把它当作优先阅读提示，而不是可信缓存。

Thread events 使用一个 event kind，并用单独的 action 表达状态变化：

```json
{
  "kind": "thread",
  "action": "opened",
  "thread": "uninstall-overwrites-user-files",
  "by": "main",
  "title": "uninstall should not hash user files",
  "description": "Uninstall should avoid treating user-edited files as pristine template output.",
  "text": "...",
  "addLabels": ["bug"],
  "linkedContext": [
    {
      "type": "file",
      "path": "/Users/taosu/workspace/company/mindfold/product/share-public/Trellis/packages/cli/src/commands/uninstall.ts"
    },
    {
      "type": "raw",
      "text": "Reporter observed uninstall touching user-edited files in a local project."
    }
  ],
  "sourceProject": "some-project-key",
  "sourceCwd": "/path/to/source/project",
  "sourceTask": "05-13-example-task",
  "sourceChannel": "local-channel-name"
}
```

Thread 级 `description` 和 `text` 分工不同：

- `description` 是稳定摘要，用于 thread list、`thread show` header、agent 快速判断。
- `text` 是 opened/comment 的正文，保留在事件流中，供进入 thread 后阅读。

未来 resident workers 应通过追加 thread events 汇报处理结果：

```json
{
  "kind": "thread",
  "action": "processed",
  "thread": "uninstall-overwrites-user-files",
  "by": "triage",
  "processor": "triage",
  "result": "labeled",
  "processedSeq": 42
}
```

## 后续事件归属与业务扩展字段

V1 先保留现有轻量事件模型：`by` 表示说话者 alias，`to` 表示路由目标，`kind` /
`action` 表示 Trellis 自己理解的事件类别和 thread 状态变化。这个模型足够支撑
本地 CLI、worker 协作和 thread board。

Vine 这类多用户、多 agent、多项目产品接入时，问题不是给 `by` 加业务字段，而是
把 Trellis 自己需要理解的字段和业务系统自己的字段分层：

```json
{
  "kind": "thread",
  "action": "comment",
  "thread": "vine-trellis-core-sdk-needs",
  "by": "Alice",
  "to": ["codex-review"],
  "origin": "api",
  "text": "Vine needs channel-as-library before daemon cutover.",
  "meta": {
    "vine": {
      "authorId": "user_abc",
      "projectId": "project_123",
      "taskId": "task_456"
    }
  }
}
```

字段边界：

- `by`：Trellis 轻量说话者 alias，用于 pretty output、`--from`、`wait --from`。
  它不是真实用户 ID，不承担权限语义。
- `to`：Trellis 路由目标，用于把消息投递给 channel worker / agent handle。
  它不是业务身份。
- `origin`：事件写入入口，只允许 `cli | api | worker`。`cli` 是
  `trellis channel ...` 命令写入；`api` 是未来 channel core/library 调用写入；
  `worker` 是 channel supervisor / worker runtime 写入。
- `meta`：业务系统扩展区，必须是 JSON object。Trellis 原样持久化、读取、
  raw 输出和可选过滤，但不解释其中的业务含义。

Trellis 不定义 `user`、`org`、`displayName`、权限或 SaaS 租户模型。Vine 可以把
这些信息放在 `meta.vine` 下，并由 Vine 自己解析、鉴权和展示。Trellis 只保证
事件归属、路由和扩展字段的稳定 pass-through。

`origin` 不应是 object；先用字符串保持最小协议。worker pid、provider session、
Vine server 名称等细节进入 `meta.trellis` 或业务 namespace。当前 create event
里用于标记 `channel run` 的 `origin: "run"` 与这个后续语义冲突；做 0.7
事件模型时应迁移为 `meta.trellis.createMode = "run"` 或等价字段。

`meta` 约束：

- 必须是 JSON object，不能是 string / array / null。
- 不存 secrets、tokens、private keys。
- CLI pretty mode 默认不展开完整 `meta`；`messages --raw` 完整输出。
- 未来如提供过滤，只做简单 JSON path equality，不把业务 schema 写进 Trellis。

事件流分层也应走同一个思路。Trellis 顶层 `kind` 继续少而稳定：
`create / spawned / message / thread / progress / done / error / killed / respawned`
等。Thread 变化继续使用 `kind: "thread"` + `action`。Agent runtime 的
`text_delta`、`tool_call`、`tool_result`、`reasoning` 等可以作为 runtime 类
events 或放入 `progress.detail`，但业务 UI 应按 `kind/action/meta` 过滤和合并，
不要把真实业务身份塞进 `by`。

## 用户可见命令形态

```bash
trellis channel create trellis-issues \
  --scope global \
  --type thread \
  --labels trellis,feedback,issue-board \
  --description "Global feedback and issue threads for Trellis maintenance." \
  --linked-context-file /Users/taosu/workspace/company/mindfold/product/share-public/Trellis/.trellis/tasks/05-13-channel-topics-managed-agents/prd.md \
  --linked-context-file /Users/taosu/workspace/company/mindfold/product/share-public/Trellis/.trellis/spec/cli/backend/commands-channel.md \
  --linked-context-raw "Use this channel for Trellis channel/thread design discussion."

trellis channel messages trellis-issues

trellis channel post trellis-issues \
  --thread uninstall-overwrites-user-files \
  --action opened \
  --title "uninstall should not hash user files" \
  --description "Uninstall should avoid treating user-edited files as pristine template output." \
  --label bug \
  --linked-context-file /Users/taosu/workspace/company/mindfold/product/share-public/Trellis/packages/cli/src/commands/uninstall.ts \
  --linked-context-raw "Reporter observed uninstall touching user-edited files in a local project." \
  --stdin

trellis channel post trellis-issues \
  --thread uninstall-overwrites-user-files \
  --action comment \
  --stdin

trellis channel messages trellis-issues --thread uninstall-overwrites-user-files
trellis channel threads trellis-issues --status open
trellis channel thread show trellis-issues uninstall-overwrites-user-files

trellis channel thread status trellis-issues uninstall-overwrites-user-files \
  --status triaged

trellis channel thread label trellis-issues uninstall-overwrites-user-files \
  --add bug \
  --remove needs-info
```

## 设计约束

- Chat channel 和 thread channel 是结构类型差异，不是任意 `type` enum。
- Chat channel 默认行为不变：`messages` 展示消息时间线，`send` 发送普通 message events。
- Thread channel 默认视图不同：`messages <channel>` 在 pretty mode 下优先展示 thread list；`messages --thread <key>` 展示单个 thread 内的评论/状态变化；`messages --raw` 始终输出完整 event log。
- Thread channel 的 `messages <channel>` pretty output 顶部必须显示当前视图提示，例如：`Thread channel: showing threads. Use --thread <key> to show one thread. Use --raw for event log.`
- Chat channel 传入 `--thread` 时必须报清晰错误：`--thread is only supported for thread channels`。
- 所有 channel 都可以有 `description` 和 `linkedContext`。Thread channel 里的单个 thread 也可以有自己的 `description` 和 `linkedContext`。
- `linkedContext` 只支持 `file` 和 `raw`。`file` 是绝对路径引用，不复制内容；`raw` 是已写入事件的纯文本。
- Pretty output 对 `linkedContext.raw` 只展示摘要；raw output 完整保留。
- 已有 channels 仍然有效。缺少 `scope`、`type`、`labels`、`thread` fields 意味着当前 project-scoped chat behavior。
- `--scope global` 必须是 storage semantics，不只是 metadata。它应该映射到稳定的保留 bucket `_global`。
- `--project` 当前记录的是 metadata，不能在没有 migration plan 的情况下重载成 storage scope。
- `--type` 不接受用途词。`--type issue-board`、`--type inbox`、`--type release-watch` 都不应存在。
- 是否启用 thread channel 由 `--type thread` 决定，不由 labels 决定。
- Thread state 必须从 channel events 推导。若以后加入 projections，它们必须可重建。
- Managed workers 以后仍应是带 persisted management config 的 channel workers，而不是第二套 daemon model。
- Resident workers 不能依赖 model memory 保存 durable thread state。v2 增加它们时，它们必须重读 channel/thread events。
- `messages --raw` 仍是 audit truth。Pretty output 可以摘要，但 thread/issue fields 必须足够可见。
- `send` 只用于 `kind: "message"` events。
- `post` 只用于 structured thread events。v1 不支持 `send --thread`，避免用户混淆普通消息和 thread 内容入口。
- 新增 `send --tag`；保留 `send --kind` 仅作为 message tag 的 legacy alias。
- `messages --kind` 和 `wait --kind` 表示 event kind，不表示 message tag。
- `post --action` 表示 thread action，不表示 event kind。

## Scope 解析

- `trellis channel create` 默认 project scope。
- `trellis channel create --scope global` 写入 `_global` bucket。
- 指向已有 channel 的 commands 应接受可选 `--scope`。
- `--scope global` 只搜索 `_global`。
- `--scope project` 只搜索当前 project bucket 或 `TRELLIS_CHANNEL_PROJECT`。
- 不传 `--scope` 时：如果当前 project 唯一命中则使用 project；如果 global 唯一命中则使用 global；如果同名 channel 同时存在于 project 和 global，则报错。
- 如果 global 和任意 project bucket 同时包含同名 channel，unscoped writes 必须在追加 JSONL 前失败。

## 共享实现边界

实现前应先建立 shared helpers，再增加命令层行为。

- Scope resolver：一个 helper 负责所有 command 的 project/global lookup 和 ambiguity handling。
- Event schema：一个 source 定义 channel event kinds、wake-worthy kinds、thread actions、parsing errors。
- Event filter：`messages` 和 `wait` 共享 `kind`、`tag`、`thread`、`action`、`from`、`to` 匹配逻辑。
- Thread reducer：`threads` 和 `thread show` replay `events.jsonl`；v1 不写 `threads.json`。
- Thread key normalization：持久化 thread keys 是 logical keys，不是 filesystem paths。
- Linked context parsing：`--linked-context-file <absolute-path>` 解析为 `{ "type": "file", "path": absolutePath }`；`--linked-context-raw <text>` 解析为 `{ "type": "raw", "text": text }`。
- Label layering：channel labels 从 create/update channel metadata 推导，thread labels 从 thread events 推导；两个集合互不覆盖。

## 最小测试

- Legacy chat channel 的 `messages` 仍展示消息时间线。
- Thread channel 的 `messages` pretty default 展示 thread list，`messages --thread <key>` 展示 thread 内事件，`messages --raw` 保持审计日志。
- Thread channel 的 `messages` pretty default 显示当前视图提示；chat channel 使用 `--thread` 报错。
- Channel create event 保留 `description` 和 `linkedContext`；pretty output 展示 description，raw output 完整保留 linkedContext。
- Thread opened event 保留 thread 级 `description` 和 `linkedContext`；thread reducer 将最新 description 和 linkedContext 纳入 thread summary。
- Thread list/show 使用 `description` 作为稳定摘要，进入 thread 后才展示完整 `text` 事件流。
- Global create 写入 `_global`；已有 commands 在无歧义时能解析到 global。
- Local/global 同名 shadowing 在没有显式 `--scope` 时必须报错。
- 没有新 metadata 的 legacy channels 仍支持 `send`、`messages`、`wait`。
- `post` 追加 `kind: "thread"` events，`messages --raw` 保留所有 fields。
- `messages --thread` 和 `wait --kind thread --thread` 正确过滤。
- `threads` 从 event order 推导 status、labels、title、timestamps、`lastSeq`，不依赖 projection file。
- `send --kind interrupt` 仍写 message tag，同时 `messages --kind thread` 仍过滤 event kind。
- `spawn --scope global` 通过 supervisor environment 保留 `_global`。
- `TRELLIS_CHANNEL_ROOT` behavior 必须和 spec 一致；否则在 integration tests 依赖它前先修正 spec 或代码。

## 延后到 V2

Managed resident agents 仍然有价值，但应在 thread events 工作稳定后设计。

- Lifecycle commands 可以是 `trellis channel agent start|stop|status|logs|restart`。
- Persistent config 应存在 channel directory 下。
- Worker state 必须暴露 pid、log path、health、idle timeout、restart policy。
- Resident worker 应追加 thread `processed` action，而不是 channel-level `done`。

## Guide 触发条件

- Code reuse：避免创建和 channel event storage 重复的 issue store。
- Cross-layer：CLI commands、event schema、pretty/raw renderers、wait filters、worker inbox、docs 必须共享 thread semantics。
- Cross-platform：thread keys 和 stored paths 使用 POSIX-normalized logical keys；filesystem paths 只在 fs boundary 使用 OS-native paths。
