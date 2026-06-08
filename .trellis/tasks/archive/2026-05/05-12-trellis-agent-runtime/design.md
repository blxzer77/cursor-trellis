# design: Trellis Agent Runtime (`channel`)

技术设计文档。承接 `prd.md` 的 7 条决议。

## 1. 架构总览

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          User-level: ~/.trellis/channels/                   │
│  ┌────────────────────────────┐                                          │
│  │  <channel>/events.jsonl       │ ← single source of truth, append-only    │
│  │  <channel>/<channel>.lock        │ ← O_EXCL write lock                      │
│  │  <channel>/<worker>.log       │ ← worker stdout / stderr                 │
│  │  <channel>/<worker>.session-id│ ← Claude session id (for future resume)  │
│  │  <channel>/<worker>.thread-id │ ← Codex thread id (for future resume)    │
│  │  <channel>/<worker>.pid       │ ← supervisor pid                         │
│  │  <channel>/<worker>.config    │ ← supervisor restart config              │
│  └────────────────────────────┘                                          │
└──────────────────────────────────────────────────────────────────────────┘
                                    ▲ append events / fs.watch wakeup
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
┌───────┴─────────┐         ┌───────┴─────────┐         ┌───────┴─────────┐
│  Main agent     │         │  Supervisor     │         │  Other agent    │
│  (interactive)  │         │  (per worker)   │         │  (peer / human) │
│                 │         │                 │         │                 │
│ trellis channel    │         │ Owns 1 worker   │         │ trellis channel    │
│   send / wait /  │         │ proc.           │         │   join / send    │
│   read / spawn  │         │ Pipes stdin/    │         │                 │
└─────────────────┘         │ stdout.         │         └─────────────────┘
                            │                 │
                            │ Listens for     │
                            │ interrupts in   │
                            │ events.jsonl.   │
                            └────────┬────────┘
                                     │ stdin (stream-json / JSON-RPC)
                                     ▼
                            ┌────────────────┐
                            │  Worker proc   │
                            │ claude --      │
                            │ input-format   │
                            │ stream-json    │
                            │ — OR —         │
                            │ codex          │
                            │ app-server     │
                            └────────────────┘
```

**核心不变量**：
- `events.jsonl` 是协作状态的唯一权威。所有进程读它来同步、写它来广播。
- 主 agent 永远不直接读 `events.jsonl`——只通过 `trellis channel` CLI。
- 每个 spawned worker 有一个独立 supervisor 进程托管；supervisor 退出 = worker 失控（需要补救）。

## 2. 包布局

在现有 `packages/cli` 内新增 `commands/channel/` 子目录，避免新建 workspace package 增加发布负担：

```
packages/cli/src/
  commands/
    channel/
      index.ts                  ← `trellis channel` 子命令分发
      create.ts / join.ts / leave.ts / send.ts / wait.ts / read.ts / list.ts / tui.ts
      spawn.ts                  ← 启动 supervisor，detach 到后台
      kill.ts                   ← 通过 pid 文件发信号
      supervisor.ts             ← supervisor 进程入口（被 spawn fork 出来）
      protocol-prompt.ts        ← 占位符 prefix 模板（MVP TODO）
      adapters/
        claude.ts               ← Claude stream-json adapter
        codex.ts                ← Codex JSON-RPC 2.0 adapter
        types.ts                ← Adapter 接口
      store/
        events.ts               ← events.jsonl 读写 + O_EXCL 锁
        watch.ts                ← fs.watch + meaningful filter
        paths.ts                ← `~/.trellis/channels/<channel>/...` 路径计算
        schema.ts               ← Event TypeScript 类型 + 校验
  cli/
    index.ts                    ← 添加 `channel` 子命令注册
```

总计预估 ~1500-1800 行 TS（包含测试）。

## 3. 事件 Schema

所有事件都有公共字段：

```typescript
interface ChannelEventBase {
  seq: number;          // 单调递增，事件文件主键
  ts: string;           // ISO 8601 UTC
  kind: ChannelEventKind;
  by: string;           // agent name；"supervisor:<worker>" 表示是 supervisor 发的
}

type ChannelEventKind =
  | "create" | "join" | "leave"      // 生命周期
  | "message"                            // 用户消息（含 tag）
  | "spawned" | "killed" | "respawned"  // worker 进程事件
  | "progress" | "done" | "error"    // worker 工作语义事件
  | "waiting" | "awake"              // wait 状态指示（不唤醒 fs.watch）
  ;
