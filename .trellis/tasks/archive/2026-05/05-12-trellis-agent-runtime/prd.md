# brainstorm: Trellis Agent Runtime

## 工作纪律（贯穿整个 task 生命周期）

1. **不 commit**：本 task 实施过程中不向 git 提交任何代码；所有迭代留在工作目录。最终是否 commit / 怎么 commit 由用户决定。
2. **不派 sub-agent**：本 task 不允许通过 `trellis-implement` / `trellis-check` / Codex `multi_agent` / Claude `Task` tool 等任何 sub-agent 机制把活外包出去——必须主 session 自己干、用户逐步审。`task.py start` 后**继续**遵守这条。
3. **小步走**：用户明确要求"你干一点我审一点"。每个增量（一个测试 → 实现 → 绿）完成都暂停等审，不批量推进。
4. **TDD 强制**：详见 `design.md` §13 / `implement.md` 顶部"工作纪律"。


## Goal

把"多 agent 协作 / 子任务派发 / 中断重启 / 进度回收"这一层能力从各 coding tool 的 sub-agent API（Codex `multi_agent_v2`、Claude `Task`、OpenCode 子会话）里拿回来，由 Trellis CLI 自身承载。Trellis 用 append-only 事件流 + worker supervisor 进程把异构 agent（Codex / Claude / OpenCode / Gemini / iFlow / …）统一成可调度、可中断、可观察的协作单元。

## Why now (源头讨论)

Codex 会话 `019e1ae0-83f9-7c90-a2dc-c6785d17b22a`（2026-05-12）梳理了仓库最近一批 closed issue：

- Codex 子代理递归 / 死锁：#237 #240 #242 #250
- 父级 agent 生命周期卡住：#234 #241
- Codex 配置 / Hook 兼容：#238 #190 #196 #191 #251

仓库当前的应对是把 Codex `dispatch_mode` 默认切到 `inline`（见 [.trellis/config.yaml](../../config.yaml)、[.codex/hooks/inject-workflow-state.py](../../../.codex/hooks/inject-workflow-state.py)），并在 [.codex/agents/trellis-*.toml](../../../.codex/agents/) 里关掉 `multi_agent` / `multi_agent_v2`、加 recursion guard。这是稳态止血，不是协作能力。要让 Trellis 真正支持"AI 同时驱动多个 agent 做事"，需要一个不依赖宿主 sub-agent 语义的执行层。

## What I already know

- 设计目标形态：
  - append-only JSONL transcript，写文件即广播
  - `create / join / leave / send / wait / messages` 协议
  - `spawn` 启动外部 codex/claude/opencode 进程作为 peer worker
  - 每个 worker 由 supervisor 进程托管：`--kind interrupt` 触发 `SIGTERM → SIGKILL → 合并 prompt 重启`
  - 标签路由：`interrupt / phase_done / done / question / ack` 等
- 用户明确路径：**先做 CLI runtime，daemon 化作为第二阶段**。daemon 不是地基，事件协议才是地基。
- 仓库里已有的相关基础：
  - [`packages/cli/src/templates/trellis/scripts/common/cli_adapter.py`](../../../packages/cli/src/templates/trellis/scripts/common/cli_adapter.py)：15 个平台的命令拼装（`build_run_command`），已经做了"怎么启 codex/claude/opencode/…"的事；但偏 Python 模板侧、为 hooks 服务，未上提到 TS CLI。
  - `.trellis/tasks/<task>/{prd.md, implement.jsonl, check.jsonl}`：任务上下文已经成型，可以直接作为 worker 的输入。
- 已有的两个相邻 task：
  - [`04-25-autopilot-run-queue`](../04-25-autopilot-run-queue/prd.md)（in_progress）：**跨多个 Trellis task 的串行队列**，强依赖 session-scoped current-task，明确说自己是"协调层"而不是执行层。
  - [`05-02-trellis-code-opencode`](../05-02-trellis-code-opencode/prd.md)（planning）：**Trellis-owned 单进程 code agent runtime**（fork OpenCode），定位是 GUI 产品的运行时基座。
- Codex 在那次会话里给出的三层切片：
  - Layer 1: Event Bus（append-only events + 锁 + filter + tags）
  - Layer 2: Worker Runtime（spawn 外部 CLI + supervisor kill/respawn）
  - Layer 3: Workflow Integration（workflow.md 不再走宿主 subagent，改成 `trellis agent spawn --role implement/check`）

