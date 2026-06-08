# trellis-core SDK package design

## 总体结论

新增 `packages/core`，发布为 `@mindfoldhq/trellis-core`。第一版按 Node-only ESM library 设计，不做 browser/isomorphic SDK。Trellis channel 依赖 filesystem、lock、watch、child process、stdin/stdout supervisor；当前最重要的是边界清晰和单一来源，不是多运行时兼容。

目标分层：

```text
@mindfoldhq/trellis-core = domain + storage + runtime primitives
@mindfoldhq/trellis      = CLI args + terminal rendering + exit codes
downstream Node services = in-process consumers of trellis-core
```

CLI 调 core；下游 Node 消费方也调 core。SDK 不能是 CLI wrapper，CLI 也不能继续独占 channel 语义。

## Workspace layout

```text
packages/
  core/
    package.json
    tsconfig.json
    src/
      index.ts
      channel/
      task/
      testing/
  cli/
    package.json
    src/
```

`packages/cli/package.json` 增加：

```json
{
  "dependencies": {
    "@mindfoldhq/trellis-core": "workspace:*"
  }
}
```

根 `pnpm-workspace.yaml` 已经包含 `packages/*`，不需要新 workspace pattern。

## Package exports

第一版 ESM-only。`ts-sdk-author` 的默认建议是新 SDK 使用 tsdown 输出 dual
ESM/CJS；这里有意偏离该默认值，理由是 Trellis CLI 当前已经是 Node ESM，
P0 消费方也是 Node ESM/TypeScript，先减少 build/release 变量。CJS 支持后续
通过 tsdown dual emit 单独引入。

```json
{
  "name": "@mindfoldhq/trellis-core",
  "version": "0.6.0-beta.N",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    "./package.json": "./package.json",
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./channel": {
      "types": "./dist/channel/index.d.ts",
      "import": "./dist/channel/index.js",
      "default": "./dist/channel/index.js"
    },
    "./task": {
      "types": "./dist/task/index.d.ts",
      "import": "./dist/task/index.js",
      "default": "./dist/task/index.js"
    },
    "./testing": {
      "types": "./dist/testing/index.d.ts",
      "import": "./dist/testing/index.js",
      "default": "./dist/testing/index.js"
    }
  },
  "files": ["dist"],
  "sideEffects": false,
  "publishConfig": {
    "access": "public",
    "provenance": true
  }
}
```

每个 `exports` branch 必须保持 `types` 在前、`default` 在最后。不要添加
`./internal`、`./store`、wildcard subpath，避免把实现细节变成 public API。

不导出 `internal/*`、`store/*`、`adapters/*` 实现路径。需要给用户的 store 类型通过 public API 暴露，不开放深导入。

暂不引入 tsdown。第一版用 `tsc` 输出 ESM + declarations，减少迁移变量。等 API 稳定或出现 CJS consumer，再单独评估 tsdown dual ESM/CJS；届时需要 `.mjs/.cjs` 与 `.d.mts/.d.cts` 成对输出。

## Source layout

```text
packages/core/src/
  index.ts

  channel/
    index.ts
    api/
      create.ts
      send.ts
      post-thread.ts
      read.ts
      wait.ts
      spawn.ts
      kill.ts
      types.ts
    internal/
      store/
        events.ts
        paths.ts
        lock.ts
        watch.ts
        seq.ts
        schema.ts
        filter.ts
        thread-state.ts
      supervisor/
        runtime.ts
        inbox.ts
        shutdown.ts
      adapters/
        claude.ts
        codex.ts
        types.ts

  task/
    index.ts
    api/
      records.ts
      phases.ts
      paths.ts
      types.ts
    internal/
      fs.ts
      schema.ts

  testing/
    index.ts
```

`api/` 是 public contract。`internal/` 是 implementation detail，不能被 `packages/cli` 深导入；CLI 只能用 public API。如果 CLI 确实需要某个能力，先把它提升为 core public API。

## Channel public API MVP

第一批 public API：

```ts
export type ChannelScope = "project" | "global";
export type ChannelType = "chat" | "threads";
export type EventOrigin = "cli" | "api" | "worker";

export interface ChannelEventBase {
  seq: number;
  ts: string;
  kind: ChannelEventKind;
  by: string;
  to?: string | string[];
  origin?: EventOrigin;
  meta?: Record<string, unknown>;
}
```