```

各 kind 的字段：

```typescript
interface CreateEvent extends ChannelEventBase {
  kind: "create";
  project?: string;       // 来自 cwd basename 或 --project
  task?: string;          // .trellis/tasks/<task> 绝对路径
  cwd: string;
  labels?: string[];
}

interface MessageEvent extends ChannelEventBase {
  kind: "message";
  text: string;
  tag?: string;           // user-defined classification: interrupt / phase_done / question / ack / ...
  to?: string | string[]; // 目标 agent；缺省 = broadcast
}

interface SpawnedEvent extends ChannelEventBase {
  // by = "main" or whoever called channel spawn
  kind: "spawned";
  as: string;             // worker agent name
  cli: "codex" | "claude";
  pid: number;            // supervisor pid
  session_id?: string;    // Claude only, 启动初期未知，后续可能在 progress 事件中带上
}

interface KilledEvent extends ChannelEventBase {
  // by = "supervisor:<worker>"
  kind: "killed";
  reason: "interrupt-forceful" | "explicit-kill" | "crash";
  signal?: "SIGTERM" | "SIGKILL";
}

interface ProgressEvent extends ChannelEventBase {
  // by = "<worker>"
  kind: "progress";
  detail: {
    tool?: string;          // Claude: tool_use.name / Codex: tool_call.name
    input_summary?: string; // 截短的 tool input（避免巨型 JSON）
    text_delta?: string;    // optional streaming text snippet
  };
}

interface DoneEvent extends ChannelEventBase {
  // by = "<worker>"
  kind: "done";
  text?: string;            // worker 的最终输出/总结
  duration_ms?: number;
}

interface ErrorEvent extends ChannelEventBase {
  kind: "error";
  message: string;
  detail?: unknown;
}
```

**Wakeup 语义**（meaningful filter）：

- `message` / `leave` / `done` / `error` / `killed` / `spawned` / `respawned` 触发 wait 唤醒
- `join` 触发唤醒（让 wait 看到新成员）
- `progress` / `waiting` / `awake` **不**触发唤醒（避免 ping-pong）
- `create` 只对刚 join 进来的 wait 唤醒一次

## 4. 命令面

```
trellis channel create <name>
  [--task <abs-path>] [--project <slug>] [--labels a,b]
  [--cwd <path>]                      # default: process cwd

trellis channel join <name> --as <agent>

trellis channel leave <name> --as <agent>

trellis channel send <name> --as <agent>
  { <text> | --stdin | --text-file <path> }
  [--kind <tag>] [--to <agent[,agent...]>]
  [--wait [<duration>]]               # 发完后阻塞等回响
  # filter on wake:
  [--from <a,b>] [--kind <tag>] [--to <a,b>]

trellis channel wait <name> --as <agent>
  [--timeout <duration>]
  [--from <a,b>] [--kind <tag>] [--to <a,b>]
  # exit codes: 0 = got event, 124 = timeout, 1/2 = error

trellis channel read <name> [--last N] [--since <seq>] [--json]

trellis channel list [--project <slug>] [--archived]

trellis channel spawn <name>
  --provider {codex|claude} --as <worker>
  { --prompt <text> | --prompt-file <path> | --stdin }
  [--cwd <path>]                       # default: channel cwd
  [--model <id>] [--bg]                # --bg = detach supervisor (default true for spawn)

trellis channel kill <name> --as <worker>

trellis channel tui [<name>]
```

所有动词的目标都是 `events.jsonl` 这一个文件——子命令是它的不同 view / mutation。

## 5. Supervisor 进程模型

`trellis channel spawn` 是同步入口，它做以下事：

1. 校验 channel 存在、`<worker>` 名字未占用
2. 写一条 `spawned` 事件（带 supervisor 即将占用的 pid 占位 = 0，启动后回填）
3. fork 自己（`process.argv[0] + ['__supervisor', <channel>, <worker>, <config-file>]`）→ detach
4. 父进程返回 JSON `{pid, log_path, channel, worker}` 给调用者

Supervisor 子进程做：

```
1. 把 spawn 时的参数从 <worker>.config 读出来
2. spawn 实际 worker 进程（claude 或 codex），pipe stdin/stdout/stderr
3. 启 3 个并发任务（async loops）：
   a) stdout reader: 行 → 解析 stream-json/JSON-RPC → 翻译成 channel event → append events.jsonl
   b) inbox watcher: fs.watch events.jsonl → 找到发给本 worker 的 say → 翻译成 stream-json/JSON-RPC → 写 worker stdin
   c) signal handler: SIGTERM 自己 → 优雅关闭 worker → 退出
