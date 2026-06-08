# implement: Trellis Agent Runtime (`channel`)

承接 `design.md`。MVP 实施清单，按依赖顺序排列。

## 工作纪律（READ FIRST）

1. **TDD 强制**：每个增量先写**失败测试**，再写实现，再绿。不允许"先写实现再补测试"。
2. **真实 CLI 优先**：adapter / supervisor / e2e 测试必须能针对真实 `claude` 和 `codex app-server` 跑通——本地必跑，CI 用 skipIf 跳过。
3. **不 commit**：整个实施周期内不向 git 提交任何代码；本地 `pnpm test` 反复迭代，dogfood 通过后再讨论提交策略。
4. **不派 sub-agent**：主 session 自己干，**不能**通过 `trellis-implement` / `trellis-check` / Codex `multi_agent` / Claude `Task` tool 把活外包给子代理。用户要逐步审。
5. **录制 fixture wire**：碰到协议解析需要 fixture 时，跑 `scripts/record-fixture.ts` 用真实 CLI 录一段下来落到 `test/fixtures/wire/`，不要手写假数据。
6. **小步走 / 等审**：每个 checkbox 都对应一次 red → green 循环；每完成一个增量**暂停等用户审**，不批量推进。

## 0. 准备

- [ ] 写测试：`test/commands/channel/smoke.test.ts` 期望 `trellis channel --help` 输出包含 "channel"——red（命令不存在）
- [ ] 在 `packages/cli/src/commands/channel/index.ts` 注册空 `channel` 子命令 → green
- [ ] 创建 `test/fixtures/wire/{claude,codex}/.gitkeep`、`test/fixtures/stub-cli/.gitkeep`
- [ ] 写 `scripts/record-fixture.ts` 雏形：`pnpm record-fixture --provider claude --prompt "hello"` → 起真实 claude → 把 stdout 行落到 `test/fixtures/wire/claude/<slug>.jsonl`
- [ ] 用它录第一份：`hello.jsonl`（claude）+ `hello.jsonl`（codex）。手动检查内容长得对（有 `system.init` / `assistant.text` / `result` 三类行）
- [ ] 写 `test/helpers/has-real-cli.ts`：`hasRealClaude()` / `hasRealCodex()` 探测函数

**验证**：`pnpm test` 全绿；fixture 目录里有真实录制的 jsonl；`hasRealClaude()` 在你的机器上返回 true。

## 1. Store 层：事件总线

### 1.1 路径与目录（TDD）

- [ ] 写 `test/commands/channel/store/paths.test.ts`：纯函数测试用例（含空格、中文、`~` 展开、Windows 反斜杠）——red
- [ ] 写 `commands/channel/store/paths.ts` 实现 → green
- [ ] 加 `ensureChannelDir` 幂等测试 → red
- [ ] 实现 → green

### 1.2 事件 schema（TDD）

- [ ] 写 `test/commands/channel/store/schema.test.ts`：每个 kind 一个 parse 用例 + 字段缺失 / 未知 kind 容错 → red
- [ ] 写 `commands/channel/store/schema.ts` 实现 → green

### 1.3 锁（TDD）

- [ ] 写测试：单 promise 拿锁 + 释放 → red
- [ ] 实现 acquireLock / releaseLock → green
- [ ] 写测试：并发 50 个 promise 拿同一把锁 → red
- [ ] 实现重试 + sleep → green
- [ ] 写测试：锁残留（手写一个 pid 不存活的 lock 文件）→ acquire 强抢 → red
- [ ] 实现 pid liveness 检测 → green
- [ ] 加 withLock helper（包一层）+ 测试

### 1.4 Append（TDD，每个用例独立一轮）

- [ ] 测试：单条 appendEvent → readEvents 回来；seq=1 → red → 实现 → green
- [ ] 测试：连续 5 条 appendEvent → seq 1..5；用例失败再实现
- [ ] 测试：并发 100 个 appendEvent → seq 单调 1..100 无丢无重 → red → 加锁实现 → green
- [ ] 测试：人工塞一行损坏 JSON → readEvents 跳过 + 报 warning（spy console.warn）→ red → 实现 → green
- [ ] 测试：tailFile 取 1MB 文件末尾 5 行 < 50ms → red → 实现 backward read → green

### 1.5 Watch（TDD，红绿循环）