```ts
export interface ChannelAddressOptions {
  channel: string;
  scope?: ChannelScope;
  /**
   * Storage project bucket key. This is not the create-event `project`
   * metadata slug.
   */
  projectKey?: string;
  /**
   * Optional cwd used to derive the project bucket when scope is "project".
   */
  cwd?: string;
}

export interface ContextMutationOptions extends ChannelAddressOptions {
  by: string;
  context: ContextEntry[];
  origin?: EventOrigin;
  meta?: Record<string, unknown>;
}

export interface ThreadContextMutationOptions extends ContextMutationOptions {
  thread: string;
}

export interface RenameThreadOptions extends ChannelAddressOptions {
  by: string;
  thread: string;
  newThread: string;
  origin?: EventOrigin;
  meta?: Record<string, unknown>;
}

export interface SetChannelTitleOptions extends ChannelAddressOptions {
  by: string;
  title: string;
  origin?: EventOrigin;
  meta?: Record<string, unknown>;
}

export interface ClearChannelTitleOptions extends ChannelAddressOptions {
  by: string;
  origin?: EventOrigin;
  meta?: Record<string, unknown>;
}
```

Core APIs accept structured values. CLI-only parsers such as CSV parsing and
terminal formatting stay in CLI unless they are needed for event validation or
projection.

Create-event metadata `project` remains a payload field on `createChannel`
options. Storage addressing uses `projectKey` or `cwd`, never `project`.

```ts
createChannel(options): Promise<ChannelEvent>
sendMessage(options): Promise<MessageChannelEvent>
postThread(options): Promise<ThreadChannelEvent>
readChannelEvents(options): Promise<ChannelEvent[]>
readChannelMetadata(options): Promise<ChannelMetadata>
listThreads(options): Promise<ThreadState[]>
showThread(options): Promise<ThreadChannelEvent[]>
addChannelContext(options): Promise<ContextChannelEvent>
deleteChannelContext(options): Promise<ContextChannelEvent>
listChannelContext(options): Promise<ContextEntry[]>
addThreadContext(options): Promise<ContextChannelEvent>
deleteThreadContext(options): Promise<ContextChannelEvent>
listThreadContext(options): Promise<ContextEntry[]>
renameThread(options): Promise<ThreadChannelEvent>
setChannelTitle(options: SetChannelTitleOptions): Promise<ChannelMetadataEvent>
clearChannelTitle(options: ClearChannelTitleOptions): Promise<ChannelMetadataEvent>
reduceChannelMetadata(events): ChannelMetadata
reduceThreads(events): ThreadState[]
watchChannelEvents(options): AsyncIterable<ChannelEvent>
resolveChannelRef(options): ChannelRef
```

Options object only，不用 positional-heavy signatures。这样未来新增 `origin`、`meta`、storage adapter、project root 等字段时不破坏调用方。

`reduceThreads(events)` and `reduceChannelMetadata(events)` are public because
downstream consumers need the same projection semantics as the CLI. Low-level
storage primitives remain internal: `appendEvent`, event paths, lock paths,
`withLock`, `readLastSeq`, and the seq sidecar implementation are not exported.

示例：

```ts
import { postThread } from "@mindfoldhq/trellis-core/channel";

await postThread({
  channel: "trellis-issue",
  scope: "global",
  action: "comment",
  thread: "core-sdk-feedback",
  by: "external-system",
  origin: "api",
  text,
  meta: {
    external: {
      authorId: "author-id",
      projectId: "project-id",
      taskId: "task-id"
    }
  }
});
```

## Task public API MVP

第一批 task API：

```ts
TrellisTaskRecord
TASK_RECORD_FIELD_ORDER
taskRecordSchema            // { parse, safeParse } — zero-dep runtime validator
emptyTaskRecord(overrides?) // canonical 24-field factory (replaces CLI SOT)
loadTaskRecord(options)
writeTaskRecord(options)    // canonicalises known fields, preserves unknown
validateTaskDirName(name)
isValidTaskDirName(name)
inferTaskPhase(recordOrStatus)
```