4. worker 进程 exit → 写 done 或 error 事件 → supervisor 自己退出
5. 把初始 prompt（拼上 protocol-prompt prefix）作为第一条 user message 写进 worker stdin
```

**Supervisor crash 的恢复**：MVP 不做自动恢复。`<worker>.pid` 残留，下次 `trellis channel kill` 会发现 pid 不存活、直接清理文件、写一条 `error{message:"supervisor lost"}` 事件。

## 6. Claude Adapter

MVP 只取我们流程必需的子集（启动 / 解析 / 编码 inbox 三件）。

### 启动

```typescript
function buildClaudeArgs(cfg: SpawnConfig): string[] {
  const args = [
    "-p",
    "--output-format", "stream-json",
    "--input-format", "stream-json",
    "--permission-mode", "bypassPermissions",
    "--dangerously-skip-permissions",
    "--verbose",
  ];
  if (cfg.resumeSessionId) args.push("--resume", cfg.resumeSessionId);
  if (cfg.model) args.push("--model", cfg.model);
  return args;
}
```

### Stdout 解析（每行一个 JSON）

```typescript
switch (msg.type) {
  case "system":
    if (msg.subtype === "init" && msg.session_id) {
      persistSessionId(workerName, msg.session_id);
    }
    break;
  case "assistant":
    for (const block of msg.message.content) {
      if (block.type === "text") {
        emitMessage(workerName, block.text);
      } else if (block.type === "tool_use") {
        emitProgress(workerName, { tool: block.name, input_summary: truncate(block.input) });
      }
    }
    break;
  case "user":
    // tool_result: 不广播（噪声大）；可选记录到 raw log
    break;
  case "control_request":
    // MVP: auto-allow，所有权限自动通过
    writeControlResponseAllow(stdin, msg.request_id, msg.request.input);
    break;
  case "result":
    emitDone(workerName, { text: msg.result, duration_ms: msg.duration_ms });
    break;
}
```

### Stdin 写

把一条 channel send 翻译成：

```json
{"type":"user","message":{"role":"user","content":[{"type":"text","text":"<channel 消息体>"}]}}
```

如果 tag = `interrupt`，prepend 一个明显标记：
```
[GRID INTERRUPT — drop current work and follow this new instruction]
<原 text>
```

### 关闭

`stdin.end()` → Claude 跑完 Stop hooks 优雅退 → 5s 不退则 SIGTERM → 3s 不退则 SIGKILL。

## 7. Codex Adapter

Codex 走 `app-server` 的 JSON-RPC 2.0 协议（与 claude 的 stream-json 显著不同），单独走一遍生命周期 + 解析路径。

### 启动

```typescript
function buildCodexArgs(cfg: SpawnConfig): string[] {
  const args = ["app-server", "--listen", "stdio://"];
  if (cfg.model) args.push("-c", `model="${cfg.model}"`);
  if (cfg.reasoningEffort) args.push("-c", `model_reasoning_effort="${cfg.reasoningEffort}"`);
  return args;
}
```

### JSON-RPC 2.0 握手

```typescript
// 1. initialize
await rpcCall("initialize", { clientInfo: { name: "trellis-channel", version: <ver> } });

// 2. thread/new (or thread/resume)
const thread = cfg.resumeThreadId
  ? await rpcCall("thread/resume", { threadId: cfg.resumeThreadId })
  : await rpcCall("thread/new", { workDir: cfg.cwd });
persistThreadId(workerName, thread.threadId);