- [ ] 测试：watch + 同进程 append 1 条 → 1s 内收到 → red → 实现 fs.watch + 偏移追踪 → green
- [ ] 测试：filter from=alice，append bob 的 message → 不收到（用 race against timeout 1s）→ red → 实现 filter → green
- [ ] 测试：meaningful filter 表——8 种 kind 各一个 case，验证唤醒/不唤醒 → red → 实现 → green
- [ ] 测试：另一进程（用 `execa` 跑个一次性 `node -e 'appendEvent(...)'`）append → 跨进程 watch 能收到 → red → 修 → green
- [ ] 测试：200ms 兜底 polling（mock fs.watch 不触发，仅靠 stat）→ red → 实现 → green

## 2. CLI 层：纯 store 命令

### 2.1 create / join / leave / read / list（每个 CLI 命令独立 TDD）

每个命令的循环：
1. 写 `test/commands/channel/cli/<cmd>.test.ts`，用 `execa('node', ['dist/cli/index.js', 'channel', '<cmd>', ...])` 跑真实子进程
2. 断言：进程 exit code + events.jsonl 内容 + stdout
3. red → 实现 → green
4. 再加一个 edge case 测试（如 create 重名 / join 幂等）→ red → 修 → green

### 2.2 send / wait（TDD，关键多进程测试）

- [ ] 测试：单进程 send → events.jsonl 有 message 事件 → red → 实现 send.ts → green
- [ ] 测试：单进程 wait --timeout 100ms 没人 send → exit 124 → red → 实现 wait.ts 基础形态 → green
- [ ] 测试：**两个真实 trellis 子进程并发**——A `wait`，主进程在 200ms 后让 B `message`，A 在 1s 内退 0 并打印 → red → 修 → green
- [ ] 测试：filter（from / kind / to）的多 case 表 → red → 实现 filter glue → green
- [ ] 测试：`send --wait` 串联 → red → 实现 → green

## 3. Adapter 层

### 3.1 公共接口

- [ ] `commands/channel/adapters/types.ts`：
  ```typescript
  interface WorkerAdapter {
    name: "claude" | "codex";
    buildArgs(cfg: SpawnConfig): string[];
    buildEnv(cfg: SpawnConfig): Record<string, string>;
    parseStdoutLine(line: string): ChannelEventPartial[];   // 翻译 stream-json/JSON-RPC 行
    encodeUserMessage(text: string, tag?: string): string; // 翻译用户消息为协议 JSON
    onControlRequest?(req, stdin): void;                  // Claude 才有
    onSpawn?(stdin): void;                                // 写 JSON-RPC initialize 等
  }
  ```

### 3.2 Claude adapter（TDD：先 fixture wire 测，再真 CLI 集成）

**前置**：用 `scripts/record-fixture.ts` 录至少 3 段：
- `hello.jsonl`（一个简单回答）
- `list-files.jsonl`（含 tool_use Read）
- `permission.jsonl`（含 control_request）

每段都是从真实 `claude --input-format stream-json ...` 录下来的 stdout。

- [ ] 测试：`hello.jsonl` 喂 parseStdoutLine → 期望事件序列含 system.init / message / done → red → 实现基础 switch → green
- [ ] 测试：`list-files.jsonl` → 期望含 progress(tool=Read) → red → 加 tool_use 处理 → green
- [ ] 测试：`permission.jsonl` 中的 control_request → adapter 调用 stdin.write 一次 auto-allow JSON → red → 实现 onControlRequest → green
- [ ] 测试：encodeUserMessage 输出 JSON 字符串 + interrupt tag 加 prefix marker → red → 实现 → green
- [ ] 测试：session_id 副作用——解析到 system.init 时调一次 `persistSessionId(worker, id)` → red → 实现 → green
- [ ] **集成测试**（skipIf no claude）：真起 `claude --input-format stream-json`，写 "hello"，读回，断言至少一个 message 事件 + 一个 done 事件 + session-id 落盘 → red → 调通 buildArgs / pipe → green

### 3.3 Codex adapter（同 §3.2，先 fixture wire 再真集成）

**前置**：用 `scripts/record-fixture.ts` 录至少 3 段 `codex app-server` 的 stdout（含 initialize 应答、thread/new 应答、thread/event 通知序列）：
- `hello.jsonl`
- `list-files.jsonl`
- `error.jsonl`（让 codex 处理一个明显出错的 prompt）