这些能力解决下游系统和 Trellis CLI 模板重复维护 task record / phase
inference 的问题。Task API 不应依赖 channel API。`taskRecordSchema` 是
零依赖的运行时 schema：`parse` 抛错，`safeParse` 返回 discriminated
result，未识别字段在结构化输出上被丢弃但在 `writeTaskRecord` 写回时保留
（避免老/新写入方附加的字段被覆盖）。

`inferTaskPhase` 仅根据 `status` 投影：

```text
planning            → plan
in_progress         → implement
review              → review
completed | done    → completed
<anything else>     → unknown
```

不引入独立的 `current_phase` 字段。

## Event attribution boundary

Core API 必须支持 `origin` 和 `meta`，但不解释业务身份：

```text
by     = Trellis 轻量说话者 alias，用于展示、--from、wait --from
to     = Trellis routing target，用于 worker / agent handle
origin = 写入入口：cli | api | worker
meta   = pass-through JSON object
```

外部系统身份信息进入自己的 `meta.<namespace>`，例如 `authorId`、`projectId`、`taskId`。Trellis 不定义 `user`、`org`、权限、displayName schema。

当前 create event 的 `origin: "run"` 和新语义冲突。做 0.7 事件模型时迁移为：

```json
{
  "origin": "cli",
  "meta": {
    "trellis": {
      "createMode": "run"
    }
  }
}
```

## Threads channel context and mutability

Threads channel 已经进入下游集成的紧急产品路径，因此 threads channel / thread
成熟度能力进入当前 trellis-core beta 线，不应推迟到远期 cleanup。

现有代码约束：

- Thread 生命周期已经由 `status` 表达，默认 `open`，现有测试覆盖
  `closed` 和 `processed`。
- `channel threads --status <status>` 已经是状态筛选入口。
- 不引入 thread archive/unarchive，避免和现有 `status` 生命周期重复。
- Channel 现有默认隐藏机制是 `ephemeral`，不新增 channel hide。
- Channel display title 是缺失能力，可以作为 metadata projection 添加。
- GitNexus graph shows `reduceThreads` is the central thread projection used by
  `channelThreadsList`, `channelThreadShow`, `printThreadBoard`, and tests.
  Thread rename/context behavior belongs in that projection path, not in each
  command renderer.
- GitNexus graph showed the old `readChannelMetadata` path delegated to
  `metadataFromCreateEvent(events.find(isCreateEvent))`. Channel title and
  channel-level context need a metadata reducer over the event stream instead
  of special cases in `channel list`, `messages`, or `threads`.
- Formatting helpers such as `formatThreadBoard` stay in CLI. Core returns
  structured projected state, not terminal table lines.

术语收敛：

- 新 API 和新 CLI 使用 `context`。
- `channel create` / `channel post opened` 使用 `--context-file` 和
  `--context-raw`。
- `channel context add/delete/list` 使用 `--file` 和 `--raw`。
- 旧事件里的 `linkedContext` 继续读取，作为 compatibility input。
- Reducer 输出只使用 `context`；新代码不再写 `linkedContext`，也不在
  normalized output 暴露 legacy alias。

Context 是 channel 和 thread 的 orientation data，不是正文。它必须支持两级 projection：

```text
channel context = threads channel 级说明和文件/raw 上下文
thread context  = 单个 thread 级说明和文件/raw 上下文
```

推荐 CLI 形态：

```bash
# Channel-level context
trellis channel context add <channel> --scope global --file /abs/path.md
trellis channel context add <channel> --scope global --raw "short note"
trellis channel context delete <channel> --scope global --file /abs/path.md
trellis channel context delete <channel> --scope global --raw "short note"
trellis channel context list <channel> --scope global

# Thread-level context
trellis channel context add <channel> --scope global --thread <key> --file /abs/path.md
trellis channel context add <channel> --scope global --thread <key> --raw "short note"
trellis channel context delete <channel> --scope global --thread <key> --file /abs/path.md
trellis channel context delete <channel> --scope global --thread <key> --raw "short note"
trellis channel context list <channel> --scope global --thread <key>
```

推荐事件形态：

```json
{
  "kind": "context",
  "target": "channel",
  "action": "add",
  "context": [{ "type": "file", "path": "/abs/path.md" }]
}
```

```json
{
  "kind": "context",
  "target": "thread",
  "thread": "some-thread",
  "action": "delete",
  "context": [{ "type": "raw", "text": "short note" }]
}
```

Reducer 语义：