// 3. send initial prompt
await rpcCall("thread/sendMessage", {
  threadId: thread.threadId,
  content: initialPromptWithPrefix,
});
```

### 通知解析

```typescript
function onNotification(msg: JsonRpcNotification) {
  if (msg.method !== "thread/event") return;
  const ev = msg.params.event;
  switch (ev.type) {
    case "agent_message_delta":
      emitProgress(workerName, { text_delta: ev.delta });
      break;
    case "agent_message":
      emitMessage(workerName, ev.text);
      break;
    case "tool_call":
      emitProgress(workerName, { tool: ev.name, input_summary: truncate(ev.args) });
      break;
    case "turn_completed":
      emitDone(workerName, {});
      break;
    case "error":
      emitError(workerName, ev.message);
      break;
  }
}
```

### 后续消息

```typescript
await rpcCall("thread/sendMessage", { threadId, content: nextUserMessage });
```

### 关闭

`stdin.end()` → Codex app-server SIGINT 自己 → exit。

## 8. Events.jsonl 锁

写并发场景：
- supervisor 写 progress / message / done
- 主 agent 写 send / wait（waiting/awake 事件）
- 其他 agent 写 message
- 多个 channel 进程互不相干（每个 channel 一个目录、一把锁）

**锁策略**：每次 append 一条事件需要：

```typescript
async function appendEvent(channelDir: string, event: ChannelEvent): Promise<void> {
  const lockPath = `${channelDir}/${path.basename(channelDir)}.lock`;
  await acquireLock(lockPath, { retries: 50, intervalMs: 20 });  // ~1s total
  try {
    // re-read last seq from events.jsonl tail to assign new seq
    const nextSeq = await readLastSeq(channelDir) + 1;
    event.seq = nextSeq;
    await fs.appendFile(`${channelDir}/events.jsonl`, JSON.stringify(event) + "\n", { flag: "a" });
  } finally {
    await releaseLock(lockPath);
  }
}
```

`acquireLock` 用 `open(path, "wx")` (O_EXCL) 尝试，失败 sleep + retry。锁文件里写 pid 便于诊断。

**风险**：锁 contention 在多 agent 并发说话时可能拖慢。MVP 接受 ~20ms/事件的串行化延迟；未来如果热点路径有问题，再换 SQLite 或类似。

## 9. fs.watch + 唤醒

```typescript
async function* watchEvents(channelDir: string, fromSeq: number) {
  const path = `${channelDir}/events.jsonl`;
  let pos = await statSizeAt(path, fromSeq);
  const watcher = fs.watch(path);
  for await (const _ of watcher) {
    const tail = await readFromOffset(path, pos);
    for (const event of parseLines(tail)) {
      pos += JSON.stringify(event).length + 1;
      yield event;
    }
  }
}
```

调用方负责 filter（from / kind / to）。

**跨平台风险**：
- macOS / Linux: `fs.watch` 行为正常
- Windows: `fs.watch` 在某些情况下漏事件——MVP 加 200ms 兜底 polling，未发现新事件就 stat 一次文件大小
- macOS 偶发的"重复触发"：用 seq 去重即可（事件文件本身去重）

## 10. Protocol prompt prefix (占位)

`packages/cli/src/commands/channel/protocol-prompt.ts`：

```typescript
// TODO: design the actual prefix.
// Decided in PRD Q4': MVP uses placeholder; actual content discussed later.
export const PROTOCOL_PROMPT_PREFIX = `\
[TRELLIS GRID PROTOCOL — placeholder]
You are agent '\${agentName}' in channel '\${channelName}'.
Follow the user instruction below. When done, end your final assistant
message with a clear completion marker.
`;