## Confirmed facts (来自代码 / 配置 / 既有 task)

- Codex 已默认走 inline，`dispatch_mode: sub-agent` 是可选路径，说明仓库已经接受"不依赖宿主 subagent"的判断。
- `cli_adapter.py` 已覆盖 15 平台启动命令，是这层 runtime 的关键参考实现。
- `04-25-autopilot-run-queue` 在等 `session-scoped-task-state` 才能进入生产；它的源 of truth 是 `run.md`，不会去定义 worker 生命周期。
- `05-02-trellis-code-opencode` 关注的是"一个 worker 内部怎么跑"，不解决多 worker 编排。

## Scope decision (已确认 2026-05-12)

**A. 本任务作为独立"协作层"**，是 Autopilot 和 Trellis Code 的共同基础设施；Autopilot 在它之上消费队列；Trellis Code 是它调度的 worker 类型之一。依赖方向单向：Agent Runtime ← Autopilot / Trellis Code（前者被消费，不反向依赖）。

Trellis 的执行栈：

| Task | 解决的问题 | 状态 |
|---|---|---|
| `05-12-trellis-agent-runtime`（本任务） | **多 agent 协作层**：事件总线 + worker supervisor + 中断/重启 / 跨平台 CLI 启动 | 新建 |
| `04-25-autopilot-run-queue` | **跨任务队列层**：run.md + 顺序推进 + blocker 策略 | 等 session-scoped task state |
| `05-02-trellis-code-opencode` | **单 worker 运行时层**：fork OpenCode，做 Trellis 拥有的代码 agent | planning |

它们的关系是栈式的：Agent Runtime 是地基；Autopilot 是 Agent Runtime 的一个应用形态（队列消费者）；Trellis Code 是 Agent Runtime 调度的 worker 类型之一（Trellis 自己实现的那个）。

## Open scope decisions

1. ~~本任务和 Autopilot / Trellis Code 的边界~~ → 独立协作层（Q1, 2026-05-12 决议）
2. ~~协议 / 实现来源~~ → **Trellis 在自己仓库自行实现**（Q2, 2026-05-12 决议）。不 vendor、不 fork 任何外部代码；代码在 `packages/cli`（或新增 `packages/agent-runtime`）。设计时按工程教训选型（meaningful wakeup filter、supervisor kill/restart 时序、prompt 注入模板等），但实现完全自有、可演进。
3. ~~子系统命名~~ → **`channel`**（Q3', 2026-05-12 决议）。容器叫 channel（一段共享事件流会话），参与者叫 agent。命令面：`trellis channel <verb>`。
4. ~~MVP 切片~~ → **L1 + L2 (Model B：stream-json + persistent)**（Q4, 2026-05-12 决议，**Q4' 修订**）。L3 留作下一个 task `05-XX-channel-workflow-adoption`。Worker 走长寿进程（Claude `--input-format stream-json` / Codex `app-server`）+ stdin 追加 + 事件流解析；supervisor 提供 cooperative interrupt（stdin 发新消息）+ kill 后备。理由：(a) brainstorm 多 agent 讨论需要 persistent peer，(b) 未来托管平台必须基于 stream-json + resume，(c) 走 Model A 等于先做一遍再推翻。MVP 砍掉的高级特性：权限交互 RPC（用 bypassPermissions 自动 allow）、跨 task session 复用、worker GC、统一 cross-platform 事件 schema（先透传各平台原始 event 类型，只统一 `say/progress/done/error` 这 4 个语义层）。
5. ~~存储位置~~ → **用户级 `~/.trellis/channels/`**（Q5, 2026-05-12 决议）。机器视角全局可见；Superconductor 风格多 worktree 共享同一个 channel；不污染任何 repo。代价：channel 名字需要在机器内唯一（建议格式 `<project>-<task>` 或显式 `--id`），且 channel 文件不会跟着 task 删除（提供 `trellis channel prune` 维护）。
6. ~~平台覆盖优先级~~ → **MVP = Codex + Claude**（Q6, 2026-05-12 决议，**Q6' 修订**）。Codex 走 `codex app-server --listen stdio://`（JSON-RPC 2.0），Claude 走 `claude --input-format stream-json --output-format stream-json --permission-mode bypassPermissions`。OpenCode 延到 channel runtime 稳定之后、`05-02-trellis-code-opencode` 推进到 impl 阶段时再接入。
7. ~~hooks 关系~~ → **复用 `TRELLIS_HOOKS=0`**（Q7, 2026-05-12 决议）。`trellis channel spawn` 在 child env 设 `TRELLIS_HOOKS=0` 短路所有 Trellis hook（基础设施 0.5.0-rc.4 已就绪），并设 `TRELLIS_CHANNEL` / `TRELLIS_CHANNEL_AS` / `TRELLIS_CHANNEL_DIR` 让 worker 自知身份。worker 行为完全由 `trellis channel spawn` 拼的 protocol prompt prefix 决定——这一刀关死 #237 #240 #242 #250 那批 sub-agent 递归路径。代价：worker 不再自动拿到 spec / package context，需要 protocol prompt 显式嵌入（设计决策外显化）。