- [ ] 测试：parseStdoutLine + initialize response 匹配 → red → 实现 JSON-RPC frame 区分 response/notification → green
- [ ] 测试：thread/event agent_message_delta → progress 事件 → red → 实现 → green
- [ ] 测试：thread/event tool_call → progress(tool=...) → red → 实现 → green
- [ ] 测试：turn_completed → done → red → 实现 → green
- [ ] 测试：thread_id 持久化副作用 → red → 实现 → green
- [ ] **集成测试**（skipIf no codex）：真起 `codex app-server --listen stdio://`，走完一轮 initialize / thread/new / sendMessage，断言事件序列 + thread-id 落盘 → red → 调通 → green

## 4. Supervisor

- [ ] `commands/channel/supervisor.ts`：作为独立入口点；从 argv 接 `<channel> <worker> <config-path>`
- [ ] 读 config → 选 adapter → spawn worker → wire stdin/stdout/stderr
- [ ] 同时跑三个 async loop：
  - stdout reader: line → adapter.parseStdoutLine → appendEvent
  - inbox watcher: watchEvents(filter to=worker) → adapter.encodeUserMessage → worker.stdin.write
  - signal handler: SIGTERM 自己 → close worker stdin (graceful) → 5s 超时 SIGTERM worker → 3s 超时 SIGKILL worker → exit
- [ ] 写 `<worker>.pid` （自己的 pid）、`<worker>.log` （worker stdout/stderr）
- [ ] worker exit → 写 `done` 或 `error` 事件 → supervisor 自己 exit 0

**TDD 顺序**：

- [ ] 先用 `test/fixtures/stub-cli/echo.sh`（一个简单的 stdin → stdout 回显进程，**不模拟 LLM 协议**）测 supervisor 框架本身：
  - 测试：spawn echo stub → supervisor 写 spawned 事件 / pid 文件 → red → 实现 → green
  - 测试：发 SIGTERM 给 supervisor → echo stub 退出 + killed 事件写出 → red → 实现 signal handler → green
- [ ] 再用 §3.2 / §3.3 的 fixture wire 测 supervisor + adapter 组合：
  - 测试：mock 一个会按 fixture jsonl 行回放的"假 CLI"（cat 一个 fixture 文件给 stdout），supervisor + claude adapter 串起来 → 期望事件 → red → 修 → green
- [ ] **集成测试**（skipIf no claude）：真 spawn `claude --input-format stream-json` 作为 supervisor 的 worker，主测试进程通过 watchEvents 读 supervisor 写出的 channel 事件，确认 "hello" prompt 走完整流程 → red → 修 → green

## 5. CLI 层：进程编排命令

### 5.1 spawn

- [ ] `commands/channel/spawn.ts`：
  - 校验 `<worker>` 名字 free（grep events.jsonl 找最近 spawned/killed）
  - 拼 protocol prompt prefix（用占位符模块 `protocol-prompt.ts`）
  - 写 `<worker>.config` 配置文件
  - `child_process.fork(supervisorEntry, [channel, worker, configPath], { detached: true, stdio: "ignore" })`
  - parent unref + exit
  - 立即返回 JSON `{ pid, log_path, channel, worker }`
  - **不**自己写 `spawned` 事件——交给 supervisor 拿到自己 pid 后写

### 5.2 kill

- [ ] `commands/channel/kill.ts`：
  - 读 `<worker>.pid`
  - `process.kill(pid, "SIGTERM")` → poll alive 3s → `SIGKILL`
  - 不写 killed 事件（supervisor 退出时自己写）；如果 supervisor 已不在，自己代写一条 `error{message:"supervisor lost", supervisor_pid:<pid>}`
  - 清理 `<worker>.pid` / `.config`（保留 .log / .session-id 供 forensic）

### 5.3 protocol-prompt 占位

- [ ] `commands/channel/protocol-prompt.ts`：导出 `PROTOCOL_PROMPT_PREFIX` 占位常量 + `buildProtocolPrompt({channelName, agentName, userPrompt})` 函数；测试只验证"prefix 已注入"

**TDD**：