export function buildProtocolPrompt(args: { channelName: string; agentName: string; userPrompt: string }): string {
  return interpolate(PROTOCOL_PROMPT_PREFIX, args) + "\n\n" + args.userPrompt;
}
```

MVP 测试只校验"prefix 被注入"，不校验内容。后续 task 替换。

## 11. Hooks 集成

`trellis channel spawn` 通过 child env 设：

```
TRELLIS_HOOKS=0                # 短路所有现有 Trellis hook（已存在的能力）
TRELLIS_CHANNEL=<channel-name>
TRELLIS_CHANNEL_AS=<worker-name>
TRELLIS_CHANNEL_DIR=<abs channel dir path>
```

现有 `.claude/hooks/*` `.codex/hooks/*` `packages/cli/src/templates/{claude,codex,shared-hooks}/hooks/*` **无需改动**——`TRELLIS_HOOKS=0` 已经是它们的 early-return 条件。

## 12. 失败模式与恢复

| 故障 | 影响 | MVP 处理 |
|---|---|---|
| Worker 进程崩溃 | supervisor 收到 stdout EOF / SIGCHLD | 写 `error` 事件，supervisor 自己退出，不 respawn |
| Supervisor 崩溃 | worker 失控继续跑 | `<worker>.pid` 残留；下次 `kill` / `list` 时探测 pid 不存活 → 清理 + 写 `error` |
| events.jsonl 写半截 | 一行 JSON 不完整 | 解析时跳过损坏行 + 日志告警 |
| 锁文件残留 | 锁被持有者崩溃后未释放 | 锁文件里写 pid；acquire 超时 1s 时检查 pid 是否存活，不存活就强抢 + 写 warning 事件 |
| Claude / Codex 协议升级 | stream-json 字段变了 | adapter 写得宽松（unknown 字段跳过、未知 type 透传成 `raw` 不广播）|

## 13. 测试策略（TDD-first，真实 CLI）

**纪律**：每个增量都先写失败测试，再写实现，再绿。不允许"先写一坨实现再补测试"的反向流。

### 13.1 测试分层

| 层 | 形态 | 目的 | 依赖 |
|---|---|---|---|
| **Pure parser unit** | Vitest，fixture string → expected struct | stream-json / JSON-RPC 行解析正确性 | 无外部依赖；fixture 行用真实 CLI 录制下来落到 `test/fixtures/wire/` |
| **Store unit** | Vitest，临时目录（`os.tmpdir()` + 隔离 channel 名） | seq / lock / watch / append 正确性 | 仅 fs |
| **Multi-process integration** | Vitest，spawn 真实 `trellis channel` 子进程 | 多 agent 并发 say/wait/leave 时事件流正确 | trellis CLI 自身（同 repo build 产物） |
| **Real adapter integration** | Vitest，spawn 真实 `claude` / `codex app-server` | adapter ↔ 真实 CLI 协议端到端通 | **真实 claude / codex 二进制 + 有效 auth** |
| **Manual dogfood** | 手跑 `trellis channel spawn` 真案例 | brainstorm 多 agent / implement worker 真实可用 | 同上 + 真实 LLM 配额 |

### 13.2 真实 CLI 测试是 MVP 验收的硬要求

理由：stream-json / JSON-RPC 这两条协议的 contract 不只是"字段名对不对"——还有时序（事件触发顺序）、framing（一行一帧 vs 多行）、错误边界（claude 拒绝某些 control_request）。stub 只能模拟我们已经知道的形态；真实 CLI 才能暴露我们假设错的地方。

**MVP 阶段做法**：
- 本地开发机有 `claude` 和 `codex` 可执行 + 有效 auth 配置
- 真实 adapter / 真实 supervisor / dogfood 测试**只在本地跑**，标记 `describe.skipIf(!hasRealClaude())`
- CI 只跑 §13.1 前 3 层（pure parser / store / multi-process integration）；不装真实 CLI

**Fixture wire 录制**：
- 写一个一次性 helper `scripts/record-fixture.ts`：手动跑一个 prompt（"say hi"）通过真实 claude / codex，把 stdout 每一行原样落到 `test/fixtures/wire/claude/hello.jsonl` / `codex/hello.jsonl`
- pure parser 测试就吃这些真实录制行
- 录制随版本可重做，但**不让 CI 重新录**（CI 没有真实 CLI）

### 13.3 TDD 循环示例

每个小增量都按 red → green → next：

```
# §1.4 appendEvent
1. 写 test/commands/channel/store/events.test.ts：
   it("assigns monotonic seq under concurrent appends", async () => {
     await Promise.all(Array.from({length: 50}, () => appendEvent(channel, fake)));
     const events = await readEvents(channel);
     expect(events.map(e => e.seq)).toEqual([1,2,...,50]);
   });
2. pnpm test → red
3. 写 events.ts 实现
4. pnpm test → green
5. 进入下一个增量（损坏行容错）

# §3.2 Claude adapter
1. 录 fixture：scripts/record-fixture.ts --provider claude --prompt "list files"
   → test/fixtures/wire/claude/list-files.jsonl
2. 写 test/commands/channel/adapters/claude.test.ts：
   it("translates a recorded stream-json trace into expected channel events", () => {
     const lines = readFile("fixtures/wire/claude/list-files.jsonl").split("\n");
     const events = lines.flatMap(l => adapter.parseStdoutLine(l));
     expect(events.find(e => e.kind === "say")).toBeDefined();
     expect(events.find(e => e.kind === "progress" && e.detail.tool === "Read")).toBeDefined();
     expect(events.find(e => e.kind === "done")).toBeDefined();
   });
3. red → 写 adapter → green
4. 加 real integration test（skipIf no claude bin）：
   it.skipIf(!hasClaude())("end-to-end with real claude", async () => {
     // 真起 claude --input-format stream-json
     // 写一条 user message
     // 等到 done event
     // 校验 session-id 被记下
   });
5. 本地 pnpm test 跑通；CI 跳过 skipIf 部分
```

### 13.4 完整测试矩阵

```
test/commands/channel/
  store/
    paths.test.ts             ← pure；§1.1
    schema.test.ts            ← pure；§1.2
    lock.test.ts              ← fs；§1.3 + 并发 race
    events.test.ts            ← fs + 并发；§1.4
    watch.test.ts             ← fs.watch + 时序；§1.5
  adapters/
    claude.test.ts            ← pure parser；用 fixtures/wire/claude/*.jsonl
    claude.integration.test.ts ← skipIf(!claude bin)；真起 claude
    codex.test.ts             ← pure parser；用 fixtures/wire/codex/*.jsonl
    codex.integration.test.ts ← skipIf(!codex bin)；真起 codex app-server
  cli/
    create-join-leave.test.ts ← 单进程 store 命令
    read-list.test.ts         ← 同上
    say-wait.test.ts          ← multi-process：execa 起两个真 trellis 子进程
    spawn-stub.test.ts        ← spawn 一个 echo shell stub（不是 LLM），测 supervisor 框架
    spawn-real.integration.test.ts ← skipIf(!claude && !codex)；真 spawn LLM 子进程
    kill.test.ts              ← pid 信号 + 文件清理
  e2e/
    brainstorm.integration.test.ts ← skipIf；真 spawn 2 LLM worker，互发消息，验证 events.jsonl 全程
    implement-worker.integration.test.ts ← skipIf；真 spawn 1 LLM 跑个简单 task

test/fixtures/
  wire/                       ← 真实 CLI 录制下来的行
    claude/
      hello.jsonl
      list-files.jsonl
      ...
    codex/
      hello.jsonl
      list-files.jsonl
      ...
  stub-cli/                   ← 仅用于 supervisor 框架测试，不 mock LLM 协议
    echo.sh                   ← 一个回显进程，验证 spawn / pipe / kill 信号链
```

### 13.5 不要 commit

整个 brainstorm + implement 期间**不向 git 提交任何代码**。本地 `pnpm test` 反复迭代，等用户审过实现 + 真实 dogfood 通过再讨论提交。Trellis workflow `task.py` 状态依旧推进（`planning` → `in_progress` → `completed`），仅记录 task 内部状态，不触发 git commit。

### 13.6 真实 CLI 不可用时

CI / fresh checkout / 用户没装 claude/codex 时：
- `hasRealClaude()` / `hasRealCodex()` 探测 `which claude` + 简单 `claude --version` 不报错
- skipIf 跳过 integration suite，留 warning：`skipped 12 integration tests; install claude/codex to run`
- pure parser 层仍用 fixture/wire/ 行跑——这些行是某次录制的快照，能跟住协议小版本变化，无需实时 CLI

## 14. 与既有 Trellis 设施的关系

- `cli_adapter.py`：现有 Python 模板里那个，**不复用**——它跑在 hook context 里、是 Python；channel runtime 是 TS 的。但它的"每平台启动参数"是好参考，要确保新 adapter 的参数和它保持语义一致。
- `.trellis/.runtime/`：channel 不放这里（决议 Q5：用户级 `~/.trellis/channels/`）。
- `task.json` / `prd.md`：channel 通过 `--task <path>` 引用 task 目录，但**不**写 task 文件。Channel 只读 task 目录是为了把 prd 路径塞进 worker 协议 prompt。
- `inject-workflow-state` hook：被 `TRELLIS_HOOKS=0` 短路，channel worker 完全跳过它。
- Autopilot / Trellis Code：未来消费者；本任务不接它们，但事件 schema 设计时留足语义层（done / error / progress）。

## 15. 已知 trade-offs（记入 ADR）

1. **每条事件一把锁**：写并发 ~20ms 延迟。换 SQLite 能解，但 MVP 不值。
2. **MVP 不做 resume command**：session/thread id 落盘但没 CLI 复用。Trade：MVP scope 小；代价：v2 时 CLI 加命令、adapter 加复用路径，约 200-300 行。
3. **bypassPermissions / dangerous-skip-permissions 默认开**：本质决定：channel worker 默认就是"被驱动的进程"，安全边界由调用 channel spawn 的人负责。
4. **Cooperative interrupt 依赖 worker 模型遵循 prompt 指令**：不是硬保证。所以 MVP 同时提供 `kill` 作为硬中断。
5. **不支持 macOS Spotlight / Linux inotify 满负荷场景**：fs.watch 在文件描述符耗尽 / inotify watch quota 用尽时失效，MVP 不重试不降级，记 error 事件即可。