## Hook 集成 (Q7 已定)

```bash
# trellis channel spawn 内部调用：
env \
  TRELLIS_HOOKS=0 \
  TRELLIS_CHANNEL=<channel-name> \
  TRELLIS_CHANNEL_AS=<agent-name> \
  TRELLIS_CHANNEL_DIR=~/.trellis/channels/<channel-name> \
  codex exec "$PROMPT_WITH_GRID_PROTOCOL_PREFIX"
```

- 现有 hook 文件（`shared-hooks/`、`.claude/hooks/`、`.codex/hooks/`、OpenCode plugins）已在顶部检查 `TRELLIS_HOOKS=0 / TRELLIS_DISABLE_HOOKS=1` 提前 return，无需新增逻辑。
- `TRELLIS_CHANNEL*` 三个变量是 channel runtime 自己的命名空间，不和现有 env 撞名。
- Worker 内部如要调 `trellis channel send` / `wait`，直接读这三个 env 知道身份，不依赖 prompt 解析。

## File layout (Q5 已定)

```
~/.trellis/channels/
  <channel>/
    events.jsonl                  ← append-only PK=seq
    <channel>.lock                   ← 写时 O_EXCL 锁
    <agent>.log                   ← supervised worker stdout（--bg）
    <agent>.log.supervisor        ← supervisor stdout（debug）
    <agent>.prompt                ← 初始 worker prompt
    <agent>.prompt.<N>            ← 第 N 次 restart 时合并 prompt
    <agent>.config.json           ← supervisor 配置（cli / cwd / model / sandbox）
    <agent>.pid                   ← supervisor pid（`trellis channel kill` 消费）
```

Channel 名字策略：
- 默认建议格式：`<project-slug>-<task-slug>` 或 `<project-slug>-<purpose>`，由用户在 `create` 时指定
- 重名时 `create` 失败（除非 `--force`）；`--id auto` 可让 Trellis 生成短 hash 后缀
- `trellis channel list` 默认显示所有 channel；`--project <slug>` 过滤；create 事件里记 `project` / `cwd` / `task` 用作过滤键

事件 schema 草案：

```jsonc
{"seq":1,"ts":"...","kind":"create","by":"main","project":"trellis","task":".trellis/tasks/...","cwd":"/abs/path","labels":["impl"]}
{"seq":12,"ts":"...","kind":"say","by":"impl-worker","text":"...","tag":"phase_done","to":"main"}
{"seq":20,"ts":"...","kind":"spawned","by":"main","as":"impl-worker","cli":"codex","pid":12345}
{"seq":35,"ts":"...","kind":"killed","by":"supervisor:impl-worker","reason":"interrupt","signal":"SIGTERM"}
{"seq":36,"ts":"...","kind":"respawned","by":"supervisor:impl-worker","attempt":2,"pid":12348}
```

## MVP scope (Q4' 修订)

L1（事件总线）+ L2（stream-json adapter + persistent worker + cooperative interrupt + kill 后备）。命令：`create / join / leave / send / wait / messages / list / spawn / kill / tui`。

**架构总览**：