- `add` 把 context entry 加进 projected set；已有同一 entry 时保持幂等。
- `delete` 从 projected set unlink 匹配 entry；历史 event 仍在 raw log 里。
- file context 以绝对 path 作为 identity。
- raw context 以完整 text 作为 identity。
- raw output 保留全部历史，pretty/default projection 展示当前有效 context。
- Thread-level context must resolve thread aliases through the same rename
  resolver as comments/status events so context does not fork from the thread
  timeline.

Channel metadata projection:

- `reduceChannelMetadata(events)` replaces create-only metadata reads.
- `create` initializes `type`, `description`, `labels`, and `context`.
- Legacy create-event `linkedContext` reads into normalized `context`.
- `kind:"context", target:"channel"` add/delete mutates channel-level context.
- `kind:"channel", action:"title"` sets or clears display title.
- Legacy `type:"thread"` reads as projected `type:"threads"`.
- New writes use `type:"threads"` and output does not expose `linkedContext`.

Thread 管理能力：

- 支持 single thread rename。
- Thread 生命周期继续使用现有 `status` 字段表达，例如 `open` / `closed` /
  `processed`；不新增 archive/unarchive 状态轴。
- `trellis channel threads <channel> --status closed` 继续作为查看 closed
  threads 的方式。
- 暂不做 single comment deletion。
- 暂不做 single thread hard delete。
- 暂不做 channel address rename。

Thread rename 事件形态：

```json
{
  "kind": "thread",
  "action": "rename",
  "thread": "old-key",
  "newThread": "new-key"
}
```

Thread rename reducer semantics:

- `newThread` must not already resolve to an existing thread. Core rejects this
  to avoid silently merging two historical timelines.
- Projection maintains an alias map from old keys to current keys. Rename chains
  such as `a -> b -> c` resolve to `c`.
- Events received after the rename for an old key resolve to the current key.
  This prevents late comments/status/context writes from recreating a ghost
  thread.
- `showThread(key)` resolves the key to the current thread id, then returns all
  thread events whose thread key belongs to that thread alias set. The timeline
  includes events written before rename and late events written to old aliases.
- `ThreadState` exposes previous keys as `aliases` or `previousThreads`; pick
  one public field name during implementation and use it everywhere.
- Rename events update `lastSeq` and `updatedAt`.

Channel display title rename 进入 P0，但它不是 channel address rename。Channel
address 仍然是 storage directory key；`trellis channel title set` 只改展示名，
不会让旧 channel name 失效，也不会移动目录。

推荐 CLI：

```bash
trellis channel title set <channel> --title "Readable title" --scope global
trellis channel title clear <channel> --scope global
```

推荐事件：

```json
{
  "kind": "channel",
  "action": "title",
  "title": "Readable title"
}
```

```json
{
  "kind": "channel",
  "action": "title",
  "title": null
}
```

Reducer 语义：

- 最后一条 `kind:"channel", action:"title"` 决定 projected `title`。
- `title: null` 清除 display title。
- `messages` / `list` 可以展示 title，但所有命令寻址仍使用 channel name。
- 未来如果要做 address rename，命令应叫 `trellis channel move <old> <new>`，
  作为 storage operation 单独设计。

`--type thread` 命名应迁移为 `--type threads`：

```text
channel type = threads
threads channel contains multiple threads
thread has comments/status/context
```

`--type thread` 不保留 alias。Beta 线直接改为 `--type threads`；旧值应报错并提示使用 `--type threads`。

旧 event log 里的 `type: "thread"` 仅作为 reducer/schema read compatibility；
projection 输出统一为 `type: "threads"`，新写入永远写 `threads`。

这些语义必须进入 core reducer 和 event schema，由 CLI 包做薄 wrapper。下游系统可以直接
消费同一套 projection，避免重新实现 context mutation/delete 规则。

## Seq sidecar

`appendEvent` must stop scanning `events.jsonl` for every write. Core owns a
single sidecar seq mechanism:

- Sidecar path: `<channelDir>/.seq`.
- File content: one decimal integer followed by newline.
- Locking: append JSONL and update `.seq` inside the same channel lock critical
  section.
- Compatibility: old channels without `.seq` lazy-rebuild on first append; no
  migration manifest is needed.
- Verification: concurrent append tests must prove no duplicate seq values and
  no gaps.