- [ ] 测试：spawn echo stub（fork 真实子进程）→ 返回 JSON 含 pid + pid 文件存在 → red → 实现 spawn.ts → green
- [ ] 测试：spawn 后 3s 内 events.jsonl 有 `spawned` 事件（由 supervisor 写）→ red → 修协议 → green
- [ ] 测试：spawn 同名 worker 第二次 → 拒绝（exit 非 0）→ red → 实现校验 → green
- [ ] 测试：kill → pid 不再存活 + `killed` 事件 → red → 实现 kill.ts → green
- [ ] 测试：kill 不存在 worker → 友好报错 → red → 实现 → green
- [ ] **集成**（skipIf no claude）：spawn 真 claude；wait done；事件序列完整 + session-id 文件存在

## 6. TUI（可选，可推迟）

- [ ] `commands/channel/tui.ts`：用 Ink 或 blessed 渲染 events.jsonl 实时流；分栏显示 agents
- [ ] 优先级低于功能 MVP；如果 6 周内做不完，post-MVP

## 7. 测试与文档

### 7.1 测试已分散到 §0-§5，本节是收尾

由于 TDD 强制，每个增量步骤已经把测试写完了。本节只确认：

- [ ] vitest run 全绿（包括 skipIf 跳过的整数）
- [ ] hasRealClaude / hasRealCodex 为 true 的机器上跑：所有 `*.integration.test.ts` 全绿
- [ ] CI 矩阵：仅跑非 integration 部分（pure parser / store / multi-process），integration 全 skip

### 7.2 端到端 dogfood（不算自动测试，但 MVP 必跑）

- [ ] 在本仓库手跑：建一个 demo channel，spawn 一个 real claude worker，写一条 message，等 done，read 全部事件，肉眼校验
- [ ] 再跑 brainstorm 多 agent：spawn 一个 claude + 一个 codex，让主进程互发消息驱动它们讨论，read 事件流确认没有死锁 / 丢消息

### 7.3 文档

- [ ] `docs-site/docs/channel.md`（或对应中文文件）：
  - 概念：channel / agent / event
  - 命令速查
  - brainstorm 多 agent 工作流示例
  - implement worker spawn 示例
  - 故障排查（pid 残留 / 锁文件 / log 在哪）

## 8. 验收 / Review gate

`task.py start` 之前要确认：

- [ ] `prd.md` / `design.md` / `implement.md` 完整、决策一致
- [ ] 用户审过 design.md（特别是 §6 / §7 adapter 协议解读）
- [ ] Protocol prompt prefix 占位符方案被接受（后续单独 task 设计内容）
- [ ] CI 矩阵确认（macOS / Linux 必须；Windows 标记 known limitation）

任务期间 / 完成时要做：

- [ ] 每个增量步骤遵循 TDD（red → green）；不允许跳过测试先写实现
- [ ] 全部测试绿 + lint + typecheck（本地，含 integration）
- [ ] `trellis channel` 命令族在本仓库自身跑通：建一个 demo channel，spawn 真实 claude / codex worker，多 agent 互发消息，最后 kill
- [ ] **不向 git 提交任何代码**——所有迭代在工作目录里完成；最终是否 commit / 怎么 commit 等用户审过 dogfood 再决定
- [ ] 写一篇 `update-spec` 把 channel runtime 的"事件 schema 是源 of truth、worker 必经 stream-json / app-server、TRELLIS_HOOKS=0 是 spawn 协议的一部分"等结论沉淀

## 9. 回滚 / Rollback points

| 进度 | 回滚成本 |
|---|---|
| §0 骨架 + §1 store 完成 | 几乎无——`commands/channel/` 是独立子树，直接删除 |
| §2 纯 store CLI 完成 | 低——没有外部副作用，只是文件系统 IO |
| §3 adapter 完成 | 低——adapter 没被任何东西调用 |
| §4 supervisor 完成 | 中——supervisor 是可执行入口，需要清理 detached 进程的方法（kill 命令必须先到位） |
| §5 spawn 完成 | 中——开始有 detached 子进程；回滚需要先 `trellis channel kill` 清理所有 channel + 删 `~/.trellis/channels/` |

## 10. 排程估计

| 阶段 | 估时 |
|---|---|
| §0 骨架 + §1 store | 2 天 |
| §2 纯 store CLI | 1.5 天 |
| §3 adapter (Claude + Codex) | 3 天 |
| §4 supervisor | 2 天 |
| §5 spawn/kill | 1 天 |
| §7 测试 + stub CLI 完整化 | 2 天 |
| §6 TUI（如做） | +1.5 天 |
| 缓冲 / dogfood | 2 天 |

**合计 13.5 天** ≈ 2.5 周（不含 TUI 和 dogfood 反复）。