```
┌─────────────────┐         ┌────────────────────┐         ┌──────────────────┐
│ main agent      │ ──────► │ trellis channel       │ ──────► │ worker process   │
│ (Claude/Codex)  │  stdin  │ (supervisor proc)  │ stdin   │ claude / codex   │
│                 │         │                    │         │ app-server       │
│ channel send/wait   │ ◄────── │ events.jsonl       │ ◄────── │ stream-json /    │
└─────────────────┘         └────────────────────┘ stdout  │ JSON-RPC events  │
                                     │                     └──────────────────┘
                                     ▼
                              ~/.trellis/channels/<channel>/events.jsonl
                              ~/.trellis/channels/<channel>/<worker>.session-id
                              ~/.trellis/channels/<channel>/<worker>.thread-id
```

**Worker 协议**：

- Claude: `claude --input-format stream-json --output-format stream-json --permission-mode bypassPermissions [--resume <session-id>]`，stdin 接收 `{"type":"user","message":{"role":"user","content":[{"type":"text","text":"..."}]}}` JSON 行
- Codex: `codex app-server --listen stdio://`，走 JSON-RPC 2.0（`initialize` / `thread/new` / `thread/sendMessage` / `thread/resume`）

**事件翻译**（supervisor 把平台原始事件映射成 channel 统一 4 类语义事件）：

| 平台事件 | channel 事件 |
|---|---|
| Claude `assistant.text` block / Codex `agent_message_delta` | `message` (`by=<worker>`, text 内容) |
| Claude `assistant.tool_use` block / Codex `tool_call` | `progress` (tool name + input 摘要) |
| Claude `result` / Codex `turn_completed` | `done` |
| stdout 解析失败 / 进程异常退出 | `error` |
| 其它（system init / tool_result / thinking / log） | 透传到 raw event 但不广播给 wait 唤醒 |

**中断**：
- Cooperative: `trellis channel send --kind interrupt --to <worker>` → supervisor 翻译成 worker stdin 上的一条 user message（高优先级标记）→ worker 模型在下一 step 看到，自己改方向。**不杀进程，session 保留**。
- Forceful: `trellis channel kill <worker>` → SIGTERM (3s) → SIGKILL，supervisor 写 `killed` 事件，**不自动 respawn**（除非 `--restart-with <prompt>`）。

**Resume 范围**：
- MVP **记录** `session-id`（Claude）/ `thread-id`（Codex）到 `<worker>.session-id` / `.thread-id` 文件
- MVP **不实现** `trellis channel resume` 命令；保留 schema 接口，留给后续 task 或 v2 实现

**MVP 验收**：

- `trellis channel create <name> --task .trellis/tasks/<task>` 落 create 事件（cwd / task path / labels）
- `trellis channel spawn <name> --provider {codex|claude} --as <worker> --stdin` 拼 protocol prompt prefix（**MVP 用占位符**，prefix 实际内容后续讨论），启动长寿 worker 进程，supervisor 后台托管
- `trellis channel send <name> --as <self> --to <worker> --stdin` → supervisor 把消息翻译成 worker stream-json/JSON-RPC 写入 stdin
- `trellis channel wait <name> --as <self> --from <peer> --kind done [--timeout]` 阻塞等 `done` 语义事件
- `trellis channel send <name> --as <self> --kind interrupt --to <worker> --stdin` → cooperative interrupt 走 stdin 通道
- `trellis channel kill <name> --as <worker>` → 强杀
- 至少 2 个 worker（一 Codex 一 Claude）能在同一 channel 里并发对话（brainstorm 多 agent 场景）
- 全程事件在 `events.jsonl` 可复盘；worker session/thread id 落盘可供未来 resume

## Protocol prompt prefix

**MVP 状态：占位符**。`trellis channel spawn` 在拼接给 worker 的 initial prompt 前会附上一段固定的"你是 channel 中的 agent X，按 channel 协议工作"前缀，但**具体内容、完成 marker 约定、cooperative inbox check 指令** 等细节后续单独讨论决定。MVP 实现里 prefix 模板字符串以常量形式存在 `packages/cli/src/commands/channel/protocol-prompt.ts`，留 TODO 占位，验收时只检查 prefix 被注入即可、不检查内容。

## Naming reference

- **channel** = a collaboration session (shared append-only event log)
- **agent** = a participant in a channel (human dispatcher, or spawned codex/claude/opencode worker)
- Command surface: `trellis channel create / join / leave / send / wait / messages / spawn / kill / list / tui`

## Out of scope (本任务暂不做)