Normal append path under the channel lock:

1. Read `.seq` if present.
2. Read the last complete JSONL event by tailing from the end of `events.jsonl`
   without full-file scan.
3. If `.seq` is missing, corrupt, lower than the last JSONL seq, or higher than
   the last JSONL seq, repair it from the JSONL tail or full scan fallback.
4. Assign `seq = max(sidecarSeq, lastJsonlSeq) + 1`.
5. Append the event to `events.jsonl`.
6. Atomically write `.seq` using temp file + rename.

Recovery rules:

- Sidecar lower than JSONL tail: repair from JSONL before appending.
- Sidecar higher than JSONL tail: repair from JSONL before appending; do not
  create gaps from a stale reservation.
- JSONL tail parse failure: full scan valid lines; if full scan cannot establish
  max seq, fail instead of guessing.

First implementation checkpoint / 0.7 P0 includes data APIs, projection APIs,
watch, context/title/rename, seq sidecar, and release wiring. `wait`, `spawn`,
`kill`, and supervisor extraction are follow-up phases unless the user
explicitly expands implementation scope after P0 lands.

## Migration order

不要一口气搬 `spawn/wait/kill`。迁移顺序：

1. 抽 `types + schema + filter + thread-state`。
2. 抽 `store`: `paths / lock / events / watch / seq`。
3. 抽纯数据 API：`create / send / postThread / read / listThreads / showThread`。
4. 抽 channel/thread context mutation、thread rename、channel display title reducer。
5. CLI 改成调用 core public API。
6. 实现 `appendEvent` sidecar seq，停止锁内全量扫描 `events.jsonl`。
7. 抽 `wait`。
8. 最后抽 `spawn / kill / supervisor / adapters`。

理由：`spawn/kill` 牵涉 provider、进程、session id、stdin/stdout、kill ladder，风险更高。先把 storage/thread API 变成 SOT，下游 Node 消费方就能先接 threads channel 和 event stream。

## Build and verification

第一版 scripts：

```json
{
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "lint": "eslint src/ test/"
  }
}
```

Library tsconfig：

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "stripInternal": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "isolatedDeclarations": true,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

发布前验证后续补：

```bash
pnpm --filter @mindfoldhq/trellis-core build
pnpm --filter @mindfoldhq/trellis-core test
pnpm --filter @mindfoldhq/trellis-core typecheck
pnpm --filter @mindfoldhq/trellis-core lint
pnpm --dir packages/core exec publint --strict
pnpm --dir packages/core exec attw --pack . --profile esm-only
```

`publint` / `attw` 是发布前门禁。因为 P0 是 ESM-only，smoke test 应覆盖 ESM import
和 TypeScript consumer resolution；CJS `require()` 不作为成功路径，但应得到清晰
ESM-only failure，而不是解析到错误文件。

## Versioning and release integration

`@mindfoldhq/trellis-core` 第一阶段跟随 CLI 同版本发布，不单独走独立
semver 线：

```text
@mindfoldhq/trellis       0.6.0-beta.N
@mindfoldhq/trellis-core  0.6.0-beta.N
```

理由：

- Core 是从 CLI 内部 channel/task 语义抽出来的包，当前消费者主要是 CLI
  和下游 Node 集成；版本漂移会让 bug triage 变复杂。
- CLI 依赖 core 时使用 `workspace:*`，发布时必须被 pnpm 重写成同版本
  dependency，避免 CLI tarball 指向不存在或错误的 core range。
- 当前仓库没有 changesets；已有 release flow 是 `pnpm version` + git tag +
  GitHub Actions publish。P0 不引入 changesets，避免同时迁移 release
  系统和抽 core package。

Release policy：

- Beta / rc / stable dist-tag 跟随 CLI 的版本后缀：
  - `*-beta.*` 发布到 npm `beta`
  - `*-rc.*` 发布到 npm `rc`
  - 无 prerelease 后缀发布到 npm `latest`
- 绝不把 prerelease 发布到 `latest`。
- `latest`、`beta`、`rc` 是并存指针，不是互相覆盖的单线版本：

```text
stable line: 0.5.15        -> npm dist-tag latest
beta line:   0.6.0-beta.12 -> npm dist-tag beta
rc line:     0.6.0-rc.0    -> npm dist-tag rc
```