- 跨 Trellis task 的队列推进（属于 Autopilot）。
- 单个 worker 内部的工具循环 / 模型调用（属于 Trellis Code 或宿主 CLI）。
- GUI / TUI 前端（先有事件协议和 CLI 命令，UI 是其消费者）。
- 鉴权、远程协作、多机器分布式执行。
- 替换所有平台的 hook 注入。

## Acceptance Criteria (evolving)

- [ ] PRD 明确本任务与 `04-25-autopilot-run-queue`、`05-02-trellis-code-opencode` 的边界及依赖方向。
- [ ] 选定 MVP 切片（Layer 1 / 1+2 / 全部）并记录理由。
- [ ] 定义事件 schema（kind、tag、seq、by、ts、payload）。
- [ ] 定义命令面（`trellis agent <verb>` 或等价）。
- [ ] 定义 worker spawn 协议（prompt 前缀模板、cwd 注入、退出约定）。
- [ ] 定义 supervisor 行为（kill 信号、重启 prompt 合成、--no-supervise 等）。
- [ ] 协议自有 vs 外部参考的决策记录在 PRD。
- [ ] 复杂任务：补 `design.md` 和 `implement.md` 后再 `task.py start`。

## Open Questions (highest-value first)

1. 本任务是独立交付的"协作层"，还是应该并入 `05-02-trellis-code-opencode` 一起作为 Trellis Code 的多 worker 编排能力？（决定 task 是否独立存在）

---

## Implementation Status (post-build addendum, 2026-05-12)

This task shipped. Final landed surface and deviations from the original PRD:

### What shipped beyond the original MVP

- **Project-scoped disk layout**: channels live in `~/.trellis/channels/<sanitized-cwd>/<name>/` (claude-code style), with automatic one-time migration of legacy flat channels to `_legacy/`. Cross-cwd channel addressing via `selectExistingChannelProject`. Storage root overridable via `TRELLIS_CHANNEL_ROOT`.
- **`--ephemeral` lifecycle** + `channel prune --ephemeral` + `list --all` filter + `list` footer hint for hidden ephemerals.
- **`channel run` one-shot**: `create --ephemeral` + `spawn` + `send` + `wait done` + print final answer + auto-`rm` (on success) / keep + stderr path (on failure).
- **`wait --all --from a,b,c`**: wait until every listed agent emits the matching event.
- **`spawned` event** records `agent`, `files` (resolved paths), `manifests` (raw `--jsonl` paths even when empty).
- **`ShutdownController` state machine** (in `supervisor/shutdown.ts`) consolidates: kill ladder, killed-append, terminal-event synthesis on cold exit, finalize-on-exit await before `process.exit`, sync `claim()` API for pre-await intent stamping.
- **Refactor**: `supervisor.ts` split into 4 files (orchestrator + shutdown + stdout + inbox); orchestrator down to ~327 lines from 510.
- **Codex `commentary` → `progress`** (not `message`) so `wait --kind message` only wakes on real user-visible answers.
- **Plan / architect agent cards** under `.trellis/agents/` for brainstorming use.

### What was dropped vs. PRD

- **TUI** (`trellis channel tui`) — removed entirely. `messages --follow` proved more useful for the actual workflow; the Ink-based TUI was deleted along with its `ink` / `react` deps. Anyone wanting a richer UI builds a GUI client against `events.jsonl` directly.
- **Protocol prompt template** — still a placeholder. The system prompt prefix carries channel identity + a "do not override protocol rules" anchor; concrete cooperative-inbox semantics are deferred until a real use-case demands them.

### Where the durable spec lives

- **Project spec**: `.trellis/spec/cli/backend/commands-channel.md` (entry point, event taxonomy, supervisor invariants, security boundaries, future work).
- **Task spec**: this directory (`prd.md` / `design.md` / `implement.md`) — kept as historical planning artifacts; future readers should start from `commands-channel.md`.

### Out-of-scope follow-ups (separate tasks)

- `StorageAdapter` abstraction (LocalFs / S3 / DynamoDB plugability) — needs its own brainstorm + design phase.
- `events.jsonl` rotation — trigger thresholds defined (100MB OR 100k events) but not implemented; backlog only.
- Multi-tenant identity / shared-storage cross-user collaboration.
- GUI frontend consuming `events.jsonl` (CLI rendering rules translate directly).