- 发布 `0.6.0-beta.N` 不能移动 `latest`；稳定用户继续安装 `0.5.x`。
- 发布 `0.6.0-rc.N` 不能移动 `latest` 或 `beta`；rc 是 API freeze 后的独立候选线。
- 发布 `0.6.0` GA 时才移动 `latest` 到 `0.6.0`；`beta` / `rc` tag 可以保留作历史入口，也可以在后续 release maintenance 中移除。
- `0.6.0` GA 后，如果继续做稳定补丁，版本走 `0.6.1`, `0.6.2` 并发布到 `latest`。
- 下一轮新功能 beta 不能继续用 `0.6.0-beta.N`；应开 `0.7.0-beta.0`。
- Core 和 CLI 在每条线内都保持同一个 exact version：

```text
@mindfoldhq/trellis       0.6.0-rc.0
@mindfoldhq/trellis-core  0.6.0-rc.0
```

- CLI 发布包依赖 core 时必须指向同一 exact version，而不是宽松 range：

```json
{
  "dependencies": {
    "@mindfoldhq/trellis-core": "0.6.0-rc.0"
  }
}
```

这避免 `@mindfoldhq/trellis@0.6.0-rc.0` 在用户机器上解析到
`@mindfoldhq/trellis-core@0.6.0-beta.N` 或未来 `0.6.0`。
- 首次发布 core package 必须包含：
  - `publishConfig.access: "public"`
  - `publishConfig.provenance: true`，并更新 publish workflow 的
    `permissions.id-token: write`
  - package exports 包含 `"./package.json"`
  - `files: ["dist"]`
  - `sideEffects: false`

Release workflow 必须随 P0 更新：

- CI path filter 从 `packages/cli/**` 扩展到 `packages/core/**`。
- CI build/test/typecheck 覆盖 core 和 CLI。
- Publish workflow build 覆盖 core 和 CLI。
- Publish workflow 在同一个 tag 下发布两个包，顺序为 core 先、CLI 后。
- Publish workflow 的 npm tag 由 package version 计算一次，然后同时用于 core
  和 CLI；不要两个 package 各自判断 tag。
- `packages/cli/package.json` 的 release scripts 不能只 bump CLI version；需要
  同步 bump `packages/core/package.json`，再打同一个 `vX.Y.Z` tag。
- `release:beta` 只递增当前 beta 线；`release:rc` 从 beta 线切到 rc 线；
  `release:promote` 去掉 prerelease suffix 变成 GA；稳定 `release` 在当前
  GA 线上递增 patch。
- Root `package.json` 应声明 `packageManager`，避免本地和 CI 的 pnpm 版本漂移。
- Manifest/changelog 仍属于 CLI package，因为 `trellis update` 消费
  `@mindfoldhq/trellis` tarball 里的 manifests；core package 不单独拥有
  migration manifest。

Verification additions：

```bash
pnpm --filter @mindfoldhq/trellis-core build
pnpm --filter @mindfoldhq/trellis-core typecheck
pnpm --filter @mindfoldhq/trellis-core test
pnpm --filter @mindfoldhq/trellis-core lint
pnpm --filter @mindfoldhq/trellis build
pnpm --filter @mindfoldhq/trellis typecheck
pnpm --filter @mindfoldhq/trellis test
pnpm --filter @mindfoldhq/trellis lint
pnpm --dir packages/core exec publint --strict
pnpm --dir packages/core exec attw --pack .
```

## 0.7 切分建议

0.7 必须包含：

- `packages/core` package skeleton。
- Channel store/thread API 抽取。
- CLI 调 core，不重复实现 event/thread contract。
- `origin/meta` event attribution contract。
- `context` add/delete projection，覆盖 threads-channel-level 和 thread-level。
- thread rename。
- channel display title rename。
- `--type threads`；不保留 `--type thread` alias。
- `appendEvent` sidecar seq。
- Release scripts / GitHub Actions 支持 core + CLI 同版本 beta 发布。

0.7 可以延后：

- `spawn/kill/supervisor` 完整抽取。
- CJS dual build。
- StorageAdapter。
- managed resident agents。
- cloud-backed channel storage。
- single comment deletion。
- single thread hard delete。
- channel address rename / directory move。
- channel metadata mutation beyond title。
- changesets 迁移；当前先沿用 repo 现有 release scripts。
